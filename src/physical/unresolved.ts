import { Euler, Vector3 } from 'three';
import type { ShipBlueprint, Vec3 } from '../blueprint/types';
import { profileRing } from '../generation/hull';
import { shapeStations } from '../generation/shapes/definition';
import { solidFromRings, solidTriangles, normal, cross } from '../generation/armor/panels';
import { sub, dot } from '../generation/integration/contours';
/** SPINE is an axial weapon/support volume, not a specified shell or homogeneous
 * metal body. Trace its actual rendered boundary without inventing armor or mass. */
export function prepareUnresolvedSpines(b: ShipBlueprint) {
    return (b.structuralVolumes ?? []).filter(v => v.type === 'SPINE').map(v => {
        const rotation = new Euler(v.rotation.x, v.rotation.y, v.rotation.z);
        const rings = (v.shape ? shapeStations(v.shape) : v.geometry.stations).map(s => profileRing(s).reverse().map(([x, y]) => { const p = new Vector3(x, y, s.z).applyEuler(rotation); return { x: p.x + v.position.x, y: p.y + v.position.y, z: p.z + v.position.z }; }));
        return { id: v.id, purpose: v.purpose, triangles: solidTriangles(solidFromRings(rings)).map(t => ({ points: t, normal: normal(t) })) };
    });
}
export interface UnresolvedCrossing {
    structureId: string;
    purpose: string;
    distanceM: number;
    point: Vec3;
    normal: Vec3;
    reason: 'SPINE_MATERIAL_AND_SHELL_THICKNESS_UNSPECIFIED';
}
export function unresolvedCrossings(spines: ReturnType<typeof prepareUnresolvedSpines>, o: Vec3, d: Vec3, max: number) {
    const out: UnresolvedCrossing[] = [];
    for (const s of spines) {
        const distances: number[] = [];
        for (const t of s.triangles) {
            const [a, b, c] = t.points, e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
            if (Math.abs(det) < 1e-12)
                continue;
            const delta = sub(o, a), u = dot(delta, h) / det;
            if (u < -1e-9 || u > 1 + 1e-9)
                continue;
            const q = cross(delta, e1), v = dot(d, q) / det;
            if (v < -1e-9 || u + v > 1 + 1e-9)
                continue;
            const distance = dot(e2, q) / det;
            if (distance < 0 || distance > max || distances.some(x => Math.abs(x - distance) < 1e-7))
                continue;
            distances.push(distance);
            out.push({ structureId: s.id, purpose: s.purpose, distanceM: distance, point: { x: o.x + d.x * distance, y: o.y + d.y * distance, z: o.z + d.z * distance }, normal: { ...t.normal }, reason: 'SPINE_MATERIAL_AND_SHELL_THICKNESS_UNSPECIFIED' });
        }
    }
    return out.sort((a, b) => a.distanceM - b.distanceM);
}
