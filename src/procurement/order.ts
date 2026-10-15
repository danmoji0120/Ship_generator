import { ARCHITECTURES, type ShipOrder, type ShipBlueprint } from '../blueprint/types';
import { SHIPYARDS } from '../shipyards/config';
import { ARMOR_MATERIALS, HULL_MATERIALS } from '../physical/materials';
import { DesignRejection } from '../generation/production/requirements';
import { PROCUREMENT_CLASSES, PROCUREMENT_PRIORITIES, type ProcurementOrder, type ProcurementPriority } from './types';
export const DEFAULT_PROCUREMENT_ORDER: ProcurementOrder = { version: '1.8.6.0.2', shipyardId: 'aegis', shipClass: 'Cruiser', lengthM: 300, seed: 7, targetMassKg: 1e9, primaryPriority: 'BALANCED', architecture: { mode: 'AUTO' }, mainArmor: { mode: 'AUTO' }, auxiliaryArmor: { mode: 'AUTO' }, hull: { mode: 'AUTO' }, armorDistribution: 'BALANCED', armorZoneRequirements: [] };
export function rejectProcurement(code: string, reason: string): never { throw new DesignRejection([code], [], reason); }
export function validateProcurementOrder(value: unknown): string[] {
    const o = value as ProcurementOrder, errors: string[] = [];
    if (!o || typeof o !== 'object' || o.version !== '1.8.6.0.2')
        return ['UNSUPPORTED_PROCUREMENT_ORDER_VERSION'];
    if (!SHIPYARDS.some(y => y.id === o.shipyardId))
        errors.push('UNKNOWN_SHIPYARD');
    if (!PROCUREMENT_CLASSES.includes(o.shipClass))
        errors.push('UNSUPPORTED_PROCUREMENT_CLASS');
    if (!Number.isFinite(o.lengthM) || o.lengthM < 40 || o.lengthM > 600)
        errors.push('LENGTH_OUTSIDE_40_600_M');
    if (!Number.isInteger(o.seed) || o.seed < 0 || o.seed > 4294967295)
        errors.push('INVALID_SEED');
    if (!Number.isFinite(o.targetMassKg) || o.targetMassKg <= 0)
        errors.push('INVALID_TARGET_MASS');
    if (o.maximumBaseMassKg !== undefined && (!Number.isFinite(o.maximumBaseMassKg) || o.maximumBaseMassKg <= 0))
        errors.push('INVALID_MAXIMUM_BASE_MASS');
    if (!['BALANCED', ...PROCUREMENT_PRIORITIES].includes(o.primaryPriority))
        errors.push('INVALID_PRIMARY_PRIORITY');
    if (o.secondaryPriority !== undefined && (!PROCUREMENT_PRIORITIES.includes(o.secondaryPriority) || o.primaryPriority === o.secondaryPriority))
        errors.push('INVALID_SECONDARY_PRIORITY');
    if (!o.architecture || !['AUTO', 'PREFER', 'REQUIRE'].includes(o.architecture.mode) || (o.architecture.mode !== 'AUTO' && !ARCHITECTURES.includes(o.architecture.grammar)))
        errors.push('INVALID_ARCHITECTURE_SELECTION');
    for (const [field, registry] of [['mainArmor', ARMOR_MATERIALS], ['auxiliaryArmor', ARMOR_MATERIALS], ['hull', HULL_MATERIALS]] as const) {
        const s = o[field];
        if (!s || !['AUTO', 'PREFER', 'REQUIRE'].includes(s.mode) || (s.mode !== 'AUTO' && !Object.hasOwn(registry, s.materialId)) || (s.mode === 'AUTO' && s.materialId !== undefined))
            errors.push('INVALID_MATERIAL_SELECTION_' + field);
    }
    if (!['CITADEL', 'BALANCED', 'BROAD_COVERAGE'].includes(o.armorDistribution))
        errors.push('INVALID_ARMOR_DISTRIBUTION');
    if (!Array.isArray(o.armorZoneRequirements) || o.armorZoneRequirements.length > 1)
        errors.push('INVALID_ARMOR_ZONE_REQUIREMENTS');
    else
        for (const r of o.armorZoneRequirements)
            if (!r || typeof r !== 'object' || r.zone !== 'CRITICAL_ZONE' || r.verification !== 'EXPOSED_FACET_CENTERS')
                errors.push('UNSUPPORTED_ARMOR_ZONE_OR_VERIFICATION');
            else if (!Number.isFinite(r.minimumThicknessMm) || r.minimumThicknessMm <= 0 || r.minimumThicknessMm > 2000)
                errors.push('INVALID_MINIMUM_ARMOR_THICKNESS');
    if (o.maximumCostIndex !== undefined && (!Number.isFinite(o.maximumCostIndex) || o.maximumCostIndex <= 0))
        errors.push('INVALID_COST_LIMIT');
    if (o.availableTechLevel !== undefined && (!Number.isInteger(o.availableTechLevel) || o.availableTechLevel < 1 || o.availableTechLevel > 5))
        errors.push('INVALID_TECH_LEVEL');
    return errors;
}
export function normalizeProcurementOrder(value: unknown) { const errors = validateProcurementOrder(value); if (errors.length)
    rejectProcurement('INVALID_PROCUREMENT_ORDER', errors.join('; ')); return structuredClone(value as ProcurementOrder); }
