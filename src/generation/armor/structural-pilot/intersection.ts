import type {StructuralArmorComponent} from './types';
import {solidTriangles,normal,verticalHit,inPolygon} from '../panels';
/** Intersect real stored triangle planes, supporting non-flat faceted decks. */
export function surfaceHit(components:StructuralArmorComponent[],x:number,z:number) {
  let best:{y:number;id:string}|undefined;
  for(const c of components)for(const t of solidTriangles(c.solid)){
    const n=normal(t);if(n.y<.1)continue;
    const p=verticalHit(t,n,x,z);if(p&&(!best||p.y>best.y))best={y:p.y,id:c.id};
  }
  return best;
}

/** Lowest outward-facing underside triangle, independently of the upper mounting surface. */
export function undersideHit(components:StructuralArmorComponent[],x:number,z:number) {
  let best:{y:number;id:string}|undefined;
  for(const c of components)for(const t of solidTriangles(c.solid)){
    const n=normal(t);if(n.y>-.1)continue;
    const p={x,y:t[0].y-(n.x*(x-t[0].x)+n.z*(z-t[0].z))/n.y,z};
    if(inPolygon(t,p,n,1e-6)&&(!best||p.y<best.y))best={y:p.y,id:c.id};
  }
  return best;
}

/** Cut the stored solid at an axial plane, including its actual triangle edges. */
export function sectionEdges(c:StructuralArmorComponent,z:number) {
  const points:import('../../../blueprint/types').Vec3[]=[];
  for(const tri of solidTriangles(c.solid))for(let i=0;i<3;i++){
    const a=tri[i],b=tri[(i+1)%3];
    if(Math.abs(a.z-z)<1e-7)points.push(a);
    if((a.z-z)*(b.z-z)<0){const t=(z-a.z)/(b.z-a.z);points.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z});}
  }
  if(!points.length)throw Error(`No structural section ${c.id} at ${z}`);
  return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x))};
}
