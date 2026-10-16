import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
export async function bundleInteriorAPI(root, out) { await build({ stdin: { contents: `export{generateProcurementBlueprint}from'./src/procurement/generate.ts';export{buildCompartmentPlan,updateInteriorSpaceAccounting,updateInteriorDerivedData,interiorCacheBytes,clearInteriorCache}from'./src/interior/build.ts';export*from'./src/interior/query.ts';export*from'./src/interior/graph.ts';export*from'./src/interior/types.ts';export{finishProcurementDelivery}from'./src/procurement/result.ts';export{validateCompartmentPlan,interiorValidationCacheBytes}from'./src/interior/validate.ts';export{validateBlueprint}from'./src/validation/validate.ts';export{setPhysicalProfilingEnabled,physicalDiagnostics}from'./src/physical/diagnostics.ts';export{clearStructuralCache}from'./src/structure/build.ts';export{clearStructuralIntegrationCache}from'./src/structure/integrate.ts';export{clearPhysicalQueryCache}from'./src/physical/probe.ts';export{clearStructuralQueryCache}from'./src/structure/query.ts';export{armorRayProbe,preparePhysicalQueries}from'./src/physical/probe.ts';`, resolveDir: resolve(root) }, bundle: true, format: 'esm', platform: 'node', outfile: out }); }
if (process.argv[2] === 'build')
    await bundleInteriorAPI(process.argv[3], process.argv[4]);
