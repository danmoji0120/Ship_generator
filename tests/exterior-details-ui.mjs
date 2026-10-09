import{chromium}from'playwright-core';import{mkdir,writeFile,readFile}from'node:fs/promises';import{readBlueprint}from'./helpers/blueprint-artifact.mjs';import assert from'node:assert/strict';
const out=process.env.OUT||'qa/v1.8.5/ui',url=process.env.PRODUCTION_URL||'http://localhost:4185';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const manifest=async()=>JSON.parse(await page.locator('#json-content').textContent());const image=async()=>page.locator('#viewer canvas').evaluate(c=>c.toDataURL('image/png'));
try{
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('#order-status').textContent.startsWith('생성 완료'));
 assert.equal(await page.evaluate(()=>!!window.shipyardQA),false);assert.equal((await manifest()).generatorVersion,'1.8.5');checks.push('Production default generator without DEV hooks');
 await page.fill('#seed','7');await page.click('#regenerate');const first=await manifest();await page.click('#regenerate');assert.deepEqual(await manifest(),first);checks.push('Same Seed JSON');
 await page.fill('#seed','11');await page.click('#regenerate');assert.notDeepEqual((await manifest()).structuralVolumes,first.structuralVolumes);checks.push('New Seed changes actual Hull');
 const modes=['Structural Armor Only','Armor Coverage','Functional Exterior Only','Hardpoint Layout Only','Mount Size','Symmetry Groups','Firing Arc','Hull Only','Complete Ship','Normal'];
 for(const mode of modes)await page.click(`[data-debug="${mode}"]`);checks.push('All production debug modes');
 const invariant=await manifest(); for(const mode of ['OFF','LOW','HIGH','AUTO']){await page.selectOption('#detail-mode',mode);await page.waitForTimeout(150);assert.deepEqual(await manifest(),invariant);await page.screenshot({path:`${out}/detail-${mode}.png`});}await page.selectOption('#detail-mode','HIGH');checks.push('OFF LOW HIGH AUTO visibility only; JSON unchanged');
 await page.click('#iso');await page.click('#fit');await page.waitForTimeout(700);const before=await image(),exported=await manifest();
 const wait=page.waitForEvent('download');await page.click('#export');const download=await wait;const file=await download.path();assert.deepEqual(JSON.parse(await readFile(file,'utf8')),exported);
 await page.locator('#import-file').setInputFiles({name:'saved.blueprint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.waitForFunction(()=>document.querySelector('#order-status').textContent.includes('로드 완료'));await page.waitForTimeout(700);assert.deepEqual(await manifest(),exported);assert.equal(await image(),before);checks.push('Real UI export/import + WebGL pixel reproduction');
 await page.click('#reload');await page.waitForTimeout(500);assert.equal(await image(),before);checks.push('Stored reload without regeneration');
 const canvas=page.locator('#viewer canvas'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.6,{steps:10});await page.mouse.up();await page.mouse.wheel(0,-150);await page.waitForTimeout(300);assert.notEqual(await image(),before);await page.click('#fit');checks.push('Orbit / Zoom / Fit');
 const doctrine=(await manifest()).designDoctrine;
 if(doctrine){await page.locator('#architecture-summary details summary').click();const text=await page.locator('#architecture-summary details').textContent();assert(text.includes(doctrine.profile.goal));assert(text.includes('목표:'));assert(text.includes('실제:'));checks.push('Doctrine intent, target/actual and resource explanation in real Inspector');}
 await page.screenshot({path:`${out}/production-desktop.png`,fullPage:true});
 if(doctrine){await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${out}/doctrine-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:1000});checks.push('Expanded doctrine Inspector stays inside 390px viewport');}

 if((await manifest()).designRequirements){
  assert((await page.locator('#requirements-summary').textContent()).includes('필수'));checks.push('Requirements summary on Production design');
  await page.selectOption('#role','Spinal Gun Ship');await page.locator('#length').evaluate(e=>{e.value='300';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.fill('#seed','11');await page.click('#regenerate');
  const spinal=await manifest();assert.equal(spinal.designRequirements.phase,'RELEASED');assert.equal(spinal.weaponLayout.integrated.length,1);assert(spinal.designRequirements.requirements.filter(r=>r.type==='MANDATORY').every(r=>r.status==='SATISFIED'));assert((await page.locator('#requirements-summary').textContent()).includes('XL 설치 1'));
  await page.click('#regenerate');assert.deepEqual(await manifest(),spinal);checks.push('Actual required XL on former failed Seed 11 and same-order JSON');
  await page.locator('#architecture-summary details summary').click();await page.screenshot({path:`${out}/required-xl.png`,fullPage:true});
  await page.locator('#length').evaluate(e=>{e.value='40';e.dispatchEvent(new Event('input',{bubbles:true}));});await page.click('#regenerate');
  assert((await page.locator('#order-status').textContent()).includes('REQUIRED_XL_BREECH_SPACE_UNAVAILABLE'));assert.equal(await page.locator('#validated').textContent(),'ORDER INVALID');assert.deepEqual(await manifest(),spinal);checks.push('Impossible XL order rejected with reason; no invalid shipment replaces Blueprint');
  await page.locator('#design-rejection summary').click();await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/rejected-order-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:1000});
 }
 const archived=['qa/v1.8.4/history/v0.blueprint.json','qa/v1.8.1/regression/export.blueprint.json','qa/v1.8.2/functional-exterior/final-review/blueprint.json','qa/v1.8.3/final-review/blueprint.json',...(process.env.REQUIREMENTS_QA?['qa/v1.8.4.2/history/v1.8.4.1.blueprint.json']:[])];
 for(const path of archived){try{const b=await readBlueprint(path);await page.locator('#import-file').setInputFiles({name:'historical.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(b))});await page.waitForTimeout(200);assert.deepEqual(await manifest(),b);checks.push(`Historical import ${b.generatorVersion}`);}catch(e){if(e.code==='ENOENT')checks.push(`Archive missing ${path}`);else throw e;}}
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${out}/mobile-layout.png`,fullPage:true});checks.push('390px responsive layout only (no mobile GPU claim)');
 assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({checks,errors,pixels:true,environment:'Chromium / SwiftShader; actual production bundle'},null,2));console.log(JSON.stringify({checks:checks.length,errors}));
}finally{await browser.close();}
