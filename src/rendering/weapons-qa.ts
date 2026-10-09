import * as THREE from 'three';
import type{ShipBlueprint}from'../blueprint/types';
import{localPoint,transformSolid,mountFrame}from'../generation/weapons/surfaces';
import{boundsOf}from'../generation/integration/contours';
export type WeaponDebug='LAYOUT'|'GROUPS'|'ARCS';
const colors={S:0xbd9ae8,M:0x70d6d1,L:0xefbd70,XL:0xe9787c};
const groupColors=[0xf2ba73,0xe18c63,0x63c2cd,0x7faaea,0xba9fe5,0x8dcca0,0xdf93b0,0xb6cb75,0x89b5b7];
export function weaponDebugBlueprint(b:ShipBlueprint){
 const c=structuredClone(b);c.engines=[];c.surfaceFeatures=[];c.prefabPlacements=c.prefabPlacements?.filter(p=>c.weaponLayout!.prefabIds.includes(p.id));return c;
}
/** Actual stored specimens, reposed without scale changes. This is a QA illustration, not a new design. */
export function sizeComparisonBlueprint(b:ShipBlueprint){
 const c=weaponDebugBlueprint(b),all=c.weaponLayout!.mounts,selected=['S','M','L'].map((size,i)=>({m:all.find(m=>m.standard.size===size&&m.region==='TOP'&&m.category!=='MISSILE')!,x:(i-1)*36}));
 c.structuralVolumes=[];c.structuralConnectors=[];c.structuralArmorPilot=undefined;c.hardpoints=[];c.weaponLayout!.mounts=[];
 const prefabs=[];
 for(const{m,x}of selected){
  const p=c.prefabPlacements!.find(p=>p.id===m.equipment.prefabId)!,oldPosition=m.position,oldFrame=m.frame,target={x,y:0,z:0},frame=mountFrame({x:0,y:1,z:0});
  for(const part of p.assembly!.parts){part.solid=transformSolid({vertices:part.solid.vertices.map(v=>localPoint(oldPosition,oldFrame,v)),indices:part.solid.indices},target,frame);part.bounds=boundsOf(part.solid.vertices);}
  m.position=target;m.frame=frame;prefabs.push(p);c.weaponLayout!.mounts.push(m);
 }
 c.prefabPlacements=prefabs;return c;
}
function label(text:string,color:number){
 if(typeof document==='undefined')return;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#152431';ctx.fillRect(0,0,512,96);ctx.strokeStyle='#'+new THREE.Color(color).getHexString();ctx.lineWidth=5;ctx.strokeRect(3,3,506,90);ctx.fillStyle='#f2f4f6';ctx.font='bold 48px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,50);
 const material=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}),sprite=new THREE.Sprite(material);sprite.scale.set(28,5.25,1);return sprite;
}
export function decorateWeaponDebug(root:THREE.Group,b:ShipBlueprint,mode:WeaponDebug){
 const w=b.weaponLayout!,idMap=new Map(w.mounts.map(m=>[m.equipment.prefabId,m]));
 const replaced=new Set<THREE.Material>();
 root.traverse(n=>{if(!(n instanceof THREE.Mesh))return;
  for(const mat of Array.isArray(n.material)?n.material:[n.material])replaced.add(mat);
  if(n.userData.functionalParts){const colorsArray:number[]=[];
   for(const range of n.userData.functionalParts){const m=idMap.get(range.prefabId),color=new THREE.Color(m?(mode==='GROUPS'?groupColors[w.groups.findIndex(g=>g.id===m.groupId)%groupColors.length]:colors[m.standard.size]):0x445562);
    for(let i=0;i<range.vertexCount;i++)colorsArray.push(color.r,color.g,color.b);
   }
   n.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colorsArray,3));n.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,metalness:.1});
  }else n.material=new THREE.MeshStandardMaterial({color:0x647989,transparent:true,opacity:.15,depthWrite:false,roughness:.9});
 });
 replaced.forEach(m=>m.dispose());
 const overlay=new THREE.Group();root.add(overlay);
 for(const m of w.mounts){
  const group=w.groups.findIndex(g=>g.id===m.groupId)+1,color=mode==='GROUPS'?groupColors[(group-1)%groupColors.length]:colors[m.standard.size],r={TOP:'T',BOTTOM:'B',PORT:'P',STARBOARD:'ST'}[m.region];
  const sprite=label(`${m.standard.size}/${r}/G${group}`,color);if(sprite){sprite.position.set(m.position.x,m.position.y,m.position.z).addScaledVector(new THREE.Vector3(m.frame.normal.x,m.frame.normal.y,m.frame.normal.z),m.standard.envelope.height+4);overlay.add(sprite);}
  if(mode==='ARCS'){
   for(const [axis,c,length]of[[m.frame.normal,0x8de0a5,20],[m.frame.forward,0x79adef,10],[m.frame.right,0xe8797e,7]]as const){
    const a=new THREE.ArrowHelper(new THREE.Vector3(axis.x,axis.y,axis.z),new THREE.Vector3(m.position.x,m.position.y,m.position.z),length,c,2,1);
    a.traverse(n=>{if(n instanceof THREE.Line||n instanceof THREE.Mesh)(n.material as THREE.Material).depthTest=false;});overlay.add(a);
   }
  }
 }
 if(mode==='ARCS'){
  const representatives=[w.mounts.find(m=>m.standard.size==='L'),w.mounts.find(m=>m.region==='BOTTOM'&&m.standard.size==='M'),w.mounts.find(m=>m.region==='PORT'&&m.standard.size==='M')].filter(Boolean);
  for(const m of representatives)for(const s of m!.firingArc.samples){
   const a=new THREE.Vector3(s.origin.x,s.origin.y,s.origin.z),end=a.clone().addScaledVector(new THREE.Vector3(s.direction.x,s.direction.y,s.direction.z),m!.firingArc.rangeMeters),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,end]),new THREE.LineDashedMaterial({color:0xf6d379,transparent:true,opacity:.7,dashSize:2,gapSize:1,depthTest:false}));line.computeLineDistances();overlay.add(line);
  }
 }
}
