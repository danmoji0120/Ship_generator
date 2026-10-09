import type{Vec3}from'../../blueprint/types';
import type{ParametricPrefabAssembly}from'../functional/types';
import type{WeaponMount}from'./types';
import{facetedBox,annularHousing}from'../functional/geometry';
import{transformSolid,worldPoint,worldDirection,localPoint}from'./surfaces';
import{add,mul,boundsOf,unit}from'../integration/contours';
import type{PanelSolid}from'../armor/types';
export function buildWeaponAssembly(m:WeaponMount):ParametricPrefabAssembly{
 const s=m.standard,size=s.size,large=size==='L',small=size==='S',scale=s.footprint.width/(large?26:small?4.5:11.5),a:ParametricPrefabAssembly={parts:[],attachments:[],equipmentIds:[m.id],clearances:[]};
 function part(id:string,role:string,material:ParametricPrefabAssembly['parts'][number]['material'],solid:PanelSolid){const q=transformSolid(solid,m.position,m.frame);a.parts.push({id:m.id+'-'+id,role,material,solid:q,bounds:boundsOf(q.vertices)});}
 const box=(id:string,role:string,material:ParametricPrefabAssembly['parts'][number]['material'],p:Vec3,d:Vec3)=>part(id,role,material,facetedBox(mul(p,scale),mul(d,scale)));
 a.parts.push({id:m.id+'-foundation',role:'SURFACE_FOUNDATION',material:'secondary',solid:m.foundation.solid,bounds:m.foundation.bounds});
 a.attachments=m.contacts.map(c=>({kind:c.surfaceId===c.structureId?'HULL':'ARMOR',parentId:c.surfaceId,position:c.position,normal:c.normal}));
 if(m.category==='MISSILE'){
  box('body','PROTECTED_VLS_BODY','armor',{x:0,y:1.9,z:0},{x:10,y:4,z:11});
  for(const x of[-2.3,2.3])for(const z of[-3,0,3])box(`hatch-${x}-${z}`,'LAUNCH_HATCH','mount',{x,y:4,z},{x:3.5,y:.25,z:2.3});
  m.equipment.model='VLS';m.firingArc.staticPitch=90;m.firingArc.pitchMin=90;m.firingArc.pitchMax=90;m.firingArc.yawMin=0;m.firingArc.yawMax=0;
  m.firingArc.muzzles=[worldPoint(m.position,m.frame,{x:0,y:4.5*scale,z:0})];
 }else{
  const width=large?21:small?3.6:9.5,bodyHeight=large?8.5:small?2.6:5,bodyLength=large?17:small?4:9;
  part('seat','ARMORED_TRAVERSE_SEAT','mount',annularHousing(worldLocal(0,.25,0),{x:0,y:1,z:0},(large?11.8:small?2:5.3)*scale,(large?8.7:small?1.2:3.6)*scale,.65*scale,12));
  box('breech','FACETED_BREECH_HOUSING','armor',{x:0,y:bodyHeight/2+.1,z:large?1:0},{x:width,y:bodyHeight,z:bodyLength});
  if(large){
   for(const side of[-1,1])box('cheek-'+side,'HEAVY_SIDE_PROTECTION','secondary',{x:side*11.25,y:3.9,z:1.4},{x:3.7,y:6.4,z:16});
   box('rear-drive','LOCAL_MECHANISM_HOUSING','engine',{x:0,y:3.6,z:9.1},{x:9,y:4.8,z:3.4});
  }
  const pitch=m.region==='TOP'?(large?8:12):65,dir={x:0,y:Math.sin(pitch*Math.PI/180),z:-Math.cos(pitch*Math.PI/180)},length=(large?24:small?3.2:10)*scale;
  m.firingArc.staticPitch=pitch;m.firingArc.pitchMin=m.region==='TOP'?pitch:55;m.firingArc.pitchMax=m.region==='TOP'?32:82;
  const roots=(large?[-5,5]:small?[0]:[-2,2]).map(x=>mul({x,y:large?6.6:small?2:4,z:large?-5:small?-1.2:-2.4},scale));
  for(let i=0;i<roots.length;i++){
   const radius=(large?1.8:small?.45:.85)*scale,center=add(roots[i],mul(dir,length/2));
   part('shroud-'+i,'OPEN_WEAPON_SHROUD','secondary',annularHousing(center,dir,radius,radius*.58,length,10));
   part('mantlet-'+i,'REINFORCED_MANTLET','mount',annularHousing(add(roots[i],mul(dir,length*.10)),dir,radius*1.32,radius*.62,(large?2.7:small?.5:1.3)*scale,10));
  }
  m.firingArc.muzzles=roots.map(p=>worldPoint(m.position,m.frame,add(p,mul(dir,length+.1*scale))));
  m.equipment.model=small?'PD':m.region==='TOP'?'NAVAL_TURRET':'CASEMATE';
 }
 const parts=a.parts.filter(p=>p.role!=='SURFACE_FOUNDATION'),vertices=parts.flatMap(p=>p.solid.vertices);
 m.equipment.bounds=boundsOf(vertices);m.equipment.localBounds=boundsOf(vertices.map(p=>localPoint(m.position,m.frame,p)));
 m.firingArc.samples=[];
 const yaws=[m.firingArc.yawMin,(m.firingArc.yawMin+m.firingArc.yawMax)/2,m.firingArc.yawMax],pitches=[m.firingArc.pitchMin,m.firingArc.pitchMax];
 for(const muzzle of m.firingArc.muzzles)for(const yaw of new Set(yaws))for(const pitch of new Set(pitches)){
  const y=yaw*Math.PI/180,p=pitch*Math.PI/180,d=unit({x:Math.sin(y)*Math.cos(p),y:Math.sin(p),z:-Math.cos(y)*Math.cos(p)});
  m.firingArc.samples.push({yaw,pitch,origin:muzzle,direction:worldDirection(m.frame,d),clear:false});
 }
 m.firingArc.clearanceBounds=boundsOf(m.firingArc.samples.flatMap(s=>[s.origin,add(s.origin,mul(s.direction,m.firingArc.rangeMeters))]));
 return a;
 function worldLocal(x:number,y:number,z:number){return mul({x,y,z},scale);}
}
