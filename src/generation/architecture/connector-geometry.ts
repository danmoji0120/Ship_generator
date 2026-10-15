import { Vector3 } from 'three';
import type { StructuralConnector, ShapeDefinition, Vec3 } from '../../blueprint/types';
import { shapeDefinition } from '../shapes/definition';
export type ConnectorPart = {
    id: string;
    kind: 'BEAM';
    start: Vec3;
    end: Vec3;
    radius: number;
    junctionFractions: number[];
} | {
    id: string;
    kind: 'LOFT';
    shape: ShapeDefinition;
    position: Vec3;
    axis: Vec3;
};
const point = (v: Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
/** Single parametric source shared by the historical renderer and the physical structure.
 * Mesh rails stay continuous; structural fragments split only at actual lattice junctions. */
export function connectorGeometryParts(c: StructuralConnector, scale: number): ConnectorPart[] {
    const parts: ConnectorPart[] = [], start = new Vector3(c.start.x, c.start.y, c.start.z), end = new Vector3(c.end.x, c.end.y, c.end.z), delta = end.clone().sub(start), length = delta.length(), axis = delta.clone().normalize();
    const beam = (id: string, a: Vector3, b: Vector3, radius: number, junctionFractions = [0, 1]) => parts.push({ id, kind: 'BEAM', start: point(a), end: point(b), radius, junctionFractions });
    if (c.join && !['TRUSS', 'BOOM'].includes(c.join.type)) {
        const j = c.join, bodyLength = Math.max(length, j.length) + j.inset * 2, shape = shapeDefinition(j.type === 'TRANSITION' || j.type === 'NACELLE_MOUNT' ? 'TAPERED_PRISM' : 'CHAMFERED_BOX', { x: j.width, y: j.height, z: bodyLength });
        shape.frontScale = j.type === 'TRANSITION' ? Math.min(1.6, j.transitionRatio) : j.type === 'STRUCTURAL_NECK' ? .78 : 1;
        shape.rearScale = j.type === 'NACELLE_MOUNT' ? 1.35 : 1;
        shape.topSlope = .02;
        const position = start.clone().add(end).multiplyScalar(.5), direction = length > 1e-8 ? axis : new Vector3(0, 0, 1);
        parts.push({ id: 'body', kind: 'LOFT', shape, position: point(position), axis: point(direction) });
        if (j.type === 'ARMORED_COLLAR')
            for (const t of [.18, .82])
                parts.push({ id: 'collar-' + t, kind: 'LOFT', shape: shapeDefinition('CHAMFERED_BOX', { x: j.width * 1.12, y: j.height * 1.12, z: Math.min(bodyLength * .22, scale * .018) }), position: point(position.clone().addScaledVector(axis, (t - .5) * bodyLength)), axis: point(direction) });
        return parts;
    }
    if (c.style === 'armored collar') {
        const shape = shapeDefinition('BOX', { x: c.thickness, y: c.thickness, z: length + scale * .003 });
        shape.frontScale = shape.rearScale = 1;
        parts.push({ id: 'box', kind: 'LOFT', shape, position: point(start.clone().add(end).multiplyScalar(.5)), axis: point(axis) });
        return parts;
    }
    if (c.style === 'straight beam') {
        beam('shaft', start, end, c.thickness * .5);
        return parts;
    }
    const up = Math.abs(axis.y) > .85 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0), u = axis.clone().cross(up).normalize().multiplyScalar(c.thickness * .65), v = axis.clone().cross(u).normalize().multiplyScalar(c.thickness * .65), corners = c.style === 'double beam' ? [u.clone(), u.clone().negate()] : c.style === 'triangular truss' ? [u.clone(), u.clone().multiplyScalar(-.5).add(v), u.clone().multiplyScalar(-.5).sub(v)] : [u.clone().add(v), u.clone().sub(v), u.clone().negate().sub(v), u.clone().negate().add(v)], bays = Math.max(2, Math.min(4, Math.ceil(length / (c.thickness * 5)))), a = start.clone().addScaledVector(axis, -c.thickness * .7), b = end.clone().addScaledVector(axis, c.thickness * .7), d = b.clone().sub(a);
    corners.forEach((offset, i) => beam('rail-' + i, a.clone().add(offset), b.clone().add(offset), c.thickness * .13, Array.from({ length: bays + 1 }, (_, i) => i / bays)));
    for (let i = 0; i < bays; i++)
        for (let j = 0; j < corners.length; j++)
            beam(`brace-${i}-${j}`, a.clone().addScaledVector(d, i / bays).add(corners[j]), a.clone().addScaledVector(d, (i + 1) / bays).add(corners[(j + 1) % corners.length]), c.thickness * .085);
    for (const t of [0, 1])
        for (let j = 0; j < corners.length; j++)
            beam(`shoe-${t}-${j}`, a.clone().addScaledVector(d, t).add(corners[j]), a.clone().addScaledVector(d, t).add(corners[(j + 1) % corners.length]), c.thickness * .14);
    return parts;
}
