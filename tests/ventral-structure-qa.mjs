import {renderSession,png}from'./helpers/render-session.mjs';
import{readFile,mkdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const source='qa/v1.8.2/structural-pilot/refinement-02/pilot.blueprint.json';
const json=await readFile(source,'utf8');
const dir=process.env.VENTRAL_OUTPUT||'qa/v1.8.2/structural-pilot/ventral/iteration-01';
await mkdir(dir,{recursive:true});
const{browser,page,errors}=await renderSession();
try{
 const result=await page.evaluate(async json=>{
  const{buildVentralArmorReview}=await import('/src/generation/armor/structural-pilot/ventral.ts');
  const{validateBlueprint}=await import('/src/validation/validate.ts');
  const{ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
  const source=JSON.parse(json),b=buildVentralArmorReview(source),issues=validateBlueprint(b);
  if(issues.length)throw Error(issues.join('; '));
  const hide=b=>{const copy=structuredClone(b);copy.hardpoints=[];copy.structuralArmorPilot.mounts=[];copy.surfaceFeatures=[];copy.layeredArmor=undefined;return copy;};
  const before=hide(source),after=hide(b),renderer=new ArmorQARenderer(1200),shots=[];
  const options={neutral:true,reviewLighting:true,underbodyLighting:true,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:360}};
  for(const view of ['BOTTOM','LOW-ISOMETRIC','SIDE'])for(const[name,ship]of[['before',before],['structure',after],['mounted',b]])shots.push({name:`${name}-${view}`,shot:renderer.capture(ship,'COMPLETE',view,options)});
  const repeated=renderer.capture(hide(JSON.parse(JSON.stringify(b))),'COMPLETE','LOW-ISOMETRIC',options);
  renderer.dispose();
  return{blueprint:JSON.stringify(b),shots,report:{validation:b.structuralArmorPilot.validation,ventral:b.structuralArmorPilot.ventral,sourceUnchanged:JSON.stringify(source)===json,upperUnchanged:JSON.stringify(b.structuralArmorPilot.components.slice(0,source.structuralArmorPilot.components.length))===JSON.stringify(source.structuralArmorPilot.components),mountsUnchanged:JSON.stringify(b.hardpoints)===JSON.stringify(source.hardpoints)&&JSON.stringify(b.structuralArmorPilot.mounts)===JSON.stringify(source.structuralArmorPilot.mounts),jsonDeterminism:JSON.stringify(b)===JSON.stringify(buildVentralArmorReview(source)),webglDeterminism:repeated.pixels===shots.find(s=>s.name==='structure-LOW-ISOMETRIC').shot.pixels}};
 },json);
 for(const{name,shot}of result.shots)await writeFile(`${dir}/${name}.png`,png(shot.pixels));
 await writeFile(`${dir}/blueprint.json`,result.blueprint);
 await writeFile(`${dir}/report.json`,JSON.stringify({source,sourceSha256:createHash('sha256').update(json).digest('hex'),...result.report,shots:result.shots.map(({name,shot:{pixels,...shot}})=>({name,...shot})),errors},null,2));
 console.log(JSON.stringify({issues:result.report.validation.issues,source:result.report.sourceUnchanged,upper:result.report.upperUnchanged,mounts:result.report.mountsUnchanged,json:result.report.jsonDeterminism,pixels:result.report.webglDeterminism,levels:result.report.ventral.levels.map(l=>({id:l.id,depth:l.depth})),errors}));
 if(errors.length||!result.report.sourceUnchanged||!result.report.upperUnchanged||!result.report.mountsUnchanged||!result.report.jsonDeterminism||!result.report.webglDeterminism)throw Error('Ventral review failed');
}finally{await browser.close();}
