import {renderSession,png} from './helpers/render-session.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const out=process.env.OUT||'qa/v1.8.5/phase-a';await mkdir(out,{recursive:true});
const {browser,page,errors}=await renderSession();
try{
 const r=await page.evaluate(async()=>{const {generateBlueprint,DEFAULT_ORDER}=await import('/src/generation/generate.ts');const{ArmorQARenderer}=await import('/src/rendering/armor-qa.ts');const{validateExteriorDetails}=await import('/src/generation/details/validate.ts');const t=performance.now(),b=generateBlueprint(DEFAULT_ORDER,7),ms=performance.now()-t,renderer=new ArmorQARenderer(900),shots=[];
 const opts={reviewLighting:true,neutral:true,scale:'fixed',closeup:{center:{x:0,y:0,z:0},extent:360}};
 for(const view of['TOP','BOTTOM','LEFT','RIGHT','FRONT','AFT','ISOMETRIC','LOW-ISOMETRIC'])for(const mode of['OFF','HIGH'])shots.push({name:mode+'-'+view,...renderer.capture(b,'COMPLETE',view,{...opts,detailMode:mode,underbodyLighting:view==='BOTTOM'||view==='LOW-ISOMETRIC'})});
 for(const kind of['COMMAND','PROPULSION','WEAPON_PRIMARY','SERVICE_CHANNEL','ARMOR_JOINT','MANEUVERING','SENSOR','MISSILE_BAY']){const items=b.exteriorDetailPlan.kitPlacements.filter(p=>b.exteriorDetailPlan.detectedZones.find(z=>z.id===p.zoneId).kind===kind);if(!items.length)continue;const p=items[0],center=p.attachment.position,n=p.attachment.normal,viewDirection={x:n.x-.18,y:n.y+(Math.abs(n.y)<.65?.2:0),z:n.z-.22};for(const mode of['OFF','HIGH'])shots.push({name:kind+'-'+mode,...renderer.capture(b,'COMPLETE',kind==='SERVICE_CHANNEL'?'TOP':'ISOMETRIC',{reviewLighting:true,neutral:true,scale:'fixed',inspectionLighting:true,viewDirection,underbodyLighting:kind==='SERVICE_CHANNEL'||n.y<-.5,detailMode:mode,closeup:{center,extent:kind==='WEAPON_PRIMARY'?12:9}})});}
 const report={ms,issues:validateExteriorDetails(b),count:b.exteriorDetailPlan.kitPlacements.length,kits:b.exteriorDetailPlan.kitPlacements.map(p=>({id:p.id,kit:p.kit,zoneId:p.zoneId,position:p.attachment.position})),omissions:b.exteriorDetailPlan.decisions.filter(d=>d.status==='omitted')};renderer.dispose();return{shots,report,blueprint:JSON.stringify(b)};});
 for(const s of r.shots)await writeFile(`${out}/${s.name}.png`,png(s.pixels));await writeFile(`${out}/blueprint.json.gz`,gzipSync(r.blueprint));await writeFile(`${out}/report.json`,JSON.stringify({...r.report,errors},null,2));console.log(JSON.stringify({count:r.report.count,kits:r.report.kits.map(p=>p.kit),issues:r.report.issues,errors}));
}finally{await browser.close();}
