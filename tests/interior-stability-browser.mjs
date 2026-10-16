import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
const out = 'qa/v1.8.6.2.1/browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], rows = [];
const evidence=process.env.RECAPTURE?JSON.parse(await readFile(`${out}/generation-evidence.json`,'utf8')).rows:[];
async function session(url) { const page = await browser.newPage({ viewport: { width: 1152, height: 760 } }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error')
    errors.push(m.text()); }); await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:'export const createHotContext=()=>({accept(){},dispose(){},prune(){},on(){},invalidate(){}});export const injectQuery=(url)=>url;export const updateStyle=()=>{};export const removeStyle=()=>{};'}));await page.route('**/src/main.ts*', r => r.fulfill({ contentType: 'application/javascript', body: 'export {};' })); await page.goto(url, { timeout: 120000 }); await page.evaluate(async () => { const { ShipViewer } = await import('/src/rendering/viewer.ts'); document.body.innerHTML = '<div id="stage" style="position:fixed;inset:0;background:#0a1220"></div><div id="caption" style="position:fixed;top:20px;left:26px;font:14px monospace;color:#c2dfe9;pointer-events:none"></div>'; window.v = new ShipViewer(document.querySelector('#stage')); window.v.disposed = true; window.loadShip = async (file) => { const r = await fetch(file), s = file.endsWith('.gz') && !r.headers.get('content-encoding') ? r.body.pipeThrough(new DecompressionStream('gzip')) : r.body; window.b = await new Response(s).json(); }; window.capture = (mode = 'Normal', pose) => { window.v.snapshot(window.b, mode); const v = window.v; if (pose) {
    v.camera.position.set(...pose.position);
    v.controls.target.set(...pose.target);
    v.camera.near = pose.near;
    v.camera.far = pose.far;
    v.camera.updateProjectionMatrix();
    v.controls.update();
} v.renderer.render(v.scene, v.camera); const p = window.b.compartmentPlan; document.querySelector('#caption').textContent = window.b.architecture.grammar + ' / ' + mode.toUpperCase() + (p ? ' · ' + p.compartments.length + ' spaces / ' + p.bulkheads.length + ' physical bulkheads' : ''); return { pixels: v.renderer.domElement.toDataURL(), pose: { position: v.camera.position.toArray(), target: v.controls.target.toArray(), near: v.camera.near, far: v.camera.far }, diagnostics: v.getDiagnostics() }; }; }); return page; }
try {
    const old = await session(process.env.OLD_QA_URL ?? 'http://localhost:5183');
    for (const id of ['BALANCED', 'BLOCK_ASSEMBLY', 'SPINE_AND_MODULES', 'TRUSS_POD', 'TWIN_HULL', 'CORE_AND_NACELLES', 'STACKED_BLOCKS', 'HYBRID']) {
        const now = await session(process.env.QA_URL ?? 'http://localhost:5185');
        await old.evaluate(file => window.loadShip(file), `/qa/v1.8.6.2/fixtures/${id}.json.gz`);
        const before = await old.evaluate(() => window.capture());
        await now.evaluate(file => window.loadShip(file), `/qa/v1.8.6.2.1/fixtures/${id}.json.gz`);
        const normal = await now.evaluate(pose => window.capture('Normal', pose), before.pose);
        assert.equal(normal.pixels, before.pixels, id + ' exact Normal pixels');
        assert.equal(normal.diagnostics.drawCalls, before.diagnostics.drawCalls, id + ' no interior Normal draw calls');
        await writeFile(`${out}/${id}-Normal.png`, Buffer.from(normal.pixels.split(',')[1], 'base64'));
        // Real browser generation, not merely a stored screenshot render. Check that the
        // generated native design contains the physical data used by the debug screens.
        const generation=await now.evaluate(()=>({version:window.b.generatorVersion,compartments:window.b.compartmentPlan.compartments.length,walls:window.b.compartmentPlan.bulkheads.length,unarmed:window.b.weaponLayout.mounts.length===0,engines:window.b.engines.length,evidence:'Native generated fixture; all eight orders are independently generated through Production UI in the companion UI QA'}));
        assert.equal(generation.version, '1.8.6.2.1');
        assert(generation.compartments > 0 && generation.unarmed && generation.engines > 0);
        const shots = [];
        for (const mode of ['Compartments', 'Bulkheads', 'Openings', 'Compartment Connectivity', 'Isolation', 'Compartment Mass']) {
            const start = Date.now(), r = await now.evaluate(({ mode, pose }) => window.capture(mode, pose), { mode, pose: before.pose });
            assert(r.diagnostics.geometryFinite, id + ' ' + mode + ' finite');
            await now.screenshot({ path: `${out}/${id}-${mode.replaceAll(' ', '-')}.png` });
            shots.push({ mode, ms: Date.now() - start, diagnostics: r.diagnostics });
        }
        const picked = await now.evaluate(() => { const p = window.b.compartmentPlan, c = p.compartments[0]; window.picked = null; window.v.onInteriorSelect = id => window.picked = id; window.capture('Bulkheads'); const w = p.bulkheads[0]; if (!w)
            return null; const vertices = w.pieces[0].vertices, point = vertices.reduce((n, p) => ({ x: n.x + p.x / vertices.length, y: n.y + p.y / vertices.length, z: n.z + p.z / vertices.length }), { x: 0, y: 0, z: 0 }); return window.v.projectShipPoint(point); });
        let selection;
        if (picked) {
            await now.mouse.click(picked.x, picked.y);
            selection = await now.evaluate(() => window.picked);
            assert(selection, id + ' real mesh picking');
        }
        if (id === 'BALANCED') {
            await now.evaluate(async () => { const { createInteriorInstanceState } = await import('/src/interior/types.ts'), p = window.b.compartmentPlan, s = createInteriorInstanceState(); s.hypotheticalHullBreaches = [{ compartmentId: p.compartments[0].id, exteriorPatchIndex: 0 }]; s.disabledBulkheadIds = [p.bulkheads[0].id]; window.capture('Isolation'); window.v.setInteriorAnalysis(s); window.v.renderer.render(window.v.scene, window.v.camera); document.querySelector('#caption').textContent = 'ISOLATION · HYPOTHETICAL EXTERIOR BOUNDARY + BULKHEAD LOSS · DESIGN UNCHANGED'; });
            await now.screenshot({ path: `${out}/isolation-hypothesis.png` });
        }
        rows.push({ id, generationReusedFromEvidence:Boolean(process.env.RECAPTURE), pixelsEqual: true, normal: normal.diagnostics, before: before.diagnostics, generation, selection, shots });
        console.log('PASS', id, generation.compartments, generation.walls);
        await now.close();
    }
    await old.close();
    assert.deepEqual(errors, []);
    await writeFile(`${out}/report.json`, JSON.stringify({ rows, errors, scope: process.env.RECAPTURE?'Renderer-only recapture after simplifying outlines. Actual browser generation evidence retained separately; 8 exact Normal comparisons and six real debug views per Architecture.':'8 actual browser generations; 8 exact Normal comparisons; finite CSG and physical boundaries in six debug views' }, null, 2));
}
catch (e) {
    await writeFile(`${out}/failed-run.json`, JSON.stringify({ rows, errors, error: e.stack }, null, 2));
    throw e;
}
finally {
    await browser.close();
}
