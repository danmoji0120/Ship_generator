import type{ShipBlueprint,Vec3}from'../../blueprint/types';
import type{PanelSolid}from'../armor/types';
import type{MountFrame,SurfaceContact,MountStandard,MountRegion,WeaponGroupPlan}from'./types';
import{solidTriangles,normal,inPolygon,cross,solidFromRings}from'../armor/panels';
import{add,sub,mul,dot,unit,boundsOf}from'../integration/contours';
import{profileRing}from'../hull';
export const REGION_NORMAL:Record<MountRegion,Vec3>={TOP:{x:0,y:1,z:0},BOTTOM:{x:0,y:-1,z:0},PORT:{x:-1,y:0,z:0},STARBOARD:{x:1,y:0,z:0}};
export function mountFrame(n:Vec3):MountFrame{
 const normal=unit(n),forward=unit(sub({x:0,y:0,z:-1},mul(normal,dot({x:0,y:0,z:-1},normal))));
 if(Math.hypot(forward.x,forward.y,forward.z)<.9)throw Error('Mount surface parallel to longitudinal axis');
 return{normal,forward,right:unit(cross(forward,normal))};
}
/** Positive-handed local X=right, Y=normal, Z=aft. No forced world-up correction. */
export const worldPoint=(origin:Vec3,f:MountFrame,p:Vec3)=>add(origin,add(add(mul(f.right,p.x),mul(f.normal,p.y)),mul(f.forward,-p.z)));
export const worldDirection=(f:MountFrame,p:Vec3)=>worldPoint({x:0,y:0,z:0},f,p);
export const localPoint=(origin:Vec3,f:MountFrame,p:Vec3)=>{const q=sub(p,origin);return{x:dot(q,f.right),y:dot(q,f.normal),z:-dot(q,f.forward)};};
export const transformSolid=(s:PanelSolid,origin:Vec3,f:MountFrame):PanelSolid=>({vertices:s.vertices.map(p=>worldPoint(origin,f,p)),indices:[...s.indices]});
export function armorSurfaces(b:ShipBlueprint){
 const shapes:{id:string;structureId:string;solid:PanelSolid}[]=[];
 for(const v of b.structuralVolumes){
  if(Object.values(v.rotation).some(x=>Math.abs(x)>1e-8))throw Error('Review mounting requires axis-aligned source Hull');
  shapes.push({id:v.id,structureId:v.id,solid:solidFromRings(v.geometry.stations.map(s=>profileRing(s).reverse().map(([x,y])=>({x:x+v.position.x,y:y+v.position.y,z:s.z+v.position.z}))))});
 }
 for(const c of b.structuralArmorPilot?.components??[])shapes.push({id:c.id,structureId:c.parentStructureId,solid:c.solid});
 for(const p of b.prefabPlacements??[])if(p.assembly&&p.functionality==='protection')for(const part of p.assembly.parts)shapes.push({id:part.id,structureId:p.socket.hostId,solid:part.solid});
 return shapes.map(s=>({...s,box:boundsOf(s.solid.vertices),triangles:solidTriangles(s.solid).map(t=>({vertices:t,n:normal(t)}))}));
}
export type ArmorSurfaces=ReturnType<typeof armorSurfaces>;
function lineMeetsBounds(p:Vec3,d:Vec3,b:ArmorSurfaces[number]['box']){
 let lo=-Infinity,hi=Infinity;
 for(const k of['x','y','z']as const){
  if(Math.abs(d[k])<1e-12){if(p[k]<b.min[k]-1e-5||p[k]>b.max[k]+1e-5)return false;}
  else{const a=(b.min[k]-1e-5-p[k])/d[k],c=(b.max[k]+1e-5-p[k])/d[k];lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));if(lo>hi)return false;}
 }
 return true;
}
/** Ray/triangle first exterior hit. Bounds only accelerate rejection, never decide contact. */
export function surfaceRay(surfaces:ArmorSurfaces,p:Vec3,d:Vec3):SurfaceContact|undefined{
 let best:SurfaceContact|undefined,bestDistance=-Infinity;
 for(const s of surfaces){if(!lineMeetsBounds(p,d,s.box))continue;for(const{vertices:t,n}of s.triangles){
  const den=dot(n,d);if(den<.15)continue;
  const distance=dot(n,sub(t[0],p))/den;if(distance<=bestDistance)continue;
  const q=add(p,mul(d,distance));
  if(inPolygon(t,q,n,1e-6)){bestDistance=distance;best={surfaceId:s.id,structureId:s.structureId,position:q,normal:n};}
 }}
 return best;
}
export function resolveFoundation(surfaces:ArmorSurfaces,hint:Vec3,region:MountRegion,s:MountStandard,alignment?:{normal:Vec3;position?:Vec3}){
 if(s.mode!=='SURFACE')throw Error('XL uses the existing integrated spinal contract, not a surface turret');
 const center=surfaceRay(surfaces,hint,REGION_NORMAL[region]);if(!center)throw Error('No exposed mount surface');
 if(dot(center.normal,REGION_NORMAL[region])<.65)throw Error('Surface faces a different region');
 const frame=mountFrame(alignment?.normal??center.normal),w=s.footprint.width/2,l=s.footprint.length/2,c=.16;
 const uv=[[-w*(1-c),-l],[w*(1-c),-l],[w,-l*(1-c)],[w,l*(1-c)],[w*(1-c),l],[-w*(1-c),l],[-w,l*(1-c)],[-w,-l*(1-c)]];
 const probes=[...uv,[0,0],[-w*.5,0],[w*.5,0],[0,-l*.5],[0,l*.5],[-w*.5,-l*.5],[w*.5,-l*.5],[-w*.5,l*.5],[w*.5,l*.5]];
 const contacts=probes.map(([u,v])=>{
  const p=add(alignment?.position??center.position,add(mul(frame.right,u),mul(frame.forward,v))),hit=surfaceRay(surfaces,p,frame.normal);
  if(!hit||dot(hit.normal,frame.normal)<.85||Math.abs(dot(sub(hit.position,center.position),frame.normal))>2.5)throw Error('Insufficient coherent installation footprint');
  return hit;
 });
 const outer=contacts.slice(0,8),offset=Math.max(...contacts.map(p=>dot(sub(p.position,center.position),frame.normal)))+s.foundationHeight;
 const position=alignment?.position??add(center.position,mul(frame.normal,offset)),root=outer.map(p=>sub(p.position,mul(frame.normal,.18))),cap=uv.map(([u,v])=>add(position,add(mul(frame.right,u*.94),mul(frame.forward,v*.94))));
 const bevel=cap.map(p=>sub(p,mul(frame.normal,s.foundationHeight*.2))),solid=solidFromRings([root,bevel,cap]);
 const height=Math.max(...contacts.map(c=>dot(sub(position,c.position),frame.normal)));
 if(Math.min(...contacts.map(c=>dot(sub(position,c.position),frame.normal)))<s.foundationHeight-1e-6||height>s.foundationHeight+2.5)throw Error('Paired foundation cannot safely absorb surface relief');
 return{position,frame,contacts,orientationPolicy:alignment?'PAIRED_SURFACE_AVERAGE' as const:'MEASURED_SURFACE' as const,footprint:{...s.footprint,polygon:outer.map(p=>p.position)},foundation:{solid,bounds:boundsOf(solid.vertices),inset:.18,height}};
}

