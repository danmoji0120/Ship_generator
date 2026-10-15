import {mountStandard,sameMountStandard} from '../src/generation/weapons/standards';
import { it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { ShipBlueprint } from '../src/blueprint/types';
import { DEFAULT_PROCUREMENT_ORDER as defaults, validateProcurementOrder, convertLegacyOrder, geometryOrder, procurementWeights } from '../src/procurement/order';
import { generateProcurementBlueprint } from '../src/procurement/generate';
import { procurementMaterials } from '../src/procurement/policy';
import { procurementCost, procurementDesignIssues, criticalCenterThickness } from '../src/procurement/result';
import { validateBlueprint } from '../src/validation/validate';
import { physicalDiagnostics, setPhysicalProfilingEnabled } from '../src/physical/diagnostics';
import { MATERIALS } from '../src/physical/materials';
// These existing QA expectations certify the historical V1.8.6.0.2 generation contract.
// Current frame-enabled delivery has separate structural integration coverage.
const generate=(o:Parameters<typeof generateProcurementBlueprint>[0])=>generateProcurementBlueprint(o,{version:'1.8.6.0.2'});
let b: ShipBlueprint;
beforeAll(() => { setPhysicalProfilingEnabled(true); b = generate({ ...defaults, architecture: { mode: 'REQUIRE', grammar: 'MONOLITHIC' } }); }, 30000);
it('validates the native schema, numeric bounds, unsupported materials/zones and incomplete JSON', () => {
    expect(validateProcurementOrder(defaults)).toEqual([]);
    for (const patch of [{ seed: NaN }, { targetMassKg: 0 }, { maximumBaseMassKg: -1 }, { lengthM: 601 }, { primaryPriority: 'FIREPOWER' }, { secondaryPriority: 'SENSORS' }, { architecture: null }, { mainArmor: { mode: 'REQUIRE', materialId: 'magic' } }, { hull: { mode: 'REQUIRE', materialId: 'ARMORED_STEEL' } }, { armorZoneRequirements: [null] }, { armorZoneRequirements: [{ zone: 'FORE', minimumThicknessMm: 100 }] }, { availableTechLevel: 6 }])
        expect(validateProcurementOrder({ ...defaults, ...patch }).length).toBeGreaterThan(0);
});
it('separates all four native priorities from removed combat planning axes and reserves finite shared resources', () => {
    const o = { ...defaults, primaryPriority: 'ENDURANCE' as const, secondaryPriority: 'MOBILITY' as const }, w = procurementWeights(o), bridge = geometryOrder(o);
    expect(w).toEqual({ ARMOR: 40, MOBILITY: 70, ENDURANCE: 100, ECONOMY: 40 });
    expect(bridge.priorities.firepower + bridge.priorities.missile + bridge.priorities.sensor).toBe(0);
    const p = b.physicalDesign!.policy;
    expect(Object.keys(p.priorityWeights)).toEqual(['ARMOR', 'MOBILITY', 'ENDURANCE', 'ECONOMY']);
    expect(Object.values(p.allocationsKg).reduce((a, v) => a + v, 0)).toBeCloseTo(p.planningMassBudgetKg!, 1);
    expect(p.future.status).toBe('POLICY_ONLY_NOT_GENERATED');
});
it('delivers no attack mounts, integrated cannon, combat reservations or empty slots; keeps real core propulsion/navigation', () => {
    expect(b.hardpoints).toEqual([]);
    expect(b.weaponLayout!.mounts).toEqual([]);
    expect(b.weaponLayout!.integrated).toEqual([]);
    expect(b.designDoctrine).toBeUndefined();
    expect(b.designRequirements).toBeUndefined();
    expect(b.engines.length).toBeGreaterThan(0);
    expect(b.procurement!.coreSystems!.navigationControlIds.length).toBeGreaterThan(0);
    expect(validateBlueprint(b)).toEqual([]);
});
it('repeats deterministically with cache hit; export/import retains the native order and actual physical design', () => {
    const copy = generate(b.procurement!.order);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(b));
    expect(physicalDiagnostics(copy)!.cache.hits).toBeGreaterThan(0);
    const restored = JSON.parse(JSON.stringify(b));
    expect(validateBlueprint(restored)).toEqual([]);
    expect(restored.procurement.order).toEqual(b.procurement!.order);
}, 30000);
it('honors REQUIRE on critical main armor and independent Hull, including actual composite layer accounting', () => {
    const copy = generate({ ...defaults, architecture: { mode: 'REQUIRE', grammar: 'MONOLITHIC' }, mainArmor: { mode: 'REQUIRE', materialId: 'TITANIUM_ARMOR' }, hull: { mode: 'REQUIRE', materialId: 'HIGH_STRENGTH_STRUCTURAL_STEEL' } });
    expect(copy.physicalDesign!.surfaces.filter(s => s.protectionZoneId === 'CRITICAL').every(s => s.materialId === 'TITANIUM_ARMOR')).toBe(true);
    expect(copy.physicalDesign!.surfaces.filter(s => s.kind === 'HULL').every(s => s.materialId === 'HIGH_STRENGTH_STRUCTURAL_STEEL')).toBe(true);
    for (const s of copy.physicalDesign!.surfaces) {
        expect(s.layerStack.reduce((n, l) => n + l.thicknessMm, 0)).toBeCloseTo(s.thicknessMm, 5);
        expect(s.layerStack.reduce((n, l) => n + l.massKg, 0)).toBeCloseTo(s.massKg, 2);
        expect(s.layerStack.reduce((n, l) => n + l.volumeM3 * l.densityKgM3, 0)).toBeCloseTo(s.massKg, 2);
    }
}, 30000);
it('records PREFER tech substitution while impossible REQUIRE is rejected before hull construction', () => {
    const m = procurementMaterials({ ...defaults, mainArmor: { mode: 'PREFER', materialId: 'NANO_LAMINATE' } });
    expect(m.main).not.toBe('NANO_LAMINATE');
    expect(m.decisions[0].reason).toContain('substitution');
    expect(() => generate({ ...defaults, mainArmor: { mode: 'REQUIRE', materialId: 'NANO_LAMINATE' } })).toThrow('available 4');
    const copy = generate({ ...b.procurement!.order, mainArmor: { mode: 'PREFER', materialId: 'NANO_LAMINATE' } });
    expect(copy.procurement!.status).toBe('COMPROMISE');
    expect(copy.procurement!.compromises.join()).toContain('mainArmor');
}, 30000);
it('uses soft target vs hard maximum and refuses hard cost/material/mass violations without changing the source ship', () => {
    const original = JSON.stringify(b);
    expect(() => generate({ ...defaults, targetMassKg: 1, maximumBaseMassKg: 1, mainArmor: { mode: 'REQUIRE', materialId: 'TITANIUM_ARMOR' } })).toThrow('maximum');
    expect(() => generate({ ...b.procurement!.order, maximumCostIndex: 1 })).toThrow('REQUIRED_CONSTRUCTION_COST_EXCEEDED');
    const over = generate({ ...b.procurement!.order, targetMassKg: 1 });
    expect(over.procurement!.status).toBe('COMPROMISE');
    expect(over.physicalDesign!.mass.targetMassKg).toBe(1);
    expect(over.physicalDesign!.mass.ledger!.maximumAllowedMassKg).toBeNull();
    expect(over.procurement!.requirements.find(r => r.id === 'base-mass')!.status).toBe('LIMITED');
    expect(JSON.stringify(b)).toBe(original);
}, 30000);
it('cost derives from actual materials/geometry/processes; mounted mass stays separate from base cap', () => {
    const p = b.physicalDesign!, c = procurementCost(b), expected = p.surfaces.reduce((n, s) => n + s.massKg * MATERIALS[s.materialId].manufacturingCostIndex, 0);
    expect(c.material).toBe(expected);
    expect(c.total).toBe((c.material + c.fabrication + c.estimatedStructureAndCore) * c.yardProcessFactor);
    expect(p.mass.ledger!.baseEstimatedDryMassKg).toBeCloseTo(p.mass.ledger!.entries.filter(e => e.component !== 'MOUNTED_EQUIPMENT' && e.component !== 'PLATFORM').reduce((n, e) => n + e.massKg, 0), 2);
});
it('audits finite critical facet centers; explicit unsupported full-zone guarantees are not invented', () => {
    const measured = criticalCenterThickness(b);
    expect(measured.samples).toBeGreaterThan(0);
    expect(measured.minimumMm).toBeGreaterThan(0);
    const copy = structuredClone(b);
    copy.procurement!.order.armorZoneRequirements = [{ zone: 'CRITICAL_ZONE', verification: 'EXPOSED_FACET_CENTERS', minimumThicknessMm: measured.minimumMm + 1 }];
    expect(procurementDesignIssues(copy)).toContain('REQUIRED_CRITICAL_CENTER_THICKNESS_UNAVAILABLE');
});
it('preserves historical Blueprint JSON on load and only converts old attack priorities on explicit new-order conversion', () => {
    const old = JSON.parse(gunzipSync(readFileSync('qa/v1.8.6.0.1/fixtures/vesper200-after.json.gz')).toString()) as ShipBlueprint, original = JSON.stringify(old), converted = convertLegacyOrder(old);
    expect(validateBlueprint(old)).toEqual([]);
    expect(JSON.stringify(old)).toBe(original);
    expect(old.procurement).toBeUndefined();
    expect(old.weaponLayout!.mounts.length).toBeGreaterThan(0);
    expect(converted.conversion.equipmentHandling).toContain('ORIGINAL_BLUEPRINT_UNCHANGED');
    expect(converted.conversion.discardedPriorities).toEqual(['firepower', 'missile', 'sensor']);
    expect(validateProcurementOrder(converted.order)).toEqual([]);
});
it('does not accept native documents with resurrected combat policy or changed REQUIRE/maximum', () => {
    const copy = structuredClone(b);
    copy.order.priorities.firepower = 100;
    expect(validateBlueprint(copy).length).toBeGreaterThan(0);
    copy.order = structuredClone(b.order);
    copy.procurement!.order.maximumBaseMassKg = 1;
    expect(procurementDesignIssues(copy)).toContain('REQUIRED_MAXIMUM_BASE_MASS_EXCEEDED');
});
it('replans an invalid SPINE family without forcing another Architecture or reserving a spinal cannon',()=>{
 const copy=generate({...defaults,shipyardId:'vesper',seed:12,architecture:{mode:'REQUIRE',grammar:'SPINE_AND_MODULES'}});
 expect(copy.architecture.grammar).toBe('SPINE_AND_MODULES');expect(copy.macroDesign!.family).toBe('WEAPON_DOMINANT');expect(copy.procurement!.candidateRejections![0].reason).toContain('Spine slenderness');expect(copy.weaponLayout!.integrated).toEqual([]);expect(copy.designRequirements).toBeUndefined();expect(validateBlueprint(copy)).toEqual([]);
},30000);

it('accepts only cross-engine ULP rounding in historical standards while rejecting physical or category changes',()=>{
 const expected=mountStandard('M',200),rounded=structuredClone(expected);rounded.footprint.width+=Number.EPSILON*8;expect(sameMountStandard(rounded,expected)).toBe(true);rounded.footprint.width+=.000001;expect(sameMountStandard(rounded,expected)).toBe(false);const wrong=structuredClone(expected);wrong.mode='HULL_INTEGRATED';expect(sameMountStandard(wrong,expected)).toBe(false);const xl=mountStandard('XL');expect(xl.footprint).toEqual({width:45,length:75});expect(xl.envelope).toEqual({width:45,height:30,length:105});
});
