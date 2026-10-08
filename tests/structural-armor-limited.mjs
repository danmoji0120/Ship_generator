import {renderSession,png}from'./helpers/render-session.mjs';
import{mkdir,writeFile}from'node:fs/promises';
const dir=process.env.LIMITED_OUTPUT||'qa/v1.8.2/limited-families/iteration-01';
await mkdir(dir,{recursive:true});
const{browser,page,errors}=await renderSession();
try{
 await page.evaluate(async()=>{const{ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');window.structuralRenderer=new ArmorQARenderer(1000);});
 const reports=[];
 for(const[architecture,family]of[['MONOLITHIC','WEDGE_CITADEL'],['BLOCK_ASSEMBLY','HAMMERHEAD'],['CORE_AND_NACELLES','ENGINE_DOMINANT']]){
  if(process.env.LIMITED_FAMILY&&process.env.LIMITED_FAMILY!==family)continue;
  const r=await page.evaluate(async({architecture,family})=>{
   const{generateBlueprintV181}=await import('/src/generation/generate.ts');const{buildLimitedStructuralArmor}=await import('/src/generation/armor/structural-pilot/limited.ts');
   const{validateBlueprint}=await import('/src/validation/validate.ts');
   const source=generateBlueprintV181({...window.integrationQA.order,shipyardId:'aegis'},7,{architecture,family});
   const b=buildLimitedStructuralArmor(source),issues=validateBlueprint(b);
   if(issues.length)throw Error(issues.join('; '));
   const structure=structuredClone(b);structure.hardpoints=[];structure.structuralArmorPilot.mounts=[];
   const baseline=structuredClone(source);baseline.layeredArmor=undefined;baseline.hardpoints=[];baseline.surfaceFeatures=[];
   baseline.prefabPlacements=baseline.prefabPlacements.filter(p=>!b.structuralArmorPilot.supersededPrefabIds.includes(p.id));
   const options={neutral:true,reviewLighting:true,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:480}},shots=[];
   for(const view of ['TOP','SIDE','ISOMETRIC'])for(const[name,blueprint]of[['baseline',baseline],['structure',structure],['mounted',b]])shots.push({name:`${name}-${view}`,shot:window.structuralRenderer.capture(blueprint,'COMPLETE',view,options)});
   const repeat=buildLimitedStructuralArmor(source),pixelRepeat=window.structuralRenderer.capture(JSON.parse(JSON.stringify(b)),'COMPLETE','ISOMETRIC',options);
   return{blueprint:JSON.stringify(b),shots,report:{family,architecture,seed:7,components:b.structuralArmorPilot.components.length,channels:b.structuralArmorPilot.channels.map(c=>({id:c.id,width:c.width,depth:c.depth})),joints:b.structuralArmorPilot.joints.length,validation:b.structuralArmorPilot.validation,jsonDeterminism:JSON.stringify(b)===JSON.stringify(repeat),webglDeterminism:pixelRepeat.pixels===shots.find(s=>s.name==='mounted-ISOMETRIC').shot.pixels}};
  },{architecture,family});
  await mkdir(`${dir}/${family}`,{recursive:true});
  for(const{name,shot}of r.shots)await writeFile(`${dir}/${family}/${name}.png`,png(shot.pixels));
  await writeFile(`${dir}/${family}/blueprint.json`,r.blueprint);await writeFile(`${dir}/${family}/report.json`,JSON.stringify({...r.report,views:r.shots.map(s=>({name:s.name,...s.shot,pixels:undefined}))},null,2));
  reports.push(r.report);console.log(JSON.stringify({family,components:r.report.components,joints:r.report.joints,issues:r.report.validation.issues,json:r.report.jsonDeterminism,pixels:r.report.webglDeterminism}));
 }
 await writeFile(`${dir}/report.json`,JSON.stringify({cases:reports,errors},null,2));
 if(errors.length||reports.some(r=>!r.jsonDeterminism||!r.webglDeterminism))throw Error('Limited-family QA failed');
 console.log('PASS: three fixed representative designs, console errors:',errors.length);
}finally{await browser.close();}
