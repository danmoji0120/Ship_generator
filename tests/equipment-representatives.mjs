import {renderSession,png} from './helpers/render-session.mjs';import {readFileSync,writeFileSync} from 'node:fs';
const dir='qa/v1.8.5.4.2';const {browser,page,errors}=await renderSession();const report=[];
for(const name of ['stacked-blocks','spinal-modules','truss-pods']){
 const b=JSON.parse(readFileSync(`${dir}/${name}.json`,'utf8'));
 const r=await page.evaluate(async ({b,name})=>{
  const {planEquipmentPreview}=await import('/src/equipment-preview/fitment.ts');const v=window.integrationQA.viewer;const slots=b.hardpoints.filter(h=>h.modular?.state==='EMPTY');
  // Prefer an actual long M battery; otherwise independently validated actual pair.
  const groups=new Map();for(const h of slots.filter(h=>h.size==='M'&&h.modular.region==='TOP'&&h.modular.batteryGroupId)){const id=h.modular.batteryGroupId;groups.set(id,[...(groups.get(id)??[]),h]);}
  const battery=[...groups.values()].sort((a,c)=>c.length-a.length)[0],single=slots.find(h=>h.size==='M'&&h.modular.region==='TOP'&&h.modular.pairId)??slots.find(h=>h.size==='M')??slots[0];
  const request={equipmentId:single.size==='S'?'gun-105':'gun-210',scope:battery?'BATTERY':single.modular.pairId?'PAIR':'SINGLE',slotId:battery?.[0].id??single.id};
  const plan=planEquipmentPreview(b,request),shots=[];
  for(const view of ['top','front','side','iso']){const before=await window.integrationQA.capture(b,view);v.setEquipmentPreview(plan);v.renderer.render(v.scene,v.camera);shots.push({name:`${name}-${view}-on`,pixels:v.renderer.domElement.toDataURL()},{name:`${name}-${view}-off`,pixels:before.pixels});}
  return {name,request,elapsedMs:plan.elapsedMs,geometryPreserved:JSON.stringify(b)===JSON.stringify(v.blueprint),results:plan.results.map(({parts,contacts,shots,...x})=>({...x,parts:parts.length,contacts:contacts.length})),shots};
 },{b,name});
 for(const shot of r.shots)writeFileSync(`${dir}/${shot.name}.png`,png(shot.pixels));delete r.shots;report.push(r);console.log(name,r.results.map(x=>x.status));
}
// Actual model close-up and OFF round trip / GPU resource accounting.
const b=JSON.parse(readFileSync('qa/v1.8.5.4.2/470-baseline.json','utf8'));
const extra=await page.evaluate(async b=>{
 const {planEquipmentPreview}=await import('/src/equipment-preview/fitment.ts'),v=window.integrationQA.viewer;
 const plan=planEquipmentPreview(b,{scope:'PAIR',slotId:'slot-22',equipmentId:'gun-406'});
 await window.integrationQA.capture(b);const t=b.hardpoints.find(h=>h.id==='slot-22').position;v.controls.target.set(t.x,t.y,t.z);v.camera.position.set(t.x+48,t.y+38,t.z-70);v.controls.update();v.renderer.render(v.scene,v.camera);const before=v.renderer.domElement.toDataURL();
 const baseline={...v.renderer.info.memory},offCalls=v.renderer.info.render.calls,offTriangles=v.renderer.info.render.triangles;
 v.setEquipmentPreview(plan,true);v.renderer.render(v.scene,v.camera);const closeup=v.renderer.domElement.toDataURL(),on={...v.renderer.info.memory},onCalls=v.renderer.info.render.calls,onTriangles=v.renderer.info.render.triangles;
 for(let i=0;i<8;i++){v.setEquipmentPreview();v.renderer.render(v.scene,v.camera);v.setEquipmentPreview(plan);v.renderer.render(v.scene,v.camera);}v.setEquipmentPreview();v.renderer.render(v.scene,v.camera);
 return {before,closeup,restored:v.renderer.domElement.toDataURL(),baseline,on,after:{...v.renderer.info.memory},offCalls,onCalls,offTriangles,onTriangles};
},b);for(const key of ['before','closeup','restored']){writeFileSync(`${dir}/large-${key}.png`,png(extra[key]));delete extra[key];}
writeFileSync(`${dir}/representatives-report.json`,JSON.stringify({report,lifecycle:extra,errors},null,2));console.log(extra,errors);await browser.close();
