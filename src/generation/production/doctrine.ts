import type {ShipBlueprint, ShipRole} from '../../blueprint/types';
import type {MountSize, MountRegion, WeaponCategory, WeaponLayout} from '../weapons/types';
import {mountStandard} from '../weapons/standards';
import {measureMacro} from '../macro/measurement';
import {solidTriangles, cross} from '../armor/panels';
import {dot,boundsOf} from '../integration/contours';
import {armorSurfaces,resolveFoundation,REGION_NORMAL} from '../weapons/surfaces';
import {containsProductionVolume} from './surface-contact';
import {inReservedZone} from '../integration/reservations';

export type DesignSector='structure'|'propulsion'|'armor'|'endurance'|'sensor'|'weapons';
export interface Resources {massTonnes:number;volumeM3:number;surfaceM2:number}
export interface DoctrineProfile {
 goal:string; main:MountSize; large:'forbidden'|'conditional'|'preferred';
 shares:Record<'CANNON'|'MISSILE'|'POINT_DEFENSE',number>;
 regions:MountRegion[]; protection:number; mobility:number; endurance:number; sensor:number;
}
export const DOCTRINES:Record<ShipRole,DoctrineProfile>={
 Corvette:{goal:'Compact escort: light forward gun, missile strike pairs, distributed close defense',main:'S',large:'forbidden',shares:{CANNON:.36,MISSILE:.32,POINT_DEFENSE:.32},regions:['TOP','PORT','BOTTOM'],protection:.7,mobility:1.5,endurance:.8,sensor:.8},
 Frigate:{goal:'Long-range escort: medium battery, all-direction defensive screen and sensors',main:'M',large:'conditional',shares:{CANNON:.40,MISSILE:.24,POINT_DEFENSE:.36},regions:['TOP','BOTTOM','PORT'],protection:.9,mobility:1.1,endurance:1.35,sensor:1.2},
 Destroyer:{goal:'Missile escort: medium dual-purpose broadside and launch banks with close defense',main:'M',large:'conditional',shares:{CANNON:.34,MISSILE:.42,POINT_DEFENSE:.24},regions:['PORT','TOP','BOTTOM'],protection:1,mobility:1.2,endurance:1,sensor:1.2},
 Cruiser:{goal:'Independent multi-role battery: heavy dorsal primary, ventral and lateral support',main:'L',large:'preferred',shares:{CANNON:.58,MISSILE:.24,POINT_DEFENSE:.18},regions:['TOP','BOTTOM','PORT'],protection:1.1,mobility:1,endurance:1.2,sensor:1.1},
 Battlecruiser:{goal:'Fast capital strike: forward heavy battery with restrained broadside mass',main:'L',large:'preferred',shares:{CANNON:.72,MISSILE:.15,POINT_DEFENSE:.13},regions:['TOP','BOTTOM','PORT'],protection:.85,mobility:1.5,endurance:1,sensor:1},
 Battleship:{goal:'Protected capital battery: multiple heavy axes, broadside support, close defense',main:'L',large:'preferred',shares:{CANNON:.70,MISSILE:.08,POINT_DEFENSE:.22},regions:['TOP','PORT','BOTTOM'],protection:1.5,mobility:.65,endurance:1,sensor:.9},
 'Missile Ship':{goal:'Protected launch ship: distributed dorsal/ventral missile banks with defensive screen',main:'M',large:'forbidden',shares:{CANNON:.12,MISSILE:.68,POINT_DEFENSE:.20},regions:['TOP','BOTTOM','PORT'],protection:1.1,mobility:.9,endurance:1.2,sensor:1.3},
 'Spinal Gun Ship':{goal:'Axial weapon platform: integrated XL only with full envelope; defensive escorts and missiles',main:'M',large:'conditional',shares:{CANNON:.18,MISSILE:.28,POINT_DEFENSE:.54},regions:['PORT','BOTTOM','TOP'],protection:1.2,mobility:.8,endurance:1.1,sensor:1.1},
 'Patrol Ship':{goal:'Persistent surveillance: light deterrent gun, minimal missiles, defensive screen',main:'S',large:'forbidden',shares:{CANNON:.30,MISSILE:.08,POINT_DEFENSE:.62},regions:['TOP','PORT','BOTTOM'],protection:.8,mobility:1.1,endurance:1.8,sensor:1.7},
};
export interface DesignDoctrine {
 version:'1.8.4.1'; role:ShipRole; profile:DoctrineProfile;
 methodology:string; total:Resources; allocations:Record<DesignSector,Resources>;
 usage:Record<DesignSector,Resources>; remaining:Resources;
 target:WeaponLayout['composition']; actual:WeaponLayout['composition'];
 differences:{size:MountSize;category:WeaponCategory;target:number;actual:number;missing:number}[];
 adjustments:{groupId:string;reason:string}[];
 directions:Record<MountRegion,{eligibleM2:number;coherentSupportM2:number;verifiedCandidateM2:number;allocatedM2:number;usedM2:number;remainingM2:number;composition:WeaponLayout['composition']}>;
 hosts:{id:string;usableVolumeM3:number;weaponVolumeAllocationM3:number;weaponVolumeUsedM3:number;remainingWeaponVolumeM3:number;coherentSupportM2:Record<MountRegion,number>}[];
 search:{method:string;beamWidth:number;statesEvaluated:number;score:number};
 equipment:{id:string;sector:DesignSector;resources:Resources}[];
 equipmentTargets:{kind:'sensor'|'engine-protection'|'thermal'|'service';target:number;installed:number;missing:number;reasons:string[]}[];
}
export const emptyResources=():Resources=>({massTonnes:0,volumeM3:0,surfaceM2:0});
export function plus(a:Resources,b:Resources):Resources {return{massTonnes:a.massTonnes+b.massTonnes,volumeM3:a.volumeM3+b.volumeM3,surfaceM2:a.surfaceM2+b.surfaceM2};}
export function fits(a:Resources,b:Resources){return a.massTonnes<=b.massTonnes+1e-6&&a.volumeM3<=b.volumeM3+1e-6&&a.surfaceM2<=b.surfaceM2+1e-6;}
const multiply=(a:Resources,n:number):Resources=>({massTonnes:a.massTonnes*n,volumeM3:a.volumeM3*n,surfaceM2:a.surfaceM2*n});
export function weaponMassUnit(length:number){const scale=Math.max(.65,Math.min(2,Math.cbrt(length/300)));return 240*scale**3*Math.max(1,(length/40)**1.5);}
export function weaponResources(size:MountSize,category:WeaponCategory,length:number):Resources {
 const s=mountStandard(size,length);
 // Planning coefficients include ammunition, drive, cooling and maintenance access.
 // The length-dependent mass unit represents larger magazines and long-range
 // support equipment; it does not change any weapon footprint or envelope.
 return {massTonnes:s.cost*weaponMassUnit(length)*(category==='MISSILE'?1.15:1),volumeM3:s.envelope.width*s.envelope.height*s.envelope.length*(category==='MISSILE'?1.35:.85),surfaceM2:size==='XL'?0:s.footprint.width*s.footprint.length*1.25};
}
export function hostWeaponVolume(size:MountSize,category:WeaponCategory,length:number){return weaponResources(size,category,length).volumeM3*(size==='XL'?1:category==='MISSILE'?.65:category==='POINT_DEFENSE'?.12:.25);}
export function solidVolume(s:{vertices:import('../../blueprint/types').Vec3[];indices:number[]}) {return Math.abs(solidTriangles(s).reduce((n,[a,b,c])=>n+dot(a,cross(b,c))/6,0));}
export function createDesignDoctrine(b:ShipBlueprint):DesignDoctrine {
 const p=b.order.priorities,profile=structuredClone(DOCTRINES[b.role]),macro=measureMacro(b.order,b.structuralVolumes);
 const massFactor={Light:.65,Standard:1,Heavy:1.4,Superheavy:1.85}[b.order.massClass];
 const total={massTonnes:macro.approximateVolumeM3*.28*massFactor,volumeM3:macro.approximateVolumeM3*.48,surfaceM2:0};
 const weights:Record<DesignSector,number>={structure:1.1,propulsion:profile.mobility*(.6+p.mobility/55),armor:profile.protection*(.7+p.survivability/55),endurance:profile.endurance*(.45+p.endurance/55),sensor:profile.sensor*(.3+p.sensor/65),weapons:1.5+p.firepower/35+p.missile/65};
 const sum=Object.values(weights).reduce((a,c)=>a+c,0),allocations={} as DesignDoctrine['allocations'],usage={} as DesignDoctrine['usage'];
 const req=b.designRequirements;
 if(req){
  // Hard floors first, then competing targets share ONLY the finite remainder.
  for(const sector of Object.keys(weights) as DesignSector[]){
   const fraction=req.preAllocationFractions[sector];
   req.sectorFloors[sector].massTonnes=Math.max(req.sectorFloors[sector].massTonnes,total.massTonnes*fraction);
   req.sectorFloors[sector].volumeM3=Math.max(req.sectorFloors[sector].volumeM3,total.volumeM3*fraction);
  }
  const floors=Object.values(req.sectorFloors).reduce(plus,emptyResources());
  if(!fits({...floors,surfaceM2:0},total))throw Error('REQUIRED_DESIGN_BUDGET_EXCEEDED: mandatory floors exceed actual hull capacity');
  for(const sector of Object.keys(weights) as DesignSector[]){const f=req.sectorFloors[sector];allocations[sector]={massTonnes:f.massTonnes+(total.massTonnes-floors.massTonnes)*weights[sector]/sum,volumeM3:f.volumeM3+(total.volumeM3-floors.volumeM3)*weights[sector]/sum,surfaceM2:0};usage[sector]=emptyResources();}
 }else for(const key of Object.keys(weights) as DesignSector[]){allocations[key]=multiply(total,weights[key]/sum);usage[key]=emptyResources();}
 const directions=Object.fromEntries(['TOP','BOTTOM','PORT','STARBOARD'].map(r=>[r,{eligibleM2:0,coherentSupportM2:0,verifiedCandidateM2:0,allocatedM2:0,usedM2:0,remainingM2:0,composition:[]}])) as unknown as DesignDoctrine['directions'];
 const d:DesignDoctrine={version:'1.8.4.1',role:b.role,profile,total,allocations,usage,remaining:emptyResources(),target:[],actual:[],differences:[],adjustments:[],directions,hosts:Object.entries(macro.moduleVolumesM3).map(([id,v])=>({id,usableVolumeM3:v*.48,weaponVolumeAllocationM3:0,weaponVolumeUsedM3:0,remainingWeaponVolumeM3:0,coherentSupportM2:{TOP:0,BOTTOM:0,PORT:0,STARBOARD:0}})),search:{method:'bounded beam search with whole-group omission, alternate size and longitudinal pose',beamWidth:6,statesEvaluated:0,score:0},equipment:[],equipmentTargets:[],methodology:'Engineering planning model: station-integrated module volume (overlap allowance 52%), mass-class density limit, normalized competing allocations. Equipment costs include service/ammunition reserves; these are reservations, not a simulated interior. Surface capacity uses measured exposed eligible hull area capped by sampled coherent final-armor support; coherent final-armor contacts and clearance are checked for every installed group.'};
 if(Object.values(p).every(v=>v>=80))d.adjustments.push({groupId:'resources',reason:'All priorities high: normalized competing demands within unchanged finite mass and volume; no independent capacity bonuses'});
 return d;
}
/** Set after armor exists. Preserve completed armor, charge its measured geometry, and
 * reconcile any reservation overrun against weapon capacity rather than inventing space. */
