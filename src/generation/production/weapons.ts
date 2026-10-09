import type {ShipBlueprint, Hardpoint, Vec3} from '../../blueprint/types';
import type {WeaponGroupPlan, MountRegion, MountSize, WeaponCategory, WeaponLayout, WeaponMount} from '../weapons/types';
import type {ParametricPrefabAssembly} from '../functional/types';
import {mountStandard} from '../weapons/standards';
import {armorSurfaces, resolveGroupFoundations} from '../weapons/surfaces';
import {buildWeaponAssembly} from '../weapons/equipment';
import {collisionScene, candidateIssues} from '../weapons/collision';
import {validatePattern} from '../weapons/plan';
import {boundsOf, sectionRing} from '../integration/contours';
import {emptyResources,plus,fits,weaponResources,weaponMassUnit,hostWeaponVolume,weaponHostAllocations,integratedResources,type Resources} from './doctrine';

/** Determine composition before looking for poses. Role policy changes calibre, category
 * investment and direction preferences, rather than multiplying a generic gun count. */
export function productionWeaponComposition(b: ShipBlueprint) {
 const l=b.order.length,p=b.order.priorities,d=b.designDoctrine!,profile=d.profile;
 const hosts=b.structuralVolumes.filter(v=>v.type!=='SPINE').sort((a,c)=>c.dimensions.x*c.dimensions.y*c.dimensions.z-a.dimensions.x*a.dimensions.y*a.dimensions.z);
 const centered=hosts.find(v=>Math.abs(v.position.x)<.001),candidateHost=centered??hosts.find(v=>v.position.x>0&&hosts.some(q=>Math.abs(q.position.x+v.position.x)<.01&&Math.abs(q.position.z-v.position.z)<.01));
 if(!candidateHost)throw Error('No structurally supported weapon composition candidates');
 const host=candidateHost;
 const integratedReserve=b.hardpoints.filter(h=>h.type==='Spinal').length*mountStandard('XL',l).cost;
 const reserved=b.hardpoints.filter(h=>h.type==='Spinal').reduce(n=>plus(n,integratedResources(b)),emptyResources());
 const capacity={massTonnes:Math.max(0,d.allocations.weapons.massTonnes-reserved.massTonnes),volumeM3:Math.max(0,d.allocations.weapons.volumeM3-reserved.volumeM3),surfaceM2:d.allocations.weapons.surfaceM2};
 const weights={CANNON:profile.shares.CANNON*(.35+p.firepower/65),MISSILE:profile.shares.MISSILE*(.25+p.missile/50),POINT_DEFENSE:profile.shares.POINT_DEFENSE*(.45+p.survivability/65)};
 const sum=Object.values(weights).reduce((a,c)=>a+c,0),groups:WeaponGroupPlan[]=[];
 const z0=host.position.z+host.geometry.stations[0].z,len=host.geometry.stations.at(-1)!.z-host.geometry.stations[0].z;
 function add(id:string,region:MountRegion,size:MountSize,category:WeaponCategory,f:number){
  const pair=!centered||region==='PORT'||region==='BOTTOM'||category==='MISSILE'||category==='POINT_DEFENSE';
  const ring=sectionRing(host,z0+len*f),width=(Math.max(...ring.map(p=>p.x))-Math.min(...ring.map(p=>p.x)))/2;
  const x=!centered?Math.abs(host.position.x):region==='PORT'?Math.max(1,width*.4):width*(category==='MISSILE'?.65:.38);
  const hints=pair?[-1,1].map(side=>({x:side*x,y:host.position.y,z:z0+len*f})):[{x:0,y:host.position.y,z:z0+len*f}];
  const members=hints.map((hint,i)=>({id:`${id}-${i}`,region:region==='PORT'?(i===0?'PORT' as const:'STARBOARD' as const):region,size,category,hint}));
  const group:WeaponGroupPlan={id,pattern:category==='POINT_DEFENSE'?'POINT_DEFENSE_GROUP':pair?'BILATERAL_PAIR':'CENTERLINE_SINGLE',symmetry:pair?'BILATERAL':'CENTERLINE',members};validatePattern(group);groups.push(group);
 }
 // Available physical calibre, not a length-derived count. Large alternatives remain
 // standard-size guns; a smaller replacement is a separate, reported composition.
 let main:MountSize=profile.main;
 if(main==='L'&&(p.firepower<50||p.mobility>85||host.dimensions.x<mountStandard('L',l).footprint.width*1.3||len<mountStandard('L',l).envelope.length*2))main='M';
 if(main==='M'&&(host.dimensions.x<mountStandard('M',l).footprint.width*1.2||l<100))main='S';
 if(profile.large==='conditional'&&p.firepower>=85&&p.mobility<65&&host.dimensions.x>mountStandard('L',l).footprint.width*1.3&&len>mountStandard('L',l).envelope.length*2)main='L';
 if(b.designRequirements){if(b.role==='Battleship')main='L';else if(['Cruiser','Battlecruiser'].includes(b.role)&&main==='S')main='M';}
 for(const category of ['CANNON','MISSILE','POINT_DEFENSE'] as const){
  const size:MountSize=category==='POINT_DEFENSE'?'S':category==='MISSILE'?(host.dimensions.x>mountStandard('M',l).footprint.width*2.5&&l>=130?'M':'S'):main;
  const r=weaponResources(size,category,l),share=weights[category]/sum;
  const desired=Math.min(capacity.massTonnes*share/r.massTonnes,capacity.volumeM3*share/r.volumeM3,capacity.surfaceM2*share/r.surfaceM2);
  const groupLimit=Math.min(8,Math.max(1,Math.floor(len/(mountStandard(size==='L'?'M':size,l).envelope.length*1.15))));
  const target=Math.min(groupLimit,Math.max(category==='CANNON'||category==='POINT_DEFENSE'||b.designRequirements&&b.role==='Missile Ship'?1:0,Math.round(desired/(size==='L'?1:2))));
  for(let i=0;i<target;i++){
   const region=category==='MISSILE'?(['TOP','BOTTOM','PORT'] as const)[i%3]:category==='POINT_DEFENSE'?(['PORT','BOTTOM','TOP'] as const)[i%3]:profile.regions[i%profile.regions.length];
   const chosen:MountSize=category==='CANNON'&&i>0&&size==='L'&&(region!=='TOP'||b.role!=='Battleship'&&i>1)?'M':size;
   const f=category==='POINT_DEFENSE'?[.48,.25,.80,.64,.16,.40,.72,.56][i]:category==='MISSILE'?[.60,.42,.28,.72,.18,.52,.34,.82][i]:[b.macroDesign?.family==='HAMMERHEAD'?.23:.38,.48,.48,.62,.29,.72,.18,.82][i];
   add(`${category.toLowerCase()}-${i}`,region,chosen,category,f);
  }
 }
 d.target=[];
 for(const g of groups)for(const m of g.members){let c=d.target.find(c=>c.category===m.category&&c.size===m.size);if(!c){c={category:m.category,size:m.size,count:0};d.target.push(c);}c.count++;}
 if(b.role==='Spinal Gun Ship'||b.hardpoints.some(h=>h.type==='Spinal'))d.target.push({size:'XL',category:'SPINAL',count:1});
 const available=capacity.massTonnes/weaponMassUnit(l);
 const smallest=weaponResources('S','CANNON',l),countLimit=Math.floor(Math.min(capacity.massTonnes/smallest.massTonnes,capacity.volumeM3/smallest.volumeM3,capacity.surfaceM2/smallest.surfaceM2));
 return {groups,available,integratedReserve,countLimit,capacity,reserved,weights};
}

