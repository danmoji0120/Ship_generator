import type {Vec3} from '../../blueprint/types';
import type {PanelSolid} from '../armor/types';
import {solidFromRings,normal} from '../armor/panels';
import {add,mul,basis,mix} from '../integration/contours';
import {shapeDefinition,shapeStations} from '../shapes/definition';
import {profileRing} from '../hull';
import type {StructuralArmorComponent} from '../armor/structural-pilot/types';

export function facetedBox(position:Vec3,size:Vec3,yaw=0):PanelSolid {
  const def=shapeDefinition('CHAMFERED_BOX',size,.7);def.frontScale=.85;def.rearScale=.95;
  const rings=shapeStations(def).map(s=>profileRing(s).reverse().map(([x,y])=>({x:position.x+x*Math.cos(yaw)+s.z*Math.sin(yaw),y:position.y+y,z:position.z+s.z*Math.cos(yaw)-x*Math.sin(yaw)})));
  return solidFromRings(rings);
}
/** Closed annular casing. No caps across a nozzle, optic or weapon aperture. */
export function annularHousing(center:Vec3,axis:Vec3,outer:number,inner:number,length:number,n=12):PanelSolid {
  const {u,v}=basis(axis),vertices:Vec3[]=[],indices:number[]=[];
  for(const [r,z]of[[outer,-length/2],[outer,length/2],[inner,length/2],[inner,-length/2]])
    for(let i=0;i<n;i++)vertices.push(add(add(center,mul(axis,z)),add(mul(u,r*Math.cos(i*Math.PI*2/n)),mul(v,r*Math.sin(i*Math.PI*2/n)))));
  for(let j=0;j<4;j++)for(let i=0;i<n;i++){
    const a=j*n+i,b=j*n+(i+1)%n,c=(j+1)%4*n+i,d=(j+1)%4*n+(i+1)%n;indices.push(a,b,c,b,d,c);
  }
  return {vertices,indices};
}
/** A few long finishing skins follow the SAME stored crest/belt stations, not a panel grid.
 * Narrow bevel, actual thickness and inward root embed; no change to underlying armor masses. */
export function finishingRibbon(c:StructuralArmorComponent,face:number,thickness:number) {
  const contacts:{position:Vec3;normal:Vec3}[]=[],n=c.rings[0].length;
  const rings=c.rings.map((r,j)=>{
    const next=c.rings[Math.min(j+1,c.rings.length-1)],prev=c.rings[Math.max(j-1,0)];
    const outward=j<c.rings.length-1?normal([r[face],r[(face+1)%n],next[face]]):normal([prev[face],prev[(face+1)%n],r[face]]);
    const a=mix(r[face],r[(face+1)%n],.025),d=mix(r[face],r[(face+1)%n],.975);
    for(const p of[a,mix(a,d,.5),d])contacts.push({position:p,normal:outward});
    return [add(a,mul(outward,-.12)),add(d,mul(outward,-.12)),add(d,mul(outward,thickness*.7)),add(mix(a,d,.99),mul(outward,thickness)),add(mix(a,d,.01),mul(outward,thickness)),add(a,mul(outward,thickness*.7))];
  });
  // Face order follows the parent perimeter; the ribbon extrusion is reversed relative
  // to an XY volume for some face normals. Orient the complete closed solid explicitly.
  const solid=solidFromRings(rings);let volume=0;
  for(let i=0;i<solid.indices.length;i+=3){const[a,b,c]=solid.indices.slice(i,i+3).map(k=>solid.vertices[k]);volume+=(a.x*(b.y*c.z-b.z*c.y)+a.y*(b.z*c.x-b.x*c.z)+a.z*(b.x*c.y-b.y*c.x))/6;}
  if(volume<0)for(let i=0;i<solid.indices.length;i+=3)[solid.indices[i+1],solid.indices[i+2]]=[solid.indices[i+2],solid.indices[i+1]];
  return {solid,contacts};
}
