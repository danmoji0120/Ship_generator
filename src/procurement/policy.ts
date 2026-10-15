import type { ShipBlueprint } from '../blueprint/types';
import type { PhysicalSource } from '../physical/geometry';
import type { DesignPolicy } from '../physical/types';
import { ARMOR_MATERIALS, HULL_MATERIALS, MATERIALS, type ArmorMaterialId, type HullMaterialId } from '../physical/materials';
import { coreEquipmentMass } from '../physical/policy';
import { procurementWeights, rejectProcurement } from './order';
import type { ProcurementOrder, Selection } from './types';
export const YARD_TECH = { aegis: 4, vesper: 4, forge: 3, serein: 5 } as const;
export function procurementMaterials(o: ProcurementOrder) {
    const w = procurementWeights(o), tech = Math.min(YARD_TECH[o.shipyardId as keyof typeof YARD_TECH], o.availableTechLevel ?? 5), decisions: NonNullable<ShipBlueprint['procurement']>['materialDecisions'] = [];
    const autoArmor: ArmorMaterialId = w.ECONOMY >= 70 ? 'ARMORED_STEEL' : w.MOBILITY >= 70 ? 'TITANIUM_ARMOR' : o.shipyardId === 'serein' && tech >= 5 ? 'NANO_LAMINATE' : o.shipyardId === 'forge' ? 'ARMORED_STEEL' : o.shipyardId === 'vesper' ? 'TITANIUM_ARMOR' : 'CERAMIC_COMPOSITE';
    function choose<T extends ArmorMaterialId | HullMaterialId>(field: 'mainArmor' | 'auxiliaryArmor' | 'hull', s: Selection<T>, automatic: T, registry: Record<T, {
        requiredTechLevel: number;
    }>): T {
        const fallback = registry[automatic].requiredTechLevel <= tech ? automatic : (field === 'hull' ? 'LIGHT_STRUCTURAL_ALLOY' : 'ARMORED_STEEL') as T;
        if (s.mode === 'AUTO') {
            decisions.push({ field, requested: 'AUTO', selected: fallback, reason: fallback === automatic ? 'Yard, four priorities and available technology' : 'AUTO technology ceiling required a manufacturable fallback' });
            return fallback;
        }
        if (registry[s.materialId].requiredTechLevel <= tech) {
            decisions.push({ field, requested: s.materialId, selected: s.materialId, reason: s.mode === 'REQUIRE' ? 'Mandatory material respected' : 'Preferred material feasible' });
            return s.materialId;
        }
        if (s.mode === 'REQUIRE')
            rejectProcurement('REQUIRED_MATERIAL_TECH_UNAVAILABLE', `${field}: ${s.materialId} requires tech ${registry[s.materialId].requiredTechLevel}; available ${tech}`);
        decisions.push({ field, requested: s.materialId, selected: fallback, reason: `Preferred material exceeds available tech ${tech}; explicit substitution` });
        return fallback;
    }
    const main = choose('mainArmor', o.mainArmor, w.ARMOR >= 80 && w.ECONOMY < 70 ? 'TUNGSTEN_COMPOSITE' : autoArmor, ARMOR_MATERIALS), auxiliary = choose('auxiliaryArmor', o.auxiliaryArmor, autoArmor, ARMOR_MATERIALS);
    const autoHull: HullMaterialId = w.ECONOMY >= 70 ? 'HIGH_STRENGTH_STRUCTURAL_STEEL' : w.MOBILITY >= 70 || o.shipyardId === 'vesper' ? 'LIGHT_STRUCTURAL_ALLOY' : w.ENDURANCE >= 80 || o.shipyardId === 'serein' ? 'TITANIUM_STRUCTURAL_ALLOY' : 'HIGH_STRENGTH_STRUCTURAL_STEEL';
    const hull = choose('hull', o.hull, autoHull, HULL_MATERIALS);
    return { main, auxiliary, hull, tech, decisions };
}
/** Floors are estimates plus conservative finite-skin area bounds. Reserves are allocations,
 * not extra installed mass. Target is soft; only an explicit maximum is a delivery gate. */
