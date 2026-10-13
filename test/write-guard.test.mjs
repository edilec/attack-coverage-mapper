import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp,mkdir,writeFile,readFile,symlink,link,rm,stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { assertWritableDestination,DestinationError } from '../src/write-guard.mjs'
async function fixture(fn) {
  const dir=await mkdtemp(join(tmpdir(),'coverage-guard-'))
  try {
    const root=join(dir,'coverage'),input=join(dir,'input.json');await mkdir(root);await writeFile(input,'PRIVATE_INPUT_SENTINEL\n')
    const before=await stat(input)
    await fn({dir,root,input,target:join(root,'coverage.json')})
    assert.equal(await readFile(input,'utf8'),'PRIVATE_INPUT_SENTINEL\n')
    const after=await stat(input);assert.equal(after.size,before.size);assert.equal(after.mtimeMs,before.mtimeMs)
  }finally{await rm(dir,{recursive:true,force:true})}
}
for(const mode of ['symlink','dangling-symlink','hardlink','directory','direct-input','symlink-parent','lexical-escape','dangling-input'])test('destination guard hole '+mode,async()=>fixture(async({dir,root,input,target})=>{
  let destination=target,inputs=[input]
  if(mode==='symlink')await symlink(input,target)
  if(mode==='dangling-symlink')await symlink(join(dir,'missing'),target)
  if(mode==='hardlink')await link(input,target)
  if(mode==='directory')await mkdir(target)
  if(mode==='direct-input')destination=input
  if(mode==='symlink-parent') {await symlink(dir,join(root,'link'));destination=join(root,'link','new.json')}
  if(mode==='lexical-escape')destination=join(root,'..','new.json')
  if(mode==='dangling-input'){const named=join(dir,'missing-dataset');await symlink(target,named);inputs.push(named)}
  await assert.rejects(assertWritableDestination(destination,{root,inputs}),DestinationError)
}))
test('new and unrelated regular destinations remain allowed',async()=>fixture(async({root,input,target})=>{
  assert.equal(await assertWritableDestination(target,{root,inputs:[input]}),target)
  await writeFile(target,'old ordinary output')
  assert.equal(await assertWritableDestination(target,{root,inputs:[input]}),target)
}))
test('symlink cycles and uncertain inspections are refusals',async()=>fixture(async({dir,root,input,target})=>{
  const a=join(dir,'a'),b=join(dir,'b');await symlink(b,a);await symlink(a,b)
  await assert.rejects(assertWritableDestination(target,{root,inputs:[input,a]}),DestinationError)
  await assert.rejects(assertWritableDestination(join(root,'x'.repeat(300)),{root,inputs:[input]}),DestinationError)
}))
