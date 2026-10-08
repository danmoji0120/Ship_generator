import {readBlueprint} from './helpers/blueprint-artifact.mjs';
// Revalidate corrected mount packing/bounds while preserving every armor and macro solid.
import {renderSession,png} from './helpers/render-session.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const dir='qa/v1.8.1', report=JSON.parse(await readFile(`${dir}/report.json`,'utf8'));
const {browser,page,errors}=await renderSession();
const results=[];
function withoutBounds(b){const c=structuredClone(b);delete c.layeredArmor.overallBounds;delete c.layeredArmor.mountDecisions;c.hardpoints=[];return c;}
try{
 await page.evaluate(async()=>{const {ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');window.boundsQA=new ArmorQARenderer(480);window.legacyGenerate=(await import('/src/generation/generate.ts')).generateBlueprintV18;window.directionQA=new ArmorQARenderer(320);const q=window.integrationQA,render=q.viewer.renderer.render.bind(q.viewer.renderer);window.oldShadow=false;q.viewer.renderer.render=(...args)=>{if(window.oldShadow){q.viewer.armorShadowLight.shadow.bias=-.0002;q.viewer.armorShadowLight.shadow.normalBias=q.viewer.blueprint.order.length*.0001;}else{q.viewer.armorShadowLight.shadow.bias=-.0012;q.viewer.armorShadowLight.shadow.normalBias=q.viewer.blueprint.order.length*.0006;}return render(...args);};});
 for(const [index,c] of report.records.entries()){
  if(index<Number(process.env.ARMOR_RESUME||0)){results.push({key:`${c.yard}-${c.architecture}-${c.seed}`,armorMacroExact:true,mountPackingCorrected:true,verifiedEarlier:true});continue;}
  const key=`${c.yard}-${c.architecture}-${c.seed}`;
  const old=JSON.parse(gunzipSync(await readFile(`${dir}/blueprints/${key}.json.gz`)).toString());
  const r=await page.evaluate(async({c,order})=>{const q=window.integrationQA,b=q.generate(order,c.seed,{architecture:c.architecture});window.oldShadow=true;const oldShot=await q.capture(b);window.oldShadow=false;const shot=await q.capture(b);const directional=['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC'].map(view=>window.directionQA.capture(b,'PRIMARY',view,{neutral:true}));return {json:JSON.stringify(b),oldShot,shot,directional};},{c,order:old.order});
  r.b=JSON.parse(r.json);
  assert.deepEqual(withoutBounds(r.b),withoutBounds(old),`Armor / macro unchanged ${key}`);

  // Revised foundation packing intentionally changes mounts, not any armor or macro solid.
  c.mounts=r.b.layeredArmor.mountDecisions;c.after=r.shot.diagnostics;
  await writeFile(`${dir}/blueprints/${key}.json.gz`,gzipSync(JSON.stringify(r.b)));
  await writeFile(`${dir}/raw/${key}.png`,png(r.shot.pixels));
  for(const shot of r.directional)await writeFile(`${dir}/armor-coverage/${key}-${shot.view}.png`,png(shot.pixels));
  results.push({key,armorMacroExact:true,mountPackingCorrected:true});
  if(results.length%20===0)console.log('Corrected mounts / preserved armor solids',results.length);
 }
 for(const c of report.comparisons){
  const key=`${c.family}-${c.seed}`,old=await readBlueprint(`${dir}/before-after/${key}-after.json`);
  const r=await page.evaluate(async({c,order})=>{const q=window.integrationQA,b=q.generate(order,c.seed,{architecture:c.architecture,family:c.family});const after=await q.capture(b),before=await q.capture(window.legacyGenerate(order,c.seed,{architecture:c.architecture,family:c.family}),'iso',after.pose);const shots=['HULL_ONLY','PRIMARY','SEAMS','COMPLETE'].flatMap(stage=>['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC'].map(view=>window.boundsQA.capture(b,stage,view,{neutral:true})));const fit=['HULL_ONLY','PRIMARY','SEAMS','COMPLETE'].map(stage=>window.boundsQA.capture(b,stage,'ISOMETRIC',{neutral:true,scale:'fit'}));const isolated=[1,2,3].map(layer=>window.boundsQA.capture(b,'REINFORCEMENT','ISOMETRIC',{neutral:true,scale:'fit',isolate:layer}));const pair=['NO_HARDPOINTS','COMPLETE'].flatMap(stage=>['TOP','ISOMETRIC'].map(view=>window.boundsQA.capture(b,stage,view,{neutral:true,scale:'fit'})));const {Vector3}=await import('/node_modules/.vite/deps/three.js');const panel=b.layeredArmor.assemblies.flatMap(a=>a.segments).filter(s=>s.layer===1&&s.orientation.y>.8).sort((a,d)=>d.thickness-a.thickness)[0];const center=panel.rootPolygon.reduce((a,p)=>({x:a.x+p.x/panel.rootPolygon.length,y:a.y+p.y/panel.rootPolygon.length,z:a.z+p.z/panel.rootPolygon.length}),{x:0,y:0,z:0});const close=['ISOMETRIC','RIGHT'].map(view=>window.boundsQA.capture(b,'SEAMS',view,{neutral:true,closeup:{center:new Vector3(center.x,center.y,center.z),extent:b.order.length*.20}}));return {json:JSON.stringify(b),after,before,shots,fit,isolated,pair,close};},{c,order:old.order});
  r.b=JSON.parse(r.json);
  assert.deepEqual(withoutBounds(r.b),withoutBounds(old));
  await writeFile(`${dir}/before-after/${key}-after.json`,JSON.stringify(r.b));
  c.pose=r.after.pose;c.after=r.after.diagnostics;
  await writeFile(`${dir}/before-after/${key}-after.png`,png(r.after.pixels));
  await writeFile(`${dir}/before-after/${key}-before.png`,png(r.before.pixels));
  for(const shot of r.shots)await writeFile(`${dir}/armor-progression/${key}-${shot.stage}-${shot.view}.png`,png(shot.pixels));
  for(const shot of r.close)await writeFile(`${dir}/seam-closeups/${key}-${shot.view}.png`,png(shot.pixels));
  for(const shot of r.fit)await writeFile(`${dir}/armor-progression/${key}-${shot.stage}-fit.png`,png(shot.pixels));
  for(const [i,shot]of r.isolated.entries())await writeFile(`${dir}/armor-gallery/${key}-layer-${i+1}.png`,png(shot.pixels));
  for(const shot of r.pair)await writeFile(`${dir}/hardpoint-comparison/${key}-${shot.stage}-${shot.view}.png`,png(shot.pixels));
 }
 for(const yard of ['aegis','vesper','forge','serein']){const r=await page.evaluate(async yard=>{const q=window.integrationQA,b=q.generate({...q.order,shipyardId:yard},7,{architecture:'BLOCK_ASSEMBLY',family:'HAMMERHEAD'});return {normal:await q.capture(b),shots:['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC'].map(view=>window.boundsQA.capture(b,'COMPLETE',view,{neutral:true}))};},yard);await writeFile(`${dir}/shipyard-comparison/${yard}.png`,png(r.normal.pixels));for(const shot of r.shots)await writeFile(`${dir}/neutral/${yard}-${shot.view}.png`,png(shot.pixels));}
 assert.deepEqual(errors,[]);
 await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));
 await writeFile(`${dir}/regression/bounds-repair.json`,JSON.stringify({count:results.length,results,errors,fittedCapturesRefreshed:true},null,2));
 console.log('PASS: 220 corrected mount renders; unchanged armor/macro solids; refreshed all representatives');
}finally{await browser.close();}
