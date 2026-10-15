import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { Vector3, Quaternion } from 'three';
import type { Vec3, StructuralVolume } from '../blueprint/types';
import type { PanelSolid } from '../generation/armor/types';
import type { ConvexCell } from '../physical/types';
import { solidFromRings, solidTriangles, cross, area, normal } from '../generation/armor/panels';
import { planes, cellVolume, tetra, cellSolid, subtractCell, cellBounds, canonicalSolid } from '../physical/convex';
import { add, sub, mul, dot, center, boundsOf } from '../generation/integration/contours';
import { containsVolume } from '../generation/architecture/volumes';
import { shapeStations } from '../generation/shapes/definition';
import { profileRing } from '../generation/hull';
import type { ConnectorPart } from '../generation/architecture/connector-geometry';
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const vec = (v: Vec3) => new Vector3(v.x, v.y, v.z);
export function beamSolid(a: Vec3, b: Vec3, width: number, height = width, hex = false): PanelSolid {
    const delta = vec(b).sub(vec(a)), length = delta.length();
    if (length < 1e-8)
        throw Error('STRUCTURAL_ZERO_LENGTH_BEAM');
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize()), c = vec(a).add(vec(b)).multiplyScalar(.5);
    const shape = hex ? Array.from({ length: 6 }, (_, i) => [Math.sin(i * Math.PI / 3) * width / 2, Math.cos(i * Math.PI / 3) * width / 2]) : [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]];
    return solidFromRings([-length / 2, length / 2].map(y => shape.map(([x, z]) => { const p = new Vector3(x, y, z).applyQuaternion(q).add(c); return { x: p.x, y: p.y, z: p.z }; })));
}
/** Exact tetra partition of a star-shaped station slice, or its single convex cell. */
export function convexParts(s: PanelSolid): ConvexCell[] {
    const c = structuralCell(s), ps = planes(c), vs = s.vertices;
    if (ps.every(p => vs.every(v => dot(v, p.n) <= p.d + 1e-7)))
        return [c];
    const k = center(vs);
    if (!ps.every(p => dot(k, p.n) <= p.d + 1e-7))
        throw Error('UNSUPPORTED_NON_STAR_STRUCTURAL_LOFT');
    return solidTriangles(s).map(t => tetra(t[0], t[1], t[2], k)).filter(c => cellVolume(c) > 1e-10);
}
export function connectorSolids(p: ConnectorPart): PanelSolid[] {
    if (p.kind === 'BEAM')
        return [beamSolid(p.start, p.end, p.radius * 2, p.radius * 2, true)];
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), vec(p.axis)), c = vec(p.position);
    // Historical no-join collar is a true THREE.BoxGeometry, not an octagonal loft.
    if (p.id === 'box') {
        const rings = [-p.shape.length / 2, p.shape.length / 2].map(z => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => { const v = new Vector3(x * p.shape.width / 2, y * p.shape.height / 2, z).applyQuaternion(q).add(c); return { x: v.x, y: v.y, z: v.z }; }));
        return [solidFromRings(rings)];
    }
    const rings = shapeStations(p.shape).map(s => profileRing(s).map(([x, y]) => { const v = new Vector3(x, y, s.z).applyQuaternion(q).add(c); return { x: v.x, y: v.y, z: v.z }; }));
    return rings.slice(1).map((r, i) => solidFromRings([rings[i], r]));
}
export const inCell = (p: Vec3, c: ConvexCell, tolerance = 1e-6) => planes(c).every(f => dot(p, f.n) <= f.d + tolerance);
export function beamFitsHost(s: PanelSolid, host: StructuralVolume) {
    // Track every station crossing as well as regular cross sections; no AABB-only containment.
    const vertices = s.vertices, n = vertices.length / 2, a = center(vertices.slice(0, n)), b = center(vertices.slice(n)), ts = new Set([0, .25, .5, .75, 1]);
    for (const station of host.geometry.stations) {
        const z = station.z + host.position.z;
        if (Math.abs(b.z - a.z) > 1e-9) {
            const t = (z - a.z) / (b.z - a.z);
            if (t > 0 && t < 1)
                ts.add(t);
        }
    }
    return [...ts].every(t => vertices.slice(0, n).every((p, i) => containsVolume(host, add(p, mul(sub(vertices[n + i], p), t)), 1e-6)));
}
export function exclusiveMaterial(solids: PanelSolid[], previous: {
    cell: ConvexCell;
    bounds: ReturnType<typeof boundsOf>;
}[]) {
    const result: ConvexCell[] = [];
    for (const solid of solids)
        for (const c of convexParts(solid)) {
            const bound = cellBounds(c), candidates = previous.filter(p => overlap(bound, p.bounds));
            let pieces = [c];
            for (const p of candidates) {
                pieces = pieces.flatMap(c => subtractCell(c, p.cell));
                if (!pieces.length)
                    break;
            }
            for (const cell of pieces) {
                result.push(cell);
                previous.push({ cell, bounds: cellBounds(cell) });
            }
        }
    return result;
}
export const overlap = (a: ReturnType<typeof boundsOf>, b: ReturnType<typeof boundsOf>) => a.min.x <= b.max.x + 1e-7 && a.max.x + 1e-7 >= b.min.x && a.min.y <= b.max.y + 1e-7 && a.max.y + 1e-7 >= b.min.y && a.min.z <= b.max.z + 1e-7 && a.max.z + 1e-7 >= b.min.z;
/** Signed tetrahedra about a nearby origin: volume of the FINAL stored boundary. */
export function structuralMaterialVolume(s: PanelSolid) { const origin = center(s.vertices); return Math.abs(solidTriangles(s).reduce((sum, [a, b, c]) => sum + dot(sub(a, origin), cross(sub(b, origin), sub(c, origin))) / 6, 0)); }
/** All finite faces, including sub-resolution sliver caps. The general skin helper
 * intentionally drops tiny faces; structural closed-cell queries must retain them. */
