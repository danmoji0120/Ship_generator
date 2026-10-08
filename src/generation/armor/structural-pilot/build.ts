import type { ShipBlueprint, Vec3 } from '../../../blueprint/types';
import type { StructuralArmorComponent, StructuralArmorPilot } from './types';
import { boundsOf, sectionRing } from '../../integration/contours';
import { solidFromRings } from '../panels';
import { armorBodyBuilder, curve } from './geometry';
import { surfaceHit } from './intersection';
export { surfaceHit } from './intersection';
import { finishStructuralArmor } from './finish';

/** Explicitly restricted QA entry. No automatic application to other seeds, languages or exports. */
export function buildStructuralArmorPilot(source: ShipBlueprint): ShipBlueprint {
  if (source.seed !== 7 || source.shipyardId !== 'aegis' || source.order.length !== 300 ||
      source.architecture.grammar !== 'MONOLITHIC' || source.macroDesign?.family !== 'WEDGE_CITADEL')
    throw Error('Structural armor pilot is restricted to Aegis / MONOLITHIC / WEDGE_CITADEL / 300 m / Seed 7 pending review.');
  const b = structuredClone(source), hull = b.structuralVolumes[0], l = b.order.length;
  const components: StructuralArmorComponent[] = [], inset = l * .004;
  const {deck,deckY,halfWidth,ring}=armorBodyBuilder(hull,components,l);
  deck('fore-axial-guard','AXIAL_PROTECTION',-139,-65,0,.28,9);
  deck('main-citadel','CITADEL',-69,48,0,.28,20,0,undefined,{
    width:[[0,.92],[.20,1],[.72,1],[1,.86]],rise:[[0,.40],[.15,1],[.60,1],[.82,.92],[1,.66]]
  });
  deck('fore-citadel-neck','TRANSITION_NECK',-83,-48,0,.242,18,0,undefined,{
    width:[[0,.84],[.35,1],[1,1]],rise:[[0,.32],[.30,.66],[.80,1],[1,1]],bevel:.22
  });
  // Broad shoulder masses flank genuinely open service lanes. Their smaller height reads in side/front views.
  for (const side of [-1,1]) {
    deck(`forward-shoulder-${side}`,'SHOULDER',-132,-45,.43,.86,11,side);
    deck(`mid-shoulder-${side}`,'SHOULDER',-49,22,.43,.86,16,side);
    deck(`rear-shoulder-${side}`,'SHOULDER',18,101,.43,.86,9,side);
  }
  deck('command-foundation','SUPERSTRUCTURE_BASE',42,110,0,.265,28,0,undefined,{
    width:[[0,1.02],[.24,1.12],[.66,.94],[1,.72]],rise:[[0,.57],[.22,1],[.55,1],[.80,.76],[1,.37]],bevel:.23
  });
  deck('citadel-command-neck','TRANSITION_NECK',28,65,0,.242,25,0,undefined,{
    width:[[0,.86],[.50,1.03],[1,1]],rise:[[0,.72],[.52,.88],[1,1]],bevel:.23
  });
  deck('command-plinth','COMMAND_PLINTH',62,98,0,.150,11,0,'command-foundation',{
    width:[[0,.80],[.23,1],[.72,.86],[1,.60]],rise:[[0,.50],[.26,1],[.64,.90],[1,.35]],bevel:.28
  });
  for(const side of [-1,1]) {
    deck(`belt-haunch-${side}`,'BELT_HAUNCH',-38,16,.82,.98,9,side,undefined,{
      rise:[[0,.45],[.23,1],[.75,.8],[1,.38]],bevel:.24
    });
    deck(`stern-housing-${side}`,'REAR_HOUSING',103,147,.07,.43,12,side,undefined,{
      width:[[0,.92],[.40,1],[1,.76]],rise:[[0,.85],[.36,1],[.72,.65],[1,.28]],bevel:.24
    });
  }
  // Belts wrap the actual sloping side contour: an embedded root and projecting broad faceted cross-section.
  for(const side of [-1,1]) for(const [part,z0,z1] of [['fore',-130,-55],['mid',-59,14],['aft',10,43]] as const) {
    const zs=[z0,...hull.geometry.stations.map(s=>s.z).filter(z=>z>z0&&z<z1),z1];
    const contacts:Vec3[]=[];
    const rings=zs.map(z=>{
      const r=ring(z), max=halfWidth(z);
      const sideX=(y:number)=>{
        const xs:number[]=[];
        r.forEach((a,i)=>{const c=r[(i+1)%r.length];if(y>=Math.min(a.y,c.y)&&y<=Math.max(a.y,c.y)&&Math.abs(c.y-a.y)>1e-8)xs.push(a.x+(c.x-a.x)*(y-a.y)/(c.y-a.y));});
        return side*Math.max(...xs.map(Math.abs));
      };
      const t=(z-z0)/(z1-z0);
      const top=part==='mid'?curve([[0,16],[.32,25],[.72,22],[1,14]],t):part==='fore'?curve([[0,13],[.25,21],[.70,21],[1,15]],t):curve([[0,14],[.45,18],[1,10]],t);
      const bottom=-13, protrude=(part==='mid'?9:6)*(z===z0||z===z1?.5:1);
      const xRoot=side*(max-inset), xOuter=side*(max+protrude);
      let p:Vec3[]=[{x:xRoot,y:bottom,z},{x:xOuter-side*2,y:bottom,z},{x:xOuter,y:bottom+6,z},
        {x:xOuter,y:top-7,z},{x:xOuter-side*4,y:top,z},{x:xRoot,y:top,z}];
      if(side===-1)p=p.reverse();
      for(const y of [-10,0,15])contacts.push({x:sideX(y)-side*inset*.5,y,z});
      return p;
    });
    const id=`belt-${side}-${part}`;
    components.push({id,role:'SIDE_BELT',parentStructureId:hull.id,rings,solid:solidFromRings(rings),contactSamples:contacts,inset,bounds:boundsOf(rings.flat())});
  }
  const channels:StructuralArmorPilot['channels']=[];
  for(const side of [-1,1]) {
    const zs=[-40,-30,0,10];
    const floor=zs.map(z=>{const x=side*halfWidth(z)*.355;return{x,y:deckY(x,z),z};});
    const depths=zs.map((z,i)=> {
      const inner=surfaceHit(components,side*(halfWidth(z)*.28-.1),z)!.y;
      const outer=surfaceHit(components,side*(halfWidth(z)*.43+.1),z)!.y;
      return Math.min(inner,outer)-floor[i].y;
    });
    channels.push({id:`service-lane-${side}`,floor,leftBankId:'main-citadel',rightBankId:`mid-shoulder-${side}`,width:Math.min(...zs.map(z=>halfWidth(z)*.15)),depth:Math.min(...depths)});
  }
  const joints:NonNullable<StructuralArmorPilot['joints']>=[
    {id:'fore-step',fromId:'fore-axial-guard',toId:'main-citadel',bridgeId:'fore-citadel-neck',contactPoints:[{x:0,y:30,z:-76},{x:0,y:32,z:-58}]},
    {id:'command-step',fromId:'main-citadel',toId:'command-foundation',bridgeId:'citadel-command-neck',contactPoints:[{x:0,y:35,z:35},{x:0,y:40,z:55}]},
  ];
  return finishStructuralArmor(b,source,components,channels,joints);
}
