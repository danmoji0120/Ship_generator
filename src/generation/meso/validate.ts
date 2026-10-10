import {mesoConnectorScene} from './connector-scene';
import type {ShipBlueprint} from '../../blueprint/types';
import {mesoSurfaces,mesoAsDetail,mesoIssues} from './build';
import {mesoGeometry} from './geometry';
import {detailScene} from '../details/placement';
import {surfaceRay} from '../weapons/surfaces';
import {area,cross,solidTriangles} from '../armor/panels';
import {boundsOf,dot,sub,mul} from '../integration/contours';
export function validateMesoStructures(b:ShipBlueprint){
 const p=b.mesoStructurePlan,issues:string[]=[],checks=['Closed finite reconstructed solids','Thirteen real triangle support contacts','Existing operating/firing/XL/opening/access exclusions','Separate visual structure authority; no armor coverage or combat strength'];if(!p)return{issues,checks};
 const surfaces=mesoSurfaces(b),scene=[...detailScene(b,surfaces),...(p.version==='1.8.5.3.1'?mesoConnectorScene(b):[])],ids=new Set<string>(),prior=[...(b.exteriorDetailPlan?.kitPlacements??[])];
 if(!['1.8.5.3','1.8.5.3.1'].includes(p.version)||p.generationSeed!==b.seed||p.namespace!=='meso-structure-v1'||p.styleLanguage!==b.shipyardId)issues.push('Invalid meso version/seed/style');
 for(const a of p.placements){
  if(ids.has(a.id)||!p.detectedZones.some(z=>z.id===a.zoneId&&z.allowed.includes(a.kind))||!b.structuralVolumes.some(v=>v.id===a.parentStructureId)||a.combatProtection!=='NOT_SIMULATED'||a.physicalOrVisualRole!=='VISUAL_STRUCTURE_ONLY'||a.attachment.contacts.length!==13)issues.push('Invalid meso identity/parent/authority '+a.id);ids.add(a.id);
  const sourceZone=p.detectedZones.find(z=>z.id===a.zoneId);
  if(sourceZone?.equipmentId!==a.parentEquipmentId)issues.push('Meso source equipment mismatch '+a.id);
  const mount=b.weaponLayout?.mounts.find(m=>m.equipment.prefabId===a.parentEquipmentId),channel=b.productionDesign?.channels.find(c=>c.id===a.parentEquipmentId);
  if(a.kind==='WEAPON_BARBETTE_INTEGRATION'&&(!mount||Math.abs(dot(sub(a.attachment.position,mount.position),mount.frame.forward))>mount.footprint.length*.5+.1))issues.push('Meso outside weapon foundation neighborhood '+a.id);
  if((a.kind==='MACHINERY_GALLERY'||a.kind==='SERVICE_RECESS_FRAME')&&(!channel||a.bounds.min.z<Math.min(...channel.floor.map(p=>p.z))-3||a.bounds.max.z>Math.max(...channel.floor.map(p=>p.z))+3))issues.push('Meso outside actual service channel '+a.id);
  if(a.kind==='ENGINE_ROOT_TRANSITION'&&!b.engines.some(e=>e.id===a.parentEquipmentId))issues.push('Meso missing propulsion source '+a.id);
  if(p.version==='1.8.5.3.1'){
   if(sourceZone?.root){const r=sourceZone.root,e=b.engines.find(e=>e.id===r.engineId);if(!e||e.parentId!==a.parentStructureId||JSON.stringify(e.position)!==JSON.stringify(r.position)||JSON.stringify(e.direction??{x:0,y:0,z:1})!==JSON.stringify(r.direction)||e.nozzleRadius!==r.radius||!['WIDE_ROOT_FAIRING','NARROW_ROOT_FAIRING','SEGMENTED_ROOT_SUPPORT','LOW_PROFILE_TRANSITION'].includes(a.parameters.rootVariant??'')||Math.hypot(...Object.values(sub(a.attachment.position,e.position)))>Math.max(e.nozzleRadius*4,b.order.length*.07))issues.push('Invalid actual engine root reference/neighborhood '+a.id);
    if(a.parameters.rootVariant==='SEGMENTED_ROOT_SUPPORT'&&p.placements.filter(q=>q.parentEquipmentId===a.parentEquipmentId&&q.parameters.rootVariant==='SEGMENTED_ROOT_SUPPORT').length<2)issues.push('Segmented root has no independently supported pair '+a.id);
   }
   if(sourceZone?.connectorId){const c=b.structuralConnectors.find(c=>c.id===sourceZone.connectorId),endpoint=c?.fromStructureId===a.parentStructureId?c.start:c?.toStructureId===a.parentStructureId?c.end:undefined;if(!c||!endpoint||Math.hypot(...Object.values(sub(a.attachment.position,endpoint)))>Math.max(b.order.length*.09,c.thickness*4))issues.push('Meso outside actual structural junction '+a.id);}
  }
  const f=a.attachment.frame;
  if([f.right,f.normal,f.forward].some(v=>Math.abs(dot(v,v)-1)>1e-5)||Math.abs(dot(f.right,f.normal))>1e-5||Math.abs(dot(f.normal,f.forward))>1e-5||dot(cross(f.right,f.normal),mul(f.forward,-1))<.99999)issues.push('Invalid meso local frame '+a.id);
  try{if(JSON.stringify(mesoGeometry(a.id,a.kind,a.parameters,a.attachment))!==JSON.stringify(a.parts))issues.push('Meso solid differs from parametric authority '+a.id);}catch{issues.push('Invalid meso root patch/recipe '+a.id);}

  for(const c of a.attachment.contacts){const hit=surfaceRay(surfaces,c.position,a.attachment.frame.normal);if(!hit||hit.surfaceId!==c.surfaceId||Math.hypot(...Object.values(sub(hit.position,c.position)))>.045)issues.push('Detached meso contact '+a.id);}
  for(const q of a.parts){if(ids.has(q.id))issues.push('Duplicate meso part ID '+q.id);ids.add(q.id);if(q.solid.indices.some(i=>!Number.isInteger(i)||i<0||i>=q.solid.vertices.length)||q.solid.indices.length%3){issues.push('Invalid meso triangle indices '+q.id);continue;}const edges=new Map<string,number>(),directions=new Map<string,number>();let volume=0;
   for(const t of solidTriangles(q.solid)){if(area(t)<1e-7||t.some(v=>Object.values(v).some(n=>!Number.isFinite(n))))issues.push('Invalid meso triangle '+q.id);volume+=dot(t[0],cross(t[1],t[2]))/6;}
   for(let i=0;i<q.solid.indices.length;i+=3)for(let j=0;j<3;j++){const x=q.solid.indices[i+j],y=q.solid.indices[i+(j+1)%3],key=[Math.min(x,y),Math.max(x,y)].join('/');edges.set(key,(edges.get(key)??0)+1);directions.set(key,(directions.get(key)??0)+(x<y?1:-1));}
   if(volume<=0||[...edges.values()].some(n=>n!==2)||[...directions.values()].some(n=>n!==0)||JSON.stringify(q.bounds)!==JSON.stringify(boundsOf(q.solid.vertices)))issues.push('Open/inverted/stale meso geometry '+q.id);
   if(q.solid.vertices.some(v=>(['x','y','z']as const).some(k=>v[k]<p.bounds.min[k]-1e-6||v[k]>p.bounds.max[k]+1e-6)))issues.push('Meso bounds exclude geometry '+q.id);
  }
  issues.push(...mesoIssues(b,a,prior,scene));prior.push(mesoAsDetail(a));
 }
 return{issues:[...new Set(issues)],checks};
}
