import {timedDamage}from'./diagnostics';
import {Quaternion,Vector3}from'three';
import type{Vec3}from'../blueprint/types';
import type{DamageInstance,DamageTarget,ProjectileSpec,ProjectileState,TargetMotion,Contact,DamageEvent,MaterialResult,DamageExecution}from'./types';
import {validateProjectile}from'./registry';
import {length,unit,penetrate}from'./material';
import {add,mul,sub}from'../generation/integration/contours';
import {damagedContacts}from'./contacts';
import {localLoss,commitDamage,appendEvent}from'./state';
import {DAMAGE_LIMITS}from'./calibration';
const xyz=(v:Vector3):Vec3=>({x:v.x,y:v.y,z:v.z});
export function rotate(v:Vec3,q:TargetMotion['quaternion'],inverse=false){const r=new Quaternion(q.x,q.y,q.z,q.w);if(inverse)r.invert();return xyz(new Vector3(v.x,v.y,v.z).applyQuaternion(r));}
export const targetPosition=(m:TargetMotion,t:number)=>add(m.position,mul(m.velocity,t));
export const localPoint=(m:TargetMotion,p:Vec3,t:number)=>rotate(sub(p,targetPosition(m,t)),m.quaternion,true);
export const worldPoint=(m:TargetMotion,p:Vec3,t:number)=>add(targetPosition(m,t),rotate(p,m.quaternion));
export function launchProjectile(spec:ProjectileSpec,origin:Vec3,direction:Vec3,shotId:string,launchedAt=0,maxFlightSeconds=5):ProjectileState{
 validateProjectile(spec);if(!Object.values(origin).every(Number.isFinite)||!Object.values(direction).every(Number.isFinite)||!Number.isFinite(launchedAt)||launchedAt<0||!Number.isFinite(maxFlightSeconds)||maxFlightSeconds<=0||maxFlightSeconds>60)throw Error('INVALID_SHOT');
 return {shotId,spec:structuredClone(spec),position:{...origin},velocity:mul(unit(direction),spec.muzzleVelocityMps),massKg:spec.projectileMassKg,integrity:1,age:0,launchedAt,status:'ACTIVE',hitCount:0,ricochets:0,maxFlightSeconds,trajectory:[{...origin}]};
}
function makeEvent(p:ProjectileState,s:DamageInstance,t:DamageTarget,c:Contact,r:MaterialResult,entry:Vec3,exit:Vec3,entryTime:number,exitTime:number,velocity:Vec3):DamageEvent{return {shotId:p.shotId,projectileId:p.spec.projectileId,instanceId:s.instanceId,time:entryTime,exitTime,ownerId:c.ownerId,geometryId:c.geometryId,layerId:c.layerId,kind:c.kind,materialId:c.materialId,worldPosition:worldPoint(t.motion,entry,entryTime),localPosition:{...entry},localExit:{...exit},normal:rotate(c.normal,t.motion.quaternion),relativeVelocity:rotate(velocity,t.motion.quaternion),incidentJ:r.incidentJ,residualJ:r.residualJ,outcome:r.outcome,incidenceDegrees:r.incidenceDegrees,pathM:length(sub(exit,entry)),availablePathM:Math.max(0,c.exit-c.entry),projectileBefore:{massKg:p.massKg,integrity:p.integrity},projectileAfter:{massKg:r.massKg,integrity:r.integrity,relativeSpeedMps:r.speedMps,localDirection:{...r.direction}},consumedJ:Math.max(0,r.incidentJ-r.residualJ),disabledEdges:[],...(p.carrier?{detonationId:p.carrier.detonationId,fragmentId:p.carrier.fragmentId,fragmentGeneration:p.carrier.generation,contactId:p.carrier.fragmentId+'/contact/'+p.hitCount}:{}),...(r.warning?{warning:r.warning}:{})};}
function unresolved(target:DamageTarget,s:DamageInstance,p:ProjectileState,reason:string,execution?:DamageExecution){
 const relative=rotate(sub(p.velocity,target.motion.velocity),target.motion.quaternion,true),speed=length(relative),dir=speed>0?unit(relative):{x:0,y:0,z:1},point=localPoint(target.motion,p.position,p.launchedAt+p.age),energy=.5*p.massKg*speed*speed;
 const c:Contact={ownerId:'RUNTIME_LIMIT',geometryId:'NONE',layerId:'UNKNOWN',kind:'UNRESOLVED',materialId:null,entry:0,exit:0,normal:mul(dir,-1),thicknessM:0,confidence:reason},r:MaterialResult={outcome:'UNRESOLVED',incidentJ:energy,residualJ:energy,massKg:p.massKg,integrity:p.integrity,speedMps:speed,direction:dir,depthM:0,damageRadiusM:0,lossM:0,fracture:0,incidenceDegrees:0,warning:reason};
 const event=makeEvent(p,s,target,c,r,point,point,p.launchedAt+p.age,p.launchedAt+p.age,relative);appendEvent(s,event);execution?.onEvent?.(event,p);p.status='UNRESOLVED';p.lastOutcome='UNRESOLVED';
}
/** Analytic free flight and finite interval CCD. No target-at-launch auto-hit.
 * Material transit uses a finite average-speed dwell, recomputing direction after every response. */
