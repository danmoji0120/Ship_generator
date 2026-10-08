import type {ShipBlueprint} from '../../../blueprint/types';
import type {StructuralArmorComponent,StructuralArmorPilot} from './types';
import {boundsOf} from '../../integration/contours';
import {ventralBodyBuilder} from './ventral-geometry';
import {undersideHit} from './intersection';
import {containsStructuralArmor,validateStructuralArmorPilot} from './validate';

/** Add a dedicated belly assembly to the reviewed Seed 7 export, preserving its upper geometry
 * and mounts byte-for-byte. This is not a reflection of the upper arrangement or a broad rollout. */
export function buildVentralArmorReview(source:ShipBlueprint):ShipBlueprint {
  if(source.seed!==7||source.shipyardId!=='aegis'||source.role!=='Cruiser'||source.order.length!==300||source.architecture.grammar!=='MONOLITHIC'||source.macroDesign?.family!=='WEDGE_CITADEL'||!source.structuralArmorPilot||source.structuralArmorPilot.ventral)
    throw Error('Ventral review is restricted to the unmodified reviewed Aegis / WEDGE_CITADEL / Seed 7 ship.');
  const b=structuredClone(source),pilot=b.structuralArmorPilot!,hull=b.structuralVolumes[0],l=b.order.length;
  const added:StructuralArmorComponent[]=[],sourceComponentIds=pilot.components.map(c=>c.id);
  const {body,halfWidth,hullBottom}=ventralBodyBuilder(hull,added,l);
  // A long, narrow load-bearing keel under broad protective masses, rather than a lower command deck.
  body('ventral-keel','VENTRAL_KEEL',-143,137,-.14,.14,23,{width:[[0,.16],[.12,.52],[.32,.92],[.52,1],[.74,.92],[1,.42]],rise:[[0,.07],[.12,.36],[.32,.88],[.42,1],[.65,1],[.85,.61],[1,.18]],bevel:.24});
  body('ventral-fore-pan','VENTRAL_TRANSITION',-143,-44,-.55,.55,7,{width:[[0,.12],[.18,.47],[.43,1],[.72,.94],[1,.72]],rise:[[0,.10],[.24,.76],[.43,1],[.80,1],[1,.72]],bevel:.27});
  body('belly-port-casemate','BELLY_CITADEL',-65,82,-.64,-.08,12,{width:[[0,.85],[.20,1],[.68,1],[1,.69]],rise:[[0,.40],[.20,1],[.68,1],[1,.58]],bevel:.24});
  body('belly-starboard-fore','BELLY_CITADEL',-65,-8,.08,.64,12,{width:[[0,.85],[.38,1],[1,1]],rise:[[0,.40],[.45,1],[1,1]],bevel:.24});
  body('belly-starboard-aft','BELLY_CITADEL',30,82,.08,.64,12,{width:[[0,1],[.35,1],[1,.69]],rise:[[0,1],[.50,1],[1,.58]],bevel:.24});
  // One bounded service opening: retain the Hull as its recessed roof and an outer, lower sill.
  body('ventral-service-sill','LOWER_HOUSING',-13,35,.59,.68,4.5,{rise:[[0,.8],[.15,1],[.85,1],[1,.8]],bevel:.16});
  body('ventral-drive-cradle','LOWER_HOUSING',58,145,-.48,.48,16,{width:[[0,.82],[.24,1],[.56,.92],[.80,.73],[1,.48]],rise:[[0,.55],[.24,1],[.67,1],[1,.12]],bevel:.28});
  pilot.components.push(...added);pilot.revision='ventral-flow-review';
  const levelPositions=[{id:'forward-pan',x:24,z:-95},{id:'belly-casemate',x:-43,z:0},{id:'central-keel',x:0,z:0},{id:'aft-cradle',x:0,z:112}];
  const levels=levelPositions.map(({id,x,z})=>{const hit=undersideHit(added,x,z)!;const hullY=hullBottom(x,z);return{id,parentStructureId:hull.id,position:{x,y:hit.y,z},hullY,exteriorY:hit.y,depth:hullY-hit.y};});
  const floor=[0,10,20].map(z=>{const x=halfWidth(z)*.40;return{x,y:hullBottom(x,z),z};});
  const wallDepths=[{id:'belly-starboard-fore',z:-12},{id:'belly-starboard-aft',z:34}].map(({id,z})=>{
    const x=halfWidth(z)*.40,hit=undersideHit(added.filter(c=>c.id===id),x,z)!;
    return hullBottom(x,z)-hit.y;
  });
  pilot.ventral={sourceComponentIds,componentIds:added.map(c=>c.id),levels,recesses:[{id:'ventral-maintenance-pocket',purpose:'MAINTENANCE',floor,mouthDepth:Math.min(...wallDepths),width:halfWidth(10)*(.59-.14),length:38,boundaryIds:['ventral-keel','belly-starboard-fore','belly-starboard-aft','ventral-service-sill']}]};
  // Broad mating probes belong to BOTH stored solids below the original Hull surface.
  // No extra bridge meshes or hidden micro-pieces are needed to close these junctions.
  const mating=(a:string,d:string,z:number,xRatio:number)=>{
    const x=halfWidth(z)*xRatio,root=hullBottom(x,z),ca=added.find(c=>c.id===a)!,cd=added.find(c=>c.id===d)!;
    const contacts=[-.2,0,.2].map(dx=>{
      for(let depth=.5;depth<12;depth+=.25){const p={x:x+dx,y:root-depth,z};if(containsStructuralArmor(ca,p)&&containsStructuralArmor(cd,p))return p;}
      throw Error(`No ventral mating surface ${a}/${d}`);
    });
    return {id:`mate-${a}-${d}`,fromId:a,toId:d,contactPoints:contacts};
  };
  pilot.ventral.matings=[mating('ventral-fore-pan','ventral-keel',-90,0),mating('ventral-keel','belly-port-casemate',-28,-.115),mating('ventral-keel','belly-starboard-fore',-28,.115),mating('ventral-keel','belly-starboard-aft',46,.115),mating('ventral-keel','ventral-drive-cradle',102,0),mating('belly-port-casemate','ventral-drive-cradle',72,-.33)];
  pilot.overallBounds=boundsOf([pilot.overallBounds.min,pilot.overallBounds.max,...added.flatMap(c=>c.solid.vertices)]);
  pilot.validation=validateStructuralArmorPilot(b);
  if(pilot.validation.issues.length)throw Error(pilot.validation.issues.join('; '));
  return b;
}
