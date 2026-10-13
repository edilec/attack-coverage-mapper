import { spawnSync } from 'node:child_process'
import { mkdtemp,writeFile,readFile,rm,stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { documents } from './fixtures.mjs'
const bin=fileURLToPath(new URL('../../bin/attack-coverage-mapper.mjs',import.meta.url))
export const denyPath=fileURLToPath(new URL('./deny-network.mjs',import.meta.url))
export function runRaw(argv,dir) {
  const args=['--import',denyPath,bin,...argv]
  const result=spawnSync(process.execPath,args,{cwd:dir,encoding:'utf8',timeout:15000,maxBuffer:40*1024*1024})
  if(result.error)throw result.error
  return {code:result.status,stdout:result.stdout,stderr:result.stderr,report:result.stdout?JSON.parse(result.stdout):null,args}
}
async function snapshot(path) {
  try{const info=await stat(path);return {bytes:await readFile(path),size:info.size,mtime:info.mtimeMs}}
  catch(e){if(e.code==='ENOENT')return null;throw e}
}
export async function runCase({datasetBytes=Buffer.from(JSON.stringify(documents().dataset)),activityBytes=Buffer.from(JSON.stringify(documents().activities)),extraArgs=[],prepare=async()=>{},inspect=async()=>{}}={}) {
  const dir=await mkdtemp(join(tmpdir(),'coverage-cli-'))
  try {
    const datasetPath=join(dir,'dataset.json'),activityPath=join(dir,'activities.json'),outDir=join(dir,'coverage')
    if(datasetBytes!==null)await writeFile(datasetPath,datasetBytes)
    if(activityBytes!==null)await writeFile(activityPath,activityBytes)
    const context={dir,datasetPath,activityPath,outDir}
    await prepare(context)
    const before={dataset:await snapshot(datasetPath),activities:await snapshot(activityPath)}
    const result=runRaw(['--dataset',datasetPath,'--activities',activityPath,'--out-dir',outDir,...extraArgs],dir)
    const artifacts={}
    for(const name of ['coverage.json','coverage.csv','navigator-layer.json'])try{artifacts[name]=await readFile(join(outDir,name),'utf8')}catch(e){if(e.code!=='ENOENT')throw e}
    Object.assign(result,{artifacts,before,after:{dataset:await snapshot(datasetPath),activities:await snapshot(activityPath)}})
    await inspect(result,context)
    return result
  }finally{await rm(dir,{recursive:true,force:true})}
}
