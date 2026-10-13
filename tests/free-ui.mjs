import {chromium} from 'playwright-core';import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1480,height:1200}}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});const check=(name,ok)=>{assert(ok,name);checks.push({name,passed:true});console.log(name);};const manifest=()=>page.locator('#json-content').textContent().then(JSON.parse);
try{
 await page.goto('http://localhost:5195');await page.waitForFunction(()=>window.shipyardQA?.getBlueprint(),null,{timeout:90000});
 let b=await manifest();check('New default has no empty reserved slots',!b.modularHardpoints&&b.generatorVersion==='1.8.5.5');
 await page.locator('#import-file').setInputFiles('qa/v1.8.5.5/470.json');await page.waitForFunction(()=>document.querySelector('#json-content')?.textContent.includes('"length": 470'),null,{timeout:90000});
 const before=await manifest();await page.locator('#top').click();await page.locator('#free-on').check();await page.locator('#free-mode').selectOption('BATTERY');await page.locator('#free-count').fill('4');await page.locator('#free-spacing').fill('30');
 const req=JSON.parse(readFileSync('qa/v1.8.5.5/battery-request.json','utf8'));
 const p=await page.evaluate(point=>window.shipyardQA.projectMount(point),req.anchor.position);
 const hoverStart=Date.now();await page.mouse.move(p.x,p.y);await page.waitForFunction(()=>document.querySelector('#free-status')?.textContent.includes('_VALID'),null,{timeout:30000});
 const firstGhostWallMs=Date.now()-hoverStart;console.log('FIRST_GHOST_WALL_MS',firstGhostWallMs);check('Mouse hover shows real surface battery ghost',true);check('Hover leaves canonical data unchanged',JSON.stringify(await manifest())===JSON.stringify(before));
 // Actual drag on the projected surface, not direct installation handler invocation.
 await page.mouse.down();const end=await page.evaluate(point=>window.shipyardQA.projectMount(point),{...req.anchor.position,z:req.anchor.position.z-90});await page.mouse.move(end.x,end.y,{steps:4});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#free-status')?.textContent.startsWith('Installed 8'),null,{timeout:60000});b=await manifest();check('Pointer drag commits four mirrored rows atomically',b.freeMountPlan.entries.length===8);
 check('Hull, armor and baseline weapons unchanged', ['structuralVolumes','productionDesign','weaponLayout','hardpoints','engines','mesoStructurePlan','exteriorDetailPlan'].every(k=>JSON.stringify(before[k])===JSON.stringify(b[k])));
 const originalInstalled=JSON.stringify(b),selectedId=b.freeMountPlan.entries[0].id;
 await page.locator('#free-selection').selectOption(selectedId);await page.locator('#free-group').uncheck();await page.locator('#free-heading').fill('15');await page.locator('#free-rotate').click();
 await page.waitForFunction(id=>JSON.parse(document.querySelector('#json-content').textContent).freeMountPlan.entries.find(e=>e.id===id)?.headingDegrees===15,selectedId,{timeout:60000});check('Individual rotation revalidates geometry while retaining stable equipment ID',true);
 await page.locator('#free-undo').click();check('Undo rotation restores original symmetric battery exactly',JSON.stringify(await manifest())===originalInstalled);await page.locator('#free-group').check();
 const installed=JSON.stringify(b);await page.screenshot({path:'qa/v1.8.5.5/editor.png',fullPage:true});
 await page.locator('#free-selection').selectOption(b.freeMountPlan.entries[0].id);await page.locator('#free-delete').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#json-content').textContent).freeMountPlan.entries.length===0);check('Group deletion removes all owned platforms',true);
 await page.locator('#free-undo').click();check('Undo restores equipment and platforms exactly',JSON.stringify(await manifest())===installed);await page.locator('#free-redo').click();check('Redo restores deletion', (await manifest()).freeMountPlan.entries.length===0);await page.locator('#free-undo').click();
 await page.locator('#free-on').uncheck();check('Editor OFF preserves installed equipment',JSON.stringify(await manifest())===installed);
 const download=page.waitForEvent('download');await page.locator('#free-save').click();await(await download).saveAs('qa/v1.8.5.5/export.json');check('Saved file contains actual equipment plan',JSON.stringify(JSON.parse(readFileSync('qa/v1.8.5.5/export.json','utf8')))===installed);
 await page.locator('#reload').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#json-content').textContent).freeMountPlan.entries.length===8);check('Stored reload preserves anchors, platforms and groups',JSON.stringify(await manifest())===installed);
 check('Console errors zero',errors.length===0);writeFileSync('qa/v1.8.5.5/ui-report.json',JSON.stringify({checks,errors,firstGhostWallMs},null,2));
}finally{await browser.close();}
