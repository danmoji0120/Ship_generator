import type { Vec3 } from '../blueprint/types';
import type { PhysicalPiece, ProtectionSurface } from './types';
/** Determinant integration over the actual closed, convex stored mesh. No density,
 * footprint, depth or geometry approximation is introduced by this integrator. */
export function tetraVolume(a: Vec3, b: Vec3, c: Vec3, d: Vec3) {
    const ax = b.x - a.x, ay = b.y - a.y, az = b.z - a.z, bx = c.x - a.x, by = c.y - a.y, bz = c.z - a.z, cx = d.x - a.x, cy = d.y - a.y, cz = d.z - a.z;
    return Math.abs(ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
}
const interpolate = (a: Vec3, b: Vec3, ha: number, hb: number, t: number): Vec3 => { const f = (t - ha) / (hb - ha); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f }; };
/** Exact tetrahedron clipping by one scalar depth plane: 1/3 vertices use a corner
 * tetrahedron; 2/2 uses a disjoint three-tetrahedron decomposition. */
export function tetraBelow(p: Vec3[], h: number[], t: number, whole: number) {
    const lo: number[] = [], hi: number[] = [];
    for (let i = 0; i < 4; i++)
        (h[i] <= t ? lo : hi).push(i);
    if (!lo.length)
        return 0;
    if (!hi.length)
        return whole;
    const edge = (a: number, b: number) => interpolate(p[a], p[b], h[a], h[b], t);
    if (lo.length === 1) {
        const a = lo[0];
        return tetraVolume(p[a], edge(a, hi[0]), edge(a, hi[1]), edge(a, hi[2]));
    }
    if (hi.length === 1) {
        const a = hi[0];
        return whole - tetraVolume(p[a], edge(a, lo[0]), edge(a, lo[1]), edge(a, lo[2]));
    }
    const [a, b] = lo, [c, d] = hi, ac = edge(a, c), ad = edge(a, d), bc = edge(b, c), bd = edge(b, d);
    return tetraVolume(p[a], p[b], ac, ad) + tetraVolume(p[b], ac, ad, bd) + tetraVolume(p[b], ac, bc, bd);
}
export function integratedLayerVolumes(surface: ProtectionSurface, piece: PhysicalPiece) {
    const { vertices, indices } = piece.solid, origin = { x: 0, y: 0, z: 0 };
    for (const v of vertices) {
        origin.x += v.x;
        origin.y += v.y;
        origin.z += v.z;
    }
    origin.x /= vertices.length;
    origin.y /= vertices.length;
    origin.z /= vertices.length;
    const f = surface.facets[piece.facetIndex], depth = (v: Vec3) => f.planeOffsetM - (f.normal.x * v.x + f.normal.y * v.y + f.normal.z * v.z);
    const limits = [0];
    for (const l of surface.layerStack)
        limits.push(limits.at(-1)! + l.thicknessMm / 1000 * f.thicknessMm / surface.thicknessMm);
    const volumes = surface.layerStack.map(() => 0), heights = vertices.map(depth), oh = depth(origin);
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i], b = indices[i + 1], c = indices[i + 2], points = [origin, vertices[a], vertices[b], vertices[c]], whole = tetraVolume(...points as [
            Vec3,
            Vec3,
            Vec3,
            Vec3
        ]);
        if (piece.layerOrder >= 0) {
            volumes[piece.layerOrder] += whole;
            continue;
        }
        const hs = [oh, heights[a], heights[b], heights[c]];
        let previous = tetraBelow(points, hs, limits[0], whole);
        for (let j = 0; j < volumes.length; j++) {
            const next = tetraBelow(points, hs, limits[j + 1], whole), delta = next - previous;
            if (delta < -Math.max(1e-12, whole * 1e-9))
                throw Error('INVALID_LAYER_VOLUME_INTEGRATION');
            volumes[j] += Math.max(0, delta);
            previous = next;
        }
    }
    // Same minimum represented-volume threshold as the finite clipping implementation.
    return volumes.map((volumeM3, layerOrder) => ({ layerOrder, volumeM3 })).filter(p => p.volumeM3 > 1e-9);
}
