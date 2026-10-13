import { open, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { LIMITS } from './limits.mjs'

export class InputError extends Error {
  constructor(code) {
    super(code)
    this.name = 'InputError'
    this.code = code
  }
}

function limit(value, fallback) {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value < 0) throw new InputError('invalid-limit')
  return value
}

// Compare decimal values exactly, before Number has erased lexical precision.
function decimalKey(token) {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?)(\d+))?$/.exec(token)
  if (match === null) throw new InputError('numeric-precision')
  const fraction = match[3] ?? ''
  let digits = `${match[2]}${fraction}`.replace(/^0+/, '')
  if (digits === '') return '0'
  const exponentDigits = (match[5] ?? '0').replace(/^0+/, '') || '0'
  if (exponentDigits.length > 6) throw new InputError('numeric-precision')
  let exponent = BigInt(exponentDigits) * (match[4] === '-' ? -1n : 1n) - BigInt(fraction.length)
  const trailing = /0+$/.exec(digits)?.[0].length ?? 0
  digits = digits.slice(0, digits.length - trailing)
  exponent += BigInt(trailing)
  return `${match[1]}${digits}e${exponent}`
}

/** JSON.parse plus a lexical walk, so duplicate keys and rounded numbers survive inspection. */
export function parseUniqueJson(text, options = {}) {
  if (typeof text !== 'string') throw new InputError('invalid-text')
  const maxDepth = limit(options.maxDepth, 16)
  const maxNodes = limit(options.maxNodes, 250_000)
  options.budget?.check()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new InputError('malformed-json')
  }
  let i = 0
  let nodes = 0
  const numberToken = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
  const ws = () => {
    while (i < text.length && /[ \t\r\n]/.test(text[i])) i += 1
  }
  const string = () => {
    const start = i
    i += 1
    while (i < text.length) {
      if (text[i] === '\\') {
        i += 2
      } else if (text[i] === '"') {
        i += 1
        return JSON.parse(text.slice(start, i))
      } else {
        i += 1
      }
    }
    throw new InputError('malformed-json')
  }
  const value = (depth) => {
    ws()
    nodes += 1
    if(nodes % 1024 === 0) options.budget?.check()
    if (depth > maxDepth) throw new InputError('depth-limit')
    if (nodes > maxNodes) throw new InputError('node-limit')
    if (text[i] === '"') { string(); return }
    if (text[i] === '{') {
      i += 1
      const keys = new Set()
      ws()
      while (text[i] !== '}') {
        const key = string()
        if (keys.has(key)) throw new InputError('duplicate-key')
        keys.add(key)
        ws()
        i += 1 // colon; JSON.parse already proved the grammar
        value(depth + 1)
        ws()
        if (text[i] !== ',') break
        i += 1
        ws()
      }
      i += 1
      return
    }
    if (text[i] === '[') {
      i += 1
      ws()
      while (text[i] !== ']') {
        value(depth + 1)
        ws()
        if (text[i] !== ',') break
        i += 1
      }
      i += 1
      return
    }
    if (text[i] === 't') { i += 4; return }
    if (text[i] === 'f') { i += 5; return }
    if (text[i] === 'n') { i += 4; return }
    numberToken.lastIndex = i
    const number = numberToken.exec(text)
    if (number === null) throw new InputError('malformed-json')
    const numeric = Number(number[0])
    if (!Number.isFinite(numeric) || Math.abs(numeric) > Number.MAX_SAFE_INTEGER) {
      throw new InputError('unsafe-number')
    }
    if (decimalKey(number[0]) !== decimalKey(numeric.toString())) {
      throw new InputError('numeric-precision')
    }
    i += number[0].length
  }
  value(0)
  options.budget?.check()
  return parsed
}


// Adapted from Edilec's local JSON scanner; no sibling runtime import.
export function sha256(bytes) {return createHash('sha256').update(bytes).digest('hex')}
export function parseJsonBytes(bytes,budget) {
  budget.check()
  if(!(bytes instanceof Uint8Array)) throw new InputError('invalid-text')
  if(bytes.length>LIMITS.bytes) throw new InputError('byte-limit')
  let text
  try {text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)} catch {throw new InputError('invalid-utf8')}
  let depth=0,inString=false
  for(let i=0;i<text.length;i++) {
    if(i%8192===0) budget.check()
    const c=text[i]
    if(inString) {if(c==='\\') i++; else if(c==='"') inString=false; continue}
    if(c==='"') inString=true
    else if(c==='{' || c==='[') {depth++; if(depth>16) throw new InputError('depth-limit')}
    else if(c==='}' || c===']') depth--
  }
  budget.check()
  return parseUniqueJson(text,{maxDepth:17,maxNodes:250000,budget})
}
export async function readInput(path,budget) {
  budget.check()
  let handle
  try {
    const namedPath=resolve(path),realPath=await realpath(namedPath)
    handle=await open(realPath,'r')
    const info=await handle.stat()
    if(!info.isFile()) throw new InputError('not-file')
    if(info.size>LIMITS.bytes) throw new InputError('byte-limit')
    const chunks=[]; let length=0
    while(length<=LIMITS.bytes) {
      budget.check()
      const chunk=Buffer.alloc(Math.min(8192,LIMITS.bytes+1-length))
      const {bytesRead}=await handle.read(chunk,0,chunk.length,null)
      if(bytesRead===0) break
      chunks.push(chunk.subarray(0,bytesRead)); length+=bytesRead
      if(length>LIMITS.bytes) throw new InputError('byte-limit')
    }
    budget.check()
    return {bytes:Buffer.concat(chunks,length),namedPath,realPath,identity:{dev:info.dev,ino:info.ino}}
  } catch(e) {
    if(e instanceof InputError || e.code==='analysis-timeout' || e.code==='analysis-clock-invalid') throw e
    throw new InputError('unreadable')
  } finally {if(handle) await handle.close()}
}
