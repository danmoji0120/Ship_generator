import * as THREE from 'three';
import type{DamageInstance,ProjectileState,TargetMotion}from'../damage/types';
import {worldPoint}from'../damage/flight';
import type{Vec3}from'../blueprint/types';
const vec=(p:Vec3)=>new THREE.Vector3(p.x,p.y,p.z);
export function renderDamage(state:DamageInstance,p:ProjectileState|undefined,motion:TargetMotion){
 const root=new THREE.Group();root.name='damage-laboratory-owned-overlay';
 const line=(points:Vec3[],color:number)=>{if(points.length<2)return;root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(vec)),new THREE.LineBasicMaterial({color,depthTest:false})));};
 if(p){line(p.trajectory,0xffdb6c);const bullet=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.08,p.spec.penetratorDiameterMm/1500),8,6),new THREE.MeshBasicMaterial({color:0xffffd0,depthTest:false}));bullet.position.copy(vec(p.position));root.add(bullet);}
 for(const d of state.local.slice(-128)){
  const color=d.kind==='HULL'?0x5ce5ff:d.kind==='EQUIPMENT'?0xff4774:d.kind==='FRAME'?0xb38aff:0xffa14a,point=worldPoint(motion,d.position,state.time),normal=vec(d.normal).applyQuaternion(new THREE.Quaternion(motion.quaternion.x,motion.quaternion.y,motion.quaternion.z,motion.quaternion.w));
  const ring=new THREE.Mesh(new THREE.RingGeometry(Math.max(.03,d.radiusM*.55),Math.max(.08,d.radiusM*1.6),20),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.85}));ring.position.copy(vec(point));ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal.normalize());root.add(ring);
  if(d.channel)line([worldPoint(motion,d.channel.entry,state.time),worldPoint(motion,d.channel.exit,state.time)],0x7efac7);
 }
 for(const e of state.events.filter(e=>!p||e.shotId===p.shotId).slice(-64)){
  const point=worldPoint(motion,e.localPosition,state.time),marker=new THREE.Mesh(new THREE.SphereGeometry(e.outcome==='PENETRATED'?.13:.24,8,6),new THREE.MeshBasicMaterial({color:e.outcome==='UNRESOLVED'?0xe79bff:e.outcome==='PENETRATED'?0x74ffc5:0xff625c,depthTest:false}));marker.position.copy(vec(point));root.add(marker);
 }
 root.renderOrder=100;return root;
}
