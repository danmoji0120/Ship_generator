import type {ShipBlueprint,Vec3} from '../../blueprint/types';
import type {ArmorSurfaces} from '../weapons/surfaces';
import type {DetailPlacement,DetailZone,DetailKitType} from './types';
import {containsProductionVolume} from '../production/surface-contact';
import {DETAIL_KITS} from './registry';
import {detailFrame,kitSize,detailAssembly} from './geometry';
import {surfaceRay,worldPoint} from '../weapons/surfaces';
import {add,sub,mul,dot,boundsOf} from '../integration/contours';
import {geometrySamples,solidContains,solidsIntrude,rayBlocked} from '../weapons/collision';
import {overlappingBounds,reservationBounds,reservationSamples} from '../armor/geometry';
import {inReservedZone} from '../integration/reservations';
import type {PanelSolid} from '../armor/types';
const projectionCache=new WeakMap<PanelSolid,Map<string,[number,number]>>();
/** Exact additional separating axis for immutable solids; this only avoids provably disjoint sampled queries. */
function projection(s:PanelSolid,n:Vec3):[number,number]{
 let cache=projectionCache.get(s);if(!cache){cache=new Map();projectionCache.set(s,cache);}const key=n.x+'/'+n.y+'/'+n.z;let range=cache.get(key);
 if(!range){let lo=Infinity,hi=-Infinity;for(const v of s.vertices){const d=dot(v,n);lo=Math.min(lo,d);hi=Math.max(hi,d);}range=[lo,hi];cache.set(key,range);}return range;
}
function separated(a:PanelSolid,b:PanelSolid,n:Vec3){const x=projection(a,n),y=projection(b,n);return x[0]>y[1]+1e-8||y[0]>x[1]+1e-8;}

