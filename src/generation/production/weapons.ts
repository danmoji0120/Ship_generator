import type {ShipBlueprint, Hardpoint, Vec3} from '../../blueprint/types';
import type {WeaponGroupPlan, MountRegion, MountSize, WeaponCategory, WeaponLayout, WeaponMount} from '../weapons/types';
import type {ParametricPrefabAssembly} from '../functional/types';
import {mountStandard} from '../weapons/standards';
import {armorSurfaces, resolveGroupFoundations} from '../weapons/surfaces';
import {buildWeaponAssembly} from '../weapons/equipment';
import {collisionScene, candidateIssues} from '../weapons/collision';
import {validatePattern} from '../weapons/plan';
import {boundsOf, sectionRing} from '../integration/contours';
import {getShipyard} from '../../shipyards/config';
import {SeededRng} from '../../random/rng';

/** Composition and candidate hints are derived from this design's hulls, roles and budget.
 * Hints are surface-search coordinates, never installation poses or review-blueprint copies. */
export function productionWeaponComposition(b: ShipBlueprint) {
 const l=b.order.length,p=b.order.priorities,yard=getShipyard(b.shipyardId),rng=new SeededRng(b.seed^0x184beef);
 const hosts=b.structuralVolumes.filter(v=>v.type!=='SPINE').sort((a,c)=>c.dimensions.x*c.dimensions.y*c.dimensions.z-a.dimensions.x*a.dimensions.y*a.dimensions.z);
 const roleScale={'Patrol Ship':.6,Frigate:.8,Battlecruiser:1.2,Corvette:.75,Destroyer:.95,Cruiser:1,Battleship:1.4,'Missile Ship':1.15,'Spinal Gun Ship':.90}[b.role],integratedReserve=b.hardpoints.filter(h=>h.type==='Spinal').length*mountStandard('XL',l).cost;
 const groups:WeaponGroupPlan[]=[],available=Math.round(roleScale*(5+p.firepower*.45+p.missile*.10)*Math.min(1.7,l/300)),countLimit=Math.max(2,Math.min(24,Math.round(l/24)));
 const choice=.02*(rng.next()-.5);
 function add(id:string,region:MountRegion,size:MountSize,category:WeaponCategory,hints:Vec3[],bilateral:boolean) {
  const members=hints.flatMap((hint,i)=>bilateral?[-1,1].map(side=>({id:`${id}-${i}-${side}`,region:region==='PORT'?(side<0?'PORT' as const:'STARBOARD' as const):region,size,category,hint:{...hint,x:side*Math.abs(hint.x)}})):[{id:`${id}-${i}`,region,size,category,hint}]);
  const group:WeaponGroupPlan={id,pattern:category==='POINT_DEFENSE'?'POINT_DEFENSE_GROUP':hints.length>1?'LONGITUDINAL_BATTERY':bilateral?'BILATERAL_PAIR':'CENTERLINE_SINGLE',symmetry:bilateral?'BILATERAL':'CENTERLINE',members};
  validatePattern(group);groups.push(group);
 }
 const centered=hosts.find(v=>Math.abs(v.position.x)<.001);
 if(centered){
  const v=centered,z0=v.position.z+v.geometry.stations[0].z,len=v.geometry.stations.at(-1)!.z-v.geometry.stations[0].z;
  const hint=(f:number,x=0)=>({x,y:v.position.y,z:z0+len*(f+choice)});
  const large=mountStandard('L',l);
  if(l>=190&&p.firepower>=55&&v.dimensions.x>large.footprint.width*1.3&&len>large.envelope.length*2) {
   add('primary-axis','TOP','L','CANNON',[hint(b.macroDesign?.family==='HAMMERHEAD'?.23:.38)],false);
   if(l>=380&&p.firepower>=80)add('primary-aft','TOP','L','CANNON',[hint(.62)],false);
  } else if(v.dimensions.x>mountStandard('M',l).footprint.width*1.2&&len>mountStandard('M',l).footprint.length*1.5) add('primary-axis','TOP','M','CANNON',[hint(.38)],false);
  const sideSize:MountSize=v.dimensions.y>=mountStandard('M',l).footprint.width*1.3&&l>=130?'M':'S';
  add('broadside','PORT',sideSize,sideSize==='S'?'POINT_DEFENSE':'CANNON',[hint(b.macroDesign?.family==='ENGINE_DOMINANT'?.65:.48)],true);
  const width=(f:number)=>{const r=sectionRing(v,z0+len*f);return(Math.max(...r.map(p=>p.x))-Math.min(...r.map(p=>p.x)))/2;};
  if(v.dimensions.x>mountStandard('M',l).footprint.width*3&&l>=160){
   const x=width(.48)*.63;
   add('ventral-battery','BOTTOM','M','CANNON',[hint(.48,x)],true);
   if(p.missile>=45||b.role==='Missile Ship')add('protected-missiles','TOP','M','MISSILE',[hint(.60,width(.60)*.65)],true);
  }else if(v.dimensions.x>mountStandard('S',l).footprint.width*2.5)add('ventral-defense','BOTTOM','S','POINT_DEFENSE',[hint(.60,width(.60)*.4)],true);
  const pd=mountStandard('S',l);
  if(v.dimensions.x>pd.footprint.width*3){
   add('dorsal-defense','TOP','S','POINT_DEFENSE',[hint(.80,width(.80)*.55)],true);
   if(l>=180)add('lower-defense','BOTTOM','S','POINT_DEFENSE',[hint(.25,width(.25)*.38)],true);
  } else add('local-defense','TOP','S','POINT_DEFENSE',[hint(.58)],false);
  // Doctrine changes a group, rather than adding position jitter to individual weapons.
  if(yard.structure==='heavy'&&p.firepower>=80&&l>=250)add('forward-battery','PORT',sideSize,'CANNON',[hint(.29)],true);
 } else {
  // Independent hulls/pods use paired local host axes only when the structural design
  // provides genuine mirror hosts. Offset industrial hulls are not forced into symmetry.
  const seen=new Set<string>();
  for(const v of hosts){if(seen.has(v.id)||v.position.x<0)continue;
   const mate=hosts.find(q=>q.id!==v.id&&Math.abs(q.position.x+v.position.x)<.01&&Math.abs(q.position.y-v.position.y)<.01&&Math.abs(q.position.z-v.position.z)<.01&&Math.abs(q.dimensions.z-v.dimensions.z)<.01);
   if(!mate)continue;seen.add(v.id);seen.add(mate.id);
   const size:MountSize=l>=150&&v.dimensions.x>mountStandard('M',l).footprint.width*1.5?'M':'S',z=v.position.z+v.geometry.stations[0].z+v.dimensions.z*.48;
   add(`pod-${v.id}`,'TOP',size,size==='S'?'POINT_DEFENSE':p.missile>p.firepower?'MISSILE':'CANNON',[{x:v.position.x,y:v.position.y,z}],true);
   add(`pod-lower-${v.id}`,'BOTTOM','S','POINT_DEFENSE',[{x:v.position.x,y:v.position.y,z:z+v.dimensions.z*.2}],true);
  }
 }
 if(!groups.length)throw Error('No structurally supported weapon composition candidates');
 return{groups,available:Math.max(2,available-integratedReserve),integratedReserve,countLimit};
}

