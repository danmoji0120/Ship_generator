import type {Contact,DamageEvent,DamageExecution,DamageInstance,DamageTarget,ProjectileState,CapabilitySummary} from '../damage/types';
import type {DetonationEvent,DetonationRecord,DetonationWork,WarheadSpec} from './types';
import {WARHEADS,WARHEAD_LIMITS,SAMPLE_COUNTS,validateWarhead} from './registry';
import {fragmentPopulation,seeded} from './sampling';
import {validateDetonation} from './context';
import {launchProjectile,nextProjectileBoundary,advanceProjectileKinematics,processProjectileBoundary,localPoint,worldPoint,rotate} from '../damage/flight';
import {length,unit} from '../damage/material';
import {damageCapabilities} from '../damage/state';
import {damageProfile} from '../damage/diagnostics';
import {cylinderInterval} from '../damage/contacts';
import {BALLISTIC_MATERIALS} from '../damage/calibration';
import {add,mul,sub} from '../generation/integration/contours';

const energy=(t:DamageTarget,p:ProjectileState)=>.5*p.massKg*length(sub(p.velocity,t.motion.velocity))**2;
function capabilities(t:DamageTarget,s:DamageInstance):CapabilitySummary|undefined{
 const c=damageCapabilities(t.blueprint,s);return c&&{availableElectricalPowerMW:c.availableElectricalPowerMW,propulsionAuthority:c.propulsionAuthority,maneuverAuthority:c.maneuverAuthority,availableFireControlChannels:c.availableFireControlChannels,availableSensorProcessingCapacity:c.availableSensorProcessingCapacity};
}
const appendUnique=(list:string[],value:string)=>{if(!list.includes(value))list.push(value);};