export function finalizeDoctrineCapacity(b:ShipBlueprint){
 const d=b.designDoctrine!,armorVolume=[...b.productionDesign!.armor,...b.productionDesign!.finish].reduce((n,c)=>n+solidVolume(c.solid),0);
 d.usage.armor={massTonnes:armorVolume*.12,volumeM3:armorVolume*.12,surfaceM2:0};
 for(const sector of ['structure','propulsion','endurance','sensor'] as DesignSector[])d.usage[sector]={...d.allocations[sector]};
 const excess={massTonnes:Math.max(0,d.usage.armor.massTonnes-d.allocations.armor.massTonnes),volumeM3:Math.max(0,d.usage.armor.volumeM3-d.allocations.armor.volumeM3),surfaceM2:0};
 d.allocations.armor.massTonnes+=excess.massTonnes;d.allocations.armor.volumeM3+=excess.volumeM3;
 d.allocations.weapons.massTonnes=Math.max(0,d.allocations.weapons.massTonnes-excess.massTonnes);
 d.allocations.weapons.volumeM3=Math.max(0,d.allocations.weapons.volumeM3-excess.volumeM3);
 if(b.designRequirements&&!fits({...b.designRequirements.sectorFloors.weapons,surfaceM2:0},d.allocations.weapons))throw Error('REQUIRED_DESIGN_BUDGET_EXCEEDED: preserved armor would consume mandatory weapon floor');
 if(!fits(Object.values(d.usage).reduce(plus,emptyResources()),d.total))throw Error('Retained armor exceeds total design capacity');
 if(excess.massTonnes||excess.volumeM3)d.adjustments.push({groupId:'armor',reason:'Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor'});
 const hostAllocations=weaponHostAllocations(b);
 for(const h of d.hosts){h.weaponVolumeAllocationM3=hostAllocations[h.id];h.remainingWeaponVolumeM3=h.weaponVolumeAllocationM3;}
 const surfaces=armorSurfaces(b),standard=mountStandard('S',b.order.length);
 for(const host of b.structuralVolumes.filter(v=>v.type!=='SPINE')){
  const surface=surfaces.find(s=>s.id===host.id)!,box=surface.box,record=d.hosts.find(h=>h.id===host.id)!;
  for(const r of ['TOP','BOTTOM','PORT','STARBOARD'] as MountRegion[]){
   const axis=r==='TOP'||r==='BOTTOM'?'x':'y',nx=5,nz=8,cell=(box.max[axis]-box.min[axis])*(box.max.z-box.min.z)/(nx*nz);
   for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){const hint={...host.position,z:box.min.z+(iz+.5)*(box.max.z-box.min.z)/nz};hint[axis]=box.min[axis]+(ix+.5)*(box.max[axis]-box.min[axis])/nx;
    try{const f=resolveFoundation(surfaces,hint,r,standard),contact=f.contacts[8];
     if(contact.structureId===host.id&&contact.surfaceId!==host.id&&!b.productionDesign!.zones.some(z=>f.contacts.some(c=>inReservedZone(c.position,z))))record.coherentSupportM2[r]+=cell/Math.max(.65,dot(contact.normal,REGION_NORMAL[r]));
    }catch{/* A rejected coherent footprint contributes no usable area. */}
   }
  }
 }
 const mapping={TOP:'top',BOTTOM:'bottom',PORT:'left',STARBOARD:'right'} as const;
 for(const r of Object.keys(mapping) as MountRegion[]){const eligible=b.productionDesign!.coverage.directions[mapping[r]].eligibleM2;
  const fraction=Math.min(.65,Math.max(.15,d.allocations.weapons.volumeM3/d.total.volumeM3));
  const coherent=Math.min(eligible,d.hosts.reduce((n,h)=>n+h.coherentSupportM2[r],0)),allocated=Math.min(eligible*fraction,coherent*.8);
  d.directions[r]={...d.directions[r],eligibleM2:eligible,coherentSupportM2:coherent,allocatedM2:allocated,remainingM2:allocated};
  d.total.surfaceM2+=eligible;d.allocations.weapons.surfaceM2+=d.directions[r].allocatedM2;
 }
}
export function finishDesignDoctrine(b:ShipBlueprint){
 const d=b.designDoctrine!,w=b.weaponLayout!;d.actual=structuredClone(w.composition);
 const keys=[...d.target,...d.actual.filter(a=>!d.target.some(t=>t.category===a.category&&t.size===a.size))];
 d.differences=keys.map(t=>{const actual=w.composition.filter(a=>a.category===t.category&&a.size===t.size).reduce((n,a)=>n+a.count,0);const target=d.target.find(a=>a.category===t.category&&a.size===t.size)?.count??0;return {size:t.size,category:t.category,target,actual,missing:Math.max(0,target-actual)};});
 for(const m of w.mounts){const resources=weaponResources(m.standard.size,m.category,b.order.length);d.usage.weapons=plus(d.usage.weapons,resources);const r=d.directions[m.region];r.usedM2+=resources.surfaceM2;let c=r.composition.find(c=>c.category===m.category&&c.size===m.standard.size);if(!c){c={category:m.category,size:m.standard.size,count:0};r.composition.push(c);}c.count++;}
 for(const m of w.integrated??[])d.usage.weapons=plus(d.usage.weapons,integratedResources(b));
 for(const h of d.hosts){h.weaponVolumeUsedM3=w.mounts.filter(m=>m.contacts[8].structureId===h.id).reduce((n,m)=>n+hostWeaponVolume(m.standard.size,m.category,b.order.length),0)+(w.integrated??[]).filter(m=>b.hardpoints.find(q=>q.id===m.hardpointId)?.parentId===h.id).reduce(n=>n+integratedResources(b).volumeM3,0);h.remainingWeaponVolumeM3=h.weaponVolumeAllocationM3-h.weaponVolumeUsedM3;}
 d.adjustments.push(...w.omissions);
 for(const r of Object.values(d.directions))r.remainingM2=r.allocatedM2-r.usedM2;
 const used=Object.values(d.usage).reduce(plus,emptyResources());d.remaining={massTonnes:d.total.massTonnes-used.massTonnes,volumeM3:d.total.volumeM3-used.volumeM3,surfaceM2:d.allocations.weapons.surfaceM2-d.usage.weapons.surfaceM2};
 for(const p of b.prefabPlacements!.filter(p=>b.productionDesign!.functionalPrefabIds.includes(p.id))){const sector:DesignSector=p.functionality==='propulsion'?'propulsion':p.functionality==='sensor'?'sensor':'endurance',volumeM3=p.assembly!.parts.reduce((n,c)=>n+solidVolume(c.solid),0);d.equipment.push({id:p.id,sector,resources:{volumeM3,massTonnes:volumeM3*.32,surfaceM2:0}});}
 const targets=[{kind:'sensor' as const,target:1+(b.order.priorities.sensor>=65?2:0),ids:d.equipment.filter(e=>e.sector==='sensor').map(e=>e.id)},
  {kind:'engine-protection' as const,target:b.engines.length,ids:d.equipment.filter(e=>e.sector==='propulsion').map(e=>e.id)},
  {kind:'thermal' as const,target:b.order.priorities.endurance>=45?2:0,ids:d.equipment.filter(e=>e.id.startsWith('thermal-')).map(e=>e.id)},
  {kind:'service' as const,target:b.order.priorities.endurance>=20?Math.min(b.productionDesign!.channels.length,Math.ceil(b.order.priorities.endurance/50)):0,ids:d.equipment.filter(e=>e.id.startsWith('service-')).map(e=>e.id)}];
 const omissions=b.productionDesign!.decisions.filter(a=>a.stage==='functional'&&a.status==='omitted');
 for(const a of omissions)if(!d.adjustments.some(q=>q.groupId===a.sourceId&&q.reason===a.reason))d.adjustments.push({groupId:a.sourceId,reason:a.reason});
 d.equipmentTargets=targets.map(t=>{const prefix=t.kind==='sensor'?'sensor-':t.kind==='engine-protection'?'casing-':t.kind==='thermal'?'thermal-':'service-';const reasons=omissions.filter(a=>a.sourceId.startsWith(prefix)||t.kind==='sensor'&&a.sourceId==='command-house').map(a=>a.reason),missing=Math.max(0,t.target-t.ids.length);
  if(missing&&!reasons.length)reasons.push('No eligible attachment candidate in retained macro; internal equipment reservation retained');
  return {kind:t.kind,target:t.target,installed:t.ids.length,missing,reasons:[...new Set(reasons)]};
 });
}

