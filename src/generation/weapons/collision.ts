import type{ShipBlueprint,Vec3,BoundsData}from'../../blueprint/types';
import type{PanelSolid}from'../armor/types';
import type{WeaponMount}from'./types';
import type{ParametricPrefabAssembly}from'../functional/types';
import{boundsOf,sub,dot,add,mul,mix,unit}from'../integration/contours';
import{solidTriangles,normal,inPolygon,cross}from'../armor/panels';
import{containsStructuralArmor}from'../armor/structural-pilot/validate';
import{equipmentReservations,inReservedZone}from'../integration/reservations';
import{reservationSamples,reservationBounds,overlappingBounds}from'../armor/geometry';
import{armorSurfaces,worldPoint}from'./surfaces';
const inside=(s:PanelSolid,p:Vec3)=>containsStructuralArmor({solid:s}as any,p,-.001);
export function geometrySamples(s:PanelSolid){return solidTriangles(s).flatMap(([a,b,c])=>[a,b,c,mix(a,b,.5),mix(b,c,.5),mix(c,a,.5),mul(add(add(a,b),c),1/3)]);}
const within=(p:Vec3,b:BoundsData)=>(['x','y','z']as const).every(k=>p[k]>=b.min[k]&&p[k]<=b.max[k]);
export function solidsIntrude(a:PanelSolid,ab:BoundsData,b:PanelSolid,bb:BoundsData){
 if(!overlappingBounds(ab,bb))return false;
 return geometrySamples(a).some(p=>within(p,bb)&&inside(b,p))||geometrySamples(b).some(p=>within(p,ab)&&inside(a,p));
}
/** Oriented envelope SAT (15 axes), supplements detailed solid probes. */
export function envelopesOverlap(a:WeaponMount,b:WeaponMount){
 const axes=[a.frame.right,a.frame.normal,a.frame.forward,b.frame.right,b.frame.normal,b.frame.forward];
 for(const u of axes.slice(0,3))for(const v of axes.slice(3,6)){const d=cross(u,v);if(Math.hypot(d.x,d.y,d.z)>1e-7)axes.push(unit(d));}
 const corners=(m:WeaponMount)=>{const box=m.equipment.localBounds;return[box.min.x,box.max.x].flatMap(x=>[box.min.y,box.max.y].flatMap(y=>[box.min.z,box.max.z].map(z=>worldPoint(m.position,m.frame,{x,y,z}))));},ap=corners(a),bp=corners(b);
 return axes.every(axis=>{const av=ap.map(p=>dot(p,axis)),bv=bp.map(p=>dot(p,axis));return Math.min(Math.max(...av),Math.max(...bv))-Math.max(Math.min(...av),Math.min(...bv))>.15;});
}
export function rayBlocked(origin:Vec3,d:Vec3,range:number,solids:{solid:PanelSolid;bounds:BoundsData;id:string}[]){
 const box=boundsOf([origin,add(origin,mul(d,range))]);
 for(const s of solids){if(!overlappingBounds(box,s.bounds))continue;
  for(const t of solidTriangles(s.solid)){const n=normal(t),den=dot(n,d);if(Math.abs(den)<1e-9)continue;const distance=dot(n,sub(t[0],origin))/den;
   if(distance>.03&&distance<range&&inPolygon(t,add(origin,mul(d,distance)),n,1e-7))return s.id;
  }
 }
 return undefined;
}
export function collisionScene(b:ShipBlueprint){
 const armor=armorSurfaces(b).map(s=>({solid:s.solid,bounds:s.box,id:s.id}));
 const machinery=(b.prefabPlacements??[]).filter(p=>p.assembly&&p.functionality!=='protection'&&!b.weaponLayout?.prefabIds.includes(p.id)).flatMap(p=>p.assembly!.parts.map(part=>({solid:part.solid,bounds:part.bounds,id:part.id})));
 return [...armor,...machinery];
}
export function candidateIssues(b:ShipBlueprint,m:WeaponMount,a:ParametricPrefabAssembly,placed:{mount:WeaponMount;assembly:ParametricPrefabAssembly}[],scene=collisionScene(b),stampClearance=false){
 const issues:string[]=[];
 const equipment=a.parts.filter(p=>p.role!=='SURFACE_FOUNDATION');
 for(const p of equipment)for(const s of scene)if(solidsIntrude(p.solid,p.bounds,s.solid,s.bounds)){issues.push(`Equipment ${p.id} intrudes ${s.id}`);break;}
 const zones=equipmentReservations({...b,hardpoints:[]});
 for(const p of a.parts)for(const z of zones)if(overlappingBounds(p.bounds,reservationBounds(z))&&(geometrySamples(p.solid).some(v=>inReservedZone(v,z))||reservationSamples(z).some(v=>within(v,p.bounds)&&inside(p.solid,v))))issues.push(`Protected opening ${z.id}/${p.id}`);
 for(const other of placed){
  if(envelopesOverlap(m,other.mount))issues.push(`Equipment envelopes overlap ${m.id}/${other.mount.id}`);
  if(solidsIntrude(m.foundation.solid,m.foundation.bounds,other.mount.foundation.solid,other.mount.foundation.bounds))issues.push(`Foundations overlap ${m.id}/${other.mount.id}`);
  for(const p of a.parts)for(const q of other.assembly.parts)if(solidsIntrude(p.solid,p.bounds,q.solid,q.bounds)){issues.push(`Installation solids overlap ${p.id}/${q.id}`);break;}
 }
 const targets=[...scene,...a.parts.map(p=>({solid:p.solid,bounds:p.bounds,id:p.id})),...placed.flatMap(o=>o.assembly.parts.map(p=>({solid:p.solid,bounds:p.bounds,id:p.id})))];
 for(const sample of m.firingArc.samples){const blocked=rayBlocked(sample.origin,sample.direction,m.firingArc.rangeMeters,targets);if(stampClearance)sample.clear=!blocked;if(blocked)issues.push(`Firing arc ${m.id} hits ${blocked}`);}
 // Symmetric pair adoption is atomic, but a later installation must also preserve earlier arcs.
 for(const other of placed)for(const sample of other.mount.firingArc.samples){const hit=rayBlocked(sample.origin,sample.direction,other.mount.firingArc.rangeMeters,a.parts.map(p=>({id:p.id,solid:p.solid,bounds:p.bounds})));if(hit)issues.push(`Earlier firing arc ${other.mount.id} hits ${hit}`);}
 for(const channel of b.structuralArmorPilot!.channels){
  const zMin=Math.min(...channel.floor.map(p=>p.z)),zMax=Math.max(...channel.floor.map(p=>p.z));
  if(m.footprint.polygon.some(p=>p.z>=zMin&&p.z<=zMax&&Math.abs(p.x-channel.floor.reduce((s,p)=>s+p.x,0)/channel.floor.length)<channel.width*.48&&p.y>channel.floor[0].y-.2))issues.push(`Maintenance channel footprint ${channel.id}`);
 }
 return [...new Set(issues)];
}
