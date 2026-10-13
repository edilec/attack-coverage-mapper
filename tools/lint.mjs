import { readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
async function files(dir) {
  let entries; try {entries=await readdir(dir,{withFileTypes:true})} catch(e) {if(e.code==='ENOENT') return []; throw e}
  const out=[]
  for(const entry of entries) {
    const path=join(dir,entry.name)
    if(entry.isDirectory()) out.push(...await files(path))
    else if(entry.name.endsWith('.mjs')) out.push(path)
  }
  return out
}
for(const path of (await Promise.all(['src','bin','tools','test'].map(files))).flat().sort()) {
  const result=spawnSync(process.execPath,['--check',path],{stdio:'inherit'})
  if(result.status!==0) process.exit(result.status??1)
}
