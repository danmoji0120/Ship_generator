import { it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { ShipBlueprint } from '../src/blueprint/types';
import { prepareFunctionalQueries, equipmentSpaceClear } from '../src/systems/query';
import { SYSTEM_REGISTRY } from '../src/systems/registry';
import { evaluateSystemPlan, evaluateShipCapabilities, advanceSystemState, analyzeSystemRedundancy } from '../src/systems/evaluate';
import { createSystemInstanceState } from '../src/systems/types';
import { validateFunctionalSystems } from '../src/systems/validate';
import { validateBlueprint } from '../src/validation/validate';
import { generateProcurementBlueprint } from '../src/procurement/generate';
import { prepareInteriorQueries, placementBox } from '../src/interior/query';
import { finishPhysicalMass } from '../src/physical/policy';
import { nearbyAnchor, evaluateFreeMount } from '../src/free-mount/planner';
import { EquipmentHistory } from '../src/free-mount/store';
const load = (id = 'BALANCED', version = '1.8.6.3') => JSON.parse(gunzipSync(readFileSync(`qa/v${version}/fixtures/${id}.json.gz`)).toString()) as ShipBlueprint;
afterEach(() => new Promise<void>(r => setImmediate(r)));
it('eight typed registry specifications: independent immutable templates and explicit game units/mass provenance', () => { expect(Object.keys(SYSTEM_REGISTRY)).toHaveLength(8); for (const s of Object.values(SYSTEM_REGISTRY)) {
    expect(s.massKg).toBeGreaterThan(0);
    expect(s.massBasis).toContain('SPECIFICATION');
    expect(Object.isFrozen(s)).toBe(true);
    expect(Object.values(s.sizeM).every(n => n > 0)).toBe(true);
} });
for (const id of ['BALANCED', 'BLOCK_ASSEMBLY', 'SPINE_AND_MODULES', 'TRUSS_POD', 'TWIN_HULL', 'CORE_AND_NACELLES', 'STACKED_BLOCKS', 'HYBRID'])
    it(`${id} real confirmed OBBs, connected networks, mass and preserved compartments/frame`, () => { const b = load(id), old = load(id, '1.8.6.2.1'), p = b.functionalSystems!; expect(validateFunctionalSystems(b)).toEqual([]); expect(p.equipment.length).toBeGreaterThanOrEqual(7); expect(b.compartmentPlan).toEqual(old.compartmentPlan); expect(b.structuralFrame).toEqual(old.structuralFrame); expect(b.physicalDesign!.surfaces).toEqual(old.physicalDesign!.surfaces); const q = prepareInteriorQueries(b); for (const e of p.equipment) {
        expect(q.fits(e.compartmentId, placementBox(e.position, e.sizeM, e.clearanceM))).toBe(true);
        expect(b.compartmentPlan!.compartments.find(c => c.id === e.compartmentId)!.boundaryCertainty).toBe('FINITE_MATERIAL_CLOSURE');
    } const cap = evaluateShipCapabilities(b); expect(cap.commandAvailability).toBe(1); expect(cap.propulsionAuthority).toBe(1); expect(cap.maneuverAuthority).toBe(1); expect(cap.electricalPowerDeficitMW).toBe(0); expect(finishPhysicalMass(b)).toEqual(b.physicalDesign!.mass); expect(b.physicalDesign!.mass.ledger!.baseEstimatedDryMassKg - old.physicalDesign!.mass.ledger!.baseEstimatedDryMassKg).toBeCloseTo(p.massAccounting.equipmentKg, 3); }, 60000);
it('actual reactor/distribution/control failure propagation, reset and independent instances never mutate design', () => { const b = load(), p = b.functionalSystems!, json = JSON.stringify(b), a = createSystemInstanceState(p), other = createSystemInstanceState(p); for (const type of ['POWER_GENERATOR', 'POWER_DISTRIBUTION', 'COMMAND_CONTROL', 'PROPULSION_CONTROL', 'MANEUVER_CONTROL', 'FIRE_CONTROL', 'SENSOR_PROCESSING'] as const) {
    a.equipmentStates = {};
    a.equipmentStates[p.equipment.find(e => e.type === type)!.id] = 'OFFLINE';
    const c = evaluateShipCapabilities(b, a);
    if (type === 'POWER_GENERATOR' || type === 'POWER_DISTRIBUTION' || type === 'COMMAND_CONTROL')
        expect(c.propulsionAuthority).toBe(0);
    if (type === 'PROPULSION_CONTROL')
        expect(c.propulsionAuthority).toBe(0);
    if (type === 'MANEUVER_CONTROL')
        expect(c.maneuverAuthority).toBe(0);
    if (type === 'FIRE_CONTROL')
        expect(c.availableFireControlChannels).toBe(0);
    if (type === 'SENSOR_PROCESSING')
        expect(c.availableSensorProcessingCapacity).toBe(0);
} expect(evaluateShipCapabilities(b, other).propulsionAuthority).toBe(1); expect(JSON.stringify(b)).toBe(json); });
it('cyclic and alternate power routes respect generator, bus and edge capacities; deterministic load priority', () => { const p = load('ENDURANCE').functionalSystems!, s = createSystemInstanceState(p); for (const e of p.equipment.filter(e => e.type === 'ENERGY_STORAGE'))
    s.storageMJ[e.id] = 0; for (const e of p.equipment.filter(e => e.type === 'POWER_GENERATOR'))
    e.specification.capacity = 10; let c = evaluateSystemPlan(p, s, [{ id: 'external/overload', kind: 'WEAPON', powerMW: 100, channels: 30 }]); expect(c.consumedElectricalPowerMW).toBeLessThanOrEqual(20 + 1e-6); expect(c.electricalPowerDeficitMW).toBeGreaterThan(100); expect(c.commandAvailability).toBe(1); expect(c.externalLoads[0].controlFraction).toBeLessThan(1); for (const e of p.equipment.filter(e => e.type === 'POWER_GENERATOR'))
    e.specification.capacity = 100; for (const e of p.equipment.filter(e => e.type === 'POWER_DISTRIBUTION'))
    e.specification.capacity = 5; c = evaluateSystemPlan(p, s); expect(c.consumedElectricalPowerMW).toBeLessThanOrEqual(10 + 1e-6); expect(c.electricalPowerDeficitMW).toBeGreaterThan(0); });
it('finite storage drains in MJ, cannot supply infinite MW, stops empty and recharges through a real path', () => { const p = load('ENDURANCE').functionalSystems!, s = createSystemInstanceState(p); for (const e of p.equipment.filter(e => e.type === 'POWER_GENERATOR'))
    s.equipmentStates[e.id] = 'OFFLINE'; const unavailable = structuredClone(s), storageUnit = p.equipment.find(e => e.type === 'ENERGY_STORAGE')!; unavailable.equipmentStates[storageUnit.id] = 'DESTROYED'; expect(evaluateSystemPlan(p, unavailable).backupPowerRemainingMJ).toBe(180); expect(unavailable.storageMJ[storageUnit.id]).toBe(180);
    const before = Object.values(s.storageMJ).reduce((n, x) => n + x, 0), step = advanceSystemState(p, s, 10), after = Object.values(step.state.storageMJ).reduce((n, x) => n + x, 0); expect(before - after).toBeCloseTo(Object.values(step.capabilities.storageDispatchMW).reduce((n, x) => n + x, 0) * 10, 6); let state = step.state; for (let i = 0; i < 5; i++)
    state = advanceSystemState(p, state, 10).state; expect(evaluateSystemPlan(p, state).availableElectricalPowerMW).toBe(0); state.equipmentStates = {}; const charged = advanceSystemState(p, state, 10); expect(Object.values(charged.state.storageMJ).reduce((n, x) => n + x, 0)).toBeGreaterThan(0); expect(Object.values(s.storageMJ).reduce((n, x) => n + x, 0)).toBe(before); });
it('endurance maintains all essential functions after any individual generator/bus/command loss and records real compartment separation', () => { const p = load('ENDURANCE').functionalSystems!; for (const e of p.equipment) {
    const s = createSystemInstanceState(p);
    s.equipmentStates[e.id] = 'OFFLINE';
    const c = evaluateSystemPlan(p, s);
    expect(c.commandAvailability).toBe(1);
    expect(c.propulsionAuthority).toBe(1);
    expect(c.maneuverAuthority).toBe(1);
} for (const type of ['POWER_GENERATOR', 'POWER_DISTRIBUTION', 'COMMAND_CONTROL'])
    expect(new Set(p.equipment.filter(e => e.type === type).map(e => e.compartmentId)).size).toBeGreaterThan(1); expect(analyzeSystemRedundancy(p).some(r => r.singlePointOfTotalFailure.length)).toBe(false); });
it('removed edges, degraded operation and zero-power specification are evaluated; ghost refs fail validation', () => { const b = load(), p = b.functionalSystems!, s = createSystemInstanceState(p), prop = p.equipment.find(e => e.type === 'PROPULSION_CONTROL')!; s.disabledControlEdges = p.controlNetwork.filter(e => e.to === prop.id).map(e => e.id); expect(evaluateSystemPlan(p, s).propulsionAuthority).toBe(0); s.disabledControlEdges = []; s.equipmentStates[prop.id] = 'DEGRADED'; expect(evaluateSystemPlan(p, s).propulsionAuthority).toBe(.5); s.equipmentStates = {}; s.disabledPowerEdges = p.powerNetwork.filter(e => e.to === prop.id).map(e => e.id); expect(evaluateSystemPlan(p, s).propulsionAuthority).toBe(0); p.controlNetwork[0].from = 'ghost'; expect(validateFunctionalSystems(b).join()).toContain('GHOST'); const accounting = load(); expect(validateFunctionalSystems(accounting)).toEqual([]); accounting.physicalDesign!.mass.functionalEquipmentMassKg!++; expect(validateFunctionalSystems(accounting).join()).toContain('MASS_ACCOUNTING');
    const removedRcs = load(); if (removedRcs.exteriorDetailPlan?.kitPlacements.some(e => removedRcs.functionalSystems!.maneuverRefs.includes(e.id))) { expect(validateFunctionalSystems(removedRcs)).toEqual([]); removedRcs.exteriorDetailPlan.kitPlacements = removedRcs.exteriorDetailPlan.kitPlacements.filter(e => !removedRcs.functionalSystems!.maneuverRefs.includes(e.id)); expect(validateFunctionalSystems(removedRcs).join()).toContain('RCS_REFERENCE'); }
    const moved = load(); moved.functionalSystems!.equipment[0].position.x += 100000; expect(validateFunctionalSystems(moved).join()).toContain('GEOMETRY'); const uncertain = load(); uncertain.compartmentPlan!.compartments.find(c => c.id === uncertain.functionalSystems!.equipment[0].compartmentId)!.boundaryCertainty = 'UNRESOLVED'; expect(validateFunctionalSystems(uncertain).join()).toContain('COMPARTMENT'); const sensor = evaluateSystemPlan(load().functionalSystems!, undefined, [{ id: 'sensor-fixture', kind: 'SENSOR', powerMW: 2, channels: 2 }]); expect(sensor.externalLoads[0].operatingAvailability).toBe(1); const noSensor = load().functionalSystems!, ss = createSystemInstanceState(noSensor); ss.equipmentStates[noSensor.equipment.find(e => e.type === 'SENSOR_PROCESSING')!.id] = 'OFFLINE'; expect(evaluateSystemPlan(noSensor, ss, [{ id: 'sensor-fixture', kind: 'SENSOR', powerMW: 2, channels: 2 }]).externalLoads[0].operatingAvailability).toBe(0); });
it('external mounting stays possible with power/control offline; mass, actual channels, legacy unknown demand and save/load survive', () => { const b = load(), p = b.functionalSystems!, anchor = nearbyAnchor(b, { x: -40, y: 0, z: 10 }, { x: 0, y: 1, z: 0 }, 200)!, request = { equipmentId: 'gun-105', anchor, headingDegrees: 0, platforms: true, mode: 'SINGLE' as const }, r = evaluateFreeMount(b, request); expect(r.status).not.toBe('INVALID'); const history = new EquipmentHistory(b); history.install(request, r); const equipped = history.blueprint, e = equipped.freeMountPlan!.entries[0], s = createSystemInstanceState(p); for (const unit of p.equipment)
    s.equipmentStates[unit.id] = 'OFFLINE'; let c = evaluateShipCapabilities(equipped, s); expect(c.externalLoads[0].specification).toBe('LEGACY_UNSPECIFIED'); expect(c.externalLoads[0].controlFraction).toBe(0); e.operatingSpecification = { powerMW: 200, channels: 12 }; c = evaluateShipCapabilities(equipped); expect(c.electricalPowerDeficitMW).toBeGreaterThan(0); expect(equipped.physicalDesign!.mass.playerMountedEquipmentMassEstimateKg).toBeGreaterThan(0); const copy = JSON.parse(JSON.stringify(equipped)); expect(evaluateShipCapabilities(copy)).toEqual(c); const fire = p.equipment.find(e => e.type === 'FIRE_CONTROL')!; s.equipmentStates = { [fire.id]: 'OFFLINE' }; expect(evaluateShipCapabilities(equipped, s).externalLoads[0].controlFraction).toBe(0); expect(equipped.freeMountPlan!.entries).toHaveLength(1); }, 30000);
it('legacy saves are not redesigned; new native generation deterministic, unarmed and hard maximum enforced', () => { const old = load('BALANCED', '1.8.6.2.1'), json = JSON.stringify(old); expect(old.functionalSystems).toBeUndefined(); expect(validateBlueprint(old)).toEqual([]); expect(JSON.stringify(old)).toBe(json); const order = { ...old.procurement!.order, lengthM: 100, targetMassKg: 30000000, maximumBaseMassKg: 200000000, shipClass: 'Frigate' as const, seed: 19 }, a = generateProcurementBlueprint(order), b = generateProcurementBlueprint(order); expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(a.generatorVersion).toBe('1.8.6.3.1'); expect(a.weaponLayout!.mounts).toHaveLength(0); expect(a.engines.length).toBeGreaterThan(0); expect(validateBlueprint(a)).toEqual([]); expect(() => generateProcurementBlueprint({ ...order, maximumBaseMassKg: 1 })).toThrow(); }, 60000);
it('finite equipment targeting returns actual entry/exit and an independent snapshot', () => { const p = load().functionalSystems!, e = p.equipment[0], q = prepareFunctionalQueries(p), o = { x: e.position.x, y: e.position.y, z: e.position.z - 20 }, hit = q.probe(o, { x: 0, y: 0, z: 1 }, 40).find(h => h.equipmentId === e.id)!; expect(hit.pathLengthM).toBeCloseTo(e.sizeM.z, 7); expect(q.at(e.position).some(h => h.id === e.id)).toBe(true); expect(equipmentSpaceClear(p, e.solid)).toBe(false); expect(equipmentSpaceClear(p, placementBox({ x: 10000, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }))).toBe(true); e.position.x += 1000; expect(q.probe(o, { x: 0, y: 0, z: 1 }, 40)).toContainEqual(hit); });
