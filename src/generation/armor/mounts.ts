import type {ShipBlueprint,Vec3} from '../../blueprint/types';
import type {ArmorSegment} from './types';
import {verticalHit,solidFromRings,inPolygon,inPanel} from './panels';
import {add,mul,sub,dot,basis,boundsOf,center} from '../integration/contours';
/** Resolve a planned external mount onto final armor; never delete or regenerate panels. */
export function mountArmorHardpoints(b:ShipBlueprint) {
 const armor=b.layeredArmor!,panels=armor.assemblies.flatMap(a=>a.segments);
 const hitAt=(x:number,z:number,parentId?:string)=>panels.filter(s=>(!parentId||s.parentStructureId===parentId)&&s.orientation.y>.12&&x>=s.bounds.min.x-1e-7&&x<=s.bounds.max.x+1e-7&&z>=s.bounds.min.z-1e-7&&z<=s.bounds.max.z+1e-7).map(s=>({s,p:verticalHit(s.topPolygon,s.orientation,x,z)})).filter(q=>q.p).sort((a,d)=>d.p!.y-a.p!.y)[0];
 const placed:{position:Vec3;radius:number}[]=[];
 const footprint=(type:string,r:number)=>r*(['Missile','Sensor'].includes(type)?1.8:1.25);
 for(const h of b.hardpoints) {
  if(h.type==='Spinal')continue;
  const original={...h.position},oldNormal={...h.normal};
  let hit=hitAt(h.position.x,h.position.z),adapted=false;
  if(!hit){const closest=panels.filter(s=>s.parentStructureId===h.parentId&&s.orientation.y>.12).map(s=>({s,p:center(s.topPolygon)})).sort((a,d)=>Math.hypot(a.p.x-h.position.x,a.p.z-h.position.z)-Math.hypot(d.p.x-h.position.x,d.p.z-h.position.z))[0];if(closest){hit=closest;adapted=true;}}
  if(!hit)throw new Error(`No armor mount surface for ${h.id}; armor retained`);
  const clearanceRadius=footprint(h.type,h.radius);
  const contacts=new Map<string,{hit:ReturnType<typeof hitAt>;elevation:number}[]>();
  const contactAt=(p:Vec3)=>{
   const key=`${p.x}/${p.y}/${p.z}`;
   let samples=contacts.get(key);
   if(!samples){samples=Array.from({length:8},(_,i)=>{const angle=i*Math.PI/4,q=hitAt(p.x+Math.sin(angle)*h.radius*1.10,p.z+Math.cos(angle)*h.radius*1.10);return {hit:q,elevation:q?q.p!.y-p.y:0};});contacts.set(key,samples);}
   return samples;
  };
  const available=(p:Vec3)=>{
   if(!placed.every(q=>Math.hypot(p.x-q.position.x,p.z-q.position.z)>=clearanceRadius+q.radius+b.order.length*.0001))return false;
   const samples=contactAt(p),limit=Math.max(b.order.length*.006,h.radius*.6);
   return samples.filter(s=>s.hit).length>=6&&Math.max(b.order.length*.0025,h.radius*.12,...samples.map(s=>s.elevation+b.order.length*.001))<=limit;
  };
  if(!available(hit.p!)) {
   const anchor={...hit.p!},directions=[[0,-1],[0,1],[-1,0],[1,0],[-.707,-.707],[.707,-.707],[-.707,.707],[.707,.707]];
   let alternative:typeof hit|undefined;
   for(let step=1;step<=12&&!alternative;step++)for(const [dx,dz]of directions){
    const distance=clearanceRadius*(1.5+step*.8),candidate=hitAt(anchor.x+dx*distance,anchor.z+dz*distance);
    if(candidate&&available(candidate.p!)){alternative=candidate;break;}
   }
   if(!alternative){
    for(const s of [...panels].filter(s=>s.orientation.y>.12).sort((a,d)=>{const p=center(a.topPolygon),q=center(d.topPolygon);return Math.hypot(p.x-anchor.x,p.z-anchor.z)-Math.hypot(q.x-anchor.x,q.z-anchor.z);})){const p=center(s.topPolygon),candidate=hitAt(p.x,p.z);if(candidate&&available(candidate.p!)){alternative=candidate;break;}}
   }
   if(!alternative)throw new Error(`No unoccupied armor mount surface for ${h.id}; panels retained`);
   hit=alternative;adapted=true;
  }
  const chosen=hit.s,point=hit.p!,n=chosen.orientation,{u,v}=basis(n);
  if(h.parentId!==chosen.parentStructureId){h.parentId=chosen.parentStructureId;adapted=true;}
  const radius=h.radius*1.10;
  const mountNormal={x:0,y:1,z:0};
  // A faceted foundation levels a surface-normal socket into a stable outward mount plane.
  // This prevents slope-following placeholder directions from firing into a higher adjacent deck.
  const horizontal=basis(mountNormal);
  // Contact footprint spans multiple panels. Roots sample the highest final armor / integration face.
  const roots:Vec3[]=[],supportIds=new Set<string>([chosen.id]);
  const samples=Array.from({length:8},(_,i)=>{const angle=i*Math.PI/4;return add(point,add(mul(horizontal.u,Math.cos(angle)*radius),mul(horizontal.v,Math.sin(angle)*radius)));});
  const elevations=samples.map(p=>{const q=hitAt(p.x,p.z);if(q){supportIds.add(q.s.id);return q.p!.y-point.y;}return -chosen.thickness;});
  const height=Math.max(b.order.length*.0025,h.radius*.12,...elevations.map(e=>e+b.order.length*.001));
  samples.forEach((p,i)=>roots.push({x:p.x,y:point.y+elevations[i]-Math.min(chosen.thickness*.12,b.order.length*.0003),z:p.z}));
  const top=samples.map(p=>({x:p.x,y:point.y+height,z:p.z})),solid=solidFromRings([roots,top]);
  const attach=add(point,mul(mountNormal,height));
  const surface=armor.surfaces.find(s=>s.id===chosen.surfaceId)!;
  const a=surface.triangle[0],e1=sub(surface.triangle[1],a),e2=sub(surface.triangle[2],a),d=sub(point,a),den=dot(e1,e1)*dot(e2,e2)-dot(e1,e2)**2;
  const baryB=(dot(d,e1)*dot(e2,e2)-dot(d,e2)*dot(e1,e2))/den,baryC=(dot(d,e2)*dot(e1,e1)-dot(d,e1)*dot(e1,e2))/den;
  h.surfaceMount={armorId:chosen.id,surfaceId:chosen.surfaceId,socketId:`armor-socket-${h.id}`,position:point,normal:n,tangent:u,mountNormal,originalHullPosition:original,originalHullNormal:oldNormal,footprint:radius,localCoordinates:[1-baryB-baryC,baryB,baryC],foundation:{id:`armor-foundation-${h.id}`,solid,bounds:boundsOf(solid.vertices),height,contactPoints:roots,supportedArmorIds:[...supportIds]},clearance:{radius:clearanceRadius,depth:h.radius*3,direction:mountNormal,status:'accepted'}};
  h.position=attach;h.normal=mountNormal;
  placed.push({position:attach,radius:clearanceRadius});
  armor.mountDecisions.push({hardpointId:h.id,status:adapted?'adapted':'accepted',reason:adapted?'Moved to a valid unoccupied armor cap; panels unchanged':'Foundation fitted above completed armor; panels unchanged'});
 }
 const mountPoints=b.hardpoints.flatMap(h=>{
  if(!h.surfaceMount)return [];
  // Bounds follow the existing placeholder contract, including fixed-length VLS hatch heights.
  const l=b.order.length,r=h.radius;
  const halfX=h.type==='Sensor'?r*1.4:h.type==='Missile'?r*1.1:r*1.16;
  const halfZ=h.type==='Sensor'?r*.95:h.type==='Missile'?r*1.3:r*1.16;
  const low=h.type==='Sensor'?l*.001-r*.6:h.type==='Missile'?-l*.0005:-r*.08;
  const high=h.type==='Sensor'?l*.001+r*.6:h.type==='Missile'?l*.00575:Math.max(r*.355,r*.25+l*.0005);
  return [...h.surfaceMount.foundation.solid.vertices,
    {x:h.position.x-halfX,y:h.position.y+low,z:h.position.z-halfZ},
    {x:h.position.x+halfX,y:h.position.y+high,z:h.position.z+halfZ}];
 });
 armor.overallBounds=boundsOf([...mountPoints,armor.overallBounds.min,armor.overallBounds.max]);
}
