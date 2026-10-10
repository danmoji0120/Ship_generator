import type {Vec3} from '../../blueprint/types';
import type {PanelSolid} from '../armor/types';
import type {MesoPlacement,MesoKind} from './types';
import {solidFromRings} from '../armor/panels';
import {worldPoint} from '../weapons/surfaces';
import {boundsOf,sub,dot,add,mul} from '../integration/contours';
/** Local perimeter is CCW around +Y. Solid is seated into the measured support plane. */
export function mesoPerimeter(w:number,l:number,clip:number,taper=1):Vec3[]{
 const x=w/2,z=l/2,c=clip;
 return [[-x*taper*(1-c),-z],[-x*taper,-z*(1-c)],[-x,z*(1-c)],[-x*(1-c),z],[x*(1-c),z],[x,z*(1-c)],[x*taper,-z*(1-c)],[x*taper*(1-c),-z]].map(([x,z])=>({x,y:0,z}));
}
export function mesoGeometry(id:string,kind:MesoKind,p:MesoPlacement['parameters'],attachment:MesoPlacement['attachment']):MesoPlacement['parts']{
 const parts:MesoPlacement['parts']=[],relief=Math.max(0,...(attachment.rootPatch?.vertices??attachment.contacts.map(c=>c.position)).map(v=>dot(sub(v,attachment.position),attachment.frame.normal)));

 const block=(role:string,w:number,l:number,h:number,x=0,z=0,y=-attachment.inset,ratio=.78,materialRole:MesoPlacement['parts'][number]['materialRole']='SECONDARY_ARMOR')=>{
  const outline=mesoPerimeter(w,l,p.clip,p.taper),rings=[outline.map(a=>({...a,x:a.x+x,y,z:a.z+z})),outline.map(a=>({x:a.x+x,y:y+h*.65,z:a.z+z})),outline.map(a=>({x:a.x*ratio+x,y:y+h,z:a.z*.9+z}))];
  const transformed=rings.map((r,j)=>r.map((a,i)=>j===0&&y===-attachment.inset?{x:attachment.contacts[i].position.x-attachment.frame.normal.x*attachment.inset,y:attachment.contacts[i].position.y-attachment.frame.normal.y*attachment.inset,z:attachment.contacts[i].position.z-attachment.frame.normal.z*attachment.inset}:worldPoint(attachment.position,attachment.frame,{...a,y:a.y+relief})));
  let solid:PanelSolid=solidFromRings(transformed);
  if(y===-attachment.inset&&attachment.rootPatch){
   const patch=attachment.rootPatch,edges=new Map<string,{a:number;b:number;count:number}>();
   for(let i=0;i<patch.indices.length;i+=3)for(let j=0;j<3;j++){const a=patch.indices[i+j],b=patch.indices[i+(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join('/'),e=edges.get(key);if(e)e.count++;else edges.set(key,{a,b,count:1});}
   const boundary=[...edges.values()].filter(e=>e.count===1),order:number[]=[];let cursor:number|undefined=boundary[0]?.a;
   while(cursor!==undefined&&order.length<=boundary.length){if(order.includes(cursor))break;const current:number=cursor;order.push(current);cursor=boundary.find(e=>e.a===current)?.b;}
   if(order.length!==boundary.length||order.length<3)throw Error('Station patch has holes or disconnected boundaries');
   const n=attachment.frame.normal,root=patch.vertices.map(v=>add(v,mul(n,-attachment.inset))),vertices=[...root],indices:number[]=[];
   // Exact clipped station triangles form the bottom, not a planar chord through the hull.
   for(let i=0;i<patch.indices.length;i+=3)indices.push(patch.indices[i],patch.indices[i+2],patch.indices[i+1]);
   const mid=order.map(i=>{const v=sub(patch.vertices[i],attachment.position);return add(attachment.position,add(sub(v,mul(n,dot(v,n))),mul(n,relief+y+h*.65)));});
   const top=order.map(i=>{const v=sub(patch.vertices[i],attachment.position),u=dot(v,attachment.frame.right),z=-dot(v,attachment.frame.forward);return worldPoint(attachment.position,attachment.frame,{x:u*ratio,y:relief+y+h,z:z*.9});});
   const mi=vertices.length;vertices.push(...mid);const ti=vertices.length;vertices.push(...top);const count=order.length;
   for(let i=0;i<count;i++){const j=(i+1)%count;indices.push(order[i],order[j],mi+i,order[j],mi+j,mi+i,mi+i,mi+j,ti+i,mi+j,ti+j,ti+i);}
   const center=vertices.length;vertices.push(worldPoint(attachment.position,attachment.frame,{x:0,y:relief+y+h,z:0}));
   for(let i=0;i<count;i++)indices.push(center,ti+i,ti+(i+1)%count);
   solid={vertices,indices};
  }
  parts.push({id:id+'/'+role,role:'MESO_'+role,materialRole,solid,bounds:boundsOf(solid.vertices)});
 };
 if(kind==='ARMOR_STEP'||kind==='ARMOR_SHOULDER_EXTENSION'){
  block('TERRACE',p.width,p.length,p.height*.52,0,0,-attachment.inset,.84);
  block('RAISED_CREST',p.width*.63,p.length*.62,p.height*.55,0,p.length*.065,p.height*.52-attachment.inset-.035,.72,'PRIMARY_ARMOR');
 }else if(kind==='MACHINERY_GALLERY'||kind==='SERVICE_RECESS_FRAME'){
  // A narrow frame follows the bank of an EXISTING channel. It does not cap its access lane.
  block('CHANNEL_COPING',p.width,p.length,p.height*.22,0,0,-attachment.inset,.88,'MECHANICAL_STRUCTURE');
  // Broad support sill and separated angular rails expose a real space between solids.
  // This space sits on the existing channel bank; no closed hull is claimed to be cut away.
  for(const side of [-1,1])block('GALLERY_RAIL_'+side,p.width*.23,p.length*.82,p.height*.65,side*p.width*.28,0,p.height*.22-attachment.inset-.035,.68);
  block('SERVICE_HEADER',p.width*.74,p.length*.20,p.height*.48,0,p.length*.32,p.height*.22-attachment.inset-.035,.80,'MECHANICAL_STRUCTURE');
 }else if(kind==='WEAPON_BARBETTE_INTEGRATION'){
  block('BARBETTE_APRON',p.width,p.length,p.height,0,0,-attachment.inset,.68);
  block('SUPPLY_HAUNCH',p.width*.52,p.length*.34,p.height*.42,0,p.length*.24,p.height-attachment.inset-.035,.80,'MECHANICAL_STRUCTURE');
 }else if(kind==='ENGINE_ROOT_TRANSITION'){
  block('ENGINE_HAUNCH',p.width,p.length,p.height,0,0,-attachment.inset,.65);
  block('SUPPLY_COVER',p.width*.48,p.length*.45,p.height*.38,0,-p.length*.14,p.height-attachment.inset-.035,.8,'MECHANICAL_STRUCTURE');
 }else if(kind==='FLANK_ARMOR_BELT'){
  block('BELT_OVERLAP',p.width,p.length,p.height,0,0,-attachment.inset,.76);
  block('BELT_JUNCTION',p.width*.58,p.length*.28,p.height*.35,0,p.length*.25,p.height-attachment.inset-.035,.8);
 }else{
  block('KEEL_HAUNCH',p.width,p.length,p.height,0,0,-attachment.inset,.56);
  block('VENTRAL_WEB',p.width*.35,p.length*.57,p.height*.38,0,-p.length*.10,p.height-attachment.inset-.035,.65,'MECHANICAL_STRUCTURE');
 }
 return parts;
}
