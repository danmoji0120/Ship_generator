import {renderSession,png} from './helpers/render-session.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// Capture stored, reviewed geometry. Do not regenerate or change armor/hardpoint placement.
const source='qa/v1.8.2/structural-pilot/refinement-02/pilot.blueprint.json';
const json=await readFile(source,'utf8');
const dir=process.env.UNDERBODY_OUTPUT||'qa/v1.8.2/structural-pilot/underbody-review';
const underbodyLighting=process.env.UNDERBODY_LIGHTING==='1';
await mkdir(dir,{recursive:true});
const {browser,page,errors}=await renderSession();
try{
 const shots=await page.evaluate(async ({json,underbodyLighting})=>{
  const {ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');
  const b=JSON.parse(json),renderer=new ArmorQARenderer(1200);
  const options={neutral:true,reviewLighting:true,underbodyLighting,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:360}};
  const shots=['BOTTOM','LOW-ISOMETRIC','SIDE'].map(view=>renderer.capture(b,'COMPLETE',view,options));
  renderer.dispose();return shots;
 },{json,underbodyLighting});
 for(const shot of shots)await writeFile(`${dir}/${shot.view}.png`,png(shot.pixels));
 await writeFile(`${dir}/report.json`,JSON.stringify({source,sourceSha256:createHash('sha256').update(json).digest('hex'),seed:7,family:'WEDGE_CITADEL',geometryModified:false,hardpointsVisible:true,neutral:true,underbodyLighting,views:shots.map(({pixels,...s})=>s),errors},null,2));
 console.log(JSON.stringify({captured:shots.map(s=>s.view),errors,geometryModified:false}));
 if(errors.length)throw Error('Browser errors during capture');
}finally{await browser.close();}
