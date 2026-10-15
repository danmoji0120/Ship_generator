import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const out='qa/v1.8.6.0.1/visual';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],rows=[];
async function session(url){const page=await browser.newPage({viewport:{width:960,height:620}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/src/main.ts*',r=>r.fulfill({contentType:'application/javascript',body:'export {};'}));await page.goto(url,{timeout:120000});await page.evaluate(async()=>{const {ShipViewer}=await import('/src/rendering/viewer.ts');document.body.innerHTML='<div id="stage" style="position:fixed;inset:0"></div>';const initStart=performance.now(),v=new ShipViewer(document.querySelector('#stage')),rendererInitMs=performance.now()-initStart;v.disposed=true;window.capture=async(json,pose,mode)=>{const b=JSON.parse(json),start=performance.now();v.snapshot(b,mode);const snapshotMs=performance.now()-start;if(pose){v.camera.position.set(...pose.position);v.controls.target.set(...pose.target);v.camera.near=pose.near;v.camera.far=pose.far;v.camera.updateProjectionMatrix();v.controls.update();}const drawStart=performance.now();v.renderer.render(v.scene,v.camera);const drawMs=performance.now()-drawStart;return{rendererInitMs,snapshotMs,drawMs,pixels:document.querySelector('canvas').toDataURL(),pose:{position:v.camera.position.toArray(),target:v.controls.target.toArray(),near:v.camera.near,far:v.camera.far},diagnostics:v.getDiagnostics()};};});return page;}
try{
 const old=await session(process.env.OLD_QA_URL||'http://localhost:5178'),now=await session(process.env.QA_URL||'http://localhost:5177');
 for(const id of ['cruiser470','vesper200','forge300','spine300']){
  const a=gunzipSync(await readFile(`qa/v1.8.6.0.1/fixtures/${id}-before.json.gz`)).toString(),b=gunzipSync(await readFile(`qa/v1.8.6.0.1/fixtures/${id}-after.json.gz`)).toString();
  const x=await old.evaluate(async json=>window.capture(json,undefined,'Normal'),a),y=await now.evaluate(async({json,pose})=>window.capture(json,pose,'Normal'),{json:b,pose:x.pose});
  await writeFile(`${out}/${id}-before.png`,Buffer.from(x.pixels.split(',')[1],'base64'));await writeFile(`${out}/${id}-after.png`,Buffer.from(y.pixels.split(',')[1],'base64'));
  const equal=x.pixels===y.pixels;assert.ok(equal,id+' Normal pixels changed');rows.push({id,normalPixelsEqual:equal,pose:x.pose,before:{rendererInitMs:x.rendererInitMs,snapshotMs:x.snapshotMs,drawMs:x.drawMs},after:{rendererInitMs:y.rendererInitMs,snapshotMs:y.snapshotMs,drawMs:y.drawMs}});
  if(id==='cruiser470')for(const mode of ['Armor Thickness','Physical Materials','Physical Coverage']){const f=await now.evaluate(async({json,pose,mode})=>window.capture(json,pose,mode),{json:b,pose:x.pose,mode});await writeFile(`${out}/${mode.replaceAll(' ','-')}.png`,Buffer.from(f.pixels.split(',')[1],'base64'));}
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({rows,errors},null,2));console.log('exact Normal pixel comparisons',rows.length);
}finally{await browser.close();}
