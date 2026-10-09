import type {ShipBlueprint,Vec3} from '../../blueprint/types';
import type {ArmorSurfaces} from '../weapons/surfaces';
import type {DetailZone,DetailZoneKind} from './types';
import {zoneKits,STYLE} from './registry';
import {boundsOf,add,mul} from '../integration/contours';
import {solidTriangles,normal} from '../armor/panels';
export function detailSurfaces(b:ShipBlueprint,armor:ArmorSurfaces):ArmorSurfaces {
 const knownIds=new Set(armor.map(s=>s.id));
 const extras=(b.prefabPlacements??[]).filter(p=>p.assembly&&!b.weaponLayout?.prefabIds.includes(p.id)).flatMap(p=>p.assembly!.parts.filter(part=>!knownIds.has(part.id)).map(part=>({id:part.id,structureId:p.socket.hostId,solid:part.solid,box:part.bounds,triangles:solidTriangles(part.solid).map(t=>({vertices:t,n:normal(t)}))})));
 const foundations=(b.weaponLayout?.mounts??[]).map(m=>({id:m.id+'-foundation',structureId:m.contacts[0].structureId,solid:m.foundation.solid,box:m.foundation.bounds,triangles:solidTriangles(m.foundation.solid).map(t=>({vertices:t,n:normal(t)}))}));
 return [...armor,...extras,...foundations];
}
export function detectDetailZones(b:ShipBlueprint,surfaces:ArmorSurfaces):DetailZone[] {
 const zones:DetailZone[]=[],style=STYLE[b.shipyardId as keyof typeof STYLE];
 const emit=(id:string,kind:DetailZoneKind,host:string,hint:Vec3,n:Vec3,reason:string,equipmentId?:string,ids?:string[])=>zones.push({id,kind,parentStructureId:host,hint,normal:n,equipmentId,surfaceIds:ids??surfaces.filter(s=>s.structureId===host).map(s=>s.id),allow:zoneKits(kind),density:style.density,reason});
 for(const p of b.prefabPlacements??[]){if(!p.assembly||b.weaponLayout?.prefabIds.includes(p.id))continue;
  const box=boundsOf(p.assembly.parts.flatMap(s=>s.solid.vertices)),hint={x:(box.min.x+box.max.x)/2,y:box.max.y,z:(box.min.z+box.max.z)/2};
  if(p.kind==='MACHINERY_HOUSING')emit(p.id+'/access','SERVICE_CHANNEL',p.socket.hostId,hint,{x:0,y:1,z:0},'Access to the existing service-pump housing, no duplicate machinery',p.id,p.assembly.parts.map(s=>s.id));
  if(p.kind==='SENSOR_HOUSING'){
   if(p.assembly.parts.some(a=>a.role==='COMMAND_HOUSING'))emit(p.id+'/command','COMMAND',p.socket.hostId,{...hint,z:box.max.z-.9},{x:0,y:1,z:0},'Crew access on existing command/sensor housing; no new bridge',p.id,p.assembly.parts.map(s=>s.id));
   emit(p.id+'/sensor','SENSOR',p.socket.hostId,p.id==='command-house'?{x:hint.x,y:(box.min.y+box.max.y)/2,z:box.min.z}:p.socket.position,p.id==='command-house'?{x:0,y:0,z:-1}:p.socket.normal,'Existing protected sensor housing instrument face',p.id,p.assembly.parts.map(s=>s.id));
  }
 }
 for(const c of b.productionDesign?.channels??[]) {
  const floor=c.floor[Math.floor(c.floor.length*.5)];
  emit(c.id,'SERVICE_CHANNEL',c.parentStructureId,floor,{x:0,y:1,z:0},'Stored channel floor and service-pump route; keep center access lane',undefined);
 }
 const engineHosts=[...new Set(b.engines.map(e=>e.parentId))];
 for(const id of engineHosts){const v=b.structuralVolumes.find(v=>v.id===id);if(!v)continue;
  for(const side of[-1,1])emit(id+'/engine-service-'+side,'PROPULSION',id,{x:v.position.x,y:v.position.y,z:v.position.z+v.geometry.stations[0].z+v.dimensions.z*.83},{x:side,y:0,z:0},'Flank of actual engine host; exhaust remains reserved',b.engines.find(e=>e.parentId===id)!.id);
 }
 for(const m of b.weaponLayout?.mounts??[]){if(m.category!=='CANNON'&&m.category!=='MISSILE')continue;
  const origin=add(add(m.position,mul(m.frame.right,m.footprint.width*.50)),mul(m.frame.normal,-m.foundation.height*.55));
  emit(m.id+'/service',m.category==='MISSILE'?'MISSILE_BAY':'WEAPON_PRIMARY',m.contacts[0].structureId,origin,m.frame.right,'Outer standardized foundation apron; retained muzzle and operating clearance',m.equipment.prefabId,[m.id+'-foundation']);
 }
 for(const v of [...b.structuralVolumes].filter(v=>v.type!=='SPINE').sort((a,c)=>c.dimensions.x*c.dimensions.y*c.dimensions.z-a.dimensions.x*a.dimensions.y*a.dimensions.z).slice(0,4)){
  for(const [end,direction]of[[.18,{x:0,y:-1,z:0}],[.81,{x:1,y:0,z:0}]] as const){const hint={...v.position,z:v.position.z+v.geometry.stations[0].z+v.dimensions.z*end};
   emit(v.id+'/rcs-'+end,'MANEUVERING',v.id,hint,direction,'Separated actual closed-host fore/aft attitude-control station; visual reservation only');
   if(direction.x===1)emit(v.id+'/rcs-port','MANEUVERING',v.id,hint,{x:-1,y:0,z:0},'Paired side control station',undefined);
  }
 }
 for(const c of (b.productionDesign?.armor??[]).filter(c=>['SIDE_BELT','CITADEL','BELLY_CITADEL','VENTRAL_KEEL'].includes(c.role)).slice(0,8)){
  const hint={x:(c.bounds.min.x+c.bounds.max.x)/2,y:(c.bounds.min.y+c.bounds.max.y)/2,z:(c.bounds.min.z+c.bounds.max.z)/2},n=c.role==='SIDE_BELT'?{x:hint.x<0?-1:1,y:0,z:0}:c.role.includes('BELLY')||c.role==='VENTRAL_KEEL'?{x:0,y:-1,z:0}:{x:0,y:1,z:0};
  emit(c.id+'/joint','ARMOR_JOINT',c.parentStructureId,hint,n,'A service-fastener cluster on the existing large armor interface, not a tiled skin');
 }
 const largest=[...b.structuralVolumes].filter(v=>v.type!=='SPINE').sort((a,c)=>c.dimensions.x*c.dimensions.z-a.dimensions.x*a.dimensions.z)[0];
 if(largest)for(const end of[-1,1]){emit(largest.id+'/axial-rcs-'+end,'MANEUVERING',largest.id,{...largest.position,z:largest.position.z+largest.geometry.stations[end<0?0:largest.geometry.stations.length-1].z},{x:0,y:0,z:end},'Closed end-cap attitude station outside propulsion/spinal openings');}
 if(largest)for(const end of[-1,1])emit(largest.id+'/cap-service-'+end,'GENERAL_HULL',largest.id,{...largest.position,z:largest.position.z+largest.geometry.stations[end<0?0:largest.geometry.stations.length-1].z},{x:0,y:0,z:end},'Limited end-cap inspection access, omitted around actual engine/spinal aperture');
 return zones;
}
