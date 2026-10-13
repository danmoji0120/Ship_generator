import type {ShipBlueprint,Hardpoint,Vec3} from '../blueprint/types';
import type {ArmorSurfaces} from '../generation/weapons/surfaces';
import {surfaceRay,worldPoint} from '../generation/weapons/surfaces';
import {detailFrame} from '../generation/details/geometry';
import {add,sub,mul,dot,unit,boundsOf} from '../generation/integration/contours';
import {solidFromRings} from '../generation/armor/panels';
import {solidsIntrude,geometrySamples,solidContains} from '../generation/weapons/collision';
import type {PreviewPart} from '../equipment-preview/geometry';
import type {PreviewEquipment} from '../equipment-preview/library';
import type {PlatformRecipe,PlatformKind,SurfaceAnchor} from './types';
export const PLATFORM_ORDER:PlatformKind[]=['DIRECT','FLUSH_BASE','RAISED_BARBETTE','SIDE_SPONSON','BOX_PLATFORM','PYLON_BRACE'];
export function orientedFrame(n:Vec3,heading:number){const f=detailFrame(n),a=heading*Math.PI/180;return detailFrame(n,add(mul(f.forward,Math.cos(a)),mul(f.right,Math.sin(a))));}
const ring=(w:number,l:number)=>[[-w*.42,-l*.5],[w*.42,-l*.5],[w*.5,-l*.42],[w*.5,l*.42],[w*.42,l*.5],[-w*.42,l*.5],[-w*.5,l*.42],[-w*.5,-l*.42]];
/** Reconstructs a closed chamfered support from measured surface roots; no GPU data saved. */
export function platformPart(id:string,r:PlatformRecipe):PreviewPart & {role:"FOUNDATION"}{
 const roots=r.contacts.slice(0,8).map(c=>sub(c.position,mul(r.frame.normal,.08)));
 const shoulder=ring(r.width,r.length).map(([x,z])=>worldPoint(r.position,r.frame,{x:x*.97,y:-Math.min(.2,r.height*.16),z:z*.97}));
 const cap=ring(r.width,r.length).map(([x,z])=>worldPoint(r.position,r.frame,{x,y:0,z}));
 let solid;
 if(r.kind==='PYLON_BRACE'){
  const pieces=[];
  // Each longitudinal support uses four ACTUAL measured roots from its half of the footprint.
  for(const ids of [[0,1,2,7],[3,4,5,6]]){
    const lower=ids.map(i=>roots[i]),upper=ids.map(i=>{const c=r.contacts[i].position,q=sub(c,r.position);return add(r.position,add(mul(r.frame.right,dot(q,r.frame.right)),add(mul(r.frame.forward,dot(q,r.frame.forward)),mul(r.frame.normal,-.22))));});
    pieces.push(solidFromRings([[...lower].reverse(),[...upper].reverse()]));
  }
  pieces.push(solidFromRings([cap.map(p=>sub(p,mul(r.frame.normal,.22))).reverse(),[...cap].reverse()]));
  const vertices:Vec3[]=[],indices:number[]=[];for(const p of pieces){const offset=vertices.length;vertices.push(...p.vertices);indices.push(...p.indices.map(i=>i+offset));}solid={vertices,indices};
 }else if(r.kind==='RAISED_BARBETTE'){
  const tier=ring(r.width*.88,r.length*.88).map(([x,z])=>worldPoint(r.position,r.frame,{x,y:-r.height*.35,z}));
  solid=solidFromRings([[...roots].reverse(),tier.reverse(),shoulder.reverse(),cap.reverse()]);
 }else solid=solidFromRings([[...roots].reverse(),shoulder.reverse(),cap.reverse()]);
 return{id:id+'/platform',role:'FOUNDATION',solid,bounds:boundsOf(solid.vertices)};
}
export function mountForEntry(id:string,e:PreviewEquipment,r:PlatformRecipe,anchor:SurfaceAnchor):Hardpoint{
 return{id,type:e.kind==='GUN'?'Large Turret':'Missile',size:e.size,parentId:anchor.structureId,position:r.position,normal:r.frame.normal,radius:e.footprint.width/2,allowedCategories:[],modular:{frame:r.frame,contacts:r.contacts} as Hardpoint['modular']};
}
export function platformCandidate(b:ShipBlueprint,anchor:SurfaceAnchor,e:PreviewEquipment,heading:number,kind:PlatformKind,surfaces:ArmorSurfaces,ratio=1,raiseTier=0):PlatformRecipe{
 const f=orientedFrame(anchor.normal,heading),w=e.footprint.width,l=e.footprint.length;
 const scale=kind==='DIRECT'?1:ratio;
 const uv=ring(w*scale,l*scale),probes=[...uv,[0,0],[-w*scale*.25,0],[w*scale*.25,0],[0,-l*scale*.25],[0,l*scale*.25]];
 const contacts=probes.map(([x,z])=>{
  const p=worldPoint(anchor.position,f,{x,y:0,z}),hit=surfaceRay(surfaces,p,f.normal);
  if(!hit||hit.structureId!==anchor.structureId||dot(hit.normal,f.normal)<.65||Math.abs(dot(sub(hit.position,anchor.position),f.normal))>Math.max(2,e.footprint.width*.18))throw Error('Support footprint has no continuous exposed parent surface');
  return hit;
 });
 const rel=contacts.map(c=>dot(sub(c.position,anchor.position),f.normal));
 const relief=Math.max(...rel)-Math.min(...rel);
 if(kind==='DIRECT'&&relief>.05)throw Error('Direct contact crosses a surface step');
 let height=kind==='DIRECT'?.08:kind==='FLUSH_BASE'?.35:kind==='RAISED_BARBETTE'?Math.min(2.4,w*.12):kind==='SIDE_SPONSON'?Math.min(3,w*.22):kind==='BOX_PLATFORM'?Math.min(1.7,w*.16):Math.min(5,w*.65);
 if(!Number.isInteger(raiseTier)||raiseTier<0||raiseTier>2)throw Error('Invalid platform elevation tier');
 if(kind!=='DIRECT'&&kind!=='FLUSH_BASE')height=Math.min(6,height+w*.18*raiseTier);
 if(kind==='FLUSH_BASE'&&relief>.5)throw Error('Shallow base cannot resolve measured relief');
 // Shipyard proportion differences are geometry, not palette changes.
 if(kind!=='DIRECT')height*=b.shipyardId==='vesper'?.7:b.shipyardId==='serein'?.8:b.shipyardId==='forge'?1.12:1;
 const lift=Math.max(...rel)+height,position=add(anchor.position,mul(f.normal,lift));
 return{version:1,kind,style:b.shipyardId,position,frame:f,width:w,length:l,height:lift-Math.min(...rel),rootWidth:w*scale,rootLength:l*scale,capHeight:lift,contacts,raiseTier};
}
export function supportIssues(part:PreviewPart,r:PlatformRecipe,scene:{id:string;solid:PreviewPart['solid'];bounds:PreviewPart['bounds']}[],surfaces:ArmorSurfaces){
 const ids=new Set(r.contacts.map(c=>c.surfaceId)),errors:string[]=[];
 for(const s of scene){
  if(!solidsIntrude(part.solid,part.bounds,s.solid,s.bounds))continue;
  if(!ids.has(s.id)){errors.push('Platform intersects '+s.id);continue;}
  // Actual support is exempt only within the measured surface inset, not the whole parent solid.
  for(const q of geometrySamples(part.solid))if(solidContains(s.solid,q)){
   const c=surfaceRay(surfaces,q,r.frame.normal);
   if(!c||!ids.has(c.surfaceId)||dot(sub(q,c.position),r.frame.normal)<-.16){errors.push('Platform penetrates parent beyond support inset '+s.id);break;}
  }
 }
 return [...new Set(errors)];
}
