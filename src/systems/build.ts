import type { ShipBlueprint, Vec3 } from '../blueprint/types';
import type { EquipmentType, FunctionalEquipment, FunctionalSystemPlan, SystemEdge } from './types';
import { prepareInteriorQueries, placementBox, releaseInteriorQueries } from '../interior/query';
import { systemSpecification } from './registry';
import { evaluateSystemPlan } from './evaluate';
import { preparePhysicalQueries } from '../physical/probe';
import { timedPhysical } from '../physical/diagnostics';
import { refreshPhysicalMass } from '../physical/policy';
import { boundsOf } from '../generation/integration/contours';
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function equipmentOverlap(a: FunctionalEquipment, b: FunctionalEquipment) { const x = boundsOf(placementBox(a.position, a.sizeM, a.clearanceM).vertices), y = boundsOf(placementBox(b.position, b.sizeM, b.clearanceM).vertices); return (['x', 'y', 'z'] as const).every(k => Math.min(x.max[k], y.max[k]) - Math.max(x.min[k], y.min[k]) > 1e-7); }
const grammar: Record<string, string> = { MONOLITHIC: 'CONTINUOUS_BAY_PROTECTED_CORE', BLOCK_ASSEMBLY: 'BLOCK_LOCAL_SERVICES', SPINE_AND_MODULES: 'CONFIRMED_MODULES_NO_SPINE', TRUSS_POD: 'POD_LOCAL_POWER_AND_CONTROL', TWIN_HULL: 'INDEPENDENT_LATERAL_PLANTS', CORE_AND_NACELLES: 'CORE_WITH_NACELLE_CONTROL', STACKED_BLOCKS: 'DECK_LOCAL_SERVICES', HYBRID: 'ACTUAL_HOST_GRAMMAR_DISTRIBUTION' };
export function buildFunctionalSystems(b: ShipBlueprint) {
    return timedPhysical('Functional systems', () => {
        if (!b.compartmentPlan || !b.procurement || !b.structuralFrame)
            throw Error('REQUIRED_FUNCTIONAL_INTERIOR_ABSENT');
        const mode = b.procurement.order.primaryPriority, rooms = b.compartmentPlan.compartments.filter(c => c.boundaryCertainty === 'FINITE_MATERIAL_CLOSURE'), q = timedPhysical('Functional query preparation', () => prepareInteriorQueries(b));
        const maneuverRefs = b.exteriorDetailPlan?.kitPlacements.filter(e => e.kit === 'RCS_CLUSTER').map(e => e.id) ?? [];
        // If there are no distinct RCS in the stored model, attitude authority is a
        // declared controller interface to existing engines, not invented RCS geometry.
        const plan: FunctionalSystemPlan = { schemaVersion: 1, version: '1.8.6.3', registryVersion: 1, equipment: [], powerNetwork: [], controlNetwork: [], engineRefs: b.engines.map(e => e.id), maneuverRefs: maneuverRefs.length ? maneuverRefs : b.engines.map(e => e.id), architecturePolicy: grammar[b.architecture.grammar], massAccounting: { equipmentKg: 0, retiredServiceEstimateKg: 0, remainingServiceEstimateKg: b.physicalDesign!.mass.unresolvedMassEstimateKg, basis: 'New specification masses separate from existing exterior housing estimates. Unresolved 10% service proxy has no itemized scope; retained as conservative unallocated estimate, potentially overlapping. No arbitrary deduction claimed.' }, warnings: ['Logical power/control routes, not verified physical cables. No fuel, heat, thrust, radar range or live damage simulation.', ...(!maneuverRefs.length ? ['No discrete RCS identified; maneuver authority is the control interface to existing engine references, not verified torque.'] : [])] };
        const physical = timedPhysical('Functional protection query preparation', () => preparePhysicalQueries(b)), protectionCache = new Map<string, FunctionalEquipment['protection']>();
        function protection(point: Vec3) { const key = JSON.stringify(point), old = protectionCache.get(key); if (old)
            return old; const hits = []; for (const d of [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }])
            hits.push(...physical.probe(point, d, b.order.length * 2).hits.filter(h => h.plateId !== undefined)); const r = { armorSurfaceIds: [...new Set(hits.map(h => h.surfaceId))], sampledArmorPathMm: hits.reduce((n, h) => n + h.pathLengthM * 1000, 0), method: 'SIX_AXIS_FINITE_SURFACE_INTERSECTIONS_NOT_SURVIVAL_PROBABILITY' as const }; protectionCache.set(key, r); return r; }
        const regional = ['TRUSS_POD', 'TWIN_HULL', 'BLOCK_ASSEMBLY', 'STACKED_BLOCKS', 'HYBRID'].includes(b.architecture.grammar), groups = mode === 'ENDURANCE' || regional ? 2 : 1, anchors = new Map<string, ReturnType<typeof q.placementCandidates>['candidates']>();
        function install(type: EquipmentType, group: number) {
            const spec = systemSpecification(type, mode), anchorKey = JSON.stringify(spec.sizeM);
            let candidates = anchors.get(anchorKey);
            if (!candidates) {
                candidates = q.placementCandidates(spec.sizeM, { clearanceM: .2, limit: 32 }).candidates;
                anchors.set(anchorKey, candidates);
            }
            const peers = plan.equipment.filter(e => e.type === type), ordered = [...candidates].sort((a, c) => {
                const rank = (x: typeof a) => {
                    const room = rooms.find(r => r.id === x.compartmentId)!, used = plan.equipment.filter(e => e.compartmentId === x.compartmentId).length;
                    const separation = peers.length ? Math.min(...peers.map(e => distance(e.position, x.position))) : 0;
                    let score = -used * 10 + (mode === 'ENDURANCE' ? separation * 4 : regional ? separation : 0);
                    if (type === 'PROPULSION_CONTROL')
                        score -= Math.min(...b.engines.map(e => distance(e.position, x.position))) * .1;
                    if (b.architecture.grammar === 'TWIN_HULL')
                        score += ((group === 0 ? -1 : 1) * x.position.x) * 2;
                    if (b.architecture.grammar === 'CORE_AND_NACELLES')
                        score += type === 'PROPULSION_CONTROL' && /nacelle/i.test(room.parentStructuralVolumeRef) ? 100 : 0;
                    if (mode === 'ARMOR')
                        score += protection(x.position).sampledArmorPathMm * .05;
                    return score;
                };
                return rank(c) - rank(a) || a.compartmentId.localeCompare(c.compartmentId);
            });
            for (const anchor of ordered)
                for (const offset of [{ x: 0, y: 0, z: 0 }, ...[-2, -1, 1, 2].flatMap(z => [-1, 0, 1].map(x => ({ x: x * (spec.sizeM.x + .6), y: 0, z: z * (spec.sizeM.z + .6) }))), ...[-1, 1].flatMap(y => [-1, 0, 1].map(z => ({ x: 0, y: y * (spec.sizeM.y + .6), z: z * (spec.sizeM.z + .6) })))]) {
                    const position = { x: anchor.position.x + offset.x, y: anchor.position.y + offset.y, z: anchor.position.z + offset.z }, room = rooms.find(r => r.id === anchor.compartmentId)!;
                    const e: FunctionalEquipment = { id: `system/${group}/${type}`, type, compartmentId: room.id, parentStructuralVolumeRef: room.parentStructuralVolumeRef, position, quaternion: { x: 0, y: 0, z: 0, w: 1 }, sizeM: { ...spec.sizeM }, clearanceM: .2, solid: placementBox(position, spec.sizeM), geometryReference: `system/${group}/${type}/OBB`, materialId: spec.materialId, massKg: spec.massKg, costIndex: spec.costIndex, specification: spec, supportedEquipmentRefs: [], structuralReferences: [...room.structuralFrameReferences], protection: { armorSurfaceIds: [], sampledArmorPathMm: 0, method: 'SIX_AXIS_FINITE_SURFACE_INTERSECTIONS_NOT_SURVIVAL_PROBABILITY' }, redundancyGroup: `plant/${group}`, initialState: 'OPERATIONAL' };
                    if (plan.equipment.some(old => equipmentOverlap(old, e)) || !q.fits(room.id, placementBox(position, e.sizeM, e.clearanceM)))
                        continue;
                    e.protection = protection(position);
                    plan.equipment.push(e);
                    return e;
                }
            throw Error(`REQUIRED_FUNCTIONAL_SPACE_UNAVAILABLE ${type} group ${group}; ${rooms.length} confirmed chambers; bounded real OBB search, no unresolved stock accepted`);
        }
        try {
            timedPhysical('Functional placement', () => { for (let g = 0; g < groups; g++)
                for (const type of ['POWER_GENERATOR', 'POWER_DISTRIBUTION', 'COMMAND_CONTROL', 'PROPULSION_CONTROL', 'MANEUVER_CONTROL', 'FIRE_CONTROL', 'SENSOR_PROCESSING', ...(mode === 'ENDURANCE' ? ['ENERGY_STORAGE'] : [])] as EquipmentType[])
                    install(type, g); });
            timedPhysical('Functional network construction', () => {
                const edge = (list: SystemEdge[], from: FunctionalEquipment, to: FunctionalEquipment, capacityMW?: number) => list.push({ id: `${list === plan.powerNetwork ? 'power' : 'control'}/${from.id}/${to.id}`, from: from.id, to: to.id, ...(capacityMW === undefined ? {} : { capacityMW }), compartmentRefs: [...new Set([from.compartmentId, to.compartmentId])], routing: 'LOGICAL_NOT_VERIFIED_CABLE_ROUTE' });
                for (let g = 0; g < groups; g++) {
                    const plant = plan.equipment.filter(e => e.redundancyGroup === `plant/${g}`), gen = plant.find(e => e.type === 'POWER_GENERATOR')!, bus = plant.find(e => e.type === 'POWER_DISTRIBUTION')!, cmd = plant.find(e => e.type === 'COMMAND_CONTROL')!;
                    edge(plan.powerNetwork, gen, bus, gen.specification.capacity);
                    for (const e of plant.filter(e => e.specification.demandMW > 0 || e.type === 'ENERGY_STORAGE')) {
                        edge(plan.powerNetwork, bus, e, bus.specification.capacity);
                        if (e.type !== 'COMMAND_CONTROL' && e.type !== 'ENERGY_STORAGE')
                            edge(plan.controlNetwork, cmd, e);
                    }
                    for (const e of plant.filter(e => e.type === 'ENERGY_STORAGE'))
                        edge(plan.powerNetwork, e, bus, e.specification.storageOutputMW);
                }
                if (mode === 'ENDURANCE' && groups > 1) {
                    const buses = plan.equipment.filter(e => e.type === 'POWER_DISTRIBUTION');
                    for (const a of buses)
                        for (const c of buses)
                            if (a !== c)
                                edge(plan.powerNetwork, a, c, 100);
                    for (const bus of buses)
                        for (const e of plan.equipment.filter(e => e.specification.demandMW > 0 && e.redundancyGroup !== bus.redundancyGroup))
                            edge(plan.powerNetwork, bus, e, 100);
                    for (const cmd of plan.equipment.filter(e => e.type === 'COMMAND_CONTROL'))
                        for (const e of plan.equipment.filter(e => ['PROPULSION_CONTROL', 'MANEUVER_CONTROL', 'FIRE_CONTROL', 'SENSOR_PROCESSING'].includes(e.type) && e.redundancyGroup !== cmd.redundancyGroup))
                            edge(plan.controlNetwork, cmd, e);
                }
                for (const type of ['PROPULSION_CONTROL', 'MANEUVER_CONTROL'] as const) {
                    const controllers = plan.equipment.filter(e => e.type === type), refs = type === 'PROPULSION_CONTROL' ? plan.engineRefs : plan.maneuverRefs;
                    refs.forEach((id, i) => { if (mode === 'ENDURANCE')
                        controllers.forEach(e => e.supportedEquipmentRefs.push(id));
                    else
                        controllers[i % controllers.length].supportedEquipmentRefs.push(id); });
                }
            });
            plan.massAccounting.equipmentKg = plan.equipment.reduce((n, e) => n + e.massKg, 0);
            const cap = timedPhysical('Functional capability evaluation', () => evaluateSystemPlan(plan));
            if (cap.commandAvailability <= 0 || cap.propulsionAuthority <= 0 || cap.maneuverAuthority <= 0)
                throw Error('REQUIRED_FUNCTIONAL_CAPABILITY_UNAVAILABLE');
            b.functionalSystems = plan;
            refreshPhysicalMass(b);
            b.physicalDesign!.policy.future.status = 'FRAME_COMPARTMENTS_SYSTEMS_APPLIED';
            return b;
        }
        finally {
            if (!b.functionalSystems)
                releaseInteriorQueries(b);
        }
    });
}
