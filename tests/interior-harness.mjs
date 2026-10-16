import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
export async function bundleInteriorAPI(root, out) { await build({ stdin: { contents: `export{generateProcurementBlueprint}from'./src/procurement/generate.ts';export{buildCompartmentPlan,updateInteriorSpaceAccounting,updateInteriorDerivedData,interiorCacheBytes,clearInteriorCache}from'./src/interior/build.ts';export*from'./src/interior/query.ts';export*from'./src/interior/graph.ts';export*from'./src/interior/types.ts';export{finishProcurementDelivery}from'./src/procurement/result.ts';export{validateCompartmentPlan,interiorValidationCacheBytes}from'./src/interior/validate.ts';export{validateBlueprint}from'./src/validation/validate.ts';export{setPhysicalProfilingEnabled,physicalDiagnostics}from'./src/physical/diagnostics.ts';export{armorRayProbe,preparePhysicalQueries}from'./src/physical/probe.ts';`, resolveDir: resolve(root) }, bundle: true, format: 'esm', platform: 'node', outfile: out }); }
if (process.argv[2] === 'build')
    await bundleInteriorAPI(process.argv[3], process.argv[4]);
if (process.argv[2] === 'run') {
    const [, , , module, input, output] = process.argv, boot = performance.now(), api = await import(pathToFileURL(resolve(module))), moduleInitMs = performance.now() - boot, bytes = await readFile(input), source = JSON.parse(input.endsWith('.gz') ? gunzipSync(bytes) : bytes), order = source.procurement?.order ?? source;
    api.setPhysicalProfilingEnabled(true);
    let start = performance.now(), b = api.generateProcurementBlueprint(order), firstMs = performance.now() - start, profile = api.physicalDiagnostics(b), repeatMs = [], deterministic = true;
    for (let i = 0; i < Number(process.env.REPEAT ?? 0); i++) {
        start = performance.now();
        const copy = api.generateProcurementBlueprint(order);
        repeatMs.push(performance.now() - start);
        deterministic &&= JSON.stringify(b) === JSON.stringify(copy);
    }
    const p = b.compartmentPlan, qstart = performance.now(), q = api.prepareInteriorQueries(b), queryPreparationMs = performance.now() - qstart, c = p.compartments.find(c => c.exteriorPatches.length), scenario = api.createInteriorInstanceState();
    if (c)
        scenario.hypotheticalHullBreaches = [{ compartmentId: c.id, exteriorPatchIndex: 0 }];
    const breach = api.analyzeInterior(p, scenario);
    if (p.bulkheads.length)
        scenario.disabledBulkheadIds = [p.bulkheads[0].id];
    const failure = api.analyzeInterior(p, scenario);
    const row = { order, moduleInitMs, firstMs, repeatMs, deterministic, profile, architecture: b.architecture.grammar, compartmentCount: p.compartments.length, validInteriorVolumeM3: p.compartments.reduce((n, c) => n + c.volumeM3, 0), pressurizableVolumeM3: p.compartments.filter(c => c.pressureCapability === 'PRESSURIZABLE').reduce((n, c) => n + c.volumeM3, 0), bulkheadCount: p.bulkheads.length, bulkheadMassKg: p.massAccounting.bulkheadMassKg, closureMassKg: p.massAccounting.closureMassKg, openingCount: p.openings.length, sealedCount: p.openings.filter(o => o.defaultState === 'SEALED').length, isolationGroups: p.analysis.isolatedGroups.length, exposureRatio: p.analysis.exposureRatio, breachExposureRatio: breach.exposureRatio, boundaryFailureExposureRatio: failure.exposureRatio, materials: p.bulkheads.map(w => w.materialId), thicknessMm: p.bulkheads.map(w => w.thicknessMm), regions: p.regions, mass: b.physicalDesign.mass, cost: b.procurement.cost, compromises: b.procurement.compromises, queryPreparationMs, queryCells: q.cellCount, cacheBytes: api.interiorCacheBytes(), validationCacheBytes:api.interiorValidationCacheBytes(), memory: process.memoryUsage(), peakRss: process.resourceUsage().maxRSS * 1024 };
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(row, null, 2));
    if (process.env.SAVE_BLUEPRINT)
        await writeFile(process.env.SAVE_BLUEPRINT, gzipSync(JSON.stringify(b)));
    console.log(row.architecture, Math.round(firstMs), repeatMs.map(Math.round), row.compartmentCount, row.bulkheadCount, row.openingCount, row.breachExposureRatio, row.boundaryFailureExposureRatio);
}
