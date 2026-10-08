import type {StructuralVolume,Vec3} from '../../../blueprint/types';
import type {StructuralArmorComponent} from './types';
import {boundsOf,sectionRing} from '../../integration/contours';
import {solidFromRings} from '../panels';
import {curve,type Form} from './geometry';

/** Dedicated lower station surface; axis-aligned, world-positioned and independent of deck mounts. */
export function ventralBodyBuilder(hull:StructuralVolume,components:StructuralArmorComponent[],l:number) {
  const inset=l*.003;
  const halfWidth=(z:number)=>{const r=sectionRing(hull,z);return(Math.max(...r.map(p=>p.x))-Math.min(...r.map(p=>p.x)))/2;};
  const hullBottom=(x:number,z:number)=>{
    const r=sectionRing(hull,z),ys:number[]=[];
    for(let i=0;i<r.length;i++){
      const a=r[i],d=r[(i+1)%r.length];
      if(x>=Math.min(a.x,d.x)-1e-7&&x<=Math.max(a.x,d.x)+1e-7&&Math.abs(d.x-a.x)>1e-9)ys.push(a.y+(d.y-a.y)*(x-a.x)/(d.x-a.x));
    }
    if(!ys.length)throw Error(`No actual ventral station surface at ${x}/${z}`);
    return Math.min(...ys);
  };
  function body(id:string,role:StructuralArmorComponent['role'],z0:number,z1:number,left:number,right:number,depth:number,form:Form,adjacent:StructuralVolume[]=[]) {
    const parents=[hull,...adjacent];
    const at=(z:number)=>parents.find(v=>z>=v.position.z+v.geometry.stations[0].z-1e-7&&z<=v.position.z+v.geometry.stations.at(-1)!.z+1e-7);
    const surface=(z:number)=>{const v=at(z);if(!v)throw Error(`No ventral parent at ${id}/${z}`);return v===hull?{halfWidth,hullBottom}:ventralBodyBuilder(v,[],l);};
    const candidates=[z0,z1,...[...(form.width??[]),...(form.rise??[])].map(k=>z0+k[0]*(z1-z0)),...parents.flatMap(v=>v.geometry.stations.map(s=>s.z+v.position.z)).filter(z=>z>z0&&z<z1),...adjacent.flatMap(v=>[v.position.z+v.geometry.stations[0].z,v.position.z+v.geometry.stations.at(-1)!.z]).flatMap(z=>[z-1e-4,z+1e-4]).filter(z=>z>z0&&z<z1)].sort((a,d)=>a-d);
    const zs=candidates.filter((z,i)=>!i||z-candidates[i-1]>l*1e-8),contactSamples:Vec3[]=[];
    const rings=zs.map(z=>{
      const {halfWidth:widthAt,hullBottom:bottomAt}=surface(z);
      const t=(z-z0)/(z1-z0),w=Math.min(widthAt(z),adjacent.length?hull.dimensions.x*.5:Infinity),mid=hull.position.x+(left+right)*w*.5,span=(right-left)*w*curve(form.width,t),a=mid-span*.5,d=mid+span*.5;
      const ya=bottomAt(a,z),yd=bottomAt(d,z),drop=depth*curve(form.rise,t),bevel=span*(form.bevel??.18);
      // Root perimeter embeds into the actual lower station; broad bevels lead to a thick lower land.
      const ring=[{x:a,y:ya+inset,z},{x:d,y:yd+inset,z},{x:d,y:yd-drop*.65,z},{x:d-bevel,y:yd-drop,z},{x:a+bevel,y:ya-drop,z},{x:a,y:ya-drop*.65,z}].reverse();
      for(const x of [a+span*.15,mid,d-span*.15])contactSamples.push({x,y:bottomAt(x,z)+inset*.5,z});
      return ring;
    });
    components.push({id,role,parentStructureId:hull.id,additionalParentIds:adjacent.length?adjacent.map(v=>v.id):undefined,rings,solid:solidFromRings(rings),contactSamples,inset,bounds:boundsOf(rings.flat())});
  }
  return {body,halfWidth,hullBottom};
}
