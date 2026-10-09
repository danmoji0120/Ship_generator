import type{ShipBlueprint}from'../../blueprint/types';
import type{WeaponGroupPlan,PlannedMount,MountRegion,MountSize,WeaponCategory}from'./types';
export function validatePattern(g:WeaponGroupPlan,availableFunctionalIds?:Set<string>){
 if(g.pattern==='ASYMMETRIC_FUNCTIONAL'&&(!g.reason||g.symmetry!=='FUNCTIONAL'||!g.functionalReferenceIds?.length||availableFunctionalIds&&g.functionalReferenceIds.some(id=>!availableFunctionalIds.has(id))))throw Error('Functional asymmetry requires an explicit equipment/structure reason and valid references');
 if(g.symmetry==='CENTERLINE'&&g.members.some(m=>Math.abs(m.hint.x)>1e-8))throw Error('Centerline group outside axis');
 if(g.symmetry==='BILATERAL')for(const m of g.members){
  const mirrorRegion=m.region==='PORT'?'STARBOARD':m.region==='STARBOARD'?'PORT':m.region;
  if(!g.members.some(d=>d.id!==m.id&&d.region===mirrorRegion&&d.size===m.size&&d.category===m.category&&d.hint.x===-m.hint.x&&d.hint.y===m.hint.y&&d.hint.z===m.hint.z))throw Error('Incomplete bilateral group');
 }
}
/** Whole-ship composition first. Fixed review recipe; never called by the default generator. */
export function weaponComposition(b:ShipBlueprint){
 const groups:WeaponGroupPlan[]=[],p=b.order.priorities;
 function single(id:string,z:number){groups.push({id,pattern:'CENTERLINE_SINGLE',symmetry:'CENTERLINE',members:[{id:id+'-0',region:'TOP',size:'L',category:'CANNON',hint:{x:0,y:0,z}}]});}
 function pair(id:string,pattern:WeaponGroupPlan['pattern'],region:MountRegion,size:MountSize,category:WeaponCategory,x:number,y:number,zs:number[]){
  const members:PlannedMount[]=[];for(const z of zs)for(const side of[-1,1])members.push({id:`${id}-${side}-${z}`,region:region==='PORT'?(side<0?'PORT':'STARBOARD'):region,size,category,hint:{x:side*x,y,z}});
  groups.push({id,pattern,symmetry:'BILATERAL',members});
 }
 // Aegis Cruiser doctrine: protected centerline primary weapons, secondary broadside battery.
 if(p.firepower>=65){single('primary-bow',-103);single('primary-citadel',-18);}
 else single('primary-citadel',-18);
 pair('dorsal-secondary','BILATERAL_PAIR','TOP','M','CANNON',73,0,[-58]);
 if(p.missile>=45)pair('protected-vls','BILATERAL_PAIR','TOP','M','MISSILE',74,0,[-8]);
 pair('ventral-casemates','BILATERAL_PAIR','BOTTOM','M','CANNON',40,0,[-38]);
 pair('broadside-battery','LONGITUDINAL_BATTERY','PORT','M','CANNON',0,5,[-84,-36]);
 pair('dorsal-pd','POINT_DEFENSE_GROUP','TOP','S','POINT_DEFENSE',45,0,[75]);
 pair('ventral-pd','POINT_DEFENSE_GROUP','BOTTOM','S','POINT_DEFENSE',25,0,[70]);
 pair('lateral-pd','POINT_DEFENSE_GROUP','PORT','S','POINT_DEFENSE',0,0,[24]);
 groups.forEach(g=>validatePattern(g));
 return{groups,available:Math.round(14+p.firepower*.55),countLimit:20};
}
