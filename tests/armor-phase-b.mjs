import {renderSession,png} from './helpers/render-session.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const {browser,page,errors}=await renderSession();
const dir='qa/v1.8.1/initial';await mkdir(dir,{recursive:true});
try {
 await page.evaluate(async()=>{const {ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');window.armorRenderer=new ArmorQARenderer(600);});
 const report=[];
 for(const [family,architecture] of [['WEDGE_CITADEL','MONOLITHIC'],['HAMMERHEAD','BLOCK_ASSEMBLY'],['WIDE_CARRIER','BLOCK_ASSEMBLY']]) {
 const r=await page.evaluate(({family,architecture})=>{const b=window.integrationQA.generate({...window.integrationQA.order,shipyardId:'aegis'},7,{family,architecture});return {blueprintJson:JSON.stringify(b),shots:['HULL_ONLY','PRIMARY','SECONDARY','COMPLETE'].map(stage=>window.armorRenderer.capture(b,stage,'ISOMETRIC',{neutral:true,scale:'fit'}))};},{family,architecture});
 r.b=JSON.parse(r.blueprintJson);
 await writeFile(`${dir}/${family}.json`,JSON.stringify(r.b,null,2));
 for(const shot of r.shots) await writeFile(`${dir}/${family}-${shot.stage}.png`,png(shot.pixels));
 report.push({family,counts:r.b.layeredArmor.budget,decisions:r.b.layeredArmor.decisions});
 }
 await writeFile(`${dir}/report.json`,JSON.stringify({errors,report},null,2));console.log(report.map(r=>({family:r.family,counts:r.counts,omitted:r.decisions.filter(d=>d.status==='omitted').length})));
}finally{await browser.close();}
