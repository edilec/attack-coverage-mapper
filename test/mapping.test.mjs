import assert from 'node:assert/strict'
import test from 'node:test'
import { analyze, createBudget, exitCodeFor } from '../src/index.mjs'
import { documents } from './support/fixtures.mjs'
export const evaluate=(dataset,activities,options={})=>analyze({datasetBytes:Buffer.from(JSON.stringify(dataset)),activityBytes:Buffer.from(JSON.stringify(activities)),budget:createBudget(()=>0),...options})
test('good explicit parent and child produce silent pass and source ordinals',()=>{
  const {dataset,activities}=documents();const r=evaluate(dataset,activities)
  assert.equal(r.status,'pass');assert.equal(exitCodeFor(r),0);assert.deepEqual(r.findings,[])
  assert.equal(r.summary.checked,2);assert.equal(r.summary.mappedActivities,2)
  assert.deepEqual(r.coverage.map(x=>x.techniqueId),['T0001','T0001.001'])
  assert.deepEqual(r.coverage[0].activityOrdinals,[1]);assert.deepEqual(r.coverage[1].noteOrdinals,[2])
  assert.equal(JSON.stringify(r).includes('PRIVATE_NOTE_SENTINEL'),false)
  assert.equal(JSON.stringify(r).includes('private-note'),false)
})
test('known not-detected means exit 1, unknown dominates known failure',()=>{
  const {dataset,activities}=documents();activities.activities[0].detection='not-detected'
  let r=evaluate(dataset,activities);assert.equal(r.status,'fail');assert.equal(exitCodeFor(r),1)
  assert.equal(r.findings.find(f=>f.ruleId==='not-detected').severity,'error')
  activities.activities[1].detection='unknown';r=evaluate(dataset,activities)
  assert.equal(r.status,'incomplete');assert.equal(exitCodeFor(r),2)
  assert.equal(r.summary.notDetectedActivities,1);assert.equal(r.summary.unknownActivities,1)
})
test('all duplicate and conflicting rows retain events and ordinals',()=>{
  const {dataset,activities}=documents();activities.activities=['detected','not-detected','unknown'].map(detection=>({...activities.activities[0],detection}))
  const r=evaluate(dataset,activities),row=r.coverage[0]
  assert.deepEqual([row.detected,row.notDetected,row.unknown],[1,1,1]);assert.deepEqual(row.activityOrdinals,[1,2,3]);assert.equal(row.events.length,3)
  activities.activities=[{...activities.activities[0]},{...activities.activities[0]}]
  const dup=evaluate(dataset,activities);assert.deepEqual(dup.findings,[]);assert.equal(dup.coverage[0].detected,2)
})
test('multiple IDs map once each while global event is counted once',()=>{
  const {dataset,activities}=documents();activities.activities=[{...activities.activities[0],techniqueIds:['T0001','T0001.001']}]
  const r=evaluate(dataset,activities);assert.equal(r.summary.detectedActivities,1);assert.equal(r.summary.techniqueMappings,2);assert.equal(r.coverage.length,2)
  activities.activities[0].techniqueIds=['T0001','T0001']
  const bad=evaluate(dataset,activities);assert.equal(bad.status,'incomplete');assert.equal(bad.summary.mappedActivities,0);assert.ok(bad.findings.some(f=>f.ruleId==='activity-invalid'))
})
test('optional tactics expand display without inflating global counts',()=>{
  const {dataset,activities}=documents();activities.activities=[
    {sourceNoteRef:'private-note-a',techniqueIds:['T0001'],detection:'detected'},
    {sourceNoteRef:'private-note-b',techniqueIds:['T0001'],tactic:'execution',detection:'not-detected'}]
  const r=evaluate(dataset,activities);assert.equal(r.summary.mappedActivities,2);assert.equal(r.summary.techniqueMappings,2)
  assert.deepEqual(r.tacticCoverage.map(x=>[x.tactic,x.detected,x.notDetected]),[['discovery',1,0],['execution',1,1]])
})
for(const [id,rule] of [['T9999','technique-unknown'],['T0002','technique-revoked'],['T0003','technique-deprecated']])test('mapping refusal '+rule,()=>{
  const {dataset,activities}=documents();activities.activities=[{...activities.activities[0],techniqueIds:['T0001',id]}]
  const r=evaluate(dataset,activities);assert.equal(r.status,'incomplete');assert.equal(r.summary.mappedActivities,0);assert.deepEqual(r.coverage,[])
  assert.ok(r.findings.some(f=>f.ruleId===rule && f.location.pointer==='/activities/0/techniqueIds/1'))
})
for(const mode of ['absent','unavailable','ambiguous'])test('note resolution '+mode,()=>{
  const {dataset,activities}=documents();activities.activities=[activities.activities[0]]
  if(mode==='absent') activities.sourceNotes=[]
  if(mode==='unavailable') activities.sourceNotes[0].available=false
  if(mode==='ambiguous') activities.sourceNotes.push({...activities.sourceNotes[0]})
  const r=evaluate(dataset,activities);assert.equal(exitCodeFor(r),2);assert.equal(r.summary.mappedActivities,0)
  assert.ok(r.findings.some(f=>f.ruleId==='note-evidence-incomplete' && f.location.pointer==='/activities/0/sourceNoteRef'))
})
test('invalid tactic refuses whole row; child never infers a parent event',()=>{
  const {dataset,activities}=documents();activities.activities[0].tactic='other'
  const r=evaluate(dataset,activities);assert.equal(r.status,'incomplete');assert.ok(r.findings.some(f=>f.ruleId==='tactic-invalid'))
  assert.deepEqual(r.coverage.map(x=>x.techniqueId),['T0001.001'])
})
test('an unusable dataset does not support negative ID assertions',()=>{
  const {dataset,activities}=documents();dataset.techniques.push({id:'bad'});activities.activities[0].techniqueIds=['T9999']
  const r=evaluate(dataset,activities);assert.equal(r.dataset.usable,false);assert.deepEqual(r.coverage,[])
  assert.equal(r.findings.some(f=>f.ruleId==='technique-unknown'),false);assert.equal(r.status,'incomplete')
})
test('prose never invents a mapping and empty complete inventory is incomplete',()=>{
  const {dataset,activities}=documents();activities.sourceNotes[0].note='T0001.001';delete activities.activities[0].techniqueIds
  let r=evaluate(dataset,activities);assert.equal(r.status,'incomplete');assert.equal(r.summary.mappedActivities,1)
  activities.activities=[];r=evaluate(dataset,activities);assert.equal(exitCodeFor(r),2);assert.ok(r.findings.some(f=>f.ruleId==='no-activities'))
})
