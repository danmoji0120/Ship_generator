import {functionalPlanCacheBytes,FUNCTIONAL_CACHE_LIMIT_BYTES} from '../systems/cache';
import type { AnyShipBlueprint, ShipBlueprint } from '../blueprint/types';
import type { ShipViewer } from '../rendering/viewer';
import { createSystemInstanceState, installedSystemLoads, type SystemInstanceState, type OperatingState } from '../systems/types';
import { evaluateShipCapabilities, analyzeSystemRedundancy, analyzeCompartmentSystemLoss, advanceSystemState } from '../systems/evaluate';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let source: AnyShipBlueprint | undefined, state: SystemInstanceState = createSystemInstanceState();
function show(b: ShipBlueprint, viewer?: ShipViewer) {
    const plan = b.functionalSystems!, start = performance.now(), cap = evaluateShipCapabilities(b, state), ms = performance.now() - start, id = el<HTMLSelectElement>('system-selection').value, e = plan.equipment.find(e => e.id === id), actual = cap.equipment.find(e => e.id === id);
    el('systems-summary').textContent = `FUNCTIONAL SYSTEMS · ${plan.equipment.length} units · ${(plan.massAccounting.equipmentKg / 1000).toFixed(2)} t · ${plan.architecturePolicy}`;
    el('system-capabilities').textContent = `Generation ${cap.generatedPowerMW.toFixed(2)} MW / available ${cap.availableElectricalPowerMW.toFixed(2)} MW\nConsumed ${cap.consumedElectricalPowerMW.toFixed(2)} MW / deficit ${cap.electricalPowerDeficitMW.toFixed(2)} MW\nCommand ${(cap.commandAvailability * 100).toFixed(1)}% · Propulsion ${(cap.propulsionAuthority * 100).toFixed(1)}% · Maneuver ${(cap.maneuverAuthority * 100).toFixed(1)}%\nFire control ${cap.availableFireControlChannels.toFixed(2)} channels · Sensor processing ${cap.availableSensorProcessingCapacity.toFixed(2)} channels\nReserve ${cap.backupPowerRemainingMJ.toFixed(2)} MJ · evaluation ${ms.toFixed(3)} ms\n${cap.activeSystemCount} active / ${cap.offlineSystemCount} unavailable\n${cap.externalLoads.map(e => `${e.id}: ${e.specification}, power ${e.suppliedMW ?? 'unknown'} MW, control ${(e.controlFraction * 100).toFixed(0)}%`).join('\n')}\n${cap.criticalFailureWarnings.join('\n')}\nFunctional plan cache ${(functionalPlanCacheBytes()/2**20).toFixed(1)} / ${FUNCTIONAL_CACHE_LIMIT_BYTES/2**20} MiB (UTF-16 estimate; no whole Blueprint retained).\nLogical routes; no fuel, heat, flight, radar range or live damage simulation.`;
    if (e) {
        el<HTMLSelectElement>('system-state').value = state.equipmentStates[e.id] ?? 'OPERATIONAL';
        el('system-info').textContent = `${e.id}\n${e.type} · ${e.compartmentId}\nHost ${e.parentStructuralVolumeRef}\n${e.materialId} · ${e.massKg} kg (specified dry mass, not solid material)\nOBB ${e.sizeM.x} × ${e.sizeM.y} × ${e.sizeM.z}m / .2m clearance\nRated ${e.specification.capacity} ${e.specification.capacityUnit}\nDemand ${actual?.demandMW} MW / supplied ${actual?.suppliedMW} MW\nActual output ${actual?.outputMW} MW / distribution throughput ${actual?.throughputMW} MW\nState ${actual?.state} / functional ${actual?.functionalFraction}\nTargets ${e.supportedEquipmentRefs.join(', ') || 'dynamic installed weapon/sensor channels'}\n${e.redundancyGroup}\nArmor samples ${e.protection.armorSurfaceIds.length} surfaces / summed six-axis path ${e.protection.sampledArmorPathMm.toFixed(2)} mm (not protection probability)\nInputs ${plan.powerNetwork.filter(l => l.to === id).map(l => l.id).join('\n')}\nControl ${plan.controlNetwork.filter(l => l.to === id).map(l => l.from).join(', ')}\n${e.specification.description}`;
    }
    viewer?.setSystemAnalysis(state, id);
}
export function showSystemsInspector(b: AnyShipBlueprint, viewer?: ShipViewer) {
    const p = b.schemaVersion === 2 ? b.functionalSystems : undefined;
    const select = el<HTMLSelectElement>('system-selection');
    select.onchange = null;
    const previousId = select.value;
    if (source !== b && (source?.schemaVersion !== 2 || source.functionalSystems !== p))
        state = createSystemInstanceState(p);
    source = b;
    select.replaceChildren(...(p?.equipment.map(e => new Option(`${e.type} · ${e.compartmentId}`, e.id)) ?? []));
    if (p?.equipment.some(e => e.id === previousId))
        select.value = previousId;
    for (const id of ['system-focus', 'system-apply', 'system-reset', 'system-advance', 'system-analyze'])
        el<HTMLButtonElement>(id).disabled = !p;
    if (!p || b.schemaVersion !== 2) {
        el('systems-summary').textContent = 'LEGACY · no functional plan; load never inserts equipment';
        el('system-capabilities').textContent = '';
        el('system-info').textContent = '';
        el('system-redundancy').textContent = '';
        viewer?.setSystemAnalysis();
        return;
    }
    select.onchange = () => show(b, viewer);
    show(b, viewer);
}
export function setupSystemsInspector(viewer: ShipViewer | undefined, current: () => AnyShipBlueprint) {
    const active = () => { const b = current(); if (b.schemaVersion !== 2 || !b.functionalSystems)
        throw Error('No functional system plan'); return b; };
    el('system-focus').onclick = () => viewer?.focusSystem(el<HTMLSelectElement>('system-selection').value);
    el('system-apply').onclick = () => { const b = active(); state.equipmentStates[el<HTMLSelectElement>('system-selection').value] = el<HTMLSelectElement>('system-state').value as OperatingState; show(b, viewer); };
    el('system-reset').onclick = () => { const b = active(); state = createSystemInstanceState(b.functionalSystems); show(b, viewer); el('system-redundancy').textContent = ''; };
    el('system-advance').onclick = () => { const b = active(); state = advanceSystemState(b.functionalSystems!, state, 10, installedSystemLoads(b)).state; show(b, viewer); };
    el('system-analyze').onclick = () => { const b = active(); el('system-redundancy').textContent = JSON.stringify({ equipment: analyzeSystemRedundancy(b.functionalSystems!), compartmentLoss: analyzeCompartmentSystemLoss(b.functionalSystems!) }, null, 2); };
    if (viewer)
        viewer.onSystemSelect = id => { el<HTMLSelectElement>('system-selection').value = id; show(active(), viewer); };
}
