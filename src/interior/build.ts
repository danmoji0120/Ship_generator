import {classifyVoidComponents,recoverVoidCompartment} from './volume';
import {connectedVoidCells} from './connectivity';
import type { ShipBlueprint, Vec3 } from '../blueprint/types';
import type { ConvexCell } from '../physical/types';
import type { CompartmentPlan, InteriorCompartment, Bulkhead, InteriorOpening } from './types';
import { physicalSources } from '../physical/geometry';
import { HULL_MATERIALS } from '../physical/materials';
import { procurementWeights } from '../procurement/order';
import { timedPhysical, recordPhysicalStage } from '../physical/diagnostics';
import { refreshPhysicalMass } from '../physical/policy';
import { planes, cellBounds, cellVolume, solidCell, subtractCell, subtractPolygon, intersectCells, clipCell, faceNormal } from '../physical/convex';
import { area } from '../generation/armor/panels';
import { add, mul, dot, center, boundsOf, basis } from '../generation/integration/contours';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import { analyzeInterior } from './graph';
import { context, emptyVolume, carve, slice, polygonSlice, freePolygon, clipPolygonToCell, polygonPrism, axisVector, storedSolid, cellCentroid, inside, paddedBounds, exteriorAudit, characteristicWidth } from './geometry';
let cached: {
    key: string;
    plan: string;
} | undefined;
export const clearInteriorCache = () => { cached = undefined; };
export const interiorCacheBytes = () => cached ? 2 * (cached.key.length + cached.plan.length) : 0;
const legacyInteriorInput = (b: ShipBlueprint) => JSON.stringify([2, b.structuralFrame, b.physicalDesign?.surfaces, b.procurement?.order, b.structuralVolumes, b.prefabPlacements?.map(p => [p.id, p.assembly?.parts.map(p => [p.id, p.solid])])]);
export const interiorInput=(b:ShipBlueprint)=>!['1.8.6.2.1','1.8.6.3','1.8.6.3.1','1.8.6.5.1'].includes(b.generatorVersion)?legacyInteriorInput(b):JSON.stringify([3,b.schemaVersion,'1.8.6.2.1',b.architecture.grammar,b.order.length,b.structuralFrame?.members.map(m=>[m.id,m.hostIds,m.envelope]),b.structuralFrame?.volumeFrames,b.physicalDesign?.surfaces.map(s=>[s.id,s.kind,s.materialId,s.geometryReference.parentStructureId,s.pieces.map(p=>p.solid)]),b.procurement?.order,b.structuralVolumes,b.prefabPlacements?.map(p=>[p.id,p.assembly?.parts.map(p=>[p.id,p.solid])])]);
export function signature(text: string) { let a = 2166136261, b = 2246822507; for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 3266489909);
} return `INTERIOR_1/${text.length}/${(a >>> 0).toString(16)}/${(b >>> 0).toString(16)}`; }
export const interiorSignature = (b: ShipBlueprint) => signature(interiorInput(b));
function policy(b: ShipBlueprint) { const w = procurementWeights(b.procurement!.order), tech = b.procurement!.order.availableTechLevel ?? ({ aegis: 4, vesper: 4, forge: 3, serein: 5 }[b.shipyardId] ?? 3), allowed = Object.values(HULL_MATERIALS).filter(m => m.requiredTechLevel <= tech); const material = w.MOBILITY >= 70 ? 'LIGHT_STRUCTURAL_ALLOY' : w.ECONOMY >= 70 ? allowed.sort((a, b) => a.densityKgM3 * a.manufacturingCostIndex - b.densityKgM3 * b.manufacturingCostIndex)[0].materialId : w.ENDURANCE >= 70 && tech >= 2 ? 'TITANIUM_STRUCTURAL_ALLOY' : 'HIGH_STRENGTH_STRUCTURAL_STEEL'; return { primary: b.procurement!.order.primaryPriority, materialId: material as keyof typeof HULL_MATERIALS, thicknessMm: Math.min(180, Math.max(8, (12 + b.order.length * .035) * (1 + w.ARMOR * .012 - w.MOBILITY * .003 - w.ECONOMY * .001))), maxPartitions: w.ENDURANCE >= 70 ? 6 : w.ARMOR >= 70 ? 4 : w.MOBILITY >= 70 || w.ECONOMY >= 70 ? 2 : 3, sealing: w.ENDURANCE >= 70 ? 'ISOLATED' as const : w.MOBILITY >= 70 || w.ECONOMY >= 70 ? 'OPEN_PASSAGES' as const : 'MIXED' as const, reason: ['Finite available space, actual frame stations and native four-priority policy.', 'Endurance uses real sealed leaves and measured boundary-failure isolation, not an armor bonus.', 'Economy standard apertures and fewer partitions reduce material and process cost.'] }; }
function grammar(b: ShipBlueprint, type: string) { const g = b.architecture.grammar; if (g === 'HYBRID')
    return type === 'POD' ? 'HYBRID_POD_LOCAL' : type === 'NACELLE' ? 'HYBRID_NACELLE_LOCAL' : 'HYBRID_HULL_STATIONS'; return { MONOLITHIC: 'CONTINUOUS_STATION_BAYS', BLOCK_ASSEMBLY: 'INDEPENDENT_BLOCK_BAYS', SPINE_AND_MODULES: 'MODULE_ONLY_NO_HOLLOW_SPINE', TRUSS_POD: 'POD_ONLY_NO_TRUSS_ROOMS', TWIN_HULL: 'SEPARATE_HULL_PRESSURE_REGIONS', CORE_AND_NACELLES: 'CORE_AND_NACELLE_LOCAL_NO_SOLID_CONNECTOR_ROOMS', STACKED_BLOCKS: 'STACK_LOCAL_DECKS_AND_HATCHES', HYBRID: 'HYBRID' }[g]; }
