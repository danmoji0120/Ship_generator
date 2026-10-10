import {chromium} from 'playwright-core';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='qa/v1.8.5.4.1',checks=[],errors=[];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,ok)=>{assert(ok,name);checks.push({name,passed:true});};
const manifest=()=>page.locator('#json-content').textContent().then(JSON.parse);
const importFile=async p=>{const expected=JSON.stringify(JSON.parse(await readFile(p,'utf8')));await page.locator('#import-file').setInputFiles(p);await page.waitForFunction(e=>{try{return JSON.stringify(JSON.parse(document.querySelector('#json-content').textContent))===e;}catch{return false;}},expected,{timeout:90000});};
try{
 await page.goto(process.env.UI_QA_URL||'http://localhost:4291');await page.waitForFunction(()=>document.querySelector('#json-content')?.textContent.length>100,{},{timeout:90000});
 check('Production bundle without DEV helpers',await page.evaluate(()=>!window.shipyardQA));
 await importFile(`${dir}/1.8.5.4.1.json`);const b=await manifest(),saved=JSON.stringify(b);
 check('Patch Blueprint imported without regeneration',b.generatorVersion==='1.8.5.4.1');
 await page.locator('#hardpoint-inspector details').evaluate(e=>e.open=true);
 const h=b.hardpoints.find(h=>h.modular.pairId&&h.modular.batteryGroupId);
 await page.locator('#hardpoint-selection').selectOption(h.id);
 const info=await page.locator('#hardpoint-selection-info').textContent();check('Selected slot exposes Pair / Battery / Zone',info.includes(h.modular.pairId)&&info.includes(h.modular.batteryGroupId)&&info.includes(h.modular.zoneId));
 for(const mode of ['Hardpoints','Hardpoint Layout Only','Normal']){await page.locator(`[data-debug="${mode}"]`).click();check(`${mode} is render-only`,JSON.stringify(await manifest())===saved);}
 await page.locator('[data-debug="Hardpoints"]').click();await page.screenshot({path:`${dir}/inspector.jpg`,type:'jpeg',quality:85,fullPage:true});
 const event=page.waitForEvent('download');await page.locator('#export').click();const d=await event;await d.saveAs(`${dir}/export.json`);check('Export canonical JSON unchanged',JSON.stringify(JSON.parse(await readFile(`${dir}/export.json`,'utf8')))===saved);
 await importFile(`${dir}/export.json`);await page.locator('#reload').click();check('Import and stored Reload preserve layout',JSON.stringify(await manifest())===saved);
 await importFile(`${dir}/1.8.5.4.json`);check('V1.8.5.4 replay stays historical',(await manifest()).generatorVersion==='1.8.5.4');
 await importFile(`${dir}/1.8.5.4.1.json`);await page.locator('#regenerate').click();await page.waitForFunction(()=>document.querySelector('#order-status').textContent.includes('생성 완료'),{},{timeout:90000});
 check('Production Regenerate uses new default',(await manifest()).generatorVersion==='1.8.5.4.1');check('Console errors zero',errors.length===0);
 await writeFile(`${dir}/ui-report.json`,JSON.stringify({checks,errors},null,2));console.log(checks.length,'focused UI checks passed');
}finally{await browser.close();}
