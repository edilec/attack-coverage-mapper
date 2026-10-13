import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp,mkdir,writeFile,readFile,symlink,link,rm,readdir,stat,open } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { preflightOutput,writeArtifacts,OutputError } from '../src/output.mjs'
import { DestinationError } from '../src/write-guard.mjs'
import { createBudget } from '../src/limits.mjs'
const artifacts=['coverage.json','coverage.csv','navigator-layer.json'].map(name=>({name,bytes:Buffer.from(name+'\n')}))
async function fixture(fn) {
  const dir=await mkdtemp(join(tmpdir(),'coverage-output-'))
  try{const input=join(dir,'input');await writeFile(input,'INPUT');await fn({dir,input,out:join(dir,'coverage')});assert.equal(await readFile(input,'utf8'),'INPUT')}
  finally{await rm(dir,{recursive:true,force:true})}
}
test('fresh and existing directories safely receive three private-mode files',async()=>fixture(async({out,input})=>{
  const pre=await preflightOutput(out,{inputs:[input]});await writeArtifacts(pre,artifacts,{inputs:[input],budget:createBudget(()=>0)})
  assert.deepEqual((await readdir(out)).sort(),['coverage.csv','coverage.json','navigator-layer.json'])
  for(const a of artifacts){assert.equal(await readFile(join(out,a.name),'utf8'),a.name+'\n');assert.equal((await stat(join(out,a.name))).mode&0o777,0o600)}
}))
test('existing unrelated files are preserved and existing artifacts never replaced',async()=>fixture(async({out,input})=>{
  await mkdir(out);await writeFile(join(out,'unrelated'),'SAFE')
  const pre=await preflightOutput(out,{inputs:[input]});await writeArtifacts(pre,artifacts.slice(0,1),{inputs:[input],budget:createBudget(()=>0)})
  assert.equal(await readFile(join(out,'unrelated'),'utf8'),'SAFE')
  await assert.rejects(preflightOutput(out,{inputs:[input]}),DestinationError)
  assert.equal(await readFile(join(out,'coverage.json'),'utf8'),'coverage.json\n')
}))
test('all reserved names preflight before any artifact write',async()=>fixture(async({out,input})=>{
  await mkdir(out);await link(input,join(out,'navigator-layer.json'))
  await assert.rejects(preflightOutput(out,{inputs:[input]}),DestinationError)
  assert.deepEqual(await readdir(out),['navigator-layer.json'])
}))
test('a final output-directory symlink is refused and temporary ancestor aliases work',async()=>fixture(async({dir,out,input})=>{
  await symlink(dir,out);await assert.rejects(preflightOutput(out,{inputs:[input]}),DestinationError)
  await rm(out);const pre=await preflightOutput(out,{inputs:[input]});assert.ok(pre.root)
}))
test('missing input symlink to future output still blocks creation',async()=>fixture(async({dir,out,input})=>{
  const missing=join(dir,'missing');await symlink(join(out,'coverage.json'),missing)
  await assert.rejects(preflightOutput(out,{inputs:[input,missing]}),DestinationError)
  assert.deepEqual(await readdir(out),[])
}))
test('exclusive open refuses a planted final entry after preflight',async()=>fixture(async({out,input})=>{
  const pre=await preflightOutput(out,{inputs:[input]});await symlink(input,join(out,'coverage.json'))
  await assert.rejects(writeArtifacts(pre,artifacts,{inputs:[input],budget:createBudget(()=>0)}),OutputError)
}))
test('second-write failure leaves honest partial new files without touching inputs',async()=>fixture(async({out,input})=>{
  const pre=await preflightOutput(out,{inputs:[input]});let count=0
  const openFile=async(...args)=>{if(++count===2)throw Object.assign(Error('secret-path'),{code:'ENOSPC'});return open(...args)}
  await assert.rejects(writeArtifacts(pre,artifacts,{inputs:[input],budget:createBudget(()=>0),openFile}),e=>e instanceof OutputError&&!e.message.includes('secret'))
  assert.deepEqual(await readdir(out),['coverage.json'])
}))
test('deadline after first write marks incomplete and invalid artifact names cannot escape',async()=>fixture(async({out,input})=>{
  const pre=await preflightOutput(out,{inputs:[input]});let tick=0
  const budget=createBudget(()=>tick)
  const openFile=async(...args)=>{const handle=await open(...args);tick=5001;return handle}
  await assert.rejects(writeArtifacts(pre,artifacts,{inputs:[input],budget,openFile}),e=>e.code==='analysis-timeout')
  await assert.rejects(writeArtifacts(pre,[{name:'../escape',bytes:Buffer.from('x')}],{inputs:[input],budget:createBudget(()=>0)}),OutputError)
}))
