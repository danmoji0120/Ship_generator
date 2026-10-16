import type { CompartmentPlan, InteriorInstanceState, IsolationAnalysis } from './types';
import { createInteriorInstanceState } from './types';
/** Pure topology over actual boundary/portal references. Instance assumptions never mutate design. */
export function analyzeInterior(p: CompartmentPlan, state: InteriorInstanceState = createInteriorInstanceState()): IsolationAnalysis {
    const ids = p.compartments.map(c => c.id), known = new Set([...ids, 'EXTERIOR']), openings = new Map(p.openings.map(o => [o.id, o])), walls = new Map(p.bulkheads.map(w => [w.id, w]));
    for (const [id, value] of Object.entries(state.openingStates))
        if (!openings.has(id) || !['OPEN', 'CLOSED', 'SEALED', 'BLOCKED'].includes(value))
            throw Error('INVALID_INTERIOR_INSTANCE_OPENING ' + id);
    for (const id of state.disabledBulkheadIds)
        if (!walls.has(id))
            throw Error('INVALID_INTERIOR_INSTANCE_BULKHEAD ' + id);
    for (const o of p.openings) {
        const value = state.openingStates[o.id] ?? o.defaultState;
        if (value !== 'OPEN' && (!o.closure||!o.closure.pieces.length||o.closure.volumeM3<=0))
            throw Error('CLOSED_PORTAL_WITHOUT_PHYSICAL_CLOSURE ' + o.id);
        if (value === 'SEALED' && !o.pressureSealingCapability)
            throw Error('SEALED_PORTAL_WITHOUT_SEAL_CAPABILITY ' + o.id);
    }
    const access = new Map(ids.map(id => [id, [] as string[]])), pressure = new Map([...ids, 'EXTERIOR'].map(id => [id, [] as string[]]));
    const edge = (map: Map<string, string[]>, a: string, b: string) => { if (!known.has(a) || !known.has(b))
        throw Error('INVALID_INTERIOR_GRAPH_NODE'); if (map.has(a) && map.has(b)) {
        map.get(a)!.push(b);
        map.get(b)!.push(a);
    } };
    for (const o of p.openings) {
        const s = state.openingStates[o.id] ?? o.defaultState;
        if (s === 'OPEN') {
            edge(access, o.fromCompartmentId, o.toCompartmentId);
            edge(pressure, o.fromCompartmentId, o.toCompartmentId);
        }
    }
    for (const id of state.disabledBulkheadIds) {
        const w = walls.get(id)!;
        edge(access, ...w.adjacentCompartmentIds);
        edge(pressure, ...w.adjacentCompartmentIds);
    }
    for (const breach of state.hypotheticalHullBreaches) {
        const c = p.compartments.find(c => c.id === breach.compartmentId);
        if (!c || !Number.isInteger(breach.exteriorPatchIndex) || !c.exteriorPatches[breach.exteriorPatchIndex])
            throw Error('INVALID_HYPOTHETICAL_HULL_BOUNDARY');
        edge(pressure, c.id, 'EXTERIOR');
    }
    const groups = (map: Map<string, string[]>) => { const seen = new Set<string>(), out: string[][] = []; for (const id of map.keys()) {
        if (seen.has(id))
            continue;
        const todo = [id], group: string[] = [];
        seen.add(id);
        for (let i = 0; i < todo.length; i++) {
            const a = todo[i];
            group.push(a);
            for (const b of map.get(a)!)
                if (!seen.has(b)) {
                    seen.add(b);
                    todo.push(b);
                }
        }
        out.push(group.sort());
    } return out; };
    const pressureGroups = groups(pressure), exposed = pressureGroups.find(g => g.includes('EXTERIOR'))!.filter(id => id !== 'EXTERIOR'), exposedSet = new Set(exposed), paths: Record<string, string[]> = {}, queue = ['EXTERIOR'], from = new Map<string, string>();
    from.set('EXTERIOR', '');
    for (let i = 0; i < queue.length; i++)
        for (const b of pressure.get(queue[i])!)
            if (!from.has(b)) {
                from.set(b, queue[i]);
                queue.push(b);
            }
    for (const id of exposed) {
        const path = [id];
        let at = id;
        while (at !== 'EXTERIOR') {
            at = from.get(at)!;
            path.push(at);
        }
        paths[id] = path;
    }
    const total = p.compartments.reduce((n, c) => n + c.volumeM3, 0), exposedVolume = p.compartments.filter(c => exposedSet.has(c.id)).reduce((n, c) => n + c.volumeM3, 0), uncertain = p.compartments.filter(c => c.boundaryCertainty === 'UNRESOLVED').map(c => c.id);
    for (const o of p.openings)
        if ((state.openingStates[o.id] ?? o.defaultState) === 'BLOCKED' || (state.openingStates[o.id] ?? o.defaultState) === 'CLOSED' && !o.pressureSealingCapability)
            uncertain.push(o.fromCompartmentId, ...(o.toCompartmentId === 'EXTERIOR' ? [] : [o.toCompartmentId]));
    return { accessGroups: groups(access), pressureGroups, exteriorConnectedCompartmentIds: exposed, exteriorPaths: paths, isolatedGroups: pressureGroups.filter(g => !g.includes('EXTERIOR')), exposedVolumeM3: exposedVolume, exposureRatio: total ? exposedVolume / total : 0, uncertainCompartmentIds: [...new Set(uncertain)], warnings: ['Design capability and finite portal topology only; no gas/pressure/damage simulation.', ...(uncertain.length ? ['Unresolved boundary/seal capability is not certified airtight.'] : [])] };
}
