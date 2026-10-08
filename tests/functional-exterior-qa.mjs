import{renderSession,png}from'./helpers/render-session.mjs';
import{readFile,mkdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const source='qa/v1.8.2/ventral-flow/seed7-final/blueprint.json',json=await readFile(source,'utf8');
const dir=process.env.FUNCTIONAL_OUTPUT||'qa/v1.8.2/functional-exterior/iteration-01';await mkdir(dir,{recursive:true});
const{browser,page,errors}=await renderSession();
try{
 const result=await page.evaluate(async json=>{
  const{buildFunctionalExteriorReview}=await import('/src/generation/functional/build.ts');
  const{validateBlueprint}=await import('/src/validation/validate.ts');
  const{ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
  const source=JSON.parse(json),start=performance.now(),b=buildFunctionalExteriorReview(source),generationMs=performance.now()-start;
  const issues=validateBlueprint(b);if(issues.length)throw Error(issues.join('; '));
  const renderer=new ArmorQARenderer(1200),shots=[];
  const opts={reviewLighting:true,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:360}};
  for(const view of['TOP','SIDE','ISOMETRIC','BOTTOM','LOW-ISOMETRIC']){
   const options={...opts,underbodyLighting:view==='BOTTOM'||view==='LOW-ISOMETRIC'};
   for(const[name,ship,neutral]of[['before',source,false],['before-neutral',source,true],['complete',b,false],['neutral',b,true]])shots.push({name:`${name}-${view}`,shot:renderer.capture(ship,'COMPLETE',view,{...options,neutral})});
  }
  for(const[name,view,center,extent]of[
   ['weapon-closeup','ISOMETRIC',{x:14,y:47,z:-26},58],
   ['command-closeup','ISOMETRIC',{x:0,y:60,z:81},62],
   ['drive-closeup','AFT',{x:0,y:0,z:147},90],
   ['maintenance-closeup','ISOMETRIC',{x:-43,y:30,z:-15},70],
   ['ventral-pocket-closeup','LOW-ISOMETRIC',{x:45,y:-30,z:10},70]
  ])shots.push({name,shot:renderer.capture(b,'COMPLETE',view,{...opts,underbodyLighting:name.includes('ventral'),closeup:{center,extent}})});
  const repeat=renderer.capture(JSON.parse(JSON.stringify(b)),'COMPLETE','ISOMETRIC',opts);
  const noMounts=structuredClone(b);noMounts.hardpoints=[];noMounts.structuralArmorPilot.mounts=[];noMounts.prefabPlacements=noMounts.prefabPlacements.filter(p=>!p.assembly?.equipmentIds.some(id=>b.hardpoints.some(h=>h.id===id)));
  shots.push({name:'complete-no-hardpoints',shot:renderer.capture(noMounts,'COMPLETE','ISOMETRIC',opts)});
  renderer.dispose();
  const timings=[];for(let i=0;i<7;i++){const t=performance.now();buildFunctionalExteriorReview(source);timings.push(performance.now()-t);}timings.sort((a,b)=>a-b);
  return{blueprint:JSON.stringify(b),shots,report:{validation:b.functionalExterior.validation,generationMs,assemblyTiming:{samples:7,medianMs:timings[3],p95Ms:timings[6],includes:'clone + functional assembly + full functional validation; not whole order generation'},kitCount:b.functionalExterior.prefabIds.length,partCount:b.prefabPlacements.filter(p=>p.assembly).reduce((s,p)=>s+p.assembly.parts.length,0),finish:b.functionalExterior.armorFinish,serviceRegions:b.functionalExterior.serviceRegions,sourceUnchanged:JSON.stringify(source)===json,structurePreserved:['structuralVolumes','structuralConnectors','macroDesign','dimensions','structuralArmorPilot','hardpoints','engines','hullIntegration','materialTheme'].every(k=>JSON.stringify(source[k])===JSON.stringify(b[k])),existingPrefabsPreserved:JSON.stringify(b.prefabPlacements.slice(0,source.prefabPlacements.length))===JSON.stringify(source.prefabPlacements),noMountArmorPreserved:JSON.stringify(noMounts.structuralArmorPilot.components)===JSON.stringify(b.structuralArmorPilot.components)&&JSON.stringify(noMounts.prefabPlacements.filter(p=>p.functionality==='protection'))===JSON.stringify(b.prefabPlacements.filter(p=>p.functionality==='protection')),jsonDeterminism:JSON.stringify(buildFunctionalExteriorReview(source))===JSON.stringify(b),webglDeterminism:repeat.pixels===shots.find(s=>s.name==='complete-ISOMETRIC').shot.pixels}};
 },json);
 for(const{name,shot}of result.shots)await writeFile(`${dir}/${name}.png`,png(shot.pixels));
 await writeFile(`${dir}/blueprint.json`,result.blueprint);
 await writeFile(`${dir}/report.json`,JSON.stringify({source,sourceSha256:createHash('sha256').update(json).digest('hex'),...result.report,shots:result.shots.map(({name,shot:{pixels,...shot}})=>({name,...shot})),errors},null,2));
 console.log(JSON.stringify({issues:result.report.validation.issues,kits:result.report.kitCount,parts:result.report.partCount,generationMs:result.report.generationMs,source:result.report.sourceUnchanged,structure:result.report.structurePreserved,prefabs:result.report.existingPrefabsPreserved,json:result.report.jsonDeterminism,pixels:result.report.webglDeterminism,errors}));
 if(errors.length||Object.entries(result.report).some(([k,v])=>/Unchanged|Preserved|Determinism/.test(k)&&v!==true))throw Error('Functional exterior QA failed');
}finally{await browser.close();}
