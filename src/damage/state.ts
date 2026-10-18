import type{ShipBlueprint,Vec3}from'../blueprint/types';
import type{DamageInstance,DamageEvent,Contact,MaterialResult,LocalDamage}from'./types';
import {createSystemInstanceState}from'../systems/types';
import {createInteriorInstanceState}from'../interior/types';
import {evaluateShipCapabilities}from'../systems/evaluate';
import {analyzeStructuralInstance}from'../structure/graph';
import {DAMAGE_LIMITS}from'./calibration';
import {dot,sub,mul}from'../generation/integration/contours';
export function createDamageInstance(b:ShipBlueprint,instanceId:string):DamageInstance{return {schemaVersion:1,instanceId,time:0,revision:0,local:[],equipmentIntegrity:{},structuralIntegrity:{},systems:createSystemInstanceState(b.functionalSystems),interior:createInteriorInstanceState(),blockedClosurePositions:{},structure:{schemaVersion:1,disabledMemberIds:[],disabledJointIds:[],disabledEdgeIds:[]},events:[],nextDamageId:1};}
export const damageCapabilities=(b:ShipBlueprint,s:DamageInstance)=>b.functionalSystems?evaluateShipCapabilities(b,s.systems):undefined;
export const structuralDamageAnalysis=(b:ShipBlueprint,s:DamageInstance)=>b.structuralFrame?analyzeStructuralInstance(b.structuralFrame,s.structure):undefined;
const dist=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function localLoss(s:DamageInstance,c:Contact,p:Vec3){return s.local.filter(r=>r.ownerId===c.ownerId&&r.layerId===c.layerId&&!r.channel&&dist(r.position,p)<r.radiusM).reduce((n,r)=>n+r.materialLossM,0);}
export function commitDamage(b:ShipBlueprint,s:DamageInstance,c:Contact,r:MaterialResult,entry:Vec3,exit:Vec3,event:DamageEvent,options?:{deferCapabilities?:boolean}){
 if(r.outcome==='UNRESOLVED')return;
 const before=options?.deferCapabilities?undefined:damageCapabilities(b,s),depositedJ=event.localEnergyDepositJ??(r.incidentJ-r.residualJ),radius=r.damageRadiusM,normal=c.normal,helper=Math.abs(normal.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0},cross={x:normal.y*helper.z-normal.z*helper.y,y:normal.z*helper.x-normal.x*helper.z,z:normal.x*helper.y-normal.y*helper.x},cl=Math.hypot(cross.x,cross.y,cross.z),u=mul(cross,1/Math.max(cl,1e-9)),v={x:normal.y*u.z-normal.z*u.y,y:normal.z*u.x-normal.x*u.z,z:normal.x*u.y-normal.y*u.x};
 const region:LocalDamage={id:s.instanceId+'/damage/'+s.nextDamageId++,ownerId:c.ownerId,layerId:c.layerId,kind:c.kind,position:{...entry},normal:{...normal},surfaceCoordinates:{u:dot(entry,u),v:dot(entry,v)},radiusM:radius,materialLossM:r.lossM,plasticDeformationM:r.lossM*(1-r.fracture),fracture:r.fracture,delamination:r.fracture*.3,severity:Math.min(1,depositedJ/Math.max(1,r.incidentJ)),channel:r.outcome==='PENETRATED'?{entry:{...entry},exit:{...exit},radiusM:radius}:null,shotId:event.shotId};
 s.local.push(region);s.revision++;event.damageId=region.id;
 if(c.kind==='EQUIPMENT'){
  const loss=Math.min(1,depositedJ*.3/Math.max(1,(c.equipmentMassKg??1)*750)),old=s.equipmentIntegrity[c.ownerId]??1,next=Math.max(0,old-loss);s.equipmentIntegrity[c.ownerId]=next;
  const oldState=s.systems.equipmentStates[c.ownerId]??'OPERATIONAL',state=next<=.05?'DESTROYED':next<=.3?'OFFLINE':next<=.8?'DEGRADED':'OPERATIONAL';
  // Damage is monotone; an already disabled device never returns to service implicitly.
  const order={OPERATIONAL:0,DEGRADED:1,OFFLINE:2,DESTROYED:3};if(order[state]>order[oldState]){s.systems.equipmentStates[c.ownerId]=state;event.equipmentStateChange={from:oldState,to:state};}
 }
 if(c.kind==='FRAME'){
  const member=b.structuralFrame?.members.find(m=>m.id===c.ownerId);
  if(member){
   const remaining=remainingSection(member,entry,s.local.filter(p=>p.ownerId===c.ownerId));
   s.structuralIntegrity[c.ownerId]=Math.min(s.structuralIntegrity[c.ownerId]??1,remaining);
   if(remaining<=.01&&!s.structure.disabledMemberIds.includes(c.ownerId)){s.structure.disabledMemberIds.push(c.ownerId);for(const e of b.structuralFrame?.edges.filter(e=>e.physicalMemberRef===c.ownerId)??[])if(!s.structure.disabledEdgeIds.includes(e.id)){s.structure.disabledEdgeIds.push(e.id);event.disabledEdges.push(e.id);}}
   for(const jointId of c.jointRefs??[]){const joint=b.structuralFrame?.joints.find(j=>j.id===jointId);if(!joint)continue;const q=joint.geometryReference.position,axis=sub(exit,entry),len2=dot(axis,axis),t=len2?dot(sub(q,entry),axis)/len2:0,near={x:entry.x+axis.x*t,y:entry.y+axis.y*t,z:entry.z+axis.z*t};
    if(t>=-1e-6&&t<=1+1e-6&&dist(q,near)<=Math.min(member.section.widthM,member.section.heightM)*.5&&remainingSection(member,q,s.local.filter(p=>p.ownerId===c.ownerId))<=.01&&!s.structure.disabledJointIds.includes(jointId)){s.structure.disabledJointIds.push(jointId);for(const e of b.structuralFrame?.edges.filter(e=>e.jointRefs.includes(jointId))??[])if(!s.structure.disabledEdgeIds.includes(e.id)){s.structure.disabledEdgeIds.push(e.id);event.disabledEdges.push(e.id);}}
   }
  }
 }

 const after=options?.deferCapabilities?undefined:damageCapabilities(b,s);if(before&&after)event.capabilityDelta={powerMW:after.availableElectricalPowerMW-before.availableElectricalPowerMW,propulsion:after.propulsionAuthority-before.propulsionAuthority,maneuver:after.maneuverAuthority-before.maneuverAuthority,fire:after.availableFireControlChannels-before.availableFireControlChannels,sensor:after.availableSensorProcessingCapacity-before.availableSensorProcessingCapacity};
}
export function appendEvent(s:DamageInstance,event:DamageEvent){s.events.push(event);if(s.events.length>DAMAGE_LIMITS.history)s.events.shift();}

