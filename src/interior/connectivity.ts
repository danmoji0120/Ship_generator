import type {ConvexCell} from '../physical/types';
import {cellVolume,faceNormal,cellBounds} from '../physical/convex';
import {boundsIndex} from '../generation/hardpoint-system/geometry';
import {dot} from '../generation/integration/contours';
import {area} from '../generation/armor/panels';
import {paddedBounds,clipPolygonToCell} from './geometry';
/** A common finite face, rather than coincident centers or bounding boxes, connects void cells. */
export function connectedVoidCells(cells:ConvexCell[]){
 const parents=cells.map((_,i)=>i),root=(i:number):number=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 const faces=cells.flatMap((cell,i)=>cell.faces.map(poly=>({i,cell,poly,normal:faceNormal(poly),bounds:paddedBounds(poly)}))),near=boundsIndex(faces);
 for(const f of faces)for(const g of near(f.bounds)){
  if(g.i>=f.i||root(f.i)===root(g.i)||dot(f.normal,g.normal)>-.999999||Math.abs(dot(f.normal,g.poly[0])-dot(f.normal,f.poly[0]))>1e-6)continue;
  const intersection=clipPolygonToCell(f.poly,g.cell);
  if(intersection.length>=3&&area(intersection)>1e-8)parents[root(f.i)]=root(g.i);
 }
 const groups=new Map<number,ConvexCell[]>();for(let i=0;i<cells.length;i++){const id=root(i);if(!groups.has(id))groups.set(id,[]);groups.get(id)!.push(cells[i]);}
 return [...groups.values()].map(cells=>({cells,volumeM3:cells.reduce((n,c)=>n+cellVolume(c),0)})).sort((a,b)=>b.volumeM3-a.volumeM3);
}
