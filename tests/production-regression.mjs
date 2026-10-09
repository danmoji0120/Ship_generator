import{renderSession,png}from'./helpers/render-session.mjs';import{mkdir,writeFile}from'node:fs/promises';
const out=process.env.OUT||'qa/v1.8.4/regression',thumbs=process.env.THUMBNAILS||'/tmp/shipyard-v184-thumbnails';await mkdir(out,{recursive:true});await mkdir(thumbs,{recursive:true});
const architectures=['MONOLITHIC','BLOCK_ASSEMBLY','SPINE_AND_MODULES','TRUSS_POD','TWIN_HULL','CORE_AND_NACELLES','STACKED_BLOCKS','HYBRID'];
const cases=architectures.flatMap(architecture=>Array.from({length:20},(_,seed)=>({architecture,seed,shipyardId:'aegis'}))).concat(['vesper','forge','serein'].flatMap(shipyardId=>Array.from({length:20},(_,seed)=>({architecture:'BLOCK_ASSEMBLY',seed,shipyardId}))));
const{browser,page,errors}=await renderSession();const rows=[];
try{for(const[index,c]of cases.entries()){
 const r=await page.evaluate(async(c)=>{const{generateBlueprint,DEFAULT_ORDER}=await import('/src/generation/generate.ts');const{validateBlueprint}=await import('/src/validation/validate.ts');const{ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
 const o={...structuredClone(DEFAULT_ORDER),shipyardId:c.shipyardId},t=performance.now();let phases;
 try{const b=generateBlueprint(o,c.seed,{architecture:c.architecture,onTimings:p=>phases=p}),ms=performance.now()-t,vt=performance.now(),issues=validateBlueprint(b),validationMs=performance.now()-vt,renderer=new ArmorQARenderer(320),shots=['ISOMETRIC','LOW-ISOMETRIC'].map(view=>({view,...renderer.capture(b,'COMPLETE',view,{reviewLighting:true,underbodyLighting:view==='LOW-ISOMETRIC',neutral:true,scale:'fit'})}));renderer.dispose();
 return{ok:!issues.length,ms,validationMs,phases,issues,family:b.macroDesign.family,composition:b.architecture.composition,armor:b.productionDesign.armor.length,finish:b.productionDesign.finish.length,coverage:b.productionDesign.coverage.directions,budget:b.weaponLayout.budget,omissions:b.weaponLayout.omissions.length,functional:b.productionDesign.functionalPrefabIds.length,retries:b.productionDesign.attempts.length,dimensions:b.dimensions,shots};}catch(e){return{ok:false,ms:performance.now()-t,error:e.message};}
 },c);for(const s of r.shots??[])await writeFile(`${thumbs}/${c.shipyardId}-${c.architecture}-${c.seed}-${s.view}.png`,png(s.pixels));rows.push({...c,...r,shots:r.shots?.map(({pixels,...data})=>data)});
 if((index+1)%20===0){await writeFile(`${out}/samples.json`,JSON.stringify({rows,errors},null,2));console.log(JSON.stringify({processed:index+1,failed:rows.filter(r=>!r.ok).length}));}
 }await writeFile(`${out}/samples.json`,JSON.stringify({rows,errors},null,2));}finally{await browser.close();}
if(rows.some(r=>!r.ok)||errors.length)process.exitCode=1;