export function prepareIntegratedArmament(b:ShipBlueprint){
 const d=b.designDoctrine!,standard=mountStandard('XL',b.order.length),cost=integratedResources(b);
 if(b.role==='Spinal Gun Ship'&&!b.hardpoints.some(h=>h.type==='Spinal'))d.adjustments.push({groupId:'integrated-spinal',reason:'XL omitted: macro supplies no integrated axial host / muzzle opening; unchanged hull retained and defensive surface weapons planned'});
 const priorSpinals=new Set(b.hardpoints.filter(h=>h.type==='Spinal').map(h=>h.id));
 b.hardpoints=b.hardpoints.filter(h=>{
  if(h.type!=='Spinal')return true;
  const host=b.structuralVolumes.find(v=>v.id===h.parentId)!;
  const stations=host.geometry.stations.filter(s=>s.z<=host.geometry.stations[0].z+standard.envelope.length);
  const zProbes=[h.position.z,h.position.z+standard.envelope.length,...stations.map(s=>host.position.z+s.z)];
  const fullSize=host.dimensions.z>=standard.envelope.length&&stations.every(s=>s.width>=standard.envelope.width&&s.height>=standard.envelope.height)&&zProbes.every(z=>[-1,1].every(x=>[-1,1].every(y=>containsProductionVolume(host,{x:host.position.x+x*standard.envelope.width/2,y:host.position.y+y*standard.envelope.height/2,z},b.order.length*.00001))));
  const hostCapacity=b.designRequirements?weaponHostAllocations(b)[host.id]:(d.hosts.find(v=>v.id===host.id)?.usableVolumeM3??0)*d.allocations.weapons.volumeM3/d.total.volumeM3;
  const allowed=d.profile.large!=='forbidden'&&fits(cost,d.allocations.weapons)&&cost.volumeM3<=hostCapacity;
  if(fullSize&&allowed)return true;
  if(b.designRequirements?.spinal)throw Error(!fullSize?'REQUIRED_XL_STRUCTURE_UNSUPPORTED: unchanged envelope does not fit planned host':'REQUIRED_DESIGN_BUDGET_EXCEEDED: required XL allocation cannot fit');
  d.adjustments.push({groupId:h.id,reason:`XL omitted: ${!fullSize?'actual axial host cannot contain unchanged XL envelope':'doctrine / competing mass and volume allocation excludes integrated XL'}; legacy macro and muzzle geometry retained, no scaled-down XL installed`});return false;
 });
 if(b.hullIntegration){const retained=new Set(b.hardpoints.map(h=>h.id));b.hullIntegration.reservedZones=b.hullIntegration.reservedZones.flatMap(z=>{
  if(!priorSpinals.has(z.equipmentId)||retained.has(z.equipmentId))return [z];
  const muzzle=b.prefabPlacements?.find(p=>p.kind==='SPINAL_MUZZLE'&&p.exterior?.equipmentZoneId===z.id);
  // Preserve the physical muzzle opening even when its weapon cannot be fitted.
  // Its owner becomes the existing exterior housing, not a nonexistent gun.
  return muzzle?[{...z,equipmentId:muzzle.id,kind:'machinery' as const}]:[];
 });}

}

