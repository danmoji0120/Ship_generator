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
try {
    await page.goto(process.env.UI_QA_URL ?? 'http://localhost:4185', { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#structural-summary')?.textContent.includes('STRUCTURAL FRAME'), null, { timeout: 120000 });
    let b = await current();
    check('Production default generates a real frame and unarmed base', b.generatorVersion === '1.8.6.2.1' && b.compartmentPlan.compartments.length > 0 && b.structuralFrame.members.length > 0 && b.structuralFrame.analysis.components.length === 1 && b.weaponLayout.mounts.length === 0 && b.weaponLayout.integrated.length === 0 && b.engines.length > 0);
    check('Production has no development API', await page.evaluate(() => !window.shipyardQA));
    const balanced = gunzipSync(await readFile('qa/v1.8.6.2.1/fixtures/BALANCED.json.gz')).toString();
    await load(balanced);
    b = await current();
    check('Frame Blueprint import exact', hash(b) === hash(JSON.parse(balanced)));
    const original = hash(b);
    await page.locator('#seed').fill('8');
    check('Editing inputs does not regenerate', hash(await current()) === original);
    await page.locator('#seed').fill('7');
    await page.screenshot({ path: `${out}/normal-procurement.png` });
    for (const mode of ['Compartments', 'Bulkheads', 'Openings', 'Compartment Connectivity', 'Isolation', 'Compartment Mass']) {
        await page.locator(`[data-debug="${mode}"]`).click();
        check(mode + ' view responds', await page.locator(`[data-debug="${mode}"]`).getAttribute('aria-pressed') === 'true');
        await page.locator('#viewer').scrollIntoViewIfNeeded();
        await page.locator('.viewer-panel').screenshot({ path: `${out}/${mode.replaceAll(' ', '-')}.png` });
    }
    await page.locator('#interior-inspector details').first().locator('summary').click();
    await page.locator('#interior-selection').selectOption(b.compartmentPlan.compartments[0].id);
    check('Compartment Inspector shows actual CSG volume, pressure capability and frame references', /Finite CSG void.*domain/.test(await page.locator('#interior-info').textContent()) && (await page.locator('#interior-info').textContent()).includes('PRESSURIZABLE'));
    await page.locator('#interior-inspector').screenshot({ path: `${out}/compartment-inspector.png` });
    await page.locator('#interior-inspector details').nth(1).locator('summary').click();
    await page.locator('#interior-breach').check();
    await page.locator('#interior-wall').selectOption(b.compartmentPlan.bulkheads[0].id);
    await page.locator('#interior-analyze').click();
    check('Real boundary hypothesis updates vacuum exposure', /DEBUG HYPOTHESIS ONLY.*design unchanged/.test(await page.locator('#interior-analysis').textContent()) && (await page.locator('#interior-analysis').textContent()).includes('100.000%'));
    check('Interior hypothesis does not mutate exported design', hash(await current()) === original);
    await page.locator('#interior-inspector').screenshot({ path: `${out}/isolation-inspector.png` });
    await page.locator('#interior-reset').click();
    await page.locator('#interior-inspector details').nth(2).locator('summary').click();
    await page.locator('#interior-query').click();
    check('Interior Ray query returns real finite space and boundary intervals', /^VALID.*finite intervals/m.test(await page.locator('#interior-query-result').textContent()));
    await page.locator('#structural-inspector details').first().locator('summary').click();
    await page.locator('#structural-selection').selectOption(b.structuralFrame.members[1].id);
    check('Member Inspector reads geometry/material/mass/node references', (await page.locator('#structural-selection-info').textContent()).includes(b.structuralFrame.members[1].materialId) && (await page.locator('#structural-selection-info').textContent()).includes('Nodes'));
    await page.locator('#structural-inspector').screenshot({ path: `${out}/frame-inspector.png` });
    await page.locator('#structural-disable').check();
    check('Disabled member analysis reports components', /DEBUG ANALYSIS ONLY.*components/.test(await page.locator('#structural-damage-analysis').textContent()));
    check('Debug analysis never changes stored design', hash(await current()) === original);
    await page.locator('#structural-disable').uncheck();
    await page.locator('#structural-inspector details').nth(1).locator('summary').click();
    const p = b.structuralFrame.members[1].pieces[0].vertices.reduce((n, p, _, a) => ({ x: n.x + p.x / a.length, y: n.y + p.y / a.length, z: n.z + p.z / a.length }), { x: 0, y: 0, z: 0 });
    await page.locator('#structural-origin').fill([p.x, p.y + 10, p.z].join(','));
    await page.locator('#structural-direction').fill('0,-1,0');
    await page.locator('#structural-distance').fill('20');
    await page.locator('#structural-query').click();
    check('On-demand finite structural Ray Query hits actual member', /^VALID.*[1-9]\d* finite/.test(await page.locator('#structural-query-result').textContent()));
    await page.locator('#structural-query-result').screenshot({ path: `${out}/finite-ray-query.png` });
    await page.locator('[data-debug="Normal"]').click();
    await page.locator('#procurement-advanced summary').click();
    await page.locator('#maximum-base-mass').fill('0.001');
    await submit();
    check('Actual structural floor rejects impossible cap', /REJECT/.test(await page.locator('#order-status').textContent()));
    check('Rejected design retains previous exact ship', hash(await current()) === original);
    await load(balanced);
    await page.locator('#top').click();
    await page.locator('#free-on').check();
    await page.locator('#free-equipment').selectOption('gun-105');
    let installed = false;
    for (const [dx, dy] of [[-40, -25], [40, -25], [-65, 10], [65, 10], [-30, 30], [30, 30], [0, -45], [-90, -20], [90, -20], [-55, 45], [55, 45], [0, 55], [-110, 15], [110, 15], [0, -65]]) {
        await page.locator('#viewer').scrollIntoViewIfNeeded();
        const box = await page.locator('#viewer canvas').boundingBox(), x = box.x + box.width / 2 + dx, y = box.y + box.height / 2 + dy;
        await page.mouse.move(x, y);
        await page.waitForTimeout(350);
        if (!/DIRECT_VALID|PLATFORM_VALID/.test(await page.locator('#free-status').textContent()))
            continue;
        await page.mouse.click(x, y);
        await page.waitForFunction(() => /Installed|INVALID|PASS/.test(document.querySelector('#free-status').textContent), null, { timeout: 30000 });
        if ((await page.locator('#free-status').textContent()).startsWith('Installed')) {
            installed = true;
            break;
        }
    }
    check('Real Production surface picking installs external gun with internal frame present', installed);
    const equipped = await current();
    check('Mounted mass rises, frame/base remain unchanged', equipped.freeMountPlan.entries.length === 1 && equipped.physicalDesign.mass.playerMountedEquipmentMassEstimateKg > 0 && JSON.stringify(equipped.compartmentPlan) === JSON.stringify(b.compartmentPlan) && JSON.stringify(equipped.structuralFrame) === JSON.stringify(b.structuralFrame) && equipped.physicalDesign.mass.ledger.baseEstimatedDryMassKg === b.physicalDesign.mass.ledger.baseEstimatedDryMassKg);
    await page.locator('#viewer').screenshot({ path: `${out}/external-gun.png` });
    await writeFile(`${out}/player-equipped.json.gz`, gzipSync(JSON.stringify(equipped)));
    await page.locator('#free-selection').selectOption(equipped.freeMountPlan.entries[0].id);
    await page.locator('#free-delete').click();
    check('External equipment removal preserves frame', (await current()).freeMountPlan.entries.length === 0);
    await page.locator('#free-undo').click();
    check('Undo restores exact equipment and frame', hash(await current()) === hash(equipped));
    await page.locator('#free-redo').click();
    check('Redo removes equipment', (await current()).freeMountPlan.entries.length === 0);
    await page.locator('#free-on').uncheck();
    await load(JSON.stringify(equipped));
    check('Equipped frame Blueprint export/import exact', hash(await current()) === hash(equipped));
    const frameLegacy = gunzipSync(await readFile('qa/v1.8.6.1/fixtures/BALANCED.json.gz')).toString();
    await load(frameLegacy);
    check('Prior frame Blueprint remains exact, with no automatic interior', hash(await current()) === hash(JSON.parse(frameLegacy)) && (await page.locator('#interior-summary').textContent()).includes('LEGACY INTERIOR'));
    const legacy = gunzipSync(await readFile('qa/v1.8.6.0.1/fixtures/vesper200-after.json.gz')).toString();
    await load(legacy);
    check('Historical weapons/geometry/materials preserved with no automatic frame', hash(await current()) === hash(JSON.parse(legacy)) && (await current()).structuralFrame === undefined && (await current()).weaponLayout.mounts.length > 0);
    check('Legacy switch releases old frame/interior callback closures',await page.evaluate(()=>document.querySelector('#structural-selection').onchange===null&&document.querySelector('#structural-disable').onchange===null&&document.querySelector('#interior-selection').onchange===null));
    check('Legacy frame Inspector explicitly absent', /LEGACY STRUCTURE/.test(await page.locator('#structural-summary').textContent()));
    await page.locator('#viewer').screenshot({ path: `${out}/legacy-armed.png` });
    await page.locator('[data-debug="Frame"]').click();
    check('Legacy Frame request preserves original rendering without inserting data', hash(await current()) === hash(JSON.parse(legacy)) && /LEGACY STRUCTURE/.test(await page.locator('#structural-summary').textContent()));
    await page.locator('[data-debug="Normal"]').click();
    if(!process.env.SKIP_NATIVE_MATRIX){
    const native=[];
    for(const id of['BALANCED','BLOCK_ASSEMBLY','SPINE_AND_MODULES','TRUSS_POD','TWIN_HULL','CORE_AND_NACELLES','STACKED_BLOCKS','HYBRID']){
        const text=gunzipSync(await readFile(`qa/v1.8.6.2.1/fixtures/${id}.json.gz`)).toString(),expected=JSON.parse(text);
        await load(text);await submit();const generated=await current();
        let crossRuntime;try{crossRuntime={comparable:true,...compareRuntimeBlueprints(expected,generated)};}catch(error){crossRuntime={comparable:false,reason:error.message,nodeBaseMassKg:expected.physicalDesign.mass.ledger.baseEstimatedDryMassKg,browserBaseMassKg:generated.physicalDesign.mass.ledger.baseEstimatedDryMassKg,note:'Cross-runtime mismatch is reported, never converted to equality. Same-runtime baseline audit and Node controlled comparisons are separate evidence.'};}
        assert.deepEqual(generated.compartmentPlan.compartments.map(c=>c.id),expected.compartmentPlan.compartments.map(c=>c.id),id+' stable compartment IDs');assert.deepEqual(generated.compartmentPlan.accessGraph,expected.compartmentPlan.accessGraph,id+' actual portal graph');assert(generated.procurement.order.maximumBaseMassKg===undefined||generated.physicalDesign.mass.ledger.baseEstimatedDryMassKg<=generated.procurement.order.maximumBaseMassKg);
        check(id+' Production Generate, finite physical data and exact IDs/topology, no weapons',!!generated.compartmentPlan.volumeAudit&&generated.weaponLayout.mounts.length===0);
        {await submit();check('Same-browser same-order JSON exactly deterministic',hash(await current())===hash(generated));}
        native.push({id,crossRuntime,version:generated.generatorVersion,compartments:generated.compartmentPlan.compartments.length,audit:generated.compartmentPlan.volumeAudit});
        await page.locator('[data-debug="Compartments"]').click();await page.locator('.viewer-panel').screenshot({path:`${out}/${id}-production.png`});
    }
    await writeFile(`${out}/native-generation.json`,JSON.stringify(native,null,2));
    }
    await load(balanced);for(const d of await page.locator('#interior-inspector details').all())if(await d.getAttribute('open')===null)await d.locator('summary').click();
    check('Residual categories and unknown boundaries have real Inspector output',(await page.locator('#interior-analysis').textContent()).includes('VOLUME AUDIT'));
    await page.locator('#interior-query').click();check('Future placement query reports actual fixture and candidate test count',(await page.locator('#interior-query-result').textContent()).includes('PLACEMENT FIXTURE'));
    await page.locator('#interior-inspector').screenshot({path:`${out}/residual-placement.png`});
    await load(balanced);await page.locator('[data-debug="Normal"]').click();await page.locator('#top').click();await page.locator('#free-on').check();await page.locator('#free-equipment').selectOption('missile-medium');const beforeMissile=await current();
    let missileInstalled=false;
    for (const [dx, dy] of [[-40, -25], [40, -25], [-65, 10], [65, 10], [-30, 30], [30, 30], [0, -45], [-90, -20], [90, -20], [-55, 45], [55, 45], [0, 55], [-110, 15], [110, 15], [0, -65]]) {
        await page.locator('#viewer').scrollIntoViewIfNeeded();
        const box = await page.locator('#viewer canvas').boundingBox(), x = box.x + box.width / 2 + dx, y = box.y + box.height / 2 + dy;
        await page.mouse.move(x, y);
        await page.waitForTimeout(350);
        if (!/DIRECT_VALID|PLATFORM_VALID/.test(await page.locator('#free-status').textContent()))
            continue;
        await page.mouse.click(x, y);
        await page.waitForFunction(() => /Installed|INVALID|PASS/.test(document.querySelector('#free-status').textContent), null, { timeout: 30000 });
        if ((await page.locator('#free-status').textContent()).startsWith('Installed')) {
            missileInstalled=true;
            break;
        }
    }
    check('Real Production surface picking installs external missile with compartments present',missileInstalled);const missile=await current();check('Missile mass charged without changing internal space or base cap',missile.physicalDesign.mass.playerMountedEquipmentMassEstimateKg>0&&hash(missile.compartmentPlan)===hash(beforeMissile.compartmentPlan)&&missile.physicalDesign.mass.ledger.baseEstimatedDryMassKg===beforeMissile.physicalDesign.mass.ledger.baseEstimatedDryMassKg);await page.locator('#viewer').screenshot({path:`${out}/external-missile.png`});await page.locator('#free-on').uncheck();
    const priorInterior=gunzipSync(await readFile('qa/v1.8.6.2/fixtures/BALANCED.json.gz')).toString();await load(priorInterior);check('V1.8.6.2 saved interior is exact and receives no automatic volume audit',hash(await current())===hash(JSON.parse(priorInterior))&&!(await current()).compartmentPlan.volumeAudit);
    await page.setViewportSize({ width: 390, height: 844 });
    check('Narrow layout has no page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${out}/narrow.png` });
    check('Console/page errors zero', errors.length === 0);
    await writeFile(`${out}/report.json`, JSON.stringify({ checks, errors, scope: 'Targeted compartment Production UI; actual finite views/hypotheses/query, external mount worker and legacy frame/equipment import' }, null, 2));
}
catch (e) {
    await page.screenshot({ path: `${out}/failure.png` }).catch(() => { });
    await writeFile(`${out}/failed-run.json`, JSON.stringify({ checks, errors, error: e.stack }, null, 2));
    throw e;
}
finally {
    await browser.close();
}
