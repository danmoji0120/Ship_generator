import {containsVolume} from '../generation/architecture/volumes';
import { Quaternion, Vector3 } from 'three';
import type { ShipBlueprint, Vec3 } from '../blueprint/types';
import type { ShipRigidTransform } from '../physical/probe';
import type { CompartmentPlan, InteriorInstanceState } from './types';
import { createInteriorInstanceState } from './types';
import { context, inside, paddedBounds } from './geometry';
import { solidCell, planes, rayPlanes, cellVolume, subtractCell, intersectCells, clipCell } from '../physical/convex';
import { boundsOf, add, mul } from '../generation/integration/contours';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import { analyzeInterior } from './graph';
import { interiorSignature } from './build';
import type { PanelSolid } from '../generation/armor/types';
export interface InteriorHit {
    kind: 'COMPARTMENT' | 'BULKHEAD' | 'CLOSURE' | 'OPENING';
    id: string;
    materialId: string | null;
    thicknessMm: number | null;
    entryDistanceM: number;
    exitDistanceM: number;
    pathLengthM: number;
    entryPoint: Vec3;
    exitPoint: Vec3;
    entryNormal: Vec3 | null;
    compartmentIds: string[];
    state?: string;
}
let cache = new WeakMap<CompartmentPlan, {
    key: string;
    query: ReturnType<typeof buildQueries>;
}>();
export function prepareInteriorQueries(b: ShipBlueprint) { const p = b.compartmentPlan; if (!p)
    throw Error('INTERIOR_DATA_ABSENT_LEGACY_NOT_REDESIGNED'); const key = JSON.stringify(p) + interiorSignature(b), old = cache.get(p); if (old?.key === key)
    return old.query; const query = buildQueries(b); cache.set(p, { key, query }); return query; }
