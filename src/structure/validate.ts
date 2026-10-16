import { structuralSourceSignature } from './build';
import type { ShipBlueprint } from '../blueprint/types';
import { connectorGeometryParts } from '../generation/architecture/connector-geometry';
import { connectorSolids } from './geometry';
import { HULL_MATERIALS } from '../physical/materials';
import { planes, solidCell } from '../physical/convex';
import { dot } from '../generation/integration/contours';
import { containsVolume } from '../generation/architecture/volumes';
import { profileRing } from '../generation/hull';
import { solidFromRings } from '../generation/armor/panels';
import { shapeStations } from '../generation/shapes/definition';
import { analyzeConnectivity } from './graph';
import { beamFitsHost, convexParts, inCell, distance, structuralMaterialVolume, structuralCell, closureResidual } from './geometry';
import { jointContacts, structuralJointType } from './joints';
import type { StructuralFramePlan } from './types';
const cache = new WeakMap<StructuralFramePlan, {
    key: string;
    issues: string[];
}>();
/** Validate stored geometry/graph too, rather than trusting the generator's success flag. */
export function validateStructuralFrame(b: ShipBlueprint) {
    const f = b.structuralFrame;
    if (!f)
        return ['1.8.6.1','1.8.6.2'].includes(b.generatorVersion) ? ['Required structural frame absent'] : [];
    const key = JSON.stringify([f, b.structuralVolumes, b.structuralConnectors, b.engines]);
    const cached = cache.get(f);
    if (cached?.key === key)
        return [...cached.issues];
    const issues: string[] = [];
    try {
        if (f.sourceSignature !== structuralSourceSignature(b, f.provenance))
            issues.push('Structural source/policy signature differs; explicit redesign required');
        if (f.schemaVersion !== 1 || f.version !== '1.8.6.1' || f.architecture !== b.architecture.grammar || f.materialIntegration !== 'SKINS_SUBTRACTED')
            issues.push('Structural contract/integration invalid');
        const nodes = new Map(f.nodes.map(n => [n.id, n])), members = new Map(f.members.map(m => [m.id, m])), joints = new Map(f.joints.map(j => [j.id, j])), edgeIds = new Set(f.edges.map(e => e.id));
        if (nodes.size !== f.nodes.length || members.size !== f.members.length || joints.size !== f.joints.length || edgeIds.size !== f.edges.length || !f.members.length)
            issues.push('Structural IDs invalid/duplicated');
        const hosts = new Map(b.structuralVolumes.map(v => [v.id, { ...v, geometry: { ...v.geometry, stations: v.shape ? shapeStations(v.shape) : v.geometry.stations } }]));
        const hostAuthority = new Map([...hosts.values()].map(v => { const rings = v.geometry.stations.map(s => profileRing(s).map(([x, y]) => ({ x: x + v.position.x, y: y + v.position.y, z: s.z + v.position.z }))); return [v.id, rings.slice(1).flatMap((r, i) => convexParts(solidFromRings([rings[i], r])))]; }));
        const connectorAuthority = new Map(b.structuralConnectors.map(c => [c.id, connectorGeometryParts(c, b.order.length).flatMap(p => connectorSolids(p).flatMap(convexParts))]));
        for (const m of f.members) {
            const material = HULL_MATERIALS[m.materialId];
            if (!material || m.densityKgM3 !== material.densityKgM3)
                throw Error('Structural registry/density invalid ' + m.id);
            if (!m.envelope.length || !m.pieces.length || m.volumeM3 <= 0 || !Number.isFinite(m.massKg) || Math.abs(m.lengthM - distance(m.start, m.end)) > 1e-6 || !(m.section.widthM > 0 && m.section.heightM > 0))
                throw Error('Structural geometry/units invalid ' + m.id);
            const cells = m.envelope.flatMap(convexParts);
            for (const p of [m.start, m.end])
                if (!cells.some(c => inCell(p, c)))
                    throw Error('Graph endpoint outside real member ' + m.id);
            for (const [i, id] of m.nodeIds.entries()) {
                const n = nodes.get(id);
                if (!n || distance(n.position, i ? m.end : m.start) > 1e-6 || !n.memberIds.includes(m.id))
                    throw Error('Structural node/member mismatch ' + m.id);
            }
            if (m.geometryReference.kind === 'GENERATED_INTERNAL') {
                const host = hosts.get(m.hostIds[0]);
                if (!host || m.envelope.some(p => (m.id.startsWith('engine-support/') || m.id.startsWith('skin-tie/')) ? !hostAuthority.get(host.id)!.some(c => p.vertices.every(v => inCell(v, c, 1e-5))) : !beamFitsHost(p, host)))
                    throw Error('Internal frame outside Hull ' + m.id);
            }
            else {
                const authority = connectorAuthority.get(m.geometryReference.sourceId);
                if (!authority || cells.some(c => !authority.some(a => c.faces.flat().every(v => inCell(v, a, 1e-5)))))
                    throw Error('Existing connector geometry reference differs ' + m.id);
            }
            let volume = 0;
            for (const p of m.pieces) {
                const c = structuralCell(p);
                const residual = closureResidual(p);
                if (residual.openAreaVectorM2 > Math.max(1e-11, residual.surfaceAreaM2 * 1e-13))
                    throw Error('Open structural material cell ' + m.id);
                if (!cells.some(a => p.vertices.every(v => inCell(v, a, 1e-5))))
                    throw Error('Detached structural material ' + m.id);
                if (!p.vertices.every(v => [v.x, v.y, v.z].every(Number.isFinite)) || planes(c).some(n => p.vertices.some(v => dot(v, n.n) > n.d + 1e-5)))
                    throw Error('Nonconvex structural material ' + m.id);
                volume += structuralMaterialVolume(p);
            }
            if (Math.abs(volume - m.volumeM3) > Math.max(1e-6, volume * 1e-8) || Math.abs(volume * material.densityKgM3 - m.massKg) > Math.max(.01, m.massKg * 1e-8))
                throw Error('Structural volume/mass mismatch ' + m.id);
        }
        for (const n of f.nodes)
            if (!n.memberIds.length || n.memberIds.some(id => !members.get(id)?.nodeIds.includes(n.id)))
                throw Error('Unsupported structural node ' + n.id);
        for (const j of f.joints) {
            const n = nodes.get(j.nodeId);
            if (!n || j.connectionType !== structuralJointType(n) || JSON.stringify(j.memberIds) !== JSON.stringify([...new Set(n.memberIds)]))
                throw Error('Joint references differ ' + j.id);
            const actual = jointContacts(j.memberIds, n.position, id => members.get(id)!.envelope.flatMap(convexParts));
            if (actual.length !== j.contacts.length || actual.some((c, i) => JSON.stringify(c.memberIds) !== JSON.stringify(j.contacts[i].memberIds) || c.method !== j.contacts[i].method || c.unit !== j.contacts[i].unit || Math.abs(c.measure - j.contacts[i].measure) > Math.max(1e-8, c.measure * 1e-7)))
                throw Error('Physical joint evidence differs ' + j.id);
        }
        if (f.edges.length !== f.members.length)
            throw Error('Structural edge/member coverage differs');
        const refs = new Set<string>();
        for (const e of f.edges) {
            const m = members.get(e.physicalMemberRef);
            if (!m || refs.has(m.id) || e.geometryReference !== m.id || e.massReference !== m.id || JSON.stringify(e.nodeIds) !== JSON.stringify(m.nodeIds) || e.jointRefs.some(id => !joints.has(id)))
                throw Error('Virtual/invalid structural edge ' + e.id);
            refs.add(m.id);
        }
        if (!f.roots.length || f.roots.some(id => !nodes.has(id)))
            throw Error('Structural root absent');
        const analysis = analyzeConnectivity(f.nodes, f.edges, f.roots, f.volumeFrames);
        if (JSON.stringify(analysis) !== JSON.stringify(f.analysis) || analysis.components.length !== 1 || analysis.unreachableVolumeIds.length)
            throw Error('Structural connectivity invalid');
        if (!Array.isArray(f.skinAttachments))
            throw Error('Hull/frame contact inventory absent');
        for (const vf of f.volumeFrames)
            if (vf.hullShellRefs.length && !f.skinAttachments.some(a => a.volumeId === vf.volumeId))
                throw Error('Exposed Hull has no real frame attachment ' + vf.volumeId);
        for (const a of f.skinAttachments) {
            const s = b.physicalDesign?.surfaces.find(s => s.id === a.surfaceId), m = members.get(a.physicalMemberRef), p = s?.pieces[a.pieceIndex];
            if (!s || s.kind !== 'HULL' || !m || !p || !m.envelope.flatMap(convexParts).some(c => inCell(a.point, c)) || !inCell(a.point, solidCell(p.solid)) || !(a.contactVolumeM3 > 0))
                throw Error('Invalid finite Hull/frame contact ' + a.id);
        }
        for (const e of b.engines)
            if (!f.nodes.some(n => n.attachmentReferences.some(r => r.kind === 'ENGINE' && r.id === e.id)))
                throw Error('Engine structural attachment absent ' + e.id);
        for (const v of b.structuralVolumes)
            if (!f.volumeFrames.some(s => s.volumeId === v.id && s.nodeIds.length))
                throw Error('Structural volume unsupported ' + v.id);
        if (JSON.stringify(f.massAccounting.resolvedVolumeIds) !== JSON.stringify(b.structuralVolumes.map(v => v.id)) || JSON.stringify(f.massAccounting.resolvedConnectorIds) !== JSON.stringify(b.structuralConnectors.map(v => v.id)))
            throw Error('Structural inventory incomplete');
        for (const [kind, mass, volume] of [['GENERATED_INTERNAL', 'frameMassKg', 'frameVolumeM3'], ['EXISTING_CONNECTOR', 'connectorMassKg', 'connectorVolumeM3']] as const) {
            const ms = f.members.filter(m => m.geometryReference.kind === kind);
            if (Math.abs(ms.reduce((n, m) => n + m.massKg, 0) - f.massAccounting[mass]) > .01 || Math.abs(ms.reduce((n, m) => n + m.volumeM3, 0) - f.massAccounting[volume]) > 1e-5)
                throw Error('Structural ledger mismatch');
        }
        if (f.massAccounting.remainingStructuralEstimateKg !== 0 || f.massAccounting.preSkinMassUpperBoundKg + .01 < f.massAccounting.frameMassKg + f.massAccounting.connectorMassKg)
            throw Error('Structural estimate replacement invalid');
    }
    catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
    }
    cache.set(f, { key, issues: [...issues] });
    return issues;
}
