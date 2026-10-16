// Archived strict cross-runtime QA experiment. Reproduces the failures documented in qa/v1.8.6.2.1/REPORT.md; not the final bounded UI protocol.
import{compareRuntimeBlueprints}from'./interior-stability-compare.mjs';
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const out = 'qa/v1.8.6.2.1/ui';
await mkdir(out, { recursive: true });
const checks = [], errors = [], browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error')
    errors.push(m.text()); });
const check = (name, ok) => { assert(ok, name); checks.push({ name, passed: true }); console.log('PASS', name); }, hash = b => createHash('sha256').update(JSON.stringify(b)).digest('hex');
async function current() { const wait = page.waitForEvent('download'); await page.locator('#export').click(); const d = await wait; return JSON.parse(await readFile(await d.path(), 'utf8')); }
async function load(json) { await writeFile('/tmp/interior-stability-ui-import.json', json); await page.locator('#order-status').evaluate(e => e.textContent = 'QA loading'); await page.locator('#import-file').setInputFiles('/tmp/interior-stability-ui-import.json'); await page.waitForFunction(() => /로드 완료|Error:/.test(document.querySelector('#order-status').textContent), null, { timeout: 120000 }); assert((await page.locator('#order-status').textContent()).includes('로드 완료')); }
async function submit() { await page.locator('#order-status').evaluate(e => e.textContent = 'QA generating'); await page.locator('#generate').click(); await page.waitForFunction(() => /생성 완료|REJECT/.test(document.querySelector('#order-status').textContent), null, { timeout: 120000 }); }
try{await page.goto('http://localhost:4185',{timeout:120000});await page.waitForFunction(()=>document.querySelector('#structural-summary')?.textContent.includes('STRUCTURAL FRAME'),null,{timeout:120000});const balanced=gunzipSync(await readFile('qa/v1.8.6.2.1/fixtures/BALANCED.json.gz')).toString();
    const native=[];
    for(const id of['BALANCED','BLOCK_ASSEMBLY','SPINE_AND_MODULES','TRUSS_POD','TWIN_HULL','CORE_AND_NACELLES','STACKED_BLOCKS','HYBRID']){
        const text=gunzipSync(await readFile(`qa/v1.8.6.2.1/fixtures/${id}.json.gz`)).toString(),expected=JSON.parse(text);
        await load(text);await submit();const generated=await current();
        await writeFile(`${out}/${id}-generated.json.gz`,gzipSync(JSON.stringify(generated)));
        let crossRuntime;try{crossRuntime={comparable:true,...compareRuntimeBlueprints(expected,generated)};}catch(error){crossRuntime={comparable:false,reason:error.message,nodeBaseMassKg:expected.physicalDesign.mass.ledger.baseEstimatedDryMassKg,browserBaseMassKg:generated.physicalDesign.mass.ledger.baseEstimatedDryMassKg,note:'Cross-runtime mismatch is reported, never converted to equality. Same-runtime baseline audit and Node controlled comparisons are separate evidence.'};}
        assert.deepEqual(generated.compartmentPlan.compartments.map(c=>c.id),expected.compartmentPlan.compartments.map(c=>c.id),id+' stable compartment IDs');assert.deepEqual(generated.compartmentPlan.accessGraph,expected.compartmentPlan.accessGraph,id+' actual portal graph');assert(generated.procurement.order.maximumBaseMassKg===undefined||generated.physicalDesign.mass.ledger.baseEstimatedDryMassKg<=generated.procurement.order.maximumBaseMassKg);
        check(id+' Production Generate, finite physical data and exact IDs/topology, no weapons',!!generated.compartmentPlan.volumeAudit&&generated.weaponLayout.mounts.length===0);
        {await submit();check('Same-browser same-order JSON exactly deterministic',hash(await current())===hash(generated));}
        native.push({id,crossRuntime,version:generated.generatorVersion,compartments:generated.compartmentPlan.compartments.length,audit:generated.compartmentPlan.volumeAudit});
        await page.locator('[data-debug="Compartments"]').click();await page.locator('.viewer-panel').screenshot({path:`${out}/${id}-production.png`});
    }
    await writeFile(`${out}/native-generation.json`,JSON.stringify(native,null,2));
    await load(balanced);if(await page.locator('#interior-inspector details').first().getAttribute('open')===null)await page.locator('#interior-inspector details').first().locator('summary').click();
    check('Residual categories and unknown boundaries have real Inspector output',(await page.locator('#interior-analysis').textContent()).includes('VOLUME AUDIT'));
    await page.locator('#interior-query').click();check('Future placement query reports actual fixture and candidate test count',(await page.locator('#interior-query-result').textContent()).includes('PLACEMENT FIXTURE'));
    await page.locator('#interior-inspector').screenshot({path:`${out}/residual-placement.png`});
    const priorInterior=gunzipSync(await readFile('qa/v1.8.6.2/fixtures/BALANCED.json.gz')).toString();await load(priorInterior);check('V1.8.6.2 saved interior is exact and receives no automatic volume audit',hash(await current())===hash(JSON.parse(priorInterior))&&!(await current()).compartmentPlan.volumeAudit);
await page.setViewportSize({width:390,height:844});check('Narrow layout',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${out}/narrow-final.png`});check('Console errors zero',!errors.length);await writeFile(`${out}/native-report.json`,JSON.stringify({checks,errors},null,2));}finally{await browser.close();}
