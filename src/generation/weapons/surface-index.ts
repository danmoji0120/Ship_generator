import type{BoundsData,Vec3}from'../../blueprint/types';
import{boundsOf}from'../integration/contours';
import type{ArmorSurfaces}from'./surfaces';
type Face=ArmorSurfaces[number]['triangles'][number]&{surfaceId:string;structureId:string;box:BoundsData};
interface Node{box:BoundsData;children?:Node[];faces?:Face[]}
const cache=new WeakMap<ArmorSurfaces,Node>();
function meets(p:Vec3,d:Vec3,b:BoundsData){let lo=-Infinity,hi=Infinity;for(const k of['x','y','z']as const){if(Math.abs(d[k])<1e-12){if(p[k]<b.min[k]-1e-5||p[k]>b.max[k]+1e-5)return false;}else{const a=(b.min[k]-p[k])/d[k],c=(b.max[k]-p[k])/d[k];lo=Math.max(lo,Math.min(a,c)-1e-5);hi=Math.min(hi,Math.max(a,c)+1e-5);if(lo>hi)return false;}}return true;}
function build(faces:Face[]):Node{const box=boundsOf(faces.flatMap(f=>[f.box.min,f.box.max]));if(faces.length<=12)return{box,faces};const axis=(['x','y','z']as ('x'|'y'|'z')[]).sort((a,b)=>(box.max[b]-box.min[b])-(box.max[a]-box.min[a]))[0],sorted=[...faces].sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));return{box,children:[build(sorted.slice(0,sorted.length>>1)),build(sorted.slice(sorted.length>>1))]};}
/** Bounds only select triangles; exact triangle/plane contact remains authoritative. */
export function indexedFaces(surfaces:ArmorSurfaces,p:Vec3,d:Vec3){let tree=cache.get(surfaces);if(!tree){tree=build(surfaces.flatMap(s=>s.triangles.map(t=>({...t,surfaceId:s.id,structureId:s.structureId,box:boundsOf(t.vertices)}))));cache.set(surfaces,tree);}const result:Face[]=[];const visit=(n:Node)=>{if(!meets(p,d,n.box))return;if(n.faces)result.push(...n.faces.filter(f=>meets(p,d,f.box)));else n.children?.forEach(visit);};visit(tree);return result;}
