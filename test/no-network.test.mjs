import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const deny=fileURLToPath(new URL('./support/deny-network.mjs',import.meta.url))
for(const [name,code] of [['fetch',"await fetch('data:text/plain,probe')"],['socket',"import net from 'node:net'; net.Socket.prototype.connect.call(null)"]]) {
  test(`active preload denies host-free ${name} before network activity`,() => {
    const run=spawnSync(process.execPath,['--import',deny,'--input-type=module','--eval',code],{encoding:'utf8'})
    assert.equal(run.status,1); assert.match(run.stderr,/OFFLINE_NETWORK_DENIED/)
  })
}
test('product has no network or execution capability',async () => {
  for(const dir of ['src','bin']) {
    const location=new URL(`../${dir}/`,import.meta.url)
    let names; try {names=await readdir(location)} catch(e) {if(e.code==='ENOENT') continue; throw e}
    for(const name of names.filter(n => n.endsWith('.mjs'))) {
      const text=await readFile(new URL(name,location),'utf8')
      assert.equal(/node:(net|http|https|tls|dgram|dns|child_process)|\bundici\b|\bfetch\s*\(|\beval\s*\(|new\s+Function\b|\bimport\s*\(/u.test(text),false,name)
    }
  }
})
