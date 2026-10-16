import type { AnyShipBlueprint, ShipBlueprint, Vec3 } from '../blueprint/types';
import type { ShipViewer } from '../rendering/viewer';
import { HULL_MATERIALS } from '../physical/materials';
import { structuralMember, prepareStructuralQueries } from '../structure/query';
import { analyzeStructuralInstance } from '../structure/graph';
import { createStructuralInstanceState } from '../structure/types';
const el = (id: string) => document.getElementById(id)!;
const tonnes = (v: number) => (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' t';
export function showStructuralInspector(b: AnyShipBlueprint, viewer?: ShipViewer) {
    const f = b.schemaVersion === 2 ? b.structuralFrame : undefined;
    el('structural-selection').onchange=null;el('structural-disable').onchange=null;
    el('structural-summary').textContent = f ? `STRUCTURAL FRAME · ${f.members.length} members / ${f.joints.length} joints · ${f.analysis.components.length} component · ${tonnes(f.massAccounting.frameMassKg + f.massAccounting.connectorMassKg)}` : 'LEGACY STRUCTURE · 저장된 골조 없음 · 로드 시 자동 재설계하지 않음';
    el('structural-details').replaceChildren();
    el('structural-selection').replaceChildren();
    el('structural-selection-info').textContent = '';
    el('structural-query-result').textContent = '';
    el('structural-damage-analysis').textContent = '';
    (el('structural-disable') as HTMLInputElement).checked = false;
    (el('structural-query') as HTMLButtonElement).disabled = !f;
    (el('structural-disable') as HTMLInputElement).disabled = !f;
    if (!f || b.schemaVersion !== 2)
        return;
    const line = (text: string) => { const p = document.createElement('p'); p.textContent = text; el('structural-details').append(p); };
    line(`${f.architecture}: ${[...new Set(f.volumeFrames.map(v => v.template))].join(' / ')}`);
    line(`Graph ${f.nodes.length} nodes / ${f.edges.length} edges · ${f.analysis.bridges.length} bridges / ${f.analysis.articulationPoints.length} articulation points · cycle rank ${f.analysis.cycleRank} (independent cycles, not a strength rating)`);
    line(`Hull/frame: ${f.skinAttachments.length} finite material contact witnesses · tie stock reserve ${tonnes(f.massAccounting.plannedHullTieReserveKg)} (allocation only; actual ties are in frame mass).`);
    line(`Connections: ${f.joints.filter(j => j.connectionType === 'WELDED_CONTACT').length} welded contacts / ${f.joints.filter(j => j.connectionType === 'ENGINE_MOUNT_INTERFACE').length} engine seats / ${f.joints.filter(j => j.connectionType === 'CAPPED_MEMBER_END').length} free end caps.`);
    line(`Actual internal frame ${tonnes(f.massAccounting.frameMassKg)} · reused connector ${tonnes(f.massAccounting.connectorMassKg)} · remaining macro-frame estimate ${tonnes(f.massAccounting.remainingStructuralEstimateKg)} · retired proxy ${tonnes(f.massAccounting.retiredLegacyFrameProxyKg)}`);
    if (b.procurement?.cost)
        line(`Relative structural manufacturing: ${b.procurement.cost.structuralMaterial?.toFixed(0)} material + ${b.procurement.cost.structuralFabrication?.toFixed(0)} fabrication index (not currency).`);
    line(`Material ${HULL_MATERIALS[f.policy.materialId].displayName} / ${HULL_MATERIALS[f.policy.materialId].densityKgM3} kg/m³ · nominal section ${f.policy.sideM.toFixed(3)} m · max frame stations ${f.policy.stationCount} · extra paths ${f.policy.extraPaths}`);
    line(`All ${f.volumeFrames.length} modules reachable. Root IDs ${f.roots.join(', ')}. ${f.members.reduce((n, m) => n + m.pieces.length, 0)} finite material cells. Joints own no additional material.`);
    line(`Guides: ${f.futureCompartments.stationInterfaces.length} stations, ${f.futureCompartments.moduleConnections.length} interfaces; these are not airtight compartments/bulkheads.`);
    for (const text of [...f.policy.reason, f.massAccounting.scope, ...f.massAccounting.unquantified, ...f.warnings])
        line(text);
    const select = el('structural-selection') as HTMLSelectElement;
    select.replaceChildren(...f.members.map(m => new Option(`${m.id} · ${m.type} · ${tonnes(m.massKg)}`, m.id)));
    select.onchange = () => {
        const m = structuralMember(b, select.value)!;
        viewer?.selectStructuralMember(m.id);
        (el('structural-disable') as HTMLInputElement).checked = false;
        el('structural-damage-analysis').textContent = '';
        const neighborIds = [...new Set(f.nodes.filter(n => m.nodeIds.includes(n.id)).flatMap(n => n.memberIds))].filter(id => id !== m.id);
        el('structural-selection-info').textContent = `${m.id}\n${m.type} · ${m.structuralRole}\n${m.materialId} / ${m.densityKgM3} kg/m³\nStart ${JSON.stringify(m.start)}\nEnd ${JSON.stringify(m.end)}\nLength ${m.lengthM.toFixed(3)}m · ${m.section.kind} / ${m.section.widthM.toFixed(3)} × ${m.section.heightM.toFixed(3)}m\nExclusive material ${m.volumeM3.toFixed(6)}m³ / ${tonnes(m.massKg)}\nNodes ${m.nodeIds.join(', ')} · component ${f.analysis.componentByNode[m.nodeIds[0]]}\nJoints ${m.jointIds.join(', ')}\nConnected members ${neighborIds.join(', ')}\n${f.analysis.bridges.includes('se/' + m.id) ? 'BRIDGE: single-member loss can split graph' : 'Alternative topological path present'} · ${m.redundancyGroup}\nSource ${JSON.stringify(m.geometryReference)}\n${m.exposure} · envelope is construction/contact evidence; material cells own mass once.`;
    };
    select.dispatchEvent(new Event('change'));
    el('structural-disable').onchange = () => {
        const state = createStructuralInstanceState();
        if ((el('structural-disable') as HTMLInputElement).checked)
            state.disabledMemberIds = [select.value];
        const r = analyzeStructuralInstance(f, state);
        el('structural-damage-analysis').textContent = `DEBUG ANALYSIS ONLY · ${r.components.length} components / ${r.unreachableVolumeIds.length} unreachable volumes (${r.unreachableVolumeIds.join(', ') || 'none'})\nPartially disconnected volumes: ${r.partiallyDisconnectedVolumeIds?.join(', ') || 'none'}\nStored design unchanged. No physical break/separation simulation.`;
    };
}
export function setupStructuralInspector(viewer: ShipViewer | undefined, current: () => AnyShipBlueprint) {
    if (viewer)
        viewer.onStructuralSelect = id => { const select = el('structural-selection') as HTMLSelectElement; select.value = id; select.dispatchEvent(new Event('change')); };
    el('structural-query').onclick = () => {
        try {
            const b = current();
            if (b.schemaVersion !== 2)
                throw Error('Structural data required');
            const parse = (id: string): Vec3 => {
                const a = (el(id) as HTMLInputElement).value.split(',').map(Number);
                if (a.length !== 3 || !a.every(Number.isFinite))
                    throw Error('Finite xyz required');
                return { x: a[0], y: a[1], z: a[2] };
            };
            const start = performance.now(), q = prepareStructuralQueries(b), r = q.probe(parse('structural-origin'), parse('structural-direction'), Number((el('structural-distance') as HTMLInputElement).value));
            el('structural-query-result').textContent = `${r.valid ? 'VALID' : 'INVALID'} · ${r.hits.length} finite material intervals · prepare/check + query ${(performance.now() - start).toFixed(1)}ms\n${q.pieceCount} cells / ${q.planeCount} planes / ${q.estimatedBytes} bytes (plane storage estimate, excludes JS/BVH overhead)\n${r.hits.map(h => `${h.memberId} / ${h.materialId}\n${h.entryDistanceM.toFixed(4)} → ${h.exitDistanceM.toFixed(4)}m · path ${h.pathLengthM.toFixed(4)}m\nEntry ${JSON.stringify(h.entryPoint)} / Exit ${JSON.stringify(h.exitPoint)}\nNodes ${h.nodeIds.join(', ')} / ${tonnes(h.massKg)}`).join('\n')}\n${r.warnings.join('\n')}`;
        }
        catch (e) {
            el('structural-query-result').textContent = String(e);
        }
    };
}
