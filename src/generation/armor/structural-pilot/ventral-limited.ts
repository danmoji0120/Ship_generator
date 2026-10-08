import type {ShipBlueprint,StructuralVolume} from '../../../blueprint/types';
import type {StructuralArmorComponent,StructuralArmorPilot} from './types';
import {permittedStructuralReview} from './limited';
import {buildVentralArmorReview} from './ventral';
import {ventralBodyBuilder} from './ventral-geometry';
import {undersideHit} from './intersection';
import {boundsOf} from '../../integration/contours';
import {containsStructuralArmor,validateStructuralArmorPilot} from './validate';

/** Exactly three saved Seed 7 upper reviews. No new seed/yard/language rollout. */
export function buildLimitedVentralReview(source:ShipBlueprint):ShipBlueprint {
  if(!permittedStructuralReview(source)||!source.structuralArmorPilot||source.structuralArmorPilot.ventral)
    throw Error('Ventral family review is restricted to three unmodified reviewed Seed 7 exports.');
  if(source.macroDesign!.family==='WEDGE_CITADEL')return buildVentralArmorReview(source);
  const b=structuredClone(source),pilot=b.structuralArmorPilot!,added:StructuralArmorComponent[]=[],l=b.order.length;
  const sourceComponentIds=pilot.components.map(c=>c.id);
  const host=(id:string)=>b.structuralVolumes.find(v=>v.id===id)!;
  const zAt=(v:StructuralVolume,t:number)=>v.position.z+v.geometry.stations[0].z+t*(v.geometry.stations.at(-1)!.z-v.geometry.stations[0].z);
  const levels:NonNullable<StructuralArmorPilot['ventral']>['levels']=[];
  const matings:NonNullable<NonNullable<StructuralArmorPilot['ventral']>['matings']>=[];
  const measure=(id:string,v:StructuralVolume,x:number,z:number)=>{
    const hit=undersideHit(added,x,z);if(!hit)throw Error(`Missing lower tier ${id}`);
    const hullY=ventralBodyBuilder(v,[],l).hullBottom(x,z);
    levels.push({id,parentStructureId:v.id,position:{x,y:hit.y,z},hullY,exteriorY:hit.y,depth:hullY-hit.y});
  };
  const mate=(a:string,d:string,v:StructuralVolume,z:number,ratio:number)=>{
    const {halfWidth,hullBottom}=ventralBodyBuilder(v,[],l),x=v.position.x+halfWidth(z)*ratio,root=hullBottom(x,z);
    const ca=added.find(c=>c.id===a)!,cd=added.find(c=>c.id===d)!;
    const contactPoints=[-.2,0,.2].map(dx=>{
      for(let depth=.3;depth<15;depth+=.2){const p={x:x+dx,y:root-depth,z};if(containsStructuralArmor(ca,p)&&containsStructuralArmor(cd,p))return p;}
      throw Error(`No shared lower junction ${a}/${d}`);
    });
    matings.push({id:`mate-${a}-${d}`,fromId:a,toId:d,contactPoints});
  };
  if(b.macroDesign!.family==='HAMMERHEAD'){
    const head=host('fore-armor'),core=host('combat-core'),drive=host('drive-block');
    const {body}=ventralBodyBuilder(head,added,l);
    body('head-keel','VENTRAL_KEEL',zAt(head,.025),zAt(head,1),-.19,.19,23,{width:[[0,.22],[.28,.85],[.6,1],[1,.86]],rise:[[0,.1],[.27,.65],[.48,1],[.83,1],[1,.80]],bevel:.24});
    body('head-underpan','VENTRAL_TRANSITION',zAt(head,.025),zAt(head,.94),-.76,.76,7,{width:[[0,.42],[.28,1],[.65,1],[1,.65]],rise:[[0,.15],[.30,1],[.74,1],[1,.50]],bevel:.27});
    for(const side of [-1,1])body(`head-belly-${side}`,'BELLY_CITADEL',zAt(head,.20),zAt(head,.98),side<0?-.65:.1,side<0?-.1:.65,12,{width:[[0,.75],[.25,1],[.70,1],[1,.70]],rise:[[0,.35],[.25,1],[.70,1],[1,.60]],bevel:.24});
    // One continuous lower neck, rooted in the actual three adjacent Hulls.
    // Its external axis mates both head and rear protective casing; it is not a floating bar.
    ventralBodyBuilder(core,added,l).body('machinery-keel','VENTRAL_KEEL',zAt(head,.89),zAt(drive,.20),-.40,.40,18,{width:[[0,.9],[.22,1],[.78,1],[1,.88]],rise:[[0,.7],[.22,1],[.76,1],[1,.8]],bevel:.24},[head,drive]);
    ventralBodyBuilder(drive,added,l).body('drive-undercradle','LOWER_HOUSING',zAt(drive,0),zAt(drive,.95),-.60,.60,16,{width:[[0,.72],[.26,1],[.67,.9],[1,.45]],rise:[[0,.55],[.30,1],[.67,1],[1,.12]],bevel:.28});
    for(const v of b.structuralVolumes.filter(v=>v.id.startsWith('magazine')))
      ventralBodyBuilder(v,added,l).body(`${v.id}-lower-case`,'BELLY_CITADEL',zAt(v,.10),zAt(v,.93),-.68,.68,8,{width:[[0,.65],[.25,1],[.7,1],[1,.70]],rise:[[0,.25],[.25,1],[.70,1],[1,.35]],bevel:.24});
    measure('fore-protection',head,-head.dimensions.x*.34,zAt(head,.50));
    measure('head-shoulder',head,-head.dimensions.x*.20,zAt(head,.58));
    measure('dominant-keel',head,0,zAt(head,.58));
    measure('machinery-axis',core,0,zAt(core,.50));
    measure('aft-cradle',drive,0,zAt(drive,.50));
    mate('head-keel','head-underpan',head,zAt(head,.45),0);
    for(const side of [-1,1])mate('head-keel',`head-belly-${side}`,head,zAt(head,.60),side*.16);
    mate('head-keel','machinery-keel',head,zAt(head,.94),0);
    mate('machinery-keel','drive-undercradle',drive,zAt(drive,.12),0);
  }else{
    const core=host('command-core'),{body}=ventralBodyBuilder(core,added,l);
    // Stop the core belly before the independent lower vertical nacelle: keep the gap open.
    body('core-lower-axis','VENTRAL_KEEL',zAt(core,.045),zAt(core,.84),-.23,.23,16,{width:[[0,.2],[.22,.8],[.58,1],[1,.52]],rise:[[0,.10],[.26,.8],[.43,1],[.68,1],[1,.25]],bevel:.24});
    body('core-underpan','VENTRAL_TRANSITION',zAt(core,.055),zAt(core,.70),-.58,.58,5,{width:[[0,.2],[.30,.88],[.64,1],[1,.68]],rise:[[0,.12],[.35,1],[.70,1],[1,.35]],bevel:.27});
    for(const v of b.structuralVolumes.filter(v=>v.type==='NACELLE')){
      // Local bearing cradle only. Rear thermal reservations remain exposed, including
      // the downward tilted radiators on the port drive. No cross-nacelle skin or bridge.
      ventralBodyBuilder(v,added,l).body(`${v.id}-lower-cradle`,'LOWER_HOUSING',zAt(v,.085),zAt(v,.54),-.66,.66,12,{width:[[0,.38],[.25,1],[.64,.95],[1,.58]],rise:[[0,.15],[.30,1],[.64,1],[1,.2]],bevel:.28});
    }
    measure('forward-underpan',core,core.dimensions.x*.20,zAt(core,.37));
    measure('central-keel',core,0,zAt(core,.50));
    const pod=b.structuralVolumes.find(v=>v.type==='NACELLE'&&v.position.y<0)!;
    measure('independent-drive',pod,pod.position.x,zAt(pod,.30));
    mate('core-lower-axis','core-underpan',core,zAt(core,.43),0);
  }
  pilot.components.push(...added);pilot.revision='ventral-flow-review';
  pilot.ventral={sourceComponentIds,componentIds:added.map(c=>c.id),levels,recesses:[],matings};
  pilot.overallBounds=boundsOf([pilot.overallBounds.min,pilot.overallBounds.max,...added.flatMap(c=>c.solid.vertices)]);
  pilot.validation=validateStructuralArmorPilot(b);
  if(pilot.validation.issues.length)throw Error(pilot.validation.issues.join('; '));
  return b;
}
