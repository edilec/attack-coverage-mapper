import { readdir,readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
function conditionEnd(source,open) {
  let depth=1
  for(let i=open+1;i<source.length;i++) {
    const c=source[i]
    if(c==='"'||c==="'"||c==='`') {
      const quote=c
      for(i++;i<source.length;i++){if(source[i]==='\\')i++;else if(source[i]===quote)break}
      continue
    }
    if(c==='/'&&source[i+1]==='/'){i=source.indexOf('\n',i);if(i===-1)break;continue}
    if(c==='/'&&source[i+1]==='*'){i=source.indexOf('*/',i+2)+1;continue}
    const previous=source.slice(0,i).trimEnd().at(-1)
    if(c==='/'&&/[(!=|&,:?\[>{]/u.test(previous??'')) {
      let bracket=false
      for(i++;i<source.length;i++) {
        if(source[i]==='\\')i++
        else if(source[i]==='[')bracket=true
        else if(source[i]===']')bracket=false
        else if(source[i]==='/'&&!bracket)break
      }
      continue
    }
    if(c==='(')depth++
    if(c===')'&&--depth===0)return i+1
  }
  throw new Error('Unterminated owned source condition')
}
export function enumerate(source,file) {
  const rows=[]
  const add=(category,start,end,replacement)=>{
    const original=source.slice(start,end),line=source.slice(0,start).split('\n').length
    const prefix=source.slice(source.lastIndexOf('\n',start-1)+1,start).trimStart()
    if(prefix.startsWith('//')||prefix.startsWith('*')||prefix.startsWith('/*'))return
    rows.push({category,file,line,start,end,original,replacement})
  }
  for(const m of source.matchAll(/severity:'(error|warning)'/gu))add('severity',m.index,m.index+m[0].length,`severity:'${m[1]==='error'?'warning':'info'}'`)
  for(const m of source.matchAll(/incomplete:true/gu))add('incomplete',m.index,m.index+m[0].length,'incomplete:false')
  for(const m of source.matchAll(/\bif\s*\(/gu))add('guard',m.index,conditionEnd(source,m.index+m[0].lastIndexOf('(')),'if(false)')
  for(const m of source.matchAll(/\bthrow\b/gu))add('guard',m.index,m.index+m[0].length,'return')
  for(const m of source.matchAll(/\bcontinue\b/gu))add('guard',m.index,m.index+m[0].length,'break')
  for(const m of source.matchAll(/>(?=\s*(?:LIMITS\.[A-Za-z]+|maxDepth|maxNodes|maxMilliseconds|\d+))/gu)) {
    add('bound',m.index,m.index+1,'>=')
    add('bound',m.index,m.index+1,'>1+')
  }
  for(const m of source.matchAll(/byCodeUnit\(/gu)) {
    if(source.slice(Math.max(0,m.index-9),m.index)==='function ')continue
    add('ordering',m.index,m.index+m[0].length,"new Intl.Collator('en').compare(")
  }
  for(const m of source.matchAll(/\(a,b\)=>a-b/gu))add('ordering',m.index,m.index+m[0].length,'(a,b)=>b-a')
  const semantic=[
    ['fatal:true','fatal:false'],['depth>16','depth>17'],['row.unknown===0','true'],
    ["status!=='incomplete'&&row.unknown===0",'true'],['constants.O_EXCL|',''],['|constants.O_NOFOLLOW',''],
    [".update(bytes)",'.update(bytes.subarray(0,bytes.length-1))'],
    ['mappedActivities===0 ||',''],['return a<b?-1:a>b?1:0',"return new Intl.Collator('en').compare(a,b)"]]
  for(const [from,to] of semantic) {
    let start=source.indexOf(from)
    while(start!==-1){add('semantic',start,start+from.length,to);start=source.indexOf(from,start+from.length)}
  }
  return rows.sort((a,b)=>a.start-b.start || (a.category<b.category?-1:a.category>b.category?1:0) || (a.replacement<b.replacement?-1:1))
}
export async function inventory(root='.') {
  const rows=[]
  for(const dir of ['src','bin'])for(const name of (await readdir(resolve(root,dir))).filter(n=>n.endsWith('.mjs')).sort()) {
    const file=`${dir}/${name}`;rows.push(...enumerate(await readFile(resolve(root,file),'utf8'),file))
  }
  return rows
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const entries=await inventory(),counts={}
  for(const row of entries)counts[row.category]=(counts[row.category]??0)+1
  process.stdout.write(JSON.stringify({enumeration:'literal severity/incomplete entries; each if/throw/continue token outside comment-leading lines; > maximum-like terms in both directions; comparator call sites; named semantic fragments',counts,entries},null,2)+'\n')
}
