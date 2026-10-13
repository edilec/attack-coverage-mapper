import assert from 'node:assert/strict'
import test from 'node:test'
import { enumerate } from '../tools/mutation-inventory.mjs'
import vm from 'node:vm'
test('inventory emits re-derivable independent severity, incomplete, guard and bound edits',()=>{
  const text="'x': {severity:'error', incomplete:true},\nif(n>16) throw new Error('limit')\n"
  const rows=enumerate(text,'src/fixture.mjs')
  assert.equal(rows.filter(r=>r.category==='severity').length,1)
  assert.equal(rows.filter(r=>r.category==='incomplete').length,1)
  assert.equal(rows.filter(r=>r.category==='guard').length,2)
  assert.equal(rows.filter(r=>r.category==='bound').length,2)
  for(const r of rows){assert.equal(text.slice(r.start,r.end),r.original);assert.ok(r.replacement!==r.original);assert.ok(r.line>=1)}
})
test('compound refusal is neutralized as a whole, including its OR branch',()=>{
  const source="function check(x) { if(x<0 || x>3) return 'refuse'; return 'allow' }; check(4)"
  const row=enumerate(source,'src/fixture.mjs').find(r=>r.category==='guard'&&r.original.startsWith('if'))
  const changed=source.slice(0,row.start)+row.replacement+source.slice(row.end)
  assert.equal(vm.runInNewContext(changed,{}, {timeout:100}),'allow')
})
