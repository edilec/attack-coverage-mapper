import { LIMITS } from './limits.mjs'
import { issue } from './report.mjs'
import { byCodeUnit, isSafeField } from './text.mjs'
export const isId=value=>typeof value==='string' && /^T[0-9]{4}(?:\.[0-9]{3})?$/u.test(value)
const isTactic=value=>typeof value==='string' && /^[a-z][a-z0-9-]{0,63}$/u.test(value)
const object=raw=>raw!==null && typeof raw==='object' && !Array.isArray(raw)
const keys=(raw,allowed,required=allowed)=>object(raw) && Object.keys(raw).every(k=>allowed.includes(k)) && required.every(k=>Object.hasOwn(raw,k))
function sourceUrl(raw) {
  if(!isSafeField(raw,512) || !/^https:\/\/[A-Za-z0-9._/-]+$/u.test(raw)) return false
  let url;try {url=new URL(raw)} catch {return false}
  if(url.username || url.password || url.search || url.hash || url.port) return false
  return url.hostname==='attack.mitre.org' ||
    (url.hostname==='raw.githubusercontent.com' && url.pathname.startsWith('/mitre-attack/attack-stix-data/')) ||
    (url.hostname==='github.com' && url.pathname.startsWith('/mitre-attack/attack-stix-data/'))
}
export function compileDataset(raw,budget) {
  const findings=[],metadata={domain:null,version:null,sourceUrl:null}
  const add=(rule,pointer)=>findings.push(issue(rule,'@dataset',pointer))
  if(!keys(raw,['schemaVersion','domain','version','sourceUrl','techniques'],['schemaVersion','domain','sourceUrl','techniques']) || raw.schemaVersion!=='1') {
    add('dataset-invalid','');return {dataset:null,metadata,findings}
  }
  if(['enterprise','mobile','ics'].includes(raw.domain)) metadata.domain=raw.domain;else add('dataset-invalid','/domain')
  if(!Object.hasOwn(raw,'version')) add('dataset-version-missing','/version')
  else if(typeof raw.version==='string' && raw.version.length<=16 && /^[0-9]+(?:\.[0-9]+)?$/u.test(raw.version)) metadata.version=raw.version
  else add('dataset-invalid','/version')
  if(sourceUrl(raw.sourceUrl)) metadata.sourceUrl=raw.sourceUrl;else add('dataset-invalid','/sourceUrl')
  if(!Array.isArray(raw.techniques)) {add('dataset-invalid','/techniques');return {dataset:null,metadata,findings}}
  if(raw.techniques.length>LIMITS.techniques) {add('limit-techniques-exceeded','/techniques');return {dataset:null,metadata,findings}}
  if(raw.techniques.length===0) add('dataset-empty','/techniques')
  const byId=new Map(),positions=new Map()
  for(let i=0;i<raw.techniques.length;i++) {
    budget.check('@dataset');const row=raw.techniques[i],pointer=`/techniques/${i}`
    if(!keys(row,['id','parentId','revoked','deprecated','tactics']) || !isId(row.id) || !(row.parentId===null || isId(row.parentId)) || typeof row.revoked!=='boolean' || typeof row.deprecated!=='boolean' || !Array.isArray(row.tactics) || row.tactics.length<1 || row.tactics.length>LIMITS.tactics || row.tactics.some(t=>!isTactic(t)) || new Set(row.tactics).size!==row.tactics.length) {
      add('dataset-invalid',pointer);continue
    }
    if(!positions.has(row.id)) positions.set(row.id,[])
    positions.get(row.id).push(i)
    byId.set(row.id,{...row,tactics:[...row.tactics].sort(byCodeUnit)})
  }
  for(const indexes of positions.values()) if(indexes.length>1) for(const i of indexes) add('dataset-id-duplicate',`/techniques/${i}/id`)
  for(const [id,row] of byId) {
    budget.check('@dataset')
    const parent=id.includes('.')?id.split('.')[0]:null
    if(row.parentId!==parent || (parent!==null && (!byId.has(parent) || byId.get(parent).parentId!==null))) {
      add('dataset-parent-invalid',`/techniques/${positions.get(id)[0]}/parentId`)
    }
  }
  const dataset=findings.length?null:{...metadata,byId}
  return {dataset,metadata,findings}
}
export function compileActivities(raw,budget) {
  const findings=[],notes=new Map(),ambiguousRefs=new Set(),rows=[]
  let checked=0,inventoryComplete=false
  const result=()=>({checked,inventoryComplete,notes,ambiguousRefs,rows,findings})
  const add=(rule,pointer)=>findings.push(issue(rule,'@activities',pointer))
  if(!keys(raw,['schemaVersion','inventoryComplete','sourceNotes','activities']) || raw.schemaVersion!=='1' || typeof raw.inventoryComplete!=='boolean' || !Array.isArray(raw.sourceNotes) || !Array.isArray(raw.activities)) {
    add('activity-document-invalid','');return result()
  }
  inventoryComplete=raw.inventoryComplete
  if(!inventoryComplete) add('inventory-incomplete','/inventoryComplete')
  if(raw.sourceNotes.length>LIMITS.notes) {add('limit-notes-exceeded','/sourceNotes');return result()}
  if(raw.activities.length>LIMITS.activities) {add('limit-activities-exceeded','/activities');return result()}
  const refs=new Map()
  for(let i=0;i<raw.sourceNotes.length;i++) {
    budget.check('@activities');const note=raw.sourceNotes[i],p=`/sourceNotes/${i}`
    if(object(note) && Object.hasOwn(note,'ref') && isSafeField(note.ref,LIMITS.ref)) {
      if(!refs.has(note.ref)) refs.set(note.ref,[])
      refs.get(note.ref).push(i)
    }
    if(!keys(note,['ref','available','note'],['ref','available'])) {add('note-evidence-incomplete',p);continue}
    if(!isSafeField(note.ref,LIMITS.ref)) {add('note-evidence-incomplete',p+'/ref');continue}
    if(typeof note.available!=='boolean' || (Object.hasOwn(note,'note') && (typeof note.note!=='string' || note.note.length>LIMITS.note))) {add('note-evidence-incomplete',p);continue}
    notes.set(note.ref,{ordinal:i+1,available:note.available})
  }
  for(const [ref,indexes] of refs) if(indexes.length>1) {
    notes.delete(ref);ambiguousRefs.add(ref)
    for(const i of indexes) add('note-evidence-incomplete',`/sourceNotes/${i}/ref`)
  }
  if(raw.activities.length===0) add('no-activities','/activities')
  for(let i=0;i<raw.activities.length;i++) {
    budget.check('@activities');checked++;const row=raw.activities[i],p=`/activities/${i}`
    if(!keys(row,['sourceNoteRef','techniqueIds','detection','tactic'],['sourceNoteRef','techniqueIds','detection'])) {add('activity-invalid',p);continue}
    let valid=true
    for(const [field,ok] of [
      ['sourceNoteRef',isSafeField(row.sourceNoteRef,LIMITS.ref)],
      ['techniqueIds',Array.isArray(row.techniqueIds) && row.techniqueIds.length>=1 && row.techniqueIds.length<=LIMITS.ids && row.techniqueIds.every(isId) && new Set(row.techniqueIds).size===row.techniqueIds.length],
      ['detection',['detected','not-detected','unknown'].includes(row.detection)],
      ['tactic',!Object.hasOwn(row,'tactic') || isTactic(row.tactic)]]) {
      if(!ok) {add('activity-invalid',p+'/'+field);valid=false}
    }
    if(valid) rows.push({ordinal:i+1,sourceNoteRef:row.sourceNoteRef,techniqueIds:[...row.techniqueIds],detection:row.detection,tactic:row.tactic??null})
  }
  return result()
}
