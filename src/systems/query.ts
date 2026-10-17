import type { PanelSolid } from '../generation/armor/types';
import type { FunctionalSystemPlan } from './types';
import type { Vec3 } from '../blueprint/types';
import { planes, solidCell, rayPlanes, intersectCells, cellVolume } from '../physical/convex';
import { add, mul } from '../generation/integration/contours';
/** Small owned plane snapshot; no geometry rebuild during targeting or evaluation.
 * Ship-local metres; equipment envelope, not a claim of homogeneous solid machinery. */
export function prepareFunctionalQueries(plan: FunctionalSystemPlan) {
    const data = plan.equipment.map(e => ({ id: e.id, materialId: e.materialId, compartmentId: e.compartmentId, planes: planes(solidCell(e.solid)) }));
    return Object.freeze({
        at(point: Vec3) { if (!Object.values(point).every(Number.isFinite))
            throw Error('INVALID_FUNCTIONAL_POINT'); return data.filter(e => e.planes.every(p => point.x * p.n.x + point.y * p.n.y + point.z * p.n.z <= p.d + 1e-7)).map(e => ({ id: e.id, compartmentId: e.compartmentId, materialId: e.materialId })); },
        probe(origin: Vec3, direction: Vec3, maxDistance: number) { const length = Math.hypot(direction.x, direction.y, direction.z); if (!Object.values(origin).every(Number.isFinite) || !Number.isFinite(length) || length <= 1e-12 || !Number.isFinite(maxDistance) || maxDistance <= 0)
            throw Error('INVALID_FUNCTIONAL_RAY'); const d = mul(direction, 1 / length); return data.flatMap(e => { const h = rayPlanes(e.planes, origin, d, maxDistance); return h ? [{ equipmentId: e.id, compartmentId: e.compartmentId, materialId: e.materialId, entryDistanceM: h.entry, exitDistanceM: h.exit, pathLengthM: h.exit - h.entry, entryPoint: add(origin, mul(d, h.entry)), exitPoint: add(origin, mul(d, h.exit)), entryNormal: h.entryNormal, approximation: 'SPECIFIED_OBB_ENVELOPE_NOT_INTERNAL_COMPONENTS' }] : []; }).sort((a, b) => a.entryDistanceM - b.entryDistanceM || a.equipmentId.localeCompare(b.equipmentId)); }
    });
}
/** Compose with interior.fits: architectural room space remains a separate immutable contract. */
export function equipmentSpaceClear(plan: FunctionalSystemPlan, solid: PanelSolid) { const cell = solidCell(solid); return !plan.equipment.some(e => { const hit = intersectCells(cell, solidCell(e.solid)); return hit && cellVolume(hit) > 1e-8; }); }
