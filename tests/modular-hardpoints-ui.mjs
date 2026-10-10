import {chromium} from 'playwright-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='qa/v1.8.5.4/ui';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const manifest=()=>page.locator('#json-content').textContent().then(JSON.parse);
const check=(name,ok)=>{assert(ok,name);checks.push({name,passed:true});};
const importFile=async path=>{
 const expected=JSON.stringify(JSON.parse(await readFile(path,'utf8')));
 await page.locator('#import-file').setInputFiles(path);
 await page.waitForFunction(expected=>{
  try{return JSON.stringify(JSON.parse(document.querySelector('#json-content').textContent))===expected;}catch{return false;}
 },expected,{timeout:120000});
};
try{
 await page.goto(process.env.UI_QA_URL||'http://localhost:4200');
 await page.waitForFunction(()=>document.querySelector('#json-content')?.textContent.length>100,{},{timeout:120000});
 check('Production bundle: no DEV QA API',await page.evaluate(()=>!window.shipyardQA));
 await importFile('qa/v1.8.5.4/after/stacked-blocks.json');
 const imported=await manifest();check('Import preserves new Blueprint',JSON.stringify(imported)===JSON.stringify(JSON.parse(await readFile('qa/v1.8.5.4/after/stacked-blocks.json','utf8'))));
 check('Inspector exposes total/empty/occupied', (await page.locator('#hardpoint-summary').textContent()).includes('TOTAL 114 · EMPTY 99 · OCCUPIED 15'));
 await page.locator('#hardpoint-inspector details').evaluate(e=>e.open=true);
 const empty=imported.hardpoints.find(h=>h.modular.state==='EMPTY');
 await page.locator('#hardpoint-selection').selectOption(empty.id);
 check('Selected empty slot details', (await page.locator('#hardpoint-selection-info').textContent()).includes('EMPTY'));
 await page.locator('[data-debug="Hardpoints"]').click();
 await page.screenshot({path:`${out}/inspector.png`,fullPage:true});
 await page.locator('#hardpoint-density').selectOption('DENSE');
 await page.locator('.hardpoint-orders > summary').click();
 await page.locator('#add-hardpoint-request').click();
 const row=page.locator('.hardpoint-request').first();
 await row.locator('[data-field="mandatory"]').check();await row.locator('[data-field="region"]').selectOption('TOP');
 await page.locator('#regenerate').click();
 await page.waitForFunction(()=>document.querySelector('#order-status').textContent.includes('생성 완료'),{},{timeout:120000});
 const dense=await manifest();check('Density editor applied to generated slots',dense.modularHardpoints.density==='DENSE');
 check('Mandatory UI support request satisfied',dense.modularHardpoints.requests[0].status==='SATISFIED'&&dense.modularHardpoints.requests[0].matchedIds.length===4);
 await page.screenshot({path:`${out}/dense-required.png`,fullPage:true});
 await page.locator('#add-hardpoint-request').click();
 const bad=page.locator('.hardpoint-request').last();await bad.locator('[data-field="type"]').selectOption('SPINAL');await bad.locator('[data-field="size"]').selectOption('XL');await bad.locator('[data-field="mandatory"]').check();
 await page.locator('#regenerate').click();
 await page.waitForFunction(()=>document.querySelector('#order-status').textContent.includes('REQUIRED_HARDPOINT_CAPACITY_UNAVAILABLE'),{},{timeout:120000});
 check('Precise mandatory rejection displayed',(await page.locator('#design-rejection').textContent()).includes('missing 4'));
 check('Rejected order does not replace the last valid Blueprint',JSON.stringify(await manifest())===JSON.stringify(dense));
 await page.locator('#design-rejection details').evaluate(e=>e.open=true);await page.screenshot({path:`${out}/rejection.png`,fullPage:true});
 await bad.locator('button').click();
 const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadEvent;await download.saveAs(`${out}/export.json`);
 const exported=JSON.parse(await readFile(`${out}/export.json`,'utf8'));check('JSON Export matches actual Blueprint',JSON.stringify(exported)===JSON.stringify(dense));
 await importFile(`${out}/export.json`);check('JSON Import round-trip',JSON.stringify(await manifest())===JSON.stringify(dense));
 await page.locator('#reload').click();check('Reload preserves saved Blueprint',JSON.stringify(await manifest())===JSON.stringify(dense));
 await importFile('qa/v1.8.5.4/before/stacked-blocks.json');const old=await manifest();
 check('Historical import is not upgraded or rewritten',!old.modularHardpoints&&JSON.stringify(old)===JSON.stringify(JSON.parse(await readFile('qa/v1.8.5.4/before/stacked-blocks.json','utf8'))));
 check('Historical Blueprint hides additive inspector',await page.locator('#hardpoint-inspector').isHidden());
 check('Console errors zero',errors.length===0);
 await writeFile(`${out}/report.json`,JSON.stringify({checks,errors,denseSummary:dense.modularHardpoints.summary},null,2));console.log(`${checks.length} focused Production UI checks passed`);
}finally{await browser.close();}
