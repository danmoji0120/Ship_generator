import type { ShipBlueprint } from '../blueprint/types';
import type { FunctionalSystemPlan, SystemInstanceState, ShipCapabilities, ExternalSystemLoad, EquipmentType } from './types';
import { createSystemInstanceState, installedSystemLoads } from './types';
export const operatingFactor = (s: string | undefined) => s === 'OFFLINE' || s === 'DESTROYED' ? 0 : s === 'DEGRADED' ? .5 : 1;
/** Deterministic residual-flow allocator. Distribution is vertex-capacitated;
 * reverse residual arcs permit rerouting, never duplicate sources through loops. */
class Flow {
    edges = new Map<string, {
        to: string;
        remaining: number;
        reverse: number;
        initial: number;
        tag?: string;
    }[]>();
    add(from: string, to: string, cap: number, tag?: string) { const a = this.edges.get(from) ?? [], b = this.edges.get(to) ?? []; this.edges.set(from, a); this.edges.set(to, b); a.push({ to, remaining: cap, initial: cap, reverse: b.length, tag }); b.push({ to: from, remaining: 0, initial: 0, reverse: a.length - 1 }); }
    deliver(to: string, amount: number) { let total = 0; while (total < amount - 1e-9) {
        const seen = new Map<string, {
            from: string;
            index: number;
        }>([['SOURCE', { from: '', index: 0 }]]), queue = ['SOURCE'];
        for (let i = 0; i < queue.length && !seen.has(to); i++)
            for (const [eIndex, e] of (this.edges.get(queue[i]) ?? []).entries())
                if (e.remaining > 1e-9 && !seen.has(e.to)) {
                    seen.set(e.to, { from: queue[i], index: eIndex });
                    queue.push(e.to);
                }
        if (!seen.has(to))
            break;
        let take = amount - total;
        for (let n = to; n !== 'SOURCE';) {
            const p = seen.get(n)!, e = this.edges.get(p.from)![p.index];
            take = Math.min(take, e.remaining);
            n = p.from;
        }
        for (let n = to; n !== 'SOURCE';) {
            const p = seen.get(n)!, e = this.edges.get(p.from)![p.index];
            e.remaining -= take;
            this.edges.get(e.to)![e.reverse].remaining += take;
            n = p.from;
        }
        total += take;
    } return total; }
    used(tag: string) { let n = 0; for (const es of this.edges.values())
        for (const e of es)
            if (e.tag === tag)
                n += e.initial - e.remaining; return n; }
}
export function evaluateSystemPlan(plan: FunctionalSystemPlan, state: SystemInstanceState = createSystemInstanceState(plan), external: ExternalSystemLoad[] = [], seconds = 1): ShipCapabilities {
    if (!Number.isFinite(seconds) || seconds <= 0)
        throw Error('INVALID_SYSTEM_EVALUATION_DURATION');
    const ids = new Set(plan.equipment.map(e => e.id));
    if (external.some(e => !e.id || ids.has(e.id) || e.powerMW !== undefined && (!Number.isFinite(e.powerMW) || e.powerMW < 0) || e.channels !== undefined && (!Number.isFinite(e.channels) || e.channels <= 0)) || new Set(external.map(e => e.id)).size !== external.length)
        throw Error('INVALID_EXTERNAL_OPERATING_SPECIFICATION');
    const factor = (id: string) => operatingFactor(state.equipmentStates[id]), flow = new Flow(), equip = new Map(plan.equipment.map(e => [e.id, e]));
    let generated = 0, storageAvailable = 0;
    for (const e of plan.equipment) {
        const f = factor(e.id), s = e.specification;
        if (e.type === 'POWER_GENERATOR') {
            const cap = s.capacity * f;
            generated += cap;
            flow.add('SOURCE', e.id + '/out', cap, 'source/' + e.id);
        }
        if (e.type === 'ENERGY_STORAGE') {
            const charge = state.storageMJ[e.id] ?? s.capacity;
            if (!Number.isFinite(charge) || charge < 0 || charge > s.capacity + 1e-6)
                throw Error('INVALID_STORAGE_ENERGY');
            const cap = Math.min((s.storageOutputMW ?? 0) * f, charge / seconds);
            storageAvailable += cap;
        }
        if (e.type === 'POWER_DISTRIBUTION')
            flow.add(e.id + '/in', e.id + '/out', s.capacity * f, 'distribution/' + e.id);
    }
    const disabled = new Set(state.disabledPowerEdges);
    for (const edge of plan.powerNetwork)
        if (!disabled.has(edge.id) && equip.has(edge.from) && equip.has(edge.to)) {
            const a = equip.get(edge.from)!, b = equip.get(edge.to)!;
            if (a.type === 'ENERGY_STORAGE')
                continue;
            flow.add(a.id + '/out', b.id + '/in', (edge.capacityMW ?? 1e6) * Math.min(factor(a.id), factor(b.id)), edge.id);
        }
    const consumers = plan.equipment.filter(e => e.specification.demandMW > 0).sort((a, b) => a.specification.priority - b.specification.priority || a.id.localeCompare(b.id)), supply = new Map<string, number>();
    // Storage source arcs are added only after primary generation paths are exhausted.
    for (const e of consumers)
        supply.set(e.id, flow.deliver(e.id + '/in', e.specification.demandMW * factor(e.id)));
    const loads = [...external].sort((a, b) => a.id.localeCompare(b.id));
    for (const l of loads) {
        for (const bus of plan.equipment.filter(e => e.type === 'POWER_DISTRIBUTION'))
            flow.add(bus.id + '/out', l.id + '/in', 1e6);
        supply.set(l.id, flow.deliver(l.id + '/in', l.powerMW ?? 0));
    }
    for (const e of plan.equipment.filter(e => e.type === 'ENERGY_STORAGE')) {
        flow.add('SOURCE', e.id + '/out', Math.min((e.specification.storageOutputMW ?? 0) * factor(e.id), (state.storageMJ[e.id] ?? e.specification.capacity) / seconds), 'source/' + e.id);
        for (const edge of plan.powerNetwork.filter(l => l.from === e.id && !disabled.has(l.id)))
            flow.add(e.id + '/out', edge.to + '/in', (edge.capacityMW ?? 1e6) * Math.min(factor(e.id), factor(edge.to)), edge.id);
    }
    // Essential consumers keep priority during reserve dispatch as well.
    for (const e of consumers) {
        const old = supply.get(e.id) ?? 0;
        supply.set(e.id, old + flow.deliver(e.id + '/in', e.specification.demandMW * factor(e.id) - old));
    }
    for (const l of loads) {
        const old = supply.get(l.id) ?? 0;
        supply.set(l.id, old + flow.deliver(l.id + '/in', (l.powerMW ?? 0) - old));
    }
    const storageDispatchMW: Record<string, number> = {}, storageChargeMW: Record<string, number> = {};
    for (const e of plan.equipment.filter(e => e.type === 'ENERGY_STORAGE'))
        storageDispatchMW[e.id] = flow.used('source/' + e.id);
    // Do not recharge from other storage or charge and discharge in the same step.
    if (Object.values(storageDispatchMW).every(n => n < 1e-9))
        for (const e of plan.equipment.filter(e => e.type === 'ENERGY_STORAGE'))
            storageChargeMW[e.id] = flow.deliver(e.id + '/in', Math.min((e.specification.storageOutputMW ?? 0) * factor(e.id), (e.specification.capacity - (state.storageMJ[e.id] ?? e.specification.capacity)) / seconds));
    const fractions = new Map(plan.equipment.map(e => [e.id, e.specification.demandMW > 0 ? Math.min(factor(e.id), (supply.get(e.id) ?? 0) / e.specification.demandMW) : factor(e.id)]));
    const commandSources = plan.equipment.filter(e => e.type === 'COMMAND_CONTROL'), reachable = new Map<string, number>(commandSources.map(e => [e.id, fractions.get(e.id)!]));
    for (let n = 0; n < plan.equipment.length; n++) {
        let changed = false;
        for (const edge of plan.controlNetwork)
            if (!state.disabledControlEdges.includes(edge.id) && equip.has(edge.from) && equip.has(edge.to)) {
                const value = Math.min(reachable.get(edge.from) ?? 0, fractions.get(edge.to) ?? 0);
                if (value > (reachable.get(edge.to) ?? 0)) {
                    reachable.set(edge.to, value);
                    changed = true;
                }
            }
        if (!changed)
            break;
    }
    const functional = (id: string) => reachable.get(id) ?? 0;
    const capacity = (type: EquipmentType) => plan.equipment.filter(e => e.type === type).reduce((n, e) => n + e.specification.capacity * functional(e.id), 0);
    const authority = (type: EquipmentType, refs: string[]) => refs.length ? refs.reduce((n, id) => n + Math.max(0, ...plan.equipment.filter(e => e.type === type && e.supportedEquipmentRefs.includes(id)).map(e => functional(e.id))), 0) / refs.length : 0;
    const command = Math.min(1, capacity('COMMAND_CONTROL')), propulsion = authority('PROPULSION_CONTROL', plan.engineRefs), maneuver = authority('MANEUVER_CONTROL', plan.maneuverRefs), fire = capacity('FIRE_CONTROL'), sensor = capacity('SENSOR_PROCESSING');
    let fireRemaining = fire, sensorRemaining = sensor;
    const externalLoads = loads.map(l => { let channels = l.kind === 'WEAPON' ? fireRemaining : sensorRemaining; const requested = l.channels ?? 1, controlFraction = Math.min(1, channels / requested); if (l.kind === 'WEAPON')
        fireRemaining = Math.max(0, fireRemaining - requested);
    else
        sensorRemaining = Math.max(0, sensorRemaining - requested); const powerFraction = l.powerMW === undefined ? null : l.powerMW === 0 ? 1 : Math.min(1, (supply.get(l.id) ?? 0) / l.powerMW); return { id: l.id, operatingAvailability: powerFraction === null ? null : Math.min(controlFraction, powerFraction), supportedControllerIds: plan.equipment.filter(e => e.type === (l.kind === 'WEAPON' ? 'FIRE_CONTROL' : 'SENSOR_PROCESSING') && functional(e.id) > 0).map(e => e.id), specification: l.powerMW === undefined ? 'LEGACY_UNSPECIFIED' as const : 'DEFINED' as const, suppliedMW: l.powerMW === undefined ? null : supply.get(l.id) ?? 0, controlFraction }; });
    const equipment = plan.equipment.map(e => ({ id: e.id, state: state.equipmentStates[e.id] ?? 'OPERATIONAL' as const, demandMW: e.specification.demandMW * factor(e.id), suppliedMW: supply.get(e.id) ?? 0, outputMW: flow.used('source/' + e.id), throughputMW: flow.used('distribution/' + e.id), powerFraction: fractions.get(e.id)!, functionalFraction: e.specification.demandMW ? functional(e.id) : factor(e.id) }));
    const consumed = equipment.reduce((n, e) => n + e.suppliedMW, 0) + loads.reduce((n, e) => n + (supply.get(e.id) ?? 0), 0) + Object.values(storageChargeMW).reduce((n, x) => n + x, 0), demand = equipment.reduce((n, e) => n + e.demandMW, 0) + loads.reduce((n, e) => n + (e.powerMW ?? 0), 0), deficit = Math.max(0, demand - (consumed - Object.values(storageChargeMW).reduce((n, x) => n + x, 0)));
    return { availableElectricalPowerMW: generated + storageAvailable, generatedPowerMW: generated, consumedElectricalPowerMW: consumed, electricalPowerDeficitMW: deficit, commandAvailability: command, propulsionControlAvailability: propulsion, maneuverControlAvailability: maneuver, fireControlAvailability: Math.min(1, fire / 8), sensorProcessingAvailability: Math.min(1, sensor / 8), propulsionAuthority: propulsion, maneuverAuthority: maneuver, availableFireControlChannels: fire, availableSensorProcessingCapacity: sensor, activeSystemCount: equipment.filter(e => e.functionalFraction > 0).length, offlineSystemCount: equipment.filter(e => e.functionalFraction === 0).length, backupPowerRemainingMJ: plan.equipment.filter(e => e.type === 'ENERGY_STORAGE' && factor(e.id) > 0).reduce((n, e) => n + (state.storageMJ[e.id] ?? e.specification.capacity), 0), equipment, externalLoads, storageDispatchMW, storageChargeMW, edgeFlowsMW: Object.fromEntries(plan.powerNetwork.map(e => [e.id, flow.used(e.id)])), criticalFailureWarnings: [...(!command ? ['COMMAND_UNAVAILABLE'] : []), ...(!propulsion ? ['PROPULSION_CONTROL_UNAVAILABLE'] : []), ...(!maneuver ? ['MANEUVER_CONTROL_UNAVAILABLE'] : []), ...(deficit > 1e-6 ? ['POWER_DEFICIT'] : []), ...(externalLoads.some(l => l.specification === 'LEGACY_UNSPECIFIED') ? ['EXTERNAL_POWER_UNSPECIFIED'] : []), ...(externalLoads.some(l => l.controlFraction < 1) ? ['EXTERNAL_CONTROL_CAPACITY_EXCEEDED'] : [])] };
}
export function evaluateShipCapabilities(b: ShipBlueprint, state?: SystemInstanceState, loads = installedSystemLoads(b), seconds = 1) { if (!b.functionalSystems)
    throw Error('FUNCTIONAL_SYSTEMS_ABSENT_LEGACY_NOT_REDESIGNED'); const actualIds = new Set((b.freeMountPlan?.entries ?? []).map(e => e.id)); if (loads.some(l => !actualIds.has(l.id)))
    throw Error('EXTERNAL_TARGET_NOT_INSTALLED'); return evaluateSystemPlan(b.functionalSystems, state, loads, seconds); }
