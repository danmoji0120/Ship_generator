import{renderSession,png}from'./helpers/render-session.mjs';
import{readFile,mkdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
const prior=await readFile('qa/v1.8.2/ventral-flow/seed7-final/blueprint.json','utf8');
const sourcePath='qa/v1.8.2/functional-exterior/final-review/blueprint.json',json=await readFile(sourcePath,'utf8');
const dir=process.env.WEAPON_OUTPUT||'qa/v1.8.3/iteration-01';await mkdir(dir,{recursive:true});
const{browser,page,errors}=await renderSession();
try{
 const r=await page.evaluate(async({json,prior})=>{
  const{buildWeaponLayoutReview}=await import('/src/generation/weapons/build.ts');
  const{validateBlueprint}=await import('/src/validation/validate.ts');
  const{ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
  const source=JSON.parse(json),start=performance.now();let timings;
  const b=buildWeaponLayoutReview(source,{onTimings:t=>timings=t}),generationMs=performance.now()-start;
  const issues=validateBlueprint(b);if(issues.length)throw Error(issues.join('; '));
  const renderer=new ArmorQARenderer(1200),shots=[],options={reviewLighting:true,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:360}};
  for(const view of['TOP','BOTTOM','LEFT','RIGHT','ISOMETRIC','LOW-ISOMETRIC'])for(const[name,ship,neutral]of[['before',source,false],['complete',b,false],['neutral',b,true]])shots.push({name:`${name}-${view}`,shot:renderer.capture(ship,'COMPLETE',view,{...options,neutral,underbodyLighting:view==='BOTTOM'||view==='LOW-ISOMETRIC'})});
  const l=b.weaponLayout.mounts.find(m=>m.standard.size==='L');
  shots.push({name:'L-closeup',shot:renderer.capture(b,'COMPLETE','ISOMETRIC',{...options,closeup:{center:l.position,extent:85}})});
  for(const view of['TOP','BOTTOM','ISOMETRIC'])shots.push({name:`layout-${view}`,shot:renderer.capture(b,'COMPLETE',view,{...options,weaponDebug:'LAYOUT',underbodyLighting:view==='BOTTOM'})});
  for(const view of['TOP','ISOMETRIC'])shots.push({name:`symmetry-${view}`,shot:renderer.capture(b,'COMPLETE',view,{...options,weaponDebug:'GROUPS'})});
  for(const view of['TOP','ISOMETRIC','LOW-ISOMETRIC'])shots.push({name:`arcs-${view}`,shot:renderer.capture(b,'COMPLETE',view,{...options,weaponDebug:'ARCS',underbodyLighting:view==='LOW-ISOMETRIC',closeup:{center:{x:0,y:0,z:0},extent:520}})});
  for(const view of['TOP','ISOMETRIC'])shots.push({name:`sizes-${view}`,shot:renderer.capture(b,'COMPLETE',view,{...options,sizeComparison:true,weaponDebug:'LAYOUT',closeup:{center:{x:0,y:0,z:-8},extent:140}})});
  for(const[region,view]of[['PORT','LEFT'],['BOTTOM','LOW-ISOMETRIC']]){const m=b.weaponLayout.mounts.find(m=>m.region===region&&m.standard.size==='M');shots.push({name:`mount-${region}`,shot:renderer.capture(b,'COMPLETE',view,{...options,underbodyLighting:region==='BOTTOM',closeup:{center:m.position,extent:65}})});}
  const noWeapons=structuredClone(b);noWeapons.hardpoints=[];noWeapons.prefabPlacements=noWeapons.prefabPlacements.filter(p=>!noWeapons.weaponLayout.prefabIds.includes(p.id));shots.push({name:'armor-no-weapons',shot:renderer.capture(noWeapons,'COMPLETE','ISOMETRIC',options)});
  const repeat=renderer.capture(JSON.parse(JSON.stringify(b)),'COMPLETE','ISOMETRIC',options);renderer.dispose();
  const again=buildWeaponLayoutReview(source);
  const{buildFunctionalExteriorReview}=await import('/src/generation/functional/build.ts');
  const baselineSource=JSON.parse(prior),oldTimes=[],newTimes=[],validationTimes=[],phases=[];
  for(let i=0;i<7;i++){let t=performance.now();buildFunctionalExteriorReview(baselineSource);oldTimes.push(performance.now()-t);t=performance.now();buildWeaponLayoutReview(source,{onTimings:p=>phases.push(p)});newTimes.push(performance.now()-t);t=performance.now();validateBlueprint(b);validationTimes.push(performance.now()-t);}
  const stats=a=>{const s=[...a].sort((a,b)=>a-b);return{samples:s,medianMs:s[3],p95Ms:s[6]};};
  const performanceReport={samples:7,baselineFunctionalAssembly:stats(oldTimes),newWeaponLayoutIncludingValidation:stats(newTimes),standaloneFullBlueprintValidation:stats(validationTimes),phases,scope:'warm Chromium SwiftShader, clone/assembly/resolution/validation; not default order generator or mobile GPU'};
  return{json:JSON.stringify(b),shots,report:{performance:performanceReport,sourceUnchanged:JSON.stringify(source)===json,armorUnchanged:['structuralVolumes','structuralConnectors','macroDesign','dimensions','structuralArmorPilot','engines','hullIntegration','materialTheme'].every(k=>JSON.stringify(source[k])===JSON.stringify(b[k])),armorFinishUnchanged:JSON.stringify(source.prefabPlacements.filter(p=>p.functionality==='protection'))===JSON.stringify(b.prefabPlacements.filter(p=>p.functionality==='protection')),jsonDeterminism:JSON.stringify(again)===JSON.stringify(b),webglDeterminism:repeat.pixels===shots.find(s=>s.name==='complete-ISOMETRIC').shot.pixels,generationMs,timings,validation:b.weaponLayout.validation,budget:b.weaponLayout.budget,mounts:b.weaponLayout.mounts.map(m=>({id:m.id,size:m.standard.size,region:m.region,group:m.groupId,position:m.position,normal:m.frame.normal,footprint:m.footprint.width,localBounds:m.equipment.localBounds})),attempts:b.weaponLayout.attempts,omissions:b.weaponLayout.omissions}};
 },{json,prior});
 for(const{name,shot}of r.shots)await writeFile(`${dir}/${name}.png`,png(shot.pixels));
 await writeFile(`${dir}/blueprint.json`,r.json);await writeFile(`${dir}/report.json`,JSON.stringify({sourcePath,sourceSha256:createHash('sha256').update(json).digest('hex'),...r.report,shots:r.shots.map(({name,shot:{pixels,...data}})=>({name,...data})),errors},null,2));
 console.log(JSON.stringify({mounts:r.report.mounts.length,regions:r.report.budget.byRegion,issues:r.report.validation.issues,omissions:r.report.omissions.length,timings:r.report.timings,armor:r.report.armorUnchanged,json:r.report.jsonDeterminism,pixels:r.report.webglDeterminism,errors}));
 if(errors.length||!r.report.armorUnchanged||!r.report.armorFinishUnchanged||!r.report.jsonDeterminism||!r.report.webglDeterminism)throw Error('Weapon layout QA failed');
}finally{await browser.close();}
