import type { Vec3 } from '../blueprint/types';
import type { ConvexCell } from '../physical/types';
import { intersectCells, cellVolume, planes } from '../physical/convex';
import { area, clipHalfSpace } from '../generation/armor/panels';
import { dot } from '../generation/integration/contours';
import { inCell } from './geometry';
import type { StructuralJoint, StructuralNode } from './types';
/** Contact evidence is a finite overlap or a finite common face, never just coincident node labels. */
export function jointContacts(memberIds: string[], point: Vec3, cells: (id: string) => ConvexCell[]): StructuralJoint['contacts'] {
    const local = new Map(memberIds.map(id => [id, cells(id).filter(c => inCell(point, c, 1e-6))]));
    if ([...local.values()].some(cs => !cs.length))
        throw Error('REQUIRED_JOINT_OUTSIDE_MEMBER');
    const reached = new Set([memberIds[0]]), contacts: StructuralJoint['contacts'] = [];
    while (reached.size < memberIds.length) {
        let found = false;
        search: for (const a of reached)
            for (const b of memberIds)
                if (!reached.has(b))
                    for (const ca of local.get(a)!)
                        for (const cb of local.get(b)!) {
                            const volume = intersectCells(ca, cb);
                            if (volume && cellVolume(volume) > 1e-10) {
                                contacts.push({ memberIds: [a, b], method: 'FINITE_OVERLAP', measure: cellVolume(volume), unit: 'm3' });
                                reached.add(b);
                                found = true;
                                break search;
                            }
                            for (const face of ca.faces) {
                                let polygon = face;
                                for (const p of planes(cb)) {
                                    if (!polygon.every(v => Math.abs(dot(v, p.n) - p.d) < 1e-7))
                                        polygon = clipHalfSpace(polygon, p.n, p.d, false);
                                    if (polygon.length < 3)
                                        break;
                                }
                                if (polygon.length >= 3 && area(polygon) > 1e-10) {
                                    contacts.push({ memberIds: [a, b], method: 'FINITE_COMMON_FACE', measure: area(polygon), unit: 'm2' });
                                    reached.add(b);
                                    found = true;
                                    break search;
                                }
                            }
                        }
        if (!found)
            throw Error('REQUIRED_JOINT_CONTACT_UNAVAILABLE ' + memberIds.filter(id => !reached.has(id)).join(','));
    }
    return contacts;
}
export function structuralJointType(n: StructuralNode): StructuralJoint['connectionType'] { return n.attachmentReferences.some(r => r.kind === 'PHYSICAL_SKIN') ? 'SKIN_ATTACHMENT' : n.memberIds.length > 1 ? 'WELDED_CONTACT' : n.attachmentReferences.some(r => r.kind === 'ENGINE') ? 'ENGINE_MOUNT_INTERFACE' : 'CAPPED_MEMBER_END'; }
