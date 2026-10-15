import type { StructuralNode, StructuralEdge, ConnectivityAnalysis, StructuralFramePlan, StructuralInstanceState } from './types';
/** Undirected multigraph: parent EDGE, not parent node, handles real parallel members correctly. */
export function analyzeConnectivity(nodes: StructuralNode[], edges: StructuralEdge[], roots: string[], volumes: {
    volumeId: string;
    nodeIds: string[];
}[]): ConnectivityAnalysis {
    const adj = new Map(nodes.map(n => [n.id, [] as {
            node: string;
            edge: string;
        }[]]));
    for (const e of edges) {
        const [a, b] = e.nodeIds;
        if (!adj.has(a) || !adj.has(b))
            throw Error('STRUCTURAL_EDGE_NODE_MISSING ' + e.id);
        if (a === b)
            continue;
        adj.get(a)!.push({ node: b, edge: e.id });
        adj.get(b)!.push({ node: a, edge: e.id });
    }
    const discovery = new Map<string, number>(), low = new Map<string, number>(), bridges: string[] = [], articulation = new Set<string>(), components: string[][] = [], componentByNode: Record<string, number> = {};
    let tick = 0;
    function visit(id: string, parentEdge?: string) {
        discovery.set(id, ++tick);
        low.set(id, tick);
        let children = 0;
        const component = components.length - 1;
        componentByNode[id] = component;
        components[component].push(id);
        for (const link of adj.get(id)!) {
            if (link.edge === parentEdge)
                continue;
            if (!discovery.has(link.node)) {
                children++;
                visit(link.node, link.edge);
                low.set(id, Math.min(low.get(id)!, low.get(link.node)!));
                if (low.get(link.node)! > discovery.get(id)!)
                    bridges.push(link.edge);
                if (parentEdge && low.get(link.node)! >= discovery.get(id)!)
                    articulation.add(id);
            }
            else
                low.set(id, Math.min(low.get(id)!, discovery.get(link.node)!));
        }
        if (!parentEdge && children > 1)
            articulation.add(id);
    }
    for (const n of nodes)
        if (!discovery.has(n.id)) {
            components.push([]);
            visit(n.id);
        }
    const primary = roots.map(id => componentByNode[id]).sort((a, b) => (components[b]?.length ?? 0) - (components[a]?.length ?? 0))[0], volumeComponents = Object.fromEntries(volumes.map(v => [v.volumeId, [...new Set(v.nodeIds.filter(id => id in componentByNode).map(id => componentByNode[id]))].sort((a, b) => a - b)]));
    return { components, componentByNode, bridges: bridges.sort(), articulationPoints: [...articulation].sort(), cycleRank: edges.filter(e => e.nodeIds[0] !== e.nodeIds[1]).length - nodes.length + components.length, roots: [...roots], unreachableVolumeIds: volumes.filter(v => !volumeComponents[v.volumeId].length || volumeComponents[v.volumeId].every(c => c !== primary)).map(v => v.volumeId), volumeComponents, ...(volumes.some(v => volumeComponents[v.volumeId].includes(primary) && volumeComponents[v.volumeId].some(c => c !== primary)) ? { partiallyDisconnectedVolumeIds: volumes.filter(v => volumeComponents[v.volumeId].includes(primary) && volumeComponents[v.volumeId].some(c => c !== primary)).map(v => v.volumeId) } : {}) };
}
export function analyzeStructuralInstance(plan: StructuralFramePlan, state: StructuralInstanceState) { const inactiveJoints = new Set(state.disabledJointIds), inactiveMembers = new Set(state.disabledMemberIds), inactiveEdges = new Set(state.disabledEdgeIds); return analyzeConnectivity(plan.nodes, plan.edges.filter(e => !inactiveEdges.has(e.id) && !inactiveMembers.has(e.physicalMemberRef) && !e.jointRefs.some(id => inactiveJoints.has(id))), plan.roots, plan.volumeFrames); }
