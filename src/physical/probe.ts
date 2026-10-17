import {integratedLayerVolumes} from './integration';
import { prepareUnresolvedSpines, unresolvedCrossings, type UnresolvedCrossing } from './unresolved';
import { cross } from '../generation/armor/panels';
import { Vector3, Quaternion } from 'three';
import type { ShipBlueprint, Vec3 } from '../blueprint/types';
import type { PhysicalDesign, ProtectionSurface } from './types';
import { EPS, solidCell, planes, rayPlanes } from './convex';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import { add, mul, dot, boundsOf } from '../generation/integration/contours';
export interface ShipRigidTransform {
    position: Vec3;
    quaternion: {
        x: number;
        y: number;
        z: number;
        w: number;
    };
}
export interface ProbeHit {
    surfaceId: string;
    plateId?: string;
    shellId?: string;
    materialId: string;
    constituentMaterialId: string;
    layerId: string;
    layerOrder: number;
    nominalLayerThicknessMm: number;
    localFacetLayerThicknessMm: number;
    measuredNormalThicknessMm: number;
    pathLengthM: number;
    entryPoint: Vec3;
    exitPoint: Vec3;
    entryDistanceM: number;
    exitDistanceM: number;
    incidenceDegrees: number | null;
    surfaceNormal: Vec3;
    entryBoundaryNormal: Vec3 | null;
    isArmorLayer: boolean;
    coveredByArmor: boolean;
}
export interface ProbeResult {
    valid: boolean;
    exactForStoredCells: boolean;
    approximation: string;
    warnings: string[];
    hits: ProbeHit[];
    complete: boolean;
    unresolvedCrossings: UnresolvedCrossing[];
}
type Metadata = Pick<ProtectionSurface, 'id' | 'kind' | 'materialId' | 'thicknessMm' | 'facets' | 'layerStack'>;
type Plane = {
    n: Vec3;
    d: number;
};
interface Part {
    bounds: ReturnType<typeof boundsOf>;
    surface: Metadata;
    facetIndex: number;
    layers: {
        order: number;
        planes: Plane[];
    }[];
}
/** Runtime-only immutable snapshot. Calling prepare again checks all query inputs;
 * the prepared handle intentionally retains its original design if the editor changes. */
