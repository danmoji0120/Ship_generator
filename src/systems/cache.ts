import type { ShipBlueprint } from '../blueprint/types';
import { interiorInput } from '../interior/build';
import type { FunctionalSystemPlan } from './types';
// One exact-content entry, no hash collision or mutable Blueprint ownership.
// Registry revision and every placement/protection/control input are included.
export const FUNCTIONAL_CACHE_LIMIT_BYTES = 64 * 1024 * 1024;
let entry: {
    key: string;
    plan: string;
} | undefined;
export function functionalInput(b: ShipBlueprint) {
    const key = JSON.stringify([1, interiorInput(b), b.compartmentPlan, b.engines,
        b.exteriorDetailPlan?.kitPlacements.filter(e => e.kit === 'RCS_CLUSTER').map(e => e.id),
        b.physicalDesign?.surfaces.map(s => [s.id, s.kind, s.materialId, s.thicknessMm, s.facets, s.layerStack, s.pieces.map(p => [p.facetIndex, p.layerOrder])]), b.physicalDesign?.geometryModel, b.physicalDesign?.version, b.physicalDesign?.materialRegistryVersion, b.physicalDesign?.approximation, b.physicalDesign?.warnings,
        b.physicalDesign?.mass.unresolvedMassEstimateKg]);
    return entry?.key === key ? entry.key : key;
}
export function cachedFunctionalPlan(key: string): FunctionalSystemPlan | undefined {
    return entry?.key === key ? JSON.parse(entry.plan) : undefined;
}
export function storeFunctionalPlan(key: string, plan: FunctionalSystemPlan) { const text = JSON.stringify(plan); entry = 2 * (key.length + text.length) <= FUNCTIONAL_CACHE_LIMIT_BYTES ? { key, plan: text } : undefined; }
export const clearFunctionalPlanCache = () => { entry = undefined; };
export const functionalPlanCacheBytes = () => entry ? 2 * (entry.key.length + entry.plan.length) : 0;
