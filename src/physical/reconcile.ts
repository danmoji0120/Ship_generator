/** Mass ownership, not a target-matching correction. Unknown scope is never deducted. */
export interface OwnedMass {
    id: string;
    massKg: number;
    ownerRefs: string[];
}
export interface EstimatedMass extends OwnedMass {
    scope: 'ITEMIZED' | 'UNKNOWN_LEGACY';
}
export function reconcileOwnedMass(actual: OwnedMass[], estimates: EstimatedMass[]) {
    const owners = new Set<string>();
    const itemIds=new Set<string>(),estimatedOwners=new Set<string>();
    for(const item of [...actual,...estimates]){
        if(!item.id||itemIds.has(item.id)||item.ownerRefs.some(r=>!r))throw Error('INVALID_OR_DUPLICATE_MASS_SOURCE');
        itemIds.add(item.id);
    }
    for(const item of estimates)for(const ref of item.ownerRefs){
        if(estimatedOwners.has(ref))throw Error('DUPLICATE_ESTIMATED_MASS_OWNER '+ref);
        estimatedOwners.add(ref);
    }
    for (const item of [...actual, ...estimates])
        if (!Number.isFinite(item.massKg) || item.massKg < 0 || new Set(item.ownerRefs).size !== item.ownerRefs.length)
            throw Error('INVALID_MASS_PROVENANCE');
    for (const item of actual)
        for (const ref of item.ownerRefs) {
            if (owners.has(ref))
                throw Error('DUPLICATE_ACTUAL_MASS_OWNER ' + ref);
            owners.add(ref);
        }
    const replacements: {
        estimateId: string;
        actualIds: string[];
        retiredKg: number;
    }[] = [];
    const remaining = estimates.map(e => {
        const overlap = e.ownerRefs.filter(r => owners.has(r));
        // Partial aggregate scopes cannot be apportioned without an itemized formula.
        if (e.scope === 'ITEMIZED' && e.ownerRefs.length && overlap.length === e.ownerRefs.length) {
            replacements.push({ estimateId: e.id, actualIds: actual.filter(a => a.ownerRefs.some(r => e.ownerRefs.includes(r))).map(a => a.id), retiredKg: e.massKg });
            return { ...e, massKg: 0 };
        }
        if (overlap.length)
            throw Error('PARTIAL_OR_UNKNOWN_MASS_OWNER_OVERLAP ' + e.id);
        return { ...e };
    });
    return { actualKg: actual.reduce((n, e) => n + e.massKg, 0), remainingEstimatedKg: remaining.reduce((n, e) => n + e.massKg, 0), remaining, replacements };
}
