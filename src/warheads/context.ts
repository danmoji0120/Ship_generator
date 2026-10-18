import type {Vec3} from '../blueprint/types';
import type {DamageInstance,DamageTarget} from '../damage/types';
import type {DetonationEvent,ContextResult,WarheadSpec} from './types';
import {localPoint,worldPoint} from '../damage/flight';
import {damagedContacts} from '../damage/contacts';
import {add,mul} from '../generation/integration/contours';
import {SAMPLE_COUNTS} from './registry';
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function classifyDetonationPoint(target:DamageTarget,state:DamageInstance,world:Vec3,time:number):ContextResult{
 const p=localPoint(target.motion,world,time),info=target.queries.inspectPoint?.(p,state),owners=new Set<string>(),unknown=new Set(info?.uncertainVolumeIds??[]);let occupiedDirections=0;
 for(const d of[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:-1,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}]){
  const near=damagedContacts(target.queries.collect(p,d,.00001,state),state,p,d).filter(c=>c.entry<=1e-7);
  for(const c of near){if(c.kind==='UNRESOLVED')unknown.add(c.ownerId);else owners.add(c.ownerId);}
  if(near.some(c=>c.kind!=='UNRESOLVED'&&c.exit>1e-7))occupiedDirections++;
 }
 const compartmentIds=info?.confirmedRoomIds??[];
 if(unknown.size)return{context:'EXTERIOR_UNRESOLVED',compartmentIds,physicalOwners:[...owners],reasons:[...unknown].map(id=>'UNSPECIFIED_BOUNDARY:'+id)};
 if(occupiedDirections===6)return{context:'INVALID_LOCATION',compartmentIds,physicalOwners:[...owners],reasons:['DETONATION_CENTER_IN_ACTUAL_SOLID']};
 if(owners.size)return{context:'SURFACE_CONTACT',compartmentIds,physicalOwners:[...owners],reasons:['FINITE_MATERIAL_BOUNDARY_WITHIN_10_MICROMETRES']};
 if(compartmentIds.length)return{context:'INTERNAL_COMPARTMENT',compartmentIds,physicalOwners:[],reasons:['CONFIRMED_FINITE_COMPARTMENT_VOID']};
 if(info?.insideStructure)return{context:'EXTERIOR_UNRESOLVED',compartmentIds:[],physicalOwners:[],reasons:['INSIDE_STRUCTURE_WITHOUT_CONFIRMED_HOLLOW_COMPARTMENT']};
 return{context:'EXTERNAL_VACUUM',compartmentIds:[],physicalOwners:[],reasons:['OUTSIDE_ACTUAL_STRUCTURAL_VOLUMES_AND_MATERIAL']};
}
export function validateDetonation(target:DamageTarget,state:DamageInstance,event:DetonationEvent,spec:WarheadSpec){
 if(!event.eventId||event.eventId.length>160||event.shipInstanceId!==state.instanceId||!SAMPLE_COUNTS[event.approximationQuality]||!Number.isInteger(event.randomSeed)||!Number.isFinite(event.timeSeconds)||event.timeSeconds<0||![event.worldPosition,event.worldVelocity,event.forwardDirection].every(p=>Object.values(p).every(Number.isFinite))||Math.hypot(...Object.values(event.forwardDirection))<1e-9)throw Error('INVALID_DETONATION_EVENT');
 if(Math.hypot(...Object.values(event.worldVelocity))>10000)throw Error('DETONATION_VELOCITY_OUTSIDE_GAME_RANGE');
 if(event.sourceEquipmentId&&!target.blueprint.functionalSystems?.equipment.some(e=>e.id===event.sourceEquipmentId)&&!target.blueprint.freeMountPlan?.entries.some(e=>e.id===event.sourceEquipmentId))throw Error('DETONATION_SOURCE_EQUIPMENT_NOT_PRESENT');
 if(!['LOW','MEDIUM','HIGH'].includes(event.approximationQuality)||!['LAB_MANUAL','IMPACT','PROXIMITY','TIMED'].includes(event.detonationTrigger)||!['EXTERNAL_VACUUM','SURFACE_CONTACT','INTERNAL_COMPARTMENT','EXTERIOR_UNRESOLVED','INVALID_LOCATION'].includes(event.detonationContext)||typeof event.secondaryEnabled!=='boolean')throw Error('UNSUPPORTED_DETONATION_CONTRACT');
 const proof=event.triggerProof;if(proof.kind!==event.detonationTrigger)throw Error('TRIGGER_PROOF_KIND_MISMATCH');
 if((proof.kind==='PROXIMITY'||proof.kind==='TIMED')&&Math.abs(event.timeSeconds-state.time)>1e-8)throw Error('OBSERVED_TRIGGER_CLOCK_MISMATCH');
 if(proof.kind==='IMPACT'){
  const hit=state.events.find(e=>e.shotId===proof.shotId&&e.ownerId===proof.ownerId&&e.layerId===proof.layerId&&Math.abs(e.time-proof.time)<1e-9);
  if(!hit||hit.kind==='UNRESOLVED'||!proof.kineticAlreadyApplied||distance(event.worldPosition,hit.worldPosition)>.0001)throw Error('ACTUAL_IMPACT_PROOF_REQUIRED');
 }else if(proof.kind==='PROXIMITY'){
  const ref=target.blueprint.structuralVolumes.find(v=>v.id===proof.referenceStructureId);
  if(!ref||![proof.maximumDistanceM,proof.sampleTimeSeconds,proof.elapsedSeconds,proof.armAfterSeconds].every(Number.isFinite)||proof.maximumDistanceM<=0||proof.elapsedSeconds<Math.max(0,proof.armAfterSeconds)||Math.abs(proof.sampleTimeSeconds-event.timeSeconds)>1e-8||distance(event.worldPosition,worldPoint(target.motion,ref.position,event.timeSeconds))>proof.maximumDistanceM)throw Error('PROXIMITY_CONDITION_NOT_MET');
 }else if(proof.kind==='TIMED'){
  if(![proof.launchedAtSeconds,proof.fuseDelaySeconds,proof.observedTimeSeconds].every(Number.isFinite)||proof.launchedAtSeconds<0||proof.fuseDelaySeconds<0||Math.abs(proof.observedTimeSeconds-event.timeSeconds)>1e-8||proof.observedTimeSeconds<proof.launchedAtSeconds+proof.fuseDelaySeconds)throw Error('FUSE_TIME_NOT_REACHED');
 }
 if(event.timeSeconds<state.time-1e-8&&!(spec.warheadFamily==='KINETIC_IMPACT'&&proof.kind==='IMPACT'))throw Error('DETONATION_CANNOT_REWIND_DAMAGE_CLOCK');
 const context=classifyDetonationPoint(target,state,event.worldPosition,event.timeSeconds);
 // A verified already-applied kinetic contact remains evidence even if its material is now perforated.
 if(spec.warheadFamily==='KINETIC_IMPACT'&&proof.kind==='IMPACT')return{context:'SURFACE_CONTACT' as const,compartmentIds:context.compartmentIds,physicalOwners:[proof.ownerId],reasons:['ACTUAL_KINETIC_IMPACT_ALREADY_APPLIED_NO_DUPLICATE_TRANSFER']};
 if(context.context==='INVALID_LOCATION')throw Error('INVALID_DETONATION_LOCATION:'+context.reasons.join(','));
 if(context.context!=='EXTERIOR_UNRESOLVED'&&event.detonationContext!==context.context)throw Error('DETONATION_CONTEXT_MISMATCH:'+context.context);
 if(event.detonationContext==='INTERNAL_COMPARTMENT'&&event.compartmentId&&!context.compartmentIds.includes(event.compartmentId))throw Error('REQUESTED_COMPARTMENT_DOES_NOT_CONTAIN_DETONATION');
 return context;
}
/** Conservative, bounded helper using actual free-space candidates and actual device clearances. */
export function internalDetonationPositions(target:DamageTarget,state:DamageInstance,compartmentId?:string){
 const candidates:{position:Vec3;compartmentId:string;nearEquipmentId?:string}[]=[];
 for(const e of target.blueprint.functionalSystems?.equipment??[]){
  const p=add(e.position,{x:0,y:0,z:-e.sizeM.z/2-.15}),world=worldPoint(target.motion,p,state.time),c=classifyDetonationPoint(target,state,world,state.time);
  if(c.context==='INTERNAL_COMPARTMENT'&&(!compartmentId||c.compartmentIds.includes(compartmentId)))candidates.push({position:world,compartmentId:compartmentId??c.compartmentIds[0],nearEquipmentId:e.id});
 }
 return candidates;
}