export function beginDetonation(target:DamageTarget,state:DamageInstance,event:DetonationEvent,spec:WarheadSpec=WARHEADS[event.warheadSpecId]):DetonationWork{
 const start=performance.now();if(!spec||spec.warheadSpecId!==event.warheadSpecId)throw Error('UNKNOWN_WARHEAD_SPEC');validateWarhead(spec);
 if(state.warheads?.acceptedEventIds.includes(event.eventId))throw Error('DETONATION_ALREADY_ACCEPTED');
 if((state.warheads?.acceptedEventIds.length??0)>=WARHEAD_LIMITS.acceptedDetonations)throw Error('DETONATION_HISTORY_ID_LIMIT_REACHED_RESET_REQUIRED');
 if(state.warheads?.history.some(r=>r.status==='PENDING'))throw Error('INSTANCE_HAS_PENDING_DETONATION');
 if(spec.warheadFamily==='KINETIC_IMPACT'&&event.triggerProof.kind!=='IMPACT'&&(!spec.kineticBody||length(event.worldVelocity)<10))throw Error('KINETIC_BODY_WITH_ACTUAL_NONZERO_VELOCITY_REQUIRED');
 const context=validateDetonation(target,state,event,spec),before=capabilities(target,state),record:DetonationRecord={schemaVersion:1,specification:structuredClone(spec),event:structuredClone(event),status:'PENDING',context,
  warnings:['Game angular quadrature: all fixed physical fragments are simulated. Direction multiplicity is never substituted for penetrator mass.','Material response is evaluated on entry; damage is committed at material exit/stop. No coupled fracture evolution during an ongoing transit.','Centerline CCD and finite existing material volumes; no atmospheric blast, radius damage or pressure simulation.'],elapsedSeconds:0,
  generatedAngularSamples:spec.warheadFamily==='KINETIC_IMPACT'?0:SAMPLE_COUNTS[event.approximationQuality],generatedPhysicalFragments:0,representedPhysicalFragments:0,secondaryFragments:0,secondarySuppressed:0,contactCount:0,blockedFragments:0,penetratedFragments:0,hitFragments:0,unresolvedFragments:0,resolvedFragments:0,uniqueHitOwners:[],damagedObjects:[],traceTruncatedContacts:0,fragments:[],
  budget:{nominalMassKg:spec.nominalMassKg,casingMassKg:spec.casingMassKg,unmodeledBodyMassKg:spec.nominalMassKg-spec.casingMassKg,primaryMassKg:0,primaryKineticJ:0,assignedEffectJ:spec.abstractEffectBudget.carrierKineticJ,unmodeledAssignedEffectJ:spec.abstractEffectBudget.carrierKineticJ,inheritedKineticJ:0,secondaryReallocatedMassKg:0,secondaryReallocatedJ:0,localDepositedJ:0,finalCarrierKineticJ:0,energyBalanceErrorJ:0},capabilityBefore:before,capabilityAfter:before};
 const work:DetonationWork={record,target,state,carriers:[],contacts:[],elapsedSeconds:0,phase:'PENDING',lastDamageCount:new Map(),processedContacts:new Set(),rawQueryCache:new Map(),diagnostics:{initializationMs:0,queryMs:0,materialMs:0,damageMs:0,capabilityMs:0,workMs:0,boundaries:0,queryCalls:0,rawCacheHits:0}};
 // Cache immutable raw contacts, not damaged paths. Door state is part of the key.
 // Each consumer receives fresh interval objects, including unresolved contacts.
 work.target={...target,queries:{...target.queries,collect(o,d,max,s){
  const key=JSON.stringify([o,d,max,s.interior.openingStates,s.interior.disabledBulkheadIds,s.blockedClosurePositions]),old=work.rawQueryCache.get(key);
  if(old){work.diagnostics.rawCacheHits++;return old.map(c=>({...c}));}
  const t=performance.now(),contacts=target.queries.collect(o,d,max,s);work.diagnostics.queryMs+=performance.now()-t;work.diagnostics.queryCalls++;
  if(work.rawQueryCache.size>=WARHEAD_LIMITS.rawQueryCache)work.rawQueryCache.delete(work.rawQueryCache.keys().next().value!);
  work.rawQueryCache.set(key,contacts.map(c=>({...c})));return contacts;
 }}};
 state.warheads??={history:[],acceptedEventIds:[]};state.warheads.acceptedEventIds.push(event.eventId);state.warheads.history.push(record);if(state.warheads.history.length>WARHEAD_LIMITS.history)state.warheads.history.shift();
 if(context.context==='EXTERIOR_UNRESOLVED'){
  record.status='UNRESOLVED';record.warnings.push(...context.reasons);work.phase='COMPLETE';work.diagnostics.initializationMs=performance.now()-start;return work;
 }
 if(spec.warheadFamily==='KINETIC_IMPACT'){
  if(event.triggerProof.kind==='IMPACT'){
   record.status='COMPLETE';record.warnings.push('The referenced kinetic contact is already in this instance: zero additional kinetic or explosive energy applied.');work.phase='COMPLETE';work.diagnostics.initializationMs=performance.now()-start;return work;
  }
  if(!spec.kineticBody||length(event.worldVelocity)<10)throw Error('KINETIC_BODY_WITH_ACTUAL_NONZERO_VELOCITY_REQUIRED');
  const p=launchProjectile(spec.kineticBody,event.worldPosition,unit(event.worldVelocity),event.eventId+'/body',event.timeSeconds,spec.detonationBehavior.flightSeconds);p.velocity={...event.worldVelocity};attachPrimary(work,p,0);record.budget.unmodeledBodyMassKg=spec.nominalMassKg-p.massKg;
 }else{
  for(const [i,f]of fragmentPopulation(spec,event,target.motion.velocity).entries()){
   const p=launchProjectile(f.projectile,event.worldPosition,length(f.velocity)>1e-9?unit(f.velocity):event.forwardDirection,event.eventId+'/fragment/'+String(i).padStart(4,'0'),event.timeSeconds,spec.detonationBehavior.flightSeconds);p.velocity=f.velocity;attachPrimary(work,p,f.angularSampleId);
  }
 }
 record.budget.unmodeledAssignedEffectJ=0;record.budget.finalCarrierKineticJ=record.budget.primaryKineticJ;
 record.generatedPhysicalFragments=work.carriers.length;record.representedPhysicalFragments=work.carriers.length;
 record.budget.inheritedKineticJ=spec.warheadFamily==='KINETIC_IMPACT'?record.budget.primaryKineticJ:.5*spec.casingMassKg*length(sub(event.worldVelocity,target.motion.velocity))**2;
 state.time=Math.max(state.time,event.timeSeconds);work.diagnostics.initializationMs=performance.now()-start;return work;
}
function attachPrimary(work:DetonationWork,p:ProjectileState,sample:number){
 p.carrier={detonationId:work.record.event.eventId,fragmentId:p.shotId,generation:0,angularSampleId:sample,sourceBudgetRef:work.record.event.eventId+'/primary-casing'};
 work.carriers.push(p);work.lastDamageCount.set(p.shotId,work.state.local.length);work.record.fragments.push({fragmentId:p.shotId,angularSampleId:sample,generation:0,sourceBudgetRef:p.carrier.sourceBudgetRef,initialMassKg:p.massKg,initialRelativeEnergyJ:energy(work.target,p),status:p.status,contacts:0,finalMassKg:p.massKg,finalRelativeEnergyJ:energy(work.target,p)});
 work.record.budget.primaryMassKg+=p.massKg;work.record.budget.primaryKineticJ+=energy(work.target,p);
}
/** A new hole can only invalidate a cached nearest contact if it removes that
 * owner's material interval. Unrelated surface damage cannot add an earlier obstacle. */
