import type {ShipBlueprint,Vec3} from '../../blueprint/types';
import {armorSurfaces,surfaceRay,type ArmorSurfaces} from '../weapons/surfaces';
import {detailFrame} from '../details/geometry';
import {add,sub,mul,dot,boundsOf,unit} from '../integration/contours';
import {cross,normal,solidTriangles} from '../armor/panels';
import {inReservedZone} from '../integration/reservations';

import {kitPartAppearance,functionalPartAppearance,type MaterialLanguage} from '../../rendering/appearance';
import {SURFACE_PROFILES,surfaceHash} from './profile';
import type {DecalPlacement,SurfaceAppearancePlan,FinishProfile} from './types';
/** Paint only: no surface is generated, displaced, cut or reserved by this stage. */
export function applySurfaceAppearance(b:ShipBlueprint,finish:FinishProfile='CLEAN',onTimings?:(t:{surfacesMs:number;metadataMs:number;placementMs:number;totalMs:number})=>void):ShipBlueprint {
 const start=performance.now();
 const language=b.shipyardId as MaterialLanguage,style=SURFACE_PROFILES[language];if(!style)throw Error('Unsupported surface language');
 const seed=surfaceHash(`ship-surface-v1/${b.seed}/${b.designName}/${language}`),code=({aegis:'AN',vesper:'VD',forge:'FU',serein:'SS'}[language])+'-'+String(b.seed%10000).padStart(4,'0');
 const surfaces=armorSurfaces(b),known=new Set(surfaces.map(s=>s.id));
 const parts=(b.prefabPlacements??[]).flatMap(p=>(p.assembly?.parts??[]).map(part=>({...part,parent:p.socket.hostId}))).concat((b.exteriorDetailPlan?.kitPlacements??[]).flatMap(p=>p.assembly.parts.map(part=>({...part,parent:p.parentStructureId}))));
 for(const part of parts)if(!known.has(part.id))surfaces.push({id:part.id,structureId:part.parent,solid:part.solid,box:part.bounds,triangles:solidTriangles(part.solid).map(t=>({vertices:t,n:normal(t)}))});
 const surfaceEnd=performance.now();
 const plan:SurfaceAppearancePlan={version:'1.8.5.2',language,finish,texture:{namespace:'ship-surface-v1',seed,grainPeriodMeters:style.grain,tileResolution:128,projection:'OBJECT_LOCAL_TRIPLANAR'},componentVariations:[],decals:[],decisions:[],policy:{maximumDecals:48,atlasWidth:512,rowHeight:32,defaultFinish:'CLEAN',visibility:'derivative-filtered / physical footprint'}};
 const materialRoles=new Map(parts.map(p=>[p.id,functionalPartAppearance(p.role,p.material).material] as const));
 for(const kit of b.exteriorDetailPlan?.kitPlacements??[])for(const part of kit.assembly.parts)materialRoles.set(part.id,kitPartAppearance(kit.kit,part.role).material);
 const roles=new Map([...(b.productionDesign?.armor??[]).map(c=>[c.id,c.role] as const),...(b.productionDesign?.finish??[]).map(c=>[c.id,'BROAD_FINISH'] as const),...parts.map(p=>[p.id,p.role] as const)]);
 for(const s of surfaces){if(!roles.has(s.id))continue;const role=roles.get(s.id)!,material=materialRoles.get(s.id)??functionalPartAppearance(role,'armor').material,semantic=/KEEL|VENTRAL/.test(role)?-.05:/SIDE_BELT/.test(role)?-.018:/COMMAND/.test(role)?.018:0;
  plan.componentVariations.push({parentId:s.id,role:material,tone:semantic+((surfaceHash(`${seed}/${s.id}`)%10001)/10000-.5)*.075*style.contrast,wearEligible:/JOINT|CRADLE|SIDE_BELT|ACCESS|SERVICE|ENGINE|BRACKET/.test(role),reason:role});
 }
 const metadataEnd=performance.now();
 // Final solid projection intervals are invariant across candidate offsets on the same plane.
 const projections=new Map<string,{id:string;u0:number;u1:number;v0:number;v1:number;n0:number;n1:number}[]>();
 function obstacles(n:Vec3,right:Vec3,up:Vec3){const key=[n,right,up].flatMap(Object.values).map(v=>v.toFixed(7)).join('/');let cached=projections.get(key);if(cached)return cached;cached=surfaces.map(s=>{let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity,n0=Infinity,n1=-Infinity;for(const p of s.solid.vertices){const u=dot(p,right),v=dot(p,up),h=dot(p,n);u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v);n0=Math.min(n0,h);n1=Math.max(n1,h);}return{id:s.id,u0,u1,v0,v1,n0,n1};});projections.set(key,cached);return cached;}
 function place(s:ArmorSurfaces[number],kind:DecalPlacement['kind'],text:string,desired:number,height:number,preferred:Vec3,visibility:DecalPlacement['visibility'],reason:string){
  const targetSurfaces=[s];
  const id=`paint-${plan.decisions.length}-${kind}`,attempt=(why:string)=>plan.decisions.push({id,parentId:s.id,status:'omitted',reason:why});
  if(plan.decals.length>=48){attempt('Decal density budget');return;}
  const planeKeys=new Set<string>();
  const span=(t:typeof s.triangles[number])=>{const f=s.solid.vertices.filter(v=>Math.abs(dot(sub(v,t.vertices[0]),t.n))<.002),b=boundsOf(f);return (b.max.x-b.min.x)*(b.max.y-b.min.y)+(b.max.x-b.min.x)*(b.max.z-b.min.z)+(b.max.y-b.min.y)*(b.max.z-b.min.z);};
  const planes=s.triangles.filter(t=>{const key=[t.n.x,t.n.y,t.n.z,dot(t.n,t.vertices[0])].map(x=>x.toFixed(4)).join('/');if(planeKeys.has(key)||dot(t.n,preferred)<=.60)return false;planeKeys.add(key);return true;}).sort((a,c)=>span(c)-span(a));
  for(const t of planes){const n=t.n,frame=detailFrame(n);let right=Math.abs(n.x)>.6?frame.forward:frame.right,up=unit(cross(n,right));if(Math.abs(n.y)<.6&&up.y<0){right=mul(right,-1);up=mul(up,-1);}
   const face=s.solid.vertices.filter(v=>Math.abs(dot(sub(v,t.vertices[0]),n))<.002);if(face.length<3)continue;
   const xs=face.map(p=>dot(p,right)),ys=face.map(p=>dot(p,up)),w=Math.min(desired,(Math.max(...xs)-Math.min(...xs))*.64),h=Math.min(height,(Math.max(...ys)-Math.min(...ys))*.48,w*9/Math.max(5,text.length*6-1));
   if(w<desired*.48||h<height*.48||w<(kind==='MAINTENANCE'||kind==='HAZARD'?.18:1.1)||h<(kind==='MAINTENANCE'||kind==='HAZARD'?.06:.20))continue;
   const center=add(add(mul(right,(Math.max(...xs)+Math.min(...xs))/2),mul(up,(Math.max(...ys)+Math.min(...ys))/2)),mul(n,dot(t.vertices[0],n)));
   // Try coherent alternatives on the SAME protected region; never force a label over a weapon/opening.
   for(const offset of[0,-.18,.18]){
    const p=add(center,mul(right,offset*(Math.max(...xs)-Math.min(...xs)))),contacts:DecalPlacement['contacts']=[];let valid=true;
    for(const x of[-.5,0,.5])for(const y of[-.5,0,.5]){
     const q=add(p,add(mul(right,w*x),mul(up,h*y))),hit=surfaceRay(targetSurfaces,q,n);
     if(!hit||hit.surfaceId!==s.id||dot(hit.normal,n)<.995||Math.abs(dot(sub(hit.position,q),n))>.025||(b.productionDesign?.zones??[]).some(z=>inReservedZone(q,z))||(b.weaponLayout?.mounts??[]).some(m=>(['x','y','z'] as const).every(k=>q[k]>=m.equipment.bounds.min[k]&&q[k]<=m.equipment.bounds.max[k]))){valid=false;break;}
     contacts.push({position:hit.position,surfaceId:hit.surfaceId});
    }
    if(!valid)continue;
    // Footprint broad phase against all FINAL equipment/detail solids: catches thin rails between contact probes.
    const pu=dot(p,right),pv=dot(p,up),pn=dot(p,n);
    if(obstacles(n,right,up).some(o=>o.id!==s.id&&o.n1>pn+.04&&o.u1>pu-w/2&&o.u0<pu+w/2&&o.v1>pv-h/2&&o.v0<pv+h/2))continue;
    if(plan.decals.some(d=>d.parentId===s.id&&dot(d.normal,n)>.95))continue; // one marking per contiguous face, not dense stamps
    plan.decals.push({id,parentId:s.id,parentStructureId:s.structureId,kind,text,position:p,normal:n,right,up,size:{width:w,height:h},contacts,visibility,color:kind==='HAZARD'?'WARNING':'MARKING',reason});
    plan.decisions.push({id,parentId:s.id,status:'accepted',reason:'Nine exposed triangle contacts; footprint does not cross an armor step or reserved opening'});return;
   }
  }
  attempt('No exposed coplanar readable footprint outside equipment/opening reservations');
 }
 const armor=surfaces.filter(s=>b.productionDesign?.armor.some(c=>c.id===s.id));
 for(const side of[-1,1]){const candidates=armor.filter(s=>/SIDE_BELT|SHOULDER/.test(roles.get(s.id)??'')).sort((a,c)=>((c.box.max.z-c.box.min.z)*(c.box.max.y-c.box.min.y))-((a.box.max.z-a.box.min.z)*(a.box.max.y-a.box.min.y)));
  for(const s of candidates){const before=plan.decals.length;place(s,'IDENTIFICATION',code,Math.min(30,b.order.length*.11)*style.markScale,Math.min(6.8,b.order.length*.024)*style.markScale,{x:side,y:0,z:0},'FAR','Large naval side identification; derived code is not a globally unique registration');if(plan.decals.length>before)break;}
 }
 for(const direction of[{x:0,y:1,z:0},{x:0,y:-1,z:0}]){
  const candidates=armor.filter(s=>!/SIDE_BELT|TRANSITION|JOINT/.test(roles.get(s.id)??'')).sort((a,c)=>(c.box.max.x-c.box.min.x)*(c.box.max.z-c.box.min.z)-(a.box.max.x-a.box.min.x)*(a.box.max.z-a.box.min.z));
  for(const s of candidates){const before=plan.decals.length;place(s,'IDENTIFICATION',code,Math.min(22,b.order.length*.09)*style.markScale,Math.min(6,b.order.length*.021)*style.markScale,direction,'FAR','Dorsal / ventral ship identity on actual armor mass');if(plan.decals.length>before)break;}
 }
 for(const s of armor.filter(s=>/COMMAND|KEEL|CRADLE|CITADEL|SHOULDER/.test(roles.get(s.id)??'')).slice(0,10)){
  const n=/KEEL|VENTRAL/.test(roles.get(s.id)??'')?{x:0,y:-1,z:0}:{x:0,y:1,z:0};
  place(s,'COMPARTMENT','A'+String(surfaceHash(s.id)%100).padStart(2,'0'),Math.min(5,b.order.length*.023),Math.min(1.2,b.order.length*.007),n,'MEDIUM','Armor component compartment code');
 }
 for(const kit of b.exteriorDetailPlan?.kitPlacements??[]){if(!['ACCESS_HATCH','MACHINE_ACCESS_COVER','SERVICE_PORT','DRONE_DOCK','MISSILE_CELL_DETAIL','ENGINE_SERVICE_FRAME','RECESSED_SERVICE_PANEL'].includes(kit.kit))continue;
  const part=kit.assembly.parts.find(a=>/INSET/.test(a.role))??kit.assembly.parts.find(a=>/CORE|CROSS/.test(a.role))??kit.assembly.parts.find(a=>/SEAT/.test(a.role));const s=part&&surfaces.find(a=>a.id===part.id);if(!s)continue;
  const hazard=kit.kit==='MISSILE_CELL_DETAIL',word=hazard?'CAUTION':kit.kit==='DRONE_DOCK'?'DRONE':kit.kit==='MACHINE_ACCESS_COVER'?'HOT':`S${String(surfaceHash(kit.id)%100).padStart(2,'0')}`;
  place(s,hazard?'HAZARD':'MAINTENANCE',word,.9,.22,kit.attachment.normal,'NEAR',kit.functionalConnection);
 }
 // Yard insignia uses its own silhouette and lives on a command housing, never on a sensor lens/window.
 for(const s of surfaces.filter(s=>roles.get(s.id)==='COMMAND_HOUSING'))place(s,'SHIPYARD',language.toUpperCase(),Math.min(2.5,b.order.length*.012),.6,{x:0,y:1,z:0},'MEDIUM','Shipyard geometric insignia on command roof');
 b.materialAppearance=plan;b.generatorVersion='1.8.5.2';onTimings?.({surfacesMs:surfaceEnd-start,metadataMs:metadataEnd-surfaceEnd,placementMs:performance.now()-metadataEnd,totalMs:performance.now()-start});return b;
}
