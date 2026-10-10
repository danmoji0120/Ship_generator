import {renderSession,png} from './helpers/render-session.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const dir='qa/v1.8.5.4.2';mkdirSync(dir,{recursive:true});
const b=JSON.parse(readFileSync('qa/v1.8.5.4.2/470-baseline.json','utf8'));
const {browser,page,errors}=await renderSession();
const report=await page.evaluate(async b=>{
 const {planEquipmentPreview}=await import('/src/equipment-preview/fitment.ts');
 const {diagnoseXLSlots}=await import('/src/generation/hardpoint-system/planner.ts');
 const v=window.integrationQA.viewer;
 const shots=[];await window.integrationQA.capture(b);
 const single=b.hardpoints.find(h=>h.modular?.state==='EMPTY'&&h.size==='M'&&h.modular.region==='TOP');
 const battery=b.hardpoints.find(h=>h.modular?.state==='EMPTY'&&h.size==='M'&&h.modular.region==='TOP'&&h.modular.batteryGroupId);
 const requests=[{name:'pair',scope:'PAIR',slotId:single.id,equipmentId:'gun-210'},{name:'battery',scope:'BATTERY',slotId:battery.id,equipmentId:'gun-210'},{name:'missile',scope:'PAIR',slotId:single.id,equipmentId:'missile-medium'},{name:'refined',scope:'BATTERY',slotId:battery.id,equipmentId:'gun-210',refineBattery:true},{name:'large',scope:'PAIR',slotId:'slot-22',equipmentId:'gun-406'},{name:'auto',scope:'AUTO',equipmentId:'gun-210'}];
 const plans=[];
 for(const r of requests){const plan=planEquipmentPreview(b,r);plans.push({name:r.name,elapsedMs:plan.elapsedMs,batteryRefinement:plan.batteryRefinement,omissions:plan.omissions,results:plan.results.map(({parts,shots,contacts,...x})=>({...x,parts:parts.length,contacts:contacts.length}))});
  console.log('FIT',r.name,plan.elapsedMs);
  for(const view of ['auto','refined','large'].includes(r.name)?['top','front','side','iso']:['iso']){
   const before=await window.integrationQA.capture(b,view);
   v.setEquipmentPreview(plan,false);v.renderer.render(v.scene,v.camera);
   shots.push({name:`470-${r.name}-${view}`,pixels:v.renderer.domElement.toDataURL()});
   if(r.name==='auto'){shots.push({name:`470-off-${view}`,pixels:before.pixels});v.setEquipmentPreview();v.renderer.render(v.scene,v.camera);shots.push({name:`470-restored-${view}`,pixels:v.renderer.domElement.toDataURL()});}
  }
  if(r.name==='battery'){v.setEquipmentPreview(plan,true);v.renderer.render(v.scene,v.camera);shots.push({name:'470-battery-arcs',pixels:v.renderer.domElement.toDataURL()});}
 }
 return {shots,plans,xl:diagnoseXLSlots(b),canonicalStable:JSON.stringify(b)===JSON.stringify(v.blueprint)};
},b);
for(const s of report.shots)writeFileSync(`${dir}/${s.name}.png`,png(s.pixels));delete report.shots;
writeFileSync(`${dir}/render-report.json`,JSON.stringify({...report,errors},null,2));console.log(report.plans.map(p=>({name:p.name,ms:p.elapsedMs,counts:p.results.reduce((c,r)=>(c[r.status]=(c[r.status]??0)+1,c),{})})),errors);await browser.close();
