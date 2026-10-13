import assert from 'node:assert/strict'
import test from 'node:test'
import { createBudget } from '../src/limits.mjs'
import { compileDataset, compileActivities } from '../src/contracts.mjs'
import { documents, datasetWith, activitiesWith } from './support/fixtures.mjs'
const cd=raw=>compileDataset(raw,createBudget(() => 0))
const ca=raw=>compileActivities(raw,createBudget(() => 0))
test('complete synthetic parent/subtechnique dataset and notes have no finding',()=>{
  const {dataset,activities}=documents();const d=cd(dataset);const a=ca(activities)
  assert.deepEqual(d.findings,[]);assert.deepEqual(a.findings,[])
  assert.equal(d.dataset.byId.get('T0001.001').parentId,'T0001')
  assert.equal(a.rows[1].ordinal,2);assert.equal(a.notes.get('private-note-b').ordinal,2)
  assert.equal(JSON.stringify(a).includes('PRIVATE_NOTE_SENTINEL'),false)
})
for(const domain of ['enterprise','mobile','ics'])test(`supported ${domain} domain`,()=>{
  const {dataset}=documents();dataset.domain=domain;assert.equal(cd(dataset).dataset.domain,domain)
})
for(const [name,mutate,rule] of [
  ['missing version',d=>delete d.version,'dataset-version-missing'],
  ['orphan',d=>d.techniques[1].parentId='T9999','dataset-parent-invalid'],
  ['self parent',d=>d.techniques[1].parentId='T0001.001','dataset-parent-invalid'],
  ['parent on root',d=>d.techniques[0].parentId='T0001','dataset-parent-invalid'],
  ['duplicate ID',d=>d.techniques.push({...d.techniques[0]}),'dataset-id-duplicate'],
  ['one malformed record',d=>d.techniques.push({id:'bad'}),'dataset-invalid'],
  ['missing status',d=>delete d.techniques[0].revoked,'dataset-invalid'],
  ['empty subset',d=>d.techniques=[],'dataset-empty'],
  ['unknown key',d=>d.private='SECRET','dataset-invalid']])test(name,()=>{
    const {dataset}=documents();mutate(dataset);const result=cd(dataset)
    assert.equal(result.dataset,null);assert.ok(result.findings.some(f=>f.ruleId===rule))
    assert.equal(result.findings.some(f=>f.ruleId==='technique-unknown'),false)
})
for(const raw of [null,[],{},'STIX',{type:'bundle',objects:[]}])test(`unsupported root ${JSON.stringify(raw)}`,()=>{
  assert.equal(cd(raw).dataset,null);assert.ok(cd(raw).findings.length)
  assert.ok(ca(raw).findings.some(f=>f.ruleId==='activity-document-invalid'))
})
for(const [field,value] of [['domain','multiple'],['version',{}],['sourceUrl',{}],['schemaVersion',1]])test(`hostile dataset field ${field}`,()=>{
  const {dataset}=documents();dataset[field]=value;assert.equal(cd(dataset).dataset,null)
})
for(const field of ['id','parentId','revoked','deprecated','tactics'])test(`hostile technique leaf ${field}`,()=>{
  const {dataset}=documents();dataset.techniques[0][field]={toString:{}};assert.equal(cd(dataset).dataset,null)
})
for(const url of ['https://attack.mitre.org.evil.test/','https://u:p@attack.mitre.org/','https://attack.mitre.org/?token=SECRET','https://attack.mitre.org/#SECRET','https://raw.githubusercontent.com/other/repo/main/a.json','https://github.com/mitre-attack/attack-stix-data-evil/a','https://attack.mitre.org/%2Fsecret','https://attack.mitre.org/\\private'])test('unsafe provenance '+url,()=>{
  const {dataset}=documents();dataset.sourceUrl=url;const r=cd(dataset);assert.equal(r.dataset,null);assert.equal(r.metadata.sourceUrl,null)
})
test('dataset records, tactics, version and provenance bounds have legal N controls',()=>{
  assert.deepEqual(cd(datasetWith(5000)).findings,[])
  assert.ok(cd(datasetWith(5001)).findings.some(f=>f.ruleId==='limit-techniques-exceeded'))
  const {dataset}=documents();dataset.techniques[0].tactics=Array.from({length:16},(_,i)=>`tactic-${i}`)
  assert.ok(cd(dataset).dataset);dataset.techniques[0].tactics.push('extra');assert.equal(cd(dataset).dataset,null)
  for(const [field,good,bad] of [['version','1'.repeat(16),'1'.repeat(17)],['sourceUrl','https://attack.mitre.org/'+'a'.repeat(487),'https://attack.mitre.org/'+'a'.repeat(488)]]) {
    dataset.techniques[0].tactics=['execution'];dataset[field]=good;assert.ok(cd(dataset).dataset,field);dataset[field]=bad;assert.equal(cd(dataset).dataset,null,field)
    dataset[field]=documents().dataset[field]
  }
  dataset.techniques[0].tactics=['a'.repeat(64)];assert.ok(cd(dataset).dataset)
  dataset.techniques[0].tactics=['a'.repeat(65)];assert.equal(cd(dataset).dataset,null)
})
test('activities and registry counts have legal N and failing N+1',()=>{
  assert.deepEqual(ca(activitiesWith(5000)).findings,[])
  assert.ok(ca(activitiesWith(5001)).findings.some(f=>f.ruleId==='limit-activities-exceeded'))
  const {activities}=documents();activities.sourceNotes=Array.from({length:5000},(_,i)=>({ref:`note-${i}`,available:true}))
  assert.deepEqual(ca(activities).findings,[]);activities.sourceNotes.push({ref:'extra',available:true})
  assert.ok(ca(activities).findings.some(f=>f.ruleId==='limit-notes-exceeded'))
})
test('note ambiguity and private unusable references remain incomplete and located',()=>{
  const {activities}=documents();activities.sourceNotes.push({...activities.sourceNotes[0]})
  const dup=ca(activities);assert.equal(dup.ambiguousRefs.has('private-note-a'),true);assert.equal(dup.notes.has('private-note-a'),false)
  assert.equal(dup.findings.filter(f=>f.ruleId==='note-evidence-incomplete').length,2)
  for(const ref of ['', ' ', '\u0085\u200E', 'a'.repeat(129),{toString:{}}]) {
    const a=documents().activities;a.sourceNotes[0].ref=ref
    const r=ca(a);assert.ok(r.findings.some(f=>f.ruleId==='note-evidence-incomplete'&&f.location.pointer==='/sourceNotes/0/ref'))
  }
})
test('reference, note and technique-list bounds accept N and refuse N+1',()=>{
  const {activities}=documents();activities.sourceNotes[0].ref='a'.repeat(128);activities.sourceNotes[0].note='a'.repeat(4096)
  activities.activities[0].techniqueIds=Array.from({length:32},(_,i)=>`T${String(i).padStart(4,'0')}`)
  assert.deepEqual(ca(activities).findings,[])
  activities.activities[0].techniqueIds.push('T9999');assert.ok(ca(activities).findings.some(f=>f.ruleId==='activity-invalid'))
  activities.activities[0].techniqueIds=['T0001'];activities.sourceNotes[0].note+='x';assert.ok(ca(activities).findings.some(f=>f.ruleId==='note-evidence-incomplete'))
})
for(const field of ['sourceNoteRef','techniqueIds','detection','tactic'])test(`hostile activity leaf ${field}`,()=>{
  const {activities}=documents();activities.activities[0][field]={toString:{}}
  assert.ok(ca(activities).findings.some(f=>f.ruleId==='activity-invalid'))
})
test('empty complete inventory is explicitly incomplete; false completeness is also visible',()=>{
  const {activities}=documents();activities.activities=[]
  assert.ok(ca(activities).findings.some(f=>f.ruleId==='no-activities'))
  activities.inventoryComplete=false;assert.ok(ca(activities).findings.some(f=>f.ruleId==='inventory-incomplete'))
})
