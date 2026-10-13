import type {ShipBlueprint} from '../blueprint/types';
import {evaluateFreeMount,exteriorEnvironment,savedFit,negativeSpaceIssues,nearbyAnchor} from './planner';
import {mountForEntry,platformPart,platformCandidate,supportIssues} from './platform';
import {FREE_EQUIPMENT,freeDefinition} from './library';
import {fitEquipment} from '../equipment-preview/fitment';
import type {FreeMountEntry,FreeMountRequest,FreeMountResult} from './types';
function normalizeOwnedGroups(entries:FreeMountEntry[]){for(const id of new Set(entries.map(e=>e.pairId).filter(Boolean)))if(entries.filter(e=>e.pairId===id).length!==2)entries.forEach(e=>{if(e.pairId===id)e.pairId=undefined;});return entries;}
/** Transactions contain all equipment+owned platforms. Baseline geometry is never mutated. */
export class EquipmentHistory{
 private past:ShipBlueprint[]=[];private future:ShipBlueprint[]=[];
 constructor(public blueprint:ShipBlueprint){}
 private record(next:ShipBlueprint){this.past.push(this.blueprint);if(this.past.length>40)this.past.shift();this.future=[];this.blueprint=next;return next;}
 install(request:FreeMountRequest,result?:FreeMountResult){
  const evaluated=result??evaluateFreeMount(this.blueprint,request);
  if(evaluated.status==='INVALID')throw Error(evaluated.reason);
  // Never trust a lightweight ghost or a caller-supplied result as a saved installation certificate.
  const r=evaluateFreeMount(this.blueprint,request);if(r.status==='INVALID')throw Error(r.reason);
  const replacing=new Set(request.replaceIds??[]),before=this.blueprint,entries=[...(before.freeMountPlan?.entries??[]).filter(p=>!replacing.has(p.id)),...r.entries];
  const next={...before,freeMountPlan:{version:'1.8.5.5' as const,nextId:(before.freeMountPlan?.nextId??1)+r.entries.length,entries:normalizeOwnedGroups(structuredClone(entries)),internalValidation:'NOT_PERFORMED' as const}};
  const replay=validateFreeMountPlan(next,true);if(replay.length)throw Error(replay.slice(0,2).join('; '));
  return this.record(next);
 }
 remove(ids:string[]){const set=new Set(ids),next:ShipBlueprint={...this.blueprint,freeMountPlan:{version:'1.8.5.5',nextId:this.blueprint.freeMountPlan?.nextId??1,entries:normalizeOwnedGroups(structuredClone((this.blueprint.freeMountPlan?.entries??[]).filter(p=>!set.has(p.id)))),internalValidation:'NOT_PERFORMED'}};const errors=validateFreeMountPlan(next,true);if(errors.length)throw Error(errors[0]);return this.record(next);}
 undo(){const prior=this.past.pop();if(prior){this.future.push(this.blueprint);this.blueprint=prior;}return this.blueprint;}
 redo(){const next=this.future.pop();if(next){this.past.push(this.blueprint);this.blueprint=next;}return this.blueprint;}
}
/** Legacy files without this optional extension remain untouched. Import never replans anchors. */
export function validateFreeMountPlan(b:ShipBlueprint,updateArcs=false):string[]{
 const p=b.freeMountPlan;if(!p)return[];const errors:string[]=[];
 try{
 if(p.version!=='1.8.5.5'||p.internalValidation!=='NOT_PERFORMED'||!Number.isInteger(p.nextId)||p.nextId<1||!Array.isArray(p.entries)||p.entries.length>128)throw Error('Invalid free-mount plan contract');
 if(p.entries.some(e=>!/^free-[0-9]+$/.test(e.id)||Number(e.id.slice(5))>=p.nextId))throw Error('Invalid stable equipment ID counter');
 if(new Set(p.entries.map(e=>e.id)).size!==p.entries.length)throw Error('Duplicate free equipment IDs');
 for(const id of new Set(p.entries.map(e=>e.pairId).filter(Boolean))){const members=p.entries.filter(e=>e.pairId===id);if(members.length!==2)throw Error('Incomplete saved symmetric pair '+id);const[a,c]=members;if(a.equipmentId!==c.equipmentId||Math.hypot(a.anchor.position.x+c.anchor.position.x,a.anchor.position.y-c.anchor.position.y,a.anchor.position.z-c.anchor.position.z)>.3||a.platform.kind!==c.platform.kind||a.platform.raiseTier!==c.platform.raiseTier||Math.abs(a.platform.rootWidth-c.platform.rootWidth)>1e-5||Math.abs(a.pose.yaw+c.pose.yaw)>1e-5||a.pose.elevation!==c.pose.elevation)throw Error('Invalid saved symmetric pair '+id);}
 const env=exteriorEnvironment(b),fits=p.entries.map(savedFit);
 for(const [i,entry]of p.entries.entries()){
  if(!FREE_EQUIPMENT.some(e=>e.id===entry.equipmentId)||entry.anchor.space!=='SHIP_LOCAL'||entry.validation!=='EXTERNAL_GEOMETRY_ONLY'||entry.platform.version!==1)throw Error('Invalid free equipment definition / coordinate contract');
  const hit=nearbyAnchor(b,entry.anchor.position,entry.anchor.normal,.15);
  if(hit.surfaceId!==entry.anchor.surfaceId||hit.structureId!==entry.anchor.structureId||Math.hypot(hit.position.x-entry.anchor.position.x,hit.position.y-entry.anchor.position.y,hit.position.z-entry.anchor.position.z)>.001)throw Error('Saved Anchor no longer exists');
  const e=freeDefinition(entry.equipmentId,entry.launchTiltDegrees??0);
  const expected=platformCandidate(b,entry.anchor,e,entry.headingDegrees,entry.platform.kind,env.surfaces,entry.platform.rootWidth/e.footprint.width,entry.platform.raiseTier);
  if(JSON.stringify(expected)!==JSON.stringify(entry.platform))throw Error(entry.id+': support recipe/contact was modified or its surface changed');
  const issues=supportIssues(platformPart(entry.id,entry.platform),entry.platform,env.sceneQuery(platformPart(entry.id,entry.platform).bounds),env.surfaces);if(issues.length)throw Error(issues[0]);
  const h=mountForEntry(entry.id,e,entry.platform,entry.anchor);
  // Verify every stored measured root against the CURRENT same surface, with no silent migration.
  for(const c of entry.platform.contacts){const q=env.surfaces.find(s=>s.id===c.surfaceId);if(!q||q.structureId!==entry.anchor.structureId)throw Error('Lost parent surface '+c.surfaceId);}
  const fit=fitEquipment(b,h,e,fits.filter((_,j)=>j!==i),env,{foundation:{contacts:entry.platform.contacts,part:platformPart(entry.id,entry.platform)},additionalIssues:parts=>negativeSpaceIssues(b,parts)});
  if(!fit.samples.some(s=>s.clear&&s.yaw===entry.pose.yaw&&s.elevation===entry.pose.elevation))throw Error(entry.id+': saved operating pose no longer valid');
  if(updateArcs)entry.arc=fit.samples;
  else if(JSON.stringify(entry.arc)!==JSON.stringify(fit.samples))throw Error(entry.id+': saved arc samples do not match current geometry');
 }
 }catch(e){errors.push(String(e));}return errors;
}
/** Regeneration preserves exact anchors or rejects the attempted replacement. No guessed migration. */
export function retainFreeLoadout(previous:ShipBlueprint,next:ShipBlueprint){
 if(!previous.freeMountPlan?.entries.length)return next;
 const candidate={...next,freeMountPlan:structuredClone(previous.freeMountPlan)},errors=validateFreeMountPlan(candidate);
 if(errors.length)throw Error('Regeneration would invalidate equipment anchors; current ship is retained. Export or remove player equipment before changing the design. '+errors[0]);
 return candidate;
}
