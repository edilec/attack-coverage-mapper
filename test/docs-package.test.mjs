import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { RULES } from '../src/report.mjs'
test('package exposes the verified library/bin without dependencies or install hooks',async()=>{
  const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'))
  assert.equal(p.type,'module');assert.equal(p.engines.node,'>=22');assert.equal(p.exports,'./src/index.mjs');assert.equal(p.license,'MIT')
  assert.equal(p.bin['attack-coverage-mapper'],'./bin/attack-coverage-mapper.mjs')
  for(const key of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])assert.equal(Object.keys(p[key]??{}).length,0)
  for(const key of ['install','preinstall','postinstall','prepare','prepublishOnly'])assert.equal(Object.hasOwn(p.scripts,key),false)
  assert.deepEqual(p.files,['bin/','src/','docs/','examples/','README.md','CHANGELOG.md','LICENSE'])
})
test('documented rules and runtime catalog agree in both directions',async()=>{
  const text=await readFile(new URL('../docs/rules.md',import.meta.url),'utf8'),rows={}
  for(const m of text.matchAll(/^\| `([^`]+)` \| (error|warning|info) \| (yes|no) \|/gmu))rows[m[1]]={severity:m[2],incomplete:m[3]==='yes'}
  assert.deepEqual(rows,RULES)
})