function refreshApproach(work:DetonationWork,p:ProjectileState){
 const a=p.approach;if(!a||a.revision===work.state.revision)return;
 const from=work.lastDamageCount.get(p.shotId)??0,newDamage=work.state.local.slice(from),origin=localPoint(work.target.motion,p.position,p.launchedAt+p.age),relative=rotate(sub(p.velocity,work.target.motion.velocity),work.target.motion.quaternion,true),speed=length(relative);
 let changed=!newDamage.length;
 if(a.contact&&speed>1e-9){const d=unit(relative),entry=a.distance,exit=entry+a.contact.exit-a.contact.entry;
  changed||=newDamage.some(r=>{if(r.ownerId!==a.contact!.ownerId||r.layerId!==a.contact!.layerId||!r.channel)return false;const h=r.channel,cut=cylinderInterval(origin,d,h.entry,h.exit,h.radiusM);return cut&&cut[1]>entry+1e-8&&cut[0]<exit-1e-8;});
 }
 // A cached MISS remains a MISS when material is removed; opening overrides invalidate explicitly.
 if(changed)p.approach=undefined;else a.revision=work.state.revision;
 work.lastDamageCount.set(p.shotId,work.state.local.length);
}
function secondaryReservation(work:DetonationWork,event:DamageEvent,p:ProjectileState,contact:Contact){
 const spec=work.record.specification,material=BALLISTIC_MATERIALS[contact.materialId??''];
 if(!work.record.event.secondaryEnabled||!spec.detonationBehavior.secondaryAllowed||p.carrier?.generation!==0||event.outcome!=='PENETRATED'||!['ARMOR','HULL','BULKHEAD'].includes(contact.kind)||!material||material.brittleness<.6)return;
 const lostMass=Math.max(0,event.projectileBefore.massKg-event.projectileAfter.massKg),fraction=lostMass/event.projectileBefore.massKg,
 erosionEnergy=fraction<1?event.residualJ*fraction/(1-fraction):0,mass=Math.min(.02,lostMass*.25),available=Math.min(event.consumedJ,erosionEnergy*.2,.5*mass*3000**2,100000);
 if(mass<.0001||available<1000)return;
 if(work.record.secondaryFragments>=WARHEAD_LIMITS.secondaryPopulation){work.record.secondarySuppressed++;return;}
 event.secondaryMassAllocatedKg=mass;event.secondaryEnergyAllocatedJ=available;event.localEnergyDepositJ=Math.max(0,event.consumedJ-available);
}
function spawnSecondary(work:DetonationWork,event:DamageEvent,parent:ProjectileState){
 const mass=event.secondaryMassAllocatedKg??0,E=event.secondaryEnergyAllocatedJ??0;if(!mass||!E)return;
 const index=work.record.secondaryFragments++,id=work.record.event.eventId+'/secondary/'+String(index).padStart(3,'0'),random=seeded(work.record.event.randomSeed+index*997),direction=unit(add(event.projectileAfter.localDirection,{x:(random()-.5)*.12,y:(random()-.5)*.12,z:(random()-.5)*.12})),worldDirection=rotate(direction,work.target.motion.quaternion),speed=Math.sqrt(2*E/mass),diameter=Math.cbrt(mass/(parent.spec.projectileMaterial==='TUNGSTEN_ALLOY'?17000:7850)*4/(Math.PI*1.5))*1000,
 spec={...parent.spec,projectileId:parent.spec.projectileId+'/eroded-debris',ammunitionType:'SECONDARY' as const,projectileMassKg:mass,caliberMm:diameter,penetratorDiameterMm:diameter,projectileLengthMm:diameter*1.5,muzzleVelocityMps:speed,penetratorGeometry:'BLUNT' as const},origin=worldPoint(work.target.motion,add(event.localExit,mul(direction,1e-7)),event.exitTime),p=launchProjectile(spec,origin,worldDirection,id,event.exitTime,Math.max(.00001,work.record.specification.detonationBehavior.flightSeconds-work.elapsedSeconds));
 p.velocity=add(work.target.motion.velocity,mul(worldDirection,speed));p.carrier={detonationId:work.record.event.eventId,fragmentId:id,generation:1,angularSampleId:parent.carrier!.angularSampleId,parentContactId:event.contactId,sourcePhysicalOwnerId:event.ownerId,sourceLayerId:event.layerId,sourcePosition:{...origin},sourceDirection:{...worldDirection},sourceBudgetRef:event.contactId+'/eroded-carrier-mass-and-energy'};
 work.carriers.push(p);work.lastDamageCount.set(id,work.state.local.length);work.record.fragments.push({fragmentId:id,angularSampleId:p.carrier.angularSampleId,generation:1,parentContactId:event.contactId,sourcePhysicalOwnerId:event.ownerId,sourceLayerId:event.layerId,sourcePosition:{...origin},sourceDirection:{...worldDirection},sourceBudgetRef:p.carrier.sourceBudgetRef,initialMassKg:mass,initialRelativeEnergyJ:E,status:p.status,contacts:0,finalMassKg:mass,finalRelativeEnergyJ:E});
 work.record.budget.secondaryReallocatedMassKg+=mass;work.record.budget.secondaryReallocatedJ+=E;
}
function registerContact(work:DetonationWork,event:DamageEvent,p:ProjectileState){
 const id=event.contactId??p.shotId+'/runtime/'+p.hitCount;if(work.processedContacts.has(id))throw Error('DUPLICATE_FRAGMENT_CONTACT');work.processedContacts.add(id);
 work.record.contactCount++;appendUnique(work.record.uniqueHitOwners,event.ownerId);if(event.damageId)appendUnique(work.record.damagedObjects,event.ownerId);
 work.record.budget.localDepositedJ+=event.localEnergyDepositJ??event.consumedJ;
 const summary=work.record.fragments.find(f=>f.fragmentId===p.shotId)!;summary.contacts++;
 work.contacts.push(event);if(work.contacts.length>WARHEAD_LIMITS.contactTrace){work.contacts.shift();work.record.traceTruncatedContacts++;}
 spawnSecondary(work,event,p);
}
function updateRecord(work:DetonationWork){
 const r=work.record;r.elapsedSeconds=work.elapsedSeconds;r.hitFragments=0;r.blockedFragments=0;r.penetratedFragments=0;r.unresolvedFragments=0;r.resolvedFragments=0;r.budget.finalCarrierKineticJ=0;
 for(const [i,p]of work.carriers.entries()){const f=r.fragments[i];f.status=p.status;f.outcome=p.lastOutcome;f.finalMassKg=p.massKg;f.finalRelativeEnergyJ=energy(work.target,p);r.budget.finalCarrierKineticJ+=f.finalRelativeEnergyJ;
  if(f.contacts)r.hitFragments++;if(p.status==='STOPPED'||p.status==='PROJECTILE_FAILURE')r.blockedFragments++;if(p.lastOutcome==='PENETRATED')r.penetratedFragments++;if(p.status==='UNRESOLVED')r.unresolvedFragments++;else if(p.status!=='ACTIVE')r.resolvedFragments++;
 }
 const start=performance.now();r.capabilityAfter=capabilities(work.target,work.state);work.diagnostics.capabilityMs+=performance.now()-start;
 r.budget.energyBalanceErrorJ=r.budget.primaryKineticJ-r.budget.finalCarrierKineticJ-r.budget.localDepositedJ;
 if(work.carriers.every(p=>p.status!=='ACTIVE')){work.phase='COMPLETE';r.status=r.unresolvedFragments?'PARTIAL':'COMPLETE';r.budget.energyBalanceErrorJ=r.budget.primaryKineticJ-r.budget.finalCarrierKineticJ-r.budget.localDepositedJ;work.rawQueryCache.clear();}
 for(const key of['Material response','Local damage + capability']){let ms=0;for(const p of work.carriers)ms+=damageProfile(p)?.[key]?.ms??0;if(key==='Material response')work.diagnostics.materialMs=ms;else work.diagnostics.damageMs=ms;}
}
/** Work budgets change yielding, never event order or population. No unprocessed path is dropped.
 * throughSeconds is an absolute time since detonation; maxBoundaries bounds one work slice. */
