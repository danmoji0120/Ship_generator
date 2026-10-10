import {renderSession,png} from './helpers/render-session.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='qa/v1.8.5.4.1';const {browser,page,errors}=await renderSession();
try{
 for(const [i,v] of ['1.8.5.4','1.8.5.4.1'].entries()){
  const b=JSON.parse(await readFile(`${dir}/${v}.json`,'utf8'));
  const f=await page.evaluate(async b=>{const saved=JSON.stringify(b),copy=structuredClone(b);copy.hardpoints=copy.hardpoints.filter(h=>h.modular.region==='TOP');const f=await window.integrationQA.capture(copy,'top',undefined,'Hardpoint Layout Only');return {pixels:f.pixels,unchanged:JSON.stringify(b)===saved};},b);
  assert(f.unchanged);await writeFile(`${dir}/${i?'after':'before'}-dorsal-only.png`,png(f.pixels));
 }
 const pick=await page.evaluate(async b=>{
  const THREE=await import('/node_modules/.vite/deps/three.js');const q=window.integrationQA,viewer=q.viewer;viewer.onHardpointSelect=id=>window.pickedSlot=id;
  await q.capture(b,'top',undefined,'Hardpoints');const h=b.hardpoints.find(h=>h.modular.state==='EMPTY'&&h.modular.region==='TOP'&&h.size==='L');const p=new THREE.Vector3(h.position.x,h.position.y,h.position.z).project(viewer.camera),r=viewer.renderer.domElement.getBoundingClientRect();return {expected:h.id,x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2,ids:b.hardpoints.map(h=>h.id)};
 },JSON.parse(await readFile(`${dir}/1.8.5.4.1.json`,'utf8')));
 await page.mouse.click(pick.x,pick.y);const selected=await page.evaluate(()=>window.pickedSlot);assert(pick.ids.includes(selected));
 await writeFile(`${dir}/top-report.json`,JSON.stringify({display:'QA render-only TOP region filter; canonical JSON unchanged',markerPick:{expected:pick.expected,selected,method:'Actual canvas pointer → InstancedMesh raycast → ShipViewer callback'},errors},null,2));assert.deepEqual(errors,[]);
}finally{await browser.close();}
