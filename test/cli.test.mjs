import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir,link,symlink,readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runCase,runRaw } from './support/cli-harness.mjs'
import { documents } from './support/fixtures.mjs'
import { runCli } from '../src/cli.mjs'
const bytes=raw=>Buffer.from(JSON.stringify(raw))
test('good CLI emits one JSON report, three artifacts and fixed human summary',async()=>{
  const r=await runCase();assert.equal(r.code,0);assert.equal(r.report.status,'pass');assert.deepEqual(r.report.findings,[])
  assert.deepEqual(Object.keys(r.artifacts),['coverage.json','coverage.csv','navigator-layer.json']);assert.equal(r.artifacts['coverage.json'],r.stdout)
  assert.equal(r.stderr,'attack-coverage-mapper: pass; checked 2; mapped 2\n');assert.deepEqual(r.after,r.before)
  assert.equal(r.args[0],'--import');assert.match(r.args[1],/deny-network\.mjs$/u)
})
for(const argv of [['--unexpected'],['positional'],['--layer-version','4.3'],['--dataset','another'],['--force']])test('bad CLI configuration '+argv.join(' '),async()=>{
  const r=await runCase({extraArgs:argv});assert.equal(r.code,2);assert.equal(r.stdout,'');assert.deepEqual(r.artifacts,{})
  assert.equal(r.stderr,'Invalid command configuration. Use --help.\n')
})
test('help and missing required options have empty stdout',()=>{
  const help=runRaw(['--help']);assert.equal(help.code,0);assert.equal(help.stdout,'');assert.match(help.stderr,/--dataset/u)
  for(const argv of [[],['--dataset'],['--help','--dataset','x'],['--dataset=x']]) {const r=runRaw(argv);assert.equal(r.code,2);assert.equal(r.stdout,'')}
})
for(const [detection,code,status] of [['detected',0,'pass'],['not-detected',1,'fail'],['unknown',2,'incomplete']])test('CLI observed outcome '+detection,async()=>{
  const {activities}=documents();activities.activities[0].detection=detection
  const r=await runCase({activityBytes:bytes(activities)});assert.equal(r.code,code);assert.equal(r.report.status,status);assert.deepEqual(r.after,r.before)
  if(status==='incomplete')assert.equal(JSON.parse(r.artifacts['navigator-layer.json']).techniques.every(t=>!Object.hasOwn(t,'score')),true)
})
for(const [mode,role,rule,hasLayer] of [
  ['dataset-missing','@dataset','input-unreadable',false],['activities-missing','@activities','input-unreadable',true],
  ['dataset-malformed','@dataset','input-invalid',false],['activities-malformed','@activities','input-invalid',true],
  ['version-missing','@dataset','dataset-version-missing',false],['unknown-id','@activities','technique-unknown',true],
  ['note-unavailable','@activities','note-evidence-incomplete',true],['empty','@activities','no-activities',true],
  ['inventory-false','@activities','inventory-incomplete',true],['bad-index','@dataset','dataset-invalid',false]])test('evaluated evidence shape '+mode,async()=>{
  const {dataset,activities}=documents();let d=bytes(dataset),a=bytes(activities)
  if(mode==='dataset-missing')d=null
  if(mode==='activities-missing')a=null
  if(mode==='dataset-malformed')d=Buffer.from('at position 1\nPRIVATE_SENTINEL')
  if(mode==='activities-malformed')a=Buffer.from('password=PRIVATE_SENTINEL')
  if(mode==='version-missing'){delete dataset.version;d=bytes(dataset)}
  if(mode==='unknown-id'){activities.activities[0].techniqueIds=['T9999'];a=bytes(activities)}
  if(mode==='note-unavailable'){activities.sourceNotes[0].available=false;a=bytes(activities)}
  if(mode==='empty'){activities.activities=[];a=bytes(activities)}
  if(mode==='inventory-false'){activities.inventoryComplete=false;a=bytes(activities)}
  if(mode==='bad-index'){dataset.techniques.push({id:'bad'});d=bytes(dataset)}
  const r=await runCase({datasetBytes:d,activityBytes:a});assert.equal(r.code,2);assert.equal(r.report.status,'incomplete')
  assert.ok(r.report.findings.some(f=>f.ruleId===rule&&f.location.file===role));assert.equal(Object.hasOwn(r.artifacts,'navigator-layer.json'),hasLayer)
  assert.equal(r.stdout.includes('PRIVATE_SENTINEL'),false);assert.equal(r.stderr.includes('PRIVATE_SENTINEL'),false)
})
for(const source of ['datasetPath','activityPath'])for(const mode of ['hardlink','symlink','dangling'])test(`CLI ${mode} alias of ${source}`,async()=>{
  const r=await runCase({prepare:async ctx=>{
    await mkdir(ctx.outDir)
    if(mode==='hardlink')await link(ctx[source],join(ctx.outDir,'coverage.csv'))
    if(mode==='symlink')await symlink(ctx[source],join(ctx.outDir,'coverage.csv'))
    if(mode==='dangling')await symlink(join(ctx.outDir,'does-not-exist'),join(ctx.outDir,'coverage.csv'))
  },inspect:async(result,ctx)=>{assert.equal(await readFile(ctx[source],'utf8'),source==='datasetPath'?JSON.stringify(documents().dataset):JSON.stringify(documents().activities))}})
  assert.equal(r.code,2);assert.equal(r.stdout,'');assert.deepEqual(r.before,r.after)
})
test('dangling input alias of future report is a config refusal',async()=>{
  const r=await runCase({datasetBytes:null,prepare:async({datasetPath,outDir})=>symlink(join(outDir,'coverage.json'),datasetPath)})
  assert.equal(r.code,2);assert.equal(r.stdout,'');assert.deepEqual(r.artifacts,{})
})
test('different host paths do not change reports or artifact bytes',async()=>{
  const a=await runCase(),b=await runCase();assert.equal(a.code,0);assert.equal(b.code,0);assert.equal(a.stdout,b.stdout);assert.deepEqual(a.artifacts,b.artifacts)
})
test('runCli emits evaluated deadline and operational failures as incomplete reports',async()=>{
  let stdout='',stderr=''
  const code=await runCli(['--dataset','x','--activities','y','--out-dir','z'],{stdout:s=>stdout+=s,stderr:s=>stderr+=s,now:()=>NaN})
  assert.equal(code,2);const report=JSON.parse(stdout);assert.equal(report.status,'incomplete');assert.ok(report.findings.some(f=>f.ruleId==='analysis-clock-invalid'))
  assert.match(stderr,/incomplete/u)
})