export function advanceProjectile(target:DamageTarget,s:DamageInstance,p:ProjectileState,seconds:number){return timedDamage(p,'Advance total',()=>advanceInternal(target,s,p,seconds));}
function advanceInternal(target:DamageTarget,s:DamageInstance,p:ProjectileState,seconds:number,singleBoundary=false,execution?:DamageExecution){
 if(!Number.isFinite(seconds)||(seconds<=0&&!singleBoundary)||seconds<0||seconds>10)throw Error('INVALID_FLIGHT_INTERVAL');if(p.status!=='ACTIVE')return;
 if([...Object.values(target.motion.position),...Object.values(target.motion.velocity),...Object.values(target.motion.quaternion)].some(n=>!Number.isFinite(n))||Math.abs(Math.hypot(...Object.values(target.motion.quaternion))-1)>1e-6)throw Error('INVALID_TARGET_MOTION');
 let left=Math.min(seconds,p.maxFlightSeconds-p.age),operations=0;
 while((left>1e-10||singleBoundary&&operations===0)&&p.status==='ACTIVE'){
  if(++operations>DAMAGE_LIMITS.contactsPerStep||p.hitCount>=DAMAGE_LIMITS.contactsPerStep){unresolved(target,s,p,'CONTACT_RESOLUTION_LIMIT',execution);break;}
  if(p.transit){const tr=p.transit,take=Math.min(left,tr.duration-tr.elapsed);tr.elapsed+=take;p.age+=take;left-=take;const fraction=tr.duration?Math.min(1,tr.elapsed/tr.duration):1;p.position=worldPoint(target.motion,add(tr.entryLocal,mul(sub(tr.exitLocal,tr.entryLocal),fraction)),p.launchedAt+p.age);
   if(fraction>=1-1e-10){if(s.local.length>=DAMAGE_LIMITS.localRegions){unresolved(target,s,p,'DAMAGE_CAPACITY_REACHED_DURING_TRANSIT',execution);p.transit=undefined;break;}const event=makeEvent(p,s,target,tr.contact,tr.result,tr.entryLocal,tr.exitLocal,tr.entryTime,p.launchedAt+p.age,tr.relativeVelocity);execution?.beforeCommit?.(event,p,tr.contact,tr.result);timedDamage(p,'Local damage + capability',()=>commitDamage(target.blueprint,s,tr.contact,tr.result,tr.entryLocal,tr.exitLocal,event,execution));appendEvent(s,event);execution?.onEvent?.(event,p);p.massKg=tr.result.massKg;p.integrity=tr.result.integrity;p.velocity=add(target.motion.velocity,rotate(mul(tr.result.direction,tr.result.speedMps),target.motion.quaternion));p.lastOutcome=tr.result.outcome;p.hitCount++;p.status=tr.result.outcome==='PENETRATED'?'ACTIVE':tr.result.outcome==='PROJECTILE_FAILURE'?'PROJECTILE_FAILURE':'STOPPED';p.transit=undefined;p.approach=undefined;
    if(p.status==='ACTIVE'){p.position=add(p.position,mul(rotate(tr.result.direction,target.motion.quaternion),DAMAGE_LIMITS.epsilonM));}
   }if(singleBoundary)break;continue;
  }
  const absolute=p.launchedAt+p.age,relative=rotate(sub(p.velocity,target.motion.velocity),target.motion.quaternion,true),speed=length(relative);if(speed<1e-8){p.age+=left;p.position=add(p.position,mul(p.velocity,left));left=0;break;}const dir=unit(relative),origin=localPoint(target.motion,p.position,absolute),motionKey=JSON.stringify(target.motion);
  ensureApproach(target,s,p,origin,dir,speed,motionKey);
  const a=p.approach!,toHit=a.distance/speed;
  if(toHit>left){p.position=add(p.position,mul(p.velocity,left));a.distance-=speed*left;p.age+=left;left=0;break;}
  p.position=add(p.position,mul(p.velocity,toHit));p.age+=toHit;left-=toHit;const c=a.contact!;c.exit-=c.entry;c.entry=0;const entry=localPoint(target.motion,p.position,p.launchedAt+p.age);
  let result=timedDamage(p,'Material response',()=>penetrate(p.spec,p.massKg,p.integrity,relative,c,localLoss(s,c,entry)));if(s.local.length>=DAMAGE_LIMITS.localRegions||target.motion.angularVelocity&&length(target.motion.angularVelocity)>1e-10)result={...result,outcome:'UNRESOLVED',warning:'DAMAGE_CAPACITY_OR_ROTATING_CCD_UNSUPPORTED'};
  if(result.outcome==='UNRESOLVED'){const event=makeEvent(p,s,target,c,result,entry,entry,p.launchedAt+p.age,p.launchedAt+p.age,relative);event.warning=result.warning??c.confidence;appendEvent(s,event);execution?.onEvent?.(event,p);p.lastOutcome='UNRESOLVED';p.status='UNRESOLVED';p.approach=undefined;break;}
  if(result.outcome==='RICOCHET'){const event=makeEvent(p,s,target,c,result,entry,entry,p.launchedAt+p.age,p.launchedAt+p.age,relative);execution?.beforeCommit?.(event,p,c,result);timedDamage(p,'Local damage + capability',()=>commitDamage(target.blueprint,s,c,result,entry,entry,event,execution));appendEvent(s,event);execution?.onEvent?.(event,p);p.hitCount++;p.ricochets++;p.lastOutcome='RICOCHET';p.massKg=result.massKg;p.integrity=result.integrity;p.velocity=add(target.motion.velocity,rotate(mul(result.direction,result.speedMps),target.motion.quaternion));p.position=add(p.position,mul(rotate(result.direction,target.motion.quaternion),DAMAGE_LIMITS.epsilonM));p.approach=undefined;if(p.ricochets>=DAMAGE_LIMITS.ricochets)unresolved(target,s,p,'RICOCHET_RECURRENCE_LIMIT',execution);if(singleBoundary)break;continue;}
  const exit=add(entry,mul(dir,result.depthM)),duration=Math.max(1e-9,result.depthM/Math.max(1,(speed+result.speedMps)/2));p.transit={contact:{...c},result,entryLocal:entry,exitLocal:exit,entryTime:p.launchedAt+p.age,duration,elapsed:0,worldVelocity:{...p.velocity},relativeVelocity:relative};p.approach=undefined;if(singleBoundary)break;
 }
 s.time=Math.max(s.time,p.launchedAt+p.age);if(p.age>=p.maxFlightSeconds-1e-9&&p.status==='ACTIVE'){if(p.transit)unresolved(target,s,p,'FLIGHT_HORIZON_DURING_MATERIAL',execution);else p.status='EXITED';}p.trajectory.push({...p.position});if(p.trajectory.length>256)p.trajectory.shift();
}
export function resolveProjectile(target:DamageTarget,s:DamageInstance,p:ProjectileState,step=1/60){while(p.status==='ACTIVE')advanceProjectile(target,s,p,step);return p;}

