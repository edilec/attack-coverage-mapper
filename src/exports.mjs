import { LIMITS } from './limits.mjs'
import { byCodeUnit } from './text.mjs'
import { serializeReport } from './report.mjs'
export class ConfigError extends Error {
  constructor(code='invalid-configuration') {super('Invalid command configuration');this.code=code}
}
export class ExportError extends Error {
  constructor(code) {super(code);this.code=code}
}
export function assertExportBytes(bytes) {
  if(bytes.length>LIMITS.exportBytes) throw new ExportError('limit-export-bytes-exceeded')
}
export function csvCell(value) {
  const text=String(value)
  return /[,"\r\n]/u.test(text)?'"'+text.replaceAll('"','""')+'"':text
}
export function renderCsv(report,budget) {
  const lines=['techniqueId,detected,notDetected,unknown,activityOrdinals,noteOrdinals']
  for(const row of report.coverage) {
    budget.check('@output')
    lines.push([row.techniqueId,row.detected,row.notDetected,row.unknown,row.activityOrdinals.join(';'),row.noteOrdinals.join(';')].map(csvCell).join(','))
  }
  budget.check('@output')
  return lines.join('\n')+'\n'
}
export function metadataEntries(pairs) {
  return pairs.map(([name,value])=>({name,value:String(value)})).sort((a,b)=>byCodeUnit(a.name,b.name))
}
function style(row,status) {
  const color=row.unknown>0?'#f9a825':row.detected>0&&row.notDetected>0?'#6a1b9a':row.notDetected>0?'#c62828':'#2e7d32'
  const score=status!=='incomplete'&&row.unknown===0?Math.round(10000*row.detected/(row.detected+row.notDetected))/100:undefined
  return {color,...(score===undefined?{}:{score})}
}
export function renderNavigator(report,{layerVersion='4.4'}={},budget) {
  if(layerVersion!=='4.4') throw new ConfigError('unsupported-layer-version')
  if(!report.dataset.usable) return null
  budget.check('@output')
  const techniques=[]
  for(const row of report.tacticCoverage) {
    budget.check('@output')
    const styled=style(row,report.status)
    techniques.push({techniqueID:row.techniqueId,tactic:row.tactic,enabled:true,...styled,metadata:metadataEntries([
      ['activity-ordinals',row.activityOrdinals.join(';')],['note-ordinals',row.noteOrdinals.join(';')],
      ['detected',row.detected],['not-detected',row.notDetected],['unknown',row.unknown],
      ['display-style',row.unknown>0?'unknown':row.detected>0&&row.notDetected>0?'mixed-known':row.notDetected>0?'not-detected':'detected']])})
  }
  return {name:'Edilec supplied activity coverage',versions:{attack:report.dataset.version,navigator:'4.8.2',layer:'4.4'},domain:`${report.dataset.domain}-attack`,
    description:'Observed supplied analyst events; no inference of monitoring capability.',
    selectTechniquesAcrossTactics:false,selectSubtechniquesWithParent:false,techniques,
    legendItems:[{label:'Detected',color:'#2e7d32'},{label:'Not detected',color:'#c62828'},{label:'Mixed known events',color:'#6a1b9a'},{label:'Unknown present',color:'#f9a825'}],
    metadata:metadataEntries([
      ['report-status',report.status],['dataset-sha256',report.dataset.sha256],['validation-scope','supplied-subset'],
      ['color-semantics','Green detected only; red not-detected only; purple mixed known; amber any unknown. Counts and source ordinals remain separate.'],
      ['score-semantics','100 * detected / (detected + not-detected), rounded to two decimals. Every incomplete run is unscored; unknown never counts as successful monitoring.'],
      ['evidence-semantics','Note availability is analyst-declared in the supplied registry; note files and external systems are not inspected.']])}
}
export function renderArtifacts(report,options,budget) {
  const texts=[['coverage.json',serializeReport(report)],['coverage.csv',renderCsv(report,budget)]]
  const layer=renderNavigator(report,options,budget)
  if(layer!==null) texts.push(['navigator-layer.json',JSON.stringify(layer,null,2)+'\n'])
  budget.check('@output')
  return texts.map(([name,text])=>{const bytes=Buffer.from(text);assertExportBytes(bytes);return {name,bytes}})
}