/** Conservative 16×16 section removal. A tile is removed only if every corner is
 * inside ONE actual finite channel. Overlapping holes never double-count area.
 * Projected bounds of actual stock may overestimate remaining stock on lofts/hex beams. */
function remainingSection(m:NonNullable<ShipBlueprint['structuralFrame']>['members'][number],point:Vec3,damage:LocalDamage[]){
 const axis=sub(m.end,m.start),len=Math.hypot(axis.x,axis.y,axis.z);if(len<1e-9)return 1;const w=mul(axis,1/len),helper=Math.abs(w.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0},cross={x:w.y*helper.z-w.z*helper.y,y:w.z*helper.x-w.x*helper.z,z:w.x*helper.y-w.y*helper.x},u=mul(cross,1/Math.hypot(cross.x,cross.y,cross.z)),v={x:w.y*u.z-w.z*u.y,y:w.z*u.x-w.x*u.z,z:w.x*u.y-w.y*u.x},station=Math.max(0,Math.min(len,dot(sub(point,m.start),w))),centre={x:m.start.x+w.x*station,y:m.start.y+w.y*station,z:m.start.z+w.z*station};
 // Project the actual owned geometry, rather than assuming an arbitrary section roll.
 const projected=m.pieces.flatMap(p=>p.vertices).map(p=>{const d=sub(p,centre);return {x:dot(d,u),y:dot(d,v)};}),minX=Math.min(...projected.map(p=>p.x)),maxX=Math.max(...projected.map(p=>p.x)),minY=Math.min(...projected.map(p=>p.y)),maxY=Math.max(...projected.map(p=>p.y));
 if(!projected.length||maxX-minX<1e-9||maxY-minY<1e-9)return 1;
 const channels=damage.flatMap(d=>d.channel?[d.channel]:[]);let removed=0;
 for(let i=0;i<16;i++)for(let j=0;j<16;j++){
  const corners=[0,1].flatMap(a=>[0,1].map(b=>{const x=minX+(i+a)/16*(maxX-minX),y=minY+(j+b)/16*(maxY-minY);return {x:centre.x+u.x*x+v.x*y,y:centre.y+u.y*x+v.y*y,z:centre.z+u.z*x+v.z*y};}));
  if(channels.some(c=>corners.every(p=>{const d=sub(c.exit,c.entry),ll=dot(d,d);if(ll<1e-12)return false;const t=dot(sub(p,c.entry),d)/ll;if(t< -1e-7||t>1+1e-7)return false;const near={x:c.entry.x+d.x*t,y:c.entry.y+d.y*t,z:c.entry.z+d.z*t};return dist(p,near)<=c.radiusM+1e-7;})))removed++;
 }
 return 1-removed/256;
}
