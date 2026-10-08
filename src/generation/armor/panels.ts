import type { Vec3 } from '../../blueprint/types';
import type { PanelSolid } from './types';
import {add,sub,mul,dot,unit,center} from '../integration/contours';
export const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export const normal=(p:Vec3[])=>unit(cross(sub(p[1],p[0]),sub(p[2],p[0])));
export const area=(p:Vec3[])=>{let a=0;for(let i=1;i<p.length-1;i++)a+=Math.hypot(...Object.values(cross(sub(p[i],p[0]),sub(p[i+1],p[0]))))/2;return a;};
export const scalePolygon=(p:Vec3[],ratio:number)=>{const c=center(p);return p.map(v=>add(c,mul(sub(v,c),ratio)));};
/** Closed convex prism. The bottom is embedded, bevel slopes inward to a lower, broad cap. */
export function panelSolid(root:Vec3[],n:Vec3,thickness:number,inset:number,chamfer:number):{solid:PanelSolid;top:Vec3[]} {
 const bottom=root.map(p=>add(p,mul(n,-inset))), rim=root.map(p=>add(p,mul(n,thickness*(1-chamfer))));
 const top=scalePolygon(root,1-chamfer*.12).map(p=>add(p,mul(n,thickness)));
 return {solid:solidFromRings([bottom,rim,top]),top};
}
export function solidFromRings(rings:Vec3[][]):PanelSolid {
 const vertices=rings.flat(),indices:number[]=[],n=rings[0].length;
 // Rings have CCW winding viewed from their outward normal, unlike legacy XY station rings.
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=(j+1)*n+i,d=(j+1)*n+(i+1)%n;indices.push(a,b,c,b,d,c);}
 for(let i=1;i<n-1;i++){indices.push(0,i+1,i);const o=(rings.length-1)*n;indices.push(o,o+i,o+i+1);}
 return {vertices,indices};
}
export function solidTriangles(s:PanelSolid):[Vec3,Vec3,Vec3][] {const a:[Vec3,Vec3,Vec3][]=[];for(let i=0;i<s.indices.length;i+=3)a.push(s.indices.slice(i,i+3).map(j=>s.vertices[j]) as [Vec3,Vec3,Vec3]);return a;}
/** Half-plane tests in a true surface plane; no AABB attachment decisions. */
export function inPolygon(poly:Vec3[],p:Vec3,n:Vec3,tolerance=0) {
 return poly.every((a,i)=>dot(cross(sub(poly[(i+1)%poly.length],a),sub(p,a)),n)>=-tolerance);
}
export function inPanel(s:PanelSolid,p:Vec3,tolerance=0) {
 return solidTriangles(s).every(([a,b,c])=>dot(normal([a,b,c]),sub(p,a))<=tolerance);
}
export function verticalHit(poly:Vec3[],n:Vec3,x:number,z:number):Vec3|undefined {
 if(n.y<.12)return;const p={x,y:poly[0].y-(n.x*(x-poly[0].x)+n.z*(z-poly[0].z))/n.y,z};
 return inPolygon(poly,p,n,1e-6)?p:undefined;
}

/** Clip a real planar hull triangle into longitudinal / transverse panel courses. */
export function clipPlane(poly:Vec3[],axis:'x'|'y'|'z',value:number,positive:boolean) {
 const result:Vec3[]=[];
 for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],a=positive?p[axis]-value:value-p[axis],b=positive?q[axis]-value:value-q[axis];
 if(a>=-1e-8)result.push(p);if((a>1e-8&&b< -1e-8)||(a< -1e-8&&b>1e-8)){const t=a/(a-b);result.push(add(p,mul(sub(q,p),t)));}}
 return result.filter((p,i)=>Math.hypot(...Object.values(sub(p,result[(i+result.length-1)%result.length])))>1e-7);
}
export function panelCourses(poly:Vec3[],axis:'x'|'y'|'z',step:number,phase=0) {
 const min=Math.min(...poly.map(p=>p[axis])),max=Math.max(...poly.map(p=>p[axis]));if(max-min<step*1.25)return [poly];
 const pieces:Vec3[][]=[];let cursor=min;
 for(let cut=(Math.floor((min-phase)/step)+1)*step+phase;cut<max-step*.12;cut+=step){if(cut-cursor<step*.12)continue;const piece=clipPlane(clipPlane(poly,axis,cursor,true),axis,cut,false);if(piece.length>=3&&area(piece)>1e-7)pieces.push(piece);cursor=cut;}
 const last=clipPlane(poly,axis,cursor,true);if(last.length>=3&&area(last)>1e-7)pieces.push(last);return pieces;
}
export function clipHalfSpace(poly:Vec3[],n:Vec3,d:number,positive:boolean) {
 if(poly.every(p=>Math.abs(dot(p,n)-d)<1e-8))return positive?poly:[];
 const result:Vec3[]=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],a=positive?dot(p,n)-d:d-dot(p,n),b=positive?dot(q,n)-d:d-dot(q,n);if(a>=-1e-8)result.push(p);if(a*b< -1e-16)result.push(add(p,mul(sub(q,p),a/(a-b))));}
 return result.filter((p,i)=>Math.hypot(...Object.values(sub(p,result[(i+result.length-1)%result.length])))>1e-7);
}
