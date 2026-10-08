import type { ShipBlueprint, Vec3, EquipmentZone } from '../../blueprint/types';
import type { ArmorSurface, ArmorDirection } from './types';
import { profileRing } from '../hull';
import { volumeBounds } from '../architecture/volumes';
import {armorTriangles,reservationBounds,overlappingBounds} from './geometry';
import {equipmentReservations,inReservedZone} from '../integration/reservations';
import {add,mul,mix,center,basis,dot,boundsOf} from '../integration/contours';
import {contourContains} from './exposure';
import {area,normal,clipHalfSpace} from './panels';
export const DIRECTIONS:ArmorDirection[]=['top','bottom','left','right','fore','aft'];
export function classifyNormal(n:Vec3):ArmorDirection {
 const a=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)];
 return a[2]>Math.max(a[0],a[1])?(n.z<0?'fore':'aft'):a[0]>a[1]?(n.x<0?'left':'right'):(n.y<0?'bottom':'top');
}
/** Exact loft topology, including cap fan triangles. Housing contours use their stored world vertices. */
export function extractArmorSurfaces(b:ShipBlueprint):{surfaces:ArmorSurface[];zones:EquipmentZone[]} {
 const zones=equipmentReservations(b).filter(z=>z.kind==='exhaust'||z.kind==='thermal'||b.hardpoints.some(h=>h.type==='Spinal'&&h.id===z.equipmentId));
 if(b.macroDesign?.family==='WIDE_CARRIER')for(const v of b.structuralVolumes.filter(v=>Math.abs(v.position.x)>b.order.length*.08)) {
  const side=Math.sign(v.position.x),ring=profileRing(v.geometry.stations[Math.floor(v.geometry.stations.length/2)]),edge=side===1?2:6;
  zones.push({id:`hangar-access-${v.id}`,parentId:v.id,equipmentId:v.id,kind:'machinery',position:{x:v.position.x+(ring[edge][0]+ring[(edge+1)%8][0])/2,y:v.position.y+(ring[edge][1]+ring[(edge+1)%8][1])/2,z:v.position.z},normal:{x:side,y:0,z:0},radius:Math.min(v.dimensions.y*.17,b.order.length*.012),depth:b.order.length*.1,rootClearance:-b.order.length*.001});
 }
 const housings=(b.prefabPlacements??[]).filter(p=>p.exterior?.rings&&['integration','bow','stern'].includes(p.exterior.phase));
 const sources:{id:string;parent:string;rings:Vec3[][];exterior?:string}[]=[...b.structuralVolumes.map(v=>({id:v.id,parent:v.id,rings:v.geometry.stations.map(s=>profileRing(s).map(([x,y])=>({x:x+v.position.x,y:y+v.position.y,z:s.z+v.position.z})))})),...housings.map(p=>({id:p.id,parent:p.exterior!.parentIds[0],rings:p.exterior!.rings!,exterior:p.id}))];
 const surfaces:ArmorSurface[]=[];
 const l=b.order.length;
 const volumes=b.structuralVolumes.map(v=>({v,contains:contourContains(sources.find(s=>s.id===v.id)!.rings),bounds:volumeBounds([v])}));
 const boxes=housings.map(h=>({h,contains:contourContains(h.exterior!.rings!),bounds:{min:{x:Math.min(...h.exterior!.rings!.flat().map(p=>p.x)),y:Math.min(...h.exterior!.rings!.flat().map(p=>p.y)),z:Math.min(...h.exterior!.rings!.flat().map(p=>p.z))},max:{x:Math.max(...h.exterior!.rings!.flat().map(p=>p.x)),y:Math.max(...h.exterior!.rings!.flat().map(p=>p.y)),z:Math.max(...h.exterior!.rings!.flat().map(p=>p.z))}}}));
 const inside=(p:Vec3,q:typeof boxes[number]['bounds'])=>p.x>=q.min.x&&p.x<=q.max.x&&p.y>=q.min.y&&p.y<=q.max.y&&p.z>=q.min.z&&p.z<=q.max.z;
 for(const source of sources) for(const [i,triangle] of armorTriangles(source.rings).entries()) {
  if(area(triangle)<l*l*1e-10)continue;
  const n=normal(triangle),surface:ArmorSurface={id:`surface-${source.id}-${i}`,parentStructureId:source.parent,...(source.exterior?{parentExteriorId:source.exterior}:{}),region:`${source.id}-face-${i}`,triangle,normal:n,direction:classifyNormal(n),areaM2:area(triangle),patches:[]};
  function reason(p:Vec3):{reason:string;zone?:string}|undefined {
   const outer=add(p,mul(n,l*.00008));
   const other=volumes.find(({v,bounds,contains})=>v.id!==source.id&&inside(outer,bounds)&&contains(outer,-l*.00002))?.v;
   if(other)return {reason:`Internal contact with ${other.id}`};
   const housing=boxes.find(({h,bounds,contains})=>h.id!==source.id&&inside(outer,bounds)&&contains(outer,-l*.00002))?.h;
   if(housing)return {reason:`Internal integration contact with ${housing.id}`};
   const z=zones.find(z=>inReservedZone(add(p,mul(n,l*.002)),z));
   if(z)return {reason:`Functional ${z.kind} opening`,zone:z.id};
   return undefined;
  }
  function split(p:[Vec3,Vec3,Vec3],depth:number) {
   const samples=[center(p),...p.map(q=>mix(q,center(p),.025))],reasons=samples.map(reason);
   if(depth<2&&reasons.some(Boolean)&&!reasons.every(r=>r?.reason===reasons[0]?.reason)) {
    const [a,d,c]=p,ad=mix(a,d,.5),dc=mix(d,c,.5),ca=mix(c,a,.5);
    for(const child of [[a,ad,ca],[ad,d,dc],[ca,dc,c],[ad,dc,ca]] as [Vec3,Vec3,Vec3][])split(child,depth+1);
   }else{const r=reasons.find(Boolean);surface.patches.push({polygon:p,areaM2:area(p),...(r?{exclusionReason:r.reason,...(r.zone?{reservationId:r.zone}:{})}:{})});}
  }
  split(triangle,0);
  // Subtract finite, conservatively circumscribed opening cylinders in the actual surface plane.
  // A plate ending at an outlet needs room for thickness, not just a root-point clearance test.
  let patches=surface.patches;
  for(const zone of zones) {
    const next:ArmorSurface['patches']=[],{u,v}=basis(zone.normal),margin=l*.008;
    const box=reservationBounds(zone);for(const k of ['x','y','z']as const){box.min[k]-=margin*2;box.max[k]+=margin*2;}
    const planes=[{n:mul(zone.normal,-1),d:-dot(zone.position,zone.normal)-zone.rootClearance+margin},{n:zone.normal,d:dot(zone.position,zone.normal)+zone.depth+margin},...Array.from({length:8},(_,i)=>{const angle=i*Math.PI/4,n=add(mul(u,Math.cos(angle)),mul(v,Math.sin(angle)));return {n,d:dot(zone.position,n)+zone.radius+margin};})];
    for(const p of patches) {
      if(p.exclusionReason||!overlappingBounds(boundsOf(p.polygon.map(q=>add(q,mul(n,l*.001))).concat(p.polygon)),box)){next.push(p);continue;}
      let inside=p.polygon;const free:Vec3[][]=[];
      for(const plane of planes){if(inside.length<3)break;const outside=clipHalfSpace(inside,plane.n,plane.d,true);if(outside.length>=3&&area(outside)>1e-7)free.push(outside);inside=clipHalfSpace(inside,plane.n,plane.d,false);}
      if(inside.length<3||area(inside)<=1e-7){next.push(p);continue;}
      next.push(...free.map(polygon=>({polygon,areaM2:area(polygon)})));
      if(inside.length>=3&&area(inside)>1e-7)next.push({polygon:inside,areaM2:area(inside),exclusionReason:`Functional ${zone.kind} opening (finite octagonal clearance with panel thickness)`,reservationId:zone.id});
    }
    patches=next;
  }
  surface.patches=patches;surfaces.push(surface);
 }
 return {surfaces,zones};
}