export interface PreparedPhysicalQueries {
    readonly preparationMs: number;
    readonly pieceCount: number;
    readonly planeCount: number;
    readonly estimatedBytes: number;
    probe(origin: Vec3, direction: Vec3, maxDistance: number, transform?: ShipRigidTransform): ProbeResult;
}
let cache = new WeakMap<PhysicalDesign, {
    key: string;
    handle: PreparedPhysicalQueries;
}>();
export function clearPhysicalQueryCache() { cache = new WeakMap(); }
export function releasePhysicalQueries(b:ShipBlueprint){if(b.physicalDesign)cache.delete(b.physicalDesign);}
function queryKey(b: ShipBlueprint) { const d = b.physicalDesign!; return JSON.stringify([b.schemaVersion, d.version, d.materialRegistryVersion, d.geometryModel, d.approximation, d.warnings, (b.structuralVolumes ?? []).filter(v => v.type === 'SPINE'), d.surfaces.map(s => [s.id, s.kind, s.materialId, s.thicknessMm, s.facets.map(f => [f.normal, f.planeOffsetM, f.thicknessMm]), s.layerStack.map(l => [l.layerId, l.layerOrder, l.constituentMaterialId, l.thicknessMm]), s.pieces.map(p => [p.facetIndex, p.layerOrder, p.solid])])]); }
export function preparePhysicalQueries(b: ShipBlueprint): PreparedPhysicalQueries {
    const d = b.physicalDesign;
    if (!d)
        throw Error('PHYSICAL_DATA_ABSENT: explicit migration or regeneration required');
    const key = queryKey(b), found = cache.get(d);
    if (found?.key === key)
        return found.handle;
    const start = performance.now(), parts: Part[] = [];
    let planeCount = 0;
    for (const source of d.surfaces) {
        const surface: Metadata = { id: source.id, kind: source.kind, materialId: source.materialId, thicknessMm: source.thicknessMm, facets: source.facets.map(f => ({ ...f, normal: { ...f.normal } })), layerStack: source.layerStack.map(l => ({ ...l })) };
        for (const piece of source.pieces) {
            const base = planes(solidCell(piece.solid)).map(p => ({ n: { ...p.n }, d: p.d })), f = surface.facets[piece.facetIndex], layers: Part['layers'] = [];
            if (piece.layerOrder >= 0)
                layers.push({ order: piece.layerOrder, planes: base });
            else {
                const activeLayers=new Set(integratedLayerVolumes(source,piece).map(p=>p.layerOrder));
                let depth = 0;
                for (const l of surface.layerStack) {
                    const end = depth + l.thicknessMm / 1000 * f.thicknessMm / surface.thicknessMm;
                    if(activeLayers.has(l.layerOrder))layers.push({ order: l.layerOrder, planes: [...base, { n: f.normal, d: f.planeOffsetM - depth }, { n: mul(f.normal, -1), d: -(f.planeOffsetM - end) }] });
                    depth = end;
                }
            }
            planeCount += base.length + (piece.layerOrder < 0 ? layers.length * 2 : 0);
            parts.push({ bounds: boundsOf(piece.solid.vertices), surface, facetIndex: piece.facetIndex, layers });
        }
    }
    const query = boundsIndex(parts), spines = prepareUnresolvedSpines(b), meta = { geometryModel: d.geometryModel, approximation: d.approximation, warnings: [...d.warnings] }, handle: PreparedPhysicalQueries = Object.freeze({ preparationMs: performance.now() - start, pieceCount: parts.length, planeCount, estimatedBytes: planeCount * 32 + parts.length * 64, probe: (o: Vec3, v: Vec3, max: number, t?: ShipRigidTransform) => probePrepared(meta, query, spines, o, v, max, t) });
    cache.set(d, { key, handle });
    return handle;
}
const xyz = (v: Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
const invalid = (reason: string): ProbeResult => ({ valid: false, exactForStoredCells: false, approximation: '', warnings: [reason], hits: [], complete: false, unresolvedCrossings: [] });
const rayBounds = (points: Vec3[]) => { const b = boundsOf(points); for (const k of ['x', 'y', 'z'] as const) {
    b.min[k] -= EPS;
    b.max[k] += EPS;
} return b; };
function invalidInput(o: Vec3, v: Vec3, max: number, t?: ShipRigidTransform) {
    if (![o.x, o.y, o.z, v.x, v.y, v.z, max].every(Number.isFinite) || max <= 0 || Math.hypot(v.x, v.y, v.z) < 1e-12)
        return 'INVALID_PROBE_RAY';
    if (t) {
        const q = t.quaternion, p = t.position;
        if (![q.x, q.y, q.z, q.w, p.x, p.y, p.z].every(Number.isFinite) || Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > 1e-6)
            return 'INVALID_RIGID_SHIP_TRANSFORM';
    }
}
export function armorRayProbe(b: ShipBlueprint, o: Vec3, v: Vec3, max: number, t?: ShipRigidTransform): ProbeResult {
    if (!b.physicalDesign)
        return invalid('PHYSICAL_DATA_ABSENT: explicit migration or regeneration required');
    const reason = invalidInput(o, v, max, t);
    if (reason)
        return invalid(reason);
    return preparePhysicalQueries(b).probe(o, v, max, t);
}
function probePrepared(d: Pick<PhysicalDesign, 'geometryModel' | 'approximation' | 'warnings'>, query: ReturnType<typeof boundsIndex<Part>>, spines: ReturnType<typeof prepareUnresolvedSpines>, rayOrigin: Vec3, rayDirection: Vec3, maxDistance: number, transform?: ShipRigidTransform): ProbeResult {
    const reason = invalidInput(rayOrigin, rayDirection, maxDistance, transform);
    if (reason)
        return invalid(reason);
    const rotation = new Quaternion(), translation = new Vector3();
    if (transform) {
        const q = transform.quaternion, p = transform.position;
        rotation.set(q.x, q.y, q.z, q.w);
        translation.set(p.x, p.y, p.z);
    }
    const inverse = rotation.clone().invert(), o = xyz(new Vector3(rayOrigin.x, rayOrigin.y, rayOrigin.z).sub(translation).applyQuaternion(inverse)), dir = xyz(new Vector3(rayDirection.x, rayDirection.y, rayDirection.z).normalize().applyQuaternion(inverse));
    const toWorld = (p: Vec3) => xyz(new Vector3(p.x, p.y, p.z).applyQuaternion(rotation).add(translation)), toNormal = (p: Vec3) => xyz(new Vector3(p.x, p.y, p.z).applyQuaternion(rotation));
    const hits: ProbeHit[] = [];
    for (const part of query(rayBounds([o, add(o, mul(dir, maxDistance))])))
        for (const entry of part.layers) {
            const r = rayPlanes(entry.planes, o, dir, maxDistance);
            if (!r)
                continue;
            const surface = part.surface, l = surface.layerStack[entry.order], f = surface.facets[part.facetIndex], localEntry = add(o, mul(dir, r.entry)), span = surface.thicknessMm / 1000 + .01, normalOrigin = add(localEntry, mul(f.normal, span)), normalDirection = mul(f.normal, -1), intervals: {
                entry: number;
                exit: number;
            }[] = [];
            for (const candidate of query(rayBounds([normalOrigin, add(normalOrigin, mul(normalDirection, span * 2))])))
                if (candidate.surface.id === surface.id && candidate.facetIndex === part.facetIndex) {
                    const layer = candidate.layers.find(l => l.order === entry.order);
                    if (layer) {
                        const interval = rayPlanes(layer.planes, normalOrigin, normalDirection, span * 2);
                        if (interval)
                            intervals.push(interval);
                    }
                }
            intervals.sort((a, b) => a.entry - b.entry);
            let normalLength = 0, lastExit = -Infinity;
            for (const interval of intervals) {
                normalLength += Math.max(0, interval.exit - Math.max(interval.entry, lastExit));
                lastExit = Math.max(lastExit, interval.exit);
            }
            hits.push({ surfaceId: surface.id, ...(surface.kind === 'ARMOR' ? { plateId: surface.id } : { shellId: surface.id }), materialId: surface.materialId, constituentMaterialId: l.constituentMaterialId, layerId: surface.id + '/' + l.layerId, layerOrder: l.layerOrder, nominalLayerThicknessMm: l.thicknessMm, measuredNormalThicknessMm: normalLength * 1000, localFacetLayerThicknessMm: l.thicknessMm * f.thicknessMm / surface.thicknessMm, pathLengthM: r.exit - r.entry, entryPoint: toWorld(add(o, mul(dir, r.entry))), exitPoint: toWorld(add(o, mul(dir, r.exit))), entryDistanceM: r.entry, exitDistanceM: r.exit, incidenceDegrees: r.entryNormal ? Math.atan2(Math.hypot(...Object.values(cross(r.entryNormal, dir))), Math.abs(dot(r.entryNormal, dir))) * 180 / Math.PI : null, surfaceNormal: toNormal(f.normal), entryBoundaryNormal: r.entryNormal ? toNormal(r.entryNormal) : null, isArmorLayer: surface.kind === 'ARMOR', coveredByArmor: surface.kind === 'ARMOR' });
        }
    const groups = new Map<string, ProbeHit[]>();
    for (const hit of hits) {
        const g = groups.get(hit.layerId) ?? [];
        g.push(hit);
        groups.set(hit.layerId, g);
    }
    const merged: ProbeHit[] = [];
    for (const hs of groups.values()) {
        hs.sort((a, b) => a.entryDistanceM - b.entryDistanceM);
        let current: ProbeHit | undefined;
        for (const h of hs) {
            if (current && h.entryDistanceM <= current.exitDistanceM + 1e-7) {
                if (h.exitDistanceM > current.exitDistanceM) {
                    current.exitDistanceM = h.exitDistanceM;
                    current.exitPoint = h.exitPoint;
                    current.pathLengthM = current.exitDistanceM - current.entryDistanceM;
                }
            }
            else {
                current = { ...h };
                merged.push(current);
            }
        }
    }
    merged.sort((a, b) => a.entryDistanceM - b.entryDistanceM || a.layerOrder - b.layerOrder);
    for (const h of merged)
        if (!h.isArmorLayer)
            h.coveredByArmor = merged.some(a => a.isArmorLayer && a.exitDistanceM <= h.entryDistanceM + 1e-7);
    const warnings = [d.approximation, ...d.warnings];
    if (merged.some(h => h.incidenceDegrees === null))
        warnings.push('START_INSIDE_LAYER: entry face and incidence angle undefined');
    const unresolved = unresolvedCrossings(spines, o, dir, maxDistance).map(c => ({ ...c, point: toWorld(c.point), normal: toNormal(c.normal) }));
    if (unresolved.length)
        warnings.push('INCOMPLETE_MATERIAL_QUERY: intersected actual SPINE boundaries lack specified shell material/thickness; no invented protection or mass.');
    return { valid: true, complete: !unresolved.length, unresolvedCrossings: unresolved, exactForStoredCells: true, approximation: d.geometryModel, warnings, hits: merged };
}