export function advanceSystemState(plan: FunctionalSystemPlan, state: SystemInstanceState, seconds: number, loads: ExternalSystemLoad[] = []) { const result = evaluateSystemPlan(plan, state, loads, seconds), next = structuredClone(state); for (const e of plan.equipment.filter(e => e.type === 'ENERGY_STORAGE'))
    next.storageMJ[e.id] = Math.max(0, Math.min(e.specification.capacity, (state.storageMJ[e.id] ?? e.specification.capacity) + ((result.storageChargeMW[e.id] ?? 0) - (result.storageDispatchMW[e.id] ?? 0)) * seconds)); return { state: next, capabilities: result }; }
export function analyzeSystemRedundancy(plan: FunctionalSystemPlan) { const normal = evaluateSystemPlan(plan), keys = ['commandAvailability', 'propulsionControlAvailability', 'maneuverControlAvailability', 'availableFireControlChannels', 'availableSensorProcessingCapacity'] as const; return plan.equipment.map(e => { const state = createSystemInstanceState(plan); state.equipmentStates[e.id] = 'OFFLINE'; const r = evaluateSystemPlan(plan, state); return { equipmentId: e.id, compartmentId: e.compartmentId, lostFunctions: keys.filter(k => r[k] < normal[k] - 1e-6), remaining: { command: r.commandAvailability, propulsion: r.propulsionControlAvailability, maneuver: r.maneuverControlAvailability }, singlePointOfTotalFailure: keys.filter(k => normal[k] > 0 && r[k] === 0) }; }); }
export function analyzeCompartmentSystemLoss(plan: FunctionalSystemPlan) { return [...new Set(plan.equipment.map(e => e.compartmentId))].map(compartmentId => { const state = createSystemInstanceState(plan); for (const e of plan.equipment.filter(e => e.compartmentId === compartmentId))
    state.equipmentStates[e.id] = 'OFFLINE'; const c = evaluateSystemPlan(plan, state); return { compartmentId, command: c.commandAvailability, propulsion: c.propulsionAuthority, maneuver: c.maneuverAuthority, fireChannels: c.availableFireControlChannels, sensorCapacity: c.availableSensorProcessingCapacity }; }); }