function ensureApproach(target:DamageTarget,s:DamageInstance,p:ProjectileState,origin:Vec3,dir:Vec3,speed:number,motionKey:string){
  if(!p.approach||p.approach.revision!==s.revision||p.approach.motionKey!==motionKey){const contacts=timedDamage(p,'Finite queries + ordered contacts',()=>damagedContacts(target.queries.collect(origin,dir,speed*(p.maxFlightSeconds-p.age)+target.queries.extentM,s),s,origin,dir)),c=contacts[0];let next=c;
   if(c&&contacts.some((other,i)=>i>0&&other.ownerId!==c.ownerId&&other.entry<c.exit-1e-6&&other.entry<=c.entry+1e-7))next={...c,kind:'UNRESOLVED',confidence:'OVERLAPPING_PHYSICAL_OWNERS_AT_ENTRY',materialId:null};
   // Clip to any earlier next owner, then requery at that interface. No intervening object is skipped.
   const later=contacts.find((other,i)=>i>0&&other.ownerId!==c?.ownerId&&other.entry>c.entry+1e-7&&other.entry<c.exit-1e-6);if(next&&later)next={...next,exit:later.entry};
   p.approach={contact:next??null,distance:next?.entry??Infinity,revision:s.revision,motionKey};
  }
}

/** Inspection and kinematic advance are shared by the chronological multi-carrier scheduler.
 * Callers must advance no farther than the earliest inspected boundary. */
