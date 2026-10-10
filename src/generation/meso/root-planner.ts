import type {ShipBlueprint,Vec3} from '../../blueprint/types';
import type {ArmorSurfaces} from '../weapons/surfaces';
import {surfaceRay,worldPoint} from '../weapons/surfaces';
import {detailFrame} from '../details/geometry';
import {add,sub,mul,dot,unit} from '../integration/contours';
import type {MesoZone,RootVariant} from './types';
/** Measure a contiguous local support interval, rather than using a parent bounding box. */
export function availableFootprint(surfaces:ArmorSurfaces,p:Vec3,n:Vec3,parent:string,max:number){
 const frame=detailFrame(n),span=(axis:Vec3)=>Math.min(...[-1,1].map(sign=>{let usable=0;for(let d=max/12;d<=max+.001;d+=max/12){const hit=surfaceRay(surfaces,add(p,mul(axis,d*sign)),n);if(!hit||hit.structureId!==parent||dot(hit.normal,n)<.88||Math.abs(dot(sub(hit.position,p),n))>max*.18)break;usable=d;}return usable;}))*2;
 return {width:span(frame.right),length:span(frame.forward)};
}
export function engineRootZones(b:ShipBlueprint,surfaces:ArmorSurfaces):MesoZone[]{
 const zones:MesoZone[]=[];
 for(const e of b.engines){
  const axis=unit(e.direction??{x:0,y:0,z:1}),basis=detailFrame(axis),radius=e.nozzleRadius,reach=Math.max(radius*3,b.order.length*.025);
  // Rear cap candidates lie outside the protected nozzle radius. Flank candidates
  // are upstream of the actual nozzle root, not an arbitrary hull-percent station.
  for(const [i,a]of Array.from({length:8},(_,i)=>i*Math.PI/4).entries())for(const [ring,factor]of [1.7,1.85,2.6].entries()){
   const radial=add(mul(basis.right,Math.cos(a)),mul(basis.forward,Math.sin(a))),hint=add(e.position,mul(radial,radius*factor));
   const hit=surfaceRay(surfaces,hint,axis);if(!hit||hit.structureId!==e.parentId||Math.abs(dot(sub(hit.position,e.position),axis))>radius*.65)continue;
   const free=availableFootprint(surfaces,hit.position,hit.normal,e.parentId,reach*.5);
   const variant:RootVariant=free.width>=radius*.9&&free.length>=radius*1.25?'WIDE_ROOT_FAIRING':free.width>=radius*.35&&free.length>=radius*.8?'NARROW_ROOT_FAIRING':'LOW_PROFILE_TRANSITION';
   zones.push({id:`meso-root/${e.id}/cap-${i}-${ring}`,kind:'PROPULSION_ROOT',parentStructureId:e.parentId,parentSurfaceId:hit.surfaceId,equipmentId:e.id,hint:hit.position,normal:hit.normal,availableAreaM2:free.width*free.length,allowed:['ENGINE_ROOT_TRANSITION'],reason:'Actual engine root cap support outside nozzle/exhaust; measured contiguous footprint',candidateCount:0,root:{engineId:e.id,position:{...e.position},direction:axis,radius,nozzleLength:e.nozzleLength,bellRatio:e.bellRatio,variant,clusterId:`root-cluster/${e.id}`,availableWidth:free.width,availableLength:free.length}});
  }
  for(const i of [0,2,4,6]){
   const a=i*Math.PI/4,radial=add(mul(basis.right,Math.cos(a)),mul(basis.forward,Math.sin(a))),hint=add(e.position,mul(axis,-Math.max(radius*.7,e.nozzleLength*.5))),hit=surfaceRay(surfaces,hint,radial);
   if(!hit||hit.structureId!==e.parentId||Math.hypot(...Object.values(sub(hit.position,e.position)))>reach)continue;
   const free=availableFootprint(surfaces,hit.position,hit.normal,e.parentId,reach*.5);
   zones.push({id:`meso-root/${e.id}/upstream-${i}`,kind:'PROPULSION_ROOT',parentStructureId:e.parentId,parentSurfaceId:hit.surfaceId,equipmentId:e.id,hint:hit.position,normal:hit.normal,availableAreaM2:free.width*free.length,allowed:['ENGINE_ROOT_TRANSITION'],reason:'Actual upstream supply fairing using exposed host surface and engine axis',candidateCount:0,root:{engineId:e.id,position:{...e.position},direction:axis,radius,nozzleLength:e.nozzleLength,bellRatio:e.bellRatio,variant:'LOW_PROFILE_TRANSITION',clusterId:`root-cluster/${e.id}`,availableWidth:free.width,availableLength:free.length}});
  }
 }
 return zones.sort((a,c)=>a.equipmentId!.localeCompare(c.equipmentId!)||Math.hypot(...Object.values(sub(a.hint,a.root!.position)))-Math.hypot(...Object.values(sub(c.hint,c.root!.position))));
}
/** Connector endpoints are source evidence. Never create a gallery without an open channel. */
export function junctionZones(b:ShipBlueprint,surfaces:ArmorSurfaces):MesoZone[]{
 const kind=({'SPINE_AND_MODULES':'SPINE_MODULE_JUNCTION','TRUSS_POD':'TRUSS_POD_ROOT','CORE_AND_NACELLES':'CORE_NACELLE_ROOT','TWIN_HULL':'TWIN_HULL_INTERFACE','HYBRID':'HYBRID_JUNCTION'} as const)[b.architecture.grammar as 'HYBRID'];if(!kind)return[];
 const zones:MesoZone[]=[];
 for(const c of b.structuralConnectors)for(const [parent,p]of[[c.fromStructureId,c.start],[c.toStructureId,c.end]] as const){
  const host=b.structuralVolumes.find(v=>v.id===parent);if(!host||host.type==='SPINE')continue;
  // Actual endpoint neighborhood; sample top/bottom/flank directions, then use
  // the measured hit normal for all footprint/contact operations.
  for(const [i,n]of [{x:0,y:1,z:0},{x:0,y:-1,z:0},{x:-1,y:0,z:0},{x:1,y:0,z:0}].entries()){
   const into=sub(host.position,p),distance=Math.hypot(...Object.values(into)),hint=distance>1e-6?add(p,mul(into,Math.min(b.order.length*.025,distance*.2)/distance)):p;
   const hit=surfaceRay(surfaces,hint,n);if(!hit||hit.structureId!==parent||Math.hypot(...Object.values(sub(hit.position,p)))>Math.max(host.dimensions.x,host.dimensions.y)*.7+c.thickness)continue;
   const free=availableFootprint(surfaces,hit.position,hit.normal,parent,Math.min(b.order.length*.06,Math.max(host.dimensions.x,host.dimensions.y)*.3));
   zones.push({id:`meso-junction/${c.id}/${parent}/${i}`,kind,parentStructureId:parent,parentSurfaceId:hit.surfaceId,connectorId:c.id,hint:hit.position,normal:hit.normal,availableAreaM2:free.width*free.length,allowed:[n.y<0?'VENTRAL_KEEL_SUPPORT':'ARMOR_SHOULDER_EXTENSION'],reason:'Measured exposed support near actual '+c.type+' connector endpoint; preserve open frame',candidateCount:0});
  }
 }
 return zones;
}
export function omissionCategory(reason:string):string{
 if(/budget|evaluation opportunity/.test(reason))return'BUDGET_EXHAUSTED';if(/exhaust|Reserved opening.*engine/.test(reason))return'EXHAUST_CLEARANCE';if(/firing|Weapon operating|XL space/.test(reason))return'WEAPON_CLEARANCE';if(/access|sensor/.test(reason))return'ACCESS_BLOCKED';if(/negative-space/.test(reason))return'NEGATIVE_SPACE';if(/safety replay/.test(reason))return'VALIDATION_REPLAY_FAILURE';if(/patch|boundary/.test(reason))return'INVALID_STATION_PATCH';if(/footprint|meso-sized/.test(reason))return'INSUFFICIENT_FOOTPRINT';if(/interference|collision|crosses|Intrusion|Reserved opening/.test(reason))return'EQUIPMENT_INTERFERENCE';return'NO_EXPOSED_SURFACE';
}
