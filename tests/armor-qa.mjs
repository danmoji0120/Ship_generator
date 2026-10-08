import {renderSession,png} from './helpers/render-session.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
const dir=process.env.ARMOR_OUTPUT||'qa/v1.8.1';
for(const folder of ['raw','silhouettes','blueprints','armor-progression','before-after','armor-gallery','family-comparison','shipyard-comparison','neutral','regression','failures','armor-coverage','panel-gallery','seam-closeups','hardpoint-comparison'])await mkdir(`${dir}/${folder}`,{recursive:true});
const {browser,page,errors}=await renderSession();
const hash=s=>createHash('sha256').update(png(s)).digest('hex');
const grammars=['MONOLITHIC','BLOCK_ASSEMBLY','SPINE_AND_MODULES','TRUSS_POD','TWIN_HULL','CORE_AND_NACELLES','STACKED_BLOCKS','HYBRID'];
const records=[],failures=[],comparisons=[],determinism=[],compatibility=[],families=[],yards=[];
try {
 await page.evaluate(async()=>{const {ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');const {generateBlueprintV18}=await import('/src/generation/generate.ts');window.armorQA={renderer:new ArmorQARenderer(480),mask:new ArmorQARenderer(320),old:generateBlueprintV18};});
 const cases=grammars.flatMap(architecture=>Array.from({length:20},(_,seed)=>({architecture,seed,yard:'forge'})));
 cases.push(...['aegis','vesper','serein'].flatMap(yard=>Array.from({length:20},(_,seed)=>({architecture:'BLOCK_ASSEMBLY',seed,yard}))));
 for(const [i,c] of cases.entries()) {
  const data=await page.evaluate(async c=>{try{const q=window.integrationQA,o={...structuredClone(q.order),shipyardId:c.yard};const t=performance.now(),b=q.generate(o,c.seed,{architecture:c.architecture}),ms=performance.now()-t;
   const old=window.armorQA.old(o,c.seed,{architecture:c.architecture});
   const macroUnchanged=['structuralVolumes','structuralConnectors','macroDesign','dimensions','engines','prefabPlacements','hullIntegration'].every(k=>JSON.stringify(b[k])===JSON.stringify(old[k]));
   const after=await q.capture(b),before=await q.capture(old,'iso',after.pose);
   const mask=[];for(const stage of ['HULL_ONLY','PRIMARY','SECONDARY'])for(const view of ['TOP','SIDE','FRONT'])mask.push(window.armorQA.mask.capture(b,stage,view,{black:true}));
   const noMount=window.armorQA.mask.capture(b,'NO_HARDPOINTS','TOP',{black:true});const mounted=window.armorQA.mask.capture(b,'COMPLETE','TOP',{black:true});
   const directional=['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC'].map(view=>window.armorQA.mask.capture(b,'PRIMARY',view,{neutral:true}));
   const noMountBlueprint=structuredClone(b);noMountBlueprint.hardpoints=[];const panelsUnchanged=JSON.stringify(b.layeredArmor.assemblies)===JSON.stringify(noMountBlueprint.layeredArmor.assemblies);
   const s=b.layeredArmor.assemblies.flatMap(a=>a.segments);return {blueprintJson:JSON.stringify(b),ms,macroUnchanged,after,before,mask,directional,panelsUnchanged,noMount,mounted,layerCounts:[1,2,3].map(layer=>s.filter(s=>s.layer===layer).length),thickness:[1,2,3].map(layer=>s.filter(s=>s.layer===layer).map(s=>s.thickness))};
  }catch(e){return {error:String(e),stack:e.stack};}},c);
  if(data.error){failures.push({...c,...data});console.log('FAIL',c,data.error);continue;}
  data.b=JSON.parse(data.blueprintJson);delete data.blueprintJson;
  assert(data.macroUnchanged,`Macro/structure changed ${JSON.stringify(c)}`);
  const key=`${c.yard}-${c.architecture}-${c.seed}`;
  await writeFile(`${dir}/raw/${key}.png`,png(data.after.pixels));
  await writeFile(`${dir}/blueprints/${key}.json.gz`,gzipSync(JSON.stringify(data.b)));
  assert(data.panelsUnchanged);
  for(const shot of data.directional)await writeFile(`${dir}/armor-coverage/${key}-${shot.view}.png`,png(shot.pixels));
  for(const s of data.mask)await writeFile(`${dir}/silhouettes/${key}-${s.stage}-${s.view}.png`,png(s.pixels));
  records.push({...c,family:data.b.macroDesign.family,composition:data.b.architecture.composition,generationMs:data.ms,candidate:data.b.candidate,macroUnchanged:data.macroUnchanged,budget:data.b.layeredArmor.budget,coverage:data.b.layeredArmor.coverage,mounts:data.b.layeredArmor.mountDecisions,panelsUnchanged:data.panelsUnchanged,layerCounts:data.layerCounts,thickness:data.thickness,decisions:data.b.layeredArmor.decisions,before:data.before.diagnostics,after:data.after.diagnostics});
  if(i%20===19){console.log(`${i+1}/${cases.length} actual WebGL designs`);await writeFile(`${dir}/checkpoint.json`,JSON.stringify({count:records.length,failures,errors}));}
 }
 const representative=[['WEDGE_CITADEL','MONOLITHIC'],['HAMMERHEAD','BLOCK_ASSEMBLY'],['WIDE_CARRIER','BLOCK_ASSEMBLY'],['ENGINE_DOMINANT','CORE_AND_NACELLES'],['WEAPON_DOMINANT','SPINE_AND_MODULES'],['SPLIT_FRAME','TRUSS_POD']];
 for(const [family,architecture] of representative)for(const seed of [0,7,13]) {
  const result=await page.evaluate(async({family,architecture,seed})=>{const q=window.integrationQA,o={...structuredClone(q.order),shipyardId:'forge'},options={family,architecture};const old=window.armorQA.old(o,seed,options),b=q.generate(o,seed,options);
   const after=await q.capture(b),before=await q.capture(old,'iso',after.pose);
   const shots=[];for(const stage of ['HULL_ONLY','PRIMARY','SEAMS','COMPLETE'])for(const view of ['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC'])shots.push(window.armorQA.renderer.capture(b,stage,view,{neutral:true}));
   const fit=[];for(const stage of ['HULL_ONLY','PRIMARY','SEAMS','COMPLETE'])fit.push(window.armorQA.renderer.capture(b,stage,'ISOMETRIC',{neutral:true,scale:'fit'}));
   const isolated=[1,2,3].map(layer=>window.armorQA.renderer.capture(b,'REINFORCEMENT','ISOMETRIC',{neutral:true,scale:'fit',isolate:layer}));
   const pair=['NO_HARDPOINTS','COMPLETE'].flatMap(stage=>['TOP','ISOMETRIC'].map(view=>window.armorQA.renderer.capture(b,stage,view,{neutral:true,scale:'fit'})));
   const {Vector3}=await import('/node_modules/.vite/deps/three.js');
   const panel=b.layeredArmor.assemblies.flatMap(a=>a.segments).filter(s=>s.layer===1&&s.orientation.y>.8).sort((a,d)=>d.thickness-a.thickness)[0];
   const center=panel.rootPolygon.reduce((a,p)=>({x:a.x+p.x/panel.rootPolygon.length,y:a.y+p.y/panel.rootPolygon.length,z:a.z+p.z/panel.rootPolygon.length}),{x:0,y:0,z:0});
   const close=['ISOMETRIC','RIGHT'].map(view=>window.armorQA.renderer.capture(b,'SEAMS',view,{neutral:true,closeup:{center:new Vector3(center.x,center.y,center.z),extent:b.order.length*.20}}));
   return {newJson:JSON.stringify(b),oldJson:JSON.stringify(old),after,before,shots,fit,isolated,pair,close};},{family,architecture,seed});
  result.b=JSON.parse(result.newJson);result.old=JSON.parse(result.oldJson);delete result.newJson;delete result.oldJson;
  const key=`${family}-${seed}`;
  await writeFile(`${dir}/before-after/${key}-before.png`,png(result.before.pixels));await writeFile(`${dir}/before-after/${key}-after.png`,png(result.after.pixels));
  await writeFile(`${dir}/before-after/${key}-before.json`,JSON.stringify(result.old));await writeFile(`${dir}/before-after/${key}-after.json`,JSON.stringify(result.b));
  for(const s of result.shots)await writeFile(`${dir}/armor-progression/${key}-${s.stage}-${s.view}.png`,png(s.pixels));
  for(const s of result.fit)await writeFile(`${dir}/armor-progression/${key}-${s.stage}-fit.png`,png(s.pixels));
  for(const shot of result.pair)await writeFile(`${dir}/hardpoint-comparison/${key}-${shot.stage}-${shot.view}.png`,png(shot.pixels));
  for(const shot of result.close)await writeFile(`${dir}/seam-closeups/${key}-${shot.view}.png`,png(shot.pixels));
  for(const [i,s]of result.isolated.entries())await writeFile(`${dir}/armor-gallery/${key}-layer-${i+1}.png`,png(s.pixels));
  comparisons.push({family,architecture,seed,pose:result.after.pose,before:result.before.diagnostics,after:result.after.diagnostics,coverage:result.b.layeredArmor.coverage,macroPreserved:JSON.stringify(result.b.macroDesign)===JSON.stringify(result.old.macroDesign)});
  families.push({family,architecture,seed,layers:result.b.layeredArmor.budget,coverage:result.b.layeredArmor.coverage});console.log('Family progression',key);
 }
 for(const yard of ['aegis','vesper','forge','serein']) {
  const r=await page.evaluate(async yard=>{const q=window.integrationQA,b=q.generate({...q.order,shipyardId:yard},7,{architecture:'BLOCK_ASSEMBLY',family:'HAMMERHEAD'});const normal=await q.capture(b);const shots=['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC'].map(view=>window.armorQA.renderer.capture(b,'COMPLETE',view,{neutral:true}));return {normal,shots,coverage:b.layeredArmor.coverage};},yard);
  await writeFile(`${dir}/shipyard-comparison/${yard}.png`,png(r.normal.pixels));for(const s of r.shots)await writeFile(`${dir}/neutral/${yard}-${s.view}.png`,png(s.pixels));yards.push({yard,coverage:r.coverage});
 }
 for(const architecture of grammars) {
  const r=await page.evaluate(async architecture=>{const q=window.integrationQA,o={...q.order,shipyardId:'forge'},options={architecture};const results=[];
   for(let i=0;i<10;i++){const b=q.generate(o,7,options),normal=await q.capture(b),mask=window.armorQA.mask.capture(b,'COMPLETE','TOP',{black:true});results.push({json:JSON.stringify(b),normal:normal.pixels,mask:mask.pixels});}return results;},architecture);
  assert(r.every(x=>x.json===r[0].json&&x.normal===r[0].normal&&x.mask===r[0].mask));determinism.push({architecture,repeats:10,jsonExact:true,normalPixelExact:true,blackPixelExact:true});
 }
 // Archived V1.8 renders must remain byte-identical to the original QA PNG, not merely regenerated V1.8 data.
 const manifest=JSON.parse(await readFile('qa/v1.8/before/manifest.json','utf8'));
 for(const row of manifest.result) {
  const key=row.architecture==='MONOLITHIC'?`${row.yard}-MONOLITHIC-${row.seed}`:`${row.yard}-${row.seed}`;
  const old=JSON.parse(await readFile(`qa/v1.8/after/${key}.json`,'utf8'));
  const r=await page.evaluate(async({json,pose})=>{const old=JSON.parse(json),q=window.integrationQA,restored=window.armorQA.old(old.order,old.seed,{architecture:old.architecture.grammar,...(old.macroDesign.source==='qa-fixed'?{family:old.macroDesign.family}:{})});return {jsonExact:JSON.stringify(old)===JSON.stringify(restored),shot:await q.capture(old,'iso',pose)};},{json:JSON.stringify(old),pose:row.pose});
  assert(r.jsonExact,`Archived V1.8 JSON ${key}`);assert.equal(hash(r.shot.pixels),createHash('sha256').update(await readFile(`qa/v1.8/after/${key}.png`)).digest('hex'),`Archived V1.8 WebGL ${key}`);
  compatibility.push({version:'1.8',key,jsonExact:true,pixelsExact:true,geometryFinite:r.shot.diagnostics.geometryFinite});
 }
 for(const path of ['qa/forge-blueprint.json','qa/v1/forge-blueprint.json','qa/v1.5/forge-BLOCK_ASSEMBLY-0.json','qa/v1.7/before/forge-0.json','qa/v1.8/before/forge-0.json']) {
  let old;try{old=JSON.parse(await readFile(path,'utf8'));}catch{continue;}
  const r=await page.evaluate(async json=>window.integrationQA.capture(JSON.parse(json)),JSON.stringify(old));assert(r.diagnostics.geometryFinite);compatibility.push({version:old.generatorVersion??'V0',path,finite:true});
 }
 const timings=await page.evaluate(async()=>{const q=window.integrationQA,result=[];for(let i=0;i<8;i++){q.generate({...q.order,shipyardId:'forge'},i,{architecture:'BLOCK_ASSEMBLY'});window.armorQA.old(q.order,i);}
  for(let i=0;i<80;i++)for(const version of i%2?['1.8.1','1.8']:['1.8','1.8.1']){const yard=['aegis','vesper','forge','serein'][i%4],o={...q.order,shipyardId:yard};const t=performance.now();const b=version==='1.8'?window.armorQA.old(o,i,{architecture:'BLOCK_ASSEMBLY'}):q.generate(o,i,{architecture:'BLOCK_ASSEMBLY'});result.push({version,yard,seed:i,ms:performance.now()-t,segments:b.layeredArmor?.budget.segmentCount??0});if(i%10===0)await new Promise(r=>setTimeout(r,0));}return result;});
 assert.deepEqual(errors,[]);assert.equal(failures.length,0);
 await writeFile(`${dir}/report.json`,JSON.stringify({version:'1.8.1',basis:'4078de2b2d1bd41f89a562e61cc504b422c35725',records,failures,errors,comparisons,determinism,compatibility,families,yards,timings},null,2));
 await writeFile(`${dir}/failures/final-candidates.json`,JSON.stringify({failures,errors,candidateRetries:records.filter(r=>r.candidate>0),omissions:records.flatMap(r=>r.decisions.filter(d=>d.status==='omitted').map(d=>({yard:r.yard,architecture:r.architecture,seed:r.seed,...d})))},null,2));
 console.log(`PASS: ${records.length} unique designs, 18 family progressions, 80 deterministic repeats, ${compatibility.length} archived compatibility cases, console errors ${errors.length}`);
}finally{await browser.close();}
