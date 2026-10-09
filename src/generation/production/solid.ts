import type{Vec3}from'../../blueprint/types';
import{solidFromRings}from'../armor/panels';
/** Station rings may have a concave contact contour. Ear-clipped caps retain every
 * boundary vertex instead of extending a fan across the underlying hull profile. */
export function stationSolid(rings:Vec3[][]){
 const s=solidFromRings(rings),n=rings[0].length;s.indices=s.indices.slice(0,(rings.length-1)*n*6);
 for(const[end,reverse]of[[0,true],[rings.length-1,false]]as const){const r=rings[end],remaining=r.map((_,i)=>i),tri:number[][]=[],turn=(a:number,b:number,c:number)=>(r[b].x-r[a].x)*(r[c].y-r[a].y)-(r[b].y-r[a].y)*(r[c].x-r[a].x);
  while(remaining.length>3){let found=false;for(let i=0;i<remaining.length;i++){const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];if(turn(a,b,c)<1e-8)continue;
   if(remaining.some(p=>p!==a&&p!==b&&p!==c&&turn(a,b,p)>=-1e-8&&turn(b,c,p)>=-1e-8&&turn(c,a,p)>=-1e-8))continue;
   tri.push([a,b,c]);remaining.splice(i,1);found=true;break;}
   if(!found)throw Error('Contact contour cannot be triangulated safely');
  }
  if(turn(...remaining as [number,number,number])<1e-8)throw Error('Degenerate contact cap');tri.push(remaining);
  for(const t of tri){const[a,b,c]=t.map(i=>end*n+i);s.indices.push(...(reverse?[a,c,b]:[a,b,c]));}
 }
 return s;
}
