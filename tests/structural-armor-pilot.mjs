import { renderSession,png } from './helpers/render-session.mjs';
import { mkdir,writeFile } from 'node:fs/promises';
const dir=process.env.PILOT_OUTPUT||'qa/v1.8.2/structural-pilot/review';
await mkdir(dir,{recursive:true});
const {browser,page,errors}=await renderSession();
try {
 const result=await page.evaluate(async()=>{
  const {generateBlueprintV181}=await import('/src/generation/generate.ts');
  const {buildStructuralArmorPilot}=await import('/src/generation/armor/structural-pilot/build.ts');
  const {validateBlueprint}=await import('/src/validation/validate.ts');
  const {ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
  const o={...window.integrationQA.order,shipyardId:'aegis'};
  const before=generateBlueprintV181(o,7,{architecture:'MONOLITHIC',family:'WEDGE_CITADEL'});
  const pilot=buildStructuralArmorPilot(before);
  const repeat=buildStructuralArmorPilot(before);
  const blueprintErrors=validateBlueprint(pilot);
  if(blueprintErrors.length)throw Error(blueprintErrors.join(';'));
  const cleanBefore=structuredClone(before);delete cleanBefore.layeredArmor;cleanBefore.hardpoints=[];cleanBefore.surfaceFeatures=[];
  cleanBefore.prefabPlacements=cleanBefore.prefabPlacements.filter(p=>!['WEAPON_FOUNDATION','MACHINERY_HOUSING','ARMOR_ENVELOPE'].includes(p.kind));
  const structure=structuredClone(pilot);structure.hardpoints=[];structure.structuralArmorPilot.mounts=[];
  const renderer=new ArmorQARenderer(1000),shots=[];
  for(const view of ['TOP','SIDE','ISOMETRIC'])for(const[name,b]of [['before',cleanBefore],['structure',structure],['mounted',pilot]])
    shots.push({name:`${name}-${view}`,shot:renderer.capture(b,'COMPLETE',view,{neutral:true,scale:'fixed',reviewLighting:true,closeup:{center:{x:0,y:0,z:0},extent:360}})});
  const repeated=renderer.capture(JSON.parse(JSON.stringify(pilot)),'COMPLETE','ISOMETRIC',{neutral:true,scale:'fixed',reviewLighting:true,closeup:{center:{x:0,y:0,z:0},extent:360}});
  const stablePixels=shots.find(s=>s.name==='mounted-ISOMETRIC').shot.pixels===repeated.pixels;
  renderer.dispose();
  return{shots,blueprint:JSON.stringify(pilot),validation:pilot.structuralArmorPilot.validation,determinism:JSON.stringify(pilot)===JSON.stringify(repeat),stablePixels};
 });
 for(const {name,shot}of result.shots)await writeFile(`${dir}/${name}.png`,png(shot.pixels));
 await writeFile(`${dir}/pilot.blueprint.json`,result.blueprint);
 await writeFile(`${dir}/report.json`,JSON.stringify({validation:result.validation,determinism:result.determinism,stablePixels:result.stablePixels,views:result.shots.map(s=>({name:s.name,...s.shot,pixels:undefined})),errors},null,2));
 console.log(JSON.stringify({shots:result.shots.length,validation:result.validation,determinism:result.determinism,stablePixels:result.stablePixels,errors}));
 if(errors.length||!result.determinism||!result.stablePixels)throw Error('Pilot QA failed');
}finally{await browser.close();}