function buildQueries(b: ShipBlueprint) {
    const unknownVolumes=structuredClone(b.structuralVolumes.filter(v=>v.type==='SPINE'||v.purpose==='armor'));
    const start = performance.now(), p = structuredClone(b.compartmentPlan!), ctx = context(b, p.occupancy), make = (s: PanelSolid) => ({ planes: planes(solidCell(s)).map(q => ({ n: { ...q.n }, d: q.d })), bounds: boundsOf(s.vertices) }), negatives = ctx.items.flatMap(item => ctx.cells(item).map(c => ({ id: item.ref.id, planes: planes(c).map(p => ({ n: { ...p.n }, d: p.d })), bounds: boundsOf(c.faces.flat()) }))), near = boundsIndex(negatives), rooms = p.compartments.map(c => ({ ...c, cells: c.physicalVolume.connectedCells.map(make), excluded: new Set(c.physicalVolume.occupiedRefs) })), walls = p.bulkheads.map(w => ({ ...w, cells: w.pieces.map(make) })), portals = p.openings.map(o => ({ ...o, cells: o.aperture.map(make), leaf: o.closure?.pieces.map(make) ?? [] }));
    const contains = (planes: ReturnType<typeof make>['planes'], point: Vec3) => planes.every(n => point.x * n.n.x + point.y * n.n.y + point.z * n.n.z <= n.d + 1e-7);
    return Object.freeze({ preparationMs: performance.now() - start, cellCount: negatives.length + rooms.reduce((n, c) => n + c.cells.length, 0) + walls.reduce((n, w) => n + w.cells.length, 0) + portals.reduce((n, o) => n + o.cells.length + o.leaf.length, 0),
        at(point: Vec3) { if (!Object.values(point).every(Number.isFinite))
            throw Error('INVALID_INTERIOR_POINT'); const occupied = near(paddedBounds([point])).filter(c => contains(c.planes, point)); return rooms.filter(c => c.cells.some(d => contains(d.planes, point)) && !occupied.some(n => c.excluded.has(n.id))).map(c => ({ compartmentId: c.id, volumeM3: c.volumeM3, pressureCapability: c.pressureCapability, boundaryReferences: [...c.boundaryReferences], structuralFrameReferences: [...c.structuralFrameReferences], adjacentCompartmentIds: [...c.adjacentCompartmentIds] })); },
        unresolvedCandidates(point:Vec3){return unknownVolumes.filter(v=>containsVolume(v,point)).map(v=>({volumeId:v.id,status:'UNRESOLVED_NO_HOLLOW_CONTRACT' as const}));},
        occupancyAt(point: Vec3) { return [...new Set(near(paddedBounds([point])).filter(c => contains(c.planes, point)).map(c => c.id))]; },
        fits(compartmentId: string, solid: PanelSolid) { const room = rooms.find(c => c.id === compartmentId); if (!room)
            throw Error('UNKNOWN_COMPARTMENT'); let outside = [solidCell(solid)]; for (const domain of room.physicalVolume.connectedCells)
            outside = outside.flatMap(c => subtractCell(c, solidCell(domain))); if (outside.reduce((n, c) => n + cellVolume(c), 0) > 1e-7)
            return false; const candidate = solidCell(solid); return !near(boundsOf(solid.vertices)).some(item => { let hit: ReturnType<typeof clipCell> = candidate; for (const plane of item.planes) {
            if (!hit)
                break;
            hit = clipCell(hit, plane.n, plane.d);
        } return hit && cellVolume(hit) > 1e-9; }); },
        probe(origin: Vec3, direction: Vec3, maxDistance: number, state: InteriorInstanceState = createInteriorInstanceState(), transform?: ShipRigidTransform) {
            analyzeInterior(p, state);
            const q = transform?.quaternion, pos = transform?.position;
            if (![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, maxDistance, ...(q ? [q.x, q.y, q.z, q.w, pos!.x, pos!.y, pos!.z] : [])].every(Number.isFinite) || maxDistance <= 0 || Math.hypot(direction.x, direction.y, direction.z) < 1e-12 || q && Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > 1e-6)
                return { valid: false, hits: [] as InteriorHit[], warnings: ['INVALID_INTERIOR_RAY_OR_TRANSFORM'] };
            const rotation = q ? new Quaternion(q.x, q.y, q.z, q.w) : new Quaternion(), translation = new Vector3(pos?.x ?? 0, pos?.y ?? 0, pos?.z ?? 0), inverse = rotation.clone().invert(), o = new Vector3(origin.x, origin.y, origin.z).sub(translation).applyQuaternion(inverse), d = new Vector3(direction.x, direction.y, direction.z).normalize().applyQuaternion(inverse), world = (point: Vec3) => { const v = new Vector3(point.x, point.y, point.z).applyQuaternion(rotation).add(translation); return { x: v.x, y: v.y, z: v.z }; }, rayBounds = boundsOf([o, add(o, mul(d, maxDistance))]);
            for (const axis of ['x', 'y', 'z'] as const) {
                rayBounds.min[axis] -= 1e-7;
                rayBounds.max[axis] += 1e-7;
            }
            const raw: InteriorHit[] = [], push = (kind: InteriorHit['kind'], id: string, materialId: string | null, thicknessMm: number | null, cells: ReturnType<typeof make>[], compartmentIds: string[], state?: string, exclude?: Set<string>) => {
                for (const cell of cells) {
                    const hit = rayPlanes(cell.planes, o, d, maxDistance);
                    if (!hit)
                        continue;
                    let intervals = [[hit.entry, hit.exit]];
                    if (exclude)
                        for (const occupied of near(rayBounds)) {
                            if (!exclude.has(occupied.id))
                                continue;
                            const block = rayPlanes(occupied.planes, o, d, maxDistance);
                            if (block)
                                intervals = intervals.flatMap(([a, b]) => block.exit <= a || block.entry >= b ? [[a, b]] : [...(block.entry > a ? [[a, Math.min(b, block.entry)]] : []), ...(block.exit < b ? [[Math.max(a, block.exit), b]] : [])]);
                        }
                    for (const [a, z] of intervals)
                        if (z - a > 1e-7)
                            raw.push({ kind, id, materialId, thicknessMm, entryDistanceM: a, exitDistanceM: z, pathLengthM: z - a, entryPoint: world(add(o, mul(d, a))), exitPoint: world(add(o, mul(d, z))), entryNormal: hit.entryNormal && Math.abs(a - hit.entry) < 1e-7 ? worldNormal(hit.entryNormal, rotation) : null, compartmentIds: [...compartmentIds], ...(state ? { state } : {}) });
                }
            };
            for (const c of rooms)
                push('COMPARTMENT', c.id, null, null, c.cells, [c.id]);
            for (const w of walls)
                if (!state.disabledBulkheadIds.includes(w.id))
                    push('BULKHEAD', w.id, w.materialId, w.thicknessMm, w.cells, w.adjacentCompartmentIds);
            for (const portal of portals) {
                const value = state.openingStates[portal.id] ?? portal.defaultState, disabled = state.disabledBulkheadIds.includes(p.boundaries.find(b => b.id === portal.boundaryReference)?.bulkheadRef ?? '');
                push('OPENING', portal.id, null, null, portal.cells, [portal.fromCompartmentId, portal.toCompartmentId], disabled ? 'BOUNDARY_DISABLED_HYPOTHESIS' : value);
                if (value !== 'OPEN' && !disabled && portal.closure)
                    push('CLOSURE', portal.closure.id, portal.closure.materialId, portal.closure.thicknessMm, portal.leaf, [portal.fromCompartmentId, portal.toCompartmentId], value);
            }
            raw.sort((a, b) => a.id.localeCompare(b.id) || a.entryDistanceM - b.entryDistanceM);
            const merged: InteriorHit[] = [];
            for (const h of raw) {
                const last = merged.at(-1);
                if (last?.id === h.id && h.entryDistanceM <= last.exitDistanceM + 1e-7) {
                    if (h.exitDistanceM > last.exitDistanceM) {
                        last.exitDistanceM = h.exitDistanceM;
                        last.exitPoint = h.exitPoint;
                        last.pathLengthM = last.exitDistanceM - last.entryDistanceM;
                    }
                }
                else
                    merged.push(h);
            }
            return { valid: true, hits: merged.sort((a, b) => a.entryDistanceM - b.entryDistanceM || a.id.localeCompare(b.id)), warnings: ['Exact intervals for stored finite CSG. Opening overrides/disabled boundaries are temporary hypotheses, not moving-door or damage physics.'] };
        }
    });
}
function worldNormal(p: Vec3, q: Quaternion) { const v = new Vector3(p.x, p.y, p.z).applyQuaternion(q); return { x: v.x, y: v.y, z: v.z }; }
export function interiorRayProbe(b: ShipBlueprint, origin: Vec3, direction: Vec3, maxDistance: number, state?: InteriorInstanceState, transform?: ShipRigidTransform) { return prepareInteriorQueries(b).probe(origin, direction, maxDistance, state, transform); }
