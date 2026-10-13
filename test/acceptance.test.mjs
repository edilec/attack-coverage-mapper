import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { runCase } from './support/cli-harness.mjs'
for(const [example,code,status] of [['pass',0,'pass'],['fail',1,'fail'],['incomplete',2,'incomplete']])test(`documented ${example} example works offline`,async()=>{
  const datasetBytes=await readFile(new URL('../examples/dataset.json',import.meta.url))
  const activityBytes=await readFile(new URL(`../examples/${example}.json`,import.meta.url))
  const r=await runCase({datasetBytes,activityBytes})
  assert.equal(r.code,code);assert.equal(r.report.status,status);assert.equal(r.report.tool,'attack-coverage-mapper');assert.equal(r.report.schemaVersion,'1')
  assert.equal(r.stdout,r.artifacts['coverage.json']);assert.deepEqual(r.before,r.after)
  const layer=JSON.parse(r.artifacts['navigator-layer.json']);assert.equal(layer.versions.layer,'4.4');assert.equal(layer.versions.attack,'17.0')
  assert.equal(r.stdout.includes('private-note'),false)
})
