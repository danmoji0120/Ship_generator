import{prepareFunctionalQueries,equipmentSpaceClear}from'../systems/query';
import{placementBox}from'../interior/query';
import type { AnyShipBlueprint } from '../blueprint/types';
import type { ShipViewer } from '../rendering/viewer';
import { createInteriorInstanceState } from '../interior/types';
import { analyzeInterior } from '../interior/graph';
import { physicalDiagnostics } from '../physical/diagnostics';
import { interiorCacheBytes } from '../interior/build';
import { prepareInteriorQueries } from '../interior/query';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const tonnes = (n: number) => (n / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' t';
export function showInteriorInspector(b: AnyShipBlueprint, viewer?: ShipViewer) {
    const p = b.schemaVersion === 2 ? b.compartmentPlan : undefined;
    el('interior-selection').onchange=null;
    el('interior-summary').textContent = p ? `INTERIOR · ${p.compartments.length} compartments / ${p.bulkheads.length} bulkheads / ${p.openings.length} portals · ${tonnes(p.massAccounting.bulkheadMassKg + p.massAccounting.closureMassKg)}` : 'LEGACY INTERIOR · 저장된 구획 없음 · 로드 시 자동 삽입하지 않음';
    for (const id of ['interior-info', 'interior-analysis', 'interior-query-result'])
        el(id).textContent = '';
    for (const id of ['interior-selection', 'interior-opening'])
        el(id).replaceChildren();
    el('interior-wall').replaceChildren(new Option('None', ''));
    for (const id of ['interior-query', 'interior-analyze', 'interior-reset'])
        el<HTMLButtonElement>(id).disabled = !p;
    el<HTMLInputElement>('interior-breach').checked = false;
    el<HTMLSelectElement>('interior-opening-state').value = 'DESIGN';
    if (!p || b.schemaVersion !== 2)
        return;
    const select = el<HTMLSelectElement>('interior-selection');
    select.replaceChildren(...p.compartments.map(c => new Option(`${c.id} · ${c.pressureCapability}`, c.id)), ...p.bulkheads.map(w => new Option(`${w.id} · ${tonnes(w.massKg)}`, w.id)), ...p.openings.map(o => new Option(`${o.id} · ${o.type} / ${o.defaultState}`, o.id)));
    select.onchange = () => { const id = select.value, c = p.compartments.find(c => c.id === id), w = p.bulkheads.find(w => w.id === id), o = p.openings.find(o => o.id === id); viewer?.selectInterior(id); el('interior-info').textContent = c ? `${c.id}\n${c.grammar} / ${c.parentStructuralVolumeRef}\nFinite CSG void ${c.volumeM3.toFixed(3)}m³ / domain ${c.domainVolumeM3.toFixed(3)}m³ minus occupied ${c.occupiedVolumeM3.toFixed(3)}m³; unresolved other void ${c.extractionAudit.unresolvedVoidVolumeM3.toExponential(3)}m³; ${c.physicalVolume.connectedCells.length} connected finite cells\nCentroid ${JSON.stringify(c.centroid)}\n${c.pressureCapability} · ${c.boundaryCertainty} (design capability; no pressure simulated)\nExterior connected: ${p.analysis.exteriorConnectedCompartmentIds.includes(c.id)}\nAdjacent ${c.adjacentCompartmentIds.join(', ') || 'none'}\nBoundaries ${c.boundaryReferences.join(', ')}\nOpenings ${c.openingReferences.join(', ')}\nFrame ${c.structuralFrameReferences.join(', ')}\nHull Shell ${c.hullShellReferences.join(', ')}\n${p.approximation.model} · tolerance ${p.approximation.toleranceM}m\n${c.unresolvedBoundaryReasons.join('\n')}\n${b.functionalSystems?'Functional equipment plan available separately; no ammunition or live pressure model.':'Future systems: space/collision query only; no reactor or ammunition rooms generated.'}` : w ? `${w.id}\n${w.materialId} / ${w.thicknessMm.toFixed(2)}mm\nSection ${w.grossAreaM2.toFixed(3)}m² / actual material ${w.volumeM3.toFixed(5)}m³ / ${tonnes(w.massKg)}\n${w.roles.join(', ')}\nSealable boundary capability (ideal finite contact): ${w.pressureTight}\nAdjacent ${w.adjacentCompartmentIds.join(', ')}\nReal apertures ${w.openingIds.join(', ') || 'NONE: not traversable'}\nActual Frame contacts ${w.structuralAttachmentRefs.join(', ')}\n${w.geometryApproximationInfo}` : o ? `${o.id}\n${o.type} / ${o.defaultState}\n${o.fromCompartmentId} → ${o.toCompartmentId}\nActual aperture ${o.apertureAreaM2.toFixed(4)}m²\nSealing capability ${o.pressureSealingCapability}\nClosure ${o.closure ? o.closure.materialId + ' / ' + o.closure.thicknessMm.toFixed(2) + 'mm / ' + tonnes(o.closure.massKg) : 'NONE: actual open passage'}\nBoundary ${o.boundaryReference}` : ''; };
    select.dispatchEvent(new Event('change'));
    el('interior-opening').replaceChildren(...p.openings.filter(o => o.closure).map(o => new Option(`${o.id} · ${o.defaultState}`, o.id)));
    el('interior-wall').append(...p.bulkheads.map(w => new Option(w.id, w.id)));
    el('interior-analysis').textContent = `${p.volumeAudit?`Residual colors: nonallocatable purple / usable cyan / unresolved amber\nVOLUME AUDIT (m³): confirmed ${p.volumeAudit.validInteriorM3.toFixed(3)} / assigned ${p.volumeAudit.assignedM3.toFixed(3)} / usable residual ${p.volumeAudit.usableResidualM3.toExponential(3)} / nonallocatable ${p.volumeAudit.nonallocatableM3.toExponential(3)} / unresolved ${p.volumeAudit.unresolvedCandidateM3.toFixed(3)} / solid ${p.volumeAudit.solidOccupiedM3.toFixed(3)} / conservation error ${p.volumeAudit.conservationErrorM3.toExponential(3)}\nRecovered ${p.volumeAudit.recoveredM3.toFixed(3)}m³; unresolved boundaries ${p.volumeAudit.unquantifiedRegionIds.join(', ')||'none'}\n${p.volumeAudit.note}\n`:''}Retained interior cache estimate ${(interiorCacheBytes()/1048576).toFixed(2)}MiB (JSON UTF-16 estimate; browser RSS/heap not measured)\n${physicalDiagnostics(b)?JSON.stringify(physicalDiagnostics(b)): 'Performance profile off; no timing is fabricated.'}\nDesign: ${p.analysis.isolatedGroups.length} disconnected groups (check uncertainty) · exterior ${p.analysis.exteriorConnectedCompartmentIds.length} compartments (${(p.analysis.exposureRatio * 100).toFixed(3)}% volume) · ${p.analysis.uncertainCompartmentIds.length} unresolved\n${p.regions.filter(r => r.state === 'UNRESOLVED').map(r => r.volumeId + ': ' + r.reason).join('\n')}\nStructural allowance remaining ${tonnes(p.budgetAccounting.remainingStructureAllowanceKg)} · ${p.budgetAccounting.note}\nActual walls ${tonnes(p.massAccounting.bulkheadMassKg)} / closures ${tonnes(p.massAccounting.closureMassKg)}\n${p.massAccounting.remainingEstimateTreatment}`;
}
export function setupInteriorInspector(viewer: ShipViewer | undefined, current: () => AnyShipBlueprint) {
    if (viewer)
        viewer.onInteriorSelect = id => { const s = el<HTMLSelectElement>('interior-selection'); s.value = id; s.dispatchEvent(new Event('change')); };
    el('interior-opacity').oninput = () => viewer?.setInteriorAnalysis(undefined, Number(el<HTMLInputElement>('interior-opacity').value));
    el('interior-analyze').onclick = () => { try {
        const b = current();
        if (b.schemaVersion !== 2 || !b.compartmentPlan)
            throw Error('Interior data absent');
        const p = b.compartmentPlan, state = createInteriorInstanceState(), opening = el<HTMLSelectElement>('interior-opening').value, value = el<HTMLSelectElement>('interior-opening-state').value;
        if (opening && value !== 'DESIGN')
            state.openingStates[opening] = value as 'OPEN' | 'SEALED';
        const wall = el<HTMLSelectElement>('interior-wall').value;
        if (wall)
            state.disabledBulkheadIds = [wall];
        if (el<HTMLInputElement>('interior-breach').checked) {
            const c = p.compartments.find(c => c.id === el<HTMLSelectElement>('interior-selection').value) ?? p.compartments.find(c => c.exteriorPatches.length);
            if (!c?.exteriorPatches.length)
                throw Error('Selected region has no verified exterior boundary patch');
            state.hypotheticalHullBreaches = [{ compartmentId: c.id, exteriorPatchIndex: 0 }];
        }
        const result = analyzeInterior(p, state);
        el('interior-analysis').textContent = `DEBUG HYPOTHESIS ONLY · design unchanged\n${result.accessGroups.length} access groups / ${result.isolatedGroups.length} disconnected pressure groups (not a seal certification)\nVacuum-connected ${(result.exposureRatio * 100).toFixed(3)}% / ${result.exposedVolumeM3.toFixed(3)}m³\n${result.exteriorConnectedCompartmentIds.join(', ')}\nPaths ${JSON.stringify(result.exteriorPaths)}\nUncertain ${result.uncertainCompartmentIds.join(', ') || 'none'}\nNo damage geometry, pressure or oxygen simulation.`;
        viewer?.setInteriorAnalysis(state);
    }
    catch (error) {
        el('interior-analysis').textContent = String(error);
    } };
    el('interior-reset').onclick = () => { viewer?.setInteriorAnalysis(); showInteriorInspector(current(), viewer); };
    el('interior-query').onclick = () => { try {
        const b = current();
        if (b.schemaVersion !== 2)
            throw Error('Interior data absent');
        const parse = (id: string) => { const v = el<HTMLInputElement>(id).value.split(',').map(Number); if (v.length !== 3 || !v.every(Number.isFinite))
            throw Error('Finite xyz required'); return { x: v[0], y: v[1], z: v[2] }; };
        const q = prepareInteriorQueries(b), r = q.probe(parse('interior-origin'), parse('interior-direction'), Number(el<HTMLInputElement>('interior-distance').value));
        const candidates=q.placementCandidates({x:1,y:1,z:2},{clearanceM:.1,limit:3});
        if(b.functionalSystems)candidates.candidates=candidates.candidates.filter(c=>equipmentSpaceClear(b.functionalSystems!,placementBox(c.position,c.size,c.clearanceM,c.quaternion)));
        const equipmentHits=b.functionalSystems?prepareFunctionalQueries(b.functionalSystems).probe(parse('interior-origin'),parse('interior-direction'),Number(el<HTMLInputElement>('interior-distance').value)):[];
        el('interior-query-result').textContent = `PLACEMENT FIXTURE 1×1×2m + .1m clearance: ${candidates.candidates.length} confirmed candidates / ${candidates.tested} tested (bounded search, not packing proof)\n${candidates.candidates.map(c=>c.compartmentId+' '+JSON.stringify(c.position)+' '+c.confidence).join('\n')}\n${r.valid ? 'VALID' : 'INVALID'} · ${r.hits.length} finite intervals · ${q.cellCount} cells\n${r.hits.map(h => `${h.kind} ${h.id}\n${h.materialId ?? 'EMPTY SPACE / PORTAL'} ${h.thicknessMm ?? ''} / ${h.state ?? ''}\n${h.entryDistanceM.toFixed(4)} → ${h.exitDistanceM.toFixed(4)}m · LOS ${h.pathLengthM.toFixed(4)}m`).join('\n')}\n${r.warnings.join('\n')}\nFUNCTIONAL EQUIPMENT ENVELOPES (separate layer): ${equipmentHits.length}\n${equipmentHits.map(h=>h.equipmentId+' '+h.materialId+' '+h.entryDistanceM.toFixed(4)+' → '+h.exitDistanceM.toFixed(4)+'m / '+h.approximation).join('\n')}`;
    }
    catch (error) {
        el('interior-query-result').textContent = String(error);
    } };
}
