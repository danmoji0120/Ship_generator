// Existing production controls only; no contact sheet or bulk design generation.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const dir=process.env.FUNCTIONAL_UI_OUTPUT||'qa/v1.8.2/functional-exterior/verification';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(process.env.PRODUCTION_URL||'http://localhost:4190');
 await page.waitForFunction(()=>document.querySelector('#validated')?.textContent==='✓ BLUEPRINT VALID');
 assert.equal(await page.evaluate(()=>Boolean(window.shipyardQA)),false);
 await page.fill('#seed','7');await page.click('#regenerate');await page.click('#inspect');
 const first=await page.locator('#json-content').textContent(),b=JSON.parse(first);
 assert.equal(b.generatorVersion,'1.8.1');assert.equal(b.schemaVersion,2);assert.equal(b.functionalExterior,undefined);
 await page.click('#close-json');await page.click('#regenerate');await page.click('#inspect');
 assert.equal(await page.locator('#json-content').textContent(),first);await page.click('#close-json');
 for(const mode of ['Hardpoints','Engines','Structure','Architecture','Structural Graph','Integration','Armor','Equipment','Hull Only','Armor Coverage','Armor Panels','Panel Seams','Secondary Armor','Hardpoint Mounts','Complete Ship','Normal'])await page.click(`[data-debug="${mode}"]`);
 for(const id of ['top','rear','iso','fit'])await page.click(`#${id}`);
 const canvas=page.locator('#viewer canvas'),box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.6,{steps:10});await page.mouse.up();await page.mouse.wheel(0,-220);await page.click('#fit');
 const event=page.waitForEvent('download');await page.click('#export');const download=await event;
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));assert.deepEqual(exported,b);
 assert.deepEqual(errors,[]);
 await writeFile(`${dir}/production-ui.json`,JSON.stringify({productionBuild:true,defaultGeneratorVersion:b.generatorVersion,newReviewNotAutoApplied:true,seed7Regeneration:true,jsonExport:true,debugModes:16,cameraControls:true,orbitZoomEvents:true,consoleErrors:errors,scope:'existing UI smoke; no gallery or bulk QA'},null,2));
 console.log('Production UI PASS: Seed/JSON/export, 16 modes, camera controls; console 0; no bulk gallery.');
}finally{await browser.close();}
