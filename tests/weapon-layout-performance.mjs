// Run after test workers/capture jobs finish to avoid profiling their CPU contention.
import {renderSession} from './helpers/render-session.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const source=await readFile('qa/v1.8.2/functional-exterior/final-review/blueprint.json','utf8');
const prior=await readFile('qa/v1.8.2/ventral-flow/seed7-final/blueprint.json','utf8');
const {browser,page,errors}=await renderSession();
try{
 const result=await page.evaluate(async({source,prior})=>{
  const {buildWeaponLayoutReview}=await import('/src/generation/weapons/build.ts');
  const {buildFunctionalExteriorReview}=await import('/src/generation/functional/build.ts');
  const {validateBlueprint}=await import('/src/validation/validate.ts');
  const a=JSON.parse(source),p=JSON.parse(prior),b=buildWeaponLayoutReview(a),old=[],fresh=[],validation=[],phases=[];
  buildFunctionalExteriorReview(p);validateBlueprint(b);
  for(let i=0;i<7;i++){
   let t=performance.now();buildFunctionalExteriorReview(p);old.push(performance.now()-t);
   t=performance.now();buildWeaponLayoutReview(a,{onTimings:t=>phases.push(t)});fresh.push(performance.now()-t);
   t=performance.now();if(validateBlueprint(b).length)throw Error('Invalid performance specimen');validation.push(performance.now()-t);
  }
  const stats=a=>{const samples=a.sort((a,b)=>a-b);return{samples,medianMs:samples[3],observedP95Ms:samples[6]};};
  return {environment:'Chromium SwiftShader; no concurrent tests/capture jobs; 7 warm paired runs',baselineFunctionalAssembly:stats(old),newWeaponLayoutIncludingValidation:stats(fresh),standaloneFullBlueprintValidation:stats(validation),phases};
 },{source,prior});
 const dir=process.env.WEAPON_OUTPUT||'qa/v1.8.3/final-review';await mkdir(dir,{recursive:true});
 await writeFile(`${dir}/performance.json`,JSON.stringify({...result,consoleErrors:errors},null,2));
 if(errors.length)throw Error(errors.join('; '));
 console.log(JSON.stringify(Object.fromEntries(Object.entries(result).filter(([,v])=>v?.medianMs!==undefined).map(([k,v])=>[k,{medianMs:v.medianMs,observedP95Ms:v.observedP95Ms}]))));
}finally{await browser.close();}
