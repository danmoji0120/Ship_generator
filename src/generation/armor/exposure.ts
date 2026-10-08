import type {Vec3} from '../../blueprint/types';
import {armorTriangles} from './geometry';
import {normal,cross,area} from './panels';
import {dot,sub} from '../integration/contours';
/** Cached exact closed-contour containment. Supports the existing oblique housing contours.
 * Convex contours use actual face planes; concave contours use deterministic triangle-ray parity.
 * This is an exposure test, not Boolean CSG or a structural strength model.
 */
export function contourContains(rings:Vec3[][]) {
 const triangles=armorTriangles(rings).filter(t=>area(t)>1e-10),vertices=rings.flat();
 const planes=triangles.map(t=>({p:t[0],n:normal(t)}));
 const convex=planes.every(f=>vertices.every(p=>dot(f.n,sub(p,f.p))<1e-6));
 const ray={x:1,y:.3713907,z:.529817};
 return (p:Vec3,tolerance=0)=>{
  if(convex)return planes.every(f=>dot(f.n,sub(p,f.p))<=tolerance);
  const hits:number[]=[];
  for(const [a,b,c]of triangles){
   const e1=sub(b,a),e2=sub(c,a),h=cross(ray,e2),det=dot(e1,h);if(Math.abs(det)<1e-10)continue;
   const s=sub(p,a),u=dot(s,h)/det;if(u< -1e-9||u>1+1e-9)continue;
   const q=cross(s,e1),v=dot(ray,q)/det;if(v< -1e-9||u+v>1+1e-9)continue;
   const distance=dot(e2,q)/det;if(distance>1e-7)hits.push(distance);
  }
  hits.sort((a,b)=>a-b);
  return hits.filter((t,i)=>i===0||Math.abs(t-hits[i-1])>1e-6).length%2===1;
 };
}