export function procurementWeights(o: ProcurementOrder) { return Object.fromEntries(PROCUREMENT_PRIORITIES.map(p => [p, o.primaryPriority === p ? 100 : o.secondaryPriority === p ? 70 : 40])) as Record<ProcurementPriority, number>; }
/** Geometry compatibility DTO only. No offensive target, budget or role requirement plan is created.
 * Removed axes are immutable zero inputs, not player-facing design priorities. Native order is authority. */
export function geometryOrder(o: ProcurementOrder): ShipOrder { const w = procurementWeights(o); return { role: o.shipClass, shipyardId: o.shipyardId, length: o.lengthM, massClass: 'Standard', priorities: { firepower: 0, missile: 0, sensor: 0, survivability: w.ARMOR, mobility: w.MOBILITY, endurance: w.ENDURANCE } }; }
/** Explicit conversion creates a NEW design order; the saved ship and its equipment are untouched. */
export function convertLegacyOrder(b: ShipBlueprint) {
    const old = b.order, role = PROCUREMENT_CLASSES.includes(old.role as any) ? old.role as ProcurementOrder['shipClass'] : 'Cruiser';
    const o: ProcurementOrder = { ...structuredClone(DEFAULT_PROCUREMENT_ORDER), shipyardId: old.shipyardId, shipClass: role, lengthM: old.length, seed: b.seed, targetMassKg: old.targetDryMassKg ?? b.physicalDesign?.mass.targetMassKg ?? b.dimensions.estimatedMass * 1000, architecture: { mode: 'REQUIRE', grammar: b.architecture.grammar }, primaryPriority: old.priorities.survivability >= old.priorities.mobility && old.priorities.survivability >= old.priorities.endurance ? 'ARMOR' : old.priorities.mobility >= old.priorities.endurance ? 'MOBILITY' : 'ENDURANCE' };
    return { order: o, conversion: { sourceVersion: b.generatorVersion, originalRole: b.role, discardedPriorities: ['firepower', 'missile', 'sensor'], equipmentHandling: 'ORIGINAL_BLUEPRINT_UNCHANGED_NEW_DESIGN_UNARMED' as const, warning: 'Explicit new-order conversion. Removed attack priorities are discarded; protected/mobility/endurance rank selects the new primary. Weapon-specialized legacy classes map to Cruiser. Geometry/materials will be redesigned; original installed equipment remains on the loaded ship.' } };
}