export function workDetonation(work:DetonationWork,throughSeconds:number,maxBoundaries=32,timeBudgetMs=Infinity){
 if(!Number.isFinite(throughSeconds)||throughSeconds<work.elapsedSeconds-1e-8||!Number.isInteger(maxBoundaries)||maxBoundaries<1)throw Error('INVALID_DETONATION_WORK_BUDGET');if(work.phase==='COMPLETE')return;
 const start=performance.now(),horizon=work.record.specification.detonationBehavior.flightSeconds,until=work.record.event.timeSeconds+Math.min(horizon,throughSeconds),execution:DamageExecution={deferCapabilities:true,beforeCommit:(event,p,c)=>secondaryReservation(work,event,p,c),onEvent:(event,p)=>registerContact(work,event,p)};
 for(let n=0;n<maxBoundaries;n++){
  work.scan??={active:work.carriers.filter(p=>p.status==='ACTIVE'),index:0,time:Infinity};
  const scan=work.scan,active=scan.active;if(!active.length)break;
  while(scan.index<active.length){const p=active[scan.index++],old=p.approach;refreshApproach(work,p);const t=nextProjectileBoundary(work.target,work.state,p);if(!old||old!==p.approach)work.lastDamageCount.set(p.shotId,work.state.local.length);
   if(t<scan.time-1e-12||Math.abs(t-scan.time)<=1e-12&&p.shotId<(scan.next?.shotId??'\uffff')){scan.time=t;scan.next=p;}
   if(performance.now()-start>=timeBudgetMs){updateRecord(work);work.diagnostics.workMs+=performance.now()-start;return;}
  }
  const next=scan.next,time=Math.max(work.record.event.timeSeconds+work.elapsedSeconds,scan.time);if(!next||!Number.isFinite(time))throw Error('NO_FINITE_FRAGMENT_BOUNDARY');
  const destination=Math.min(time,until);for(const p of active)advanceProjectileKinematics(work.target,p,destination);work.elapsedSeconds=Math.max(0,destination-work.record.event.timeSeconds);work.state.time=Math.max(work.state.time,destination);
  if(time>until+1e-12){work.scan=undefined;break;}
  const oldTransit=next.transit,oldApproach=next.approach,oldStatus=next.status,oldHits=next.hitCount;processProjectileBoundary(work.target,work.state,next,execution);if(next.status===oldStatus&&next.transit===oldTransit&&next.approach===oldApproach&&next.hitCount===oldHits)throw Error('FRAGMENT_BOUNDARY_DID_NOT_ADVANCE');work.diagnostics.boundaries++;work.scan=undefined;if(performance.now()-start>=timeBudgetMs)break;
  if(destination>=until&&time>until)break;
 }
 updateRecord(work);work.diagnostics.workMs+=performance.now()-start;
}
export function resolveDetonation(work:DetonationWork,maxBoundaries=128){let slices=0;while(work.phase!=='COMPLETE'){if(++slices>100000)throw Error('DETONATION_WORK_SAFETY_LIMIT_PENDING_NOT_DISCARDED');workDetonation(work,work.record.specification.detonationBehavior.flightSeconds,maxBoundaries);}return work.record;}
export function cancelDetonation(work:DetonationWork){if(work.phase==='PENDING'){updateRecord(work);work.phase='COMPLETE';work.record.status='CANCELLED';work.record.warnings.push('Unprocessed carriers cancelled explicitly by the laboratory; existing physical damage retained.');}work.rawQueryCache.clear();}
export function exportDetonation(work:DetonationWork){return {record:work.record,diagnostics:work.diagnostics,contacts:work.contacts,carriers:work.carriers.map(p=>Object.fromEntries(Object.entries(p).filter(([key])=>key!=='approach')))};}
