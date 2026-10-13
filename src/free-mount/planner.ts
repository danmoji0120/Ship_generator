import type {ShipBlueprint,Vec3,Hardpoint} from '../blueprint/types';
import {slotEnvironment} from '../generation/hardpoint-system/planner';
import {boundsIndex,boxSolid,boxBounds} from '../generation/hardpoint-system/geometry';
import {reservationBounds} from '../generation/armor/geometry';
import {add,sub,mul,dot,unit,boundsOf} from '../generation/integration/contours';
import {surfaceRay} from '../generation/weapons/surfaces';
import {detailFrame} from '../generation/details/geometry';
import {fitEquipment,type FitResult} from '../equipment-preview/fitment';
import {equipmentGeometry} from '../equipment-preview/geometry';
import {solidContains,rayBlocked} from '../generation/weapons/collision';
import {containsProductionVolume} from '../generation/production/surface-contact';
import {FREE_EQUIPMENT,freeDefinition} from './library';
import {PLATFORM_ORDER,platformCandidate,platformPart,mountForEntry,supportIssues} from './platform';
import type {FreeMountEntry,FreeMountRequest,FreeMountResult,SurfaceAnchor,PlatformKind} from './types';
const environments=new WeakMap<ShipBlueprint,ReturnType<typeof slotEnvironment>>();
export function exteriorEnvironment(b:ShipBlueprint){
 if(!b.productionDesign)throw Error("Historical playback is preserved; Free-Mount requires a Production exterior Blueprint");
 let env=environments.get(b);if(env)return env;
 const original=slotEnvironment(b);
 const protectedBoxes=(b.productionDesign?.zones??[]).map(z=>({id:z.id,bounds:reservationBounds(z)}));
 // Original internal capacity/supply/energy reservations and EMPTY slots are deliberately absent.
 // The integrated gun's actual outward muzzle axis remains protected as external geometry.
 for(const h of b.hardpoints.filter(h=>h.type==='Spinal')){
  const frame=detailFrame(h.normal),box={position:h.position,frame,localBounds:{min:{x:-h.radius,y:0,z:-h.radius},max:{x:h.radius,y:60,z:h.radius}}};
  protectedBoxes.push({id:h.id+'/external-spinal-axis',bounds:boxBounds(box)});
 }
 env={...original,exclusions:boundsIndex(protectedBoxes)};
 environments.set(b,env);return env;
}
export function savedFit(entry:FreeMountEntry):FitResult{
 const e=freeDefinition(entry.equipmentId,entry.launchTiltDegrees??0);
 const h=mountForEntry(entry.id,e,entry.platform,entry.anchor),geo=equipmentGeometry(h,e,entry.pose.yaw,entry.pose.elevation);
 return{slotId:entry.id,equipmentId:e.id,status:entry.arc.every(a=>a.clear)?'VALID':'PARTIAL_ARC',reasons:[],parts:[platformPart(entry.id,entry.platform),...geo.parts],shots:geo.shots,contacts:entry.platform.contacts,samples:entry.arc,pose:entry.pose,pairId:entry.pairId,batteryId:entry.batteryId};
}
/** Query a nearby outward surface; reject far/other-hull projection rather than silently relocating. */
export function nearbyAnchor(b:ShipBlueprint,p:Vec3,n:Vec3,maxDistance=3):SurfaceAnchor{
 const hit=surfaceRay(exteriorEnvironment(b).surfaces,p,n);
 if(!hit||Math.abs(dot(sub(hit.position,p),n))>maxDistance)throw Error('No nearby exposed Hull / Armor surface');
 return {...hit,space:'SHIP_LOCAL'};
}
const emptyTargets=new WeakMap<ShipBlueprint,{point:Vec3;id:string}[]>();
export function negativeSpaceIssues(b:ShipBlueprint,parts:import('../equipment-preview/geometry').PreviewPart[]){
 let points=emptyTargets.get(b);if(!points){points=[];for(const t of b.macroDesign?.negativeSpaceTargets??[])for(const x of[-.35,0,.35])for(const y of[-.35,0,.35])for(const z of[-.35,0,.35]){const point={x:t.center.x+t.size.x*x,y:t.center.y+t.size.y*y,z:t.center.z+t.size.z*z};if(!b.structuralVolumes.some(v=>containsProductionVolume(v,point,0)))points.push({point,id:t.id});}emptyTargets.set(b,points);}
 const errors:string[]=[];for(const {point:p,id}of points)if(parts.some(a=>p.x>=a.bounds.min.x&&p.x<=a.bounds.max.x&&p.y>=a.bounds.min.y&&p.y<=a.bounds.max.y&&p.z>=a.bounds.min.z&&p.z<=a.bounds.max.z&&solidContains(a.solid,p)))errors.push('Intentional negative space '+id);return errors;
}
const reflect=(p:Vec3):Vec3=>({x:-p.x,y:p.y,z:p.z});
export function evaluateFreeMount(b:ShipBlueprint,req:FreeMountRequest,quick=false):FreeMountResult{
 const start=performance.now(),result:FreeMountResult={status:'INVALID',reason:'',entries:[],fits:[],mounts:[],elapsedMs:0,attempts:[]};
 try{
 const e=freeDefinition(req.equipmentId,req.launchTiltDegrees??0);
 if(req.anchor.space!=='SHIP_LOCAL'||!Number.isFinite(req.headingDegrees)||!Object.values(req.anchor.position).every(Number.isFinite)||Math.abs(Math.hypot(...Object.values(req.anchor.normal))-1)>1e-5)throw Error('Invalid mount pose');
 const count=req.mode==='BATTERY'?(req.count??1):1;if(!Number.isInteger(count)||count<1||count>8)throw Error('Battery count must be 1…8');
 const spacing=req.spacing??Math.max(e.envelope.length*1.35,e.footprint.length*1.8);if(!Number.isFinite(spacing)||spacing<e.footprint.length)throw Error('Battery spacing below module footprint');
 const env=exteriorEnvironment(b),replace=new Set(req.replaceIds??[]),existing=(b.freeMountPlan?.entries??[]).filter(p=>!replace.has(p.id)),placed=existing.map(savedFit);
 const first=nearbyAnchor(b,req.anchor.position,req.anchor.normal,.15);
 if(first.surfaceId!==req.anchor.surfaceId||first.structureId!==req.anchor.structureId)throw Error('Anchor surface changed; pick it again');
 const direction=unit(req.arrayDirection??detailFrame(first.normal).forward);if(Math.abs(dot(direction,first.normal))>.15)throw Error('Battery direction must follow the mounting surface');
 const next=b.freeMountPlan?.nextId??1,batteryId=req.mode==='BATTERY'?(b.freeMountPlan?.entries.find(e=>req.replaceIds?.includes(e.id))?.batteryId??'free-battery-'+next):undefined;
 const mirrored=req.mode==='MIRROR'||(req.mode==='BATTERY'&&req.mirrorBattery);
 const resolve=(anchor:SurfaceAnchor,id:string,heading:number,minimum=0,exact?:FreeMountEntry["platform"])=>{
  const kinds=req.platforms?PLATFORM_ORDER.filter(k=>(k!=='SIDE_SPONSON'||Math.abs(anchor.normal.x)>.5)&&(k!=='RAISED_BARBETTE'||Math.abs(anchor.normal.x)<=.5)):['DIRECT'] as PlatformKind[];
  const selected=req.platformPreference?PLATFORM_ORDER.indexOf(req.platformPreference):minimum;
  for(const kind of kinds){if(PLATFORM_ORDER.indexOf(kind)<selected||exact&&kind!==exact.kind)continue;
   if(kind==='PYLON_BRACE'&&e.id!=='test-pod'&&Math.abs(anchor.normal.x)<.5)continue;
   for(const ratio of exact?[exact.rootWidth/e.footprint.width]:kind==='DIRECT'?[1]:kind==='FLUSH_BASE'?[1,.8]:[1,.75,.55,.38,.28])for(const tier of exact?[exact.raiseTier]:['DIRECT','FLUSH_BASE','PYLON_BRACE'].includes(kind)?[0]:[0,1,2])try{
    const r=platformCandidate(b,anchor,e,heading,kind,env.surfaces,ratio,tier),part=platformPart(id,r);
    const issues=supportIssues(part,r,[...env.sceneQuery(part.bounds),...placed.flatMap(p=>p.parts)],env.surfaces);
    if(issues.length)throw Error(issues.slice(0,2).join('; '));
    const h=mountForEntry(id,e,r,anchor),fit=fitEquipment(b,h,e,placed,env,{foundation:{contacts:r.contacts,part},quick,additionalIssues:parts=>negativeSpaceIssues(b,parts)});
    if(!fit.pose)throw Error(fit.reasons.slice(0,3).join('; ')||fit.status);
    const entry:FreeMountEntry={id,equipmentId:e.id,anchor,headingDegrees:heading,launchTiltDegrees:e.launchTiltDegrees??0,platform:r,pose:fit.pose,arc:fit.samples,validation:'EXTERNAL_GEOMETRY_ONLY',batteryId};
    return{entry,fit,h};
   }catch(err){result.attempts.push({kind,reason:String(err)});}
  }
  throw Error(result.attempts.at(-1)?.reason??'No valid support platform');
 };
 for(let i=0;i<count;i++){
  const p=add(first.position,mul(direction,i*spacing)),anchor=nearbyAnchor(b,p,first.normal,Math.max(3,Math.min(spacing*.6,e.footprint.width*2)));
  const id=req.replaceIds?.[result.entries.length]??'free-'+(next+result.entries.length);let a=resolve(anchor,id,req.headingDegrees);
  const append=(v:ReturnType<typeof resolve>)=>{result.entries.push(v.entry);result.fits.push(v.fit);result.mounts.push(v.h);placed.push(v.fit);};
  if(mirrored&&Math.abs(anchor.position.x)>.05){
   const mate=nearbyAnchor(b,reflect(anchor.position),reflect(anchor.normal),.3);
   if(Math.hypot(...Object.values(sub(mate.position,reflect(anchor.position))))>.3||dot(mate.normal,reflect(anchor.normal))<.98)throw Error('Mirrored surface missing or not geometrically symmetric');
   // Matched recipe kind/height tier, independently supported at each side.
   const pair=b.freeMountPlan?.entries.find(e=>e.id===id)?.pairId??'free-pair-'+(next+result.entries.length),level=PLATFORM_ORDER.indexOf(a.entry.platform.kind);
   append(a);let c=resolve(mate,req.replaceIds?.[result.entries.length]??'free-'+(next+result.entries.length),-req.headingDegrees,level);
   if(c.entry.platform.kind!==a.entry.platform.kind||c.entry.platform.raiseTier!==a.entry.platform.raiseTier||Math.abs(c.entry.platform.rootWidth-a.entry.platform.rootWidth)>1e-5){
    const more=PLATFORM_ORDER.indexOf(c.entry.platform.kind)>level?c.entry.platform:a.entry.platform;
    const common={...more,rootWidth:Math.min(a.entry.platform.rootWidth,c.entry.platform.rootWidth),raiseTier:Math.max(a.entry.platform.raiseTier,c.entry.platform.raiseTier)};
    result.entries.pop();result.fits.pop();result.mounts.pop();placed.pop();
    a=resolve(anchor,id,req.headingDegrees,0,common);append(a);
    c=resolve(mate,c.entry.id,-req.headingDegrees,0,common);
   }
   if(Math.abs(c.entry.platform.height-a.entry.platform.height)>.1)throw Error('No common symmetric support height');
   if(!quick){
    const common=a.fit.samples.filter(s=>s.clear&&c.fit.samples.some(t=>t.clear&&t.yaw===-s.yaw&&t.elevation===s.elevation)).sort((u,v)=>Math.abs(u.yaw)-Math.abs(v.yaw)||Math.abs(u.elevation-20)-Math.abs(v.elevation-20))[0];
    if(!common)throw Error('No common mirrored operating pose');
    for(const [v,yaw]of [[a,common.yaw],[c,-common.yaw]] as const){v.entry.pose={yaw,elevation:common.elevation};const geo=equipmentGeometry(v.h,e,yaw,common.elevation);v.fit.pose=v.entry.pose;v.fit.parts=[platformPart(v.entry.id,v.entry.platform),...geo.parts];v.fit.shots=geo.shots;}
   }
   a.entry.pairId=c.entry.pairId=pair;a.fit.pairId=c.fit.pairId=pair;append(c);
  }else append(a);
 }
 // Re-evaluate each assembly's operating samples against ALL accepted neighbors. No silent partial battery.
 if(!quick)for(let i=0;i<result.entries.length;i++){
  const entry=result.entries[i],h=result.mounts[i],others=[...existing.map(savedFit),...result.fits.filter((_,j)=>j!==i)];
  const replay=fitEquipment(b,h,e,others,env,{foundation:{contacts:entry.platform.contacts,part:platformPart(entry.id,entry.platform)},additionalIssues:parts=>negativeSpaceIssues(b,parts)});
  if(!replay.pose)throw Error('Battery final operation replay failed: '+replay.reasons.slice(0,2).join('; '));
  const preferred=replay.samples.find(s=>s.clear&&s.yaw===entry.pose.yaw&&s.elevation===entry.pose.elevation);
  if(!preferred)throw Error('Chosen battery pose blocked by final neighbors; change spacing or orientation');
  entry.arc=replay.samples;result.fits[i]={...replay,parts:result.fits[i].parts,shots:result.fits[i].shots,pose:entry.pose};
 }
 result.status=result.entries.every(p=>p.platform.kind==='DIRECT')?'DIRECT_VALID':'PLATFORM_VALID';
 result.reason=quick?'Lightweight preview; click triggers full sampled validation':'External contact / sampled operation validated; internal systems and loads not simulated';
 }catch(err){result.status='INVALID';result.reason=String(err);result.entries=[];result.fits=[];result.mounts=[];}
 result.elapsedMs=performance.now()-start;return result;
}
