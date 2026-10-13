import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp,writeFile,rm,symlink,stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseArgs,runCli } from '../src/cli.mjs'
import { readInput } from '../src/json.mjs'
import { preflightOutput,writeArtifacts,OutputError } from '../src/output.mjs'
import { documents } from './support/fixtures.mjs'
import { ConfigError } from '../src/exports.mjs'
test('strict parser rejects each configuration class without file operations',()=>{
  assert.deepEqual(parseArgs(['--dataset','a','--activities','b','--out-dir','c']),{help:false,dataset:'a',activities:'b',outDir:'c',layerVersion:'4.4'})
  assert.equal(parseArgs(['--help']).help,true)
  const valid=['--dataset','a','--activities','b','--out-dir','c']
  for(const args of [null,'text',[],['--dataset'],['--wat','x'],['positional'],['--help','x'],[...valid,'--dataset','b'],[...valid,'--wat','x'],[...valid,'--layer-version','4.3'],[...valid,'--layer-version'],[{}]])assert.throws(()=>parseArgs(args),ConfigError)
})
test('in-process bad configuration and help obey stdout shapes',async()=>{
  for(const argv of [null,[],['--wat','x'],['--dataset','a','--activities','b','--out-dir','c','--layer-version','4.3']]) {
    let stdout='',stderr=''
    const code=await runCli(argv,{stdout:s=>stdout+=s,stderr:s=>stderr+=s,now:()=>0})
    assert.equal(code,2);assert.equal(stdout,'');assert.equal(stderr,'Invalid command configuration. Use --help.\n')
  }
  let stdout='',stderr=''
  assert.equal(await runCli(['--help'],{stdout:s=>stdout+=s,stderr:s=>stderr+=s,now:()=>0}),0)
  assert.equal(stdout,'');assert.match(stderr,/--dataset/u)
})
test('in-process evaluated inputs preserve every exit/report/export shape',async()=>{
  for(const [mode,code,status,rule] of [['pass',0,'pass',null],['fail',1,'fail','not-detected'],['unknown',2,'incomplete','detection-unknown'],['unreadable',2,'incomplete','input-unreadable'],['bad-json',2,'incomplete','input-invalid'],['empty',2,'incomplete','no-activities']]) {
    const dir=await mkdtemp(join(tmpdir(),'coverage-cli-matrix-'))
    try {
      const {dataset,activities}=documents(),d=join(dir,'d'),a=join(dir,'a'),out=join(dir,'out')
      if(mode==='fail')activities.activities[0].detection='not-detected'
      if(mode==='unknown')activities.activities[0].detection='unknown'
      if(mode==='empty')activities.activities=[]
      await writeFile(d,JSON.stringify(dataset))
      if(mode!=='unreadable')await writeFile(a,mode==='bad-json'?'private-invalid-json':JSON.stringify(activities))
      let stdout='',stderr=''
      const got=await runCli(['--dataset',d,'--activities',a,'--out-dir',out],{stdout:s=>stdout+=s,stderr:s=>stderr+=s,now:()=>0})
      const report=JSON.parse(stdout);assert.equal(got,code);assert.equal(report.status,status)
      if(rule)assert.ok(report.findings.some(f=>f.ruleId===rule));else assert.deepEqual(report.findings,[])
      assert.equal(await (await import('node:fs/promises')).readFile(join(out,'coverage.json'),'utf8'),stdout)
      for(const name of ['coverage.json','coverage.csv','navigator-layer.json'])assert.equal((await stat(join(out,name))).isFile(),true)
      assert.match(stderr,new RegExp('^attack-coverage-mapper: '+status))
    }finally{await rm(dir,{recursive:true,force:true})}
  }
})
test('real in-process CLI keeps all collection findings and emits operational failure after mapping',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'coverage-cli-unit-'))
  try {
    const {dataset,activities}=documents(),d=join(dir,'d'),a=join(dir,'a'),out=join(dir,'out')
    await writeFile(d,JSON.stringify(dataset));await writeFile(a,JSON.stringify(activities))
    let stdout='',stderr=''
    const io={readInput,preflightOutput,writeArtifacts:async()=>{throw new OutputError()}}
    const code=await runCli(['--dataset',d,'--activities',a,'--out-dir',out],{stdout:s=>stdout+=s,stderr:s=>stderr+=s,now:()=>0,io})
    const report=JSON.parse(stdout);assert.equal(code,2);assert.equal(report.status,'incomplete');assert.equal(report.summary.mappedActivities,2)
    assert.ok(report.findings.some(f=>f.ruleId==='output-unwritable'));assert.match(stderr,/Export did not complete/u)
    assert.equal(await readInput(d,{check(){}}).then(r=>Buffer.from(r.bytes).toString()),JSON.stringify(dataset))
  }finally{await rm(dir,{recursive:true,force:true})}
})
test('case-variant dangling input remains missing and no report artifact is created',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'coverage-case-'))
  try {
    const d=join(dir,'dataset'),a=join(dir,'activities'),out=join(dir,'out')
    await symlink(join(out,'COVERAGE.JSON'),d);await writeFile(a,JSON.stringify(documents().activities))
    let stdout='',stderr=''
    const code=await runCli(['--dataset',d,'--activities',a,'--out-dir',out],{stdout:s=>stdout+=s,stderr:s=>stderr+=s,now:()=>0})
    assert.equal(code,2);assert.equal(stdout,'');assert.match(stderr,/configuration/u)
    await assert.rejects(stat(d),e=>e.code==='ENOENT')
    await assert.rejects(stat(join(out,'coverage.json')),e=>e.code==='ENOENT')
  }finally{await rm(dir,{recursive:true,force:true})}
})
test('deadline during the first input read locates the dataset, not the activity file',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'coverage-clock-role-'))
  try {
    const d=join(dir,'d'),a=join(dir,'a'),out=join(dir,'out'),{dataset,activities}=documents()
    await writeFile(d,JSON.stringify(dataset));await writeFile(a,JSON.stringify(activities))
    let stdout='',calls=0
    const code=await runCli(['--dataset',d,'--activities',a,'--out-dir',out],{stdout:s=>stdout+=s,stderr:()=>{},now:()=>++calls>=3?5001:0})
    const report=JSON.parse(stdout);assert.equal(code,2)
    assert.equal(report.findings.find(f=>f.ruleId==='analysis-timeout').location.file,'@dataset')
    assert.equal(report.findings.some(f=>f.ruleId==='input-invalid'),false)
  }finally{await rm(dir,{recursive:true,force:true})}
})
test('cyclic unreadable input is evidence failure with a report, never bad-usage silence',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'coverage-input-cycle-'))
  try {
    const d=join(dir,'d'),cycle=join(dir,'cycle'),a=join(dir,'a'),out=join(dir,'out')
    await symlink(cycle,d);await symlink(d,cycle);await writeFile(a,JSON.stringify(documents().activities))
    let stdout='',stderr=''
    const code=await runCli(['--dataset',d,'--activities',a,'--out-dir',out],{stdout:s=>stdout+=s,stderr:s=>stderr+=s,now:()=>0})
    assert.equal(code,2);assert.ok(stdout)
    const report=JSON.parse(stdout);assert.equal(report.status,'incomplete')
    assert.ok(report.findings.some(f=>f.ruleId==='input-unreadable'&&f.location.file==='@dataset'))
    assert.equal(stderr.includes('Invalid command configuration'),false)
  }finally{await rm(dir,{recursive:true,force:true})}
})