export function createProcurementPolicy(b: ShipBlueprint, sources: PhysicalSource[], minimumArmorMassKg: number): DesignPolicy {
    const o = b.procurement!.order, w = procurementWeights(o), chosen = procurementMaterials(o), legacy = b.dimensions.estimatedMass * 1000;
    let hull = chosen.hull;
    const hullThicknessMm = Math.max(8, Math.min(32, (9 + o.lengthM * .025) * (1 - w.MOBILITY * .002) * (1 + w.ENDURANCE * .0015)));
    const shell = (material: HullMaterialId) => sources.filter(s => s.kind === 'HULL').reduce((n, s) => n + s.areaM2 * hullThicknessMm / 1000 * HULL_MATERIALS[material].densityKgM3, 0);
    const fixedOther = legacy * .28 + coreEquipmentMass(b) + minimumArmorMassKg;
    if (o.maximumBaseMassKg !== undefined && fixedOther + shell(hull) > o.maximumBaseMassKg && o.hull.mode === 'PREFER' && hull !== 'LIGHT_STRUCTURAL_ALLOY') {
        const decision = chosen.decisions.find(d => d.field === 'hull')!;
        decision.selected = hull = 'LIGHT_STRUCTURAL_ALLOY';
        decision.reason = 'Preferred Hull conservative minimum exceeds maximum base mass; substituted lighter structural alloy';
    }
    const floors = { structure: legacy * .18 + shell(hull), armor: minimumArmorMassKg, propulsion: legacy * .06, endurance: legacy * .04, sensor: 0, equipment: coreEquipmentMass(b) }, fixed = Object.values(floors).reduce((a, c) => a + c, 0);
    if (o.maximumBaseMassKg !== undefined && fixed >= o.maximumBaseMassKg)
        rejectProcurement('REQUIRED_MAXIMUM_BASE_MASS_UNAVAILABLE', `Minimum Hull/armor and estimated structure/support ${fixed.toFixed(1)}kg exceeds maximum ${o.maximumBaseMassKg}kg; REQUIRE materials were not relaxed`);
    const planning = Math.min(o.maximumBaseMassKg ?? Infinity, Math.max(o.targetMassKg, fixed * 1.05)), weights = { structure: 1, armor: .6 + w.ARMOR * .06, propulsion: .6 + w.MOBILITY * .05, endurance: .6 + w.ENDURANCE * .05, sensor: .15, equipment: .5 }, sum = Object.values(weights).reduce((a, c) => a + c, 0);
    const allocationsKg = Object.fromEntries(Object.entries(weights).map(([key, v]) => [key, floors[key as keyof typeof floors] + (planning - fixed) * v / sum])) as DesignPolicy['allocationsKg'];
    b.procurement!.materialDecisions = chosen.decisions;
    return { version: '1.8.6.0.2', priorityWeights: w, priorityMapping: { ARMOR: 'ARMOR', MOBILITY: 'MOBILITY', ENDURANCE: 'ENDURANCE', ECONOMY: 'ECONOMY' }, targetMassBudgetKg: o.targetMassKg, planningMassBudgetKg: planning, maximumBaseMassKg: o.maximumBaseMassKg ?? null, budgetSource: 'PROCUREMENT_TARGET', allocationsKg, hullMaterialPreference: hull, armorMaterialPreference: chosen.auxiliary, criticalArmorMaterialPreference: chosen.main, hullThicknessMm, armorCoveragePreference: { CITADEL: .55, BALANCED: .75, BROAD_COVERAGE: .95 }[o.armorDistribution], criticalZoneProtectionPreference: .55 + w.ARMOR * .004, costPreference: w.ECONOMY / 100, manufacturingTechPreference: chosen.tech, legacyDoctrineReference: 'RESERVATION_MODEL_NOT_ADDITIONAL_PHYSICAL_MASS', future: { status: 'POLICY_ONLY_NOT_GENERATED', frameDensityPreference: .4 + w.ARMOR * .003 - w.MOBILITY * .001, frameRedundancyPreference: .2 + w.ENDURANCE * .005, compartmentSubdivisionPreference: .2 + w.ENDURANCE * .006, bulkheadProtectionPreference: .3 + w.ARMOR * .003, systemRedundancyPreference: .2 + w.ENDURANCE * .006, systemPlacementPreference: w.ENDURANCE >= 70 ? 'DISTRIBUTED' : 'PROTECTED_CORE', protectedVolumePreference: .4 + w.ARMOR * .003, propulsionSupportPreference: .3 + w.MOBILITY * .004, fireControlProtectionPreference: 0, missileSupportProtectionPreference: 0, sensorSupportProtectionPreference: 0 }, tradeoffs: [
            'Four native procurement priorities share finite mass reserves; no offensive weapon targets or XL reservations.',
            'Target mass is a soft objective. Maximum base mass, if supplied, is enforced against an estimate including unresolved frame/support.',
            'Endurance subdivisions/redundancy and maneuver performance are future policy only; no fabricated internal systems.',
            'Core navigation/control housings and attached propulsion are preserved; player combat sensors are not automatically fitted.',
            ...(planning > o.targetMassKg ? ['Minimum valid design allocation exceeds soft target; no mandatory system removed.'] : []),
            ...chosen.decisions.filter(d => d.requested !== 'AUTO' && d.requested !== d.selected).map(d => d.reason)
        ] };
}
export function nominalProcurementThickness(b: ShipBlueprint, s: PhysicalSource) {
    const o = b.procurement!.order, w = procurementWeights(o), dist = o.armorDistribution, critical = s.zone === 'CRITICAL';
    const factor = critical ? (dist === 'CITADEL' ? 1.55 : dist === 'BALANCED' ? 1.25 : 1.05) : (s.sourceKind === 'PRODUCTION_FINISH' ? (dist === 'BROAD_COVERAGE' ? .65 : .5) : dist === 'CITADEL' ? .6 : .85);
    return Math.max(45, (90 + o.lengthM * .42) * (.7 + w.ARMOR * .008) * (1 - w.MOBILITY * .003) * factor);
}
export function minimumProcurementThickness(b: ShipBlueprint, s: PhysicalSource, hullMm: number) { return s.kind === 'HULL' ? 8 : Math.max(30, hullMm * 1.25, s.zone === 'CRITICAL' ? (b.procurement!.order.armorZoneRequirements[0]?.minimumThicknessMm ?? 0) : 0); }
