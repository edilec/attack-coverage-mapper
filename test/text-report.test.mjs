import assert from 'node:assert/strict'
import test from 'node:test'
import { createBudget } from '../src/limits.mjs'
import { byCodeUnit, safeText, isSafeField } from '../src/text.mjs'
import { issue, buildReport, exitCodeFor, serializeReport } from '../src/report.mjs'
test('injected deadline is inclusive and invalid clocks fail closed', () => {
  let tick=0; const budget=createBudget(() => tick); tick=5000; budget.check(); tick=5001
  assert.throws(() => budget.check(),e => e.code === 'analysis-timeout')
  for(const next of [NaN,Infinity,-1]) {
    let value=0; const b=createBudget(() => value); value=next
    assert.throws(() => b.check(),e => e.code === 'analysis-clock-invalid')
  }
  assert.throws(() => createBudget(() => {throw Error('private')}),e => e.code === 'analysis-clock-invalid')
  assert.throws(() => createBudget(() => 0,5001),TypeError)
})
test('safe strings cover control, C1, separators, bidi and format characters', () => {
  for(const c of ['\u0001','\u007F','\u0085','\u009B','\u2028','\u2029','\u200E','\u202E','\u2067','\u200B']) {
    assert.equal(safeText(`a${c}b`,16),'ab'); assert.equal(isSafeField(c,128),false)
  }
  assert.equal(isSafeField('valid',5),true); assert.equal(isSafeField(' valid',8),false)
  assert.equal(isSafeField({toString:{}},128),false)
  assert.deepEqual(['a_b','a-b','a','Z'].sort(byCodeUnit),['Z','a','a-b','a_b'])
})
test('report rules pin policy/incomplete precedence and prevent vacuous pass', () => {
  const pass=buildReport({findings:[],checked:1,mappedActivities:1})
  assert.equal(pass.status,'pass'); assert.equal(exitCodeFor(pass),0)
  const fail=buildReport({findings:[issue('not-detected','@activities','/activities/0/detection')],checked:1,mappedActivities:1})
  assert.equal(fail.status,'fail'); assert.equal(exitCodeFor(fail),1)
  const unknown=buildReport({findings:[...fail.findings,issue('detection-unknown','@activities')],checked:2,mappedActivities:2})
  assert.equal(unknown.status,'incomplete'); assert.equal(exitCodeFor(unknown),2)
  const empty=buildReport({findings:[],checked:0,mappedActivities:0})
  assert.equal(empty.status,'incomplete'); assert.ok(empty.findings.some(f => f.ruleId === 'no-mapped-activities'))
  assert.throws(() => issue('bad','@activities'),/Unknown report rule/)
  assert.equal(serializeReport(pass),JSON.stringify(pass,null,2)+'\n')
})
test('finding ordering uses distinct roles, pointers and rules', () => {
  const findings=[issue('input-invalid','@dataset'),issue('tactic-invalid','@activities','/activities/2'),issue('activity-invalid','@activities','/activities/10'),issue('tactic-invalid','@activities','/activities/10')]
  const result=buildReport({findings,checked:3,mappedActivities:1})
  assert.deepEqual(result.findings.map(f => [f.location.file,f.location.pointer,f.ruleId]),[
    ['@activities','/activities/10','activity-invalid'],['@activities','/activities/10','tactic-invalid'],['@activities','/activities/2','tactic-invalid'],['@dataset','','input-invalid']])
})
