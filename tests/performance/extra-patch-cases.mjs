import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
const before=await import('/tmp/physical-before.mjs'),out='qa/v1.8.6.0.1';await mkdir(`${out}/fixtures`,{recursive:true});
const spine=before.generateBlueprint({...structuredClone(before.DEFAULT_ORDER),shipyardId:'vesper',role:'Cruiser',length:300},12,{version:'1.8.5.5',architecture:'SPINE_AND_MODULES',family:'WEAPON_DOMINANT'});
const truss=before.generateBlueprint({...structuredClone(before.DEFAULT_ORDER),shipyardId:'forge',role:'Cruiser',length:300},1,{version:'1.8.5.5',architecture:'TRUSS_POD',family:'SPLIT_FRAME'});
for(const [id,b]of [['spine300',spine],['truss300',truss]]){await writeFile(`/tmp/${id}-input.json`,JSON.stringify(b));await writeFile(`${out}/fixtures/${id}-legacy.json.gz`,gzipSync(JSON.stringify(b)));}
for(const [id,path]of [['spine300','/tmp/spine300-input.json'],['truss300','/tmp/truss300-input.json'],['vesper200','qa/v1.8.6.0/before/vesper200.json'],['forge300','qa/v1.8.6.0/before/forge300.json'],['cruiser470','qa/v1.8.6.0/before/aegis470.json']])for(const version of ['before','after']){
 const output=`${out}/${version}/${id}-supplement.json`,r=spawnSync(process.execPath,['--expose-gc','tests/performance/physical-harness.mjs','run',`/tmp/physical-${version}.mjs`,path,output,'cold','original'],{encoding:'utf8',env:{...process.env,REPEAT:'1',SAVE_BLUEPRINT:`/tmp/${id}-${version}.json`},maxBuffer:1e6});
 if(r.status)throw Error(`${id}/${version}: ${r.stderr}`);console.log(r.stdout.trim());await writeFile(`${out}/fixtures/${id}-${version}.json.gz`,gzipSync(await readFile(`/tmp/${id}-${version}.json`)));
}
