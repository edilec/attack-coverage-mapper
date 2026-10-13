import assert from 'node:assert/strict'
import test from 'node:test'
import { analyze,createBudget } from '../src/index.mjs'
import { renderCsv,renderNavigator,renderArtifacts,metadataEntries,csvCell,assertExportBytes,ConfigError } from '../src/exports.mjs'
import { documents } from './support/fixtures.mjs'
const evaluate=(d,a)=>analyze({datasetBytes:Buffer.from(JSON.stringify(d)),activityBytes:Buffer.from(JSON.stringify(a)),budget:createBudget(()=>0)})
const budget=()=>createBudget(()=>0)
function assertLayer(layer) {
  assert.equal(typeof layer.name,'string');assert.ok(layer.name)
  assert.equal(layer.versions.layer,'4.4');assert.equal(layer.versions.navigator,'4.8.2');assert.equal(layer.versions.attack,'17.0')
  assert.ok(['enterprise-attack','mobile-attack','ics-attack'].includes(layer.domain))
  assert.equal(Object.hasOwn(layer,'customDataURL'),false);assert.equal(Object.hasOwn(layer,'links'),false)
  for(const row of layer.techniques) {
    assert.match(row.techniqueID,/^T[0-9]{4}(?:\.[0-9]{3})?$/u);assert.match(row.color,/^#[a-f0-9]{6}$/u)
    if(Object.hasOwn(row,'score')) assert.ok(Number.isFinite(row.score)&&row.score>=0&&row.score<=100)
    for(const item of row.metadata) {assert.equal(typeof item.name,'string');assert.equal(typeof item.value,'string')}
    assert.equal(Object.hasOwn(row,'comment'),false)
  }
}
for(const domain of ['enterprise','mobile','ics'])test('round-trip emitted layer '+domain,()=>{
  const {dataset,activities}=documents();dataset.domain=domain;const report=evaluate(dataset,activities)
  const layer=JSON.parse(JSON.stringify(renderNavigator(report,{},budget())))
  assert.equal(layer.domain,`${domain}-attack`);assertLayer(layer)
  assert.deepEqual(layer.techniques.map(t=>[t.techniqueID,t.tactic]),[['T0001','execution'],['T0001.001','execution']])
  assert.equal(JSON.stringify(layer).includes('private-note'),false)
})
test('CSV has exact safe header, rows, LF, and quoting',()=>{
  const {dataset,activities}=documents();const report=evaluate(dataset,activities)
  assert.equal(renderCsv(report,budget()),'techniqueId,detected,notDetected,unknown,activityOrdinals,noteOrdinals\nT0001,1,0,0,1,1\nT0001.001,1,0,0,2,2\n')
  assert.equal(csvCell('a,"b"'),'"a,""b"""')
})
test('mixed known observations retain counts with an observed fraction score',()=>{
  const {dataset,activities}=documents();activities.activities=['detected','detected','not-detected'].map(detection=>({...activities.activities[0],detection}))
  const r=evaluate(dataset,activities),layer=renderNavigator(r,{},budget()),row=layer.techniques[0]
  assert.equal(r.status,'fail');assert.equal(row.color,'#6a1b9a');assert.equal(row.score,66.67)
  assert.equal(row.metadata.find(m=>m.name==='activity-ordinals').value,'1;2;3')
  assert.equal(row.metadata.find(m=>m.name==='not-detected').value,'1')
})
test('one event of each known outcome still uses the mixed color',()=>{
  const {dataset,activities}=documents();activities.activities=['detected','not-detected'].map(detection=>({...activities.activities[0],detection}))
  const row=renderNavigator(evaluate(dataset,activities),{},budget()).techniques[0]
  assert.equal(row.color,'#6a1b9a');assert.equal(row.score,50)
})
test('unknown is amber and every incomplete layer score is omitted',()=>{
  const {dataset,activities}=documents();activities.activities[0].detection='unknown'
  const layer=renderNavigator(evaluate(dataset,activities),{},budget())
  assert.equal(layer.techniques[0].color,'#f9a825');assert.equal(layer.techniques.every(t=>!Object.hasOwn(t,'score')),true)
  assert.equal(layer.techniques[0].metadata.find(m=>m.name==='unknown').value,'1')
  assert.equal(layer.metadata.find(m=>m.name==='report-status').value,'incomplete')
  activities.activities[0].detection='detected';activities.inventoryComplete=false
  assert.equal(renderNavigator(evaluate(dataset,activities),{},budget()).techniques.every(t=>!Object.hasOwn(t,'score')),true)
})
test('known detected and not-detected styles stay distinct at 100 and 0',()=>{
  const {dataset,activities}=documents();activities.activities[1].detection='not-detected'
  const layer=renderNavigator(evaluate(dataset,activities),{},budget())
  assert.deepEqual(layer.techniques.map(t=>[t.color,t.score]),[['#2e7d32',100],['#c62828',0]])
})
test('every display-style metadata label agrees with its retained observations',()=>{
  for(const [detections,want] of [[['detected'],'detected'],[['not-detected'],'not-detected'],[['unknown'],'unknown'],[['detected','not-detected'],'mixed-known']]) {
    const {dataset,activities}=documents();activities.activities=detections.map(detection=>({...activities.activities[0],detection}))
    const layer=renderNavigator(evaluate(dataset,activities),{},budget())
    assert.equal(layer.techniques[0].metadata.find(m=>m.name==='display-style').value,want)
  }
})
test('unusable version has no invented layer; unsupported format is config failure',()=>{
  const {dataset,activities}=documents();delete dataset.version
  const r=evaluate(dataset,activities);assert.equal(renderNavigator(r,{},budget()),null)
  assert.deepEqual(renderArtifacts(r,{},budget()).map(a=>a.name),['coverage.json','coverage.csv'])
  assert.throws(()=>renderNavigator(r,{layerVersion:'4.3'},budget()),ConfigError)
})
test('metadata follows code-unit ordering through the artifact helper',()=>{
  assert.deepEqual(metadataEntries([['a_b',1],['a-b',2],['a',3],['Z',4]]).map(m=>m.name),['Z','a','a-b','a_b'])
  const {dataset,activities}=documents(),r=evaluate(dataset,activities)
  const one=renderArtifacts(r,{},budget()),two=renderArtifacts(r,{},budget())
  assert.deepEqual(one,two)
  assert.deepEqual(renderNavigator(r,{},budget()).metadata.map(m=>m.name),['color-semantics','dataset-sha256','evidence-semantics','report-status','score-semantics','validation-scope'])
})
test('emitted tactic order retains the specified lexical order',()=>{
  const {dataset,activities}=documents();dataset.techniques[0].tactics=['aa','a-b','a0']
  activities.activities=[{sourceNoteRef:'private-note-a',techniqueIds:['T0001'],detection:'detected'}]
  const r=evaluate(dataset,activities)
  assert.deepEqual(renderNavigator(r,{},budget()).techniques.map(t=>t.tactic),['a-b','a0','aa'])
})
test('export bytes allow N and reject N+1 rather than truncate',()=>{
  assert.doesNotThrow(()=>assertExportBytes(Buffer.alloc(33554432)))
  assert.throws(()=>assertExportBytes(Buffer.alloc(33554433)),e=>e.code==='limit-export-bytes-exceeded')
})
