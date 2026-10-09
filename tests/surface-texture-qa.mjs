import {renderSession,png} from './helpers/render-session.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.OUT||'qa/v1.8.5.2/rendering';await mkdir(out,{recursive:true});
const {browser,page,errors}=await renderSession();const rows=[];
try{
 const cases=[...['aegis','vesper','forge','serein'].map(yard=>({id:'yard-'+yard,yard,length:300,architecture:'MONOLITHIC',family:'WEDGE_CITADEL'})),...['WEDGE_CITADEL','HAMMERHEAD','WIDE_CARRIER','ENGINE_DOMINANT','WEAPON_DOMINANT','SPLIT_FRAME'].map((family,i)=>({id:'family-'+family,yard:'aegis',length:300,family,architecture:['MONOLITHIC','BLOCK_ASSEMBLY','BLOCK_ASSEMBLY','CORE_AND_NACELLES','SPINE_AND_MODULES','TRUSS_POD'][i]})),...[40,120,600].map(length=>({id:'length-'+length,yard:'aegis',length}))];
 for(const c of cases.filter(c=>!process.env.CASE||c.id===process.env.CASE)){
  const result=await page.evaluate(async c=>{
   const {generateBlueprint,DEFAULT_ORDER}=await import('/src/generation/generate.ts'),{applySurfaceAppearance}=await import('/src/generation/appearance/build.ts'),{ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
   const order={...structuredClone(DEFAULT_ORDER),shipyardId:c.yard,length:c.length,role:c.length===40?'Corvette':'Cruiser'},options={version:'1.8.5.1',...(c.family?{architecture:c.architecture,family:c.family}:{})},old=generateBlueprint(order,7,options),current=applySurfaceAppearance(structuredClone(old));
   const original=JSON.stringify(old),strip=structuredClone(current);strip.materialAppearance=old.materialAppearance;strip.generatorVersion=old.generatorVersion;if(JSON.stringify(strip)!==original)throw Error('Canonical geometry changed');
   const r=new ArmorQARenderer(800),shots=[],capture=(b,name,view,opt={})=>{if(c.replayOnly&&name.startsWith('before-'))return;shots.push({name,...r.capture(b,'COMPLETE',view,{reviewLighting:true,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:order.length*1.2},...opt})});};
   for(const view of c.id==='yard-aegis'?['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC','LOW-ISOMETRIC']:['ISOMETRIC','LOW-ISOMETRIC']){capture(old,'before-'+view,view);capture(current,'after-'+view,view);}
   if(c.id.startsWith('yard-'))for(const kind of['COMMAND','PROPULSION','SERVICE_CHANNEL','WEAPON_PRIMARY','SENSOR','MANEUVERING']){
    const p=current.exteriorDetailPlan.kitPlacements.find(p=>current.exteriorDetailPlan.detectedZones.find(z=>z.id===p.zoneId).kind===kind);if(!p)continue;
    const {normal:n,forward:f,right:t}=p.attachment.frame,k=['SENSOR','WEAPON_PRIMARY','SERVICE_CHANNEL'].includes(kind)?.08:.55,viewDirection={x:n.x+k*f.x+k*.7*t.x,y:n.y+k*f.y+k*.7*t.y,z:n.z+k*f.z+k*.7*t.z},opt={viewDirection,inspectionLighting:true,underbodyLighting:n.y<0||kind==='SERVICE_CHANNEL',closeup:{center:p.attachment.position,extent:kind==='SERVICE_CHANNEL'?9:kind==='WEAPON_PRIMARY'?7:kind==='MANEUVERING'?5:8}};
    capture(old,'before-close-'+kind,'ISOMETRIC',opt);capture(current,'after-close-'+kind,'ISOMETRIC',opt);
   }
   if(c.id.startsWith('yard-')){const optic=current.prefabPlacements.flatMap(p=>p.assembly?.parts??[]).find(p=>p.role==='COMMAND_HOUSING');if(optic){const center={x:(optic.bounds.min.x+optic.bounds.max.x)/2,y:(optic.bounds.min.y+optic.bounds.max.y)/2,z:(optic.bounds.min.z+optic.bounds.max.z)/2},opt={viewDirection:{x:-.32,y:.38,z:-1},inspectionLighting:true,closeup:{center,extent:Math.max(9,(optic.bounds.max.x-optic.bounds.min.x)*1.8)}};capture(old,'before-bridge-window','ISOMETRIC',opt);capture(current,'after-bridge-window','ISOMETRIC',opt);}}
   if(c.id==='yard-aegis'){
    for(const mode of['OFF','LOW','HIGH','AUTO'])capture(current,'mode-'+mode,'ISOMETRIC',{detailMode:mode});
    for(const debug of['TEXTURE','DECAL'])capture(current,'debug-'+debug,'ISOMETRIC',{surfaceDebug:debug});
    for(const environment of['SPACE','SIDE']){capture(old,'before-env-'+environment,'ISOMETRIC',{environment});capture(current,'after-env-'+environment,'ISOMETRIC',{environment});}
    for(const finish of['CLEAN','SERVICE','WEATHERED'])capture(current,'finish-'+finish,'ISOMETRIC',{finish});
   }
   const identity=current.materialAppearance.decals.find(d=>d.kind==='IDENTIFICATION');if(identity){const opt={viewDirection:identity.normal,inspectionLighting:true,closeup:{center:identity.position,extent:identity.size.width*1.45}};capture(old,'before-identification-close','ISOMETRIC',opt);capture(current,'after-identification-close','ISOMETRIC',opt);}
   const armor=current.productionDesign.armor.find(c=>c.role==='CITADEL')??current.productionDesign.armor[0];if(c.id.startsWith('yard-')&&armor){const center={x:(armor.bounds.min.x+armor.bounds.max.x)/2,y:armor.bounds.max.y,z:(armor.bounds.min.z+armor.bounds.max.z)/2},opt={inspectionLighting:true,closeup:{center,extent:Math.min(18,order.length*.1)}};capture(old,'before-armor-grain','TOP',opt);capture(current,'after-armor-grain','TOP',opt);}
   const repeated=r.capture(JSON.parse(JSON.stringify(current)),'COMPLETE','ISOMETRIC',{reviewLighting:true,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:order.length*1.2}});
   const iso=shots.find(s=>s.name==='after-ISOMETRIC');if(repeated.pixels!==iso.pixels)throw Error('Reload WebGL pixels changed');r.dispose();
   return{shots,geometryUnchanged:true,reloadPixels:true,kits:current.exteriorDetailPlan.kitPlacements.length,appearance:current.materialAppearance};
  },{...c,replayOnly:Boolean(process.env.REPLAY_REFERENCE)});
  await mkdir(out+'/'+c.id,{recursive:true});for(const s of result.shots){const path=`${out}/${c.id}/${s.name}.png`,pixels=png(s.pixels);if(process.env.REPLAY_REFERENCE)assert(pixels.equals(await readFile(path)),`Shipping pixels changed ${c.id}/${s.name}`);else await writeFile(path,pixels);}
  const shots=result.shots.map(({pixels,...s})=>s);if(process.env.REPLAY_REFERENCE){const previous=JSON.parse(await readFile(out+'/report.json','utf8')).rows.find(r=>r.case.id===c.id);shots.unshift(...previous.shots.filter(s=>s.name.startsWith('before-')));}
  rows.push({case:c,...result,shots,replayReferencePixels:process.env.REPLAY_REFERENCE?true:undefined});console.log(JSON.stringify({case:c.id,captures:result.shots.length}));
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({rows,errors,baseline:'8ead651434213b9ae707729006c711109fc5fc08',lighting:'Identical review/inspection rig, orthographic fixed physical scale; no bloom and no material override'},null,2));
}finally{await browser.close();}