export function generateProductionWeapons(b:ShipBlueprint) {
 const plan=productionWeaponComposition(b),surfaces=armorSurfaces(b),scene=collisionScene(b,surfaces),placed:{mount:WeaponMount;assembly:ParametricPrefabAssembly}[]=[];
 const w:WeaponLayout={status:'production',standardsVersion:'1.8.3',sourceVersion:'1.8.4',sourceSeed:b.seed,budget:{available:plan.available,integratedReserve:plan.integratedReserve,allocated:0,countLimit:plan.countLimit,byRegion:{TOP:0,BOTTOM:0,PORT:0,STARBOARD:0}},composition:[],groups:plan.groups,mounts:[],prefabIds:[],retiredHardpointIds:[],supersededFoundationIds:[],attempts:[],omissions:[],overallBounds:b.productionDesign!.overallBounds,validation:{issues:[],checks:[]}};
 const shifts=[0,-.035,.035,-.07,.07,-.12,.12].map(f=>f*b.order.length);
 type Placement=typeof placed;
 type Choice={group:WeaponGroupPlan;items:Placement;resources:Resources;cost:number;shift:number;attemptIndex:number};
 type State={items:Placement;choices:Choice[];resources:Resources;cost:number;score:number;regions:Record<MountRegion,number>};
 let states:State[]=[{items:[],choices:[],resources:emptyResources(),cost:0,score:0,regions:{TOP:0,BOTTOM:0,PORT:0,STARBOARD:0}}];
 // Interleave investment priorities; every state may omit a group, so an early
 // weapon cannot permanently prevent a more valuable later defense/launch bank.
 const groupRejections=new Map<string,string[]>();
 const ordered=[...plan.groups].sort((a,c)=>importance(c)-importance(a)||a.id.localeCompare(c.id));
 function importance(g:WeaponGroupPlan){const m=g.members[0];return (m.category==='CANNON'?plan.weights.CANNON:m.category==='MISSILE'?plan.weights.MISSILE:plan.weights.POINT_DEFENSE)+(m.size==='L'?.5:0);}
 for(const group of ordered){
  const variants=[group];
  const size=group.members[0].size;
  if(size==='L'||size==='M')variants.push({...group,members:group.members.map(m=>({...m,size:size==='L'?'M' as const:'S' as const}))});
  if(group.symmetry==='CENTERLINE'&&group.members[0].category==='CANNON'){
   const m=group.members[0],replacement= size==='L'?'M' as const:size;
   variants.push({...group,pattern:'BILATERAL_PAIR',symmetry:'BILATERAL',members:[-1,1].map((side,i)=>({...m,id:`${group.id}-${i}`,region:side<0?'PORT' as const:'STARBOARD' as const,size:replacement,hint:{...m.hint,x:side*Math.max(1,b.dimensions.width*.08)}}))});
  }
  if(group.members[0].category==='POINT_DEFENSE'){
   const host=b.structuralVolumes.filter(v=>v.type!=='SPINE'&&Math.abs(v.position.x)<.001).sort((a,c)=>c.dimensions.x*c.dimensions.y*c.dimensions.z-a.dimensions.x*a.dimensions.y*a.dimensions.z)[0];
   if(host){const z0=host.position.z+host.geometry.stations[0].z,len=host.geometry.stations.at(-1)!.z-host.geometry.stations[0].z;
    variants.push({...group,pattern:'POINT_DEFENSE_GROUP',symmetry:'CENTERLINE',members:[{...group.members[0],region:'TOP',hint:{x:0,y:host.position.y,z:z0+len*.58}}]});
   }
  }
  if(b.order.length<100&&group.members[0].category==='POINT_DEFENSE'&&group.symmetry==='BILATERAL'){
   for(const region of ['TOP','BOTTOM'] as const)variants.push({...group,members:group.members.map(m=>({...m,region}))});
  }
  if(b.order.length<100&&group.members[0].category==='POINT_DEFENSE'){
   const small=mountStandard('S',b.order.length),hosts=b.structuralVolumes.filter(v=>v.type!=='SPINE'&&v.position.x>=0&&v.dimensions.x>=small.footprint.width&&v.dimensions.z>=small.footprint.length*1.5).sort((a,c)=>c.dimensions.x*c.dimensions.y*c.dimensions.z-a.dimensions.x*a.dimensions.y*a.dimensions.z).slice(0,4);
   for(const host of hosts){const pair=Math.abs(host.position.x)>.001;if(pair&&!b.structuralVolumes.some(q=>Math.abs(q.position.x+host.position.x)<.01&&Math.abs(q.position.y-host.position.y)<.01&&Math.abs(q.position.z-host.position.z)<.01))continue;
    for(const region of ['TOP','BOTTOM'] as const){const z=host.position.z+host.geometry.stations[0].z+host.dimensions.z*(region==='TOP'?.48:.68),members=(pair?[-1,1]:[0]).map((side,i)=>({...group.members[0],id:`${group.id}-${i}`,region,hint:{x:side*Math.abs(host.position.x),y:host.position.y,z}}));
     variants.push({...group,pattern:'POINT_DEFENSE_GROUP',symmetry:pair?'BILATERAL':'CENTERLINE',members});
    }
   }
  }
  const choices:Choice[]=[];
  for(const [variantIndex,variant] of variants.entries()){
   const resources=variant.members.reduce((n,m)=>plus(n,weaponResources(m.size,m.category,b.order.length)),emptyResources());
   if(!fits({...resources,surfaceM2:0},{...plan.capacity,surfaceM2:0})){w.attempts.push({groupId:group.id,candidate:-1,longitudinalShift:0,accepted:false,variant:structuredClone(variant),selected:false,reasons:['Whole-group mass / volume reservation exceeds weapon allocation']});continue;}
   let valid=0;
   for(const[candidate,shift]of shifts.entries()){
    const next:Placement=[],reasons:string[]=[];
    try{
     const resolved=resolveGroupFoundations(surfaces,variant,shift,s=>mountStandard(s,b.order.length));
     for(const member of variant.members){const r=resolved.get(member.id)!;
      const m:WeaponMount={id:member.id,groupId:group.id,pattern:group.pattern,region:member.region,category:member.category,standard:mountStandard(member.size,b.order.length),...r,equipment:{prefabId:'weapon-'+member.id,bounds:r.foundation.bounds,localBounds:r.foundation.bounds,model:'NAVAL_TURRET'},firingArc:{coordinateSystem:'LOCAL_MOUNT',yawMin:member.category==='POINT_DEFENSE'?-40:-24,yawMax:member.category==='POINT_DEFENSE'?40:24,pitchMin:8,pitchMax:32,staticPitch:8,rangeMeters:Math.max(40,b.order.length*.27),clearanceBounds:r.foundation.bounds,muzzles:[],samples:[]}};
      if(b.structuralVolumes.some(v=>v.id===m.contacts[8].surfaceId))throw Error('Candidate center is underlayer, not final armor');
      const assembly=buildWeaponAssembly(m);reasons.push(...candidateIssues(b,m,assembly,next,scene,true));next.push({mount:m,assembly});
     }
    }catch(e){reasons.push((e as Error).message);}
    w.attempts.push({groupId:group.id,candidate:candidate+variantIndex*shifts.length,longitudinalShift:shift,accepted:!reasons.length,variant:structuredClone(variant),selected:false,reasons:[...new Set(reasons)]});
    if(!reasons.length){choices.push({group:variant,items:next,resources,cost:variant.members.reduce((n,m)=>n+mountStandard(m.size,b.order.length).cost,0),shift,attemptIndex:w.attempts.length-1});if(++valid>=2)break;}
   }
  }
  // Coarse surface sampling is an estimate, not grounds to reject a verified
  // coherent footprint between sample points. A legal candidate establishes a
  // lower bound; competing candidates still undergo exact reciprocal checks.
  for(const choice of choices)for(const region of ['TOP','BOTTOM','PORT','STARBOARD'] as MountRegion[]){
   const r=b.designDoctrine!.directions[region],area=choice.items.filter(i=>i.mount.region===region).reduce((n,i)=>n+weaponResources(i.mount.standard.size,i.mount.category,b.order.length).surfaceM2,0);
   r.verifiedCandidateM2=Math.max(r.verifiedCandidateM2,area);
   const next=Math.max(r.allocatedM2,Math.min(r.eligibleM2,area));
   const increment=next-r.allocatedM2;r.allocatedM2=next;r.remainingM2=next;
   b.designDoctrine!.allocations.weapons.surfaceM2+=increment;plan.capacity.surfaceM2+=increment;
  }
  const smallest=weaponResources('S','CANNON',b.order.length);w.budget.countLimit=Math.floor(Math.min(plan.capacity.massTonnes/smallest.massTonnes,plan.capacity.volumeM3/smallest.volumeM3,plan.capacity.surfaceM2/smallest.surfaceM2));
  const rejected=new Set<string>();
  const expanded=[...states];
  for(const state of states)for(const choice of choices){
   b.designDoctrine!.search.statesEvaluated++;
   const resources=plus(state.resources,choice.resources);
   if(!fits(resources,plan.capacity)||state.cost+choice.cost>w.budget.available||state.items.length+choice.items.length>w.budget.countLimit){rejected.add('Shared weapon mass / volume / surface or physical count allocation exhausted');continue;}
   const regions={...state.regions};let areaOK=true;
   for(const item of choice.items){const r=item.mount.region;regions[r]+=weaponResources(item.mount.standard.size,item.mount.category,b.order.length).surfaceM2;if(regions[r]>b.designDoctrine!.directions[r].allocatedM2)areaOK=false;}
   if(!areaOK){rejected.add('Directional installation surface allocation exhausted');continue;}
   const hostUsage=new Map<string,number>();
   for(const item of [...state.items,...choice.items]){const id=item.mount.contacts[8].structureId;hostUsage.set(id,(hostUsage.get(id)??0)+hostWeaponVolume(item.mount.standard.size,item.mount.category,b.order.length));}
   const blockedHost=[...hostUsage].find(([id,volume])=>volume>weaponHostAllocations(b)[id]);
   if(blockedHost){rejected.add(`Effective internal installation volume exhausted in ${blockedHost[0]}`);continue;}
   if(choice.items.some(item=>{const issues=candidateIssues(b,item.mount,item.assembly,state.items,[],false);if(issues.length){rejected.add(issues.slice(0,3).join('; '));return true;}return false;}))continue;
   const category=group.members[0].category,n=state.items.filter(i=>i.mount.category===category).length;
   const newDirections=choice.items.filter(i=>!state.items.some(q=>q.mount.region===i.mount.region)).length;
   const fidelity=choice.group.members[0].size===size?1:.68;
   const calibre=group.members[0].category==='CANNON'?Math.sqrt(mountStandard(choice.group.members[0].size,b.order.length).cost):1;
   const reward=(importance(group)*8*choice.items.length*fidelity*calibre)/(1+n*.24)+newDirections*1.4;
   expanded.push({items:[...state.items,...choice.items],choices:[...state.choices,choice],resources,cost:state.cost+choice.cost,score:state.score+reward,regions});
  }
  groupRejections.set(group.id,[...rejected]);
  // Retain distinct combinations, not several near-identical shifts of one layout.
  expanded.sort((a,c)=>mandatoryScore(c)-mandatoryScore(a)||c.score-a.score||a.cost-c.cost);
  const seen=new Set<string>();const unique=expanded.filter(s=>{const key=JSON.stringify(s.choices.map(c=>({group:c.group,shift:c.shift})));if(seen.has(key))return false;seen.add(key);return true;});
  const efficient=[...unique].sort((a,c)=>c.score/(1+c.resources.massTonnes/weaponMassUnit(b.order.length))-a.score/(1+a.resources.massTonnes/weaponMassUnit(b.order.length)));
  const leastCommitted=[...unique].sort((a,c)=>a.resources.massTonnes-c.resources.massTonnes||c.score-a.score)[0];
  // Keep score, efficiency and an uncommitted branch. Early poses cannot consume
  // every surviving state before a later mission-critical group is considered.
  states=[...new Set([...unique.slice(0,3),...efficient.slice(0,2),leastCommitted])].slice(0,b.designDoctrine!.search.beamWidth);
 }
 function mandatoryScore(state:State){
  if(!b.designRequirements)return 0;
  const ms=state.items.map(i=>i.mount),offense=ms.some(m=>m.category==='CANNON'||m.category==='MISSILE'),pd=ms.some(m=>m.category==='POINT_DEFENSE'),medium=ms.some(m=>m.category==='CANNON'&&['M','L'].includes(m.standard.size));
  if(['Frigate','Destroyer'].includes(b.role))return Number(offense)+Number(pd);
  if(b.role==='Patrol Ship')return Number(pd);
  if(b.role==='Corvette')return Number(offense);
  if(['Cruiser','Battlecruiser'].includes(b.role))return Number(medium);
  if(b.role==='Battleship')return Number(ms.some(m=>m.category==='CANNON'&&m.standard.size==='L'));
  if(b.role==='Missile Ship'){const missile=ms.filter(m=>m.category==='MISSILE').reduce((n,m)=>n+m.standard.cost,0),cannon=ms.filter(m=>m.category==='CANNON').reduce((n,m)=>n+m.standard.cost,0);return Number(missile>0)+Number(missile>0&&missile>=cannon);}
  return 0;
 }
 const best=[...states].sort((a,c)=>mandatoryScore(c)-mandatoryScore(a)||c.score-a.score||a.cost-c.cost)[0];placed.push(...best.items);w.budget.allocated=best.cost;b.designDoctrine!.search.score=best.score;
 for(const c of best.choices)w.attempts[c.attemptIndex].selected=true;
 for(const group of plan.groups){const c=best.choices.find(c=>c.group.id===group.id);
  if(!c){const attempts=w.attempts.filter(a=>a.groupId===group.id),feasible=attempts.some(a=>a.accepted);w.omissions.push({groupId:group.id,reason:feasible?`Replanned whole group: ${(groupRejections.get(group.id)??[]).slice(0,3).join('; ')||'Higher-scoring alternate groups retained'}; candidate excluded from selected feasible composition`:`No coherent whole-group candidate: ${[...new Set(attempts.flatMap(a=>a.reasons))].slice(0,4).join('; ')}; armor and standards retained`});}
  else if(JSON.stringify(c.group)!==JSON.stringify(group)){w.groups[w.groups.findIndex(g=>g.id===group.id)]=c.group;b.designDoctrine!.adjustments.push({groupId:group.id,reason:`Explicit replacement ${group.members[0].size} ${group.symmetry} ${group.members[0].region} → ${c.group.members[0].size} ${c.group.symmetry} ${c.group.members[0].region}: standard-size whole group selected for resource / footprint / clearance fit; original target retained`});}
 }
 for(const{mount:m,assembly}of placed){
  const h:Hardpoint={id:m.id,type:m.category==='MISSILE'?'Missile':m.category==='POINT_DEFENSE'?'Point Defense':m.standard.size==='L'?'Large Turret':m.standard.size==='S'?'Small Turret':'Medium Turret',size:m.standard.size,parentId:m.contacts[0].structureId,position:m.position,normal:m.frame.normal,radius:m.standard.footprint.width/2,allowedCategories:[m.category],plannedMountId:m.id};b.hardpoints.push(h);
  const box=boundsOf(assembly.parts.flatMap(p=>p.solid.vertices));b.prefabPlacements!.push({id:m.equipment.prefabId,kind:m.category==='MISSILE'?'MISSILE_BAY_HOUSING':'WEAPON_FOUNDATION',functionality:'weapon',socket:{kind:'HULL_FACE',hostId:h.parentId,position:m.position,normal:m.frame.normal},dimensions:{x:box.max.x-box.min.x,y:box.max.y-box.min.y,z:box.max.z-box.min.z},variant:0,assembly});
  w.mounts.push(m);w.prefabIds.push(m.equipment.prefabId);w.budget.byRegion[m.region]++;
  let c=w.composition.find(c=>c.size===m.standard.size&&c.category===m.category);if(!c){c={size:m.standard.size,category:m.category,count:0};w.composition.push(c);}c.count++;
 }
 for(const h of b.hardpoints.filter(h=>h.type==='Spinal')){(w.integrated??=[]).push({hardpointId:h.id,standard:mountStandard('XL',b.order.length),category:'SPINAL',reservationId:b.productionDesign!.zones.find(z=>z.equipmentId===h.id)!.id});w.composition.push({size:'XL',category:'SPINAL',count:1});}
 if(!w.mounts.length&&!b.hardpoints.some(h=>h.type==='Spinal'))throw Error('Required weapon budget has no physically installable complete group: '+w.omissions.map(o=>o.reason).join('; '));
 w.overallBounds=boundsOf([w.overallBounds.min,w.overallBounds.max,...placed.flatMap(p=>p.assembly.parts.flatMap(p=>p.solid.vertices))]);b.productionDesign!.overallBounds=w.overallBounds;b.weaponLayout=w;
}
