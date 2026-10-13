import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createBudget } from '../src/limits.mjs'
import { parseJsonBytes, parseUniqueJson, readInput, sha256 } from '../src/json.mjs'
const parse = text => parseJsonBytes(Buffer.from(text), createBudget(() => 0))
test('strict UTF-8 accepts literal replacement but rejects invalid bytes beside it', () => {
  assert.deepEqual(parse('{"note":"\uFFFD"}'), {note:'\uFFFD'})
  const bytes = Buffer.concat([Buffer.from('{"note":"\uFFFD'),Buffer.from([0xC3,0x28]),Buffer.from('"}')])
  assert.throws(() => parseJsonBytes(bytes,createBudget(() => 0)),e => e.code === 'invalid-utf8')
})
test('duplicate keys including escaped aliases are refused', () => {
  for(const value of ['{"available":true,"available":false}','{"a":1,"\\u0061":2}'])
    assert.throws(() => parse(value),e => e.code === 'duplicate-key')
})
test('depth 16 is legal, 17 refused, string delimiters do not count', () => {
  assert.doesNotThrow(() => parse('['.repeat(16)+'null'+']'.repeat(16)))
  assert.throws(() => parse('['.repeat(17)+'null'+']'.repeat(17)),e => e.code === 'depth-limit')
  assert.deepEqual(parse(JSON.stringify({note:'[[["{{{'})),{note:'[[["{{{'})
})
test('byte and node bounds accept N and refuse N+1', () => {
  const bytes=Buffer.from('{}'+' '.repeat(8388606))
  assert.deepEqual(parseJsonBytes(bytes,createBudget(() => 0)),{})
  assert.throws(() => parseJsonBytes(Buffer.concat([bytes,Buffer.from(' ')]),createBudget(() => 0)),e => e.code === 'byte-limit')
  assert.equal(parse('['+Array(249999).fill('null').join(',')+']').length,249999)
  assert.throws(() => parse('['+Array(250000).fill('null').join(',')+']'),e => e.code === 'node-limit')
})
test('malformed and unsafe numeric JSON errors never include a private parser window', () => {
  for(const text of ['at position 1\nPRIVATE_SENTINEL','"PRIVATE_SENTINEL\n','{"x":1e999}','{"x":9007199254740993}']) {
    let error
    try {parse(text)} catch(e) {error=e}
    assert.ok(error)
    assert.equal(error.message.includes('PRIVATE_SENTINEL'),false)
    assert.ok(['malformed-json','unsafe-number'].includes(error.code))
  }
})
test('exact-byte SHA-256 is stable and whitespace matters', () => {
  assert.equal(sha256(Buffer.from('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.notEqual(sha256(Buffer.from('{}')),sha256(Buffer.from('{}\n')))
})
test('decimal precision and very long underflow exponents are refused before rounding or BigInt work',()=>{
  for(const text of ['0.100000000000000000001','1e-1000000'])assert.throws(()=>parse(text),e=>e.code==='numeric-precision')
})
test('bounded regular-file reader records identity and distinguishes missing/directory/large files',async () => {
  const dir=await mkdtemp(join(tmpdir(),'coverage-json-'))
  try {
    const read=path=>{let tick=0;return readInput(path,createBudget(()=>++tick))}
    const file=join(dir,'input.json'); await writeFile(file,'{}')
    const result=await read(file)
    assert.equal(Buffer.from(result.bytes).toString(),'{}'); assert.ok(result.identity.ino > 0)
    await writeFile(file,Buffer.alloc(8388608,32))
    assert.equal((await read(file)).bytes.length,8388608)
    await writeFile(file,Buffer.alloc(8388609,32))
    await assert.rejects(read(file),e => e.code === 'byte-limit')
    await assert.rejects(read(join(dir,'missing')),e => e.code === 'unreadable')
    await mkdir(join(dir,'folder'))
    await assert.rejects(read(join(dir,'folder')),e => e.code === 'not-file')
  } finally {await rm(dir,{recursive:true,force:true})}
})
test('parser helper refuses wrong input types and invalid configured limits',()=>{
  assert.throws(()=>parseUniqueJson({}),e=>e.code==='invalid-text')
  assert.throws(()=>parseJsonBytes('{}',createBudget(()=>0)),e=>e.code==='invalid-text')
  for(const key of ['maxDepth','maxNodes'])for(const value of [-1,1.5,NaN])assert.throws(()=>parseUniqueJson('{}',{[key]:value}),e=>e.code==='invalid-limit')
  assert.deepEqual(parseUniqueJson('{}'),{})
  assert.doesNotThrow(()=>parseUniqueJson('[[null]]',{maxDepth:2}))
  assert.throws(()=>parseUniqueJson('[[null]]',{maxDepth:1}),e=>e.code==='depth-limit')
  assert.equal(parseUniqueJson('0e100000000'),0)
})
test('escaped delimiter text inside strings does not consume nesting budget',()=>{
  const note='\\"'+ '['.repeat(17)+'\\'+']'.repeat(17)
  assert.deepEqual(parse(JSON.stringify({note})),{note})
  assert.deepEqual(parse(JSON.stringify(Array.from({length:17},()=>[]))),Array.from({length:17},()=>[]))
  let checks=0
  const budget={check(){if(++checks===3)throw Error('stopped')}}
  assert.throws(()=>parseJsonBytes(Buffer.from(JSON.stringify({note:'a'.repeat(20000)})),budget),/stopped/u)
})
test('large lexical walks check the cooperative budget before their final checkpoint',()=>{
  let checks=0
  parseUniqueJson(JSON.stringify(Array(3000).fill(null)),{budget:{check(){checks++}}})
  assert.equal(checks,4)
})
