import {buildStructuralFrame} from '../structure/build';
import {integrateStructuralMaterial} from '../structure/integrate';
import {FAMILY_COMPATIBILITY,createMacroPlan} from '../generation/macro/plan';
import type { ArchitectureGrammar, ShipBlueprint } from '../blueprint/types';
import { generateBlueprint } from '../generation/generate';
import { SeededRng } from '../random/rng';
import { selectArchitecture, architectureWeights } from '../generation/architecture/selection';
import { getShipyard } from '../shipyards/config';
import { generateStructuralArmor, finishArmorCoverage } from '../generation/production/armor';
import { generateFunctionalExterior } from '../generation/production/functional';
import type { ProductionDesign } from '../generation/production/types';
import { extractArmorSurfaces } from '../generation/armor/surfaces';
import { boundsOf } from '../generation/integration/contours';
import { profileRing } from '../generation/hull';
import { addExteriorDetails } from '../generation/details/build';
import { addMesoStructures } from '../generation/meso/build';
import { applyMaterialAppearance } from '../rendering/appearance';
import { applySurfaceAppearance } from '../generation/appearance/build';
import { addPhysicalDesign } from '../physical/build';
import { validateBlueprint } from '../validation/validate';
import { capturePhysicalGeneration, timedPhysical } from '../physical/diagnostics';
import { normalizeProcurementOrder, geometryOrder, procurementWeights, rejectProcurement } from './order';
import { procurementMaterials } from './policy';
import { finishProcurementDelivery } from './result';
import type { ProcurementOrder } from './types';
function procurementArchitecture(o: ProcurementOrder) {
    const order = geometryOrder(o), yard = getShipyard(o.shipyardId), w = architectureWeights(order, yard), p = procurementWeights(o);
    if (p.ECONOMY >= 70) {
        w.MONOLITHIC *= 2;
        w.BLOCK_ASSEMBLY *= 1.4;
        w.HYBRID *= .5;
        w.TRUSS_POD *= .65;
    }
    let ticket = new SeededRng(o.seed).next() * Object.values(w).reduce((a, c) => a + c, 0);
    for (const [g, n] of Object.entries(w)) {
        ticket -= n;
        if (ticket <= 0)
            return g as ArchitectureGrammar;
    }
    return selectArchitecture(order, yard, new SeededRng(o.seed)).grammar;
}
function bounds(b: ShipBlueprint) { return boundsOf([...b.structuralVolumes.flatMap(v => v.geometry.stations.flatMap(s => profileRing(s).map(([x, y]) => ({ x: x + v.position.x, y: y + v.position.y, z: s.z + v.position.z })))), ...b.productionDesign!.armor.flatMap(c => c.solid.vertices), ...b.productionDesign!.finish.flatMap(c => c.solid.vertices), ...b.prefabPlacements!.flatMap(p => p.assembly?.parts.flatMap(p => p.solid.vertices) ?? p.exterior?.rings?.flat() ?? []), ...b.engines.flatMap(e => [{ x: e.position.x - e.nozzleRadius * (e.bellRatio + .12), y: e.position.y - e.nozzleRadius * (e.bellRatio + .12), z: e.position.z }, { x: e.position.x + e.nozzleRadius * (e.bellRatio + .12), y: e.position.y + e.nozzleRadius * (e.bellRatio + .12), z: e.position.z + e.nozzleLength + e.nozzleRadius * .12 }])]); }
/** Native procurement bypasses combat role requirements, integrated-armament planning
 * and productionWeaponComposition entirely. Shared hull/armor/visual builders remain authoritative. */
