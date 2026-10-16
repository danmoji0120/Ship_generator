import {closureResidual} from '../structure/geometry';
import {containsVolume} from '../generation/architecture/volumes';
import { Quaternion, Vector3 } from 'three';
import type { ShipBlueprint, Vec3 } from '../blueprint/types';
import type { ShipRigidTransform } from '../physical/probe';
import type { CompartmentPlan, InteriorInstanceState } from './types';
import { createInteriorInstanceState } from './types';
import { context, inside, paddedBounds } from './geometry';
import { solidCell, planes, rayPlanes, cellVolume, subtractCell, intersectCells, clipCell } from '../physical/convex';
import { boundsOf, add, mul,center } from '../generation/integration/contours';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import { analyzeInterior } from './graph';
import { interiorSignature } from './build';
import type { PanelSolid } from '../generation/armor/types';
export interface InteriorHit {
    kind: 'COMPARTMENT' | 'BULKHEAD' | 'CLOSURE' | 'OPENING';
    id: string;
    materialId: string | null;
    thicknessMm: number | null;
    entryDistanceM: number;
    exitDistanceM: number;
    pathLengthM: number;
    entryPoint: Vec3;
    exitPoint: Vec3;
    entryNormal: Vec3 | null;
    compartmentIds: string[];
    state?: string;
}
let cache = new WeakMap<CompartmentPlan, {
    key: string;
    query: ReturnType<typeof buildQueries>;
}>();
export const clearInteriorQueryCache=()=>{cache=new WeakMap();};
export const releaseInteriorQueries=(b:ShipBlueprint)=>{if(b.compartmentPlan)cache.delete(b.compartmentPlan);};
export function prepareInteriorQueries(b: ShipBlueprint) { const p = b.compartmentPlan; if (!p)
    throw Error('INTERIOR_DATA_ABSENT_LEGACY_NOT_REDESIGNED'); const key = JSON.stringify(p) + interiorSignature(b), old = cache.get(p); if (old?.key === key)
    return old.query; const query = buildQueries(b); cache.set(p, { key, query }); return query; }
/** Keep the mutable source context outside the returned query closure's lexical
 * environment. Only owned plane/bounds snapshots survive this helper. */