/** Independent accounting over authoritative mounts/solids; optional for old exports. */
export function validateDesignDoctrine(b:ShipBlueprint){
 const d=b.designDoctrine;if(!d)return [];
 const issues:string[]=[],w=b.weaponLayout;
 if(!w||d.role!==b.role||d.version!=='1.8.4.1')return ['Invalid design doctrine ownership'];
 const near=(a:number,c:number)=>Math.abs(a-c)<=Math.max(1e-5,Math.abs(a)*1e-8);
 const equal=(a:Resources,c:Resources)=>Object.keys(a).every(k=>near(a[k as keyof Resources],c[k as keyof Resources]));
 const resources=w.mounts.reduce((n,m)=>plus(n,weaponResources(m.standard.size,m.category,b.order.length)),(w.integrated??[]).reduce(n=>plus(n,integratedResources(b)),emptyResources()));
 if(!equal(resources,d.usage.weapons)||!fits(resources,d.allocations.weapons))issues.push('Doctrine weapon resources mismatch / overrun');
 const used=Object.values(d.usage).reduce(plus,emptyResources()),allocated=Object.values(d.allocations).reduce(plus,emptyResources());
 if(!fits(used,d.total)||!fits(allocated,d.total)||!near(d.remaining.massTonnes,d.total.massTonnes-used.massTonnes)||!near(d.remaining.volumeM3,d.total.volumeM3-used.volumeM3))issues.push('Doctrine finite resource budget / remaining mismatch');
 const fresh=createDesignDoctrine({...b,designRequirements:b.designRequirements?structuredClone(b.designRequirements):undefined});
 if(!near(fresh.total.massTonnes,d.total.massTonnes)||!near(fresh.total.volumeM3,d.total.volumeM3)||JSON.stringify(fresh.profile)!==JSON.stringify(d.profile))issues.push('Doctrine order / mass-class capacity mismatch');
 const armorVolume=[...b.productionDesign!.armor,...b.productionDesign!.finish].reduce((n,c)=>n+solidVolume(c.solid),0);
 if(!equal(d.usage.armor,{massTonnes:armorVolume*.12,volumeM3:armorVolume*.12,surfaceM2:0}))issues.push('Doctrine measured armor charge mismatch');
 for(const sector of ['structure','propulsion','endurance','sensor'] as DesignSector[]){if(!equal(d.usage[sector],d.allocations[sector])||!near(d.allocations[sector].massTonnes,fresh.allocations[sector].massTonnes)||!near(d.allocations[sector].volumeM3,fresh.allocations[sector].volumeM3))issues.push(`Doctrine competing allocation mismatch ${sector}`);}
 if(JSON.stringify(d.actual)!==JSON.stringify(w.composition))issues.push('Doctrine actual composition mismatch');
 for(const [region,r] of Object.entries(d.directions)){
  const mounts=w.mounts.filter(m=>m.region===region),usedM2=mounts.reduce((n,m)=>n+weaponResources(m.standard.size,m.category,b.order.length).surfaceM2,0);
  if(r.composition.reduce((n,c)=>n+c.count,0)!==mounts.length||r.composition.some(c=>mounts.filter(m=>m.category===c.category&&m.standard.size===c.size).length!==c.count))issues.push(`Doctrine regional composition mismatch ${region}`);
  if(!near(usedM2,r.usedM2)||!near(r.remainingM2,r.allocatedM2-r.usedM2)||r.usedM2>r.allocatedM2+1e-5||r.allocatedM2>r.eligibleM2+1e-5||r.allocatedM2>Math.max(r.coherentSupportM2,r.verifiedCandidateM2)+1e-5)issues.push(`Doctrine regional surface mismatch ${region}`);
 }
 for(const h of d.hosts){const volume=w.mounts.filter(m=>m.contacts[8].structureId===h.id).reduce((n,m)=>n+hostWeaponVolume(m.standard.size,m.category,b.order.length),0)+(w.integrated??[]).filter(m=>b.hardpoints.find(q=>q.id===m.hardpointId)?.parentId===h.id).reduce(n=>n+integratedResources(b).volumeM3,0);
  if(!near(volume,h.weaponVolumeUsedM3)||!near(h.remainingWeaponVolumeM3,h.weaponVolumeAllocationM3-volume))issues.push(`Doctrine host space record mismatch ${h.id}`);
  if(volume>weaponHostAllocations(b)[h.id]+1e-5)issues.push(`Doctrine host volume overrun ${h.id}`);
 }
 const functionalIds=b.productionDesign!.functionalPrefabIds;
 if(d.equipment.length!==functionalIds.length||new Set(d.equipment.map(e=>e.id)).size!==functionalIds.length)issues.push('Doctrine equipment ledger IDs mismatch');
 for(const e of d.equipment){const p=b.prefabPlacements?.find(p=>p.id===e.id);if(!p?.assembly||!functionalIds.includes(e.id)){issues.push(`Doctrine equipment reference mismatch ${e.id}`);continue;}
  const sector=p.functionality==='propulsion'?'propulsion':p.functionality==='sensor'?'sensor':'endurance',volumeM3=p.assembly.parts.reduce((n,c)=>n+solidVolume(c.solid),0);
  if(e.sector!==sector||!equal(e.resources,{massTonnes:volumeM3*.32,volumeM3,surfaceM2:0}))issues.push(`Doctrine measured equipment cost mismatch ${e.id}`);
 }
 for(const sector of ['propulsion','sensor','endurance'] as DesignSector[])if(!fits(d.equipment.filter(e=>e.sector===sector).reduce((n,e)=>plus(n,e.resources),emptyResources()),d.allocations[sector]))issues.push(`Doctrine equipment reservation overrun ${sector}`);
 const targetCounts={sensor:1+(b.order.priorities.sensor>=65?2:0),'engine-protection':b.engines.length,thermal:b.order.priorities.endurance>=45?2:0,service:b.order.priorities.endurance>=20?Math.min(b.productionDesign!.channels.length,Math.ceil(b.order.priorities.endurance/50)):0};
 for(const t of d.equipmentTargets??[]){const actual=d.equipment.filter(e=>t.kind==='sensor'?e.sector==='sensor':t.kind==='engine-protection'?e.sector==='propulsion':e.id.startsWith(t.kind==='thermal'?'thermal-':'service-')).length;
  if(t.target!==targetCounts[t.kind]||t.installed!==actual||t.missing!==Math.max(0,t.target-actual))issues.push(`Doctrine equipment target / actual mismatch ${t.kind}`);
 }
 return issues;
}