export function generateProductionWeapons(b:ShipBlueprint) {
 const plan=productionWeaponComposition(b),surfaces=armorSurfaces(b),scene=collisionScene(b,surfaces),placed:{mount:WeaponMount;assembly:ParametricPrefabAssembly}[]=[];
 const w:WeaponLayout={status:'production',standardsVersion:'1.8.3',sourceVersion:'1.8.4',sourceSeed:b.seed,budget:{available:plan.available,integratedReserve:plan.integratedReserve,allocated:0,countLimit:plan.countLimit,byRegion:{TOP:0,BOTTOM:0,PORT:0,STARBOARD:0}},composition:[],groups:plan.groups,mounts:[],prefabIds:[],retiredHardpointIds:[],supersededFoundationIds:[],attempts:[],omissions:[],overallBounds:b.productionDesign!.overallBounds,validation:{issues:[],checks:[]}};
 const shifts=[0,-.035,.035,-.07,.07,-.12,.12].map(f=>f*b.order.length);
 for(const group of w.groups){
  const cost=group.members.reduce((n,m)=>n+mountStandard(m.size,b.order.length).cost,0);
  if(cost+w.budget.allocated>w.budget.available||group.members.length+placed.length>w.budget.countLimit){w.omissions.push({groupId:group.id,reason:'Whole group exceeds physical weapon budget / count limit'});continue;}
  let accepted=false;
  for(const[candidate,shift]of shifts.entries()){
   const next:typeof placed=[],reasons:string[]=[];
   try{
    const resolved=resolveGroupFoundations(surfaces,group,shift,s=>mountStandard(s,b.order.length));
    for(const member of group.members){const r=resolved.get(member.id)!;
     const m:WeaponMount={id:member.id,groupId:group.id,pattern:group.pattern,region:member.region,category:member.category,standard:mountStandard(member.size,b.order.length),...r,equipment:{prefabId:'weapon-'+member.id,bounds:r.foundation.bounds,localBounds:r.foundation.bounds,model:'NAVAL_TURRET'},firingArc:{coordinateSystem:'LOCAL_MOUNT',yawMin:member.category==='POINT_DEFENSE'?-40:-24,yawMax:member.category==='POINT_DEFENSE'?40:24,pitchMin:8,pitchMax:32,staticPitch:8,rangeMeters:Math.max(40,b.order.length*.27),clearanceBounds:r.foundation.bounds,muzzles:[],samples:[]}};
     if(b.structuralVolumes.some(v=>v.id===m.contacts[8].surfaceId))throw Error('Candidate center is underlayer, not final armor');
     const assembly=buildWeaponAssembly(m);reasons.push(...candidateIssues(b,m,assembly,[...placed,...next],scene,true));next.push({mount:m,assembly});
    }
   }catch(e){reasons.push((e as Error).message);}
   w.attempts.push({groupId:group.id,candidate,longitudinalShift:shift,accepted:!reasons.length,reasons:[...new Set(reasons)]});
   if(!reasons.length){placed.push(...next);w.budget.allocated+=cost;accepted=true;break;}
  }
  if(!accepted)w.omissions.push({groupId:group.id,reason:'No coherent whole-group surface / clearance candidate; armor and standards retained'});
 }
 for(const{mount:m,assembly}of placed){
  const h:Hardpoint={id:m.id,type:m.category==='MISSILE'?'Missile':m.category==='POINT_DEFENSE'?'Point Defense':m.standard.size==='L'?'Large Turret':'Medium Turret',size:m.standard.size,parentId:m.contacts[0].structureId,position:m.position,normal:m.frame.normal,radius:m.standard.footprint.width/2,allowedCategories:[m.category],plannedMountId:m.id};b.hardpoints.push(h);
  const box=boundsOf(assembly.parts.flatMap(p=>p.solid.vertices));b.prefabPlacements!.push({id:m.equipment.prefabId,kind:m.category==='MISSILE'?'MISSILE_BAY_HOUSING':'WEAPON_FOUNDATION',functionality:'weapon',socket:{kind:'HULL_FACE',hostId:h.parentId,position:m.position,normal:m.frame.normal},dimensions:{x:box.max.x-box.min.x,y:box.max.y-box.min.y,z:box.max.z-box.min.z},variant:0,assembly});
  w.mounts.push(m);w.prefabIds.push(m.equipment.prefabId);w.budget.byRegion[m.region]++;
  let c=w.composition.find(c=>c.size===m.standard.size&&c.category===m.category);if(!c){c={size:m.standard.size,category:m.category,count:0};w.composition.push(c);}c.count++;
 }
 for(const h of b.hardpoints.filter(h=>h.type==='Spinal')){(w.integrated??=[]).push({hardpointId:h.id,standard:mountStandard('XL',b.order.length),category:'SPINAL',reservationId:b.productionDesign!.zones.find(z=>z.equipmentId===h.id)!.id});w.composition.push({size:'XL',category:'SPINAL',count:1});}
 if(!w.mounts.length&&!b.hardpoints.some(h=>h.type==='Spinal'))throw Error('Required weapon budget has no physically installable complete group');
 w.overallBounds=boundsOf([w.overallBounds.min,w.overallBounds.max,...placed.flatMap(p=>p.assembly.parts.flatMap(p=>p.solid.vertices))]);b.productionDesign!.overallBounds=w.overallBounds;b.weaponLayout=w;
}
