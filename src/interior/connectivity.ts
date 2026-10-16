import type {ConvexCell} from '../physical/types';
import {cellVolume,faceNormal} from '../physical/convex';
import {boundsIndex} from '../generation/hardpoint-system/geometry';
import {dot} from '../generation/integration/contours';
import {area} from '../generation/armor/panels';
import {paddedBounds,clipPolygonToCell} from './geometry';
/** A common finite face, rather than coincident centers or bounding boxes, connects void cells. */
export function connectedVoidCells(cells:ConvexCell[]){
 const parents=cells.map((_,i)=>i),root=(i:number):number=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 // A face can only meet an oppositely oriented face. Normal bins are a broad
 // phase, never an acceptance test: dot/plane/finite-area checks below are unchanged.
 // dot <= -.999999 implies each component differs from -normal by <=.001415;
 // width .01 and all 27 neighbouring bins therefore cannot omit a valid pair.
 const faces=cells.flatMap((cell,i)=>cell.faces.map(poly=>({i,cell,poly,normal:faceNormal(poly),bounds:paddedBounds(poly)})));
 type Face=typeof faces[number];
 const key=(x:number,y:number,z:number)=>`${x}/${y}/${z}`,bins=new Map<string,Face[]>();
 for(const f of faces){const k=key(Math.floor(f.normal.x*100),Math.floor(f.normal.y*100),Math.floor(f.normal.z*100));if(!bins.has(k))bins.set(k,[]);bins.get(k)!.push(f);}
 const indices=new Map([...bins].map(([k,fs])=>[k,boundsIndex(fs)]));
 for(const f of faces){const x=Math.floor(-f.normal.x*100),y=Math.floor(-f.normal.y*100),z=Math.floor(-f.normal.z*100);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
   const near=indices.get(key(x+dx,y+dy,z+dz));if(!near)continue;
   for(const g of near(f.bounds)){
    if(g.i>=f.i||root(f.i)===root(g.i)||dot(f.normal,g.normal)>-.999999||Math.abs(dot(f.normal,g.poly[0])-dot(f.normal,f.poly[0]))>1e-6)continue;
    const intersection=clipPolygonToCell(f.poly,g.cell);
    if(intersection.length>=3&&area(intersection)>1e-8)parents[root(f.i)]=root(g.i);
   }
  }
 }
 const groups=new Map<number,ConvexCell[]>();for(let i=0;i<cells.length;i++){const id=root(i);if(!groups.has(id))groups.set(id,[]);groups.get(id)!.push(cells[i]);}
 return [...groups.values()].map(cells=>({cells,volumeM3:cells.reduce((n,c)=>n+cellVolume(c),0)})).sort((a,b)=>b.volumeM3-a.volumeM3);
}
