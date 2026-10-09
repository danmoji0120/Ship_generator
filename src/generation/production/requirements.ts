import type {ArchitectureGrammar,BoundsData,ShipBlueprint,ShipOrder,ShipRole,Vec3} from '../../blueprint/types';
import type {MacroFamily,MacroDesignPlan} from '../macro/types';
import {FAMILY_COMPATIBILITY,macroWeights} from '../macro/plan';
import {selectArchitecture,architectureWeights} from '../architecture/selection';
import {SeededRng} from '../../random/rng';
import {getShipyard} from '../../shipyards/config';
import {mountStandard} from '../weapons/standards';
import {containsProductionVolume} from './surface-contact';
import {emptyResources,plus,weaponResources,type Resources,type DesignSector} from './doctrine';
import {rayBlocked,solidsIntrude} from '../weapons/collision';
import {boundsOf} from '../integration/contours';
import {solidFromRings} from '../armor/panels';
import {armorSurfaces} from '../weapons/surfaces';

export type RequirementType='MANDATORY'|'TARGET'|'OPTIONAL';
export interface DesignRequirement {
 id:string;type:RequirementType;source:'Role'|'Priority'|'Size'|'Mass'|'Yard';capability:string;condition:string;priority:number;
 allocationRefs:DesignSector[];status:'PLANNED'|'SATISFIED'|'LIMITED'|'FAILED';
 metric:{name:string;unit:'count'|'ratio'|'design-index';target:number;actual:number};reason:string;
}
export interface SpaceReservation {id:string;requirementId:string;purpose:'XL_ENVELOPE'|'XL_SUPPLY'|'ENERGY_SYSTEM';hostId:string;bounds:BoundsData;sector:DesignSector;volumeM3:number}
export interface RequirementPlan {
 version:'1.8.4.2';phase:'PLANNED'|'RELEASED';requirements:DesignRequirement[];
 spinal?:{standard:ReturnType<typeof mountStandard>;supplyLength:number;minimumHullLength:number;hostId?:string;forward:Vec3};
 spaces:SpaceReservation[];
 preAllocationFractions:Record<DesignSector,number>;
 minimumCalibre?:'M'|'L';
 /** Suballocations, contained in doctrine sector budgets. Never additive capacity. */
 sectorFloors:Record<DesignSector,Resources>;
 energy:{unit:'abstract-design-units';capacity:number;reserved:number;sector:'structure';volumeFraction:number;volumeM3:number;description:string};
 resourceUnits:{massTonnes:'estimated-tonne-equivalent';volumeM3:'geometric-m3-reservation';surfaceM2:'geometric-m2';energy:'abstract-design-units'};
 priorityEvidence:{priority:keyof ShipOrder['priorities'];requested:number;sector:DesignSector;allocationFraction:number;reservedVolumeM3:number;actualEquipmentCount:number;capacityIndex:number;installedGeometry:{name:string;unit:'geometric-m2'|'geometric-m3'|'cost-index';value:number};limitation:string}[];
 chosen?:{architecture:ArchitectureGrammar;family:MacroFamily;candidate:number};
 rejectedCandidates:{candidate:number;architecture?:ArchitectureGrammar;family?:MacroFamily;stage:string;codes:string[];reasons:string[]}[];
}
export class DesignRejection extends Error {
 constructor(public codes:string[],public candidates:RequirementPlan['rejectedCandidates'],message:string){super(`${[...new Set(codes)].join(' / ')}: ${message}`);this.name='DesignRejection';}
}
const sectors:DesignSector[]=['structure','propulsion','armor','endurance','sensor','weapons'];
export const ROLE_CAPABILITIES:Record<ShipRole,{id:string;capability:string;condition:string}[]>={
 Corvette:[{id:'role-light-combat',capability:'Light combat and maneuver reserve',condition:'At least one offensive weapon; propulsion allocation fraction >= 0.08'}],
 Frigate:[{id:'role-escort',capability:'Escort fire and interception',condition:'Offensive weapon and actual point defense'}],
 Destroyer:[{id:'role-interceptor',capability:'Attack and interception',condition:'Offensive weapon and actual point defense'}],
 Cruiser:[{id:'role-multimission',capability:'Medium battery and mission sensing',condition:'Actual M/L cannon and actual sensor assembly'}],
 Battlecruiser:[{id:'role-capital-strike',capability:'Capital strike and maneuver reserve',condition:'Actual M/L cannon; propulsion allocation fraction >= 0.08'}],
 Battleship:[{id:'role-protected-battery',capability:'Capital battery and protection',condition:'Actual L cannon and retained CITADEL armor'}],
 'Missile Ship':[{id:'role-missile-launch',capability:'Missile-centered launch capability',condition:'Actual missile launcher and missile investment cost >= cannon investment cost'}],
 'Spinal Gun Ship':[{id:'role-spinal-xl',capability:'Unchanged XL axial gun with breech, support, supply and forward clearance',condition:'Actual HULL_INTEGRATED XL plus independent full-envelope/axis/reservation checks'}],
 'Patrol Ship':[{id:'role-patrol',capability:'Surveillance and basic defense',condition:'Actual sensor assembly and actual point defense'}],
};
export const PRIORITY_SECTOR:Record<keyof ShipOrder['priorities'],DesignSector>={firepower:'weapons',missile:'weapons',survivability:'armor',mobility:'propulsion',endurance:'endurance',sensor:'sensor'};
export function planRequirements(order:ShipOrder):RequirementPlan {
 const floors=Object.fromEntries(sectors.map(s=>[s,emptyResources()])) as RequirementPlan['sectorFloors'];
 const requirements:DesignRequirement[]=[];
 const add=(id:string,type:RequirementType,source:DesignRequirement['source'],capability:string,condition:string,priority:number,refs:DesignSector[],target=1,unit:DesignRequirement['metric']['unit']='count')=>requirements.push({id,type,source,capability,condition,priority,allocationRefs:refs,status:'PLANNED',metric:{name:capability,unit,target,actual:0},reason:'Pending physical design and final verification'});
 add('basic-propulsion','MANDATORY','Role','Attached working propulsion','At least one finite positive nozzle attached to an actual host',100,['propulsion']);
 add('physical-design','MANDATORY','Size','Physical installation and connected structure','Existing complete Blueprint validator: joins, armor, openings, contact, symmetry, collision and firing',100,['structure','armor','weapons']);
 for(const r of ROLE_CAPABILITIES[order.role])add(r.id,'MANDATORY','Role',r.capability,r.condition,100,['weapons','propulsion','sensor','armor']);
 for(const key of Object.keys(PRIORITY_SECTOR) as (keyof ShipOrder['priorities'])[])add(`priority-${key}`,'TARGET','Priority',`${key} capacity objective`,'Competing allocation/capacity target; saturation and actual assembly results recorded',order.priorities[key],[PRIORITY_SECTOR[key]],.08+order.priorities[key]*.002,'ratio');
 add('optional-support','OPTIONAL','Role','Additional defense and support','Remaining planned defense/launch groups and equipment targets',20,['weapons','endurance']);
 const plan:RequirementPlan={version:'1.8.4.2',phase:'PLANNED',requirements,spaces:[],preAllocationFractions:{structure:.08,propulsion:.08,armor:.06,endurance:.04,sensor:.025,weapons:0},sectorFloors:floors,energy:{unit:'abstract-design-units',capacity:100,reserved:8+order.priorities.firepower*.12+order.priorities.mobility*.1+order.priorities.sensor*.08,sector:'structure',volumeFraction:.12,volumeM3:0,description:'Reserved energy-distribution space inside structure allocation; no reactor, MW, thrust or combat simulation'},resourceUnits:{massTonnes:'estimated-tonne-equivalent',volumeM3:'geometric-m3-reservation',surfaceM2:'geometric-m2',energy:'abstract-design-units'},priorityEvidence:[],rejectedCandidates:[]};
 if(['Cruiser','Battlecruiser','Battleship'].includes(order.role)){plan.minimumCalibre=order.role==='Battleship'?'L':'M';floors.weapons=weaponResources(plan.minimumCalibre,'CANNON',order.length);}
 else if(order.role==='Missile Ship')floors.weapons=plus(weaponResources('S','MISSILE',order.length),weaponResources('S','MISSILE',order.length));
 else if(['Corvette','Frigate','Destroyer'].includes(order.role))floors.weapons=weaponResources('S','CANNON',order.length);
 if(['Frigate','Destroyer','Patrol Ship'].includes(order.role))floors.weapons=plus(floors.weapons,weaponResources('S','POINT_DEFENSE',order.length));
 if(order.role==='Spinal Gun Ship'){
  const standard=mountStandard('XL',order.length),scale=standard.envelope.width/45,supplyLength=25*scale;
  plan.spinal={standard,supplyLength,minimumHullLength:standard.envelope.length+supplyLength+20*scale,forward:{x:0,y:0,z:-1}};
  floors.weapons=weaponResources('XL','SPINAL',order.length);floors.weapons.volumeM3=standard.envelope.width*standard.envelope.height*standard.envelope.length;
  // Supply is separate from the installed envelope and charged inside structure.
  floors.structure={massTonnes:0,volumeM3:standard.envelope.width*.7*standard.envelope.height*.7*supplyLength,surfaceM2:0};
  if(order.length<plan.spinal.minimumHullLength)throw new DesignRejection(['REQUIRED_XL_BREECH_SPACE_UNAVAILABLE'],[],`Requested ${order.length}m cannot contain ${standard.envelope.length.toFixed(1)}m XL + ${supplyLength.toFixed(1)}m supply + protected rear support`);
 }
 return plan;
}
export function requirementCandidates(order:ShipOrder,seed:number,plan:RequirementPlan,forced?:{architecture?:ArchitectureGrammar;family?:MacroFamily}){
 const yard=getShipyard(order.shipyardId),selected=selectArchitecture(order,yard,new SeededRng(seed)).grammar,weights=architectureWeights(order,yard);
 const ranked=Object.entries(weights).sort((a,b)=>b[1]-a[1]).map(([g])=>g as ArchitectureGrammar);
 const grammars=forced?.architecture?[forced.architecture]:[selected,...ranked.filter(g=>g!==selected)];
 const out:{architecture:ArchitectureGrammar;family?:MacroFamily;minimumMacroCandidate:number}[]=[];
 for(const grammar of grammars){
  const compatible=FAMILY_COMPATIBILITY[grammar];
  let families=forced?.family?compatible.filter(f=>f===forced.family):[...compatible].sort((a,b)=>(macroWeights(order,yard,grammar)[b]??0)-(macroWeights(order,yard,grammar)[a]??0));
  if(plan.spinal){families=families.filter(f=>(grammar==='MONOLITHIC'&&f==='WEAPON_DOMINANT')||(['SPINE_AND_MODULES','HYBRID'].includes(grammar)&&['WEAPON_DOMINANT','SPLIT_FRAME'].includes(f)));
   if(!families.length)plan.rejectedCandidates.push({candidate:-1,architecture:grammar,stage:'architecture-prefilter',codes:['REQUIRED_XL_STRUCTURE_UNSUPPORTED'],reasons:['Compatible family has no continuous central axial host recipe; no geometry generated']});
  }
  if(plan.spinal||forced?.family){for(const family of families)out.push({architecture:grammar,family,minimumMacroCandidate:0});}
  else out.push({architecture:grammar,minimumMacroCandidate:0});
 }
 // Retry nearby variants only after viable different architecture/family candidates.
 return [...out,...out.slice(0,2).map(c=>({...c,minimumMacroCandidate:1}))].slice(0,6);
}
/** Called on module recipes BEFORE stations, connectors, engines or armor exist. */
export function reserveRequirementMacro(plan:RequirementPlan,modules:MacroDesignPlan['majorModuleRoles'],order:ShipOrder,grammar:ArchitectureGrammar,voids:MacroDesignPlan['negativeSpaceTargets']){
 if(plan.minimumCalibre){
  const standard=mountStandard(plan.minimumCalibre,order.length),host=[...modules].filter(m=>m.purpose!=='propulsion').sort((a,b)=>b.dimensions.x*b.dimensions.y*b.dimensions.z-a.dimensions.x*a.dimensions.y*a.dimensions.z)[0];
  if(!host||order.length<standard.envelope.length*2)throw Error('REQUIRED_ROLE_CAPABILITY_UNAVAILABLE: requested capital/medium battery has insufficient hull length');
  host.dimensions.x=Math.max(host.dimensions.x,standard.footprint.width*2.5);
 }
 if(!plan.spinal)return;
 const axis=modules.find(m=>m.purpose==='axial-weapon');
 if(!axis)throw Error('REQUIRED_XL_STRUCTURE_UNSUPPORTED: no axial parent module');
 const s=plan.spinal.standard;
 axis.dimensions.x=Math.max(axis.dimensions.x,s.envelope.width*1.65);
 axis.dimensions.y=Math.max(axis.dimensions.y,s.envelope.height*1.65);
 axis.shape.stationScales=axis.shape.stationScales?.map(q=>({...q,width:Math.max(q.width,s.envelope.width*1.5/axis.dimensions.x),height:Math.max(q.height,.95)}));
 // Minimum cross-section accounts for corner bevel/slopes, not only bounding width.
 axis.shape.frontScale=Math.max(axis.shape.frontScale,.95);axis.shape.rearScale=Math.max(axis.shape.rearScale,.95);
 if(grammar!=='MONOLITHIC'){
  const oldHalf=axis.dimensions.x/2;
  for(const m of modules.filter(m=>Math.abs(m.position.x)>0)){
   m.position.x=Math.sign(m.position.x)*Math.max(Math.abs(m.position.x),oldHalf+m.dimensions.x/2+order.length*.022);
  }
  for(const v of voids.filter(v=>v.id==='axis-service-channel'))v.center.x=axis.dimensions.x/2+v.size.x/2+order.length*.002;
  const reinforcement=modules.find(m=>m.id==='axis-reinforcement');if(reinforcement){reinforcement.position.y=(axis.dimensions.y+reinforcement.dimensions.y)/2-reinforcement.dimensions.y*.12;}
 }
}
export function bindRequirementSpaces(b:ShipBlueprint){
 const plan=b.designRequirements;if(!plan?.spinal)return;
 const host=b.structuralVolumes.find(v=>v.purpose==='axial-weapon');if(!host)throw Error('REQUIRED_XL_STRUCTURE_UNSUPPORTED: no actual axial host');
 const s=plan.spinal.standard,z=host.position.z+host.geometry.stations[0].z;
 const box=(width:number,height:number,start:number,length:number):BoundsData=>({min:{x:host.position.x-width/2,y:host.position.y-height/2,z:start},max:{x:host.position.x+width/2,y:host.position.y+height/2,z:start+length}});
 plan.spinal.hostId=host.id;
 plan.spaces=[{id:'required-xl-envelope',requirementId:'role-spinal-xl',purpose:'XL_ENVELOPE',hostId:host.id,bounds:box(s.envelope.width,s.envelope.height,z,s.envelope.length),sector:'weapons',volumeM3:s.envelope.width*s.envelope.height*s.envelope.length},
 {id:'required-xl-supply',requirementId:'role-spinal-xl',purpose:'XL_SUPPLY',hostId:host.id,bounds:box(s.envelope.width*.7,s.envelope.height*.7,z+s.envelope.length,plan.spinal.supplyLength/2),sector:'structure',volumeM3:s.envelope.width*.7*s.envelope.height*.7*plan.spinal.supplyLength/2},
 {id:'required-energy-space',requirementId:'role-spinal-xl',purpose:'ENERGY_SYSTEM',hostId:host.id,bounds:box(s.envelope.width*.7,s.envelope.height*.7,z+s.envelope.length+plan.spinal.supplyLength/2,plan.spinal.supplyLength/2),sector:'structure',volumeM3:s.envelope.width*.7*s.envelope.height*.7*plan.spinal.supplyLength/2}];
 const reasons=spinalStructureIssues(b,false);if(reasons.length)throw Error(reasons.join('; '));
}
function corners(box:BoundsData,z:number){return [-1,1].flatMap(x=>[-1,1].map(y=>({x:x<0?box.min.x:box.max.x,y:y<0?box.min.y:box.max.y,z})));}
/** Independent full-envelope containment at every station plane, plus forward ray/corridor checks. */
export function spinalStructureIssues(b:ShipBlueprint,final=true){
 const plan=b.designRequirements;if(!plan?.spinal)return [];
 const issues:string[]=[],host=b.structuralVolumes.find(v=>v.id===plan.spinal!.hostId),spaces=plan.spaces;
 if(!host||spaces.length!==3)return ['REQUIRED_XL_STRUCTURE_UNSUPPORTED: missing host or reservation'];
 for(const r of spaces){const zs=[r.bounds.min.z,r.bounds.max.z,...host.geometry.stations.map(s=>s.z+host.position.z).filter(z=>z>r.bounds.min.z&&z<r.bounds.max.z)];
  if(zs.some(z=>corners(r.bounds,z).some(p=>!containsProductionVolume(host,p,b.order.length*1e-6))))issues.push(`${r.purpose!=='XL_ENVELOPE'?'REQUIRED_XL_BREECH_SPACE_UNAVAILABLE':'REQUIRED_XL_STRUCTURE_UNSUPPORTED'}: ${r.id} escapes actual station cross-section`);
 }
 const xl=spaces[0],muzzle={x:host.position.x,y:host.position.y,z:xl.bounds.min.z},radius=plan.spinal.standard.footprint.width*.3;
 const inBox=(p:Vec3,r:SpaceReservation)=>p.x>r.bounds.min.x&&p.x<r.bounds.max.x&&p.y>r.bounds.min.y&&p.y<r.bounds.max.y&&p.z>r.bounds.min.z&&p.z<r.bounds.max.z;
 for(const v of b.structuralVolumes.filter(v=>v.id!==host.id))if(spaces.some(r=>[r.bounds.min.z,(r.bounds.min.z+r.bounds.max.z)/2,r.bounds.max.z].some(z=>[...corners(r.bounds,z),{...muzzle,z}].some(p=>containsProductionVolume(v,p)))))issues.push(`REQUIRED_XL_BREECH_SPACE_UNAVAILABLE: reserved compartment intersects ${v.id}`);
 const rays=Array.from({length:9},(_,i)=>({x:muzzle.x+(i===8?0:Math.cos(i*Math.PI/4)*radius),y:muzzle.y+(i===8?0:Math.sin(i*Math.PI/4)*radius),z:muzzle.z}));
 const frontSamples=rays.flatMap(p=>Array.from({length:25},(_,i)=>({...p,z:p.z-b.order.length*.0001-i*b.order.length/24})));
 for(const v of b.structuralVolumes.filter(v=>v.id!==host.id))if(frontSamples.some(p=>containsProductionVolume(v,p)))issues.push(`REQUIRED_SPINAL_AXIS_BLOCKED: forward corridor crosses ${v.id}`);
 if(b.engines.some(e=>spaces.some(r=>inBox(e.position,r))||frontSamples.some(p=>Math.hypot(p.x-e.position.x,p.y-e.position.y)<e.nozzleRadius&&Math.abs(p.z-e.position.z)<e.nozzleLength)))issues.push('REQUIRED_SPINAL_AXIS_BLOCKED: propulsion intersects protected gun region');
 if(final){
  const solids=[...(b.productionDesign?.armor??[]).map(a=>({id:a.id,solid:a.solid})),...(b.productionDesign?.finish??[]).map(a=>({id:a.id,solid:a.solid})),...(b.prefabPlacements??[]).flatMap(p=>p.assembly?.parts.map(q=>({id:p.id,solid:q.solid}))??[])];
  const reservedSolids=spaces.map(r=>({bounds:r.bounds,solid:solidFromRings([r.bounds.min.z,r.bounds.max.z].map(z=>[{x:r.bounds.min.x,y:r.bounds.min.y,z},{x:r.bounds.max.x,y:r.bounds.min.y,z},{x:r.bounds.max.x,y:r.bounds.max.y,z},{x:r.bounds.min.x,y:r.bounds.max.y,z}]))}));
  for(const a of solids){if(reservedSolids.some(r=>solidsIntrude(a.solid,boundsOf(a.solid.vertices),r.solid,r.bounds))||rays.some(p=>rayBlocked({...p,z:p.z-.03},{x:0,y:0,z:-1},b.order.length,[{id:a.id,solid:a.solid,bounds:boundsOf(a.solid.vertices)}])))issues.push(`REQUIRED_SPINAL_AXIS_BLOCKED: armor/equipment ${a.id} enters compartment or firing corridor`);}
  const hullScene=armorSurfaces(b).filter(s=>s.id!==host.id);
  if(rays.some(p=>rayBlocked({...p,z:p.z-.03},{x:0,y:0,z:-1},b.order.length,hullScene.map(s=>({id:s.id,solid:s.solid,bounds:s.box})))))issues.push('REQUIRED_SPINAL_AXIS_BLOCKED: exact forward ray intersects hull or protected armor');
  const h=b.hardpoints.find(h=>h.type==='Spinal'&&h.parentId===host.id),integrated=b.weaponLayout?.integrated?.find(m=>m.hardpointId===h?.id);
  if(h&&(h.position.x!==host.position.x||h.position.y!==host.position.y||h.position.z!==xl.bounds.min.z||JSON.stringify(h.normal)!==JSON.stringify(plan.spinal.forward)))issues.push('REQUIRED_SPINAL_AXIS_BLOCKED: actual hardpoint origin/direction violates reserved axis');
  if(!h||!integrated||JSON.stringify(integrated.standard)!==JSON.stringify(plan.spinal.standard))issues.push('REQUIRED_XL_STRUCTURE_UNSUPPORTED: actual standard-size integrated gun absent');
  const collar=b.prefabPlacements?.find(p=>p.kind==='SPINAL_MUZZLE'&&p.socket.hostId===host.id&&p.exterior?.tube);
  if(!collar?.exterior?.tube||collar.exterior.tube.innerRadius<radius)issues.push('REQUIRED_SPINAL_AXIS_BLOCKED: real open muzzle collar unavailable');
 }
 return [...new Set(issues)];
}
export function requirementCapability(b:ShipBlueprint,id:string):{actual:number;reason:string}{
 const d=b.designDoctrine!,w=b.weaponLayout!,offensive=w.mounts.some(m=>m.category==='CANNON'||m.category==='MISSILE'),pd=w.mounts.some(m=>m.category==='POINT_DEFENSE'),sensor=d.equipment.some(e=>e.sector==='sensor'),medium=w.mounts.some(m=>m.category==='CANNON'&&['M','L'].includes(m.standard.size)),heavy=w.mounts.some(m=>m.category==='CANNON'&&m.standard.size==='L');
 let ok=false,reason='';
 switch(id){
 case 'basic-propulsion':ok=b.engines.length>0&&b.engines.every(e=>e.nozzleRadius>0&&e.nozzleLength>0&&b.structuralVolumes.some(v=>v.id===e.parentId&&containsProductionVolume(v,e.position,b.order.length*.00001)));break;
 case 'physical-design':ok=true;reason='Existing whole Blueprint validation is the physical authority; release waits for that validator';break;
 case 'role-light-combat':ok=offensive&&d.allocations.propulsion.volumeM3/d.total.volumeM3>=.08;break;
 case 'role-escort':case 'role-interceptor':ok=offensive&&pd;break;
 case 'role-multimission':ok=medium&&sensor;break;
 case 'role-capital-strike':ok=medium&&d.allocations.propulsion.volumeM3/d.total.volumeM3>=.08;break;
 case 'role-protected-battery':ok=heavy&&b.productionDesign!.armor.some(a=>a.role==='CITADEL');break;
 case 'role-missile-launch':{const missiles=w.mounts.filter(m=>m.category==='MISSILE'),guns=w.mounts.filter(m=>m.category==='CANNON');ok=missiles.length>0&&missiles.reduce((n,m)=>n+m.standard.cost,0)>=guns.reduce((n,m)=>n+m.standard.cost,0);break;}
 case 'role-spinal-xl':{const errors=spinalStructureIssues(b);ok=!errors.length;reason=errors.join('; ');break;}
 case 'role-patrol':ok=pd&&sensor;break;
 }
 return {actual:ok?1:0,reason:reason||(ok?'Verified actual equipment, reserved capacity and retained structure':'Required role capability unavailable in installed composition')};
}
function derivePriorityEvidence(b:ShipBlueprint):RequirementPlan['priorityEvidence']{
 const d=b.designDoctrine!;
 return Object.entries(PRIORITY_SECTOR).map(([key,sector])=>{const priority=key as keyof ShipOrder['priorities'],fraction=d.allocations[sector].volumeM3/d.total.volumeM3,actualEquipmentCount=sector==='weapons'?b.weaponLayout!.mounts.filter(m=>m.category===(key==='missile'?'MISSILE':'CANNON')).length+(key==='firepower'?(b.weaponLayout!.integrated?.length??0):0):sector==='propulsion'?b.engines.length:sector==='armor'?b.productionDesign!.armor.length+b.productionDesign!.finish.length:d.equipment.filter(e=>e.sector===sector).length;
  const installedGeometry=priority==='firepower'?{name:'Actual gun calibre investment',unit:'cost-index' as const,value:b.weaponLayout!.mounts.filter(m=>m.category==='CANNON').reduce((n,m)=>n+m.standard.cost,0)+(b.weaponLayout!.integrated?.length??0)*18}:priority==='missile'?{name:'Installed launcher planning volume (includes service reserve)',unit:'geometric-m3' as const,value:b.weaponLayout!.mounts.filter(m=>m.category==='MISSILE').reduce((n,m)=>n+weaponResources(m.standard.size,m.category,b.order.length).volumeM3,0)}:priority==='mobility'?{name:'Actual nozzle exit area (geometry only; no thrust claim)',unit:'geometric-m2' as const,value:b.engines.reduce((n,e)=>n+Math.PI*e.nozzleRadius**2,0)}:priority==='survivability'?{name:'Retained armor solid volume',unit:'geometric-m3' as const,value:d.usage.armor.volumeM3/.12}:{name:'Actual external equipment solid volume',unit:'geometric-m3' as const,value:d.equipment.filter(e=>e.sector===sector).reduce((n,e)=>n+e.resources.volumeM3,0)};
  return {priority,installedGeometry,requested:b.order.priorities[priority],sector,allocationFraction:fraction,reservedVolumeM3:d.allocations[sector].volumeM3,actualEquipmentCount,capacityIndex:fraction/(.08+b.order.priorities[priority]*.002),limitation:(priority==='mobility'&&b.engines.some(e=>{const other=b.engines.filter(q=>q!==e&&q.parentId===e.parentId),spacing=other.length?Math.min(...other.map(q=>Math.hypot(q.position.x-e.position.x,q.position.y-e.position.y))):Infinity;return Math.abs(e.nozzleRadius-spacing*.39/e.bellRatio)<1e-5;})?'Actual nozzle radius saturated at retained bell-spacing limit; propulsion reservation is not a thrust guarantee. ':'')+(d.adjustments.filter(a=>a.groupId==='resources'||a.groupId==='armor'||a.reason.includes(sector)||sector==='weapons').slice(0,4).map(a=>a.reason).join('; ')||'Finite competing allocations; unchanged counts can coexist with changed reserved capacity')};
 });
}
export function finishRequirements(b:ShipBlueprint){
 const plan=b.designRequirements;if(!plan)return;
 const d=b.designDoctrine!;
 plan.energy.volumeM3=plan.spinal?plan.spaces.find(s=>s.purpose==='ENERGY_SYSTEM')!.volumeM3:d.allocations.structure.volumeM3*plan.energy.volumeFraction;
 plan.priorityEvidence=derivePriorityEvidence(b);
 for(const r of plan.requirements){
  if(r.type==='MANDATORY'){const result=requirementCapability(b,r.id);r.metric.actual=result.actual;r.status=result.actual>=r.metric.target?'SATISFIED':'FAILED';r.reason=result.reason;}
  else if(r.type==='TARGET'){const e=plan.priorityEvidence.find(e=>`priority-${e.priority}`===r.id)!;r.metric.actual=e.allocationFraction;r.status=r.metric.actual>=r.metric.target?'SATISFIED':'LIMITED';r.reason=e.limitation;}
  else {r.metric.actual=d.differences.filter(x=>x.missing).length+d.equipmentTargets.reduce((n,e)=>n+e.missing,0);r.metric.name='Omitted target groups/equipment';r.metric.target=0;r.status=r.metric.actual===0?'SATISFIED':'LIMITED';r.reason=d.adjustments.slice(0,6).map(a=>a.reason).join('; ')||'All optional targets installed';}
 }
 const failed=plan.requirements.filter(r=>r.type==='MANDATORY'&&r.status!=='SATISFIED');
 if(failed.length)throw new DesignRejection(failed.map(r=>r.id==='role-spinal-xl'?(r.reason.match(/REQUIRED_[A-Z_]+/)?.[0]??'REQUIRED_XL_STRUCTURE_UNSUPPORTED'):'REQUIRED_ROLE_CAPABILITY_UNAVAILABLE'),plan.rejectedCandidates,failed.map(r=>`${r.id}: ${r.reason}`).join('; '));
 plan.phase='RELEASED';
}
export function validateRequirements(b:ShipBlueprint){
 const plan=b.designRequirements;if(!plan)return [];
 if(!b.productionDesign)return [];
 const issues:string[]=[],fresh=planRequirements(b.order);
 if(JSON.stringify(plan.preAllocationFractions)!==JSON.stringify(fresh.preAllocationFractions))issues.push('Requirement pre-allocation policy altered');
 if(plan.version!=='1.8.4.2'||plan.phase!=='RELEASED')issues.push('Required design not released');
 if(JSON.stringify(plan.requirements.map(r=>({id:r.id,type:r.type,source:r.source,condition:r.condition,priority:r.priority})))!==JSON.stringify(fresh.requirements.map(r=>({id:r.id,type:r.type,source:r.source,condition:r.condition,priority:r.priority}))))issues.push('Requirement order/role contract mismatch');
 for(const r of plan.requirements.filter(r=>r.type==='MANDATORY')){const result=requirementCapability(b,r.id);if(!result.actual||r.status!=='SATISFIED'||r.metric.actual!==result.actual)issues.push(`Unsatisfied mandatory requirement ${r.id}: ${result.reason}`);}
 for(const r of plan.requirements){const original=fresh.requirements.find(q=>q.id===r.id);if(!original||JSON.stringify(r.allocationRefs)!==JSON.stringify(original.allocationRefs))issues.push(`Requirement allocation references mismatch ${r.id}`);
  if(r.type==='TARGET'){const e=plan.priorityEvidence.find(e=>`priority-${e.priority}`===r.id);if(!e||r.metric.target!==original?.metric.target||r.metric.actual!==e.allocationFraction||r.status!==(r.metric.actual>=r.metric.target?'SATISFIED':'LIMITED'))issues.push(`Requirement target satisfaction mismatch ${r.id}`);}
 }
 if(plan.chosen?.architecture!==b.architecture.grammar||plan.chosen?.family!==b.macroDesign?.family)issues.push('Requirement chosen design mismatch');
 const d=b.designDoctrine!;
 for(const s of sectors){const floor=fresh.sectorFloors[s],fraction=fresh.preAllocationFractions[s];floor.massTonnes=Math.max(floor.massTonnes,d.total.massTonnes*fraction);floor.volumeM3=Math.max(floor.volumeM3,d.total.volumeM3*fraction);
 if(Math.abs(floor.massTonnes-plan.sectorFloors[s].massTonnes)>1e-5||Math.abs(floor.volumeM3-plan.sectorFloors[s].volumeM3)>1e-5)issues.push(`Requirement floor authority mismatch ${s}`);
 if(d.allocations[s].massTonnes+1e-6<plan.sectorFloors[s].massTonnes||d.allocations[s].volumeM3+1e-6<plan.sectorFloors[s].volumeM3)issues.push(`REQUIRED_DESIGN_BUDGET_EXCEEDED: ${s} floor not protected`);}
 if(JSON.stringify(plan.resourceUnits)!==JSON.stringify(fresh.resourceUnits))issues.push('Requirement resource semantics altered');
 const energyVolume=plan.spinal?plan.spaces.find(s=>s.purpose==='ENERGY_SYSTEM')?.volumeM3:d.allocations.structure.volumeM3*plan.energy.volumeFraction;
 if(!Number.isFinite(plan.energy.volumeM3)||Math.abs(plan.energy.volumeM3-(energyVolume??-1))>1e-5)issues.push('Energy sub-reservation mismatch');
 if(plan.energy.unit!=='abstract-design-units'||plan.energy.reserved>plan.energy.capacity||plan.energy.volumeFraction!==fresh.energy.volumeFraction||plan.energy.reserved!==fresh.energy.reserved||plan.energy.volumeM3>d.allocations.structure.volumeM3)issues.push('Invalid abstract energy reservation');
 if(plan.spinal){if(plan.spinal.supplyLength!==fresh.spinal?.supplyLength||plan.spinal.minimumHullLength!==fresh.spinal?.minimumHullLength)issues.push('Required axial support space policy altered');
 const rebound={...b,designRequirements:structuredClone(plan)};try{bindRequirementSpaces(rebound);if(JSON.stringify(rebound.designRequirements!.spaces)!==JSON.stringify(plan.spaces))issues.push('Required reserved-space authority mismatch');}catch(e){issues.push((e as Error).message);}
 if(JSON.stringify(plan.spinal.standard)!==JSON.stringify(fresh.spinal?.standard))issues.push('Required XL standard altered');issues.push(...spinalStructureIssues(b));}
 if(plan.priorityEvidence.length!==6||new Set(plan.priorityEvidence.map(e=>e.priority)).size!==6)issues.push('Missing priority allocation evidence');
 const expectedEvidence=derivePriorityEvidence(b);
 for(const e of plan.priorityEvidence){const expected=expectedEvidence.find(a=>a.priority===e.priority);if(!expected||JSON.stringify(expected.installedGeometry)!==JSON.stringify(e.installedGeometry)||expected.actualEquipmentCount!==e.actualEquipmentCount||expected.capacityIndex!==e.capacityIndex)issues.push(`Requirement actual priority evidence mismatch ${e.priority}`);if(Math.abs(e.reservedVolumeM3-d.allocations[e.sector].volumeM3)>1e-5||Math.abs(e.allocationFraction-d.allocations[e.sector].volumeM3/d.total.volumeM3)>1e-8||e.requested!==b.order.priorities[e.priority])issues.push(`Requirement allocation evidence mismatch ${e.priority}`);}
 return [...new Set(issues)];
}
