import type { ShipBlueprint, Vec3 } from '../blueprint/types';
import type { PanelSolid } from '../generation/armor/types';
import type { ConvexCell } from '../physical/types';
import type { OccupancyRef } from './types';
import { solidCell, cellBounds, cellVolume, planes, clipCell, subtractCell, intersectCells, subtractPolygon, polygonLayer } from '../physical/convex';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import { boundsOf, center, dot, mul, add } from '../generation/integration/contours';
import { area, clipHalfSpace } from '../generation/armor/panels';
import { convexParts, closedStructuralSolid } from '../structure/geometry';
export { closedStructuralSolid as storedSolid } from '../structure/geometry';
export const axisVector = (axis: 'y' | 'z'): Vec3 => axis === 'y' ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
export function slice(c: ConvexCell, axis: 'y' | 'z', lo: number, hi: number) { const a = clipCell(c, axisVector(axis), hi); return a ? clipCell(a, axisVector(axis), lo, false) : undefined; }
export const paddedBounds = (points: Vec3[]) => { const b = boundsOf(points); for (const k of ['x', 'y', 'z'] as const) {
    b.min[k] -= 1e-7;
    b.max[k] += 1e-7;
} return b; };
export const inclusiveClip = (poly: Vec3[], n: Vec3, d: number, positive = false) => poly.every(v => Math.abs(dot(v, n) - d) < 1e-7) ? poly : clipHalfSpace(poly, n, d, positive);
export function polygonSlice(p: Vec3[], axis: 'y' | 'z', lo: number, hi: number) { let q = inclusiveClip(p, axisVector(axis), hi); q = inclusiveClip(q, axisVector(axis), lo, true); return q; }
export const inside = (p: Vec3, c: ConvexCell, tolerance = 1e-7) => planes(c).every(n => dot(n.n, p) <= n.d + tolerance);
export function context(b: ShipBlueprint, refs?: OccupancyRef[]) {
    const inventory: OccupancyRef[] = refs ?? [
        ...(b.physicalDesign?.surfaces.flatMap(s => s.pieces.map((_, i) => ({ id: `skin/${s.id}/${i}`, kind: 'SKIN' as const, ownerId: s.id, index: i }))) ?? []),
        // Union(envelope + skin) equals Union(exclusive frame pieces + skin). Reusing envelopes
        // avoids thousands of thin ownership fragments; it never invents hollow connectors.
        ...(b.structuralFrame?.members.flatMap(m => m.envelope.map((_, i) => ({ id: `frame/${m.id}/${i}`, kind: 'FRAME_ENVELOPE' as const, ownerId: m.id, index: i }))) ?? []),
        ...(b.prefabPlacements ?? []).flatMap(p => (p.assembly?.parts ?? []).map((part, i) => ({ id: `core/${p.id}/${i}`, kind: 'CORE' as const, ownerId: p.id, index: i })))
    ];
    const surfaces = new Map(b.physicalDesign?.surfaces.map(s => [s.id, s])), members = new Map(b.structuralFrame?.members.map(m => [m.id, m])), prefabs = new Map(b.prefabPlacements?.map(p => [p.id, p]));
    const get = (r: OccupancyRef): PanelSolid => r.kind === 'SKIN' ? surfaces.get(r.ownerId)!.pieces[r.index].solid : r.kind === 'FRAME_ENVELOPE' ? members.get(r.ownerId)!.envelope[r.index] : prefabs.get(r.ownerId)!.assembly!.parts[r.index].solid;
    const items = inventory.map((ref, i) => ({ ref, i, solid: get(ref), bounds: boundsOf(get(ref).vertices) })), near = boundsIndex(items), cache = new WeakMap<object, ConvexCell[]>();
    const cells = (item: typeof items[number]) => { let c = cache.get(item); if (!c) {
        c = item.ref.kind === 'CORE' ? convexParts(item.solid) : [solidCell(item.solid)];
        cache.set(item, c);
    } return c; };
    const byId = new Map(items.map(i => [i.ref.id, i]));
    return { inventory, items, near, cells, byId };
}
export type InteriorContext = ReturnType<typeof context>;
/** Finite union material intersection, with stable ownership, no shell/frame double count. */
export function emptyVolume(domains: ConvexCell[], ctx: InteriorContext) {
    let domainVolume = 0, occupied = 0;
    const refs = new Set<string>();
    let moment = { x: 0, y: 0, z: 0 };
    for (const domain of domains) {
        const dv = cellVolume(domain), dc = cellCentroid(domain);
        domainVolume += dv;
        moment = add(moment, mul(dc, dv));
        const candidates = ctx.near(cellBounds(domain)).sort((a, b) => a.i - b.i), clips = candidates.flatMap(item => ctx.cells(item).map((c, j) => { const cell = intersectCells(domain, c); return cell ? { cell, bounds: cellBounds(cell), item, j } : null; }).filter((x): x is NonNullable<typeof x> => !!x && cellVolume(x.cell) > 1e-9));
        const prior = boundsIndex(clips);
        for (let i = 0; i < clips.length; i++) {
            const candidate = clips[i];
            let parts = [candidate.cell];
            for (const old of prior(candidate.bounds)) {
                if (old.item.i > candidate.item.i || old.item.i === candidate.item.i && old.j >= candidate.j)
                    continue;
                parts = parts.flatMap(p => subtractCell(p, old.cell));
                if (!parts.length)
                    break;
            }
            const v = parts.reduce((n, p) => n + cellVolume(p), 0);
            if (v > 1e-9) {
                refs.add(candidate.item.ref.id);
                occupied += v;
                for (const p of parts)
                    moment = add(moment, mul(cellCentroid(p), -cellVolume(p)));
            }
        }
    }
    const volume = domainVolume - occupied;
    if (volume < -Math.max(1e-5, domainVolume * 1e-8))
        throw Error('INTERIOR_OCCUPANCY_UNION_INVALID');
    return { volumeM3: Math.max(0, volume), domainVolumeM3: domainVolume, occupiedVolumeM3: occupied, centroid: volume > 1e-9 ? mul(moment, 1 / volume) : { x: 0, y: 0, z: 0 }, refs: [...refs] };
}
export function cellCentroid(c: ConvexCell): Vec3 { const o = center(c.faces.flat()); let v = 0, m = { x: 0, y: 0, z: 0 }; for (const f of c.faces)
    for (let i = 1; i < f.length - 1; i++) {
        const a = f[0], b = f[i], d = f[i + 1], x = { x: a.x - o.x, y: a.y - o.y, z: a.z - o.z }, y = { x: b.x - o.x, y: b.y - o.y, z: b.z - o.z }, z = { x: d.x - o.x, y: d.y - o.y, z: d.z - o.z }, w = Math.abs(x.x * (y.y * z.z - y.z * z.y) - x.y * (y.x * z.z - y.z * z.x) + x.z * (y.x * z.y - y.y * z.x)) / 6;
        v += w;
        m = add(m, mul(add(add(o, a), add(b, d)), w / 4));
    } return v ? mul(m, 1 / v) : o; }
