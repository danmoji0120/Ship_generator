import type {ShipBlueprint} from '../../blueprint/types';
import type {DetailKitType,ExteriorDetailPlan,DetailZoneKind} from './types';
import {SeededRng} from '../../random/rng';
import {STYLE} from './registry';
import {armorSurfaces} from '../weapons/surfaces';
import {detailSurfaces,detectDetailZones} from './zones';
import {detailScene,detailIssues,resolveDetail} from './placement';
import {detailFrame,kitSize} from './geometry';
import {worldPoint} from '../weapons/surfaces';
import {boundsOf,add,mul,dot,sub} from '../integration/contours';
const RECIPES:Record<DetailZoneKind,DetailKitType[]>={
 COMMAND:['ACCESS_HATCH','EVA_HANDRAIL','EVA_LADDER','SENSOR_STRIP'],
 SENSOR:['SENSOR_STRIP','OPTICAL_SENSOR'],
 SERVICE_CHANNEL:['MACHINE_ACCESS_COVER','CONDUIT_BUNDLE','SERVICE_CATWALK','EVA_LADDER','SERVICE_PORT','COOLANT_PIPE','DRONE_DOCK'],
 PROPULSION:['ENGINE_SERVICE_FRAME','VENT_LOUVER','COOLANT_PIPE','MACHINE_ACCESS_COVER','HAZARD_MARKING'],
 WEAPON_PRIMARY:['WEAPON_SERVICE_RING','ACCESS_HATCH'],
 MISSILE_BAY:['MISSILE_CELL_DETAIL','HAZARD_MARKING'],
 ARMOR_JOINT:['REINFORCEMENT_BRACKET','ARMOR_CLAMP','PANEL_SEAM'],
 MANEUVERING:['RCS_CLUSTER'],GENERAL_HULL:['ACCESS_HATCH','RECESSED_SERVICE_PANEL'],
};
/** Stable per-site stream: adding a kit does not consume another site's randomness. */
export function detailSeed(seed:number,key:string){let h=(seed^0x85d3a7b1)>>>0;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
export function addExteriorDetails(b:ShipBlueprint):ShipBlueprint {
 const style=STYLE[b.shipyardId as keyof typeof STYLE],surfaces=detailSurfaces(b,armorSurfaces(b)),scene=detailScene(b,surfaces),zones=detectDetailZones(b,surfaces);
 const plan:ExteriorDetailPlan={version:'1.8.5',baseGeneratorVersion:b.generatorVersion,generationSeed:b.seed,rngNamespace:'exterior-detail-v1',styleLanguage:style.name,detectedZones:zones,kitPlacements:[],densityDecisions:[],decisions:[],reservedClearances:[...(b.productionDesign?.zones??[]).map(z=>({id:z.id,source:z.kind})),...(b.weaponLayout?.mounts??[]).map(m=>({id:m.id,source:'standard weapon envelope and static local firing samples'})),...(b.designRequirements?.spaces??[]).map(s=>({id:s.id,source:s.purpose})),...(b.prefabPlacements??[]).flatMap(p=>(p.assembly?.parts??[]).filter(a=>a.role==='PROTECTED_SENSOR').map(a=>({id:a.id,source:'Existing sensor aperture direction'})))],bounds:b.productionDesign!.overallBounds,validationResults:{issues:[],checks:['Measured final-surface five-point footprint','Reciprocal sampled solids and reserved openings','Existing weapon operating envelopes and all static firing samples','Earlier detail access and intentional negative space','Optional omission only; no base geometry/resource modification']}};
 const maximum=Math.min(72,Math.max(12,Math.floor(Math.sqrt(b.order.length)*3.0))),volumeHosts=Math.max(1,b.structuralVolumes.length);
 for(const zone of zones){let accepted=0,attempted=0;
  const limit=zone.kind==='SERVICE_CHANNEL'?Math.round(4*zone.density):zone.kind==='PROPULSION'?Math.round(3*zone.density):zone.kind==='COMMAND'?3:zone.kind==='ARMOR_JOINT'?2:zone.kind==='GENERAL_HULL'?1:2;
  let recipe=RECIPES[zone.kind].filter(k=>zone.allow.includes(k));
  if(zone.kind==='GENERAL_HULL'&&!style.exposed)recipe=['RECESSED_SERVICE_PANEL','ACCESS_HATCH'];
  if(zone.kind==='ARMOR_JOINT'&&!style.exposed)recipe=b.shipyardId==='serein'?['PANEL_SEAM','ARMOR_CLAMP']:['PANEL_SEAM','REINFORCEMENT_BRACKET'];
  if(!style.exposed)recipe=recipe.filter(k=>!['SERVICE_CATWALK','CONDUIT_BUNDLE','ENGINE_SERVICE_FRAME'].includes(k));
  for(const kit of recipe){const id='detail/'+zone.id+'/'+kit, rng=new SeededRng(detailSeed(b.seed,zone.id+'/'+kit));let last='Zone density or global polygon budget reached';
   if(accepted>=limit||plan.kitPlacements.length>=maximum){plan.decisions.push({id,kit,zoneId:zone.id,status:'omitted',reason:last});continue;}
   const channel=b.productionDesign!.channels.find(c=>c.id===zone.id),parameters=channel&&['CONDUIT_BUNDLE','COOLANT_PIPE'].includes(kit)?{routeLength:Math.min(12,Math.max(4,(Math.max(...channel.floor.map(p=>p.z))-Math.min(...channel.floor.map(p=>p.z)))*.12))}:undefined;
   const [w,,baseLength]=kitSize(kit,b.shipyardId),l=parameters?.routeLength??baseLength,frame=detailFrame(zone.normal);
   // A coherent service lattice. Choice rotates traversal order, never adds coordinate noise.
   const sites=[[0,0],[0,-l*1.25],[0,l*1.25],[-w*1.35,0],[w*1.35,0],[-w*1.35,-l*1.25],[w*1.35,l*1.25]];
   const start=rng.int(0,2),ordered=[...sites.slice(start),...sites.slice(0,start)];
   const faceSites=surfaces.filter(s=>zone.surfaceIds.includes(s.id)).flatMap(s=>s.triangles.filter(t=>dot(t.n,zone.normal)>.65).map(t=>({hint:mul(t.vertices.reduce(add,{x:0,y:0,z:0}),1/3),normal:t.n}))).filter(t=>Math.hypot(...Object.values(sub(sub(t.hint,zone.hint),mul(zone.normal,dot(sub(t.hint,zone.hint),zone.normal)))))<Math.max(8,l*4)).sort((a,c)=>Math.hypot(...Object.values(sub(sub(a.hint,zone.hint),mul(zone.normal,dot(sub(a.hint,zone.hint),zone.normal)))))-Math.hypot(...Object.values(sub(sub(c.hint,zone.hint),mul(zone.normal,dot(sub(c.hint,zone.hint),zone.normal)))))).slice(0,8);
   const candidates=[...ordered.map(([x,z])=>({hint:worldPoint(zone.hint,frame,{x,y:0,z}),normal:zone.normal})),...faceSites];
   for(const site of candidates){attempted++;
    try{const p=resolveDetail(b,{...zone,normal:site.normal},kit,id,surfaces,site.hint,parameters);
     if(zone.kind==='SERVICE_CHANNEL'&&!zone.equipmentId){const channel=b.productionDesign!.channels.find(c=>c.id===zone.id)!;
      if(p.attachment.position.y>zone.hint.y+channel.depth*.65||Math.abs(p.attachment.position.x-zone.hint.x)>channel.width*.48)throw Error('Service kit would sit on armor crest instead of the channel floor');}
     const issues=detailIssues(b,p,plan.kitPlacements,scene);if(issues.length)throw Error(issues.slice(0,3).join('; '));
     plan.kitPlacements.push(p);accepted++;plan.decisions.push({id,kit,zoneId:zone.id,status:'accepted',reason:zone.reason+'; actual exposed contact and protected access checked'});last='';break;
    }catch(e){last=(e as Error).message;}
   }
   if(last)plan.decisions.push({id,kit,zoneId:zone.id,status:'omitted',reason:last});
  }
  plan.densityDecisions.push({zoneId:zone.id,attempted,accepted,maximum:limit,reason:`Functional sites, ${style.name}; ${volumeHosts} actual hosts; overall cap ${maximum}; untouched large armor areas intentional`});
 }
 plan.bounds=boundsOf([b.productionDesign!.overallBounds.min,b.productionDesign!.overallBounds.max,...plan.kitPlacements.flatMap(p=>p.assembly.parts.flatMap(a=>a.solid.vertices))]);
 b.exteriorDetailPlan=plan;b.generatorVersion='1.8.5';return b;
}
