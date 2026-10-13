import {renderSession,png} from './helpers/render-session.mjs';import {readFileSync,writeFileSync} from 'node:fs';
const {browser,page,errors}=await renderSession(),dir='qa/v1.8.5.5';const report=[];
try{
 for(const name of ['470','stacked-blocks','spinal-modules','truss-pods']){
 const before=JSON.parse(readFileSync(`${dir}/${name}.json`,'utf8')),after=JSON.parse(readFileSync(`${dir}/${name}-equipped.json`,'utf8'));
 const result=await page.evaluate(async({before,after,name})=>{
  const shots=[],v=window.integrationQA.viewer;
  const close=async(b,pose)=>{await window.integrationQA.capture(b);v.controls.minDistance=.1;v.camera.position.set(...pose.position);v.controls.target.set(...pose.target);v.camera.near=.1;v.camera.far=2000;v.camera.updateProjectionMatrix();v.controls.update();v.renderer.render(v.scene,v.camera);return{pixels:v.renderer.domElement.toDataURL()};};
  for(const view of ['top','front','side','iso']){
   const a=await window.integrationQA.capture(before,view),b=await window.integrationQA.capture(after,view,a.pose);shots.push({name:`${name}-${view}-before`,pixels:a.pixels},{name:`${name}-${view}-after`,pixels:b.pixels});
  }
  const entry=after.freeMountPlan.entries.find(e=>e.equipmentId==='test-pod');
  if(entry){const p=entry.platform.position;const pose={position:[p.x+14,p.y+8,p.z-10],target:[p.x,p.y,p.z],near:.1,far:2000};for(const [label,b]of [['before',before],['after',after]]){const s=await close(b,pose);shots.push({name:`${name}-pylon-${label}`,pixels:s.pixels});}}
  const details=[];if(name==='470')for(const [label,pick]of [['main-gun',e=>e.equipmentId==='gun-500'],['side-missile',e=>e.equipmentId==='missile-medium']]){const e=after.freeMountPlan.entries.find(pick);if(e){const p=e.platform.position,pose={position:label==='main-gun'?[p.x-60,p.y+38,p.z-55]:[p.x-15,p.y+10,p.z-12],target:[p.x,p.y,p.z],near:.1,far:2000};const s=await close(after,pose);shots.push({name:label+'-closeup',pixels:s.pixels});details.push({name:label,type:e.platform.kind});}}
  await window.integrationQA.capture(before);const off={...v.renderer.info.render,memory:{...v.renderer.info.memory}};await window.integrationQA.capture(after);const on={...v.renderer.info.render,memory:{...v.renderer.info.memory}};
  const serialized=JSON.stringify(after),reload=await window.integrationQA.capture(JSON.parse(serialized));const saved=await window.integrationQA.capture(after, 'iso',reload.pose);
  return{shots,off,on,details,reloadPixelsEqual:reload.pixels===saved.pixels,jsonUnchanged:JSON.stringify(after)===serialized};
 },{before,after,name});for(const s of result.shots)writeFileSync(`${dir}/${s.name}.png`,png(s.pixels));delete result.shots;report.push({name,...result});console.log(name,result.off.calls,result.on.calls,result.on.triangles,result.reloadPixelsEqual);
 }
 writeFileSync(`${dir}/render-report.json`,JSON.stringify({report,errors},null,2));
}finally{await browser.close();}
