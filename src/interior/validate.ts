import {timedPhysical,recordPhysicalStage} from '../physical/diagnostics';
import {connectedVoidCells} from './connectivity';
import type { ShipBlueprint } from '../blueprint/types';
import type { CompartmentPlan } from './types';
import { signature,interiorInput,updateInteriorSpaceAccounting } from './build';
import { context, releaseInteriorContext, emptyVolume, carve, inside, polygonPrism, exteriorAudit, polygonSlice, characteristicWidth,clipPolygonToCell,paddedBounds } from './geometry';
import { physicalSources } from '../physical/geometry';
import { solidCell, cellVolume, planes, subtractCell, intersectCells, cellBounds } from '../physical/convex';
import { closureResidual, structuralMaterialVolume } from '../structure/geometry';
import { HULL_MATERIALS } from '../physical/materials';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import { boundsOf, dot } from '../generation/integration/contours';
import { area } from '../generation/armor/panels';
import { analyzeInterior } from './graph';
import type { PanelSolid } from '../generation/armor/types';
let lastSuccessfulKey:string|undefined;
export const clearInteriorValidationCache=()=>{lastSuccessfulKey=undefined;};
export const interiorValidationCacheBytes=()=>lastSuccessfulKey?lastSuccessfulKey.length*2:0;
const cache = new WeakMap<CompartmentPlan, {
    key: string;
    issues: string[];
}>();
const close = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-7);
/** Stored geometry is independently checked; graph success flags never bypass geometry. */
export function validateCompartmentPlan(b:ShipBlueprint):string[]{return timedPhysical('Interior geometry validation',()=>checkCompartmentPlan(b));}
function checkCompartmentPlan(b: ShipBlueprint): string[] {
    const p = b.compartmentPlan;
    if (!p)
        return ['1.8.6.2','1.8.6.2.1'].includes(b.generatorVersion) ? ['Required compartment plan absent'] : [];
    const input=interiorInput(b), sourceSignature = signature(input), key = JSON.stringify([p,b.physicalDesign?.mass.actualBulkheadMassKg,b.physicalDesign?.mass.actualClosureMassKg]) + input, found = cache.get(p);
    if (found?.key === key){releaseInteriorContext(b);return [...found.issues];}
    if(lastSuccessfulKey===key){releaseInteriorContext(b);recordPhysicalStage('Interior validation cache hit',0);return [];}
    const issues: string[] = [];
    try {
        if (p.schemaVersion !== 1 || !['1.8.6.2','1.8.6.2.1'].includes(p.version) || p.version!==b.generatorVersion || p.architecture !== b.architecture.grammar || p.sourceSignature !== sourceSignature)
            throw Error('Interior source/version/geometry signature differs');
        for (const list of [p.compartments, p.bulkheads, p.boundaries, p.openings])
            if (new Set(list.map(x => x.id)).size !== list.length)
                throw Error('Interior IDs duplicated');
        const ctx = context(b,undefined,input), refs = new Set(ctx.inventory.map(r => r.id));
        if (JSON.stringify(ctx.inventory) !== JSON.stringify(p.occupancy))
            throw Error('Interior occupancy inventory differs');
        const sources = physicalSources(b).filter(s => s.kind === 'HULL'), host = new Map(sources.map(s => [s.parent, s.cells.map(c => c.cell)]));
        const exterior = new Map(sources.filter(s => s.cells.length && !s.approximation).map(s => [s.parent, exteriorAudit(s, sources, ctx)]));
        const volume = (pieces: PanelSolid[]) => { let v = 0; for (const s of pieces) {
            if (!s.indices.length || s.indices.length % 3 || s.indices.some(k => !Number.isInteger(k) || k < 0 || k >= s.vertices.length) || s.vertices.some(v => !Object.values(v).every(Number.isFinite)))
                throw Error('Invalid interior finite geometry');
            const c = solidCell(s), residual = closureResidual(s);
            if (residual.openAreaVectorM2 > Math.max(1e-9, residual.surfaceAreaM2 * 1e-11))
                throw Error('Interior material cell is not closed');
            if (planes(c).some(n => s.vertices.some(v => dot(n.n, v) > n.d + 1e-5)))
                throw Error('Nonconvex interior finite cell');
            const a = structuralMaterialVolume(s);
            if (!(a > 0))
                throw Error('Nonpositive interior material cell');
            v += a;
        } return v; };
        for (const c of p.compartments) {
            if(b.structuralVolumes.find(v=>v.id===c.parentStructuralVolumeRef)?.purpose==='armor')throw Error('Room inside armor-purpose reinforcement stock');
            const authority = host.get(c.parentStructuralVolumeRef);
            if (!authority?.length || c.volumeM3 <= 0 || !c.physicalVolume.domains.length || c.physicalVolume.model !== 'FINITE_CONNECTED_CSG_COMPONENT')
                throw Error('Interior compartment has no closed Hull authority ' + c.id);
            if (c.physicalVolume.occupiedRefs.some(id => !refs.has(id)))
                throw Error('Unknown compartment occupancy reference');
            if(!close(volume(c.physicalVolume.domains),c.domainVolumeM3))throw Error('Invalid finite candidate domain geometry/volume');
            const ds = c.physicalVolume.domains.map(solidCell);
            for (const d of ds) {
                let outside = [d];
                for (const h of authority)
                    outside = outside.flatMap(c => subtractCell(c, h));
                if (outside.reduce((n, c) => n + cellVolume(c), 0) > 1e-5)
                    throw Error('Compartment outside Hull ' + c.id);
            }
            const recomputed = emptyVolume(ds, ctx);
            if (!close(recomputed.volumeM3-c.extractionAudit.unresolvedVoidVolumeM3, c.volumeM3) || !close(recomputed.domainVolumeM3, c.domainVolumeM3) || !close(recomputed.occupiedVolumeM3, c.occupiedVolumeM3) || JSON.stringify(recomputed.refs) !== JSON.stringify(c.physicalVolume.occupiedRefs))
                throw Error('Compartment CSG volume/occupancy differs ' + c.id);
            const connected=c.physicalVolume.connectedCells.map(solidCell);if(!close(volume(c.physicalVolume.connectedCells),c.volumeM3)||connectedVoidCells(connected).filter(g=>g.volumeM3>1e-6).length!==1)throw Error('Compartment void has no unique finite connected component');
            for(const cell of connected){let outside=[cell];for(const source of ds)outside=outside.flatMap(c=>subtractCell(c,source));if(outside.reduce((n,c)=>n+cellVolume(c),0)>1e-5)throw Error('Connected void outside source domain');}
            if(emptyVolume(connected,ctx).occupiedVolumeM3>Math.max(1e-6,c.volumeM3*1e-10))throw Error('Connected void occupies existing solid material');
            const audit = exterior.get(c.parentStructuralVolumeRef);
            if (!audit)
                throw Error('Compartment Hull boundary unresolved');
            const nearVoid=boundsIndex(connected.map(cell=>({cell,bounds:paddedBounds(cell.faces.flat())})));
            const gaps = audit.gaps.map(poly => polygonSlice(poly, c.partitionAxis, ...c.partitionRange)).filter(poly => poly.length >= 3 && area(poly) > 1e-6).flatMap(poly=>nearVoid(paddedBounds(poly)).map(item=>clipPolygonToCell(poly,item.cell)).filter(poly=>poly.length>=3&&area(poly)>1e-6)), macroscopic = gaps.filter(poly => characteristicWidth(poly) > 1e-5);
            if (macroscopic.length && !p.openings.some(o => o.type === 'EXTERIOR_OPENING' && o.fromCompartmentId === c.id))
                throw Error('Exterior opening omitted from pressure graph');
            if (gaps.length && !macroscopic.length && c.boundaryCertainty !== 'UNRESOLVED')
                throw Error('Numerically unresolved boundary falsely certified');
            if (c.pressureCapability === 'PRESSURIZABLE' && (c.boundaryCertainty !== 'FINITE_MATERIAL_CLOSURE' || c.unresolvedBoundaryReasons.length || p.openings.some(o => o.type === 'EXTERIOR_OPENING' && o.fromCompartmentId === c.id)))
                throw Error('Unresolved/open boundary cannot be certified pressurizable');
            if (c.structuralFrameReferences.some(id => !b.structuralFrame?.members.some(m => m.id === id)) || c.hullShellReferences.some(id => !b.physicalDesign?.surfaces.some(s => s.kind === 'HULL' && s.id === id)))
                throw Error('Interior structure/skin reference invalid');
        }
        // Domain overlap implies empty-space double counting even before solid subtraction.
        const recoveredParents=new Set(p.compartments.filter(c=>c.recoveryOf).map(c=>c.recoveryOf));
        const domains = p.compartments.flatMap(c => (c.recoveryOf||recoveredParents.has(c.id)?c.physicalVolume.connectedCells:c.physicalVolume.domains).map((s,i) => ({ id: c.id, cell: solidCell(s), bounds: boundsOf(s.vertices) }))).map((d,i)=>({...d,i})), nearDomains = boundsIndex(domains);
        let overlap = 0;
        for (let i = 0; i < domains.length; i++)
            for (const d of nearDomains(domains[i].bounds)) {
                if (d.i <= i)
                    continue;
                const hit = intersectCells(domains[i].cell, d.cell);
                if (hit)
                    overlap += cellVolume(hit);
            }
        if (overlap > 1e-5)
            throw Error('Compartment domains overlap');
        const compartments = new Map(p.compartments.map(c => [c.id, c])), boundaries = new Map(p.boundaries.map(w => [w.id, w])), openings = new Map(p.openings.map(o => [o.id, o]));
        for(const boundary of p.boundaries)if(boundary.compartmentIds.length!==2||!compartments.has(boundary.compartmentIds[0])||boundary.compartmentIds[1]!=='EXTERIOR'&&!compartments.has(boundary.compartmentIds[1]))throw Error('Boundary refers to an absent compartment');
        for (const w of p.bulkheads) {
            const boundary = boundaries.get(w.boundaryReference), material = HULL_MATERIALS[w.materialId];
            if (!boundary || boundary.bulkheadRef !== w.id || boundary.kind !== 'BULKHEAD' || JSON.stringify(boundary.compartmentIds) !== JSON.stringify(w.adjacentCompartmentIds) || !material || !(w.thicknessMm > 0) || !w.pieces.length)
                throw Error('Invalid bulkhead boundary/material');
            if(w.pressureTight!==w.openingIds.every(id=>{const o=openings.get(id);return !!o?.closure&&o.pressureSealingCapability;}))throw Error('Bulkhead seal capability differs from actual closure hardware');
            const v = volume(w.pieces);
            if (!close(v, w.volumeM3) || !close(v * material.densityKgM3, w.massKg))
                throw Error('Bulkhead volume/density/mass mismatch');
            const slabs = w.stockEnvelope.map(solidCell), aperture = w.openingIds.flatMap(id => openings.get(id)?.aperture.map(solidCell) ?? []), free = emptyVolume(slabs, ctx), apertureVolume = aperture.reduce((n, c) => n + cellVolume(c), 0);
            if (!close(free.volumeM3 - apertureVolume, w.volumeM3))
                throw Error('Bulkhead does not fill real section boundary ' + w.id);
            for (const s of w.pieces) {
                let outside = [solidCell(s)];
                for (const slab of slabs)
                    outside = outside.flatMap(c => subtractCell(c, slab));
                if (outside.reduce((n, c) => n + cellVolume(c), 0) > 1e-6)
                    throw Error('Bulkhead outside real boundary');
                for (const a of aperture) {
                    const hit = intersectCells(solidCell(s), a);
                    if (hit && cellVolume(hit) > 1e-7)
                        throw Error('Solid bulkhead blocks its aperture');
                }
            }
            if (w.structuralAttachmentRefs.some(id => !b.structuralFrame?.members.some(m => m.id === id)))
                throw Error('Invalid bulkhead support');
        }
        for (const o of p.openings) {
            const boundary = boundaries.get(o.boundaryReference);
            if (!boundary || !boundary.openingRefs.includes(o.id) || !boundary.compartmentIds.includes(o.fromCompartmentId) || !boundary.compartmentIds.includes(o.toCompartmentId) || !o.aperture.length || !(o.apertureAreaM2 > 0) || !close(o.apertureAreaM2, o.aperturePolygons.reduce((n, p) => n + area(p), 0)))
                throw Error('Opening has no real boundary/aperture');
            if (o.defaultState !== 'OPEN' && !o.closure)
                throw Error('Closed opening has no physical closure');
            if (o.defaultState === 'SEALED' && !o.pressureSealingCapability)
                throw Error('SEALED opening lacks sealing capability');
            if (o.closure) {
                const m = HULL_MATERIALS[o.closure.materialId], v = volume(o.closure.pieces), av = o.aperture.reduce((n, s) => n + cellVolume(solidCell(s)), 0);
                if (!m || o.closure.thicknessMm <= 0 || !close(v, o.closure.volumeM3) || !close(v * m.densityKgM3, o.closure.massKg) || !close(v, av))
                    throw Error('Invalid closure material/volume/mass');
                for (const s of o.closure.pieces) {
                    let remaining = [solidCell(s)];
                    for (const a of o.aperture)
                        remaining = remaining.flatMap(c => subtractCell(c, solidCell(a)));
                    if (remaining.reduce((n, c) => n + cellVolume(c), 0) > 1e-6)
                        throw Error('Closure not contained in aperture');
                }
            }
            if(boundary.kind==='BULKHEAD'){const wall=p.bulkheads.find(w=>w.id===boundary.bulkheadRef)!;for(const aperture of o.aperture){const cell=solidCell(aperture);let outside=[cell];for(const host of wall.stockEnvelope)outside=outside.flatMap(c=>subtractCell(c,solidCell(host)));if(outside.reduce((n,c)=>n+cellVolume(c),0)>1e-7)throw Error('Aperture outside actual bulkhead');for(const item of ctx.near(boundsOf(aperture.vertices)))for(const solid of ctx.cells(item)){const intersection=intersectCells(cell,solid);if(intersection&&cellVolume(intersection)>1e-7)throw Error('Portal blocked by existing solid stock');}}}
            if (o.type === 'EXTERIOR_OPENING' && (o.toCompartmentId !== 'EXTERIOR' || o.defaultState !== 'OPEN'))
                throw Error('Invalid exterior opening');
        }
        const expectedEdges = p.openings.map(o => ({ id: `edge/${o.id}`, from: o.fromCompartmentId, to: o.toCompartmentId, boundaryRef: o.boundaryReference, openingRef: o.id }));
        if (JSON.stringify(expectedEdges) !== JSON.stringify(p.accessGraph) || JSON.stringify(expectedEdges) !== JSON.stringify(p.pressureGraphDefinition))
            throw Error('Virtual interior graph edge has no actual opening');
        const expectedAdj = p.boundaries.filter(w => w.compartmentIds[1] !== 'EXTERIOR').map(w => ({ from: w.compartmentIds[0], to: w.compartmentIds[1], boundaryRef: w.id }));
        if (JSON.stringify(expectedAdj) !== JSON.stringify(p.adjacency))
            throw Error('Virtual compartment adjacency');
        for (const c of p.compartments) {
            const boundaryRefs = p.boundaries.filter(w => w.compartmentIds.includes(c.id)).map(w => w.id);
            if ([...c.boundaryReferences].sort().join() != boundaryRefs.sort().join())
                throw Error('Compartment boundary references differ');
        }
        if (!close(p.spatialAccounting.compartmentVoidM3, p.compartments.reduce((n, c) => n + c.volumeM3, 0)))
            throw Error('Interior space allocation differs');
        if(p.version==='1.8.6.2.1'){
         const derived={...p};updateInteriorSpaceAccounting(derived);
         if(JSON.stringify(derived.volumeAudit)!==JSON.stringify(p.volumeAudit))throw Error('Interior category volume audit differs');
         const audit=p.volumeAudit!;if(Math.abs(audit.conservationErrorM3)>Math.max(1e-5,audit.candidateDomainM3*1e-7)||Math.abs(audit.validInteriorM3-audit.assignedM3-audit.usableResidualM3-audit.nonallocatableM3)>1e-5)throw Error('Interior category conservation failed');
         const parentVoidNear=new Map(p.compartments.map(c=>[c.id,boundsIndex(c.physicalVolume.connectedCells.map(s=>({cell:solidCell(s),bounds:boundsOf(s.vertices)})))]));
         const residualCells=p.unresolvedVoidPockets.flatMap(r=>(r.cells??[]).map(s=>({r,cell:solidCell(s),bounds:boundsOf(s.vertices)}))).map((x,i)=>({...x,i})),nearResidual=boundsIndex(residualCells);
         for(const item of residualCells){const parent=compartments.get(item.r.candidateCompartmentId);if(!parent)throw Error('Residual parent absent');let outside=[item.cell];for(const s of parent.physicalVolume.domains)outside=outside.flatMap(c=>subtractCell(c,solidCell(s)));if(outside.reduce((n,c)=>n+cellVolume(c),0)>1e-6)throw Error('Residual outside actual candidate domain');
          for(const s of parentVoidNear.get(parent.id)!(item.bounds)){const hit=intersectCells(item.cell,s.cell);if(hit&&cellVolume(hit)>1e-6)throw Error('Assigned and residual space overlap');}
          for(const other of nearResidual(item.bounds))if(other.i<item.i){const hit=intersectCells(item.cell,other.cell);if(hit&&cellVolume(hit)>1e-6)throw Error('Residual categories overlap');}
         }
         for(const r of p.unresolvedVoidPockets){if(r.cells){if(!close(volume(r.cells),r.volumeM3))throw Error('Residual finite volume differs');const cells=r.cells.map(solidCell);if(connectedVoidCells(cells).filter(g=>g.volumeM3>1e-6).length>1)throw Error('Residual component is disconnected');if(emptyVolume(cells,ctx).occupiedVolumeM3>Math.max(1e-6,r.volumeM3*1e-7))throw Error('Residual intersects actual solid stock');}if(r.classification==='ASSIGNED_RECOVERED'&&!p.compartments.some(c=>c.id===r.recoveredCompartmentId&&c.recoveryOf===r.candidateCompartmentId&&close(c.volumeM3,r.volumeM3)))throw Error('Recovered void reference invalid');}

        }
        const mass = p.massAccounting, bv = p.bulkheads.reduce((n, w) => n + w.massKg, 0), dv = p.openings.reduce((n, o) => n + (o.closure?.massKg ?? 0), 0);
        if (!close(bv, mass.bulkheadMassKg) || !close(dv, mass.closureMassKg) || !close(bv, b.physicalDesign!.mass.actualBulkheadMassKg!) || !close(dv, b.physicalDesign!.mass.actualClosureMassKg!))
            throw Error('Interior mass ledger differs');
        const allMaterial = [...p.bulkheads.flatMap(w => w.pieces), ...p.openings.flatMap(o => o.closure?.pieces ?? [])].map((s, i) => ({ i, cell: solidCell(s), bounds: boundsOf(s.vertices) })), near = boundsIndex(allMaterial);
        let materialOverlap = 0;
        for (const piece of allMaterial) {
            for (const old of ctx.near(piece.bounds))
                for (const cell of ctx.cells(old)) {
                    const hit = intersectCells(piece.cell, cell);
                    if (hit)
                        materialOverlap += cellVolume(hit);
                }
            for (const other of near(piece.bounds))
                if (other.i < piece.i) {
                    const hit = intersectCells(piece.cell, other.cell);
                    if (hit)
                        materialOverlap += cellVolume(hit);
                }
        }
        if (materialOverlap > 1e-5)
            throw Error('Bulkhead/closure material double counted against existing stock or itself');
        if (JSON.stringify(analyzeInterior(p)) !== JSON.stringify(p.analysis))
            throw Error('Interior isolation analysis differs');
    }
    catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
    }
    releaseInteriorContext(b);
    if(!issues.length)lastSuccessfulKey=key;
    cache.set(p, { key, issues: [...issues] });
    return issues;
}
