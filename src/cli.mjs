import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { createBudget,BudgetError } from './limits.mjs'
import { readInput,InputError } from './json.mjs'
import { analyzeReadResults } from './index.mjs'
import { buildReport,issue,serializeReport,formatSummary,exitCodeFor } from './report.mjs'
import { ConfigError,renderArtifacts } from './exports.mjs'
import { preflightOutput,writeArtifacts,OutputError } from './output.mjs'
import { DestinationError,InputTargetError } from './write-guard.mjs'
const HELP=`attack-coverage-mapper --dataset FILE --activities FILE --out-dir DIR [--layer-version 4.4]
Offline Node ESM tool. Only normalized dataset schema 1 and activities schema 1 are supported.
--help alone prints this usage. No network, automatic inference, raw STIX adapter, or provider lookup.
Inputs are exactly the two named local files; their symlinks resolve to recorded real paths.
Outputs are confined to the real output directory. Final directory symlinks, input aliases,
and existing reserved files are refused. Use a fresh directory for every completed export.
Stdout: one JSON report. Stderr: human summary. Exits: 0 complete detected, 1 complete
not-detected, 2 incomplete evidence/execution or bad configuration (bad config has empty stdout).
Note availability is analyst-declared in the inline registry; no note files are inspected.
Dataset/activities: 8 MiB each; techniques/activities/notes: 5000; JSON depth: 16;
nodes: 250000; IDs/row: 32; tactics/technique: 16; refs: 128; notes: 4096;
version: 16; source URL: 512; export: 32 MiB each; injected cooperative deadline: 5 seconds.
See README and docs/input-format.md for the closed JSON contracts and export limitations.
`
export function parseArgs(argv) {
  if(!Array.isArray(argv) || argv.some(a=>typeof a!=='string'))throw new ConfigError()
  if(argv.length===1&&argv[0]==='--help')return {help:true,layerVersion:'4.4'}
  const options=new Map(),names=new Map([['--dataset','dataset'],['--activities','activities'],['--out-dir','outDir'],['--layer-version','layerVersion']])
  for(let i=0;i<argv.length;i+=2) {
    const key=argv[i],value=argv[i+1]
    if(!names.has(key) || options.has(key) || value===undefined || value==='' || value.startsWith('--'))throw new ConfigError()
    options.set(key,value)
  }
  for(const key of ['--dataset','--activities','--out-dir'])if(!options.has(key))throw new ConfigError()
  if(options.has('--layer-version')&&options.get('--layer-version')!=='4.4')throw new ConfigError('unsupported-layer-version')
  return {help:false,dataset:options.get('--dataset'),activities:options.get('--activities'),outDir:options.get('--out-dir'),layerVersion:'4.4'}
}
const defaultIO={readInput,preflightOutput,writeArtifacts}
export async function runCli(argv,{stdout,stderr,now=()=>performance.now(),io=defaultIO}) {
  let report=null
  try {
    const options=parseArgs(argv)
    if(options.help){stderr(HELP);return 0}
    const budget=createBudget(now),inputs=[resolve(options.dataset),resolve(options.activities)],identities=[]
    const read=async(path,file)=>{
      try {
        const result=await io.readInput(path,{check:()=>budget.check(file)})
        inputs.push(result.realPath);identities.push(result.identity)
        return {ok:true,bytes:result.bytes}
      }catch(e){if(!(e instanceof InputError))throw e;return {ok:false,code:e.code}}
    }
    const datasetRead=await read(options.dataset,'@dataset'),activityRead=await read(options.activities,'@activities')
    let preflight
    try{preflight=await io.preflightOutput(options.outDir,{inputs,identities})}
    catch(e){
      if(e instanceof InputTargetError){report=analyzeReadResults({datasetRead,activityRead,budget});throw new OutputError()}
      if(e instanceof DestinationError)throw new ConfigError('unsafe-destination')
      throw e
    }
    report=analyzeReadResults({datasetRead,activityRead,budget})
    const artifacts=renderArtifacts(report,{layerVersion:options.layerVersion},budget)
    await io.writeArtifacts(preflight,artifacts,{inputs,budget})
    stdout(serializeReport(report));stderr(formatSummary(report))
    return exitCodeFor(report)
  }catch(e){
    if(e instanceof ConfigError){stderr('Invalid command configuration. Use --help.\n');return 2}
    const rule=e instanceof BudgetError?e.code:e.code==='limit-export-bytes-exceeded'?e.code:e.code==='output-unwritable'?'output-unwritable':'execution-failed'
    report=buildReport({findings:[...(report?.findings??[]),issue(rule,e instanceof BudgetError?e.file:'@output')],checked:report?.summary.checked??0,mappedActivities:report?.summary.mappedActivities??0,coverage:report?.coverage??[],tacticCoverage:report?.tacticCoverage??[],dataset:report?.dataset??null,totals:report?.summary??{}})
    stdout(serializeReport(report));stderr(formatSummary(report));stderr('Export did not complete; use a fresh output directory.\n')
    return 2
  }
}
