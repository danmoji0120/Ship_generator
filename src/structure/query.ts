import { structuralCell } from './geometry';
import { Vector3, Quaternion } from 'three';
import type { ShipBlueprint, Vec3 } from '../blueprint/types';
import type { ShipRigidTransform } from '../physical/probe';
import { solidCell, planes, rayPlanes } from '../physical/convex';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import { boundsOf, add, mul } from '../generation/integration/contours';
import type { StructuralFramePlan } from './types';
export const structuralMember = (b: ShipBlueprint, id: string) => b.structuralFrame?.members.find(m => m.id === id);
export interface StructuralHit {
    memberId: string;
    materialId: string;
    nodeIds: string[];
    edgeId: string;
    jointIds: string[];
    volumeM3: number;
    massKg: number;
    entryDistanceM: number;
    exitDistanceM: number;
    pathLengthM: number;
    entryPoint: Vec3;
    exitPoint: Vec3;
    entryNormal: Vec3 | null;
}
export interface StructuralProbeResult {
    valid: boolean;
    exactForStoredFiniteCells: boolean;
    warnings: string[];
    hits: StructuralHit[];
}
let cache = new WeakMap<StructuralFramePlan, {
    key: string;
    query: ReturnType<typeof buildQuery>;
}>();
export const releaseStructuralQueries=(b:ShipBlueprint)=>{if(b.structuralFrame)cache.delete(b.structuralFrame);};
export const clearStructuralQueryCache = () => { cache = new WeakMap(); };
export function prepareStructuralQueries(b: ShipBlueprint) {
    const f = b.structuralFrame;
    if (!f)
        throw Error('STRUCTURAL_DATA_ABSENT: legacy design is not automatically redesigned');
    const key = JSON.stringify(f);
    const found = cache.get(f);
    if (found?.key === key)
        return found.query;
    const query = buildQuery(f);
    cache.set(f, { key, query });
    return query;
}
function buildQuery(f: StructuralFramePlan) {
    const start = performance.now(), members = f.members.map(m => ({ id: m.id, materialId: m.materialId, nodeIds: [...m.nodeIds], edgeId: 'se/' + m.id, jointIds: [...m.jointIds], volumeM3: m.volumeM3, massKg: m.massKg }));
    const parts = f.members.flatMap((m, i) => m.pieces.map(p => ({ member: members[i], bounds: boundsOf(p.vertices), planes: planes(structuralCell(p)).map(p => ({ n: { ...p.n }, d: p.d })) }))), near = boundsIndex(parts), planeCount = parts.reduce((n, p) => n + p.planes.length, 0);
    const xyz = (v: Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
    return Object.freeze({ pieceCount: parts.length, planeCount, estimatedBytes: planeCount * 32 + parts.length * 64, preparationMs: performance.now() - start,
        candidates(point: Vec3, radiusM = 0) {
            if (![point.x, point.y, point.z, radiusM].every(Number.isFinite) || radiusM < 0)
                throw Error('INVALID_STRUCTURAL_POINT_QUERY');
            const bounds = { min: { x: point.x - radiusM, y: point.y - radiusM, z: point.z - radiusM }, max: { x: point.x + radiusM, y: point.y + radiusM, z: point.z + radiusM } };
            return [...new Map(near(bounds).filter(p => radiusM > 0 || p.planes.every(f => point.x * f.n.x + point.y * f.n.y + point.z * f.n.z <= f.d + 1e-7)).map(p => [p.member.id, p.member])).values()].map(m => ({ ...m, nodeIds: [...m.nodeIds], jointIds: [...m.jointIds] }));
        },
        probe(origin: Vec3, direction: Vec3, maxDistance: number, transform?: ShipRigidTransform): StructuralProbeResult {
            const q = transform?.quaternion, pos = transform?.position;
            if (![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, maxDistance, ...(q ? [q.x, q.y, q.z, q.w, pos!.x, pos!.y, pos!.z] : [])].every(Number.isFinite) || maxDistance <= 0 || Math.hypot(direction.x, direction.y, direction.z) < 1e-12 || q && Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > 1e-6)
                return { valid: false, exactForStoredFiniteCells: false, warnings: ['INVALID_STRUCTURAL_RAY_OR_TRANSFORM'], hits: [] };
            const rotation = q ? new Quaternion(q.x, q.y, q.z, q.w) : new Quaternion(), translation = pos ? new Vector3(pos.x, pos.y, pos.z) : new Vector3(), inverse = rotation.clone().invert(), o = xyz(new Vector3(origin.x, origin.y, origin.z).sub(translation).applyQuaternion(inverse)), d = xyz(new Vector3(direction.x, direction.y, direction.z).normalize().applyQuaternion(inverse)), bounds = boundsOf([o, add(o, mul(d, maxDistance))]);
            for (const k of ['x', 'y', 'z'] as const) {
                bounds.min[k] -= 1e-7;
                bounds.max[k] += 1e-7;
            }
            const world = (p: Vec3) => xyz(new Vector3(p.x, p.y, p.z).applyQuaternion(rotation).add(translation));
            const hits: StructuralHit[] = [];
            for (const p of near(bounds)) {
                const hit = rayPlanes(p.planes, o, d, maxDistance);
                if (hit)
                    hits.push({ memberId: p.member.id, ...p.member, nodeIds: [...p.member.nodeIds], jointIds: [...p.member.jointIds], entryDistanceM: hit.entry, exitDistanceM: hit.exit, pathLengthM: hit.exit - hit.entry, entryPoint: world(add(o, mul(d, hit.entry))), exitPoint: world(add(o, mul(d, hit.exit))), entryNormal: hit.entryNormal ? xyz(new Vector3(hit.entryNormal.x, hit.entryNormal.y, hit.entryNormal.z).applyQuaternion(rotation)) : null });
            }
            hits.sort((a, b) => a.memberId.localeCompare(b.memberId) || a.entryDistanceM - b.entryDistanceM);
            const merged: StructuralHit[] = [];
            for (const h of hits) {
                const last = merged.at(-1);
                if (last?.memberId === h.memberId && h.entryDistanceM <= last.exitDistanceM + 1e-7) {
                    if (h.exitDistanceM > last.exitDistanceM) {
                        last.exitDistanceM = h.exitDistanceM;
                        last.exitPoint = h.exitPoint;
                        last.pathLengthM = last.exitDistanceM - last.entryDistanceM;
                    }
                }
                else
                    merged.push(h);
            }
            return { valid: true, exactForStoredFiniteCells: true, warnings: ['Exact exclusive finite frame cells; Hull/armor queried separately. Beam containment is station-sampled; welded topology is an ideal model, not stress analysis.'], hits: merged.sort((a, b) => a.entryDistanceM - b.entryDistanceM || a.memberId.localeCompare(b.memberId)) };
        } });
}
export function structuralRayProbe(b: ShipBlueprint, origin: Vec3, direction: Vec3, maxDistance: number, transform?: ShipRigidTransform): StructuralProbeResult {
    if (!b.structuralFrame)
        return { valid: false, exactForStoredFiniteCells: false, warnings: ['STRUCTURAL_DATA_ABSENT_LEGACY_DESIGN'], hits: [] };
    return prepareStructuralQueries(b).probe(origin, direction, maxDistance, transform);
}
