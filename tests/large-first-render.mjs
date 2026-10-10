import {renderSession,png} from './helpers/render-session.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const dir='qa/v1.8.5.4.1';await mkdir(dir,{recursive:true});
const {browser,page,errors}=await renderSession();
try{
const bs=await Promise.all(['1.8.5.4','1.8.5.4.1'].map(v=>readFile(`${dir}/${v}.json`,'utf8').then(JSON.parse)));
bs[1]=await page.evaluate(async old=>{
 const {addModularHardpoints}=await import('/src/generation/hardpoint-system/planner.ts');
 const b=structuredClone(old);b.hardpoints=b.hardpoints.filter(h=>h.modular?.state==='OCCUPIED');for(const h of b.hardpoints)delete h.modular;delete b.modularHardpoints;return addModularHardpoints(b);
},bs[0]);
await writeFile(`${dir}/1.8.5.4.1.json`,JSON.stringify(bs[1]));
const report={errors,layouts:bs.map(b=>({summary:b.modularHardpoints.summary,diagnostics:b.modularHardpoints.diagnostics,pairs:new Set(b.hardpoints.flatMap(h=>h.modular?.pairId?[h.modular.pairId]:[])).size,batteries:new Set(b.hardpoints.flatMap(h=>h.modular?.batteryGroupId?[h.modular.batteryGroupId]:[])).size,emptyTop:Object.fromEntries(['S','M','L','XL'].map(size=>[size,b.hardpoints.filter(h=>h.modular?.state==='EMPTY'&&h.modular.region==='TOP'&&h.size===size).length]))}))};
for(const [i,b] of bs.entries())for(const mode of ['Normal','Hardpoints','Hardpoint Layout Only'])for(const view of ['top','iso']){
 const f=await page.evaluate(async({b,mode,view})=>window.integrationQA.capture(b,view,undefined,mode),{b,mode,view});
 await writeFile(`${dir}/${i?'after':'before'}-${mode.replaceAll(' ','-')}-${view}.png`,png(f.pixels));
 report[`${i}-${mode}-${view}`]=f.diagnostics;
 if(mode==='Normal')report[`${view}-normal-${i}`]=f.pixels;
}
report.normalEqual=['top','iso'].every(v=>report[`${v}-normal-0`]===report[`${v}-normal-1`]);
for(const k of Object.keys(report))if(k.includes('normal-'))delete report[k];
await writeFile(`${dir}/render-report.json`,JSON.stringify(report,null,2));
console.log('normal identical',report.normalEqual,'console errors',errors);
}finally{await browser.close();}