function occupancySnapshot(b:ShipBlueprint,refs:CompartmentPlan['occupancy']){
 const ctx=context(b,refs);
 return ctx.items.flatMap(item=>ctx.cells(item).map(c=>({id:item.ref.id,planes:planes(c).map(p=>({n:{...p.n},d:p.d})),bounds:boundsOf(c.faces.flat())})));
}
function buildQueries(b: ShipBlueprint) {
    const unknownVolumes=structuredClone(b.structuralVolumes.filter(v=>v.type==='SPINE'||v.purpose==='armor'));
    const start = performance.now(), source=b.compartmentPlan!, p = structuredClone({...source,occupancy:[],compartments:source.compartments.map(c=>({...c,physicalVolume:{model:c.physicalVolume.model,domains:[],connectedCells:[],occupiedRefs:[]}})),bulkheads:source.bulkheads.map(w=>({...w,pieces:[],stockEnvelope:[]})),openings:source.openings.map(o=>({...o,aperture:[],closure:o.closure})),unresolvedVoidPockets:[],volumeAudit:source.volumeAudit}), make = (s: PanelSolid) => ({ planes: planes(solidCell(s)).map(q => ({ n: { ...q.n }, d: q.d })), bounds: boundsOf(s.vertices),anchor:center(s.vertices) }), negatives = occupancySnapshot(b,source.occupancy), near = boundsIndex(negatives), rooms = source.compartments.map(c => ({ ...p.compartments.find(r=>r.id===c.id)!, cells: c.physicalVolume.connectedCells.map(make), excluded: new Set(c.physicalVolume.occupiedRefs) })), walls = source.bulkheads.map(w => ({ ...p.bulkheads.find(r=>r.id===w.id)!, cells: w.pieces.map(make) })), portals = source.openings.map(o => ({ ...p.openings.find(r=>r.id===o.id)!, cells: o.aperture.map(make), leaf: o.closure?.pieces.map(make) ?? [] }));
    const contains = (planes: ReturnType<typeof make>['planes'], point: Vec3) => planes.every(n => point.x * n.n.x + point.y * n.n.y + point.z * n.n.z <= n.d + 1e-7);
    const roomNear=new Map(rooms.map(r=>[r.id,boundsIndex(r.cells)]));
    function fits(compartmentId:string,solid:PanelSolid){const room=rooms.find(c=>c.id===compartmentId);if(!room)throw Error('UNKNOWN_COMPARTMENT');if(room.boundaryCertainty!=='FINITE_MATERIAL_CLOSURE')return false;
     if(!solid.vertices.length||!solid.indices.length||solid.vertices.some(p=>!Object.values(p).every(Number.isFinite)))throw Error('INVALID_PLACEMENT_SOLID');
     if(solid.vertices.some(p=>(['x','y','z']as const).some(k=>p[k]<room.localBounds.min[k]-1e-7||p[k]>room.localBounds.max[k]+1e-7)))return false;
     const candidate=solidCell(solid),box=boundsOf(solid.vertices),closed=closureResidual(solid);if(planes(candidate).some(p=>solid.vertices.some(v=>v.x*p.n.x+v.y*p.n.y+v.z*p.n.z>p.d+1e-5))||closed.openAreaVectorM2>Math.max(1e-9,closed.surfaceAreaM2*1e-11))throw Error('PLACEMENT_REQUIRES_CLOSED_CONVEX_VOLUME');if(cellVolume(candidate)<=1e-10)throw Error('NONPOSITIVE_PLACEMENT_VOLUME');
     let outside=[candidate];for(const d of roomNear.get(room.id)!(box)){outside=outside.flatMap(c=>subtractPlanes(c,d.planes));if(!outside.length)break;}
     if(outside.reduce((n,c)=>n+cellVolume(c),0)>1e-7)return false;
     return !near(box).some(item=>{let hit:ReturnType<typeof clipCell>=candidate;for(const plane of item.planes){if(!hit)break;hit=clipCell(hit,plane.n,plane.d);}return hit&&cellVolume(hit)>1e-9;});
    }
    return Object.freeze({ preparationMs: performance.now() - start, cellCount: negatives.length + rooms.reduce((n, c) => n + c.cells.length, 0) + walls.reduce((n, w) => n + w.cells.length, 0) + portals.reduce((n, o) => n + o.cells.length + o.leaf.length, 0),
        at(point: Vec3) { if (!Object.values(point).every(Number.isFinite))
            throw Error('INVALID_INTERIOR_POINT'); const occupied = near(paddedBounds([point])).filter(c => contains(c.planes, point)); return rooms.filter(c => c.cells.some(d => contains(d.planes, point)) && !occupied.some(n => c.excluded.has(n.id))).map(c => ({ compartmentId: c.id, volumeM3: c.volumeM3, pressureCapability: c.pressureCapability, boundaryCertainty:c.boundaryCertainty, boundaryReferences: [...c.boundaryReferences], structuralFrameReferences: [...c.structuralFrameReferences], adjacentCompartmentIds: [...c.adjacentCompartmentIds] })); },
        unresolvedCandidates(point:Vec3){return unknownVolumes.filter(v=>containsVolume(v,point)).map(v=>({volumeId:v.id,status:'UNRESOLVED_NO_HOLLOW_CONTRACT' as const}));},
        occupancyAt(point: Vec3) { return [...new Set(near(paddedBounds([point])).filter(c => contains(c.planes, point)).map(c => c.id))]; },
        availableVolume(compartmentId:string){const c=rooms.find(c=>c.id===compartmentId);if(!c)throw Error('UNKNOWN_COMPARTMENT');return {volumeM3:c.volumeM3,confidence:c.boundaryCertainty,confirmed:c.boundaryCertainty==='FINITE_MATERIAL_CLOSURE',boundaryReferences:[...c.boundaryReferences],openingReferences:[...c.openingReferences],adjacentCompartmentIds:[...c.adjacentCompartmentIds],accessGroup:[...(p.analysis.accessGroups.find(g=>g.includes(c.id))??[])]};},
        fits(compartmentId:string,solid:PanelSolid){return fits(compartmentId,solid);},
        placementCandidates(size:Vec3,options:{clearanceM?:number;limit?:number;compartmentId?:string;quaternion?:{x:number;y:number;z:number;w:number}}={}){
         if(!Object.values(size).every(x=>Number.isFinite(x)&&x>0)||!Number.isFinite(options.clearanceM??0)||(options.clearanceM??0)<0)throw Error('INVALID_PLACEMENT_SIZE_OR_CLEARANCE');
         const q=options.quaternion??{x:0,y:0,z:0,w:1};if(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)>1e-6)throw Error('INVALID_PLACEMENT_ROTATION');
         const limit=Math.min(32,Math.max(1,options.limit??8)),candidates=[];let tested=0;
         for(const room of rooms.filter(c=>!options.compartmentId||c.id===options.compartmentId)){
          if(room.boundaryCertainty!=='FINITE_MATERIAL_CLOSURE')continue;
          // Bounded deterministic anchors from actual cells; a conservative search, not an exhaustive packing solver.
          const anchors=[...room.cells].sort((a,b)=>boxVolume(b.bounds)-boxVolume(a.bounds)).slice(0,64).map(c=>({...c.anchor}));
          for(const point of anchors){const solid=placementBox(point,size,options.clearanceM??0,q);tested++;if(fits(room.id,solid)){candidates.push({compartmentId:room.id,position:point,quaternion:{...q},size:{...size},clearanceM:options.clearanceM??0,confidence:room.boundaryCertainty,availableVolumeM3:room.volumeM3,boundaryReferences:[...room.boundaryReferences],openingReferences:[...room.openingReferences],adjacentCompartmentIds:[...room.adjacentCompartmentIds],accessGroup:[...(p.analysis.accessGroups.find(g=>g.includes(room.id))??[])]});break;}}
          if(candidates.length>=limit)break;
         }
         return {candidates,tested,search:'UP_TO_64_ACTUAL_CELL_ANCHORS_PER_CONFIRMED_COMPARTMENT',exhaustive:false as const};
        },
        probe(origin: Vec3, direction: Vec3, maxDistance: number, state: InteriorInstanceState = createInteriorInstanceState(), transform?: ShipRigidTransform) {
            analyzeInterior(p, state);
            const q = transform?.quaternion, pos = transform?.position;
            if (![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, maxDistance, ...(q ? [q.x, q.y, q.z, q.w, pos!.x, pos!.y, pos!.z] : [])].every(Number.isFinite) || maxDistance <= 0 || Math.hypot(direction.x, direction.y, direction.z) < 1e-12 || q && Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > 1e-6)
                return { valid: false, hits: [] as InteriorHit[], warnings: ['INVALID_INTERIOR_RAY_OR_TRANSFORM'] };
            const rotation = q ? new Quaternion(q.x, q.y, q.z, q.w) : new Quaternion(), translation = new Vector3(pos?.x ?? 0, pos?.y ?? 0, pos?.z ?? 0), inverse = rotation.clone().invert(), o = new Vector3(origin.x, origin.y, origin.z).sub(translation).applyQuaternion(inverse), d = new Vector3(direction.x, direction.y, direction.z).normalize().applyQuaternion(inverse), world = (point: Vec3) => { const v = new Vector3(point.x, point.y, point.z).applyQuaternion(rotation).add(translation); return { x: v.x, y: v.y, z: v.z }; }, rayBounds = boundsOf([o, add(o, mul(d, maxDistance))]);
            for (const axis of ['x', 'y', 'z'] as const) {
                rayBounds.min[axis] -= 1e-7;
                rayBounds.max[axis] += 1e-7;
            }
            const raw: InteriorHit[] = [], push = (kind: InteriorHit['kind'], id: string, materialId: string | null, thicknessMm: number | null, cells: ReturnType<typeof make>[], compartmentIds: string[], state?: string, exclude?: Set<string>) => {
                for (const cell of cells) {
                    const hit = rayPlanes(cell.planes, o, d, maxDistance);
                    if (!hit)
                        continue;
                    let intervals = [[hit.entry, hit.exit]];
                    if (exclude)
                        for (const occupied of near(rayBounds)) {
                            if (!exclude.has(occupied.id))
                                continue;
                            const block = rayPlanes(occupied.planes, o, d, maxDistance);
                            if (block)
                                intervals = intervals.flatMap(([a, b]) => block.exit <= a || block.entry >= b ? [[a, b]] : [...(block.entry > a ? [[a, Math.min(b, block.entry)]] : []), ...(block.exit < b ? [[Math.max(a, block.exit), b]] : [])]);
                        }
                    for (const [a, z] of intervals)
                        if (z - a > 1e-7)
                            raw.push({ kind, id, materialId, thicknessMm, entryDistanceM: a, exitDistanceM: z, pathLengthM: z - a, entryPoint: world(add(o, mul(d, a))), exitPoint: world(add(o, mul(d, z))), entryNormal: hit.entryNormal && Math.abs(a - hit.entry) < 1e-7 ? worldNormal(hit.entryNormal, rotation) : null, compartmentIds: [...compartmentIds], ...(state ? { state } : {}) });
                }
            };
            for (const c of rooms)
                push('COMPARTMENT', c.id, null, null, c.cells, [c.id]);
            for (const w of walls)
                if (!state.disabledBulkheadIds.includes(w.id))
                    push('BULKHEAD', w.id, w.materialId, w.thicknessMm, w.cells, w.adjacentCompartmentIds);
            for (const portal of portals) {
                const value = state.openingStates[portal.id] ?? portal.defaultState, disabled = state.disabledBulkheadIds.includes(p.boundaries.find(b => b.id === portal.boundaryReference)?.bulkheadRef ?? '');
                push('OPENING', portal.id, null, null, portal.cells, [portal.fromCompartmentId, portal.toCompartmentId], disabled ? 'BOUNDARY_DISABLED_HYPOTHESIS' : value);
                if (value !== 'OPEN' && !disabled && portal.closure)
                    push('CLOSURE', portal.closure.id, portal.closure.materialId, portal.closure.thicknessMm, portal.leaf, [portal.fromCompartmentId, portal.toCompartmentId], value);
            }
            raw.sort((a, b) => a.id.localeCompare(b.id) || a.entryDistanceM - b.entryDistanceM);
            const merged: InteriorHit[] = [];
            for (const h of raw) {
                const last = merged.at(-1);
                if (last?.id === h.id && h.entryDistanceM <= last.exitDistanceM + 1e-7) {
                    if (h.exitDistanceM > last.exitDistanceM) {
                        last.exitDistanceM = h.exitDistanceM;
                        last.exitPoint = h.exitPoint;
                        last.pathLengthM = last.exitDistanceM - last.entryDistanceM;
                    }
                }
                else
                    merged.push(h);
            }
            return { valid: true, hits: merged.sort((a, b) => a.entryDistanceM - b.entryDistanceM || a.id.localeCompare(b.id)), warnings: ['Exact intervals for stored finite CSG. Opening overrides/disabled boundaries are temporary hypotheses, not moving-door or damage physics.'] };
        }
    });
}
function worldNormal(p: Vec3, q: Quaternion) { const v = new Vector3(p.x, p.y, p.z).applyQuaternion(q); return { x: v.x, y: v.y, z: v.z }; }
export function interiorRayProbe(b: ShipBlueprint, origin: Vec3, direction: Vec3, maxDistance: number, state?: InteriorInstanceState, transform?: ShipRigidTransform) { return prepareInteriorQueries(b).probe(origin, direction, maxDistance, state, transform); }