/** Paired installation planes derive from BOTH measured surface normals. Contact roots remain
 * independently seated; neither mount is forced to world-up or independently jittered. */
export function resolveGroupFoundations(surfaces:ArmorSurfaces,group:WeaponGroupPlan,shift:number,standards:(size:WeaponGroupPlan['members'][number]['size'])=>MountStandard){
 const result=new Map<string,ReturnType<typeof resolveFoundation>>(),hints=new Map(group.members.map(m=>[m.id,{...m.hint,z:m.hint.z+shift}]));
 const reflect=(p:Vec3)=>({...p,x:-p.x});
 for(const m of group.members){if(result.has(m.id))continue;
  const first=resolveFoundation(surfaces,hints.get(m.id)!,m.region,standards(m.size));
  if(group.symmetry!=='BILATERAL'){result.set(m.id,first);continue;}
  const mate=group.members.find(d=>d.id!==m.id&&d.size===m.size&&d.category===m.category&&d.hint.z===m.hint.z&&d.hint.x===-m.hint.x&&(m.region==='PORT'?d.region==='STARBOARD':m.region==='STARBOARD'?d.region==='PORT':d.region===m.region));
  if(!mate)throw Error('Missing paired mount');
  const second=resolveFoundation(surfaces,hints.get(mate.id)!,mate.region,standards(mate.size));
  const n=unit(add(first.frame.normal,reflect(second.frame.normal)));
  const a=resolveFoundation(surfaces,hints.get(m.id)!,m.region,standards(m.size),{normal:n}),d=resolveFoundation(surfaces,hints.get(mate.id)!,mate.region,standards(mate.size),{normal:reflect(n)});
  const average=mul(add(a.position,reflect(d.position)),.5),pose=add(average,mul(n,Math.max(dot(sub(a.position,average),n),dot(sub(reflect(d.position),average),n))+.02));
  result.set(m.id,resolveFoundation(surfaces,hints.get(m.id)!,m.region,standards(m.size),{normal:n,position:pose}));
  result.set(mate.id,resolveFoundation(surfaces,hints.get(mate.id)!,mate.region,standards(mate.size),{normal:reflect(n),position:reflect(pose)}));
 }
 return result;
}
