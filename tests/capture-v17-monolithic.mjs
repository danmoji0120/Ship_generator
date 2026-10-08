import { renderSession,png } from './helpers/render-session.mjs';
import { readFile,writeFile,access } from 'node:fs/promises';
const dir='qa/v1.8/before',manifest=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8'));
const {browser,page,errors}=await renderSession();try{
for(const seed of [0,7,13]){
 const key=`forge-MONOLITHIC-${seed}`;
 if(manifest.result.some(r=>r.architecture==='MONOLITHIC'&&r.seed===seed))continue;
 const b=await page.evaluate(seed=>window.integrationQA.generate({...window.integrationQA.order,shipyardId:'forge'},seed,{architecture:'MONOLITHIC',version:'1.7'}),seed),shot=await page.evaluate(async b=>window.integrationQA.capture(b),b);
 await writeFile(`${dir}/${key}.json`,JSON.stringify(b,null,2));await writeFile(`${dir}/${key}.png`,png(shot.pixels));manifest.result.push({yard:'forge',architecture:'MONOLITHIC',seed,pose:shot.pose,diagnostics:shot.diagnostics});
}if(errors.length)throw Error(errors.join('\n'));await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2));console.log('V1.7 Monolithic reference JSON / PNG / poses added without overwriting Block baselines');
}finally{await browser.close();}