export function structuralCell(s: PanelSolid): ConvexCell {
    const o = center(s.vertices);
    return { faces: solidTriangles(s).filter(t => area(t) > 1e-24).map(t => dot(normal(t), sub(center(t), o)) < 0 ? [...t].reverse() : t) };
}
export function closureResidual(s: PanelSolid) {
    let surface = 0, flux = { x: 0, y: 0, z: 0 };
    for (const [a, b, c] of solidTriangles(s)) {
        const n = mul(cross(sub(b, a), sub(c, a)), .5);
        flux = add(flux, n);
        surface += Math.hypot(n.x, n.y, n.z);
    }
    return { surfaceAreaM2: surface, openAreaVectorM2: Math.hypot(flux.x, flux.y, flux.z) };
}
/** Preserve every vertex and restore a watertight convex boundary if epsilon
 * cleanup dropped a tiny cap. No material density/thickness or exterior moves. */
export function closedStructuralSolid(cell: ConvexCell): PanelSolid {
    const raw = canonicalSolid(cell), residual = closureResidual(raw), convex = planes(structuralCell(raw)).every(p => raw.vertices.every(v => dot(v, p.n) <= p.d + 1e-5));
    if (convex && residual.openAreaVectorM2 <= Math.max(1e-11, residual.surfaceAreaM2 * 1e-13))
        return raw;
    const points = cell.faces.flat(), authority = planes(cell);
    for (const resolution of [0, 1e-7 / 16, 1e-7]) {
        try {
            const hull = new ConvexHull();
            if (resolution) {
                const h = hull as ConvexHull & {
                    _computeExtremes: () => unknown;
                }, original = h._computeExtremes;
                h._computeExtremes = function () { const result = original.call(this); this.tolerance = Math.max(this.tolerance, resolution); return result; };
            }
            hull.setFromPoints(points.map(p => new Vector3(p.x, p.y, p.z)));
            const vertices: Vec3[] = [], indices: number[] = [];
            for (const face of hull.faces) {
                let edge = face.edge;
                const ps: Vec3[] = [];
                do {
                    const p = edge.head().point;
                    ps.push({ x: p.x, y: p.y, z: p.z });
                    edge = edge.next;
                } while (edge !== face.edge);
                const off = vertices.length;
                vertices.push(...ps);
                for (let i = 1; i < ps.length - 1; i++)
                    indices.push(off, off + i, off + i + 1);
            }
            const result = { vertices, indices }, check = closureResidual(result), ps = planes(structuralCell(result));
            if (!indices.length || check.openAreaVectorM2 > Math.max(1e-11, check.surfaceAreaM2 * 1e-13) || ps.some(p => vertices.some(v => dot(v, p.n) > p.d + 1e-5)) || ps.some(p => points.some(v => dot(v, p.n) > p.d + 1e-5)) || vertices.some(v => authority.some(p => dot(v, p.n) > p.d + 1e-5)))
                continue;
            return result;
        }
        catch { /* Try the same 6.25nm / 0.1µm robustness limits as the existing physical cell builder. */ }
    }
    throw Error('REQUIRED_STRUCTURAL_CLOSED_CELL_UNAVAILABLE');
}