/** Exact finite-domain CSG; empty space has no invented material or reactor-room names. */
export function buildCompartmentPlan(b: ShipBlueprint) {
    return timedPhysical('Interior total', () => {
        if (!b.structuralFrame || !b.physicalDesign || !b.procurement)
            throw Error('INTERIOR_REQUIRES_PHYSICAL_FRAME_AND_NATIVE_ORDER');
        const key = interiorInput(b);
        if (cached?.key === key) {
            recordPhysicalStage('Interior cache hit', 0);
            b.compartmentPlan = JSON.parse(cached.plan);
            refreshPhysicalMass(b);
            updateInteriorDerivedData(b);
            return b;
        }
        recordPhysicalStage('Interior cache miss', 0);
        const p: CompartmentPlan = { schemaVersion: 1, version: ['1.8.6.2.1','1.8.6.3','1.8.6.3.1','1.8.6.5.1'].includes(b.generatorVersion)?'1.8.6.2.1':'1.8.6.2', sourceSignature: signature(key), architecture: b.architecture.grammar, compartments: [], boundaries: [], bulkheads: [], openings: [], occupancy: [], unresolvedVoidPockets: [], adjacency: [], accessGraph: [], pressureGraphDefinition: [], exteriorNode: 'EXTERIOR', analysis: null as any, budgetAccounting: null as any, spatialAccounting: { compartmentVoidM3: 0, openBulkheadPortalVoidM3: 0, note: 'Room CSG ends at wall faces. Open bulkhead aperture tubes are separate portal space; free module interface markers are not counted again.' }, regions: [], massAccounting: { bulkheadMassKg: 0, closureMassKg: 0, materialVolumeM3: 0, remainingEstimateTreatment: 'Retain the prior unresolved propulsion/support and primary-frame accounting unchanged; no undocumented bulkhead estimate is deducted.', source: 'GEOMETRY_DERIVED_FINITE_UNION' }, policy: policy(b), approximation: { model: 'FACETED_HULL_CSG', toleranceM: 1e-7, volumeRelativeTolerance: 1e-7, hullModelLimitations: [], sealModel: 'IDEAL_FINITE_CONTACT_NOT_ENGINEERING_CERTIFICATION' }, validationWarnings: [] };
        const ctx = context(b,undefined,key);
        p.occupancy = ctx.inventory;
        const sources = physicalSources(b).filter(s => s.kind === 'HULL'), reservedUnknown=sources.filter(s=>b.structuralVolumes.find(v=>v.id===s.parent)?.purpose==='armor').flatMap(s=>s.cells.map(c=>c.cell)), priorHosts: ConvexCell[] = [], allHosts = sources.flatMap(s => s.cells.map(c => ({ ...c, host: s.id }))), hostNear = boundsIndex(allHosts);
        timedPhysical('Interior extraction and partition', () => {
            for (const host of b.structuralVolumes) {
                const source = sources.find(s => s.parent === host.id), template = grammar(b, host.type);
                if(host.purpose==='armor'){p.regions.push({volumeId:host.id,state:'UNRESOLVED',grammar:template,reason:'Armor-purpose reinforcement stock has no explicit hollow-space contract; no chamber is invented. Existing frame/skin mass is retained; unclassified stock material is not added speculatively.'});continue;}
                if (host.type === 'SPINE' || !source?.cells.length || source.approximation) {
                    p.regions.push({ volumeId: host.id, state: 'UNRESOLVED', grammar: template, reason: host.type === 'SPINE' ? 'SPINE outer shell thickness/material and hollow status unresolved; no pressure chamber inferred' : source?.approximation ?? 'Closed Hull source unavailable' });
                    continue;
                }
                const hostCells = source.cells.map(c => c.cell), knownCandidate=hostCells.flatMap(c=>{let pieces=[c];for(const reserve of reservedUnknown)pieces=pieces.flatMap(p=>subtractCell(p,reserve));return pieces;}),unknownReserveVolume=hostCells.reduce((n,c)=>n+cellVolume(c),0)-knownCandidate.reduce((n,c)=>n+cellVolume(c),0),touchesUnknown=unknownReserveVolume>1e-5,domain = knownCandidate.flatMap(c => { let parts = [c]; for (const old of priorHosts)
                    parts = parts.flatMap(p => subtractCell(p, old)); return parts; });
                priorHosts.push(...hostCells);
                if (!domain.length) {
                    p.regions.push({ volumeId: host.id, state: 'SOLID_OR_EXPOSED', grammar: template, reason: 'Interior envelope already owned by an overlapping Hull; no duplicated space' });
                    continue;
                }
                const bound = boundsOf(domain.flatMap(c => c.faces.flat())), axis = b.architecture.grammar === 'STACKED_BLOCKS' ? 'y' : 'z', lo = bound.min[axis], hi = bound.max[axis], extent = hi - lo, thickness = p.policy.thicknessMm / 1000;
                const frame = b.structuralFrame!.volumeFrames.find(f => f.volumeId === host.id)!;
                let candidates = axis === 'z' ? frame.frameStationZ.filter(z => z > lo + extent * .12 && z < hi - extent * .12) : [lo + extent * .5];
                if (p.policy.sealing === 'ISOLATED' && axis === 'z')
                    candidates.push(...host.geometry.stations.map(s => s.z + host.position.z).filter(z => z > lo + extent * .12 && z < hi - extent * .12));
                if (!candidates.length && extent > 15)
                    candidates = [(lo + hi) / 2];
                candidates = [...new Set(candidates)].sort((a, b) => a - b);
                const count = Math.min(p.policy.maxPartitions - 1, Math.max(0, Math.floor(extent / 12) - 1), candidates.length);
                const cuts = count ? Array.from({ length: count }, (_, i) => candidates[Math.min(candidates.length - 1, Math.floor((i + .5) * candidates.length / count))]) : [];
                // Actual exposed Hull faces, accounting for every other Hull and finite physical material.
                const audit = timedPhysical('Interior exterior boundary audit', () => exteriorAudit(source, sources, ctx)), exposed = audit.patches, gaps = audit.gaps;
                const local: InteriorCompartment[] = [];
                const limits = [lo, ...cuts, hi];
                for (let i = 0; i < limits.length - 1; i++) {
                    const a = limits[i] + (i ? thickness / 2 : 0), z = limits[i + 1] - (i < cuts.length ? thickness / 2 : 0), cells = domain.map(c => slice(c, axis, a, z)).filter((c): c is ConvexCell => !!c), space = timedPhysical('Interior volume accounting', () => emptyVolume(cells, ctx));
                    if (space.volumeM3 < 1e-5) {
                        p.validationWarnings.push(`No usable finite space in ${host.id} bay ${i}`);
                        continue;
                    }
                    const id = `comp/${host.id}/${i}`;
                    const voidCells=timedPhysical('Interior solid exclusion',()=>carve(cells,ctx)),groups=timedPhysical('Interior void connectivity',()=>connectedVoidCells(voidCells)),main=groups[0];
                    if(!main){p.validationWarnings.push('No connected void in '+id);continue;}
                    const connectedSolids:ReturnType<typeof storedSolid>[]=[],failedCells:ConvexCell[]=[];
                    for(const cell of main.cells){try{connectedSolids.push(storedSolid(cell));}catch{failedCells.push(cell);}}
                    const failedVolume=failedCells.reduce((n,c)=>n+cellVolume(c),0);
                    if(failedVolume>Math.max(1e-6,main.volumeM3*1e-10))throw Error('INTERIOR_CONNECTED_GEOMETRY_UNRESOLVED '+id);
                    const connectedCells=connectedSolids.map(solidCell),connectedVolume=connectedCells.reduce((n,c)=>n+cellVolume(c),0),unresolvedVolume=groups.slice(1).reduce((n,g)=>n+g.volumeM3,0)+failedVolume,largeUnresolved=unresolvedVolume>Math.max(1e-6,space.volumeM3*1e-10),voidCentroid=mul(connectedCells.reduce((m,c)=>add(m,mul(cellCentroid(c),cellVolume(c))),{x:0,y:0,z:0}),1/connectedVolume);
                    if(Math.abs(space.volumeM3-connectedVolume-unresolvedVolume)>Math.max(1e-5,space.volumeM3*1e-7))throw Error('INTERIOR_VOID_CONSERVATION_FAILED '+id);
                    const classified=p.version==='1.8.6.2.1'?timedPhysical('Interior residual classification',()=>classifyVoidComponents(groups,axis,[a,z])):undefined;
                    for(const [j,group]of groups.slice(1).entries()){
                     const info=classified?.[j+1];
                     p.unresolvedVoidPockets.push({id:'unresolved/'+id+'/'+j,candidateCompartmentId:id,volumeM3:group.volumeM3,bounds:boundsOf(group.cells.flatMap(c=>c.faces.flat())),reason:info?.reason??'Disconnected finite void component; never shares the main chamber access/pressure node. Sub-resolution geometry is not promoted to a usable room.',...(info?{classification:info.classification==='RECOVERABLE'?'USABLE_RESIDUAL' as const:info.classification as 'USABLE_RESIDUAL'|'NONALLOCATABLE',cells:group.cells.map(storedSolid),...(info.witness?{clearanceWitness:info.witness}:{})}:{})});
                    }
                    if(failedVolume)p.unresolvedVoidPockets.push({id:'unresolved/'+id+'/triangulation',candidateCompartmentId:id,volumeM3:failedVolume,bounds:boundsOf(failedCells.flatMap(c=>c.faces.flat())),reason:'Sub-resolution void boundary triangulation unresolved; not registered as valid chamber geometry.'});
                    const nearVoid=boundsIndex(connectedCells.map(cell=>({cell,bounds:paddedBounds(cell.faces.flat())}))),patches=exposed.map(poly=>polygonSlice(poly,axis,a,z)).filter(poly=>poly.length>=3&&area(poly)>1e-7),gapCandidates=gaps.map(poly=>polygonSlice(poly,axis,a,z)).filter(poly=>poly.length>=3&&area(poly)>1e-6).flatMap(poly=>nearVoid(paddedBounds(poly)).map(item=>clipPolygonToCell(poly,item.cell)).filter(poly=>poly.length>=3&&area(poly)>1e-6)),open=gapCandidates.filter(poly=>characteristicWidth(poly)>1e-5),uncertain=gapCandidates.filter(poly=>characteristicWidth(poly)<=1e-5);
                    const c: InteriorCompartment = { id, parentStructuralVolumeRef: host.id, architectureRegionRef: host.id, extractionAudit:{candidateDomainVolumeM3:space.domainVolumeM3,excludedSolidVolumeM3:space.occupiedVolumeM3,unresolvedVoidVolumeM3:unresolvedVolume,significantOtherComponents:groups.filter(g=>g.volumeM3>1e-6).length-1},physicalVolume: { model: 'FINITE_CONNECTED_CSG_COMPONENT', domains: cells.map(storedSolid), connectedCells: connectedSolids, occupiedRefs: space.refs }, volumeM3: connectedVolume, occupiedVolumeM3: space.occupiedVolumeM3, domainVolumeM3: space.domainVolumeM3, centroid: voidCentroid, localBounds: boundsOf(cells.flatMap(c => c.faces.flat())), worldTransformReference: 'SHIP_LOCAL_RIGID_TRANSFORM', boundaryReferences: [], adjacentCompartmentIds: [], openingReferences: [], structuralFrameReferences: b.structuralFrame!.members.filter(m => m.hostIds.includes(host.id)).map(m => m.id), hullShellReferences: b.physicalDesign!.surfaces.filter(s => s.kind === 'HULL' && s.geometryReference.parentStructureId === host.id).map(s => s.id), pressureCapability: open.length ? 'EXPOSED' : uncertain.length||largeUnresolved||touchesUnknown ? 'UNPRESSURIZED' : 'PRESSURIZABLE', boundaryCertainty: open.length ? 'OPEN_TO_EXTERIOR' : uncertain.length||largeUnresolved||touchesUnknown ? 'UNRESOLVED' : 'FINITE_MATERIAL_CLOSURE', grammar: template, partitionAxis: axis, partitionRange: [a, z], exteriorPatches: patches, unresolvedBoundaryReasons: touchesUnknown?['Candidate intersects unclassified armor-purpose stock. Its reserved envelope is excluded; no sealed interface or material mass is invented.']:largeUnresolved?['Significant additional void component was not promoted to a connected pressure chamber; explicit unresolved space inventory retained']:uncertain.length ? [`Finite surface audit leaves ${uncertain.length} strips with characteristic width <=10µm; closure is numerically unresolved, not certified sealed and not invented as a macroscopic hole`] : [], futureSystemPlacement: { status: 'SPACE_QUERY_ONLY_NO_SYSTEMS_GENERATED', requireFiniteCsgCollision: true, bulkheadRefs: [] } };
                    p.compartments.push(c);
                    local.push(c);
                    if(classified&&(touchesUnknown||uncertain.length||open.length))for(const r of p.unresolvedVoidPockets.filter(r=>r.candidateCompartmentId===id))r.classification='UNRESOLVED';
                    if(classified)for(const [j,info]of classified.slice(1).entries())if(info.classification==='RECOVERABLE'&&!touchesUnknown&&!uncertain.length&&!open.length){
                     const nearRecovery=boundsIndex(info.cells.map(cell=>({cell,bounds:paddedBounds(cell.faces.flat())}))),recoveryGaps=gaps.map(poly=>polygonSlice(poly,axis,a,z)).filter(poly=>poly.length>=3).flatMap(poly=>nearRecovery(paddedBounds(poly)).map(item=>clipPolygonToCell(poly,item.cell))).filter(poly=>poly.length>=3&&area(poly)>1e-6);
                     if(recoveryGaps.length){const r=p.unresolvedVoidPockets.find(r=>r.id==='unresolved/'+id+'/'+j)!;r.classification='UNRESOLVED';r.reason='Residual reaches an actual exterior gap or unresolved seam; not promoted to a sealed chamber';continue;}
                     const rid=id+'/recovered/'+j,recovered=recoverVoidCompartment(c,info.cells,rid);
                     recovered.exteriorPatches=patches.flatMap(poly=>nearRecovery(paddedBounds(poly)).map(item=>clipPolygonToCell(poly,item.cell))).filter(poly=>poly.length>=3&&area(poly)>1e-7);
                     p.compartments.push(recovered);const pocket=p.unresolvedVoidPockets.find(r=>r.id==='unresolved/'+id+'/'+j)!;pocket.classification='ASSIGNED_RECOVERED';pocket.recoveredCompartmentId=rid;
                    }
                    for (let j = 0; j < open.length; j++) {
                        const boundaryId = `boundary/${id}/exterior/${j}`, openingId = `opening/${id}/exterior/${j}`, n = faceNormal(open[j]);
                        p.boundaries.push({ id: boundaryId, kind: 'EXTERIOR_GAP', compartmentIds: [id, 'EXTERIOR'], polygons: [open[j]], normal: n, openingRefs: [openingId] });
                        p.openings.push({ id: openingId, type: 'EXTERIOR_OPENING', boundaryReference: boundaryId, fromCompartmentId: id, toCompartmentId: 'EXTERIOR', aperture: [storedSolid(polygonPrism(open[j], .001))], aperturePolygons: [open[j]], apertureAreaM2: area(open[j]), frameReference: null, closure: null, defaultState: 'OPEN', pressureSealingCapability: false });
                        c.boundaryReferences.push(boundaryId);
                    }
                }
                for (let i = 0; i < cuts.length; i++) {
                    const left = local.find(c => c.id === `comp/${host.id}/${i}`), right = local.find(c => c.id === `comp/${host.id}/${i + 1}`);
                    if (!left || !right) {
                        p.validationWarnings.push('Partition without two usable adjacent spaces remains unresolved ' + host.id);
                        continue;
                    }
                    timedPhysical('Interior bulkhead and openings', () => makeBulkhead(p, b, ctx, domain, axis, cuts[i], left, right, i));
                }
                p.regions.push({ volumeId: host.id, state: local.length ? 'EXTRACTED' : 'SOLID_OR_EXPOSED', grammar: template, reason: local.length ? 'Finite Hull CSG minus actual skin/frame/solid-connector/core occupancy' : 'Actual solid stock consumes this candidate; no empty room invented' });
            }
        });
        const voidNear=new Map(p.compartments.map(c=>[c.id,boundsIndex(c.physicalVolume.connectedCells.map(s=>({cell:solidCell(s),bounds:paddedBounds(s.vertices)})))]));
        timedPhysical('Interior module interfaces', () => {
            for (let i = 0; i < p.compartments.length; i++)
                for (let j = i + 1; j < p.compartments.length; j++) {
                    const a = p.compartments[i], c = p.compartments[j];
                    if (a.parentStructuralVolumeRef === c.parentStructuralVolumeRef)
                        continue;
                    const ba = a.localBounds, bc = c.localBounds;
                    if (['x', 'y', 'z'].some(k => ba.min[k as 'x'] > bc.max[k as 'x'] + 1e-6 || bc.min[k as 'x'] > ba.max[k as 'x'] + 1e-6))
                        continue;
                    const polys: Vec3[][] = [];
                    for (const ac of a.physicalVolume.domains.map(solidCell))
                        for (const cc of c.physicalVolume.domains.map(solidCell))
                            for (const face of ac.faces) {
                                const n = faceNormal(face), d = dot(n, face[0]);
                                if (!planes(cc).some(q => dot(q.n, n) < -.999999 && Math.abs(q.d + d) < 1e-6))
                                    continue;
                                const poly = clipPolygonToCell(face, cc);
                                if (poly.length >= 3 && area(poly) > 1e-5)
                                    for(const f of freePolygon(poly,ctx))for(const aa of voidNear.get(a.id)!(paddedBounds(f))){const pa=clipPolygonToCell(f,aa.cell);if(pa.length<3||area(pa)<1e-7)continue;for(const bb of voidNear.get(c.id)!(paddedBounds(pa))){const pb=clipPolygonToCell(pa,bb.cell);if(pb.length>=3&&area(pb)>1e-7)polys.push(pb);}}
                            }
                    if (!polys.length)
                        continue;
                    const boundaryId = `interface/${i}/${j}`, openingId = `passage/${i}/${j}`;
                    p.boundaries.push({ id: boundaryId, kind: 'FREE_INTERFACE', compartmentIds: [a.id, c.id], polygons: polys, normal: faceNormal(polys[0]), openingRefs: [openingId] });
                    p.openings.push({ id: openingId, type: 'PASSAGE', boundaryReference: boundaryId, fromCompartmentId: a.id, toCompartmentId: c.id, aperture: polys.map(poly => storedSolid(polygonPrism(poly, .001))), aperturePolygons: polys, apertureAreaM2: polys.reduce((n, poly) => n + area(poly), 0), frameReference: null, closure: null, defaultState: 'OPEN', pressureSealingCapability: false });
                }
        });
        timedPhysical('Interior graph construction', () => {
            for (const boundary of p.boundaries) {
                for (const id of boundary.compartmentIds) {
                    const c = p.compartments.find(c => c.id === id);
                    if (c && !c.boundaryReferences.includes(boundary.id))
                        c.boundaryReferences.push(boundary.id);
                }
                if (boundary.compartmentIds[1] !== 'EXTERIOR') {
                    const [a, c] = boundary.compartmentIds;
                    p.adjacency.push({ from: a, to: c, boundaryRef: boundary.id });
                    p.compartments.find(x => x.id === a)!.adjacentCompartmentIds.push(c);
                    p.compartments.find(x => x.id === c)!.adjacentCompartmentIds.push(a);
                }
            }
            for (const o of p.openings) {
                const edge = { id: `edge/${o.id}`, from: o.fromCompartmentId, to: o.toCompartmentId, boundaryRef: o.boundaryReference, openingRef: o.id };
                p.accessGraph.push(edge);
                p.pressureGraphDefinition.push({ ...edge });
                for (const id of [o.fromCompartmentId, o.toCompartmentId])
                    p.compartments.find(c => c.id === id)?.openingReferences.push(o.id);
            }
        });
        updateInteriorSpaceAccounting(p);
        p.analysis = timedPhysical('Interior isolation analysis', () => analyzeInterior(p));
        timedPhysical('Interior mass accounting', () => { p.massAccounting.bulkheadMassKg = p.bulkheads.reduce((n, w) => n + w.massKg, 0); p.massAccounting.closureMassKg = p.openings.reduce((n, o) => n + (o.closure?.massKg ?? 0), 0); p.massAccounting.materialVolumeM3 = p.bulkheads.reduce((n, w) => n + w.volumeM3, 0) + p.openings.reduce((n, o) => n + (o.closure?.volumeM3 ?? 0), 0); });
        p.validationWarnings.push('Faceted station-Hull CSG, exact finite cells within 0.1µm clipping tolerance; ideal material contacts, not certified gas seals.', 'No rooms are generated in solid connectors or exposed lattice; structure connectivity never implies an interior passage.');
        b.compartmentPlan = p;
        refreshPhysicalMass(b);
        updateInteriorDerivedData(b);
        cached = { key, plan: JSON.stringify(p) };
        return b;
    });
}
function makeBulkhead(p: CompartmentPlan, b: ShipBlueprint, ctx: ReturnType<typeof context>, domain: ConvexCell[], axis: 'y' | 'z', at: number, left: InteriorCompartment, right: InteriorCompartment, index: number) {
    const thickness = p.policy.thicknessMm / 1000, n = axisVector(axis), slab = domain.map(c => slice(c, axis, at - thickness / 2, at + thickness / 2)).filter((c): c is ConvexCell => !!c), cross: Vec3[][] = [];
    for (const d of slab) {
        const half = clipCell(d, n, at);
        if (half)
            for (const f of half.faces)
                if (f.every(v => Math.abs(v[axis] - at) < 1e-6))
                    cross.push(f);
    }
    if (!cross.length)
        throw Error('INTERIOR_BULKHEAD_SECTION_ABSENT');
    const boundaryId = `boundary/${left.id}/${right.id}`, id = `bulkhead/${left.id}/${right.id}`;
    // Aperture is accepted only if its entire finite tube lies inside the host and outside
    // every existing solid. Both endpoints lie in the adjacent CSG domains.
    let aperture: ConvexCell[] = [];
    let aperturePolygon: Vec3[] = [];
    const basisUV = basis(n), crossBounds = boundsOf(cross.flat()), centerPoint = center(cross.flat()), width = Math.min(2.4, Math.max(.6, b.order.length * .006)), height = axis === 'y' ? width : width * 1.4;
    const openingAllowed=!(p.policy.primary==='ARMOR'&&index===Math.floor((p.policy.maxPartitions-1)/2));
    for (const u of [0, -.18, .18, -.32, .32])
        for (const v of [0, -.18, .18, -.32, .32]) {
            if (!openingAllowed||aperture.length)
                break;
            const c = { ...centerPoint };
            if (axis === 'z') {
                c.x += u * (crossBounds.max.x - crossBounds.min.x);
                c.y += v * (crossBounds.max.y - crossBounds.min.y);
            }
            else {
                c.x += u * (crossBounds.max.x - crossBounds.min.x);
                c.z += v * (crossBounds.max.z - crossBounds.min.z);
            }
            c[axis] = at;
            const poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => add(c, add(mul(basisUV.u, x * width / 2), mul(basisUV.v, y * height / 2)))), tube = polygonPrism(poly, thickness + 2e-5), volume = cellVolume(tube);
            let outside = [tube];
            for (const d of domain)
                outside = outside.flatMap(p => subtractCell(p, d));
            if (outside.reduce((n, c) => n + cellVolume(c), 0) > 1e-7)
                continue;
            const occupied = ctx.near(cellBounds(tube)).some(item => ctx.cells(item).some(cell => { const hit = intersectCells(tube, cell); return hit && cellVolume(hit) > 1e-9; }));
            if (occupied)
                continue;
            const endpoints = [add(c, mul(n, -thickness / 2 - 1e-6)), add(c, mul(n, thickness / 2 + 1e-6))];
            if (!left.physicalVolume.connectedCells.some(s => inside(endpoints[0], solidCell(s))) || !right.physicalVolume.connectedCells.some(s => inside(endpoints[1], solidCell(s))))
                continue;
            aperture = [polygonPrism(poly, thickness)];
            aperturePolygon = poly;
        }
    const cells = carve(slab, ctx, aperture), pieces = cells.map(storedSolid), volume = pieces.reduce((n, s) => n + cellVolume(solidCell(s)), 0), material = HULL_MATERIALS[p.policy.materialId], supportRefs = [...new Set(slab.flatMap(c => ctx.near(cellBounds(c)).filter(i => i.ref.kind === 'FRAME_ENVELOPE' && ctx.cells(i).some(s => { const hit = intersectCells(c, s); return hit && cellVolume(hit) > 1e-8; })).map(i => i.ref.ownerId)))];
    const protective = p.policy.primary === 'ARMOR', wall: Bulkhead = { id, boundaryReference: boundaryId, materialId: p.policy.materialId, thicknessMm: p.policy.thicknessMm, stockEnvelope: slab.map(storedSolid), pieces, volumeM3: volume, massKg: volume * material.densityKgM3, grossAreaM2: cross.reduce((n, f) => n + area(f), 0), adjacentCompartmentIds: [left.id, right.id], pressureTight: true, protective, loadBearing: supportRefs.length > 0, roles: ['SEPARATION', 'PRESSURE_BOUNDARY', ...(protective ? ['INTERNAL_PROTECTION' as const] : []), ...(supportRefs.length ? ['STRUCTURAL_SUPPORT' as const] : [])], openingIds: [], structuralAttachmentRefs: supportRefs, hullShellRefs: left.hullShellReferences, geometryApproximationInfo: 'Finite source section slab minus existing material and aperture; ideal welded contact, no certified pressure/load performance.' };
    p.bulkheads.push(wall);
    p.boundaries.push({ id: boundaryId, kind: 'BULKHEAD', compartmentIds: [left.id, right.id], polygons: cross, normal: n, bulkheadRef: id, openingRefs: wall.openingIds });
    left.futureSystemPlacement.bulkheadRefs.push(id);
    right.futureSystemPlacement.bulkheadRefs.push(id);
    if (aperture.length) {
        const openingId = `opening/${id}`, sealed = p.policy.sealing === 'ISOLATED' || p.policy.sealing === 'MIXED' && index % 2 === 0, leaf = sealed ? aperture.map(storedSolid) : [], leafVolume = sealed ? aperture.reduce((n, c) => n + cellVolume(c), 0) : 0;
        const o: InteriorOpening = { id: openingId, type: sealed ? axis === 'y' ? 'HATCH' : 'DOOR' : 'PASSAGE', boundaryReference: boundaryId, fromCompartmentId: left.id, toCompartmentId: right.id, aperture: aperture.map(storedSolid), aperturePolygons: [aperturePolygon], apertureAreaM2: area(aperturePolygon), frameReference: id, closure: sealed ? { id: 'leaf/' + openingId, materialId: material.materialId as keyof typeof HULL_MATERIALS, thicknessMm: p.policy.thicknessMm, pieces: leaf, volumeM3: leafVolume, massKg: leafVolume * material.densityKgM3 } : null, defaultState: sealed ? 'SEALED' : 'OPEN', pressureSealingCapability: sealed };
        p.openings.push(o);
        wall.openingIds.push(openingId);
    }
    else
        p.validationWarnings.push((openingAllowed?'No finite unobstructed aperture fits':'Critical protection boundary intentionally has no passage')+'; boundary is not traversable: '+id);
}
export function updateInteriorSpaceAccounting(p: CompartmentPlan) {
 if(p.version==='1.8.6.2.1'){
  const main=p.compartments.filter(c=>!c.recoveryOf),sum=(cs:InteriorCompartment[])=>cs.reduce((n,c)=>n+c.volumeM3,0),assigned=sum(p.compartments.filter(c=>c.boundaryCertainty==='FINITE_MATERIAL_CLOSURE')),unresolved=sum(p.compartments.filter(c=>c.boundaryCertainty==='UNRESOLVED')),exterior=sum(p.compartments.filter(c=>c.boundaryCertainty==='OPEN_TO_EXTERIOR'));
  const residual=(kind:string)=>p.unresolvedVoidPockets.filter(r=>r.classification===kind).reduce((n,r)=>n+r.volumeM3,0),usable=residual('USABLE_RESIDUAL'),nonallocatable=residual('NONALLOCATABLE'),failed=p.unresolvedVoidPockets.filter(r=>!r.classification).reduce((n,r)=>n+r.volumeM3,0);
  const domain=main.reduce((n,c)=>n+c.domainVolumeM3,0),solid=main.reduce((n,c)=>n+c.occupiedVolumeM3,0),allResidual=p.unresolvedVoidPockets.reduce((n,r)=>n+r.volumeM3,0),mainVolume=sum(main);
  p.volumeAudit={scope:'EXCLUSIVE_EXTRACTED_BAY_DOMAINS_EXCLUDING_PARTITION_SLABS',candidateDomainM3:domain,validInteriorM3:assigned+usable+nonallocatable,assignedM3:assigned,geometricAssignedM3:sum(p.compartments),usableResidualM3:usable,nonallocatableM3:nonallocatable,unresolvedCandidateM3:unresolved+failed,solidOccupiedM3:solid,exteriorConnectedM3:exterior,overlapVolumeM3:0,conservationErrorM3:domain-solid-mainVolume-allResidual,recoveredM3:sum(p.compartments.filter(c=>!!c.recoveryOf)),unquantifiedRegionIds:p.regions.filter(r=>r.state==='UNRESOLVED').map(r=>r.volumeId),confidence:'FINITE_CSG_WITH_EXPLICIT_UNRESOLVED_REGIONS',note:'Valid=confirmed assigned + usable residual + nonallocatable. Unresolved chamber volume is separate, never certified valid. Solid counts union in exclusive bay domains. Partition slabs/portal tubes and unquantified hollow status of reserved stock are outside this denominator. Recovered pockets are counted once as assigned; partition-free residuals remain distinct. Clearance uses a conservative .5m cube witness, not total-volume suitability.'};
 }
 p.spatialAccounting = { compartmentVoidM3: p.compartments.reduce((n, c) => n + c.volumeM3, 0), openBulkheadPortalVoidM3: p.openings.filter(o => o.defaultState === 'OPEN' && p.boundaries.find(w => w.id === o.boundaryReference)?.kind === 'BULKHEAD').reduce((n, o) => n + o.aperture.reduce((n, s) => n + cellVolume(solidCell(s)), 0), 0), note: 'Room CSG ends at wall faces. Open bulkhead aperture tubes are separate portal space; free module interface markers are not counted again.' }; }
