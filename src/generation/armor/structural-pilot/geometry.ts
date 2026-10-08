import type { StructuralVolume, Vec3 } from '../../../blueprint/types';
import type { StructuralArmorComponent } from './types';
import { boundsOf, sectionRing } from '../../integration/contours';
import { solidFromRings } from '../panels';
import { surfaceHit } from './intersection';
export type Form = { width?: [number,number][]; rise?: [number,number][]; bevel?: number };
export const curve=(knots:[number,number][]|undefined,t:number)=> {
    if(!knots)return 1;
    const j=Math.max(0,Math.min(knots.length-2,knots.findIndex(k=>k[0]>=t)-1));
    const [a,b]=[knots[j],knots[j+1]];return a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0])));
  };

export function armorBodyBuilder(hull:StructuralVolume, components:StructuralArmorComponent[], l:number) {
  const inset=l*.004;
  const ring = (z: number) => sectionRing(hull, z);
  const halfWidth = (z: number) => (Math.max(...ring(z).map(p => p.x))-Math.min(...ring(z).map(p => p.x)))/2;
  function deckY(x: number, z: number) {
    const r = ring(z), ys: number[] = [];
    r.forEach((a, i) => {
      const c = r[(i + 1) % r.length];
      if (x >= Math.min(a.x, c.x) - 1e-7 && x <= Math.max(a.x, c.x) + 1e-7 && Math.abs(c.x - a.x) > 1e-8)
        ys.push(a.y + (c.y - a.y) * (x - a.x) / (c.x - a.x));
    });
    if (!ys.length) throw Error(`No station contact at ${x},${z}`);
    return Math.max(...ys);
  }
  // Every body is a closed faceted longitudinal volume. Bottom perimeter follows actual station surface.
  // Changes in crest height create structural terraces, not raised panel subdivisions.
  function deck(id: string, role: StructuralArmorComponent['role'], z0: number, z1: number,
                inner: number, outer: number, crest: number, side = 0, parentArmorId?: string, form:Form={}) {
    const parent = components.find(c => c.id === parentArmorId);
    const candidates = [...new Set([z0, z0 + 7, ...[...(form.width??[]),...(form.rise??[])].map(k=>z0+k[0]*(z1-z0)), ...hull.geometry.stations.map(s => s.z + hull.position.z).filter(z => z > z0 + 7 && z < z1 - 7), z1 - 7, z1])].sort((a,b) => a-b);
    const zs=candidates.filter((z,i)=>i===0||z-candidates[i-1]>l*1e-8);
    const contacts: Vec3[] = [];
    const rings = zs.map(z => {
      const t=(z-z0)/(z1-z0), w = halfWidth(z), widthScale=curve(form.width,t);
      const a = hull.position.x + (side ? Math.min(side * inner * w, side * outer * w*widthScale) : -outer * w*widthScale);
      const c = hull.position.x + (side ? Math.max(side * inner * w, side * outer * w*widthScale) : outer * w*widthScale);
      const width = c - a, bevel = width * (form.bevel??.16);
      const baseAt = (x: number) => parent ? surfaceHit([parent], x, z)!.y : deckY(x,z);
      const bottomLeft = baseAt(a) - inset, bottomRight = baseAt(c) - inset;
      const edgeTaper = form.rise?curve(form.rise,t):z === z0 || z === z1 ? .30 : 1;
      const h = crest * edgeTaper, leftTop = baseAt(a) + h, rightTop = baseAt(c) + h;
      const points: Vec3[] = [
        {x:a,y:bottomLeft,z}, {x:c,y:bottomRight,z},
        {x:c,y:rightTop-h*.25,z}, {x:c-bevel,y:rightTop,z},
        {x:a+bevel,y:leftTop,z}, {x:a,y:leftTop-h*.25,z},
      ];
      contacts.push({x:(a+c)/2,y:baseAt((a+c)/2)-inset*.5,z},
        {x:a+width*.15,y:baseAt(a+width*.15)-inset*.5,z},
        {x:c-width*.15,y:baseAt(c-width*.15)-inset*.5,z});
      return points;
    });
    components.push({id,role,parentStructureId:hull.id,parentArmorId,rings,solid:solidFromRings(rings),contactSamples:contacts,inset,bounds:boundsOf(rings.flat())});
  }
  return {deck,deckY,halfWidth,ring};
}

/** A broad side belt follows actual sloped station edges; it is not an AABB-face overlay. */
export function addBodyBelt(hull:StructuralVolume,components:StructuralArmorComponent[],id:string,side:number,z0:number,z1:number,l:number) {
  const inset=l*.004, zs=[z0,...hull.geometry.stations.map(s=>s.z+hull.position.z).filter(z=>z>z0&&z<z1),z1],contacts:Vec3[]=[];
  const rings=zs.map(z=>{
    const r=sectionRing(hull,z), ymin=Math.min(...r.map(p=>p.y)),ymax=Math.max(...r.map(p=>p.y));
    const bottom=Math.max(ymin+inset,hull.position.y-hull.dimensions.y*.25),top=Math.min(ymax-inset,hull.position.y+hull.dimensions.y*.33);
    const sideX=(y:number)=>{
      const xs:number[]=[];r.forEach((a,i)=>{const b=r[(i+1)%r.length];if(y>=Math.min(a.y,b.y)&&y<=Math.max(a.y,b.y)&&Math.abs(b.y-a.y)>1e-9)xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));});
      return side<0?Math.min(...xs):Math.max(...xs);
    };
    const a=sideX(bottom)-side*inset,c=sideX(top)-side*inset;
    const t=(z-z0)/(z1-z0),protrude=hull.dimensions.x*.06*curve([[0,.6],[.3,1],[.7,.8],[1,.5]],t),outer=side<0?Math.min(a,c)-protrude:Math.max(a,c)+protrude;
    const bevel=Math.min(protrude*.25,(top-bottom)*.16);
    let points:Vec3[]=[{x:a,y:bottom,z},{x:outer-side*bevel,y:bottom,z},{x:outer,y:bottom+bevel,z},{x:outer,y:top-bevel,z},{x:outer-side*bevel,y:top,z},{x:c,y:top,z}];
    if(side<0)points=points.reverse();
    for(const y of [bottom,(bottom+top)/2,top])contacts.push({x:sideX(y)-side*inset*.5,y,z});
    return points;
  });
  components.push({id,role:'SIDE_BELT',parentStructureId:hull.id,rings,solid:solidFromRings(rings),contactSamples:contacts,inset,bounds:boundsOf(rings.flat())});
}
