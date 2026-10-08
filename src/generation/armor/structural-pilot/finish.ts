import type { ShipBlueprint, Vec3 } from '../../../blueprint/types';
import type {StructuralArmorComponent,StructuralArmorPilot} from './types';
import {armorBodyBuilder} from './geometry';
import {surfaceHit} from './intersection';
import {boundsOf} from '../../integration/contours';
import {solidFromRings,solidTriangles} from '../panels';
import {mix} from '../../integration/contours';
import {equipmentReservations,inReservedZone} from '../../integration/reservations';
import {reservationSamples,reservationBounds,overlappingBounds} from '../geometry';
import {validateStructuralArmorPilot,containsStructuralArmor} from './validate';
export function finishStructuralArmor(b:ShipBlueprint, source:ShipBlueprint, components:StructuralArmorComponent[], channels:StructuralArmorPilot['channels'], joints:NonNullable<StructuralArmorPilot['joints']>, status:StructuralArmorPilot['status']='one-ship-review') {
  const l=b.order.length;
  // Reseat existing mounts on low, stable terrain. Prefer the original Z; record any necessary relocation.
  const mounts:StructuralArmorPilot['mounts']=[];
  const armorSamples=components.map(c=>({component:c,points:solidTriangles(c.solid).flatMap(([a,d,e])=>[a,mix(a,d,.5),mix(d,e,.5),mix(e,a,.5)])}));
  for(const h of b.hardpoints) {
    if(h.type==='Spinal'||h.normal.y<.9)continue;
    const originalPosition={...h.position}, radius=h.radius*1.30;
    const hull=b.structuralVolumes.find(v=>v.id===h.parentId)!;
    const {halfWidth}=armorBodyBuilder(hull,components,l),sign=Math.sign(h.position.x-hull.position.x)||1;
    const maxHeight=Math.max(l*.006,h.radius*.6),seatHeight=l*.002,embed=l*.0005;
    let selected:{x:number;z:number;contactSamples:Vec3[];ids:string[];capY:number}|undefined;
    let leastHeight=Infinity, bestTerrain='none';
    const zOffsets=[0,2,-2,4,-4,6,-6,8,-8].map(t=>t*h.radius);
    for(const dz of zOffsets) {
      const z=h.position.z+dz, localZ=z-hull.position.z;
      if(localZ<hull.geometry.stations[0].z+radius||localZ>hull.geometry.stations.at(-1)!.z-radius)continue;
      const w=halfWidth(z),localX=h.position.x-hull.position.x;
      const xs=[sign*Math.min(Math.abs(localX),w*.20),localX,...[.11,.14,.35,.38,.50,.60,.65,.75,.08,.04,0].map(t=>sign*w*t)];
      for(const offset of xs) {
        const x=hull.position.x+offset;
        if(mounts.some(m=>{const prior=b.hardpoints.find(p=>p.id===m.hardpointId)!;return Math.hypot(x-prior.position.x,z-prior.position.z)<radius+prior.radius*1.30+l*.001;}))continue;
        const contacts:Vec3[]=[],ids=new Set<string>();
        for(let i=0;i<8;i++) {
          const a=i*Math.PI/4,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;
          const hit=surfaceHit(components.filter(c=>c.parentStructureId===h.parentId||(c.additionalParentIds??[]).includes(h.parentId)),px,pz);
          if(!hit)break;
          contacts.push({x:px,y:hit.y,z:pz});ids.add(hit.id);
        }
        if(contacts.length!==8)continue;
        const capY=Math.max(...contacts.map(p=>p.y))+seatHeight;
        const requiredHeight=capY-Math.min(...contacts.map(p=>p.y))+embed;
        if(requiredHeight<leastHeight){leastHeight=requiredHeight;bestTerrain=`x=${x.toFixed(2)}, z=${z.toFixed(2)}, armor=${[...ids].join('/')}`;}
        if(requiredHeight>maxHeight+1e-6)continue;
        // Test the actual equipment envelope as well as the narrower mounting footprint.
        // A neighboring raised command cap must not occlude a mount seated on its shoulder.
        const zone=equipmentReservations({...b,hardpoints:[{...h,position:{x,y:capY,z}}]}).find(zone=>zone.equipmentId===h.id)!;
        const zoneBounds=reservationBounds(zone),probes=reservationSamples(zone);
        if(armorSamples.some(({component,points})=>overlappingBounds(component.bounds,zoneBounds)&&(points.some(p=>inReservedZone(p,zone))||probes.some(p=>containsStructuralArmor(component,p,-.01)))))continue;
        selected={x,z,contactSamples:contacts,ids:[...ids].sort(),capY};break;
      }
      if(selected)break;
    }
    if(!selected)throw Error(`No low-profile structural armor support for ${h.id}: best height ${leastHeight.toFixed(2)}m exceeds ${maxHeight.toFixed(2)}m; ${bestTerrain}`);
    const {contactSamples,capY}=selected,parentArmorIds=selected.ids;
    h.position.x=selected.x;h.position.z=selected.z;
    const height=capY-Math.min(...contactSamples.map(p=>p.y))+embed;
    const root=contactSamples.map(p=>({...p,y:p.y-l*.0005}));
    // CCW in the XZ plane viewed upward; a clockwise angle is required for +Y cap normals.
    root.reverse();
    const cap=root.map(p=>({...p,y:capY}));
    h.position.y=capY;delete h.surfaceMount;
    mounts.push({hardpointId:h.id,parentArmorIds,originalPosition,foundation:solidFromRings([root,cap]),contactSamples,height,adjustmentReason:Math.hypot(h.position.x-originalPosition.x,h.position.z-originalPosition.z)>1e-6?'Relocated to stable low-profile structural deck; no armor omitted':'Stable source location'});
  }
  const supersededPrefabIds=(b.prefabPlacements??[]).filter(p=>p.exterior?.phase==='armor'||p.kind==='WEAPON_FOUNDATION'||p.kind==='MACHINERY_HOUSING').map(p=>p.id);
  const baselineBounds=b.layeredArmor?.overallBounds??b.hullIntegration!.overallBounds;
  const overallBounds=boundsOf([baselineBounds.min,baselineBounds.max,...components.flatMap(c=>c.solid.vertices),...mounts.flatMap(m=>m.foundation.vertices)]);
  const pilot:StructuralArmorPilot={revision:"refined-connections",status,source:{seed:b.seed,generatorVersion:source.generatorVersion,structuralDataUnchanged:true},components,channels,mounts,supersededPrefabIds,overallBounds,
    validation:{issues:[],checks:[],minimumChannelDepth:Math.min(...channels.map(c=>c.depth)),maximumMountLift:Math.max(...mounts.map(m=>b.hardpoints.find(h=>h.id===m.hardpointId)!.position.y-m.originalPosition.y))}};
  pilot.joints=joints;
  b.structuralArmorPilot=pilot;
  b.generatorVersion="1.8.2";
  // Panel-free review blueprint: original is retained separately, this export does not pretend to be a release.
  b.layeredArmor=undefined;b.surfaceFeatures=[];
  pilot.validation=validateStructuralArmorPilot(b);
  if(pilot.validation.issues.length)throw Error(pilot.validation.issues.join('; '));
  return b;
}
