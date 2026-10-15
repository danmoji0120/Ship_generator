import {readFile,writeFile,mkdir}from'node:fs/promises';import{gunzipSync,gzipSync}from'node:zlib';import assert from'node:assert/strict';import{pathToFileURL}from'node:url';import{resolve}from'node:path';
const api=await import(pathToFileURL(resolve(process.argv[2]??'/tmp/procurement-after.mjs'))),out='qa/v1.8.6.0.2',rows=[];
const read=async p=>JSON.parse(gunzipSync(await readFile(`${out}/fixtures/${p}.json.gz`)).toString());
const summary=b=>{const p=b.physicalDesign,m=p.mass,o=b.procurement.order,a=p.surfaces.filter(s=>s.kind==='ARMOR');return{order:o,status:b.procurement.status,architecture:b.architecture.grammar,family:b.macroDesign.family,main:p.policy.criticalArmorMaterialPreference,auxiliary:p.policy.armorMaterialPreference,hull:p.policy.hullMaterialPreference,armorMassT:m.armorMassKg/1000,hullMassT:m.hullShellMassKg/1000,baseMassT:m.ledger.baseEstimatedDryMassKg/1000,cost:b.procurement.cost,thicknessMm:[Math.min(...a.map(s=>s.thicknessMm)),Math.max(...a.map(s=>s.thicknessMm))],coverage:b.productionDesign.coverage.directions,physicalArea:p.coverage,armorGeometryCount:b.productionDesign.armor.length,finishCount:b.productionDesign.finish.length,automaticWeapons:b.weaponLayout.mounts.length+b.weaponLayout.integrated.length,engines:b.engines.length,navigation:b.procurement.coreSystems.navigationControlIds.length,allocationsKg:p.policy.allocationsKg,future:p.policy.future,compromises:b.procurement.compromises};};
for(const id of ['BALANCED','ARMOR','MOBILITY','ENDURANCE','ECONOMY']){const b=await read(id);assert.deepEqual(api.validateBlueprint(b),[]);rows.push({id,...summary(b)});}
assert(rows[1].armorMassT>rows[2].armorMassT);assert(rows[4].cost.total<rows[0].cost.total);assert(rows[3].future.compartmentSubdivisionPreference>rows[0].future.compartmentSubdivisionPreference);assert(rows.every(r=>r.automaticWeapons===0&&r.engines>0&&r.navigation>0));
const balanced=await read('BALANCED');
for(const distribution of ['CITADEL','BROAD_COVERAGE']){const b=api.generateProcurementBlueprint({...balanced.procurement.order,armorDistribution:distribution});rows.push({id:distribution,...summary(b)});await writeFile(`${out}/fixtures/${distribution}.json.gz`,gzipSync(JSON.stringify(b)));}
const broad=rows.find(r=>r.id==='BROAD_COVERAGE'),citadel=rows.find(r=>r.id==='CITADEL');assert(broad.finishCount>rows[0].finishCount&&rows[0].finishCount>citadel.finishCount);assert(citadel.thicknessMm[1]>broad.thicknessMm[1]);
const base={...api.DEFAULT_PROCUREMENT_ORDER,architecture:{mode:'REQUIRE',grammar:'MONOLITHIC'}};
for(const [id,patch]of [
 ['require-titanium-steel',{mainArmor:{mode:'REQUIRE',materialId:'TITANIUM_ARMOR'},hull:{mode:'REQUIRE',materialId:'HIGH_STRENGTH_STRUCTURAL_STEEL'}}],
 ['prefer-ceramic',{mainArmor:{mode:'PREFER',materialId:'CERAMIC_COMPOSITE'}}],
 ['prefer-nano-tech-substitution',{mainArmor:{mode:'PREFER',materialId:'NANO_LAMINATE'}}],
 ['critical-centers-1mm',{armorZoneRequirements:[{zone:'CRITICAL_ZONE',verification:'EXPOSED_FACET_CENTERS',minimumThicknessMm:1}]}]
]){const b=api.generateProcurementBlueprint({...base,...patch});assert.deepEqual(api.validateBlueprint(b),[]);rows.push({id,...summary(b),requirements:b.procurement.requirements});}
for(const [id,patch]of [
 ['require-nano-unavailable',{mainArmor:{mode:'REQUIRE',materialId:'NANO_LAMINATE'}}],
 ['require-titanium-strict-mass',{mainArmor:{mode:'REQUIRE',materialId:'TITANIUM_ARMOR'},maximumBaseMassKg:1}],
 ['hard-cost-reject',{maximumCostIndex:1}],
 ['unknown-material',{mainArmor:{mode:'REQUIRE',materialId:'MAGIC'}}],
 ['unsupported-full-zone',{armorZoneRequirements:[{zone:'FORE',minimumThicknessMm:300}]}]
]){let rejected=false;try{api.generateProcurementBlueprint({...base,...patch});}catch(e){rejected=true;rows.push({id,status:'REJECT',codes:e.codes,reason:e.message});}assert(rejected,id);}
await writeFile(`${out}/controlled-comparisons.json`,JSON.stringify(rows,null,2));console.log(rows.map(r=>`${r.id}: ${r.status}${r.baseMassT?' · '+Math.round(r.baseMassT)+'t':''}`).join('\n'));
