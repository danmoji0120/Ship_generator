import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
const out='qa/v1.8.6.0.1',input='/tmp/battleship470-before.json';
writeFileSync(input,gunzipSync(readFileSync(`${out}/fixtures/battleship470-before.json.gz`)));
for(const version of ['before','after']){
 mkdirSync(`${out}/${version}`,{recursive:true});
 for(const kind of ['cold','warm'])for(let i=1;i<=3;i++)run(version,input,`battleship470-${kind}-${i}`,kind,'balanced',{REPEAT:kind==='cold'?'1':'0',CHANGED:kind==='warm'&&i===1?'1':'0',SAVE_BLUEPRINT:version==='after'&&kind==='cold'&&i===1?'/tmp/battleship470-after.json':''});
 for(const priority of ['survivability','mobility'])run(version,input,`battleship470-${priority}`,'cold',priority,{REPEAT:'1'});
}
function run(version,source,id,kind,priority,extra={}){
 const output=`${out}/${version}/${id}.json`;if(existsSync(output))return;const start=performance.now(),r=spawnSync(process.execPath,['--expose-gc','tests/performance/physical-harness.mjs','run',`/tmp/physical-${version}.mjs`,source,output,kind,priority],{env:{...process.env,...extra},encoding:'utf8',maxBuffer:4e6});
 if(r.status!==0)throw Error(r.stderr||r.stdout);const row=JSON.parse(readFileSync(output));row.processWallMs=performance.now()-start;writeFileSync(output,JSON.stringify(row,null,2));console.log(version,r.stdout.trim());
}
