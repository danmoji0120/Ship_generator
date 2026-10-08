import {renderSession,png}from'./helpers/render-session.mjs';
import{readFile,mkdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const dir=process.env.VENTRAL_LIMITED_OUTPUT||'qa/v1.8.2/ventral-flow/limited-iteration-01';
const families=['WEDGE_CITADEL','HAMMERHEAD','ENGINE_DOMINANT'];
await mkdir(dir,{recursive:true});
const{browser,page,errors}=await renderSession();
try{
 const reports=[];
 for(const family of families){
  const source=`qa/v1.8.2/limited-families/final-review/${family}/blueprint.json`,json=await readFile(source,'utf8');
  const result=await page.evaluate(async json=>{
   const{buildLimitedVentralReview}=await import('/src/generation/armor/structural-pilot/ventral-limited.ts');
   const{validateBlueprint}=await import('/src/validation/validate.ts');
   const{ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
   const source=JSON.parse(json),b=buildLimitedVentralReview(source),issues=validateBlueprint(b);
   if(issues.length)throw Error(issues.join('; '));
   const hide=b=>{const copy=structuredClone(b);copy.hardpoints=[];copy.structuralArmorPilot.mounts=[];copy.surfaceFeatures=[];copy.layeredArmor=undefined;return copy;};
   const before=hide(source),after=hide(b),renderer=new ArmorQARenderer(1000),shots=[];
   const options={neutral:true,reviewLighting:true,underbodyLighting:true,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:480}};
   for(const view of ['BOTTOM','LOW-ISOMETRIC','SIDE'])for(const[name,ship]of[['before',before],['structure',after],['mounted',b]])shots.push({name:`${name}-${view}`,shot:renderer.capture(ship,'COMPLETE',view,options)});
   for(const view of ['TOP','ISOMETRIC'])shots.push({name:`structure-${view}`,shot:renderer.capture(after,'COMPLETE',view,{...options,underbodyLighting:false})});
   const repeated=renderer.capture(hide(JSON.parse(JSON.stringify(b))),'COMPLETE','LOW-ISOMETRIC',options);renderer.dispose();
   return{blueprint:JSON.stringify(b),shots,report:{validation:b.structuralArmorPilot.validation,ventral:b.structuralArmorPilot.ventral,sourceUnchanged:JSON.stringify(source)===json,upperUnchanged:JSON.stringify(b.structuralArmorPilot.components.slice(0,source.structuralArmorPilot.components.length))===JSON.stringify(source.structuralArmorPilot.components),mountsUnchanged:JSON.stringify(b.hardpoints)===JSON.stringify(source.hardpoints)&&JSON.stringify(b.structuralArmorPilot.mounts)===JSON.stringify(source.structuralArmorPilot.mounts),macroUnchanged:['macroDesign','structuralVolumes','structuralConnectors','engines','prefabPlacements','dimensions'].every(k=>JSON.stringify(b[k])===JSON.stringify(source[k])),jsonDeterminism:JSON.stringify(b)===JSON.stringify(buildLimitedVentralReview(source)),webglDeterminism:repeated.pixels===shots.find(s=>s.name==='structure-LOW-ISOMETRIC').shot.pixels}};
  },json);
  await mkdir(`${dir}/${family}`,{recursive:true});
  for(const{name,shot}of result.shots)await writeFile(`${dir}/${family}/${name}.png`,png(shot.pixels));
  await writeFile(`${dir}/${family}/blueprint.json`,result.blueprint);
  const report={family,source,sourceSha256:createHash('sha256').update(json).digest('hex'),...result.report,shots:result.shots.map(({name,shot:{pixels,...shot}})=>({name,...shot}))};reports.push(report);
  if(Object.entries(result.report).some(([k,v])=>/Unchanged|Determinism/.test(k)&&v!==true))throw Error(`Preservation/determinism ${family}`);
  console.log(JSON.stringify({family,issues:report.validation.issues,components:report.ventral.componentIds.length,levels:report.ventral.levels.map(l=>({id:l.id,depth:l.depth})),json:report.jsonDeterminism,pixels:report.webglDeterminism}));
 }
 await writeFile(`${dir}/report.json`,JSON.stringify({reports,errors},null,2));
 if(errors.length)throw Error('Browser console errors');
}finally{await browser.close();}
