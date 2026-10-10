import {renderSession,png} from './helpers/render-session.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out='qa/v1.8.5.3/engine-root';await mkdir(out,{recursive:true});
const {browser,page,errors}=await renderSession();
try {
 const result=await page.evaluate(async()=>{
  const {generateBlueprint,DEFAULT_ORDER}=await import('/src/generation/generate.ts');
  const {validateBlueprint}=await import('/src/validation/validate.ts');
  const {ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
  const rows=[];let capture;
  for(const shipyardId of ['vesper','forge','serein'])for(const length of [120,300,600])for(const seed of [0,13]){
   const order={...structuredClone(DEFAULT_ORDER),shipyardId,length,role:'Patrol Ship',priorities:{firepower:10,survivability:30,mobility:85,endurance:40,missile:10,sensor:40}};
   try {
    const b=generateBlueprint(order,seed,{architecture:'CORE_AND_NACELLES',family:'ENGINE_DOMINANT'}),p=b.mesoStructurePlan,roots=p.placements.filter(p=>p.kind==='ENGINE_ROOT_TRANSITION'),zones=new Set(p.detectedZones.filter(z=>z.kind==='PROPULSION_ROOT').map(z=>z.id));
    const issues=validateBlueprint(b);if(issues.length)throw Error(issues.join('; '));
    rows.push({shipyardId,length,seed,accepted:roots.map(p=>({id:p.id,size:p.parameters,parent:p.parentStructureId})),rootDecisions:p.decisions.filter(d=>zones.has(d.zoneId))});
    if(roots.length){const r=new ArmorQARenderer(900);capture={...r.capture(b,'COMPLETE','ISOMETRIC',{reviewLighting:true,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:length*1.2}}),shipyardId,length,seed};r.dispose();return {rows,capture};}
   }catch(e){rows.push({shipyardId,length,seed,rejection:e.message});}
  }
  return {rows};
 });
 if(result.capture)await writeFile(out+'/accepted.png',png(result.capture.pixels));
 await writeFile(out+'/report.json',JSON.stringify({rows:result.rows,acceptedExample:Boolean(result.capture),errors},null,2));
 console.log(JSON.stringify({cases:result.rows.length,acceptedExample:Boolean(result.capture),errors}));
}finally{await browser.close();}
