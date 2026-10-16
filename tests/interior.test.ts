import {refreshPhysicalMass} from '../src/physical/policy';
import {finishProcurementDelivery} from '../src/procurement/result';
import { it, expect, afterEach } from 'vitest';
// Yield between CPU-bound geometry cases so worker RPC acknowledgements are serviced.
afterEach(() => new Promise<void>(resolve => setImmediate(resolve)));
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Quaternion, Euler, Vector3 } from 'three';
import type { ShipBlueprint } from '../src/blueprint/types';
import type { CompartmentPlan } from '../src/interior/types';
import { createInteriorInstanceState } from '../src/interior/types';
import { analyzeInterior } from '../src/interior/graph';
import { prepareInteriorQueries } from '../src/interior/query';
import { buildCompartmentPlan, clearInteriorCache } from '../src/interior/build';
import { validateCompartmentPlan } from '../src/interior/validate';
import { generateProcurementBlueprint } from '../src/procurement/generate';
import { validateBlueprint } from '../src/validation/validate';
import { solidVolume } from '../src/generation/production/doctrine';
import { HULL_MATERIALS } from '../src/physical/materials';
import { solidCell, intersectCells, cellVolume, subtractCell, planes } from '../src/physical/convex';
import { boundsOf, center, add, mul } from '../src/generation/integration/contours';
import { beamSolid } from '../src/structure/geometry';
import { nearbyAnchor, evaluateFreeMount } from '../src/free-mount/planner';
import { EquipmentHistory } from '../src/free-mount/store';
const load = (id: string, version = '1.8.6.2') => JSON.parse(gunzipSync(readFileSync(`qa/v${version}/fixtures/${id}.json.gz`)).toString()) as ShipBlueprint;
for (const id of ['BALANCED', 'BLOCK_ASSEMBLY', 'SPINE_AND_MODULES', 'TRUSS_POD', 'TWIN_HULL', 'CORE_AND_NACELLES', 'STACKED_BLOCKS', 'HYBRID'])
    it(`finite ${id} interior, solid exclusion, walls, graph, mass and previous frame/skin preservation`, () => {
        const b = load(id), old = load(id, '1.8.6.1'), p = b.compartmentPlan!;
        expect(validateBlueprint(b)).toEqual([]);
        expect(p.compartments.length).toBeGreaterThan(0);
        expect(JSON.stringify(b.structuralFrame)).toBe(JSON.stringify(old.structuralFrame));
        expect(b.structuralVolumes).toEqual(old.structuralVolumes);
        expect(b.physicalDesign!.surfaces).toEqual(old.physicalDesign!.surfaces);
        expect(b.productionDesign!.armor).toEqual(old.productionDesign!.armor);
        expect(p.compartments.every(c => c.volumeM3 > 0 && c.domainVolumeM3 >= c.volumeM3 && c.physicalVolume.model === 'FINITE_CONNECTED_CSG_COMPONENT')).toBe(true);
        expect(p.compartments.some(c => c.occupiedVolumeM3 > 0)).toBe(true);
        for (const w of p.bulkheads) {
            const v = w.pieces.reduce((n, s) => n + solidVolume(s), 0);
            expect(v).toBeCloseTo(w.volumeM3, 4);
            expect(v * HULL_MATERIALS[w.materialId].densityKgM3).toBeCloseTo(w.massKg, 1);
            expect(w.thicknessMm).toBeGreaterThan(0);
            expect(w.adjacentCompartmentIds.every(id => p.compartments.some(c => c.id === id))).toBe(true);
        }
        const m = b.physicalDesign!.mass;
        expect(m.ledger!.entries.reduce((n, e) => n + e.massKg, 0)).toBeCloseTo(m.totalEstimatedDryMassKg, 2);
        expect(m.totalEstimatedDryMassKg - old.physicalDesign!.mass.totalEstimatedDryMassKg).toBeCloseTo(p.massAccounting.bulkheadMassKg + p.massAccounting.closureMassKg, 2);
        expect(m.structuralMassEstimateKg).toBe(old.physicalDesign!.mass.structuralMassEstimateKg);
        expect(m.unresolvedMassEstimateKg).toBe(old.physicalDesign!.mass.unresolvedMassEstimateKg);
        expect(b.weaponLayout!.mounts).toEqual([]);
        expect(b.engines.length).toBeGreaterThan(0);
        expect(p.compartments.some(c=>b.structuralVolumes.find(v=>v.id===c.parentStructuralVolumeRef)?.purpose==='armor')).toBe(false);
        const connectorIds = new Set(b.structuralConnectors.map(c => c.id));
        expect(p.compartments.some(c => connectorIds.has(c.parentStructuralVolumeRef))).toBe(false);
        expect(p.compartments.some(c => b.structuralVolumes.find(v => v.id === c.parentStructuralVolumeRef)?.type === 'SPINE')).toBe(false);
        if (id === 'TRUSS_POD' || id === 'TWIN_HULL')
            expect(p.analysis.accessGroups.length).toBeGreaterThan(1);
    }, 60000);