export function resolveDetail(b:ShipBlueprint,z:DetailZone,kit:DetailKitType,id:string,surfaces:ArmorSurfaces,hint:Vec3,parameters?:{routeLength:number}):DetailPlacement {
 const hit=surfaceRay(surfaces,hint,z.normal);if(!hit||hit.structureId!==z.parentStructureId||!z.surfaceIds.includes(hit.surfaceId))throw Error('No exposed surface belonging to functional parent');
 const frame=detailFrame(hit.normal),[w,,baseLength]=kitSize(kit,b.shipyardId),l=parameters?.routeLength??baseLength,contacts=[];
 for(const [x,y]of[[-w/2,-l/2],[w/2,-l/2],[w/2,l/2],[-w/2,l/2],[0,0],...(parameters?[[0,-l*.25],[0,l*.25],[-w/2,0],[w/2,0]]:[])]){
  const q=worldPoint(hit.position,frame,{x,y:0,z:y}),c=surfaceRay(surfaces,q,hit.normal);
  if(!c||c.structureId!==hit.structureId||!z.surfaceIds.includes(c.surfaceId)||dot(c.normal,hit.normal)<.96||Math.abs(dot(sub(c.position,hit.position),hit.normal))>.045)throw Error('Kit footprint crosses armor step or unsupported edge');contacts.push(c);
 }
 const assembly=detailAssembly(id,kit,b.shipyardId,hit.position,frame,parameters);
 assembly.attachments=[{kind:'ARMOR',parentId:hit.surfaceId,position:hit.position,normal:hit.normal}];assembly.equipmentIds=z.equipmentId?[z.equipmentId]:[];
 return {id,kit,zoneId:z.id,parentStructureId:hit.structureId,parentEquipmentId:z.equipmentId,styleVariant:b.shipyardId,lodClass:DETAIL_KITS[kit].lod,attachment:{...hit,frame,contacts,inset:.025,footprint:{width:w,length:l}},assembly,bounds:boundsOf(assembly.parts.flatMap(p=>p.solid.vertices)),access:{origin:hit.position,direction:hit.normal,depth:DETAIL_KITS[kit].access},geometryParameters:parameters,hierarchy:parameters&&parameters.routeLength>=6?'MACRO':DETAIL_KITS[kit].lod,physicalOrVisualRole:'VISUAL_ONLY',functionalConnection:z.reason,importance:DETAIL_KITS[kit].importance,...(kit==='RCS_CLUSTER'?{rcs:{nozzleCount:4,thrustDirectionCandidates:[mul(hit.normal,-1)],axes:['TRANSLATION','PITCH','YAW','ROLL'] as ('TRANSLATION'|'PITCH'|'YAW'|'ROLL')[],status:'RESERVED_FOR_COMBAT' as const,constraints:['Sampled nozzle direction clear; no thrust/torque/fuel or maneuver bonus simulated']}}:{})};
}
export type DetailScene=ReturnType<typeof detailScene>;
export function detailScene(b:ShipBlueprint,surfaces:ArmorSurfaces){
 const solidIds=new Set(surfaces.map(s=>s.id));
 return [...surfaces.map(s=>({id:s.id,solid:s.solid,bounds:s.box})),...(b.prefabPlacements??[]).flatMap(p=>(p.assembly?.parts??[]).filter(p=>!solidIds.has(p.id)).map(p=>({id:p.id,solid:p.solid,bounds:p.bounds})))];
}
export function detailIssues(b:ShipBlueprint,p:DetailPlacement,placed:DetailPlacement[],scene:DetailScene):string[]{
 const errors:string[]=[],zones=b.productionDesign?.zones??[],contacts=new Set(p.attachment.contacts.map(c=>c.surfaceId));
 // Exact separating-plane proof: on a supporting Hull face, points above the permitted inset cannot be inside the parent. Concave/non-supporting faces retain the full sampled containment path.
 const parentCeilings=new Map(scene.filter(s=>contacts.has(s.id)).map(s=>[s.id,Math.max(...s.solid.vertices.map(v=>dot(sub(v,p.attachment.position),p.attachment.normal)))]));
 for(const part of p.assembly.parts){
  const samples=()=>geometrySamples(part.solid);
  for(const s of scene){if(!overlappingBounds(part.bounds,s.bounds))continue;
   if(contacts.has(s.id)){
    if((parentCeilings.get(s.id)??Infinity)>.035&&samples().some(q=>dot(sub(q,p.attachment.position),p.attachment.normal)>.035&&solidContains(s.solid,q)))errors.push('Intrusion above permitted parent inset '+s.id);
   }else if(!separated(part.solid,s.solid,p.attachment.normal)&&solidsIntrude(part.solid,part.bounds,s.solid,s.bounds))errors.push('Other equipment/armor interference '+s.id);
  }
  for(const z of zones)if(overlappingBounds(part.bounds,reservationBounds(z))&&(samples().some(q=>inReservedZone(q,z))||reservationSamples(z).some(q=>solidContains(part.solid,q))))errors.push('Reserved opening '+z.id);
  for(const space of b.designRequirements?.spaces??[])if(overlappingBounds(part.bounds,space.bounds))errors.push('Required internal/XL space '+space.id);
  for(const prev of placed)if(overlappingBounds(part.bounds,prev.bounds))for(const q of prev.assembly.parts)if(!separated(part.solid,q.solid,p.attachment.normal)&&solidsIntrude(part.solid,part.bounds,q.solid,q.bounds))errors.push('Detail collision '+prev.id);
 }
 const targets=p.assembly.parts.map(q=>({id:q.id,solid:q.solid,bounds:q.bounds}));
 for(const mount of b.weaponLayout?.mounts??[]){
  // Operating envelope is protected as well as actual muzzle sample rays.
  if(p.parentEquipmentId!==mount.equipment.prefabId&&overlappingBounds(p.bounds,mount.equipment.bounds))errors.push('Weapon operating envelope '+mount.id);
  for(const arc of mount.firingArc.samples){const hit=rayBlocked(arc.origin,arc.direction,mount.firingArc.rangeMeters,targets);if(hit){errors.push('Static firing path '+mount.id);break;}}
 }
 for(const prev of placed){const out=add(prev.access.origin,mul(prev.access.direction,.15));if(prev.access.depth>0&&rayBlocked(out,prev.access.direction,prev.access.depth,targets))errors.push('Earlier detail access blocked '+prev.id);}
 if(p.access.depth>0){const top=Math.max(...p.assembly.parts.flatMap(a=>a.solid.vertices).map(q=>dot(sub(q,p.attachment.position),p.attachment.normal))),origin=add(p.attachment.position,mul(p.attachment.normal,top+.1));
  if(rayBlocked(origin,p.access.direction,p.access.depth,[...scene,...placed.flatMap(q=>q.assembly.parts.map(a=>({id:a.id,solid:a.solid,bounds:a.bounds})))]))errors.push('Service access / nozzle / sensor direction blocked');
 }
 // Preserve the existing sensor aperture, not just its housing's collision solid.
 for(const sensor of b.prefabPlacements??[])for(const optic of sensor.assembly?.parts.filter(a=>a.role==='PROTECTED_SENSOR')??[]){
  const n=sensor.id==='command-house'?{x:0,y:0,z:-1}:sensor.socket.normal,frame=detailFrame(n),box=optic.bounds,center={x:(box.min.x+box.max.x)/2,y:(box.min.y+box.max.y)/2,z:(box.min.z+box.max.z)/2};
  const radius=Math.max(...optic.solid.vertices.map(q=>dot(sub(q,center),n))),origin=add(center,mul(n,radius+.04));
  for(const offset of[-.15,0,.15])if(rayBlocked(add(origin,mul(frame.right,offset)),n,6,targets)){errors.push('Existing sensor view obstructed '+optic.id);break;}
 }
 // Empty designed target samples remain empty: no decoration bridges intentional space.
 for(const t of b.macroDesign?.negativeSpaceTargets??[])for(const x of[-.35,0,.35])for(const y of[-.35,0,.35])for(const z of[-.35,0,.35]){const q={x:t.center.x+t.size.x*x,y:t.center.y+t.size.y*y,z:t.center.z+t.size.z*z};if(!b.structuralVolumes.some(v=>containsProductionVolume(v,q,0))&&p.assembly.parts.some(a=>solidContains(a.solid,q)))errors.push('Intentional negative-space target '+t.id);}
 return [...new Set(errors)];
}