export function carve(domains: ConvexCell[], ctx: InteriorContext, extra: ConvexCell[] = []) {
    let out: ConvexCell[] = [];
    for (const d of domains) {
        let parts = [d];
        for (const item of ctx.near(cellBounds(d)))
            for (const cell of ctx.cells(item)) {
                parts = parts.flatMap(p => subtractCell(p, cell));
                if (parts.length > 12000)
                    throw Error('INTERIOR_FRAGMENT_LIMIT');
            }
        for (const cell of extra)
            parts = parts.flatMap(p => subtractCell(p, cell));
        out.push(...parts);
    }
    return out;
}
export function freePolygon(poly: Vec3[], ctx: InteriorContext) { let out = [poly]; for (const item of ctx.near(paddedBounds(poly)))
    for (const cell of ctx.cells(item)) {
        out = out.flatMap(p => subtractPolygon(p, cell));
        if (!out.length)
            return out;
    } return out.filter(p => area(p) > 1e-7); }
export function clipPolygonToCell(poly: Vec3[], cell: ConvexCell) { let p = poly; for (const n of planes(cell)) {
    p = inclusiveClip(p, n.n, n.d);
    if (p.length < 3)
        return [];
} return p; }
export const polygonPrism = (p: Vec3[], thickness: number) => polygonLayer(p, { x: 0, y: 0, z: 0 }, -thickness / 2, thickness / 2, true);
export function closurePieces(cells: ConvexCell[]) { return cells.filter(c => cellVolume(c) > 1e-9).map(closedStructuralSolid); }
/** Actual finite outer faces and their uncovered pieces. Bounds are padded only for
 * broad-phase face search; final geometry clipping is unchanged. */
export function exteriorAudit(source: import('../physical/geometry').PhysicalSource, sources: import('../physical/geometry').PhysicalSource[], ctx: InteriorContext) {
    const items = sources.flatMap(s => s.cells.map(c => ({ ...c, host: s.parent }))), near = boundsIndex(items), patches: Vec3[][] = [], gaps: Vec3[][] = [];
    for (const tri of source.triangles) {
        let polys = [tri];
        for (const other of near(paddedBounds(tri))) {
            if (other.host === source.parent)
                continue;
            polys = polys.flatMap(poly => subtractPolygon(poly, other.cell));
        }
        for (const poly of polys) {
            if (area(poly) < 1e-7)
                continue;
            patches.push(poly);
            gaps.push(...freePolygon(poly, ctx));
        }
    }
    return { patches, gaps };
}
export const characteristicWidth = (poly: Vec3[]) => 2 * area(poly) / poly.reduce((sum, v, i) => sum + Math.hypot(v.x - poly[(i + 1) % poly.length].x, v.y - poly[(i + 1) % poly.length].y, v.z - poly[(i + 1) % poly.length].z), 0);
