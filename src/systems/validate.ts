import {functionalInput,FUNCTIONAL_CACHE_LIMIT_BYTES} from './cache';
import type { ShipBlueprint } from '../blueprint/types';
import { prepareInteriorQueries, placementBox, releaseInteriorQueries } from '../interior/query';
import { systemSpecification } from './registry';
import { equipmentOverlap } from './build';
import { installedSystemLoads } from './types';
import { evaluateSystemPlan } from './evaluate';
import { cellVolume, solidCell } from '../physical/convex';
// Exact content identities; source mutation always invalidates. One bounded entry.
let lastKey: string[] | undefined;
export const functionalValidationCacheBytes = () => lastKey ? lastKey.reduce((n,k)=>n+k.length*2,0) : 0;
export const clearFunctionalValidationCache = () => { lastKey = undefined; };
export function validateFunctionalSystems(b: ShipBlueprint): string[] {
    const p = b.functionalSystems;
    if (!p)
        return ['1.8.6.3','1.8.6.3.1'].includes(b.generatorVersion) ? ['Required functional system plan absent'] : [];
    if (!b.compartmentPlan || !b.procurement)
        return ['Functional systems require confirmed interior and native order'];
    const key = [JSON.stringify(p), functionalInput(b), JSON.stringify([b.physicalDesign?.mass.functionalEquipmentMassKg,b.physicalDesign?.mass.unresolvedMassEstimateKg,installedSystemLoads(b)])];
    if (lastKey?.every((v,i)=>v===key[i])) {
        releaseInteriorQueries(b);
        return [];
    }
    try {
        if (p.version !== '1.8.6.3' || p.registryVersion !== 1 || p.schemaVersion !== 1 || new Set(p.equipment.map(e => e.id)).size !== p.equipment.length)
            throw Error('FUNCTIONAL_SCHEMA_OR_IDS_INVALID');
        for (const type of ['POWER_GENERATOR', 'POWER_DISTRIBUTION', 'COMMAND_CONTROL', 'PROPULSION_CONTROL', 'MANEUVER_CONTROL', 'FIRE_CONTROL', 'SENSOR_PROCESSING'])
            if (!p.equipment.some(e => e.type === type))
                throw Error('REQUIRED_FUNCTIONAL_TYPE_ABSENT ' + type);
        const q = prepareInteriorQueries(b), ids = new Set(p.equipment.map(e => e.id)), engines = b.engines.map(e => e.id), rcs = b.exteriorDetailPlan?.kitPlacements.filter(e => e.kit === 'RCS_CLUSTER').map(e => e.id) ?? [], validRefs = new Set([...engines, ...rcs]);
        if (JSON.stringify(p.engineRefs) !== JSON.stringify(engines) || p.maneuverRefs.some(id => !validRefs.has(id)))
            throw Error('FUNCTIONAL_ENGINE_OR_RCS_REFERENCE_INVALID');
        for (const e of p.equipment) {
            const room = b.compartmentPlan.compartments.find(c => c.id === e.compartmentId), expected = systemSpecification(e.type, b.procurement.order.primaryPriority);
            if (!room || room.boundaryCertainty !== 'FINITE_MATERIAL_CLOSURE' || room.parentStructuralVolumeRef !== e.parentStructuralVolumeRef || JSON.stringify(expected) !== JSON.stringify(e.specification) || e.massKg !== expected.massKg || e.costIndex !== expected.costIndex || e.materialId !== expected.materialId || JSON.stringify(e.sizeM) !== JSON.stringify(expected.sizeM) || e.clearanceM !== .2 || JSON.stringify(e.quaternion) !== JSON.stringify({ x: 0, y: 0, z: 0, w: 1 }))
                throw Error('FUNCTIONAL_SPECIFICATION_OR_COMPARTMENT_INVALID ' + e.id);
            if (JSON.stringify(e.solid) !== JSON.stringify(placementBox(e.position, e.sizeM)) || !q.fits(e.compartmentId, placementBox(e.position, e.sizeM, e.clearanceM)) || Math.abs(cellVolume(solidCell(e.solid)) - e.sizeM.x * e.sizeM.y * e.sizeM.z) > 1e-5)
                throw Error('FUNCTIONAL_FINITE_GEOMETRY_INVALID ' + e.id);
            if (e.supportedEquipmentRefs.some(id => !validRefs.has(id)) || e.structuralReferences.some(id => !b.structuralFrame?.members.some(m => m.id === id)) || e.protection.armorSurfaceIds.some(id => !b.physicalDesign?.surfaces.some(s => s.id === id && s.kind === 'ARMOR')))
                throw Error('FUNCTIONAL_TARGET_REFERENCE_INVALID ' + e.id);
        }
        for (let i = 0; i < p.equipment.length; i++)
            for (let j = 0; j < i; j++)
                if (equipmentOverlap(p.equipment[i], p.equipment[j]))
                    throw Error('FUNCTIONAL_EQUIPMENT_OVERLAP');
        for (const list of [p.powerNetwork, p.controlNetwork]) {
            if (new Set(list.map(e => e.id)).size !== list.length)
                throw Error('FUNCTIONAL_EDGE_IDS_DUPLICATED');
            for (const edge of list)
                if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || edge.capacityMW !== undefined && (!Number.isFinite(edge.capacityMW) || edge.capacityMW <= 0) || edge.compartmentRefs.some(id => !b.compartmentPlan!.compartments.some(c => c.id === id)))
                    throw Error('FUNCTIONAL_GHOST_EDGE_OR_CAPACITY');
        }
        for (const edge of p.powerNetwork) {
            const a = p.equipment.find(e => e.id === edge.from)!, c = p.equipment.find(e => e.id === edge.to)!;
            if (!['POWER_GENERATOR', 'POWER_DISTRIBUTION', 'ENERGY_STORAGE'].includes(a.type) || c.type === 'POWER_GENERATOR')
                throw Error('FUNCTIONAL_POWER_EDGE_TYPE_INVALID');
        }
        const mass = p.equipment.reduce((n, e) => n + e.massKg, 0);
        if (p.massAccounting.equipmentKg !== mass || p.massAccounting.retiredServiceEstimateKg !== 0 || p.massAccounting.remainingServiceEstimateKg !== b.physicalDesign?.mass.unresolvedMassEstimateKg || b.physicalDesign.mass.functionalEquipmentMassKg !== mass)
            throw Error('FUNCTIONAL_MASS_ACCOUNTING_INVALID');
        const cap = evaluateSystemPlan(p, undefined, installedSystemLoads(b));
        if (cap.commandAvailability <= 0 || cap.propulsionAuthority <= 0 || cap.maneuverAuthority <= 0)
            throw Error('REQUIRED_FUNCTIONAL_CAPABILITY_UNAVAILABLE');
        lastKey = key.reduce((n,k)=>n+k.length*2,0)<=FUNCTIONAL_CACHE_LIMIT_BYTES?key:undefined;
        return [];
    }
    catch (error) {
        return [error instanceof Error ? error.message : String(error)];
    }
    finally {
        releaseInteriorQueries(b);
    }
}
