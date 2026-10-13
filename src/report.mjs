import { byCodeUnit } from './text.mjs'
export const TOOL_ID='attack-coverage-mapper'
export const RULES=Object.freeze({
  'input-unreadable': Object.freeze({severity:'warning', incomplete:true}),
  'input-invalid': Object.freeze({severity:'warning', incomplete:true}),
  'limit-bytes-exceeded': Object.freeze({severity:'warning', incomplete:true}),
  'limit-depth-exceeded': Object.freeze({severity:'warning', incomplete:true}),
  'limit-nodes-exceeded': Object.freeze({severity:'warning', incomplete:true}),
  'dataset-invalid': Object.freeze({severity:'warning', incomplete:true}),
  'dataset-version-missing': Object.freeze({severity:'warning', incomplete:true}),
  'dataset-empty': Object.freeze({severity:'warning', incomplete:true}),
  'limit-techniques-exceeded': Object.freeze({severity:'warning', incomplete:true}),
  'dataset-id-duplicate': Object.freeze({severity:'warning', incomplete:true}),
  'dataset-parent-invalid': Object.freeze({severity:'warning', incomplete:true}),
  'activity-document-invalid': Object.freeze({severity:'warning', incomplete:true}),
  'limit-activities-exceeded': Object.freeze({severity:'warning', incomplete:true}),
  'limit-notes-exceeded': Object.freeze({severity:'warning', incomplete:true}),
  'no-activities': Object.freeze({severity:'warning', incomplete:true}),
  'inventory-incomplete': Object.freeze({severity:'warning', incomplete:true}),
  'note-evidence-incomplete': Object.freeze({severity:'warning', incomplete:true}),
  'activity-invalid': Object.freeze({severity:'warning', incomplete:true}),
  'technique-unknown': Object.freeze({severity:'warning', incomplete:true}),
  'technique-revoked': Object.freeze({severity:'warning', incomplete:true}),
  'technique-deprecated': Object.freeze({severity:'warning', incomplete:true}),
  'tactic-invalid': Object.freeze({severity:'warning', incomplete:true}),
  'detection-unknown': Object.freeze({severity:'warning', incomplete:true}),
  'not-detected': Object.freeze({severity:'error', incomplete:false}),
  'no-mapped-activities': Object.freeze({severity:'warning', incomplete:true}),
  'analysis-timeout': Object.freeze({severity:'warning', incomplete:true}),
  'analysis-clock-invalid': Object.freeze({severity:'warning', incomplete:true}),
  'limit-export-bytes-exceeded': Object.freeze({severity:'warning', incomplete:true}),
  'output-unwritable': Object.freeze({severity:'warning', incomplete:true}),
  'execution-failed': Object.freeze({severity:'warning', incomplete:true}),
})
const MESSAGES=Object.freeze({
  'input-unreadable': 'The named input could not be read as a regular file.',
  'input-invalid': 'The named input could not be decoded or parsed as supported strict JSON.',
  'limit-bytes-exceeded': 'Limit bytes exceeded.',
  'limit-depth-exceeded': 'Limit depth exceeded.',
  'limit-nodes-exceeded': 'Limit nodes exceeded.',
  'dataset-invalid': 'Dataset invalid.',
  'dataset-version-missing': 'The supplied dataset has no usable content version.',
  'dataset-empty': 'Dataset empty.',
  'limit-techniques-exceeded': 'Limit techniques exceeded.',
  'dataset-id-duplicate': 'Dataset id duplicate.',
  'dataset-parent-invalid': 'Dataset parent invalid.',
  'activity-document-invalid': 'Activity document invalid.',
  'limit-activities-exceeded': 'Limit activities exceeded.',
  'limit-notes-exceeded': 'Limit notes exceeded.',
  'no-activities': 'No activities were supplied; this run checked no activity evidence.',
  'inventory-incomplete': 'Inventory incomplete.',
  'note-evidence-incomplete': 'The note declaration is missing, unusable, ambiguous, or unavailable.',
  'activity-invalid': 'Activity invalid.',
  'technique-unknown': 'Technique unknown.',
  'technique-revoked': 'Technique revoked.',
  'technique-deprecated': 'Technique deprecated.',
  'tactic-invalid': 'Tactic invalid.',
  'detection-unknown': 'Detection evidence for this activity is unknown.',
  'not-detected': 'This supplied activity was reported not detected.',
  'no-mapped-activities': 'No activity was mapped against usable technique and note evidence.',
  'analysis-timeout': 'The injected five-second evaluation deadline was exceeded.',
  'analysis-clock-invalid': 'The injected evaluation clock was invalid or moved backward.',
  'limit-export-bytes-exceeded': 'Limit export bytes exceeded.',
  'output-unwritable': 'Output unwritable.',
  'execution-failed': 'Execution failed.',
})

export function issue(ruleId,file,pointer='') {
  if(!Object.hasOwn(RULES,ruleId)) throw new Error('Unknown report rule')
  if(!['@dataset','@activities','@output'].includes(file)) throw new TypeError('Invalid source role')
  return {ruleId,severity:RULES[ruleId].severity,message:MESSAGES[ruleId],location:{file,pointer}}
}
export function buildReport({findings,checked,mappedActivities,coverage=[],tacticCoverage=[],dataset=null,totals={}}) {
  findings=[...findings]
  if(mappedActivities===0 && !findings.some(f=>f.ruleId==='no-mapped-activities')) findings.push(issue('no-mapped-activities','@activities','/activities'))
  findings.sort((a,b)=>byCodeUnit(a.location.file,b.location.file)||byCodeUnit(a.location.pointer,b.location.pointer)||byCodeUnit(a.ruleId,b.ruleId))
  const incomplete=mappedActivities===0 || findings.some(f=>RULES[f.ruleId].incomplete)
  const errors=findings.filter(f=>f.severity==='error').length
  return {schemaVersion:'1',tool:TOOL_ID,status:incomplete?'incomplete':errors?'fail':'pass',summary:{checked,errors,warnings:findings.filter(f=>f.severity==='warning').length,mappedActivities,techniqueMappings:totals.techniqueMappings??0,uniqueTechniques:coverage.length,detectedActivities:totals.detectedActivities??0,notDetectedActivities:totals.notDetectedActivities??0,unknownActivities:totals.unknownActivities??0},findings,dataset:dataset??{domain:null,version:null,sourceUrl:null,sha256:null,validationScope:'supplied-subset',usable:false},coverage,tacticCoverage}
}
export function exitCodeFor(report) {return report.status==='pass'?0:report.status==='fail'?1:2}
export function serializeReport(report) {return JSON.stringify(report,null,2)+'\n'}
export function formatSummary(report) {return `${TOOL_ID}: ${report.status}; checked ${report.summary.checked}; mapped ${report.summary.mappedActivities}\n`}
