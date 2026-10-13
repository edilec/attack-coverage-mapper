import { constants } from 'node:fs'
import { lstat,mkdir,open,realpath } from 'node:fs/promises'
import { basename,dirname,resolve } from 'node:path'
import { BudgetError } from './limits.mjs'
import { assertWritableDestination,DestinationError } from './write-guard.mjs'
import { assertExportBytes } from './exports.mjs'
export const ARTIFACT_NAMES=Object.freeze(['coverage.json','coverage.csv','navigator-layer.json'])
export class OutputError extends Error {constructor(){super('Output export is incomplete.');this.code='output-unwritable'}}
async function inspect(path) {
  try{return await lstat(path)}catch(e){if(e.code==='ENOENT')return null;throw new DestinationError()}
}
async function outputRoot(outDir) {
  let path=resolve(outDir);const named=path,missing=[]
  for(;;) {
    const info=await inspect(path)
    if(info) {
      if(path===named && info.isSymbolicLink()) throw new DestinationError()
      let parent;try{parent=await realpath(path)}catch{throw new DestinationError()}
      const parentInfo=await inspect(parent)
      if(!parentInfo?.isDirectory()) throw new DestinationError()
      for(const component of missing.reverse()) {
        parent=resolve(parent,component)
        try{await mkdir(parent,{mode:0o700})}catch(e){if(e.code!=='EEXIST')throw new DestinationError()}
        const created=await inspect(parent)
        if(!created?.isDirectory() || created.isSymbolicLink())throw new DestinationError()
      }
      return await realpath(parent)
    }
    missing.push(basename(path));const next=dirname(path)
    if(next===path)throw new DestinationError()
    path=next
  }
}
async function protectedIdentity(path,identities) {
  const existing=await inspect(path)
  if(existing && identities.some(input=>input.dev===existing.dev&&input.ino===existing.ino)) throw new DestinationError()
}
export async function preflightOutput(outDir,{inputs=[],identities=[]}={}) {
  const root=await outputRoot(outDir),destinations=new Map()
  for(const name of ARTIFACT_NAMES) {
    const destination=resolve(root,name)
    await assertWritableDestination(destination,{root,inputs,label:name})
    await protectedIdentity(destination,identities)
    if(await inspect(destination)) throw new DestinationError()
    destinations.set(name,destination)
  }
  return {root,destinations,identities}
}
export async function writeArtifacts(preflight,artifacts,{inputs=[],budget,openFile=open}={}) {
  try {
    if(!Array.isArray(artifacts) || new Set(artifacts.map(a=>a.name)).size!==artifacts.length)throw new OutputError()
    for(const artifact of artifacts) {
      if(!ARTIFACT_NAMES.includes(artifact.name) || !(artifact.bytes instanceof Uint8Array)) throw new OutputError()
      assertExportBytes(artifact.bytes)
    }
    for(const artifact of artifacts) {
      budget.check('@output')
      const destination=resolve(preflight.root,artifact.name)
      await assertWritableDestination(destination,{root:preflight.root,inputs,label:artifact.name})
      await protectedIdentity(destination,preflight.identities??[])
      const handle=await openFile(destination,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600)
      try{await handle.writeFile(artifact.bytes);budget.check('@output')}finally{await handle.close()}
    }
  }catch(e){if(e instanceof BudgetError || e.code==='limit-export-bytes-exceeded')throw e;throw new OutputError()}
}