export function nextProjectileBoundary(target:DamageTarget,s:DamageInstance,p:ProjectileState){
 if(p.status!=='ACTIVE')return Infinity;
 const now=p.launchedAt+p.age,end=p.launchedAt+p.maxFlightSeconds;
 if(p.transit)return Math.min(end,now+Math.max(0,p.transit.duration-p.transit.elapsed));
 const relative=rotate(sub(p.velocity,target.motion.velocity),target.motion.quaternion,true),speed=length(relative);
 if(speed<1e-8)return end;
 ensureApproach(target,s,p,localPoint(target.motion,p.position,now),unit(relative),speed,JSON.stringify(target.motion));
 return Math.min(end,now+p.approach!.distance/speed);
}
export function advanceProjectileKinematics(target:DamageTarget,p:ProjectileState,absoluteTime:number){
 const dt=absoluteTime-(p.launchedAt+p.age);if(dt< -1e-8||!Number.isFinite(dt))throw Error('NON_CHRONOLOGICAL_PROJECTILE_ADVANCE');if(dt<=0)return;
 if(p.transit){const tr=p.transit;tr.elapsed=Math.min(tr.duration,tr.elapsed+dt);p.age+=dt;p.position=worldPoint(target.motion,add(tr.entryLocal,mul(sub(tr.exitLocal,tr.entryLocal),Math.min(1,tr.elapsed/tr.duration))),p.launchedAt+p.age);}
 else{p.position=add(p.position,mul(p.velocity,dt));p.age+=dt;if(p.approach)p.approach.distance=Math.max(0,p.approach.distance-length(sub(p.velocity,target.motion.velocity))*dt);}
}
export function processProjectileBoundary(target:DamageTarget,s:DamageInstance,p:ProjectileState,execution?:DamageExecution){
 const quantum=16*Number.EPSILON*Math.max(1,p.launchedAt+p.age);if(p.approach&&p.approach.distance<=1e-7)p.approach.distance=0;if(p.transit&&p.transit.duration-p.transit.elapsed<=quantum)p.transit.elapsed=p.transit.duration;
 return timedDamage(p,'Advance total',()=>advanceInternal(target,s,p,0,true,execution));
}
