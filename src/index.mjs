import { performance } from 'node:perf_hooks'
import { LIMITS,createBudget,BudgetError } from './limits.mjs'
import { InputError,parseJsonBytes,sha256 } from './json.mjs'
import { compileDataset,compileActivities } from './contracts.mjs'
import { mapActivities } from './mapping.mjs'
import { buildReport,issue } from './report.mjs'
export {createBudget} from './limits.mjs'
export {TOOL_ID,exitCodeFor,serializeReport,formatSummary} from './report.mjs'
const inputRule=code=>({'byte-limit':'limit-bytes-exceeded','depth-limit':'limit-depth-exceeded','node-limit':'limit-nodes-exceeded',unreadable:'input-unreadable','not-file':'input-unreadable'}[code]??'input-invalid')
export function analyzeReadResults({datasetRead,activityRead,budget=createBudget(performance.now)}) {
  const findings=[]
  let metadata={domain:null,version:null,sourceUrl:null,sha256:null,validationScope:'supplied-subset',usable:false}
  let dataset=null,compiled=null,mapped={coverage:[],tacticCoverage:[],mappedActivities:0,totals:{}}
  const parse=(read,file)=>{
    if(!read.ok) {findings.push(issue(inputRule(read.code),file));return null}
    try {return {raw:parseJsonBytes(read.bytes,budget)}} catch(e) {
      if(!(e instanceof InputError)) throw e
      findings.push(issue(inputRule(e.code),file));return null
    }
  }
  try {
    if(datasetRead.ok && datasetRead.bytes instanceof Uint8Array && datasetRead.bytes.length<=LIMITS.bytes) {
      budget.check('@dataset');metadata.sha256=sha256(datasetRead.bytes);budget.check('@dataset')
    }
    const d=parse(datasetRead,'@dataset'),a=parse(activityRead,'@activities')
    if(d) {
      const result=compileDataset(d.raw,budget);findings.push(...result.findings);dataset=result.dataset
      metadata={...metadata,...result.metadata,usable:dataset!==null}
    }
    if(a) {compiled=compileActivities(a.raw,budget);findings.push(...compiled.findings)}
    if(dataset && compiled) {mapped=mapActivities(dataset,compiled,budget);findings.push(...mapped.findings)}
    budget.check('@activities')
  } catch(e) {
    if(!(e instanceof BudgetError)) throw e
    findings.push(issue(e.code,e.file))
  }
  return buildReport({...mapped,findings,checked:compiled?.checked??0,dataset:metadata})
}
export function analyze({datasetBytes,activityBytes,budget}) {
  return analyzeReadResults({datasetRead:{ok:true,bytes:datasetBytes},activityRead:{ok:true,bytes:activityBytes},budget})
}
