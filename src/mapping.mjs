import { issue } from './report.mjs'
import { byCodeUnit } from './text.mjs'
function aggregate(techniqueId,events,tactic) {
  const counts={detected:0,notDetected:0,unknown:0}
  for(const event of events) counts[event.detection==='not-detected'?'notDetected':event.detection]++
  return {techniqueId,...(tactic===undefined?{}:{tactic}),...counts,
    activityOrdinals:[...new Set(events.map(e=>e.activityOrdinal))].sort((a,b)=>a-b),
    noteOrdinals:[...new Set(events.map(e=>e.noteOrdinal))].sort((a,b)=>a-b),
    ...(tactic===undefined?{events}: {})}
}
export function mapActivities(dataset,compiled,budget) {
  const findings=[],globalEvents=new Map(),tacticEvents=new Map()
  const totals={techniqueMappings:0,detectedActivities:0,notDetectedActivities:0,unknownActivities:0}
  let mappedActivities=0
  const add=(rule,p)=>findings.push(issue(rule,'@activities',p))
  for(const row of compiled.rows) {
    budget.check('@activities');const p=`/activities/${row.ordinal-1}`,note=compiled.notes.get(row.sourceNoteRef)
    let usable=true
    if(!note || !note.available || compiled.ambiguousRefs.has(row.sourceNoteRef)) {add('note-evidence-incomplete',p+'/sourceNoteRef');usable=false}
    for(let j=0;j<row.techniqueIds.length;j++) {
      const id=row.techniqueIds[j],technique=dataset.byId.get(id),where=p+`/techniqueIds/${j}`
      if(!technique) {add('technique-unknown',where);usable=false;continue}
      if(technique.revoked) {add('technique-revoked',where);usable=false}
      if(technique.deprecated) {add('technique-deprecated',where);usable=false}
      if(row.tactic!==null && !technique.tactics.includes(row.tactic)) {add('tactic-invalid',p+'/tactic');usable=false}
    }
    if(!usable) continue
    if(row.detection==='not-detected') add('not-detected',p+'/detection')
    if(row.detection==='unknown') add('detection-unknown',p+'/detection')
    mappedActivities++
    totals[row.detection==='detected'?'detectedActivities':row.detection==='not-detected'?'notDetectedActivities':'unknownActivities']++
    for(const id of row.techniqueIds) {
      budget.check('@activities');totals.techniqueMappings++
      const event={activityOrdinal:row.ordinal,noteOrdinal:note.ordinal,detection:row.detection,tactic:row.tactic}
      if(!globalEvents.has(id)) globalEvents.set(id,[])
      globalEvents.get(id).push(event)
      if(!tacticEvents.has(id)) tacticEvents.set(id,new Map())
      for(const tactic of row.tactic===null?dataset.byId.get(id).tactics:[row.tactic]) {
        if(!tacticEvents.get(id).has(tactic)) tacticEvents.get(id).set(tactic,[])
        tacticEvents.get(id).get(tactic).push(event)
      }
    }
  }
  const coverage=[...globalEvents].sort(([a],[b])=>byCodeUnit(a,b)).map(([id,events])=>aggregate(id,events))
  const tacticCoverage=[]
  for(const [id,tactics] of [...tacticEvents].sort(([a],[b])=>byCodeUnit(a,b))) {
    budget.check('@activities')
    for(const [tactic,events] of [...tactics].sort(([a],[b])=>byCodeUnit(a,b))) tacticCoverage.push(aggregate(id,events,tactic))
  }
  return {coverage,tacticCoverage,mappedActivities,totals,findings}
}
