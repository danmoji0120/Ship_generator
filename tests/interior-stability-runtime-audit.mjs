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
try{await page.goto('http://localhost:4183',{timeout:120000});await page.waitForFunction(()=>document.querySelector('#structural-summary')?.textContent.includes('STRUCTURAL FRAME'),null,{timeout:120000});const text=gunzipSync(await readFile('qa/v1.8.6.2/fixtures/SPINE_AND_MODULES.json.gz')).toString();await load(text);await submit();const b=await current();await writeFile(`${out}/SPINE_AND_MODULES-before-production.json.gz`,gzipSync(JSON.stringify(b)));const now=JSON.parse(gunzipSync(await readFile(`${out}/SPINE_AND_MODULES-generated.json.gz`)));const mass=b.physicalDesign.mass;check('Same production runtime before/after exact mass',hash(mass)===hash(now.physicalDesign.mass));check('Same production runtime exact structural frame and physical skin',hash(b.structuralFrame)===hash(now.structuralFrame)&&hash(b.physicalDesign.surfaces)===hash(now.physicalDesign.surfaces));await writeFile(`${out}/cross-runtime-audit.json`,JSON.stringify({nodeMass:JSON.parse(text).physicalDesign.mass,beforeBrowserMass:mass,afterBrowserMass:now.physicalDesign.mass,checks,errors},null,2));}finally{await browser.close();}
