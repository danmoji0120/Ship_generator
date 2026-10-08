import type {ShipBlueprint,Vec3} from '../../../blueprint/types';
import type {StructuralArmorComponent,StructuralArmorPilot} from './types';
import {boundsOf,sectionRing} from '../../integration/contours';
import {solidFromRings} from '../panels';
import {curve, type Form} from './geometry';
import {undersideHit} from './intersection';
import {validateStructuralArmorPilot} from './validate';

/** Add a dedicated belly assembly to the reviewed Seed 7 export, preserving its upper geometry
 * and mounts byte-for-byte. This is not a reflection of the upper arrangement or a broad rollout. */
export function buildVentralArmorReview(source:ShipBlueprint):ShipBlueprint {
  if(source.seed!==7||source.shipyardId!=='aegis'||source.role!=='Cruiser'||source.order.length!==300||source.architecture.grammar!=='MONOLITHIC'||source.macroDesign?.family!=='WEDGE_CITADEL'||!source.structuralArmorPilot||source.structuralArmorPilot.ventral)
    throw Error('Ventral review is restricted to the unmodified reviewed Aegis / WEDGE_CITADEL / Seed 7 ship.');
  const b=structuredClone(source),pilot=b.structuralArmorPilot!,hull=b.structuralVolumes[0],l=b.order.length,inset=l*.003;
  const added:StructuralArmorComponent[]=[],sourceComponentIds=pilot.components.map(c=>c.id);
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
  function body(id:string,role:StructuralArmorComponent['role'],z0:number,z1:number,left:number,right:number,depth:number,form:Form) {
    const candidates=[z0,z1,...[...(form.width??[]),...(form.rise??[])].map(k=>z0+k[0]*(z1-z0)),...hull.geometry.stations.map(s=>s.z+hull.position.z).filter(z=>z>z0&&z<z1)].sort((a,d)=>a-d);
    const zs=candidates.filter((z,i)=>!i||z-candidates[i-1]>l*1e-8),contactSamples:Vec3[]=[];
    const rings=zs.map(z=>{
      const t=(z-z0)/(z1-z0),w=halfWidth(z),mid=(left+right)*w*.5,span=(right-left)*w*curve(form.width,t),a=mid-span*.5,d=mid+span*.5;
      const ya=hullBottom(a,z),yd=hullBottom(d,z),drop=depth*curve(form.rise,t),bevel=span*(form.bevel??.18);
      // Root perimeter embeds into the actual lower station; broad bevels lead to a thick lower land.
      const ring=[{x:a,y:ya+inset,z},{x:d,y:yd+inset,z},{x:d,y:yd-drop*.65,z},{x:d-bevel,y:yd-drop,z},{x:a+bevel,y:ya-drop,z},{x:a,y:ya-drop*.65,z}].reverse();
      for(const x of [a+span*.15,mid,d-span*.15])contactSamples.push({x,y:hullBottom(x,z)+inset*.5,z});
      return ring;
    });
    added.push({id,role,parentStructureId:hull.id,rings,solid:solidFromRings(rings),contactSamples,inset,bounds:boundsOf(rings.flat())});
  }
  // A long, narrow load-bearing keel under broad protective masses, rather than a lower command deck.
  body('ventral-keel','VENTRAL_KEEL',-136,130,-.14,.14,23,{width:[[0,.58],[.16,.88],[.40,1],[.72,.88],[1,.55]],rise:[[0,.18],[.18,.62],[.42,1],[.68,1],[.84,.72],[1,.35]],bevel:.18});
  body('ventral-fore-pan','VENTRAL_TRANSITION',-130,-50,-.55,.55,7,{width:[[0,.65],[.3,1],[.8,1],[1,.85]],rise:[[0,.25],[.30,1],[.80,1],[1,.65]],bevel:.18});
  body('belly-port-casemate','BELLY_CITADEL',-61,72,-.64,-.16,12,{width:[[0,.78],[.18,1],[.75,1],[1,.72]],rise:[[0,.5],[.20,1],[.75,1],[1,.55]],bevel:.18});
  body('belly-starboard-fore','BELLY_CITADEL',-61,-8,.16,.64,12,{width:[[0,.78],[.36,1],[1,1]],rise:[[0,.5],[.45,1],[1,1]],bevel:.18});
  body('belly-starboard-aft','BELLY_CITADEL',30,72,.16,.64,12,{width:[[0,1],[.35,1],[1,.72]],rise:[[0,1],[.5,1],[1,.55]],bevel:.18});
  // One bounded service opening: retain the Hull as its recessed roof and an outer, lower sill.
  body('ventral-service-sill','LOWER_HOUSING',-13,35,.59,.68,4.5,{rise:[[0,.8],[.15,1],[.85,1],[1,.8]],bevel:.16});
  body('ventral-drive-cradle','LOWER_HOUSING',65,144,-.38,.38,16,{width:[[0,.84],[.28,1],[.70,.87],[1,.62]],rise:[[0,.50],[.30,1],[.70,1],[1,.25]],bevel:.2});
  pilot.components.push(...added);pilot.revision='ventral-keel-review';
  const levelPositions=[{id:'forward-pan',x:24,z:-95},{id:'belly-casemate',x:-43,z:0},{id:'central-keel',x:0,z:0},{id:'aft-cradle',x:0,z:112}];
  const levels=levelPositions.map(({id,x,z})=>{const hit=undersideHit(added,x,z)!;const hullY=hullBottom(x,z);return{id,position:{x,y:hit.y,z},hullY,exteriorY:hit.y,depth:hullY-hit.y};});
  const floor=[0,10,20].map(z=>{const x=halfWidth(z)*.40;return{x,y:hullBottom(x,z),z};});
  const wallDepths=[{id:'belly-starboard-fore',z:-12},{id:'belly-starboard-aft',z:34}].map(({id,z})=>{
    const x=halfWidth(z)*.40,hit=undersideHit(added.filter(c=>c.id===id),x,z)!;
    return hullBottom(x,z)-hit.y;
  });
  pilot.ventral={sourceComponentIds,componentIds:added.map(c=>c.id),levels,recesses:[{id:'ventral-maintenance-pocket',purpose:'MAINTENANCE',floor,mouthDepth:Math.min(...wallDepths),width:halfWidth(10)*(.59-.16),length:38,boundaryIds:['ventral-keel','belly-starboard-fore','belly-starboard-aft','ventral-service-sill']}]};
  pilot.overallBounds=boundsOf([pilot.overallBounds.min,pilot.overallBounds.max,...added.flatMap(c=>c.solid.vertices)]);
  pilot.validation=validateStructuralArmorPilot(b);
  if(pilot.validation.issues.length)throw Error(pilot.validation.issues.join('; '));
  return b;
}
