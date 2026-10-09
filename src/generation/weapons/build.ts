import type{ShipBlueprint,Hardpoint,PrefabPlacement}from'../../blueprint/types';
import type{WeaponLayout,WeaponMount}from'./types';
import{mountStandard}from'./standards';
import{weaponComposition}from'./plan';
import{armorSurfaces,resolveGroupFoundations}from'./surfaces';
import{buildWeaponAssembly}from'./equipment';
import{candidateIssues,collisionScene}from'./collision';
import{boundsOf}from'../integration/contours';
import type{ParametricPrefabAssembly}from'../functional/types';
import{validateWeaponLayout}from'./validate';

export function buildWeaponLayoutReview(source:ShipBlueprint,options:{allowIncomplete?:boolean;onTimings?:(t:{planningMs:number;resolutionMs:number;validationMs:number})=>void}={}):ShipBlueprint{
 if(source.generatorVersion!=='1.8.2'||source.weaponLayout||!source.functionalExterior||source.seed!==7||source.shipyardId!=='aegis'||source.role!=='Cruiser'||source.order.length!==300||source.architecture.grammar!=='MONOLITHIC'||source.macroDesign?.family!=='WEDGE_CITADEL')throw Error('Weapon layout review is restricted to approved Aegis Cruiser / Seed 7 Wedge');
 const start=performance.now(),b=structuredClone(source),oldIds=new Set(source.hardpoints.map(h=>h.id)),remove=new Set((b.prefabPlacements??[]).filter(p=>p.assembly?.equipmentIds.some(id=>oldIds.has(id))).map(p=>p.id));
 b.prefabPlacements=b.prefabPlacements!.filter(p=>!remove.has(p.id));b.functionalExterior!.prefabIds=b.functionalExterior!.prefabIds.filter(id=>!remove.has(id));b.functionalExterior!.replacedHardpointVisuals=[];
 b.hardpoints=[];b.generatorVersion='1.8.3';
 const plan=weaponComposition(b),surfaces=armorSurfaces(b),scene=collisionScene(b),placed:{mount:WeaponMount;assembly:ParametricPrefabAssembly}[]=[],planningEnd=performance.now();
 const layout:WeaponLayout={status:'one-ship-review',standardsVersion:'1.8.3',sourceVersion:source.generatorVersion,sourceSeed:source.seed,budget:{available:plan.available,allocated:0,countLimit:plan.countLimit,byRegion:{TOP:0,BOTTOM:0,PORT:0,STARBOARD:0}},composition:[],groups:plan.groups,mounts:[],prefabIds:[],supersededFoundationIds:source.structuralArmorPilot!.mounts.map(m=>m.hardpointId),retiredHardpointIds:[...oldIds],attempts:[],omissions:[],overallBounds:source.functionalExterior.overallBounds,validation:{issues:[],checks:[]}};
 // Timing is reported by QA outside authority JSON so same-seed serialization remains exact.
 const shifts=[0,-8,8,-16,16,-24,24];
 for(const group of plan.groups){
  const groupCost=group.members.reduce((sum,m)=>sum+mountStandard(m.size,b.order.length).cost,0);let adopted=false;
  if(layout.budget.allocated+groupCost>layout.budget.available||placed.length+group.members.length>layout.budget.countLimit){layout.omissions.push({groupId:group.id,reason:'Whole group exceeds weapon budget'});continue;}
  for(let candidate=0;candidate<shifts.length;candidate++){
   const provisional:typeof placed=[],reasons:string[]=[];
   let resolvedGroup:ReturnType<typeof resolveGroupFoundations>;
   try{resolvedGroup=resolveGroupFoundations(surfaces,group,shifts[candidate],size=>mountStandard(size,b.order.length));}
   catch(e){layout.attempts.push({groupId:group.id,candidate,longitudinalShift:shifts[candidate],accepted:false,reasons:[(e as Error).message]});continue;}
   for(const member of group.members)try{
    const standard=mountStandard(member.size,b.order.length),resolved=resolvedGroup.get(member.id)!;
    const m:WeaponMount={id:member.id,groupId:group.id,pattern:group.pattern,region:member.region,category:member.category,standard,...resolved,equipment:{prefabId:'weapon-'+member.id,bounds:resolved.foundation.bounds,localBounds:resolved.foundation.bounds,model:'NAVAL_TURRET'},firingArc:{coordinateSystem:'LOCAL_MOUNT',yawMin:member.category==='POINT_DEFENSE'?-40:-24,yawMax:member.category==='POINT_DEFENSE'?40:24,pitchMin:8,pitchMax:32,staticPitch:8,rangeMeters:80,clearanceBounds:resolved.foundation.bounds,muzzles:[],samples:[]}};
    const assembly=buildWeaponAssembly(m);reasons.push(...candidateIssues(b,m,assembly,[...placed,...provisional],scene,true));provisional.push({mount:m,assembly});
   }catch(e){reasons.push(`${member.id}: ${(e as Error).message}`);}
   if(group.symmetry==='BILATERAL')for(const q of provisional){const n=q.mount,r=provisional.find(p=>p.mount.id!==n.id&&p.mount.category===n.category&&p.mount.standard.size===n.standard.size&&Math.abs(p.mount.position.z-n.position.z)<.01&&Math.abs(p.mount.position.x+n.position.x)<.01);
    if(!r||Math.abs(r.mount.position.y-n.position.y)>.02||Math.abs(r.mount.frame.normal.x+n.frame.normal.x)>.001||Math.abs(r.mount.frame.normal.y-n.frame.normal.y)>.001||Math.abs(r.mount.frame.normal.z-n.frame.normal.z)>.001)reasons.push(`Pair ${group.id} lacks matching real mirrored surfaces`);
   }
   layout.attempts.push({groupId:group.id,candidate,longitudinalShift:shifts[candidate],accepted:reasons.length===0,reasons:[...new Set(reasons)]});
   if(!reasons.length){placed.push(...provisional);layout.budget.allocated+=groupCost;adopted=true;break;}
  }
  if(!adopted)layout.omissions.push({groupId:group.id,reason:'All coherent whole-group candidates rejected; no unpaired survivors'});
 }
 for(const{mount:m,assembly}of placed){
  const h:Hardpoint={id:m.id,type:m.category==='MISSILE'?'Missile':m.category==='POINT_DEFENSE'?'Point Defense':m.standard.size==='L'?'Large Turret':'Medium Turret',size:m.standard.size,parentId:m.contacts[0].structureId,position:m.position,normal:m.frame.normal,radius:m.standard.footprint.width/2,allowedCategories:[m.category],plannedMountId:m.id};b.hardpoints.push(h);
  const kit:PrefabPlacement={id:m.equipment.prefabId,kind:m.category==='MISSILE'?'MISSILE_BAY_HOUSING':'WEAPON_FOUNDATION',functionality:'weapon',socket:{kind:'HULL_FACE',hostId:h.parentId,position:m.position,normal:m.frame.normal},dimensions:{x:1,y:1,z:1},variant:0,assembly};
  const box=boundsOf(assembly.parts.flatMap(p=>p.solid.vertices));kit.dimensions={x:box.max.x-box.min.x,y:box.max.y-box.min.y,z:box.max.z-box.min.z};
  b.prefabPlacements!.push(kit);layout.prefabIds.push(kit.id);layout.mounts.push(m);layout.budget.byRegion[m.region]++;
 }
 for(const m of layout.mounts){let c=layout.composition.find(c=>c.size===m.standard.size&&c.category===m.category);if(!c){c={size:m.standard.size,category:m.category,count:0};layout.composition.push(c);}c.count++;}
 layout.overallBounds=boundsOf([source.functionalExterior.overallBounds.min,source.functionalExterior.overallBounds.max,...placed.flatMap(p=>p.assembly.parts.flatMap(p=>p.solid.vertices))]);
 b.functionalExterior!.overallBounds=layout.overallBounds;b.weaponLayout=layout;
 const resolutionEnd=performance.now();layout.validation=validateWeaponLayout(b);options.onTimings?.({planningMs:planningEnd-start,resolutionMs:resolutionEnd-planningEnd,validationMs:performance.now()-resolutionEnd});
 if(layout.mounts.filter(m=>m.standard.size==='L').length<2||Object.values(layout.budget.byRegion).some(n=>!n))layout.validation.issues.push('Review quality gate: two L mounts and all four regions are required; inspect recorded omissions');
 if(layout.validation.issues.length&&!options.allowIncomplete)throw Error(layout.validation.issues.join('; '));
 return b;
}
