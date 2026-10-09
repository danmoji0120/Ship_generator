import{renderSession,png}from'./helpers/render-session.mjs';
import{mkdir,writeFile}from'node:fs/promises';
const out=process.env.UNIFIED_OUTPUT||'qa/v1.8.4/phase-a';await mkdir(out,{recursive:true});
const{browser,page,errors}=await renderSession();
try{
 const result=await page.evaluate(async()=>{
  const{generateBlueprint,DEFAULT_ORDER}=await import('/src/generation/generate.ts');const{ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
  const o=structuredClone(DEFAULT_ORDER);o.length=300;o.priorities={firepower:80,survivability:80,mobility:30,endurance:65,missile:60,sensor:45};
  const t=performance.now(),b=generateBlueprint(o,7,{architecture:'MONOLITHIC',family:'WEDGE_CITADEL'}),ms=performance.now()-t,r=new ArmorQARenderer(900),shots=[];
  for(const view of['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC','LOW-ISOMETRIC'])shots.push({view,shot:r.capture(b,'COMPLETE',view,{reviewLighting:true,underbodyLighting:view==='BOTTOM'||view==='LOW-ISOMETRIC',scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:360}})});r.dispose();
  return{json:JSON.stringify(b),ms,shots,armor:b.productionDesign.armor.length,finish:b.productionDesign.finish.length,coverage:b.productionDesign.coverage.directions};
 });
 for(const {view,shot}of result.shots)await writeFile(`${out}/${view}.png`,png(shot.pixels));
 await writeFile(`${out}/blueprint.json`,result.json);await writeFile(`${out}/report.json`,JSON.stringify({...result,json:undefined,shots:result.shots.map(({view,shot:{pixels,...metadata}})=>({view,...metadata})),errors},null,2));
 console.log(JSON.stringify({ms:result.ms,armor:result.armor,finish:result.finish,coverage:result.coverage,errors}));
}finally{await browser.close();}
