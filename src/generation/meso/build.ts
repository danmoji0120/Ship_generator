import type {ShipBlueprint,Vec3} from '../../blueprint/types';
import type {MesoZone,MesoKind,MesoPlacement,MesoStructurePlan} from './types';
import {MESO_KINDS} from './types';
import {mesoGeometry,mesoPerimeter} from './geometry';
import {armorSurfaces,surfaceRay,worldPoint,type ArmorSurfaces} from '../weapons/surfaces';
import {detailSurfaces} from '../details/zones';
import {detailFrame} from '../details/geometry';
import {detailScene,detailIssues} from '../details/placement';
import type {DetailPlacement} from '../details/types';
import {solidTriangles,normal,area,clipHalfSpace,cross} from '../armor/panels';
import {boundsOf,add,mul,sub,dot} from '../integration/contours';
import {surfaceHash} from '../appearance/profile';
import {validateMesoStructures} from './validate';
import {geometrySamples,solidContains,rayBlocked} from '../weapons/collision';
import {overlappingBounds} from '../armor/geometry';
export const MESO_STYLE={aegis:{height:1,width:1,clip:.18,taper:.85},vesper:{height:.52,width:.72,clip:.12,taper:.62},forge:{height:.84,width:.88,clip:.26,taper:.96},serein:{height:.45,width:1.08,clip:.14,taper:.88}};
export function mesoSurfaces(b:ShipBlueprint):ArmorSurfaces{
 const surfaces=detailSurfaces(b,armorSurfaces(b)),ids=new Set(surfaces.map(s=>s.id));
 for(const k of b.exteriorDetailPlan?.kitPlacements??[])for(const p of k.assembly.parts)if(!ids.has(p.id))surfaces.push({id:p.id,structureId:k.parentStructureId,solid:p.solid,box:p.bounds,triangles:solidTriangles(p.solid).map(t=>({vertices:t,n:normal(t)}))});
 return surfaces;
}
export function detectMesoZones(b:ShipBlueprint):MesoZone[]{
 const zones:MesoZone[]=[],armor=b.productionDesign?.armor??[],L=b.order.length;
 const emit=(kind:MesoZone['kind'],parentSurfaceId:string,parentStructureId:string,hint:Vec3,n:Vec3,allowed:MesoKind[],reason:string,equipmentId?:string)=>zones.push({id:'meso-zone/'+parentSurfaceId+'/'+kind+'/'+zones.length,kind,parentSurfaceId,parentStructureId,hint,normal:n,allowed,availableAreaM2:0,reason,equipmentId,candidateCount:0});
 for(const a of armor){const box=a.bounds,c={x:(box.min.x+box.max.x)/2,y:(box.min.y+box.max.y)/2,z:(box.min.z+box.max.z)/2};
  if(a.role==='CITADEL'){for(const side of[-1,1])emit('PRIMARY_ARMOR',a.id,a.parentStructureId,{...c,x:c.x+side*(box.max.x-box.min.x)*.30},{x:0,y:1,z:0},['ARMOR_STEP'],'Two major armor aprons flank the reserved centerline weapon installation');}
  else if(['AXIAL_PROTECTION','BELLY_CITADEL'].includes(a.role))emit('PRIMARY_ARMOR',a.id,a.parentStructureId,c,{x:0,y:a.role==='BELLY_CITADEL'?-1:1,z:0},['ARMOR_STEP'],'A localized terrace on an existing major armor mass');
  if(a.role==='SHOULDER')emit('ARMOR_SHOULDER',a.id,a.parentStructureId,c,{x:0,y:1,z:0},['ARMOR_STEP','ARMOR_SHOULDER_EXTENSION'],'Actual shoulder cover; separated modules retain their own envelopes');
  if(a.role==='SIDE_BELT')emit('SIDE_BELT',a.id,a.parentStructureId,{...c,y:c.y-(box.max.y-box.min.y)*.28},{x:Math.sign(c.x)||1,y:0,z:0},['FLANK_ARMOR_BELT'],'Partial local overlap on existing flank armor, not a full-length strip');
  if(a.role==='VENTRAL_KEEL'||a.role==='LOWER_HOUSING')emit('VENTRAL_KEEL',a.id,a.parentStructureId,c,{x:0,y:-1,z:0},['VENTRAL_KEEL_SUPPORT'],'Existing keel/cradle support transition; bottom-specific low broad web');
  if(a.role==='COMMAND_PLINTH')emit('COMMAND_BASE',a.id,a.parentStructureId,c,{x:0,y:1,z:0},['ARMOR_STEP'],'Open plinth apron outside existing command housing');
  if(a.role==='TRANSITION_NECK'||a.role==='BELT_HAUNCH')emit('ARMOR_JOINT',a.id,a.parentStructureId,c,{x:0,y:1,z:0},['ARMOR_SHOULDER_EXTENSION'],'Actual structural armor interface');
 }
 for(const m of b.weaponLayout?.mounts??[]){if(m.category!=='CANNON'||m.standard.size==='S')continue;
  // Both flank haunches are outside the actual mounting footprint; operating envelope remains protected.
  for(const side of[-1,1]){const hint=add(m.position,mul(m.frame.right,side*(m.footprint.width*.5+L*.018*MESO_STYLE[b.shipyardId as keyof typeof MESO_STYLE].width+.35)));emit('WEAPON_FOUNDATION',m.contacts[0].surfaceId,m.contacts[0].structureId,hint,m.frame.normal,['WEAPON_BARBETTE_INTEGRATION'],'Supply/support haunch beside existing standardized cannon foundation',m.equipment.prefabId);}
 }
 for(const ch of b.productionDesign?.channels??[]){
  for(const id of[ch.leftBankId,ch.rightBankId]){const bank=armor.find(a=>a.id===id);if(!bank)continue;const f=ch.floor[Math.floor(ch.floor.length/2)],sign=Math.sign((bank.bounds.min.x+bank.bounds.max.x)/2-f.x)||1;
   emit('SERVICE_CHANNEL',id,ch.parentStructureId,{x:f.x+sign*(ch.width*.5+L*.012),y:f.y,z:f.z}, {x:0,y:1,z:0},['MACHINERY_GALLERY','SERVICE_RECESS_FRAME'],'Coping on the bank of an already open service channel; keep its center lane',ch.id);
  }
 }
 for(const hostId of [...new Set(b.engines.map(e=>e.parentId))]){const host=b.structuralVolumes.find(v=>v.id===hostId);if(!host)continue;
  const z=host.position.z+host.geometry.stations[0].z+host.dimensions.z*.82;
  for(const side of[-1,1])emit('PROPULSION_ROOT',hostId,hostId,{...host.position,z},{x:side,y:0,z:0},['ENGINE_ROOT_TRANSITION'],'Supply/root fairing on real propulsion host, upstream of reserved nozzle outlet',b.engines.find(e=>e.parentId===hostId)!.id);
 }
 return zones;
}
export function mesoAsDetail(p:MesoPlacement):DetailPlacement{
 return {id:p.id,kit:'ACCESS_HATCH',zoneId:p.zoneId,parentStructureId:p.parentStructureId,styleVariant:p.parameters.style,lodClass:'MESO',attachment:{surfaceId:p.parentSurfaceId,structureId:p.parentStructureId,normal:p.attachment.frame.normal,...p.attachment},assembly:{parts:p.parts.map(q=>({...q,material:q.materialRole==='MECHANICAL_STRUCTURE'?'engine':'secondary'})),attachments:[],equipmentIds:[],clearances:[]},bounds:p.bounds,access:{origin:p.attachment.position,direction:p.attachment.frame.normal,depth:0},hierarchy:'MESO',physicalOrVisualRole:'VISUAL_ONLY',functionalConnection:p.kind,importance:p.importance};
}
/** Contact inset follows the actual station surface, not a single flat world-up plane. */
export function mesoIssues(b:ShipBlueprint,p:MesoPlacement,prior:DetailPlacement[],scene:ReturnType<typeof detailScene>):string[]{
 const parents=new Set(p.attachment.contacts.map(c=>c.surfaceId)),errors=detailIssues(b,mesoAsDetail(p),prior,scene.filter(s=>!parents.has(s.id))),n=p.attachment.frame.normal;
 for(const s of scene.filter(s=>parents.has(s.id))){const surfaces=[{id:s.id,structureId:p.parentStructureId,solid:s.solid,box:s.bounds,triangles:solidTriangles(s.solid).map(t=>({vertices:t,n:normal(t)}))}];
  for(const part of p.parts)if(overlappingBounds(part.bounds,s.bounds))for(const q of geometrySamples(part.solid))if(solidContains(s.solid,q)){const c=surfaceRay(surfaces,q,n);if(!c||dot(sub(q,c.position),n)<-p.attachment.inset-.025)errors.push('Intrusion deeper than measured station inset '+s.id);}
 }
 // Broad-phase bounds + real edge/triangle crossings supplement containment samples.
 // Intended support inset is handled above; other solids retain strict interference checks.
 const obstacles=[...scene.filter(s=>!parents.has(s.id)),...prior.flatMap(d=>d.assembly.parts)].map(s=>({id:s.id,solid:s.solid,bounds:s.bounds}));
 for(const part of p.parts){const near=obstacles.filter(o=>overlappingBounds(o.bounds,part.bounds));if(!near.length)continue;const edges=new Set<string>();
  for(let i=0;i<part.solid.indices.length;i+=3)for(let j=0;j<3;j++){const a=part.solid.indices[i+j],c=part.solid.indices[i+(j+1)%3],key=[Math.min(a,c),Math.max(a,c)].join('/');if(edges.has(key))continue;edges.add(key);const start=part.solid.vertices[a],delta=sub(part.solid.vertices[c],start),length=Math.hypot(delta.x,delta.y,delta.z);if(length<.06)continue;const crossing=rayBlocked(start,mul(delta,1/length),length-.03,near);if(crossing)errors.push('Meso edge crosses other solid '+crossing);}
 }
 return [...new Set(errors)];
}
/** Exact exterior support patch, clipped against the local footprint, serialized for replay. */
function stationPatch(surfaces:ArmorSurfaces,contacts:MesoPlacement['attachment']['contacts'],position:Vec3,frame:MesoPlacement['attachment']['frame'],w:number,l:number,clip:number,taper:number){
 const polygon=mesoPerimeter(w,l,clip,taper).map(v=>worldPoint(position,frame,v)),ids=new Set(contacts.map(c=>c.surfaceId)),vertices:Vec3[]=[],indices:number[]=[],lookup=new Map<string,number>();let covered=0;
 for(const s of surfaces.filter(s=>ids.has(s.id)))for(const t of s.triangles){if(dot(t.n,frame.normal)<.88)continue;let clipped=[...t.vertices];
  for(let i=0;i<polygon.length&&clipped.length>=3;i++){const inward=cross(frame.normal,sub(polygon[(i+1)%polygon.length],polygon[i]));clipped=clipHalfSpace(clipped,inward,dot(inward,polygon[i]),true);}
  if(clipped.length<3||area(clipped)<1e-7)continue;
  const center=mul(clipped.reduce((s,p)=>add(s,p),{x:0,y:0,z:0}),1/clipped.length),hit=surfaceRay(surfaces,center,frame.normal);if(!hit||hit.surfaceId!==s.id||Math.abs(dot(sub(hit.position,center),frame.normal))>.03)continue;
  const face=clipped.map(v=>{const key=Object.values(v).map(x=>x.toFixed(6)).join('/');let i=lookup.get(key);if(i===undefined){i=vertices.length;vertices.push(v);lookup.set(key,i);}return i;});
  for(let i=1;i<face.length-1;i++){indices.push(face[0],face[i],face[i+1]);covered+=area([clipped[0],clipped[i],clipped[i+1]])*dot(t.n,frame.normal);}
 }
 const requested=area(polygon);if(covered<requested*.998||covered>requested*1.002)throw Error('Actual station patch is incomplete, occluded or overlaps itself');return{vertices,indices};
}
export function addMesoStructures(b:ShipBlueprint,options:{kinds?:readonly MesoKind[];onTimings?:(t:{planningMs:number;validationMs:number;totalMs:number})=>void}={}):ShipBlueprint{
 const start=performance.now(),surfaces=mesoSurfaces(b),scene=detailScene(b,surfaces),style=MESO_STYLE[b.shipyardId as keyof typeof MESO_STYLE],L=b.order.length;
 const plan:MesoStructurePlan={version:'1.8.5.3',generationSeed:b.seed,namespace:'meso-structure-v1',styleLanguage:b.shipyardId,sourceBlueprintVersion:b.generatorVersion??'1.8.4.2',detectedZones:detectMesoZones(b),placements:[],decisions:[],bounds:structuredClone(b.exteriorDetailPlan?.bounds??b.productionDesign!.overallBounds),validation:{issues:[],checks:[]}};
 const limit=L<70?7:L<160?14:26;
 // Resolve major cannon integration before optional terraces occupy its adjacent armor.
 const zonePriority=(z:MesoZone)=>z.kind==='WEAPON_FOUNDATION'&&b.weaponLayout?.mounts.some(m=>m.equipment.prefabId===z.equipmentId&&m.standard.size==='L')?-3:z.kind==='PRIMARY_ARMOR'||z.kind==='ARMOR_SHOULDER'?-2:z.kind==='WEAPON_FOUNDATION'?-1:0;
 plan.detectedZones.sort((a,c)=>zonePriority(a)-zonePriority(c));
 for(const zone of plan.detectedZones){
  const target=surfaces.find(s=>s.id===zone.parentSurfaceId);if(!target)continue;
  zone.availableAreaM2=target.triangles.filter(t=>dot(t.n,zone.normal)>.65).reduce((s,t)=>s+area(t.vertices),0);
  const availableKinds=zone.allowed.filter(k=>(options.kinds??MESO_KINDS).includes(k));
  // Selection varies at the design level, never jitters independent fasteners or functional equipment.
  const kind=availableKinds.length?availableKinds[surfaceHash(`${b.seed}/${zone.id}`)%availableKinds.length]:undefined;if(!kind)continue;
  let accepted=false;const seedPhase=(surfaceHash(`meso-structure-v1/${b.seed}/${zone.parentSurfaceId}`)%3)-1;
  const candidates=[1,.8,.65].flatMap(fit=>[seedPhase*.19,-.26,.26,-.40,.40].map(fraction=>({fit,fraction})));
  for(const [candidate,{fraction,fit}]of candidates.entries()){
   zone.candidateCount++;
   try{
    if(plan.placements.length>=limit)throw Error('Meso visual hierarchy budget; retain broad empty armor');
    const mount=b.weaponLayout?.mounts.find(m=>m.equipment.prefabId===zone.equipmentId),channel=b.productionDesign?.channels.find(c=>c.id===zone.equipmentId);
    const searchSpan=mount?mount.footprint.length:channel?Math.max(0,Math.max(...channel.floor.map(p=>p.z))-Math.min(...channel.floor.map(p=>p.z))-L*.10):zone.kind==='PROPULSION_ROOT'?target.box.max.z-target.box.min.z>0?(target.box.max.z-target.box.min.z)*.14:0:target.box.max.z-target.box.min.z;
    const hint=mount?add(zone.hint,mul(mount.frame.forward,-searchSpan*fraction)):{...zone.hint,z:zone.hint.z+searchSpan*fraction},hit=surfaceRay(surfaces,hint,zone.normal);if(!hit||hit.structureId!==zone.parentStructureId||dot(hit.normal,zone.normal)<.65)throw Error('No exposed coherent parent surface');
    const frame=detailFrame(hit.normal),support=surfaces.find(s=>s.id===hit.surfaceId)!;
    const face=target.triangles.filter(t=>dot(t.n,hit.normal)>.88).flatMap(t=>t.vertices);if(face.length<3)throw Error('No finite planar support region');
    const xs=face.map(v=>dot(sub(v,hit.position),frame.right)),zs=face.map(v=>-dot(sub(v,hit.position),frame.forward));
    const spanX=Math.max(...xs)-Math.min(...xs),spanZ=Math.max(...zs)-Math.min(...zs);
    const desired=kind==='MACHINERY_GALLERY'||kind==='SERVICE_RECESS_FRAME'?{w:Math.min(L*.018,6),l:L*.10,h:L*.012}:kind==='WEAPON_BARBETTE_INTEGRATION'?{w:L*.036,l:L*.10,h:L*.014}:kind==='FLANK_ARMOR_BELT'?{w:L*.028,l:L*.15,h:L*.012}:kind==='VENTRAL_KEEL_SUPPORT'?{w:L*.055,l:L*.14,h:L*.018}:kind==='ENGINE_ROOT_TRANSITION'?{w:L*.05,l:L*.12,h:L*.015}:{w:L*(zone.kind==='PRIMARY_ARMOR'&&Math.abs(zone.hint.x-(target.box.min.x+target.box.max.x)/2)>L*.015?.078:.12),l:L*.19,h:L*.023};
    const w=Math.min(desired.w*style.width*fit,spanX*.65),l=Math.min(desired.l*fit,spanZ*.62),h=Math.min(desired.h*style.height,w*(kind==='MACHINERY_GALLERY'||kind==='SERVICE_RECESS_FRAME'?.5:.27),l*.17);
    if(w<Math.max(.8,L*.007)||l<Math.max(2,L*.021)||h<Math.max(.25,L*.0018))throw Error('Insufficient meso-sized coherent area');
    const inset=Math.min(.12,Math.max(.035,L*.00028)),contacts=[];
    for(const p of [...mesoPerimeter(w,l,style.clip,style.taper),{x:0,y:0,z:0},{x:-w*.25,y:0,z:0},{x:w*.25,y:0,z:0},{x:0,y:0,z:-l*.25},{x:0,y:0,z:l*.25}]){
     const q=worldPoint(hit.position,frame,p),c=surfaceRay(surfaces,q,hit.normal);if(!c||c.structureId!==hit.structureId||!surfaces.some(s=>s.id===c.surfaceId&&(b.productionDesign?.armor.some(a=>a.id===s.id)||b.productionDesign?.finish.some(a=>a.id===s.id)||b.structuralVolumes.some(v=>v.id===s.id)))||dot(c.normal,hit.normal)<.88||Math.abs(dot(sub(c.position,q),hit.normal))>h*1.2)throw Error('Unsupported footprint: '+JSON.stringify({surface:c?.surfaceId,parent:c?.structureId,normalDot:c?dot(c.normal,hit.normal):null,relief:c?dot(sub(c.position,q),hit.normal):null,height:h}));contacts.push(c);
    }
    const rootPatch=stationPatch(surfaces,contacts,hit.position,frame,w,l,style.clip,style.taper);
    const parameters={width:w,length:l,height:h,taper:style.taper,clip:style.clip,style:b.shipyardId},attachment={position:hit.position,frame,contacts,inset,footprint:{width:w,length:l},rootPatch},id='meso/'+zone.id+'/'+kind,parts=mesoGeometry(id,kind,parameters,attachment);
    const p:MesoPlacement={id,kind,zoneId:zone.id,parentStructureId:zone.parentStructureId,parentSurfaceId:hit.surfaceId,parentEquipmentId:zone.equipmentId,attachment,parameters,parts,bounds:boundsOf(parts.flatMap(p=>p.solid.vertices)),lodClass:h>=L*.009?'SILHOUETTE_RELEVANT':'STRUCTURAL_READABLE',importance:kind==='WEAPON_BARBETTE_INTEGRATION'?1:.8,physicalOrVisualRole:'VISUAL_STRUCTURE_ONLY',combatProtection:'NOT_SIMULATED',references:[zone.parentSurfaceId,...(zone.equipmentId?[zone.equipmentId]:[])]};
    const prior=[...(b.exteriorDetailPlan?.kitPlacements??[]),...plan.placements.map(mesoAsDetail)];
    let errors=mesoIssues(b,p,prior,scene);
    // Re-plan the cover height under retained weapon clearance; never relax the firing test.
    for(const factor of [.65,.40]){if(!errors.length||!errors.every(e=>/Static firing path|Weapon operating envelope|Other equipment\/armor interference/.test(e)))break;p.parameters={...parameters,height:h*factor};p.parts=mesoGeometry(id,kind,p.parameters,attachment);p.bounds=boundsOf(p.parts.flatMap(a=>a.solid.vertices));errors=mesoIssues(b,p,prior,scene);}
    if(errors.length)throw Error(errors.join('; '));
    plan.placements.push(p);plan.decisions.push({zoneId:zone.id,kind,candidate,status:'accepted',reason:'Thirteen measured contacts; parent inset only; existing openings, weapon envelopes, firing rays and kit access preserved'});accepted=true;break;
   }catch(e){plan.decisions.push({zoneId:zone.id,kind,candidate,status:'omitted',reason:(e as Error).message});}
  }
  if(!accepted)continue;
 }
 const planningEnd=performance.now();plan.bounds=boundsOf([plan.bounds.min,plan.bounds.max,...plan.placements.flatMap(p=>p.parts.flatMap(p=>p.solid.vertices))]);b.mesoStructurePlan=plan;
 // Optional structures cannot convert a released physical ship into a design rejection.
 plan.validation=validateMesoStructures(b);
 if(plan.validation.issues.length){const candidates=[...plan.placements];plan.placements=[];
  for(const candidate of candidates){plan.placements.push(candidate);const replay=validateMesoStructures(b);if(replay.issues.length){plan.placements.pop();plan.decisions.push({zoneId:candidate.zoneId,kind:candidate.kind,candidate:-1,status:'omitted',reason:'Optional meso safety replay: '+replay.issues.join('; ')});}}
  const base=b.exteriorDetailPlan?.bounds??b.productionDesign!.overallBounds;plan.bounds=boundsOf([base.min,base.max,...plan.placements.flatMap(p=>p.parts.flatMap(p=>p.solid.vertices))]);plan.validation=validateMesoStructures(b);
 }
 b.generatorVersion='1.8.5.3';options.onTimings?.({planningMs:planningEnd-start,validationMs:performance.now()-planningEnd,totalMs:performance.now()-start});return b;
}
