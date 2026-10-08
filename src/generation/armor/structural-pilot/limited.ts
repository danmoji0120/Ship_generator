import type {ShipBlueprint,StructuralVolume,Vec3} from '../../../blueprint/types';
import type {StructuralArmorComponent,StructuralArmorPilot} from './types';
import {armorBodyBuilder,addBodyBelt} from './geometry';
import {surfaceHit,sectionEdges} from './intersection';
import {finishStructuralArmor} from './finish';
import {buildStructuralArmorPilot} from './build';
import {boundsOf} from '../../integration/contours';
import {solidFromRings} from '../panels';
import {exposedVolumeSurface} from '../../architecture/volumes';
import {containsStructuralArmor} from './validate';
export const LIMITED_FAMILIES = {WEDGE_CITADEL:'MONOLITHIC',HAMMERHEAD:'BLOCK_ASSEMBLY',ENGINE_DOMINANT:'CORE_AND_NACELLES'} as const;
export function permittedStructuralReview(b:ShipBlueprint) {
  const family=b.macroDesign?.family;
  return b.seed===7&&b.shipyardId==='aegis'&&b.order.length===300&&b.role==='Cruiser'&&family&&family in LIMITED_FAMILIES&&b.architecture.grammar===LIMITED_FAMILIES[family as keyof typeof LIMITED_FAMILIES];
}
/** Three explicitly reviewed family/architecture pairs, one fixed order and seed. No broad rollout. */
export function buildLimitedStructuralArmor(source:ShipBlueprint):ShipBlueprint {
  if(!permittedStructuralReview(source))throw Error('Limited structural review is restricted to three Aegis / Cruiser / 300m / Seed 7 family pairs.');
  if(source.macroDesign!.family==='WEDGE_CITADEL')return buildStructuralArmorPilot(source);
  const b=structuredClone(source),l=b.order.length,components:StructuralArmorComponent[]=[],channels:StructuralArmorPilot['channels']=[],joints:NonNullable<StructuralArmorPilot['joints']>=[];
  const host=(id:string)=>b.structuralVolumes.find(v=>v.id===id)!;
  const zAt=(v:StructuralVolume,t:number)=>v.position.z+v.geometry.stations[0].z+t*(v.geometry.stations.at(-1)!.z-v.geometry.stations[0].z);
  function channel(v:StructuralVolume,left:string,right:string,t0:number,t1:number) {
    const {deckY}=armorBodyBuilder(v,components,l);
    const zs=[t0,t0+(t1-t0)/3,t0+2*(t1-t0)/3,t1].map(t=>zAt(v,t));
    const leftBody=components.find(c=>c.id===left)!,rightBody=components.find(c=>c.id===right)!;
    const edges=zs.map(z=>({a:sectionEdges(leftBody,z).maxX,d:sectionEdges(rightBody,z).minX}));
    const floor=zs.map((z,i)=>{const x=(edges[i].a+edges[i].d)/2;return{x,y:deckY(x,z),z};});
    const depths=zs.map((z,i)=>Math.min(surfaceHit([leftBody],edges[i].a-.1,z)!.y,surfaceHit([rightBody],edges[i].d+.1,z)!.y)-floor[i].y);
    channels.push({id:`channel-${v.id}`,parentStructureId:v.id,floor,leftBankId:left,rightBankId:right,width:Math.min(...edges.map(e=>e.d-e.a)),depth:Math.min(...depths)});
  }

  // Cross-body deck transitions explicitly follow the unchanged Hull contacts on either side of a real connector.
  function neck(id:string,from:StructuralVolume,to:StructuralVolume,fromArmor:string,toArmor:string,z0:number,z1:number,width:number) {
    const xs=[-width*.5,-width*.35,width*.35,width*.5],zs=[z0,z0+(z1-z0)*.3,z0+(z1-z0)*.7,z1];
    const endpoint=(id:string,z:number)=>surfaceHit(components.filter(c=>c.id===id),0,z)!.y;
    const ya=endpoint(fromArmor,z0),yb=endpoint(toArmor,z1),contactSamples:Vec3[]=[];
    const seam=(from.position.z+from.geometry.stations.at(-1)!.z+to.position.z+to.geometry.stations[0].z)/2;
    zs.push(seam-.15,seam+.15);zs.sort((a,b)=>a-b);
    const rings=zs.map(z=>{
      const t=(z-z0)/(z1-z0),roof=ya+(yb-ya)*t;
      const root=(x:number)=>exposedVolumeSurface(b.structuralVolumes,x,z).y-l*.002;
      const half=width*.5,topHalf=width*.35;
      const points:Vec3[]=[{x:-half,y:root(-half),z},{x:half,y:root(half),z},{x:half,y:roof-3,z},{x:topHalf,y:roof,z},{x:-topHalf,y:roof,z},{x:-half,y:roof-3,z}];
      for(const x of xs)contactSamples.push({x,y:exposedVolumeSurface(b.structuralVolumes,x,z).y-l*.001,z});
      return points;
    });
    components.push({id,role:'TRANSITION_NECK',parentStructureId:from.id,additionalParentIds:[to.id],rings,solid:solidFromRings(rings),contactSamples,inset:l*.002,bounds:boundsOf(rings.flat())});
    const bridge=components.at(-1)!;
    const contact=(armor:string,z:number):Vec3=>{
      const body=components.find(c=>c.id===armor)!;
      const top=surfaceHit([body],0,z)!.y;
      for(let y=top-1;y>Math.min(from.position.y,to.position.y);y-=1)if(containsStructuralArmor(body,{x:0,y,z})&&containsStructuralArmor(bridge,{x:0,y,z}))return{x:0,y,z};
      throw Error(`No mating contact for ${id}/${armor}`);
    };
    joints.push({id:`join-${id}`,fromId:fromArmor,toId:toArmor,bridgeId:id,contactPoints:[contact(fromArmor,z0+1),contact(toArmor,z1-1)]});
  }
  if(b.macroDesign!.family==='HAMMERHEAD') {
    const fore=host('fore-armor'),core=host('combat-core'),drive=host('drive-block');
    const head=armorBodyBuilder(fore,components,l);
    head.deck('head-citadel','CITADEL',zAt(fore,.08),zAt(fore,.97),0,.30,20,0,undefined,{rise:[[0,.4],[.22,1],[.67,1],[1,.65]],width:[[0,.8],[.26,1],[1,.88]],bevel:.23});
    for(const side of [-1,1]){
      head.deck(`head-shoulder-${side}`,'SHOULDER',zAt(fore,.06),zAt(fore,.92),.45,.88,16,side,undefined,{rise:[[0,.4],[.20,1],[.65,1],[1,.5]],bevel:.24});
      addBodyBelt(fore,components,`head-belt-${side}`,side,zAt(fore,.10),zAt(fore,.95),l);
    }
    channel(fore,'head-citadel','head-shoulder-1',.30,.62);
    const cmd=armorBodyBuilder(core,components,l);
    // A broad functional landing sits between the tapered necks. Keep enough flat shoulder
    // outside the command cap for low weapon foundations; do not flatten the whole hull.
    cmd.deck('command-saddle','SUPERSTRUCTURE_BASE',zAt(core,.04),zAt(core,.96),0,.74,15,0,undefined,{rise:[[0,.68],[.15,1],[.88,1],[1,.40]],width:[[0,.9],[.20,1],[.88,1],[1,.72]],bevel:.16});
    cmd.deck('command-cap','COMMAND_PLINTH',zAt(core,.30),zAt(core,.69),0,.26,8,0,'command-saddle',{rise:[[0,.30],[.30,1],[.70,.85],[1,.35]],width:[[0,.8],[.3,1],[1,.62]],bevel:.25});
    const engine=armorBodyBuilder(drive,components,l);
    engine.deck('reactor-housing','REAR_HOUSING',zAt(drive,.04),zAt(drive,.97),0,.66,17,0,undefined,{rise:[[0,.65],[.23,1],[.60,.87],[1,.36]],width:[[0,.84],[.35,1],[1,.7]],bevel:.25});
    engine.deck('reactor-support','SUPERSTRUCTURE_BASE',zAt(drive,.22),zAt(drive,.63),0,.27,7,0,'reactor-housing',{rise:[[0,.4],[.30,1],[1,.3]],bevel:.24});
    for(const v of b.structuralVolumes.filter(v=>v.id.startsWith('magazine'))){
      armorBodyBuilder(v,components,l).deck(`${v.id}-casemate`,'SHOULDER',zAt(v,.025),zAt(v,.98),0,.82,9,0,undefined,{rise:[[0,.45],[.30,1],[.72,.85],[1,.45]],width:[[0,.84],[.30,1],[1,.78]],bevel:.2});
    }
    neck('head-to-command',fore,core,'head-citadel','command-saddle',zAt(fore,.90),zAt(core,.13),27);
    neck('command-to-reactor',core,drive,'command-saddle','reactor-housing',zAt(core,.86),zAt(drive,.16),27);
  } else {
    const core=host('command-core'),cb=armorBodyBuilder(core,components,l);
    cb.deck('forward-guard','AXIAL_PROTECTION',zAt(core,.08),zAt(core,.50),0,.66,6,0,undefined,{rise:[[0,.6],[.3,1],[1,.9]],bevel:.22});
    cb.deck('command-saddle','SUPERSTRUCTURE_BASE',zAt(core,.34),zAt(core,.99),0,.62,12,0,undefined,{rise:[[0,.6],[.25,1],[.7,.85],[1,.32]],width:[[0,.96],[.3,1],[1,.72]],bevel:.23});
    cb.deck('command-cap','COMMAND_PLINTH',zAt(core,.64),zAt(core,.83),0,.25,6,0,'command-saddle',{rise:[[0,.4],[.3,1],[1,.35]],bevel:.24});
    for(const v of b.structuralVolumes.filter(v=>v.type==='NACELLE')){
      const {deck}=armorBodyBuilder(v,components,l),crest=v.dimensions.y*.23;
      for(const side of [-1,1]) {
        deck(`${v.id}-hood-${side}`,'REAR_HOUSING',zAt(v,.17),zAt(v,.98),.18,.92,crest,side,undefined,{rise:[[0,.45],[.23,1],[.68,.95],[1,.38]],bevel:.24});
        addBodyBelt(v,components,`${v.id}-belt-${side}`,side,zAt(v,.22),zAt(v,.56),l);
      }
      channel(v,`${v.id}-hood--1`,`${v.id}-hood-1`,.40,.66);
    }
  }
  return finishStructuralArmor(b,source,components,channels,joints,'limited-family-review');
}
