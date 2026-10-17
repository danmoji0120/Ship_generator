import {readFile,writeFile} from 'node:fs/promises';
const api=await import(process.argv[2]??'/tmp/integrity-after.mjs'),o=JSON.parse(await readFile('qa/v1.8.6.3.1/order.json')),rows=[];api.setPhysicalProfilingEnabled(true);
for(const stage of ['COLD','WARM_HIT','FUNCTIONAL_CACHE_MISS','CHANGED_SEED','CHANGED_PRIORITY']){
 if(stage==='FUNCTIONAL_CACHE_MISS')api.clearFunctionalPlanCache?.();
 const order=stage==='CHANGED_SEED'?{...o,seed:o.seed+1}:stage==='CHANGED_PRIORITY'?{...o,primaryPriority:'ARMOR'}:o;global.gc?.();const start=performance.now();try{let b=api.generateProcurementBlueprint(order);rows.push({stage,ms:performance.now()-start,profile:api.physicalDiagnostics(b),mass:b.physicalDesign.mass.ledger.baseEstimatedDryMassKg,equipment:b.functionalSystems.equipment.length,planCacheEstimatedBytes:api.functionalPlanCacheBytes?.(),memory:process.memoryUsage()});b=null;}catch(e){rows.push({stage,ms:performance.now()-start,rejection:String(e)});}
}
await writeFile('qa/v1.8.6.3.1/variants.json',JSON.stringify({method:'One additional process; FUNCTIONAL_CACHE_MISS clears only functional plan template, other geometry caches deliberately warm. Changed inputs force their own actual source identities. Not pooled into five-process median.',rows},null,2));