export function updateInteriorDerivedData(b: ShipBlueprint) { for(const w of b.compartmentPlan!.bulkheads){w.pressureTight=w.openingIds.every(id=>{const o=b.compartmentPlan!.openings.find(o=>o.id===id)!;return !!o.closure&&o.pressureSealingCapability;});w.roles=['SEPARATION',...(w.pressureTight?['PRESSURE_BOUNDARY' as const]:[]),...(w.protective?['INTERNAL_PROTECTION' as const]:[]),...(w.loadBearing?['STRUCTURAL_SUPPORT' as const]:[])];} const p = b.compartmentPlan!, d = b.physicalDesign!, m = d.mass; updateInteriorSpaceAccounting(p); d.policy.future.status = 'FRAME_COMPARTMENTS_APPLIED_SYSTEMS_NOT_GENERATED'; const known = m.hullShellMassKg + (m.actualFrameMassKg ?? 0) + (m.actualStructuralConnectorMassKg ?? 0) + p.massAccounting.bulkheadMassKg + p.massAccounting.closureMassKg, remaining = d.policy.allocationsKg.structure - known; p.budgetAccounting = { structureAllowanceKg: d.policy.allocationsKg.structure, knownStructureUseKg: known, remainingStructureAllowanceKg: remaining, unfundedReservationKg: Math.max(0, -remaining), note: 'New interior material consumes structural allowance and final estimated base mass/cost. Hull/armor are retained; no target value is copied into actual mass. Hard maximum and cost are checked at delivery. Unresolved service/fitting estimates remain unchanged.' }; }