function fixture() { const shape = beamSolid({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 1), p = { compartments: ['A', 'B', 'C'].map((id, i) => ({ id, volumeM3: 10, boundaryCertainty: 'FINITE_MATERIAL_CLOSURE', exteriorPatches: [[{ x: i, y: 0, z: 0 }, { x: i, y: 1, z: 0 }, { x: i, y: 0, z: 1 }]] })), bulkheads: [{ id: 'wallAB', adjacentCompartmentIds: ['A', 'B'] }, { id: 'wallBC', adjacentCompartmentIds: ['B', 'C'] }], openings: [['AB', 'A', 'B'], ['BC', 'B', 'C']].map(([id, from, to]) => ({ id, type: 'PASSAGE', boundaryReference: 'wall' + id, fromCompartmentId: from, toCompartmentId: to, aperture: [shape], apertureAreaM2: 1, defaultState: 'OPEN', pressureSealingCapability: false, closure: null })) } as unknown as CompartmentPlan; return p; }
it('A-B-C actual portals, sealed door, exterior vacuum paths and disabled finite wall remain distinct topologies', () => { const p = fixture(); expect(analyzeInterior(p).accessGroups).toEqual([['A', 'B', 'C']]); const breach = createInteriorInstanceState(); breach.hypotheticalHullBreaches = [{ compartmentId: 'A', exteriorPatchIndex: 0 }]; expect(analyzeInterior(p, breach).exposureRatio).toBe(1); p.openings[1].type = 'DOOR'; p.openings[1].defaultState = 'SEALED'; p.openings[1].pressureSealingCapability = true; p.openings[1].closure = { id: 'leaf', materialId: 'LIGHT_STRUCTURAL_ALLOY', thicknessMm: 10, pieces: p.openings[1].aperture, volumeM3: 1, massKg: 2800 }; const isolated = analyzeInterior(p, breach); expect(isolated.accessGroups).toEqual([['A', 'B'], ['C']]); expect(isolated.exposureRatio).toBeCloseTo(2 / 3); expect(isolated.exteriorPaths.C).toBeUndefined(); breach.disabledBulkheadIds = ['wallBC']; expect(analyzeInterior(p, breach).exposureRatio).toBe(1); p.openings = []; expect(analyzeInterior(p).accessGroups).toHaveLength(3); });
it('temporary breach/open/removed-wall analysis never edits design or another instance', () => { const p = load('BALANCED').compartmentPlan!, before = JSON.stringify(p), a = createInteriorInstanceState(), c = p.compartments[0]; a.hypotheticalHullBreaches = [{ compartmentId: c.id, exteriorPatchIndex: 0 }]; expect(analyzeInterior(p, a).exposureRatio).toBeGreaterThan(0); expect(analyzeInterior(p).exposureRatio).toBe(0); expect(JSON.stringify(p)).toBe(before); expect(() => analyzeInterior(p, { ...a, hypotheticalHullBreaches: [{ compartmentId: c.id, exteriorPatchIndex: 99999 }] })).toThrow('HULL_BOUNDARY'); });
it('real door aperture is not a solid wall, closure changes finite Ray intersections, and rigid transforms retain intervals', () => { const b = load('BALANCED'), p = b.compartmentPlan!, o = p.openings.find(o => o.closure)!, boundary = p.boundaries.find(w => w.id === o.boundaryReference)!, point = center(o.aperture[0].vertices), normal = boundary.normal, origin = add(point, mul(normal, -5)), q = prepareInteriorQueries(b), closed = q.probe(origin, normal, 10); expect(closed.hits.some(h => h.kind === 'CLOSURE' && h.id === o.closure!.id)).toBe(true);for(const angle of[0,30,60]){const r=angle*Math.PI/180,d={x:Math.sin(r),y:0,z:Math.cos(r)},hit=q.probe(add(point,mul(d,-5)),d,10).hits.find(h=>h.kind==='CLOSURE'&&h.id===o.closure!.id);expect(hit!.pathLengthM).toBeCloseTo(o.closure!.thicknessMm/1000/Math.cos(r),6);}const leafThickness=o.closure!.thicknessMm/1000,edge={x:Math.max(...o.aperture[0].vertices.map(v=>v.x))-.001,y:point.y,z:point.z-leafThickness/2},edgeDir={x:Math.sin(Math.PI/3),y:0,z:.5},edgeHit=q.probe(add(edge,mul(edgeDir,-.1)),edgeDir,.3).hits.find(h=>h.kind==='CLOSURE'&&h.id===o.closure!.id);expect(edgeHit!.pathLengthM).toBeLessThan(.01); expect(closed.hits.some(h => h.kind === 'BULKHEAD' && h.id === boundary.bulkheadRef)).toBe(false); const state = createInteriorInstanceState(); state.openingStates[o.id] = 'OPEN'; expect(q.probe(origin, normal, 10, state).hits.some(h => h.kind === 'CLOSURE' && h.id === o.closure!.id)).toBe(false); const rotation = new Quaternion().setFromEuler(new Euler(.3, .7, -.1)), position = { x: 10, y: -15, z: 20 }, world = (p: {
    x: number;
    y: number;
    z: number;
}, translate = true) => { const v = new Vector3(p.x, p.y, p.z).applyQuaternion(rotation); if (translate)
    v.add(new Vector3(position.x, position.y, position.z)); return v; }, turned = q.probe(world(origin), world(normal, false), 10, undefined, { position, quaternion: rotation }); expect(turned.hits.map(h => [h.kind, h.id])).toEqual(closed.hits.map(h => [h.kind, h.id])); for (let i = 0; i < turned.hits.length; i++)
    expect(turned.hits[i].pathLengthM).toBeCloseTo(closed.hits[i].pathLengthM, 6); expect(q.probe(origin, { x: 0, y: 0, z: 0 }, 10).valid).toBe(false); });
it('future system placement queries reject real frame occupancy, walls and outside-Hull candidates', () => { const b = load('BALANCED'), q = prepareInteriorQueries(b), member = b.structuralFrame!.members.find(m => m.type === 'PRIMARY_LONGITUDINAL')!, point = center(member.pieces[0].vertices); expect(q.occupancyAt(point).length).toBeGreaterThan(0); expect(q.at(point)).toEqual([]); expect(q.at({ x: 100000, y: 0, z: 0 })).toEqual([]); const c = b.compartmentPlan!.compartments[0]; expect(q.fits(c.id, beamSolid({ x: 100000, y: 0, z: 0 }, { x: 100000, y: 1, z: 0 }, 1))).toBe(false);const roomy=[...c.physicalVolume.connectedCells].sort((a,b)=>solidVolume(b)-solidVolume(a))[0],insidePoint=center(roomy.vertices),radius=Math.min(...planes(solidCell(roomy)).map(p=>p.d-p.n.x*insidePoint.x-p.n.y*insidePoint.y-p.n.z*insidePoint.z)),side=Math.min(1,radius*.4);expect(side).toBeGreaterThan(.01);expect(q.at(insidePoint).some(room=>room.compartmentId===c.id)).toBe(true);expect(q.fits(c.id,beamSolid(add(insidePoint,{x:0,y:-side/2,z:0}),add(insidePoint,{x:0,y:side/2,z:0}),side))).toBe(true); expect(prepareInteriorQueries(b)).toBe(q); });
it('ENDURANCE reduces actual breach and one-boundary-loss volume, MOBILITY saves mass and ECONOMY lowers relative cost', () => { const bs = ['ARMOR', 'MOBILITY', 'ENDURANCE', 'ECONOMY', 'BALANCED'].map(id => load(id)), [a, m, e, ec, bal] = bs.map(b => b.compartmentPlan!); expect(e.compartments.length).toBeGreaterThan(m.compartments.length); expect(a.massAccounting.bulkheadMassKg).toBeGreaterThan(m.massAccounting.bulkheadMassKg);expect(a.bulkheads.some(w=>w.openingIds.length===0)).toBe(true); const exposure = (p: CompartmentPlan) => { const s = createInteriorInstanceState(); s.hypotheticalHullBreaches = [{ compartmentId: p.compartments[0].id, exteriorPatchIndex: 0 }]; s.disabledBulkheadIds = [p.bulkheads[0].id]; return analyzeInterior(p, s).exposureRatio; }; expect(exposure(e)).toBeLessThan(exposure(m)); expect(exposure(e)).toBeLessThan(exposure(bal)); expect(bs[3].procurement!.cost!.interiorFabrication!).toBeLessThan(bs[0].procurement!.cost!.interiorFabrication!); expect(bs[3].procurement!.cost!.interiorMaterial!).toBeLessThan(bs[0].procurement!.cost!.interiorMaterial!); });
it('rejects virtual portal edges, missing closed leaf, invalid thickness, changed mass and moved compartment geometry', () => { const cases = [(b: ShipBlueprint) => b.compartmentPlan!.accessGraph.push({ id: 'fake', from: 'a', to: 'b', boundaryRef: 'fake', openingRef: 'fake' }), (b: ShipBlueprint) => { b.compartmentPlan!.openings.find(o => o.closure)!.closure = null; }, (b: ShipBlueprint) => { b.compartmentPlan!.bulkheads[0].thicknessMm = 0; }, (b: ShipBlueprint) => { b.compartmentPlan!.bulkheads[0].massKg++; }, (b: ShipBlueprint) => { b.compartmentPlan!.compartments[0].physicalVolume.domains[0].vertices.forEach(v => v.x += 100000); }]; for (const mutate of cases) {
    const b = load('BALANCED');
    mutate(b);
    expect(validateCompartmentPlan(b).length).toBeGreaterThan(0);
} }, 30000);
it('JSON roundtrip and legacy import preserve all data without automatic interior insertion', () => { const b = load('BALANCED'), copy = JSON.parse(JSON.stringify(b)); expect(validateBlueprint(copy)).toEqual([]); expect(JSON.stringify(copy)).toBe(JSON.stringify(b)); for (const old of [load('BALANCED', '1.8.6.1'), load('BALANCED', '1.8.6.0.2')]) {
    const text = JSON.stringify(old);
    expect(validateBlueprint(old)).toEqual([]);
    expect(old.compartmentPlan).toBeUndefined();
    expect(JSON.stringify(old)).toBe(text);
} }, 30000);
it('interior cache hit/miss JSON matches and core geometry, seed, material inputs invalidate it', () => { const b = load('BALANCED'); clearInteriorCache(); buildCompartmentPlan(b); const json = JSON.stringify(b.compartmentPlan); buildCompartmentPlan(b); expect(JSON.stringify(b.compartmentPlan)).toBe(json); const old = b.compartmentPlan!.sourceSignature; b.procurement!.order.seed++; buildCompartmentPlan(b); expect(b.compartmentPlan!.sourceSignature).not.toBe(old); const next = b.compartmentPlan!.sourceSignature; b.physicalDesign!.surfaces[0].materialId = 'ARMORED_STEEL'; buildCompartmentPlan(b); expect(b.compartmentPlan!.sourceSignature).not.toBe(next); }, 30000);
it('default native generation is deterministic, strict base cap rejects actual interior mass, previous contract replays exactly', () => { const old = load('BALANCED', '1.8.6.1'), o = old.procurement!.order, a = generateProcurementBlueprint(o), b = generateProcurementBlueprint(o); expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(a.generatorVersion).toBe('1.8.6.2'); expect(generateProcurementBlueprint(o, { version: '1.8.6.1' })).toEqual(old); expect(() => generateProcurementBlueprint({ ...o, maximumBaseMassKg: 1 })).toThrow('MAXIMUM_BASE_MASS');const constrained=structuredClone(a),extra=constrained.compartmentPlan!.massAccounting.bulkheadMassKg+constrained.compartmentPlan!.massAccounting.closureMassKg;constrained.procurement!.order.maximumBaseMassKg=constrained.physicalDesign!.mass.ledger!.baseEstimatedDryMassKg-extra/2;expect(constrained.procurement!.order.maximumBaseMassKg).toBeGreaterThan(old.physicalDesign!.mass.ledger!.baseEstimatedDryMassKg);refreshPhysicalMass(constrained);expect(()=>finishProcurementDelivery(constrained)).toThrow('MAXIMUM_BASE_MASS_EXCEEDED'); }, 60000);
it('external free mounting ignores interior geometry and keeps interior/base design through install/delete/undo', () => { const b = load('BALANCED'), without = structuredClone(b); delete without.compartmentPlan; let request: Parameters<typeof evaluateFreeMount>[1] | undefined; for (const x of [-40, 0, 40])
    for (const z of [-80, 0, 80])
        try {
            const r = { equipmentId: 'gun-105', anchor: nearbyAnchor(b, { x, y: 0, z }, { x: 0, y: 1, z: 0 }, 200), headingDegrees: 0, platforms: true, mode: 'SINGLE' as const };
            if (evaluateFreeMount(b, r).status !== 'INVALID')
                request = r;
        }
        catch { } expect(request).toBeTruthy(); const withResult = evaluateFreeMount(b, request!), withoutResult = evaluateFreeMount(without, request!); expect({ ...withResult, elapsedMs: 0 }).toEqual({ ...withoutResult, elapsedMs: 0 }); const history = new EquipmentHistory(b), before = JSON.stringify(b.compartmentPlan); history.install(request!); expect(JSON.stringify(history.blueprint.compartmentPlan)).toBe(before); expect(history.blueprint.physicalDesign!.mass.playerMountedEquipmentMassEstimateKg).toBeGreaterThan(0); expect(history.blueprint.physicalDesign!.mass.ledger!.baseEstimatedDryMassKg).toBe(b.physicalDesign!.mass.ledger!.baseEstimatedDryMassKg); history.undo(); expect(JSON.stringify(history.blueprint)).toBe(JSON.stringify(b)); }, 30000);
it('an open passage cannot become sealed without a real closure, even in a temporary instance', () => { const p = fixture(), s = createInteriorInstanceState(); s.openingStates.AB = 'SEALED'; expect(() => analyzeInterior(p, s)).toThrow('PHYSICAL_CLOSURE'); });

it('a disconnected microscopic outer pocket never exposes the entire connected main chamber',()=>{const p=load('ARMOR').compartmentPlan!;expect(p.unresolvedVoidPockets.length).toBeGreaterThan(0);expect(p.unresolvedVoidPockets.reduce((n,c)=>n+c.volumeM3,0)).toBeLessThan(1e-5);expect(p.openings.filter(o=>o.type==='EXTERIOR_OPENING')).toEqual([]);expect(p.analysis.exposureRatio).toBe(0);expect(p.compartments.every(c=>c.physicalVolume.connectedCells.length>0)).toBe(true);});
