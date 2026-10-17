import { it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { ShipBlueprint } from '../src/blueprint/types';
import { reconcileOwnedMass } from '../src/physical/reconcile';
import { finishPhysicalMass, refreshPhysicalMass } from '../src/physical/policy';
import { buildFunctionalSystems } from '../src/systems/build';
import { clearFunctionalPlanCache, functionalPlanCacheBytes, functionalInput } from '../src/systems/cache';
import { validateFunctionalSystems } from '../src/systems/validate';
import { evaluateSystemPlan, advanceSystemInterval, advanceSystemState, analyzeSystemRedundancy } from '../src/systems/evaluate';
import { createSystemInstanceState } from '../src/systems/types';
import { finishProcurementDelivery } from '../src/procurement/result';
const load = (id = 'BALANCED') => JSON.parse(gunzipSync(readFileSync(`qa/v1.8.6.3/fixtures/${id}.json.gz`)).toString()) as ShipBlueprint;
afterEach(() => new Promise<void>(r => setImmediate(r)));
it('itemized replacement retires the exact estimate once; unknown and unrealized service scopes remain', () => {
    const r = reconcileOwnedMass([{ id: 'real-generator', massKg: 18000, ownerRefs: ['gen/A'] }], [{ id: 'old-generator', massKg: 20000, ownerRefs: ['gen/A'], scope: 'ITEMIZED' }, { id: 'not-built-support', massKg: 4000, ownerRefs: ['support/A'], scope: 'ITEMIZED' }, { id: 'unknown', massKg: 90000, ownerRefs: [], scope: 'UNKNOWN_LEGACY' }]);
    expect(()=>reconcileOwnedMass([],[{id:'x',massKg:1,ownerRefs:['same'],scope:'ITEMIZED'},{id:'y',massKg:2,ownerRefs:['same'],scope:'ITEMIZED'}])).toThrow('DUPLICATE_ESTIMATED');
    expect(r.actualKg).toBe(18000);
    expect(r.remainingEstimatedKg).toBe(94000);
    expect(r.replacements).toEqual([{ estimateId: 'old-generator', actualIds: ['real-generator'], retiredKg: 20000 }]);
    expect(() => reconcileOwnedMass([{ id: 'a', massKg: 1, ownerRefs: ['x'] }, { id: 'b', massKg: 2, ownerRefs: ['x'] }], [])).toThrow('DUPLICATE');
    expect(() => reconcileOwnedMass([], [{ id: 'x', massKg: -1, ownerRefs: [], scope: 'UNKNOWN_LEGACY' }])).toThrow('INVALID');
    expect(() => reconcileOwnedMass([{ id: 'a', massKg: 1, ownerRefs: ['x'] }], [{ id: 'agg', massKg: 20, ownerRefs: ['x', 'y'], scope: 'ITEMIZED' }])).toThrow('PARTIAL');
});
it('new provenance reconciles modeled and uncertain base without inventing a legacy deduction; one unit mass once', () => {
    const b = load(), legacy = JSON.stringify(b.physicalDesign!.mass);
    expect(finishPhysicalMass(b)).toEqual(b.physicalDesign!.mass);
    expect(JSON.stringify(b.physicalDesign!.mass)).toBe(legacy);
    b.generatorVersion = '1.8.6.3.1';
    let m = finishPhysicalMass(b), r = m.ledger!.reconciliation!;
    expect(r.unknownLegacyServiceKg).toBe(b.dimensions.estimatedMass * 1000 * .1);
    expect(r.replacements).toEqual([]);
    expect(r.actualModeledBaseKg + r.remainingEstimatedBaseKg).toBeCloseTo(m.ledger!.baseEstimatedDryMassKg, 4);
    const original = m.ledger!.baseEstimatedDryMassKg, core = m.coreEquipmentMassEstimateKg, unit = structuredClone(b.functionalSystems!.equipment[0]);
    unit.id += '-second';
    b.functionalSystems!.equipment.push(unit);
    m = finishPhysicalMass(b);
    expect(m.ledger!.baseEstimatedDryMassKg - original).toBeCloseTo(unit.massKg, 5);
    expect(m.coreEquipmentMassEstimateKg).toBe(core);
    expect(m.unresolvedMassEstimateKg).toBe(r.unknownLegacyServiceKg);
    expect(m.functionalEquipmentMassKg! / 1000).toBe(b.functionalSystems!.equipment.reduce((n, e) => n + e.massKg, 0) / 1000);
});
it('all four policies keep exact old mass and geometry; new ledger max check uses accounted base', () => {
    for (const id of ['ARMOR', 'MOBILITY', 'ENDURANCE', 'ECONOMY']) {
        const b = load(id), old = b.physicalDesign!.mass;
        b.generatorVersion = '1.8.6.3.1';
        const next = finishPhysicalMass(b);
        expect(next.totalEstimatedDryMassKg).toBe(old.totalEstimatedDryMassKg);
        expect(next.functionalEquipmentMassKg).toBe(old.functionalEquipmentMassKg);
        expect(next.ledger!.reconciliation!.remainingEstimatedBaseKg).toBeGreaterThan(0);
    }
    const b = load();
    b.generatorVersion = '1.8.6.3.1';
    b.procurement!.order.maximumBaseMassKg = b.physicalDesign!.mass.ledger!.baseEstimatedDryMassKg - 1;
    refreshPhysicalMass(b);
    expect(() => finishProcurementDelivery(b)).toThrow('MAXIMUM_BASE_MASS');
});
it('bounded functional plan cache is output-independent and invalidates finite room and source mutations', () => {
    clearFunctionalPlanCache();
    const b = load(), expected = JSON.stringify(b.functionalSystems);
    delete b.functionalSystems;
    buildFunctionalSystems(b);
    expect(JSON.stringify(b.functionalSystems)).toBe(expected);
    const bytes = functionalPlanCacheBytes();
    expect(bytes).toBeGreaterThan(0);
    b.functionalSystems!.equipment[0].position.x += 1000;
    delete b.functionalSystems;
    buildFunctionalSystems(b);
    expect(JSON.stringify(b.functionalSystems)).toBe(expected);
    expect(functionalPlanCacheBytes()).toBe(bytes);
    expect(validateFunctionalSystems(b)).toEqual([]);
    const room = b.compartmentPlan!.compartments.find(c => c.id === b.functionalSystems!.equipment[0].compartmentId)!;
    room.boundaryCertainty = 'UNRESOLVED';
    delete b.functionalSystems;
    buildFunctionalSystems(b);
    expect(b.functionalSystems!.equipment.every(e => e.compartmentId !== room.id)).toBe(true);
    expect(JSON.stringify(b.functionalSystems)).not.toBe(expected);
    expect(validateFunctionalSystems(b)).toEqual([]);
    clearFunctionalPlanCache();
    expect(functionalPlanCacheBytes()).toBe(0);
}, 30000);
it('sequential failures/reset are pure and instance-isolated; interval retries cannot spend energy twice', () => {
    const p = load('ENDURANCE').functionalSystems!, json = JSON.stringify(p), a = createSystemInstanceState(p), b = createSystemInstanceState(p), gens = p.equipment.filter(e => e.type === 'POWER_GENERATOR'), bus = p.equipment.filter(e => e.type === 'POWER_DISTRIBUTION');
    a.equipmentStates[gens[0].id] = 'OFFLINE';
    expect(evaluateSystemPlan(p, a).propulsionAuthority).toBe(1);
    a.equipmentStates[bus[1].id] = 'OFFLINE';
    const degraded = evaluateSystemPlan(p, a);
    expect(degraded.electricalPowerDeficitMW).toBeGreaterThan(0);
    a.equipmentStates[gens[0].id] = 'OPERATIONAL';
    expect(evaluateSystemPlan(p, a).propulsionAuthority).toBe(1);
    a.equipmentStates[bus[1].id] = 'OPERATIONAL';
    expect(evaluateSystemPlan(p, a).electricalPowerDeficitMW).toBe(0);
    for (const g of gens)
        a.equipmentStates[g.id] = 'OFFLINE';
    const state = JSON.stringify(a), cap = evaluateSystemPlan(p, a);
    for (let i = 0; i < 20; i++)
        expect(evaluateSystemPlan(p, a)).toEqual(cap);
    expect(JSON.stringify(a)).toBe(state);
    const step = advanceSystemInterval(p, a, 0, 10);
    expect(step.state.elapsedSeconds).toBe(10);
    expect(() => advanceSystemInterval(p, step.state, 0, 10)).toThrow('ALREADY_APPLIED');
    expect(advanceSystemInterval(p, a, 0, 10)).toEqual(step);
    expect(evaluateSystemPlan(p, b).propulsionAuthority).toBe(1);
    expect(JSON.stringify(p)).toBe(json);
    let s = step.state;
    for (let i = 0; i < 5; i++)
        s = advanceSystemState(p, s, 10).state;
    expect(evaluateSystemPlan(p, s).backupPowerRemainingMJ).toBe(0);
    expect(evaluateSystemPlan(p, createSystemInstanceState(p)).backupPowerRemainingMJ).toBe(360);
});

it('source keys invalidate edited seed, priority, materials, finite cells and RCS; no ghost redundancy',()=>{
 const b=load(),original=functionalInput(b);
 for(const edit of [(b:ShipBlueprint)=>b.procurement!.order.seed++, (b:ShipBlueprint)=>b.procurement!.order.primaryPriority='ENDURANCE', (b:ShipBlueprint)=>b.physicalDesign!.surfaces[0].materialId='TITANIUM_ARMOR', (b:ShipBlueprint)=>b.physicalDesign!.surfaces[0].pieces[0].solid.vertices[0].x++, (b:ShipBlueprint)=>b.compartmentPlan!.compartments[0].physicalVolume.connectedCells[0].vertices[0].z++, (b:ShipBlueprint)=>b.engines[0].id+='changed']) {const copy=load();edit(copy);expect(functionalInput(copy)).not.toBe(original);}
 const p=load('ENDURANCE').functionalSystems!,generators=p.equipment.filter(e=>e.type==='POWER_GENERATOR'),bus=p.equipment.filter(e=>e.type==='POWER_DISTRIBUTION');
 p.powerNetwork.filter(e=>e.from===generators[1].id).forEach(e=>e.to=bus[0].id);
 p.equipment=p.equipment.filter(e=>e.type!=='ENERGY_STORAGE');const ids=new Set(p.equipment.map(e=>e.id));p.powerNetwork=p.powerNetwork.filter(e=>ids.has(e.from)&&ids.has(e.to));const s=createSystemInstanceState(p);
 s.equipmentStates[bus[0].id]='OFFLINE';expect(evaluateSystemPlan(p,s).propulsionAuthority).toBe(0);expect(analyzeSystemRedundancy(p).find(r=>r.equipmentId===bus[0].id)!.singlePointOfTotalFailure).toContain('propulsionControlAvailability');
});
