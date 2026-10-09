import type {ShipBlueprint} from '../../blueprint/types';
import {DETAIL_KITS,STYLE} from './registry';
import {armorSurfaces,surfaceRay} from '../weapons/surfaces';
import {detailSurfaces} from './zones';
import {detailScene,detailIssues} from './placement';
import {detailAssembly,detailFrame,kitSize} from './geometry';
import {boundsOf,sub,dot} from '../integration/contours';
import {solidTriangles,area,normal} from '../armor/panels';
export function validateExteriorDetails(b:ShipBlueprint):string[]{
 const plan=b.exteriorDetailPlan;if(!plan)return [];const issues:string[]=[],ids=new Set<string>(),surfaces=detailSurfaces(b,armorSurfaces(b)),scene=detailScene(b,surfaces),prior:typeof plan.kitPlacements=[];
 if(plan.version!=='1.8.5'||plan.generationSeed!==b.seed||plan.rngNamespace!=='exterior-detail-v1'||plan.styleLanguage!==STYLE[b.shipyardId as keyof typeof STYLE].name)issues.push('Invalid detail plan version/seed/style');
 const zones=new Map(plan.detectedZones.map(z=>[z.id,z]));
 for(const p of plan.kitPlacements){
  const zone=zones.get(p.zoneId),r=DETAIL_KITS[p.kit];
  if(ids.has(p.id)||!zone||!r||!zone.allow.includes(p.kit)||!r.zones.includes(zone.kind)||!b.structuralVolumes.some(v=>v.id===p.parentStructureId))issues.push('Invalid detail ID/functional parent '+p.id);ids.add(p.id);
  if(!r||!zone)continue;
  if(p.parentEquipmentId&&!b.prefabPlacements?.some(a=>a.id===p.parentEquipmentId)&&!b.engines.some(e=>e.id===p.parentEquipmentId))issues.push('Missing detail equipment '+p.id);
  if(p.physicalOrVisualRole!=='VISUAL_ONLY'||p.lodClass!==r?.lod)issues.push('Unimplemented physical effect or invalid LOD '+p.id);
  if(JSON.stringify(p.attachment.frame)!==JSON.stringify(detailFrame(p.attachment.normal)))issues.push('Invalid local detail basis '+p.id);
  const size=kitSize(p.kit,b.shipyardId);if(p.attachment.footprint.width!==size[0]||p.attachment.footprint.length!==(p.geometryParameters?.routeLength??size[2])||p.attachment.inset!==.025||p.attachment.contacts.length!==(p.geometryParameters?9:5))issues.push('Invalid physical footprint '+p.id);
  for(const c of p.attachment.contacts){const hit=surfaceRay(surfaces,c.position,p.attachment.normal);if(!hit||hit.surfaceId!==c.surfaceId||Math.hypot(...Object.values(sub(hit.position,c.position)))>.05||dot(hit.normal,c.normal)<.99)issues.push('Detached detail contact '+p.id);}
  if(p.geometryParameters&&(!['CONDUIT_BUNDLE','COOLANT_PIPE'].includes(p.kit)||!Number.isFinite(p.geometryParameters.routeLength)||p.geometryParameters.routeLength<4||p.geometryParameters.routeLength>12||zone?.kind!=='SERVICE_CHANNEL'))issues.push('Invalid route geometry parameters '+p.id);
  const fresh=detailAssembly(p.id,p.kit,b.shipyardId,p.attachment.position,p.attachment.frame,p.geometryParameters);
  if(JSON.stringify(fresh.parts)!==JSON.stringify(p.assembly.parts))issues.push('Detail geometry differs from stored parametric kit '+p.id);
  for(const a of p.assembly.parts){if(JSON.stringify(boundsOf(a.solid.vertices))!==JSON.stringify(a.bounds))issues.push('Stale detail part bounds '+p.id);
   let volume=0;for(const t of solidTriangles(a.solid)){if(area(t)<1e-9||t.some(q=>Object.values(q).some(x=>!Number.isFinite(x)))||Object.values(normal(t)).some(x=>!Number.isFinite(x)))issues.push('Invalid detail triangle '+a.id);const[u,v,w]=t;volume+=(u.x*(v.y*w.z-v.z*w.y)+u.y*(v.z*w.x-v.x*w.z)+u.z*(v.x*w.y-v.y*w.x))/6;}if(volume<=0)issues.push('Inverted detail volume '+a.id);
  }
  if(JSON.stringify(boundsOf(p.assembly.parts.flatMap(a=>a.solid.vertices)))!==JSON.stringify(p.bounds))issues.push('Stale detail bounds '+p.id);
  issues.push(...detailIssues(b,p,prior,scene).map(e=>p.id+': '+e));prior.push(p);
  if(p.rcs&&(p.kit!=='RCS_CLUSTER'||p.rcs.status!=='RESERVED_FOR_COMBAT'||p.rcs.nozzleCount!==4))issues.push('Invalid RCS semantics '+p.id);
 }
 const expected=boundsOf([b.productionDesign!.overallBounds.min,b.productionDesign!.overallBounds.max,...plan.kitPlacements.flatMap(p=>p.assembly.parts.flatMap(a=>a.solid.vertices))]);if(JSON.stringify(expected)!==JSON.stringify(plan.bounds))issues.push('Stale detail overall bounds');
 return [...new Set(issues)];
}
