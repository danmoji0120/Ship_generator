import type { ShipBlueprint, StructuralVolume, Vec3 } from '../blueprint/types';
import type { PanelSolid } from '../generation/armor/types';
import { connectorGeometryParts, type ConnectorPart } from '../generation/architecture/connector-geometry';
import { sectionRing, center, add, sub, mul, mix, boundsOf, dot, unit } from '../generation/integration/contours';
import { shapeStations } from '../generation/shapes/definition';
import { containsVolume } from '../generation/architecture/volumes';
import { HULL_MATERIALS, type HullMaterialId } from '../physical/materials';
import { procurementWeights } from '../procurement/order';
import { procurementMaterials } from '../procurement/policy';
import { timedPhysical, recordPhysicalStage } from '../physical/diagnostics';
import { cellSolid, cellVolume, intersectCells, clipCell } from '../physical/convex';
import { solidFromRings } from '../generation/armor/panels';
import { beamSolid, beamFitsHost, convexParts, connectorSolids, exclusiveMaterial, inCell, distance, structuralMaterialVolume, closedStructuralSolid } from './geometry';
import { jointContacts, structuralJointType } from './joints';
import { analyzeConnectivity } from './graph';
import type { StructuralFramePlan, FrameMember, StructuralNode, MemberRole } from './types';
let rawCache: {
    key: string;
    plan: StructuralFramePlan;
} | undefined;
export function clearStructuralCache() { rawCache = undefined; }
export function structuralCacheBytes() { return rawCache ? rawCache.key.length * 2 + JSON.stringify(rawCache.plan).length * 2 : 0; }
export function framePolicy(b: ShipBlueprint): StructuralFramePlan['policy'] {
    const w = procurementWeights(b.procurement!.order), tech = procurementMaterials(b.procurement!.order).tech;
    // Density × cost per kg selects the cheapest available unit of structural volume.
    const economical = (Object.keys(HULL_MATERIALS) as HullMaterialId[]).filter(id => HULL_MATERIALS[id].requiredTechLevel <= tech).sort((a, c) => HULL_MATERIALS[a].densityKgM3 * HULL_MATERIALS[a].manufacturingCostIndex - HULL_MATERIALS[c].densityKgM3 * HULL_MATERIALS[c].manufacturingCostIndex)[0];
    const materialId = w.ECONOMY >= 70 ? economical : w.MOBILITY >= 70 ? 'LIGHT_STRUCTURAL_ALLOY' : w.ENDURANCE >= 80 && tech >= 2 ? 'TITANIUM_STRUCTURAL_ALLOY' : 'HIGH_STRENGTH_STRUCTURAL_STEEL';
    return { priorityWeights: w, materialId, sideM: b.order.length * .0018 * (.8 + w.ARMOR * .006 - w.MOBILITY * .003 - w.ECONOMY * .001), stationCount: w.ECONOMY >= 70 || w.MOBILITY >= 80 ? 3 : Math.min(7, 4 + Number(w.ARMOR >= 80) + Number(w.ENDURANCE >= 80)), extraPaths: w.ENDURANCE >= 70, source: 'SHARED_PROCUREMENT_POLICY', reason: ['Structural material density/cost/technology use the existing Hull registry.', 'Primary skeleton only; welded contacts are ideal connectivity, not calibrated strength.', w.ECONOMY >= 70 ? 'Standard sections and fewer stations reduce actual fabrication.' : w.MOBILITY >= 80 ? 'Light material and fewer nonessential braces preserve every required interface.' : w.ENDURANCE >= 70 ? 'Extra real rails and diagonals create alternative paths.' : 'Frames support actual armor and existing module interfaces.'] };
}
export function structuralSourceSignature(b: ShipBlueprint, provenance: StructuralFramePlan['provenance']) { return JSON.stringify([2, b.schemaVersion, b.seed, b.shipyardId, b.role, b.dimensions, b.architecture.grammar, b.structuralVolumes, b.structuralConnectors, b.engines, b.productionDesign?.armor.map(p => [p.id, p.parentStructureId, p.role, p.bounds]), framePolicy(b), provenance]); }
export function buildStructuralFrame(b: ShipBlueprint, provenance: StructuralFramePlan['provenance'] = 'NEW_PROCUREMENT') {
    return timedPhysical('Structural generation', () => {
        const volumes = b.structuralVolumes.map(v => ({ ...v, geometry: { ...v.geometry, stations: v.shape ? shapeStations(v.shape) : v.geometry.stations } }));
        if (!b.procurement)
            throw Error('STRUCTURAL_REDESIGN_REQUIRES_NATIVE_ORDER: legacy design remains unchanged');
        const policy = framePolicy(b), signature = structuralSourceSignature(b, provenance);
        if (rawCache?.key === signature) {
            recordPhysicalStage('Structural cache hit', 0);
            b.structuralFrame = timedPhysical('Structural cache clone', () => structuredClone(rawCache!.plan));
            return b;
        }
        recordPhysicalStage('Structural cache miss', 0);
        const plan: StructuralFramePlan = { schemaVersion: 1, version: '1.8.6.1', provenance, architecture: b.architecture.grammar, members: [], joints: [], nodes: [], edges: [], roots: [], volumeFrames: [], analysis: null as any, skinAttachments: [], policy, massAccounting: { method: 'EXCLUSIVE_FINITE_MATERIAL_UNION', frameVolumeM3: 0, connectorVolumeM3: 0, frameMassKg: 0, connectorMassKg: 0, preSkinMassUpperBoundKg: 0, plannedHullTieReserveKg: 0, remainingStructuralEstimateKg: 0, retiredLegacyFrameProxyKg: b.dimensions.estimatedMass * 1000 * .18, resolvedVolumeIds: [], resolvedConnectorIds: [], scope: 'Replace the old macro-frame-only 18% proxy by a complete inventory of primary frames for every StructuralVolume and every existing connector; do not retain that same proxy in parallel. Sub-resolution fittings are unquantified, not claimed massless.', unquantified: ['Fasteners, local micro-stiffeners, weld filler and engineering margins not quantified.', 'Existing 10% unresolved propulsion/service equipment proxy remains; no new tanks/reactors claimed.'] }, sourceSignature: signature, warnings: [], materialIntegration: 'PRE_SKIN_BOUND', futureCompartments: { status: 'STRUCTURAL_GUIDES_NOT_BULKHEADS', volumeIds: b.structuralVolumes.map(v => v.id), stationInterfaces: [], moduleConnections: b.structuralConnectors.map(c => ({ connectorId: c.id, from: c.fromStructureId, to: c.toStructureId })) } };
        const nodes = new Map<string, StructuralNode>(), byId = new Map<string, FrameMember>(), dedup = new Map<string, FrameMember>(), membersByHost = new Map<string, StructuralNode[]>(), nominalCells = new Map<string, ReturnType<typeof convexParts>>();
        const key = (p: Vec3) => [p.x, p.y, p.z].map(x => x.toFixed(6)).join('/');
        function node(p: Vec3, hosts: string[], kind: StructuralNode['kind'] = 'FRAME_JUNCTION') {
            const k = key(p);
            let n = nodes.get(k);
            if (!n) {
                n = { id: 'sn-' + plan.nodes.length, position: { ...p }, kind, hostIds: [], memberIds: [], attachmentReferences: [] };
                nodes.set(k, n);
                plan.nodes.push(n);
            }
            for (const host of hosts)
                if (!n.hostIds.includes(host)) {
                    n.hostIds.push(host);
                    n.attachmentReferences.push({ kind: 'VOLUME_CONTEXT', id: host });
                }
            ;
            return n;
        }
        function emit(id: string, type: MemberRole, a: Vec3, c: Vec3, hostIds: string[], solids: PanelSolid[], section: FrameMember['section'], role: string, source?: FrameMember['geometryReference']) {
            if (distance(a, c) < 1e-7)
                return;
            const geometryKey = [key(a), key(c)].sort().join('|') + '/' + section.kind + '/' + section.widthM.toFixed(7) + '/' + section.heightM.toFixed(7);
            const existing = dedup.get(geometryKey);
            if (existing)
                return existing;
            const na = node(a, hostIds, source ? 'TRUSS_JUNCTION' : 'FRAME_JUNCTION'), nc = node(c, hostIds, source ? 'TRUSS_JUNCTION' : 'FRAME_JUNCTION'), m: FrameMember = { id, type, hostIds, start: { ...a }, end: { ...c }, lengthM: distance(a, c), section, materialId: policy.materialId, densityKgM3: HULL_MATERIALS[policy.materialId].densityKgM3, geometryReference: source ?? { kind: 'GENERATED_INTERNAL', sourceId: hostIds[0], partId: id }, envelope: solids, pieces: [], bounds: boundsOf(solids.flatMap(s => s.vertices)), volumeM3: 0, massKg: 0, nodeIds: [na.id, nc.id], jointIds: [], structuralRole: role, redundancyGroup: source ? 'connector/' + source.sourceId : 'host/' + hostIds[0] + '/' + type, exposure: source ? 'EXISTING_EXPOSED' : 'INTERNAL' };
            plan.members.push(m);
            byId.set(id, m);
            dedup.set(geometryKey, m);
            nominalCells.set(id, solids.flatMap(convexParts));
            na.memberIds.push(id);
            nc.memberIds.push(id);
            return m;
        }
        function beam(id: string, type: MemberRole, a: Vec3, c: Vec3, host: StructuralVolume, role: string, side = policy.sideM) {
            const width = Math.max(.005, Math.min(side, Math.min(host.dimensions.x, host.dimensions.y) * .028));
            const solid = beamSolid(a, c, width);
            if (!beamFitsHost(solid, host))
                return;
            return emit(id, type, a, c, [host.id], [solid], { kind: 'SOLID_RECTANGLE', widthM: width, heightM: width }, role);
        }
        for (const host of volumes) {
            if (host.rotation.x || host.rotation.y || host.rotation.z)
                throw Error('UNSUPPORTED_ROTATED_STRUCTURAL_VOLUME ' + host.id);
            const stations = host.geometry.stations, z0 = stations[0].z + host.position.z, z1 = stations.at(-1)!.z + host.position.z, lo = z0 + (z1 - z0) * .055, hi = z1 - (z1 - z0) * .055;
            const template = host.type === 'SPINE' ? 'AXIAL_SPINE_WITH_MODULE_INTERFACES' : b.architecture.grammar === 'HYBRID' ? (host.type === 'NACELLE' ? 'NACELLE_CAGE' : host.type === 'POD' ? 'POD_CAGE' : 'HYBRID_HULL_CAGE') : ({ MONOLITHIC: 'CONTINUOUS_PAIRED_GIRDERS', BLOCK_ASSEMBLY: 'BLOCK_BOUNDARY_CAGE', SPINE_AND_MODULES: 'LOCAL_MODULE_CAGE', TRUSS_POD: 'POD_CAGE', TWIN_HULL: 'TWIN_BOX_GIRDERS', CORE_AND_NACELLES: host.type === 'NACELLE' ? 'NACELLE_CAGE' : 'RADIAL_CORE_HUB', STACKED_BLOCKS: 'STACKED_LOAD_TRANSFER_CAGE', HYBRID: 'HYBRID_HULL_CAGE' }[b.architecture.grammar]);
            const count = Math.min(policy.stationCount, Math.max(3, Math.ceil((hi - lo) / Math.max(b.order.length * .16, 10)))), frameZ = Array.from({ length: count }, (_, i) => lo + (hi - lo) * i / (count - 1)), zs = [...new Set([...frameZ, ...stations.map(s => s.z + host.position.z).filter(z => z > lo && z < hi)])].sort((a, c) => a - c).filter((z, i, a) => !i || z - a[i - 1] > 1e-6), rings = zs.map(z => { const r = sectionRing(host, z), c = center(r); return r.map(p => add(c, mul(sub(p, c), .62))); }), frameIndices = frameZ.map(z => zs.findIndex(q => Math.abs(q - z) < 1e-6)), central = host.type === 'SPINE' || template === 'RADIAL_CORE_HUB', rails = central ? (policy.extraPaths ? [-1, 1, 3, 5, 7] : [-1]) : policy.extraPaths || template === 'TWIN_BOX_GIRDERS' ? [1, 3, 5, 7] : ['BLOCK_BOUNDARY_CAGE', 'STACKED_LOAD_TRANSFER_CAGE'].includes(template) ? [0, 2, 4, 6] : template === 'POD_CAGE' ? [0, 3, 6] : [1, 5];
            const ownerNodes: StructuralNode[] = [];
            for (let i = 0; i < zs.length; i++)
                for (const rail of rails) {
                    const p = rail < 0 ? center(rings[i]) : rings[i][rail];
                    ownerNodes.push(node(p, [host.id]));
                    if (i) {
                        const prev = rail < 0 ? center(rings[i - 1]) : rings[i - 1][rail];
                        if (!beam(`${host.id}/long-${rail}-${i}`, 'PRIMARY_LONGITUDINAL', prev, p, host, template))
                            throw Error('REQUIRED_FRAME_LONGITUDINAL_UNSUPPORTED ' + host.id);
                    }
                }
            for (const index of frameIndices) {
                const r = rings[index];
                for (let j = 0; j < r.length; j++) {
                    const m = beam(`${host.id}/frame-${index}-${j}`, 'TRANSVERSE_FRAME', r[j], r[(j + 1) % r.length], host, template);
                    if (!m)
                        throw Error('REQUIRED_TRANSVERSE_FRAME_UNSUPPORTED ' + host.id);
                    ownerNodes.push(node(r[j], [host.id]));
                }
                if (central)
                    for (const j of [0, 2, 4, 6])
                        if (!beam(`${host.id}/spoke-${index}-${j}`, 'STRUCTURAL_SUPPORT', center(r), r[j], host, 'Axial/core support to actual station frame'))
                            throw Error('REQUIRED_RADIAL_FRAME_UNSUPPORTED ' + host.id);
            }
            // Non-frame station rail points are physically linked longitudinally. Only ring-frame stations add cross members.
            if (policy.extraPaths)
                for (let i = 1; i < rings.length; i++)
                    if (frameIndices.includes(i) || frameIndices.includes(i - 1))
                        for (const rail of [1, 5])
                            beam(`${host.id}/redundant-${i}-${rail}`, 'REINFORCEMENT', rings[i - 1][rail], rings[i][(rail + 2) % 8], host, 'ENDURANCE alternative internal load path');
            if (Number(policy.priorityWeights.ARMOR) >= 80 && b.productionDesign!.armor.some(a => a.parentStructureId === host.id && ['CITADEL', 'COMMAND_PLINTH', 'VENTRAL_KEEL'].includes(a.role))) {
                const i = Math.floor(rings.length / 2);
                if (i)
                    for (const j of rails.filter(j => j >= 0))
                        beam(`${host.id}/armor-brace-${j}`, 'REINFORCEMENT', rings[i - 1][j], rings[i][rails[(rails.indexOf(j) + 1) % rails.length]], host, 'Actual central armor-zone backing support', policy.sideM * 1.15);
            }
            membersByHost.set(host.id, [...new Map(ownerNodes.map(n => [n.id, n])).values()]);
            plan.volumeFrames.push({ volumeId: host.id, template, nodeIds: [], frameStationZ: frameZ, hullShellRefs: [], externalEnvelope: host.type === 'SPINE' ? 'SPINE_OUTER_SHELL_UNRESOLVED' : 'HULL_SHELL_SEPARATE' });
            plan.futureCompartments.stationInterfaces.push(...frameZ.map(z => ({ volumeId: host.id, z })));
        }
        // Existing rails/lofts are reused, not drawn or charged as new extra connector meshes.
        const hostCells = new Map(volumes.map(v => { const rings = v.geometry.stations.map(s => sectionRing(v, s.z + v.position.z)); return [v.id, rings.slice(1).flatMap((r, i) => convexParts(solidFromRings([rings[i], r])))]; }));
        const connectorMembers = new Map<string, FrameMember[]>();
        for (const c of b.structuralConnectors) {
            const list: FrameMember[] = [];
            const recipe = connectorGeometryParts(c, b.order.length), lofts = recipe.filter((p): p is Extract<ConnectorPart, {
                kind: 'LOFT';
            }> => p.kind === 'LOFT');
            if (lofts.length) {
                const axis = lofts[0].axis, a = add(lofts[0].position, mul(axis, -lofts[0].shape.length * .48)), z = add(lofts[0].position, mul(axis, lofts[0].shape.length * .48));
                const m = emit(`${c.id}/body`, 'STRUCTURAL_CONNECTOR', a, z, [c.fromStructureId, c.toStructureId], lofts.flatMap(connectorSolids), { kind: 'STATION_LOFT', widthM: lofts[0].shape.width, heightM: lofts[0].shape.height }, 'Existing finite connector body and collars, one material union', { kind: 'EXISTING_CONNECTOR', sourceId: c.id, partId: 'body-and-collars' });
                if (m)
                    list.push(m);
            }
            for (const part of recipe)
                if (part.kind === 'BEAM')
                    for (let i = 1; i < part.junctionFractions.length; i++) {
                        const a = mix(part.start, part.end, part.junctionFractions[i - 1]), z = mix(part.start, part.end, part.junctionFractions[i]), m = emit(`${c.id}/${part.id}/${i}`, 'TRUSS_MEMBER', a, z, [c.fromStructureId, c.toStructureId], [beamSolid(a, z, part.radius * 2, part.radius * 2, true)], { kind: 'SOLID_HEXAGON', widthM: part.radius * 2, heightM: part.radius * 2 }, 'Existing visible lattice/boom load path', { kind: 'EXISTING_CONNECTOR', sourceId: c.id, partId: part.id, fragment: i });
                        if (m && !list.includes(m))
                            list.push(m);
                    }
            connectorMembers.set(c.id, list);
        }
        function attach(host: StructuralVolume, point: Vec3, id: string) {
            const candidates = membersByHost.get(host.id)!.slice().sort((a, c) => distance(a.position, point) - distance(c.position, point));
            for (const target of candidates) {
                if (distance(target.position, point) < 1e-6)
                    return target;
                const direct = beam(id, 'STRUCTURAL_SUPPORT', target.position, point, host, 'Actual module/engine interface transfer');
                if (direct)
                    return node(point, [host.id], 'VOLUME_ATTACHMENT');
            }
            // Route through real station centers in a nonconvex/waisted volume, never through empty AABB space.
            const target = candidates[0], middle = center(sectionRing(host, point.z)), targetCenter = center(sectionRing(host, target.position.z)), zs = host.geometry.stations.map(s => s.z + host.position.z).filter(z => z > Math.min(middle.z, targetCenter.z) && z < Math.max(middle.z, targetCenter.z)).sort((a, c) => targetCenter.z > middle.z ? a - c : c - a), path = [point, middle, ...zs.map(z => center(sectionRing(host, z))), targetCenter, target.position];
            for (let i = 1; i < path.length; i++)
                if (distance(path[i - 1], path[i]) > 1e-6 && !beam(id + '/route-' + i, 'STRUCTURAL_SUPPORT', path[i - 1], path[i], host, 'Station-constrained interface support'))
                    throw Error('REQUIRED_STRUCTURAL_INTERFACE_ROUTE_UNSUPPORTED ' + id);
            return node(point, [host.id], 'VOLUME_ATTACHMENT');
        }
        // Collect taps before splitting. Each graph span owns a real clipped portion of the original solid.
        for (const c of b.structuralConnectors) {
            const parts = connectorMembers.get(c.id)!, contacts: {
                member: FrameMember;
                p: Vec3;
                t: number;
                host: StructuralVolume;
                axisP?: Vec3;
            }[] = [];
            for (const hostId of [c.fromStructureId, c.toStructureId]) {
                const host = volumes.find(v => v.id === hostId)!;
                const candidates: typeof contacts = [];
                for (const m of parts)
                    for (const t of [0, 1, ...Array.from({ length: 31 }, (_, i) => (i + 1) / 32)]) {
                        const p = mix(m.start, m.end, t);
                        if (containsVolume(host, p, -Math.max(.002, Math.min(policy.sideM * .6, .15)))) {
                            candidates.push({ member: m, p, t, host });
                            break;
                        }
                    }
                if (!candidates.length) {
                    // A finite neck may touch a module along its flank rather than along its axis.
                    // Find a real positive-volume intersection, then discretize that existing connector web.
                    for (const m of parts) {
                        let best: ReturnType<typeof intersectCells>, bestVolume = 0;
                        for (const mc of nominalCells.get(m.id)!)
                            for (const hc of hostCells.get(hostId)!) {
                                const contact = intersectCells(mc, hc), v = contact ? cellVolume(contact) : 0;
                                if (v > bestVolume) {
                                    best = contact;
                                    bestVolume = v;
                                }
                            }
                        if (best && bestVolume > 1e-8) {
                            const p = center(best.faces.flat()), delta = sub(m.end, m.start), t = Math.max(.001, Math.min(.999, dot(sub(p, m.start), delta) / dot(delta, delta))), axisP = mix(m.start, m.end, t);
                            candidates.push({ member: m, p, t, host, axisP });
                            break;
                        }
                    }
                }
                if (!candidates.length)
                    throw Error(`REQUIRED_CONNECTOR_CONTACT_UNAVAILABLE ${c.id}/${hostId}`);
                // Prefer distinct rails/shoes, never count repeated taps on the same path as independent supports.
                const chosen: typeof contacts = [];
                for (const q of candidates)
                    if (!chosen.some(v => v.member.geometryReference.partId === q.member.geometryReference.partId)) {
                        chosen.push(q);
                        if (chosen.length === (policy.extraPaths ? 2 : 1))
                            break;
                    }
                if (policy.extraPaths && chosen.length < 2)
                    plan.warnings.push(`STRUCTURAL_REDUNDANCY_LIMIT ${c.id}/${hostId}: one existing body path; internal reinforcements do not invent a second independent external connector.`);
                contacts.push(...chosen);
            }
            for (const original of new Set(contacts.map(q => q.member))) {
                const taps = [...new Set(contacts.filter(q => q.member === original && q.t > 1e-7 && q.t < 1 - 1e-7).map(q => q.t))].sort((a, z) => a - z);
                if (!taps.length)
                    continue;
                const start = { ...original.start }, end = { ...original.end }, axis = unit(sub(end, start)), cells = nominalCells.get(original.id)!, fractions = [0, ...taps, 1];
                for (const nid of original.nodeIds) {
                    const n = plan.nodes.find(n => n.id === nid)!;
                    n.memberIds = n.memberIds.filter(id => id !== original.id);
                }
                for (let i = 1; i < fractions.length; i++) {
                    const a = mix(start, end, fractions[i - 1]), z = mix(start, end, fractions[i]);
                    const clipped = cells.flatMap(cell => {
                        let x = fractions[i - 1] === 0 ? cell : clipCell(cell, axis, dot(axis, a), false);
                        if (x && fractions[i] !== 1)
                            x = clipCell(x, axis, dot(axis, z), true);
                        return x ? [cellSolid(x)] : [];
                    });
                    const m = i === 1 ? original : emit(original.id + '/span-' + i, original.type, a, z, original.hostIds, clipped, original.section, original.structuralRole, { ...original.geometryReference, fragment: i });
                    if (!m)
                        throw Error('REQUIRED_STRUCTURAL_TAP_SPLIT_INVALID ' + original.id);
                    if (i > 1)
                        parts.push(m);
                    if (i === 1) {
                        m.start = a;
                        m.end = z;
                        m.lengthM = distance(a, z);
                        m.envelope = clipped;
                        m.bounds = boundsOf(clipped.flatMap(s => s.vertices));
                        m.nodeIds = [node(a, m.hostIds).id, node(z, m.hostIds, 'MODULE_ATTACHMENT').id];
                        for (const nid of m.nodeIds)
                            plan.nodes.find(n => n.id === nid)!.memberIds.push(m.id);
                        nominalCells.set(m.id, clipped.flatMap(convexParts));
                    }
                }
            }
            for (let i = 0; i < contacts.length; i++) {
                const q = contacts[i];
                if (q.axisP && distance(q.axisP, q.p) > 1e-6) {
                    const raw = beamSolid(q.axisP, q.p, Math.min(policy.sideM * .5, .15));
                    // Use the original continuous body for the other side of a split as well.
                    const whole = parts.filter(m => m.geometryReference.partId === q.member.geometryReference.partId || m.id === q.member.id).flatMap(m => nominalCells.get(m.id) ?? []);
                    const envelope = convexParts(raw).flatMap(a => whole.flatMap(b => { const cell = intersectCells(a, b); return cell ? [cellSolid(cell)] : []; }));
                    if (!envelope.length)
                        throw Error('REQUIRED_CONNECTOR_CONTACT_WEB_INVALID ' + c.id);
                    emit(`${c.id}/contact-web-${i}`, 'STRUCTURAL_CONNECTOR', q.axisP, q.p, q.member.hostIds, envelope, { kind: 'STATION_LOFT', widthM: .15, heightM: .15 }, 'Discretized existing connector flank contact; no added external geometry', { kind: 'EXISTING_CONNECTOR', sourceId: c.id, partId: 'contact-web-' + i });
                }
                const n = attach(q.host, q.p, `${c.id}/attach-${q.host.id}-${i}`);
                n.attachmentReferences.push({ kind: 'CONNECTOR', id: c.id });
            }
        }
        for (const engine of b.engines) {
            const host = volumes.find(v => v.id === engine.parentId);
            if (!host)
                throw Error('REQUIRED_ENGINE_HOST_MISSING ' + engine.id);
            // The seat lies on the actual rear engine mounting plane, outside the open nozzle axis.
            // This is a host-side support, not an invented internal engine/reactor.
            const width = Math.min(policy.sideM, Math.min(host.dimensions.x, host.dimensions.y) * .028), z = engine.position.z;
            const seats = Array.from({ length: 12 }, (_, i) => ({ x: engine.position.x + (engine.nozzleRadius + width * .8) * Math.cos(i * Math.PI / 6), y: engine.position.y + (engine.nozzleRadius + width * .8) * Math.sin(i * Math.PI / 6), z })).filter(p => containsVolume(host, p, 1e-6));
            if (!seats.length)
                throw Error('REQUIRED_ENGINE_MOUNT_SEAT_UNAVAILABLE ' + engine.id);
            const seatCount = policy.extraPaths ? 2 : 1, usedTargets = new Set<string>();
            for (let i = 0; i < seatCount; i++) {
                const point = seats[0], candidates = membersByHost.get(host.id)!.slice().sort((a, c) => distance(a.position, point) - distance(c.position, point));
                let mounted = false;
                for (const target of candidates) {
                    if (usedTargets.has(target.id))
                        continue;
                    if (![0, .25, .5, .75, 1, ...host.geometry.stations.map(s => (s.z + host.position.z - target.position.z) / (point.z - target.position.z)).filter(t => t > 0 && t < 1)].every(t => containsVolume(host, mix(target.position, point, t), 1e-6)))
                        continue;
                    const raw = beamSolid(target.position, point, width), solids = convexParts(raw).flatMap(cell => hostCells.get(host.id)!.flatMap(h => { const x = intersectCells(cell, h); return x ? [cellSolid(x)] : []; }));
                    if (!solids.length || !solids.flatMap(convexParts).some(c => inCell(point, c)))
                        continue;
                    const m = emit(`engine-support/${engine.id}/${i}`, 'STRUCTURAL_SUPPORT', target.position, point, [host.id], solids, { kind: 'STATION_LOFT', widthM: width, heightM: width }, 'Actual host-side engine flange seat; nozzle opening preserved, engine internals unresolved');
                    if (m) {
                        const n = node(point, [host.id], 'MODULE_ATTACHMENT');
                        n.kind = 'MODULE_ATTACHMENT';
                        if (!n.attachmentReferences.some(r => r.kind === 'ENGINE' && r.id === engine.id))
                            n.attachmentReferences.push({ kind: 'ENGINE', id: engine.id });
                        usedTargets.add(target.id);
                        mounted = true;
                        break;
                    }
                }
                if (!mounted)
                    throw Error('REQUIRED_ENGINE_STRUCTURAL_SUPPORT_UNAVAILABLE ' + engine.id);
            }
        }
        // Freeze actual node memberships after taps, then validate every welded contact geometrically.
        plan.joints = timedPhysical('Structural joints', () => plan.nodes.filter(n => n.memberIds.length > 0).map(n => ({ id: 'sj/' + n.id, nodeId: n.id, memberIds: [...new Set(n.memberIds)], contacts: jointContacts([...new Set(n.memberIds)], n.position, id => nominalCells.get(id)!), connectionType: structuralJointType(n), geometryReference: { kind: 'SHARED_CONSTRUCTION_INTERSECTION', position: n.position, toleranceM: 1e-6 }, massReference: 'OWNED_BY_MEMBER_UNION_NOT_ADDITIONAL' })));
        const jointByNode = new Map(plan.joints.map(j => [j.nodeId, j.id]));
        for (const m of plan.members) {
            m.jointIds = m.nodeIds.map(id => jointByNode.get(id) ?? 'END_CAP/' + id);
            plan.edges.push({ id: 'se/' + m.id, nodeIds: m.nodeIds, physicalMemberRef: m.id, jointRefs: [m.jointIds[0], m.jointIds[1]], connectionType: m.type, structuralRole: m.structuralRole, redundancyGroup: m.redundancyGroup, massReference: m.id, geometryReference: m.id });
        }
        for (const v of plan.volumeFrames)
            v.nodeIds = plan.nodes.filter(n => n.hostIds.includes(v.volumeId) && n.memberIds.some(id => byId.get(id)?.geometryReference.kind === 'GENERATED_INTERNAL')).map(n => n.id);
        const rootHosts = b.architecture.grammar === 'TRUSS_POD' ? b.structuralVolumes.filter(v => v.type === 'POD' || v.type === 'PRIMARY_HULL').map(v => v.id) : b.architecture.grammar === 'TWIN_HULL' ? b.structuralVolumes.filter(v => v.type === 'PRIMARY_HULL' || v.type === 'HULL_BLOCK').slice(0, 2).map(v => v.id) : [b.structuralVolumes.find(v => v.type === 'SPINE')?.id ?? b.architecture.rootVolumeId];
        plan.roots = rootHosts.map(id => membersByHost.get(id)?.[Math.floor(membersByHost.get(id)!.length / 2)]?.id).filter((id): id is string => !!id);
        if (!plan.roots.length)
            plan.roots = [plan.nodes[0].id];
        for (const id of plan.roots)
            plan.nodes.find(n => n.id === id)!.kind = 'STRUCTURAL_ROOT';
        plan.analysis = timedPhysical('Structural graph construction', () => analyzeConnectivity(plan.nodes, plan.edges, plan.roots, plan.volumeFrames));
        if (plan.analysis.components.length !== 1 || plan.analysis.unreachableVolumeIds.length)
            throw Error('REQUIRED_STRUCTURAL_CONNECTIVITY_UNAVAILABLE ' + plan.analysis.unreachableVolumeIds.join(','));
        timedPhysical('Structural material union', () => {
            const previous: Parameters<typeof exclusiveMaterial>[1] = [];
            for (const m of [...plan.members].sort((a, z) => Number(a.exposure === 'EXISTING_EXPOSED') - Number(z.exposure === 'EXISTING_EXPOSED') || Number(!a.geometryReference.partId.startsWith('contact-web')) - Number(!z.geometryReference.partId.startsWith('contact-web')))) {
                const cells = exclusiveMaterial(m.envelope, previous);
                m.pieces = cells.map(closedStructuralSolid);
                m.volumeM3 = m.pieces.reduce((n, s) => n + structuralMaterialVolume(s), 0);
                m.massKg = m.volumeM3 * m.densityKgM3;
            }
        });
        updateStructuralMass(plan);
        plan.massAccounting.plannedHullTieReserveKg = volumes.filter(v => v.type !== 'SPINE').reduce((sum, v) => { const bound = boundsOf(hostCells.get(v.id)!.flatMap(c => c.faces.flat())), diagonal = distance(bound.min, bound.max), side = Math.min(policy.sideM, Math.min(v.dimensions.x, v.dimensions.y) * .028), stations = plan.volumeFrames.find(f => f.volumeId === v.id)!.frameStationZ.length; return sum + diagonal * side * side * stations * 4 * (policy.extraPaths ? 2 : 1) * HULL_MATERIALS[policy.materialId].densityKgM3; }, 0);
        plan.massAccounting.preSkinMassUpperBoundKg = plan.massAccounting.frameMassKg + plan.massAccounting.connectorMassKg + plan.massAccounting.plannedHullTieReserveKg;
        plan.massAccounting.resolvedVolumeIds = b.structuralVolumes.map(v => v.id);
        plan.massAccounting.resolvedConnectorIds = b.structuralConnectors.map(c => c.id);
        plan.warnings.push('Axis-aligned stored station volumes; member containment samples every crossed station and regular section. Ideal welded contacts, no structural strength/FEM certification.', 'Existing connector loft slices use exact convex/star-shaped partitions. Float64 physical coordinates vs Float32 render mesh may differ by tens of micrometres.', 'Truss aliases and visual Meso are not added as extra structural mass.');
        rawCache = { key: signature, plan: structuredClone(plan) };
        b.structuralFrame = plan;
        return b;
    });
}
export function updateStructuralMass(plan: StructuralFramePlan) {
    for (const [kind, keyV, keyM] of [['GENERATED_INTERNAL', 'frameVolumeM3', 'frameMassKg'], ['EXISTING_CONNECTOR', 'connectorVolumeM3', 'connectorMassKg']] as const) {
        plan.massAccounting[keyV] = plan.members.filter(m => m.geometryReference.kind === kind).reduce((n, m) => n + m.volumeM3, 0);
        plan.massAccounting[keyM] = plan.members.filter(m => m.geometryReference.kind === kind).reduce((n, m) => n + m.massKg, 0);
    }
}
