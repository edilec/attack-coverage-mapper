import assert from 'node:assert/strict'
import test from 'node:test'
import { analyze,createBudget,serializeReport } from '../src/index.mjs'
import { documents } from './support/fixtures.mjs'
const bytes=raw=>Buffer.from(JSON.stringify(raw))
test('malformed both subjects generate located incomplete findings without raw parser text',()=>{
  const r=analyze({datasetBytes:Buffer.from('at position 1 SECRET'),activityBytes:Buffer.from('"SECRET\n'),budget:createBudget(()=>0)})
  assert.equal(r.status,'incomplete');assert.equal(r.findings.filter(f=>f.ruleId==='input-invalid').length,2)
  assert.deepEqual(r.findings.filter(f=>f.ruleId==='input-invalid').map(f=>f.location.file),['@activities','@dataset'])
  assert.equal(serializeReport(r).includes('SECRET'),false)
})
test('evaluation is byte deterministic and exact source-byte digest differs for padding',()=>{
  const {dataset,activities}=documents();const d=bytes(dataset),a=bytes(activities)
  const one=analyze({datasetBytes:d,activityBytes:a,budget:createBudget(()=>0)}),two=analyze({datasetBytes:d,activityBytes:a,budget:createBudget(()=>0)})
  assert.equal(serializeReport(one),serializeReport(two))
  const padded=analyze({datasetBytes:Buffer.concat([d,Buffer.from('\n')]),activityBytes:a,budget:createBudget(()=>0)})
  assert.notEqual(one.dataset.sha256,padded.dataset.sha256)
})
test('expired or invalid injected clocks never become policy fail or pass',()=>{
  const {dataset,activities}=documents();activities.activities[0].detection='not-detected'
  for(const [tick,rule] of [[5001,'analysis-timeout'],[-1,'analysis-clock-invalid'],[NaN,'analysis-clock-invalid']]) {
    let now=0;const budget=createBudget(()=>now);now=tick
    const r=analyze({datasetBytes:bytes(dataset),activityBytes:bytes(activities),budget})
    assert.equal(r.status,'incomplete');assert.ok(r.findings.some(f=>f.ruleId===rule))
  }
  let now=0;const budget=createBudget(()=>now);now=5000
  assert.equal(analyze({datasetBytes:bytes(dataset),activityBytes:bytes(activities),budget}).status,'fail')
})
test('finding pointers 10 and 2 use lexical order over actual rows',()=>{
  const {dataset,activities}=documents();activities.activities=Array.from({length:11},()=>({}))
  const r=analyze({datasetBytes:bytes(dataset),activityBytes:bytes(activities),budget:createBudget(()=>0)})
  assert.deepEqual(r.findings.filter(f=>f.ruleId==='activity-invalid').map(f=>f.location.pointer),['/activities/0','/activities/1','/activities/10','/activities/2','/activities/3','/activities/4','/activities/5','/activities/6','/activities/7','/activities/8','/activities/9'])
})
test('collection incompleteness cannot disappear behind a successful mapper result',()=>{
  const {dataset,activities}=documents();activities.inventoryComplete=false
  const r=analyze({datasetBytes:bytes(dataset),activityBytes:bytes(activities),budget:createBudget(()=>0)})
  assert.equal(r.status,'incomplete');assert.equal(r.summary.mappedActivities,2)
  assert.ok(r.findings.some(f=>f.ruleId==='inventory-incomplete'))
})
