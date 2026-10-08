import type {ShipBlueprint,Vec3} from '../../blueprint/types';
import type {PanelSolid} from '../armor/types';
import {containsStructuralArmor} from '../armor/structural-pilot/validate';
import type {StructuralArmorComponent} from '../armor/structural-pilot/types';
import {containsVolume} from '../architecture/volumes';
import {equipmentReservations,inReservedZone} from '../integration/reservations';
import {reservationSamples,reservationBounds,overlappingBounds} from '../armor/geometry';
import {solidTriangles,area,cross} from '../armor/panels';
import {dot,mix,boundsOf,sub,mul} from '../integration/contours';

const inside=(solid:PanelSolid,p:Vec3,tolerance=0)=>containsStructuralArmor({solid}as StructuralArmorComponent,p,tolerance);
export function validateFunctionalExterior(b:ShipBlueprint){
  const f=b.functionalExterior;if(!f)return{issues:[],checks:[]};
  const issues:string[]=[],pilot=b.structuralArmorPilot!;
  if(f.status!=='one-ship-review'||b.seed!==7||b.shipyardId!=='aegis'||b.role!=='Cruiser'||b.order.length!==300||b.macroDesign?.family!=='WEDGE_CITADEL'||b.architecture.grammar!=='MONOLITHIC'||pilot?.revision!=='ventral-flow-review')issues.push('Invalid functional review scope');
  if(!pilot)return{issues:['Missing approved structural armor'],checks:[]};
  const kits=b.prefabPlacements!.filter(p=>f.prefabIds.includes(p.id)),parts=kits.flatMap(p=>p.assembly?.parts??[]),ids=new Set(parts.map(p=>p.id));
  if(kits.length!==f.prefabIds.length||new Set(f.prefabIds).size!==kits.length||ids.size!==parts.length||parts.length>240)issues.push('Functional assembly IDs/budget');
  if(f.replacedHardpointVisuals.length!==b.hardpoints.length||new Set(f.replacedHardpointVisuals).size!==b.hardpoints.length||f.replacedHardpointVisuals.some(id=>!b.hardpoints.some(h=>h.id===id)))issues.push('Lost functional mount');
  const reservations=equipmentReservations(b);
  const cached=parts.map(p=>({part:p,triangles:solidTriangles(p.solid),box:p.bounds}));
  const inBox=(p:Vec3,q:typeof cached[0]['box'])=>(['x','y','z']as const).every(k=>p[k]>=q.min[k]-.01&&p[k]<=q.max[k]+.01);
  for(const kit of kits){
    const a=kit.assembly;if(!a||!a.parts.length||!a.attachments.length){issues.push(`Missing functional kit ${kit.id}`);continue;}
    if(!b.structuralVolumes.some(v=>v.id===kit.socket.hostId)||a.equipmentIds.some(id=>!b.hardpoints.some(h=>h.id===id)&&!b.engines.some(e=>e.id===id)))issues.push(`Invalid functional socket/equipment reference ${kit.id}`);
    for(const contact of a.attachments){
      const armor=pilot.components.find(c=>c.id===contact.parentId),hull=b.structuralVolumes.find(v=>v.id===contact.parentId),foundation=pilot.mounts.find(m=>m.hardpointId===contact.parentId);
      const p=sub(contact.position,mul(contact.normal,.02));
      if(Object.values(contact.normal).some(v=>!Number.isFinite(v))||Math.abs(Math.hypot(...Object.values(contact.normal))-1)>.001)issues.push(`Invalid functional contact normal ${kit.id}`);
      if(contact.kind==='ARMOR'?!armor||!containsStructuralArmor(armor,p,.03):contact.kind==='FOUNDATION'?!foundation||!inside(foundation.foundation,p,.03):!hull||!containsVolume(hull,p,.03))issues.push(`Detached functional attachment ${kit.id}/${contact.parentId}`);
    }
    for(const p of a.parts){
      const tris=solidTriangles(p.solid),edges=new Map<string,number>();let volume=0;
      for(const[a,d,e]of tris){
        if([a,d,e].some(p=>Object.values(p).some(v=>!Number.isFinite(v)))||area([a,d,e])<1e-8)issues.push(`Invalid functional geometry ${p.id}`);
        volume+=dot(a,cross(d,e))/6;
      }
      for(let i=0;i<p.solid.indices.length;i+=3)for(let j=0;j<3;j++){
        const a=p.solid.indices[i+j],d=p.solid.indices[i+(j+1)%3],key=[Math.min(a,d),Math.max(a,d)].join('/');edges.set(key,(edges.get(key)??0)+1);
      }
      if(volume<=0||[...edges.values()].some(n=>n!==2))issues.push(`Open/inverted functional solid ${p.id}`);
      if(JSON.stringify(boundsOf(p.solid.vertices))!==JSON.stringify(p.bounds))issues.push(`Functional bounds cache ${p.id}`);
      if(p.solid.vertices.some(v=>(['x','y','z']as const).some(k=>v[k]<f.overallBounds.min[k]-.001||v[k]>f.overallBounds.max[k]+.001)))issues.push(`Functional overall bounds ${p.id}`);
      for(const zone of reservations){
        if(zone.kind!=='exhaust'&&zone.kind!=='thermal'&&a.equipmentIds.includes(zone.equipmentId))continue;
        if(!overlappingBounds(p.bounds,reservationBounds(zone)))continue;
        const samples=tris.flatMap(([a,d,e])=>[a,mix(a,d,.5),mix(d,e,.5),mix(e,a,.5)]);
        if(samples.some(v=>inReservedZone(v,zone))||reservationSamples(zone).some(v=>inBox(v,p.bounds)&&inside(p.solid,v,-.01)))issues.push(`Blocked functional corridor ${p.id}/${zone.id}`);
      }
    }
    for(const zone of a.clearances){
      if(!a.equipmentIds.includes(zone.equipmentId)||!b.structuralVolumes.some(v=>v.id===zone.parentId))issues.push(`Invalid functional firing reference ${zone.id}`);
      const samples=reservationSamples(zone);
      if(samples.some(p=>b.structuralVolumes.some(v=>containsVolume(v,p,-.01))||pilot.components.some(c=>inBox(p,c.bounds)&&containsStructuralArmor(c,p,-.01))))issues.push(`Blocked visual firing path ${zone.id}`);
      for(const target of cached){
        if(!overlappingBounds(target.box,reservationBounds(zone)))continue;
        if(samples.some(p=>inBox(p,target.box)&&inside(target.part.solid,p,-.01))||target.triangles.some(t=>t.some(p=>inReservedZone(p,zone))))issues.push(`Neighboring installation firing path ${zone.id}/${target.part.id}`);
      }
    }
  }
  for(const region of f.serviceRegions)if(region.occupiedFraction>.33||region.remainingDepth<6||region.prefabIds.some(id=>!f.prefabIds.includes(id)))issues.push(`Filled maintenance region ${region.id}`);
  for(const finish of f.armorFinish)if(!pilot.components.some(c=>c.id===finish.parentArmorId)||finish.thickness<=0||finish.thickness>.4||finish.contactAreaM2<=0)issues.push(`Invalid armor finish ${finish.prefabId}`);
  return{issues:[...new Set(issues)],checks:['Approved mass geometry retained; broad finishing skins seated on stored stations','Valid prefab registry, source foundations and actual armor/root contacts','Closed finite solids, positive volume and authoritative Bounds','Sampled exhaust/thermal and neighboring mount reservation clearance','Static outward weapon aperture corridors above existing armor','Low service occupancy with deep residual maintenance space']};
}
