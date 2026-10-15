import {build} from 'esbuild';
import ts from 'typescript';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {Session} from 'node:inspector';
const [command,...args]=process.argv.slice(2);
if(command==='build'){
 const [root,output,mode]=args,files=/src\/(physical\/|generation\/(generate|production\/build|macro\/plan|architecture\/layout|weapons\/(collision|surface-index)|hardpoint-system\/geometry)|rendering\/(ship|physical|geometry))/;
 const plugin={name:'opt-in-function-profile',setup(b){b.onLoad({filter:/\.ts$/},async a=>{
  if(!files.test(a.path.replaceAll('\\','/')))return;
  let code=await readFile(a.path,'utf8');const source=ts.createSourceFile(a.path,code,ts.ScriptTarget.Latest,true),edits=[];
  function visit(n){
   if(ts.isFunctionDeclaration(n)&&n.name&&n.body){const name=a.path.slice(a.path.indexOf('/src/')+5)+':'+n.name.text;
    edits.push([n.body.getStart(source)+1,`const __p=globalThis.__shipProfile; const __t=__p?performance.now():0; try {`]);
    edits.push([n.body.end-1,`} finally {if(__p)__p.record(${JSON.stringify(name)},performance.now()-__t);}`]);
   }
   ts.forEachChild(n,visit);
  }visit(source);
  for(const [at,text]of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,at)+text+code.slice(at);
  return{contents:code,loader:'ts'};
 });}};
 const hasDiagnostics=await access(resolve(root,'src/physical/diagnostics.ts')).then(()=>true,()=>false);
 await build({stdin:{contents:(hasDiagnostics?`export {preparePhysicalQueries} from './src/physical/probe.ts';export {setPhysicalProfilingEnabled,physicalDiagnostics} from './src/physical/diagnostics.ts';`:'')+`export {validateBlueprint} from './src/validation/validate.ts';export {generateBlueprint,DEFAULT_ORDER} from './src/generation/generate.ts';export {addPhysicalDesign,migratePhysicalDesign} from './src/physical/build.ts';export {validatePhysicalDesign} from './src/physical/validate.ts';export {armorRayProbe} from './src/physical/probe.ts';export {physicalSources} from './src/physical/geometry.ts';export {createDesignPolicy,finishPhysicalMass} from './src/physical/policy.ts';export {createShip,disposeShip} from './src/rendering/ship.ts';`,resolveDir:resolve(root)},bundle:true,platform:'node',format:'esm',outfile:output,sourcemap:'external',define:{'import.meta.env.DEV':'false'},plugins:mode==='profile'?[plugin]:[]});
 console.log('built',output,mode||'plain');
}else if(command==='run'){
 const [bundle,sourcePath,output,kind='cold',priority='original']=args;
 const source=JSON.parse(await readFile(sourcePath,'utf8')),stats={},events=[];
 if(process.env.PROFILE==='1')globalThis.__shipProfile={record(name,ms){const r=stats[name]??={calls:0,ms:0};r.calls++;r.ms+=ms;}};
 const boot=performance.now(),api=await import(pathToFileURL(resolve(bundle)).href),moduleInitMs=performance.now()-boot;
 const order=structuredClone(source.order);if(priority!=='original'){for(const k of Object.keys(order.priorities))order.priorities[k]=50;if(priority!=='balanced')order.priorities[priority]=100;}
 if(process.env.ROLE)order.role=process.env.ROLE;
 if(process.env.TARGET)order.targetDryMassKg=Number(process.env.TARGET);
 if(process.env.DIAGNOSTICS==='1')api.setPhysicalProfilingEnabled?.(true);
 const options={architecture:source.architecture.grammar,family:source.macroDesign.family,onTimings:t=>events.push(t)};
 const memory=()=>({heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss,maxRssBytes:process.resourceUsage().maxRSS*1024});
 const stages=[];const clock=(label,fn)=>{const prior=Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,{...v}])),start=performance.now(),value=fn(),ms=performance.now()-start;stages.push({label,ms,functions:Object.entries(stats).map(([name,r])=>({name,calls:r.calls-(prior[name]?.calls??0),ms:r.ms-(prior[name]?.ms??0)})).filter(r=>r.calls).sort((a,b)=>b.ms-a.ms)});return{label,ms,value};};
 const generate=(seed=source.seed)=>api.generateBlueprint(order,seed,options);
 if(kind==='warm')api.generateBlueprint({...api.DEFAULT_ORDER,length:100,role:'Patrol Ship',targetDryMassKg:1e10},912037);
 if(kind==='physical')source.order=order;
 global.gc?.();const before=memory();let cpu;
 if(process.env.CPU_PROFILE){cpu=new Session();cpu.connect();await new Promise(r=>cpu.post('Profiler.enable',r));await new Promise(r=>cpu.post('Profiler.start',r));}
 const first=clock(kind==='physical'?'physical':'generation',()=>kind==='physical'?api.addPhysicalDesign(source):generate());
 const b=first.value,validation=clock('validation',()=>api.validatePhysicalDesign(b)),serialization=clock('serialization',()=>JSON.stringify(b)),physicalSerialization=clock('physicalSerialization',()=>JSON.stringify(b.physicalDesign));
 let repeated,changed;
 if(kind==='warm'||process.env.REPEAT==='1'){repeated=clock('cache-hit',()=>kind==='physical'?api.addPhysicalDesign(structuredClone(source)):generate());if(process.env.CHANGED==='1')changed=clock('changed-seed',()=>generate(source.seed+1));}
 const query=clock('first-ray-query',()=>api.armorRayProbe(b,{x:0,y:order.length*2,z:0},{x:0,y:-1,z:0},order.length*4));
 const after=memory(),d=b.physicalDesign;
 if(cpu){const profile=await new Promise((res,rej)=>cpu.post('Profiler.stop',(e,r)=>e?rej(e):res(r.profile)));await writeFile(process.env.CPU_PROFILE,JSON.stringify(profile));cpu.disconnect();}
 const summary={kind,priority,order,seed:source.seed,moduleInitMs,firstMs:first.ms,validationMs:validation.ms,serializationMs:serialization.ms,physicalSerializationMs:physicalSerialization.ms,repeatedMs:repeated?.ms,changedMs:changed?.ms,deterministic:repeated?JSON.stringify(repeated.value)===serialization.value:null,beforeMemory:before,afterMemory:after,physicalBytes:physicalSerialization.value.length,blueprintBytes:serialization.value.length,surfaces:d.surfaces.length,triangles:d.surfaces.reduce((n,s)=>n+s.pieces.reduce((n,p)=>n+p.solid.indices.length/3,0),0),pieces:d.surfaces.reduce((n,s)=>n+s.pieces.length,0),queryMs:query.ms,queryHits:query.value.hits.length,mass:d.mass,diagnostics:api.physicalDiagnostics?.(b),issues:validation.value,productionTimings:events,stages,functions:Object.entries(stats).map(([name,r])=>({name,...r})).sort((a,b)=>b.ms-a.ms)};
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(summary,null,2));
 if(process.env.SAVE_BLUEPRINT)await writeFile(process.env.SAVE_BLUEPRINT,serialization.value);
 console.log(output,Math.round(first.ms),Math.round(repeated?.ms??0),Math.round(query.ms),summary.pieces,summary.issues.length);
}
