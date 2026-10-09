import type{ShipBlueprint,PrefabPlacement,Vec3}from'../../blueprint/types';
import type{ProductionDesign}from'./types';
import type{ParametricPrefabAssembly}from'../functional/types';
import{facetedBox,annularHousing}from'../functional/geometry';
import{boundsOf,add,mul}from'../integration/contours';
import{containsProductionVolume as containsVolume}from'./surface-contact';
import{armorSurfaces,surfaceRay,mountFrame,transformSolid}from'../weapons/surfaces';
import{geometrySamples,solidContains}from'../weapons/collision';
import{inReservedZone}from'../integration/reservations';
import{reservationBounds,reservationSamples,overlappingBounds}from'../armor/geometry';
export function generateFunctionalExterior(b:ShipBlueprint,d:ProductionDesign){
 const l=b.order.length,surfaces=armorSurfaces(b);
 function emit(id:string,kind:PrefabPlacement['kind'],parentId:string,position:Vec3,n:Vec3,parts:ParametricPrefabAssembly['parts'],equipmentIds:string[]=[]){
  const own=kind==='ENGINE_HOUSING'?equipmentIds:[];
  if(parts.some(p=>d.zones.some(z=>!own.includes(z.equipmentId)&&geometrySamples(p.solid).some(q=>inReservedZone(q,z))))){d.decisions.push({stage:'functional',sourceId:id,status:'omitted',reason:'Protected functional opening interference'});return;}
  const bounds=boundsOf(parts.flatMap(p=>p.solid.vertices));
  const p:PrefabPlacement={id,kind,functionality:kind==='ENGINE_HOUSING'?'propulsion':kind==='SENSOR_HOUSING'?'sensor':kind==='RADIATOR_MOUNT'?'thermal':'machinery',socket:{kind:'HULL_FACE',hostId:parentId,position,normal:n},dimensions:{x:bounds.max.x-bounds.min.x,y:bounds.max.y-bounds.min.y,z:bounds.max.z-bounds.min.z},variant:0,assembly:{parts,attachments:[{kind:d.armor.some(c=>c.id===equipmentIds[0])?'ARMOR':'HULL',parentId:d.armor.some(c=>c.id===equipmentIds[0])?equipmentIds[0]:parentId,position,normal:n}],equipmentIds,clearances:[]}};
  b.prefabPlacements!.push(p);d.functionalPrefabIds.push(id);d.decisions.push({stage:'functional',sourceId:id,status:'accepted',reason:'Actual command/engine/service attachment; stored registry assembly'});
 }
 const candidates=d.armor.filter(c=>c.role==='COMMAND_PLINTH');
 const command=candidates.sort((a,c)=>(c.bounds.max.x-c.bounds.min.x)*(c.bounds.max.z-c.bounds.min.z)-(a.bounds.max.x-a.bounds.min.x)*(a.bounds.max.z-a.bounds.min.z))[0];
 if(command){const box=command.bounds,hint={x:(box.min.x+box.max.x)/2,y:0,z:(box.min.z+box.max.z)/2},contact=surfaceRay(surfaces,hint,{x:0,y:1,z:0});
  if(contact){const width=Math.min((box.max.x-box.min.x)*.68,l*.055),height=l*(.009+b.order.priorities.sensor*.00004),length=Math.min((box.max.z-box.min.z)*.65,l*.08),frame=mountFrame(contact.normal),body=transformSolid(facetedBox({x:0,y:height/2-l*.0002,z:0},{x:width,y:height,z:length}),contact.position,frame),optic=transformSolid(facetedBox({x:0,y:height*.58,z:-length*.48},{x:width*.65,y:height*.32,z:l*.003}),contact.position,frame);
   emit('command-house','SENSOR_HOUSING',contact.structureId,contact.position,contact.normal,[{id:'command-body',role:'COMMAND_HOUSING',material:'armor',solid:body,bounds:boundsOf(body.vertices)},{id:'command-optic',role:'PROTECTED_SENSOR',material:'mount',solid:optic,bounds:boundsOf(optic.vertices)}],[contact.surfaceId]);
  }
 }else d.decisions.push({stage:'functional',sourceId:'command-house',status:'omitted',reason:'No attached command plinth on this architecture; retained sensor-role volume'});
 for(const e of b.engines){
  const zone=d.zones.find(z=>z.equipmentId===e.id)!,inner=zone.radius*1.05,neighbours=b.engines.filter(q=>q!==e&&q.parentId===e.parentId),spacing=neighbours.length?Math.min(...neighbours.map(q=>Math.hypot(q.position.x-e.position.x,q.position.y-e.position.y))):Infinity,outer=Math.min(inner+l*.006,spacing*.48);
  const host=b.structuralVolumes.find(v=>v.id===e.parentId)!,contacts=Array.from({length:12},(_,i)=>({x:e.position.x+outer*Math.cos(i*Math.PI/6),y:e.position.y+outer*Math.sin(i*Math.PI/6),z:e.position.z-l*.0001}));
  if(outer<inner+l*.0005||contacts.some(p=>!containsVolume(host,p,l*.0001))){d.decisions.push({stage:'functional',sourceId:`casing-${e.id}`,status:'omitted',reason:'Actual rear ring / nozzle spacing cannot support an open protective casing'});continue;}
  const axis=e.direction??{x:0,y:0,z:1},length=e.nozzleLength*.7,solid=annularHousing(add(e.position,mul(axis,length/2-l*.0002)),axis,outer,inner,length);
  emit(`casing-${e.id}`,'ENGINE_HOUSING',e.parentId,e.position,axis,[{id:`${e.id}-casing`,role:'OPEN_ENGINE_CASING',material:'engine',solid,bounds:boundsOf(solid.vertices)}],[e.id]);
 }
 if(b.order.priorities.endurance>=45){
  const host=[...b.structuralVolumes].filter(v=>v.type!=='SPINE').sort((a,c)=>c.dimensions.z-a.dimensions.z)[0];
  if(host)for(const side of[-1,1]){
   const hint={x:host.position.x,y:host.position.y,z:host.position.z+host.geometry.stations[0].z+host.dimensions.z*.83},hit=surfaceRay(surfaces,hint,{x:side,y:0,z:0});if(!hit)continue;
   const f=mountFrame(hit.normal),height=Math.min(host.dimensions.y*.18,l*.009),width=Math.min(host.dimensions.y*.30,l*.026),length=Math.min(host.dimensions.z*.16,l*.075),solid=transformSolid(facetedBox({x:0,y:height*.5-l*.0002,z:0},{x:width,y:height,z:length}),hit.position,f),id=`thermal-${host.id}-${side}`;
   const parts:ParametricPrefabAssembly['parts']=[{id:id+'-housing',role:'RADIATOR_SUPPORT',material:'engine',solid,bounds:boundsOf(solid.vertices)}];
   for(let i=0;i<3;i++){const fin=transformSolid(facetedBox({x:(i-1)*width*.32,y:height*.65,z:0},{x:width*.10,y:height*.7,z:length*.8}),hit.position,f);parts.push({id:id+'-fin-'+i,role:'THERMAL_EXCHANGER',material:'secondary',solid:fin,bounds:boundsOf(fin.vertices)});}
   const zone={id:id+'-clearance',parentId:hit.structureId,equipmentId:id,kind:'thermal' as const,position:add(hit.position,mul(hit.normal,height*1.1)),normal:hit.normal,radius:Math.max(width,length)*.55,depth:l*.045,rootClearance:0};
   const blocked=surfaces.some(s=>overlappingBounds(s.box,reservationBounds(zone))&&(geometrySamples(s.solid).some(p=>inReservedZone(p,zone))||reservationSamples(zone).some(p=>solidContains(s.solid,p))));
   if(blocked){d.decisions.push({stage:'functional',sourceId:id,status:'omitted',reason:'Thermal outlet would face adjacent armor / hull relief; retained opening safety'});continue;}
   emit(id,'RADIATOR_MOUNT',hit.structureId,hit.position,hit.normal,parts);
   if(d.functionalPrefabIds.includes(id))d.zones.push(zone);
  }
 }

 for(const channel of d.channels){
  if(b.order.priorities.endurance<20)continue;
  const p=channel.floor[Math.floor(channel.floor.length/2)],h=Math.min(channel.depth*.30,l*.008),solid=facetedBox({x:p.x,y:p.y+h/2-l*.0002,z:p.z},{x:channel.width*.35,y:h,z:l*.05});
  emit(`service-${channel.id}`,'MACHINERY_HOUSING',channel.parentStructureId,p,{x:0,y:1,z:0},[{id:`${channel.id}-pump`,role:'SERVICE_PUMP_HOUSING',material:'engine',solid,bounds:boundsOf(solid.vertices)}]);
 }
}