/** A required integrated host receives its floor; remaining host space shares only the residual. */
export function weaponHostAllocations(b:ShipBlueprint):Record<string,number>{
 const d=b.designDoctrine!,hostId=b.designRequirements?.spinal?.hostId;
 if(!b.designRequirements)return Object.fromEntries(d.hosts.map(h=>[h.id,h.usableVolumeM3*d.allocations.weapons.volumeM3/d.total.volumeM3]));
 const floor=hostId?integratedResources(b).volumeM3:0;
 const host=d.hosts.find(h=>h.id===hostId);
 if(hostId&&(!host||floor>host.usableVolumeM3||floor>d.allocations.weapons.volumeM3))throw Error('REQUIRED_DESIGN_BUDGET_EXCEEDED: integrated host internal volume floor exceeds capacity');
 const residual=d.allocations.weapons.volumeM3-floor,capacity=d.hosts.reduce((n,h)=>n+h.usableVolumeM3,0)-floor;
 return Object.fromEntries(d.hosts.map(h=>[h.id,(h.id===hostId?floor:0)+Math.max(0,h.usableVolumeM3-(h.id===hostId?floor:0))*residual/capacity]));
}

export function integratedResources(b:ShipBlueprint):Resources{const r=weaponResources('XL','SPINAL',b.order.length);if(b.designRequirements?.spinal){const s=mountStandard('XL',b.order.length);r.volumeM3=s.envelope.width*s.envelope.height*s.envelope.length;}return r;}