export function generateProcurementBlueprint(input: ProcurementOrder, options:{version?:'1.8.6.0.2'|'1.8.6.1'}={}): ShipBlueprint {
    return capturePhysicalGeneration(() => {
        const o = normalizeProcurementOrder(input);
        procurementMaterials(o); // fail impossible technology before geometry
        const auto = procurementArchitecture(o), requested = o.architecture.mode === 'AUTO' ? auto : o.architecture.grammar;
        const bridge=geometryOrder(o),yard=getShipyard(o.shipyardId),ranked=Object.entries(architectureWeights(bridge,yard)).sort((a,b)=>b[1]-a[1]).map(([g])=>g as ArchitectureGrammar);
        const architectures=o.architecture.mode==='REQUIRE'?[requested]:[...new Set([requested,auto,...ranked])].slice(0,3);
        const rejected:NonNullable<ShipBlueprint['procurement']>['candidateRejections']=[];
        let selected:ShipBlueprint|undefined;
        search:for(const grammar of architectures){
          const firstFamily=createMacroPlan(bridge,yard,grammar,o.seed).family;
          for(const family of [firstFamily,...FAMILY_COMPATIBILITY[grammar].filter(f=>f!==firstFamily)]){
            try{selected=timedPhysical('Procurement hull',()=>generateBlueprint(bridge,o.seed,{version:'1.8',productionBase:true,architecture:grammar,...(family!==firstFamily?{family}:{})}));break search;}
            catch(error){rejected.push({architecture:grammar,family,reason:error instanceof Error?error.message:String(error)});}
          }
        }
        if(!selected)rejectProcurement('REQUIRED_ARCHITECTURE_STRUCTURE_INVALID',rejected.map(r=>`${r.architecture}/${r.family}: ${r.reason}`).join('\n'));
        const b=selected;
        b.architecture.source='order';b.macroDesign!.source='order';
        b.procurement = { version: '1.8.6.0.2', contract: 'UNARMED_YARD_DESIGN', order: o, status: 'PASS', compromises: [], materialDecisions: [], requirements: [], massConfidence: 'ESTIMATE_INCLUDES_UNGENERATED_FRAME_AND_SUPPORT' };
        if(rejected.length)b.procurement.candidateRejections=rejected;
        if (o.architecture.mode === 'PREFER' && b.architecture.grammar !== requested)
            b.procurement.compromises.push('Preferred architecture was physically invalid; AUTO alternative selected.');
        b.generatorVersion = '1.8.4';
        const d: ProductionDesign = { status: 'generated', pipelineVersion: '1.8.4', family: b.macroDesign!.family, axisAligned: true, armor: [], finish: [], channels: [], zones: extractArmorSurfaces(b).zones, coverage: null as any, functionalPrefabIds: [], overallBounds: boundsOf([]), decisions: [], attempts: [], stages: [{ stage: 'procurement', input: 'Native four-priority order; no offensive targets or XL reservations', output: 'Shared Hull / Armor / basic propulsion and navigation / player-owned loadout' }], validation: { issues: [], checks: [] } };
        b.productionDesign = d;
        timedPhysical('Procurement structural armor', () => generateStructuralArmor(b, d, 0));
        timedPhysical('Procurement armor coverage', () => finishArmorCoverage(b, d));
        // Shared core builder books mass/volume; actual surface contact is geometric.
        // It reports zero abstract surface usage, so no synthetic unlimited allowance is needed.
        const volume = b.structuralVolumes.reduce((n, v) => n + v.dimensions.x * v.dimensions.y * v.dimensions.z, 0), w = procurementWeights(o), resources = (fraction: number) => ({ massTonnes: b.dimensions.estimatedMass * fraction, volumeM3: volume * fraction, surfaceM2: 0 });
        const allocations = { structure: resources(.2), armor: resources(.2), propulsion: resources(.12 + w.MOBILITY * .001), endurance: resources(.05 + w.ENDURANCE * .0015), sensor: resources(.035), weapons: resources(0) };
        const support = { allocations, total: resources(1), adjustments: [] as {
                groupId: string;
                reason: string;
            }[] };
        timedPhysical('Procurement core systems', () => generateFunctionalExterior(b, d, support));
        d.overallBounds = bounds(b);
        b.weaponLayout = { status: 'production', standardsVersion: '1.8.3', sourceVersion: '1.8.4', sourceSeed: b.seed, budget: { available: 0, integratedReserve: 0, allocated: 0, countLimit: 0, byRegion: { TOP: 0, BOTTOM: 0, PORT: 0, STARBOARD: 0 } }, composition: [], groups: [], mounts: [], prefabIds: [], retiredHardpointIds: [], supersededFoundationIds: [], integrated: [], attempts: [], omissions: [], overallBounds: d.overallBounds, validation: { issues: [], checks: ['Native unarmed delivery; no automated offensive planning'] } };
        b.freeMountPlan = { version: '1.8.5.5', nextId: 1, entries: [], internalValidation: 'NOT_PERFORMED' };
        timedPhysical('Procurement exterior details', () => addExteriorDetails(b));
        timedPhysical('Procurement meso', () => addMesoStructures(b));
        applyMaterialAppearance(b);
        applySurfaceAppearance(b);
        const withFrame=options.version!=='1.8.6.0.2';
        b.generatorVersion = withFrame?'1.8.6.1':'1.8.6.0.2';
        if(withFrame){try{buildStructuralFrame(b);}catch(error){const reason=error instanceof Error?error.message:String(error);rejectProcurement(reason.split(' ')[0],reason);}}
        timedPhysical('Procurement physical build', () => addPhysicalDesign(b));
        if(withFrame){try{integrateStructuralMaterial(b);}catch(error){const reason=error instanceof Error?error.message:String(error);rejectProcurement(reason.split(' ')[0],reason);}}
        timedPhysical('Procurement requirement verification', () => finishProcurementDelivery(b));
        const issues = timedPhysical('Procurement final validation', () => validateBlueprint(b));
        if (issues.length)
            rejectProcurement('REQUIRED_PROCUREMENT_DESIGN_INVALID', issues.join('; '));
        return b;
    });
}
