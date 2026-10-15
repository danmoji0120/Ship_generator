import { timedPhysical } from '../physical/diagnostics';
import { structuralSkinContext, type StructuralSkinContext } from './skin-context';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import type { ShipBlueprint, Vec3 } from '../blueprint/types';
import type { FrameMember, StructuralNode } from './types';
import { boundsOf, center, sub, dot, mix } from '../generation/integration/contours';
import { shapeStations } from '../generation/shapes/definition';
import { profileRing } from '../generation/hull';
import { solidFromRings } from '../generation/armor/panels';
import { cellVolume, intersectCells, cellSolid, solidCell } from '../physical/convex';
import { beamSolid, convexParts, exclusiveMaterial, closedStructuralSolid, structuralMaterialVolume, inCell, distance } from './geometry';
import { jointContacts, structuralJointType } from './joints';
import { analyzeConnectivity } from './graph';
/** Actual finite shell cells provide the attachment targets; no invented skin at holes.
 * Conservative tie stock reserves were booked before physical skin construction. */
export function addHullSkinSupports(b: ShipBlueprint, context = structuralSkinContext(b.physicalDesign!)) {
    const f = b.structuralFrame!, d = b.physicalDesign!, previous = f.members.flatMap(m => m.pieces.flatMap(convexParts).map(cell => ({ cell, bounds: boundsOf(cell.faces.flat()) }))), byNode = new Map(f.nodes.map(n => [n.id, n]));
    const ownCell = new Map(f.members.map(m => [m.id, m.envelope.flatMap(convexParts)]));
    for (const vf of f.volumeFrames) {
        const v = b.structuralVolumes.find(v => v.id === vf.volumeId)!, shells = d.surfaces.filter(s => s.kind === 'HULL' && s.geometryReference.parentStructureId === v.id);
        vf.hullShellRefs = shells.map(s => s.id);
        if (!shells.length) {
            f.warnings.push(`${v.id}: no resolved exposed Hull shell; no fictitious skin attachment created.`);
            continue;
        }
        const rings = (v.shape ? shapeStations(v.shape) : v.geometry.stations).map(s => profileRing(s).map(([x, y]) => ({ x: x + v.position.x, y: y + v.position.y, z: s.z + v.position.z }))), hostCells = rings.slice(1).flatMap((r, i) => convexParts(solidFromRings([rings[i], r]))), side = Math.min(f.policy.sideM, Math.min(v.dimensions.x, v.dimensions.y) * .028);
        const candidates = context.items.filter(i => shells.includes(i.surface) && i.piece.volumeM3 > 1e-7).map(item => ({ item, surface: item.surface, pieceIndex: item.pieceIndex, point: center(item.piece.solid.vertices), normal: item.surface.facets[item.piece.facetIndex].normal, volume: item.piece.volumeM3 }));
        const starts = vf.nodeIds.map(id => byNode.get(id)!).filter(n => n.memberIds.some(id => f.members.find(m => m.id === id)?.geometryReference.kind === 'GENERATED_INTERNAL' && ['PRIMARY_LONGITUDINAL', 'TRANSVERSE_FRAME', 'REINFORCEMENT'].includes(f.members.find(m => m.id === id)!.type)));
        const used = new Set<string>();
        let attached = 0;
        for (const [station, z] of vf.frameStationZ.entries())
            for (const [direction, axis] of ([{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }] as Vec3[]).entries()) {
                const targets = candidates.filter(p => dot(p.normal, axis) > .15).sort((a, c) => Math.abs(a.point.z - z) - Math.abs(c.point.z - z) || c.volume - a.volume).slice(0, 12);
                search: for (const target of targets) {
                    const targetKey = target.surface.id + '/' + target.pieceIndex;
                    if (used.has(targetKey))
                        continue;
                    const startCandidates = starts.slice().sort((a, c) => distance(a.position, target.point) - distance(c.position, target.point));
                    const selected: typeof startCandidates = [];
                    for (const start of startCandidates) {
                        if (distance(start.position, target.point) < 1e-6)
                            continue;
                        if (![0, .125, .25, .375, .5, .625, .75, .875, 1].every(t => hostCells.some(c => inCell(mix(start.position, target.point, t), c))))
                            continue;
                        const raw = beamSolid(start.position, target.point, side), envelope = convexParts(raw).flatMap(c => hostCells.flatMap(h => { const p = intersectCells(c, h); return p ? [cellSolid(p)] : []; }));
                        const contact = envelope.flatMap(convexParts).reduce((n, c) => { const p = intersectCells(c, context.cell(target.item)); return n + (p ? cellVolume(p) : 0); }, 0);
                        if (contact <= 1e-10)
                            continue;
                        const owned = exclusiveMaterial(envelope, previous), id = `skin-tie/${v.id}/${station}/${direction}/${selected.length}`;
                        let member: FrameMember | undefined;
                        if (!owned.length) {
                            // A reused solid neck may already provide this entire material path. Record
                            // its real skin contact instead of adding a virtual duplicate beam/edge.
                            member = f.members.find(m => ownCell.get(m.id)?.some(c => inCell(target.point, c) && !!intersectCells(c, context.cell(target.item))));
                            if (!member || f.skinAttachments.some(a => a.surfaceId === target.surface.id && a.pieceIndex === target.pieceIndex && a.physicalMemberRef === member!.id))
                                continue;
                        }
                        else {
                            const pieces = owned.map(closedStructuralSolid), volumeM3 = pieces.reduce((n, p) => n + structuralMaterialVolume(p), 0);
                            if (volumeM3 < 1e-9)
                                continue;
                            let end = f.nodes.find(n => distance(n.position, target.point) < 1e-7);
                            if (!end) {
                                end = { id: 'skin-node-' + f.nodes.length, position: { ...target.point }, kind: 'VOLUME_ATTACHMENT', hostIds: [v.id], memberIds: [], attachmentReferences: [{ kind: 'PHYSICAL_SKIN', id: target.surface.id }] };
                                f.nodes.push(end);
                                byNode.set(end.id, end);
                            }
                            else if (!end.attachmentReferences.some(r => r.kind === 'PHYSICAL_SKIN' && r.id === target.surface.id))
                                end.attachmentReferences.push({ kind: 'PHYSICAL_SKIN', id: target.surface.id });
                            member = { id, type: 'STRUCTURAL_SUPPORT', hostIds: [v.id], start: { ...start.position }, end: { ...target.point }, lengthM: distance(start.position, target.point), section: { kind: 'STATION_LOFT', widthM: side, heightM: side }, materialId: f.policy.materialId, densityKgM3: f.members[0].densityKgM3, geometryReference: { kind: 'GENERATED_INTERNAL', sourceId: v.id, partId: id }, envelope, pieces, bounds: boundsOf(envelope.flatMap(p => p.vertices)), volumeM3, massKg: volumeM3 * f.members[0].densityKgM3, nodeIds: [start.id, end.id], jointIds: [], structuralRole: 'Finite support to an actually present Hull shell cell', redundancyGroup: 'skin/' + v.id + '/' + station + '/' + direction, exposure: 'INTERNAL' };
                            f.members.push(member);
                            ownCell.set(member.id, envelope.flatMap(convexParts));
                        }
                        const witness = Math.max(...ownCell.get(member.id)!.map(c => { const p = intersectCells(c, context.cell(target.item)); return p ? cellVolume(p) : 0; }));
                        if (witness <= 1e-10)
                            throw Error('REQUIRED_SKIN_CONTACT_WITNESS_INVALID ' + member.id);
                        f.skinAttachments.push({ id: 'skin-contact-' + f.skinAttachments.length, volumeId: v.id, surfaceId: target.surface.id, pieceIndex: target.pieceIndex, physicalMemberRef: member.id, point: { ...target.point }, contactVolumeM3: witness, reusedExistingMember: !owned.length });
                        attached++;
                        selected.push(start);
                        if (selected.length === (f.policy.extraPaths ? 2 : 1)) {
                            used.add(targetKey);
                            break search;
                        }
                    }
                    if (selected.length) {
                        if (f.policy.extraPaths && selected.length < 2)
                            f.warnings.push(`STRUCTURAL_REDUNDANCY_LIMIT skin/${v.id}/${station}/${direction}: only one actual material support path; no virtual backup added.`);
                        used.add(targetKey);
                        break;
                    }
                }
            }
        if (!attached)
            throw Error('REQUIRED_HULL_FRAME_CONTACT_UNAVAILABLE ' + v.id);
    }
    annotateStructuralSkinOwners(b, context);
    // Rebuild from real members, keeping original root IDs and deterministic ordering.
    timedPhysical('Hull support graph and joints', () => {
        for (const n of f.nodes)
            n.memberIds = [];
        for (const m of f.members)
            for (const id of m.nodeIds)
                byNode.get(id)!.memberIds.push(m.id);
        f.joints = f.nodes.map(n => ({ id: 'sj/' + n.id, nodeId: n.id, memberIds: [...n.memberIds], connectionType: structuralJointType(n), contacts: jointContacts(n.memberIds, n.position, id => ownCell.get(id)!), geometryReference: { kind: 'SHARED_CONSTRUCTION_INTERSECTION', position: n.position, toleranceM: 1e-6 }, massReference: n.attachmentReferences.some(r => r.kind === 'PHYSICAL_SKIN') ? 'OWNED_BY_EXISTING_PHYSICAL_SKIN_NOT_ADDITIONAL' : 'OWNED_BY_MEMBER_UNION_NOT_ADDITIONAL' }));
        const joint = new Map(f.joints.map(j => [j.nodeId, j.id]));
        f.edges = f.members.map(m => { m.jointIds = m.nodeIds.map(id => joint.get(id)!); return { id: 'se/' + m.id, nodeIds: m.nodeIds, physicalMemberRef: m.id, jointRefs: [m.jointIds[0], m.jointIds[1]], connectionType: m.type, structuralRole: m.structuralRole, redundancyGroup: m.redundancyGroup, massReference: m.id, geometryReference: m.id }; });
        for (const vf of f.volumeFrames)
            vf.nodeIds = f.nodes.filter(n => n.hostIds.includes(vf.volumeId) && n.memberIds.some(id => f.members.find(m => m.id === id)?.geometryReference.kind === 'GENERATED_INTERNAL' && ['PRIMARY_LONGITUDINAL', 'TRANSVERSE_FRAME', 'REINFORCEMENT'].includes(f.members.find(m => m.id === id)!.type))).map(n => n.id);
    });
    f.analysis = timedPhysical('Final structural connectivity', () => analyzeConnectivity(f.nodes, f.edges, f.roots, f.volumeFrames));
    if (f.analysis.components.length !== 1 || f.analysis.unreachableVolumeIds.length)
        throw Error('REQUIRED_HULL_FRAME_GRAPH_INVALID');
}
/** Explicit derived ownership annotation; never invoked by legacy Blueprint loading. */
export function annotateStructuralSkinOwners(b: ShipBlueprint, context = structuralSkinContext(b.physicalDesign!)) {
    const f = b.structuralFrame!, d = b.physicalDesign!;
    // Skin material owns welded interfaces where old armor/shell geometry is embedded.
    // Record that actual local material owner rather than attributing it to frame steel.
    for (const n of f.nodes) {
        const p = n.position, eps = 1e-7;
        for (const s of context.near({ min: { x: p.x - eps, y: p.y - eps, z: p.z - eps }, max: { x: p.x + eps, y: p.y + eps, z: p.z + eps } }))
            if (inCell(p, context.cell(s)) && !n.attachmentReferences.some(r => r.kind === 'PHYSICAL_SKIN' && r.id === s.surface.id))
                n.attachmentReferences.push({ kind: 'PHYSICAL_SKIN', id: s.surface.id });
    }
    const nodes = new Map(f.nodes.map(n => [n.id, n]));
    for (const j of f.joints) {
        const n = nodes.get(j.nodeId)!;
        j.connectionType = structuralJointType(n);
        j.massReference = n.attachmentReferences.some(r => r.kind === 'PHYSICAL_SKIN') ? 'OWNED_BY_EXISTING_PHYSICAL_SKIN_NOT_ADDITIONAL' : 'OWNED_BY_MEMBER_UNION_NOT_ADDITIONAL';
    }
}