const boxVolume=(b:ReturnType<typeof boundsOf>)=>(b.max.x-b.min.x)*(b.max.y-b.min.y)*(b.max.z-b.min.z);
function subtractPlanes(a:ReturnType<typeof solidCell>,ps:ReturnType<typeof planes>){
 const vs=a.faces.flat();if(ps.some(p=>vs.every(v=>v.x*p.n.x+v.y*p.n.y+v.z*p.n.z-p.d>=-1e-7)))return[a];
 let intersection:ReturnType<typeof clipCell>=a;for(const p of ps){if(!intersection)break;intersection=clipCell(intersection,p.n,p.d);}if(!intersection||cellVolume(intersection)<1e-9)return[a];
 let remainder:ReturnType<typeof clipCell>=a;const out=[];for(const p of ps){if(!remainder)break;const outside=clipCell(remainder,p.n,p.d,false);if(outside)out.push(outside);remainder=clipCell(remainder,p.n,p.d);}return out;
}
export function placementBox(position:Vec3,size:Vec3,clearanceM=0,q={x:0,y:0,z:0,w:1}):PanelSolid{
 const rotation=new Quaternion(q.x,q.y,q.z,q.w),vertices=[];for(const z of[-1,1])for(const y of[-1,1])for(const x of[-1,1]){const p=new Vector3(x*(size.x/2+clearanceM),y*(size.y/2+clearanceM),z*(size.z/2+clearanceM)).applyQuaternion(rotation).add(new Vector3(position.x,position.y,position.z));vertices.push({x:p.x,y:p.y,z:p.z});}
 return {vertices,indices:[0,2,3,0,3,1,4,5,7,4,7,6,0,1,5,0,5,4,2,6,7,2,7,3,0,4,6,0,6,2,1,3,7,1,7,5]};
}
