import*as THREE from'three';
import type{DetonationWork}from'../warheads/types';
import{DynamicPositions}from'./dynamic-lines';
export type VisualQuality='LOW'|'MEDIUM'|'HIGH';
const colors=[0x6094a6,0x70ecae,0xff8a62,0xdba2ff];
const category=(p:DetonationWork['carriers'][number])=>p.status==='UNRESOLVED'?3:p.status==='STOPPED'||p.status==='PROJECTILE_FAILURE'?2:p.hitCount?1:0;
/** Persistent owned materials keep shader programs alive during an enabled laboratory session. */
export class WarheadOverlay extends THREE.Group{
 private streams=colors.map(color=>{const buffer=new DynamicPositions(),line=new THREE.LineSegments(buffer.geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.65,depthTest:false}));line.frustumCulled=false;this.add(line);return{buffer,line};});
 private arrowBuffer=new DynamicPositions();private arrow=new THREE.LineSegments(this.arrowBuffer.geometry,new THREE.LineBasicMaterial({color:0xffd797,depthTest:false}));
 private marker=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8),new THREE.MeshBasicMaterial({color:0xffdcaa,depthTest:false,wireframe:true}));private lastRecord?:DetonationWork['record'];private signature='';
 constructor(){super();this.name='warhead-laboratory-owned-overlay';this.renderOrder=101;this.add(this.arrow,this.marker);this.clearData();this.userData.updates=0;this.userData.bufferAllocations=0;}
 clearData(){this.visible=false;for(const s of this.streams)s.buffer.finish(0);this.signature='';this.lastRecord=undefined;}
 update(work:DetonationWork,quality:VisualQuality='HIGH'){
  const signature=[quality,work.diagnostics.boundaries,work.record.elapsedSeconds,work.record.status,work.carriers.length].join('/');if(this.lastRecord===work.record&&signature===this.signature)return false;this.signature=signature;this.lastRecord=work.record;this.visible=true;
  const event=work.record.event,origin=new THREE.Vector3(event.worldPosition.x,event.worldPosition.y,event.worldPosition.z),forward=new THREE.Vector3(event.forwardDirection.x,event.forwardDirection.y,event.forwardDirection.z).normalize(),tip=origin.clone().addScaledVector(forward,12),side=new THREE.Vector3().crossVectors(forward,Math.abs(forward.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize(),back=tip.clone().addScaledVector(forward,-2),arrow=[origin,tip,tip,back.clone().addScaledVector(side,1),tip,back.clone().addScaledVector(side,-1)];this.arrowBuffer.reserve(6);arrow.forEach((p,i)=>p.toArray(this.arrowBuffer.values,i*3));this.arrowBuffer.finish(6);this.marker.position.copy(origin);
  const stride=quality==='LOW'?4:quality==='MEDIUM'?2:1,counts=[0,0,0,0];for(let i=0;i<work.carriers.length;i+=stride){const p=work.carriers[i];counts[category(p)]+=p.trajectory.length*2;}
  this.streams.forEach((s,i)=>s.buffer.reserve(counts[i]));const cursor=[0,0,0,0];
  for(let i=0;i<work.carriers.length;i+=stride){const p=work.carriers[i],kind=category(p),buffer=this.streams[kind].buffer.values;for(let j=0;j<p.trajectory.length;j++){const a=p.trajectory[j],b=p.trajectory[j+1]??p.position;let k=cursor[kind]*3;buffer[k++]=a.x;buffer[k++]=a.y;buffer[k++]=a.z;buffer[k++]=b.x;buffer[k++]=b.y;buffer[k++]=b.z;cursor[kind]+=2;}}
  this.streams.forEach((s,i)=>{s.buffer.finish(cursor[i]);s.line.visible=cursor[i]>0;});this.userData.updates++;this.userData.bufferAllocations=this.streams.reduce((n,s)=>n+s.buffer.allocations,0)+this.arrowBuffer.allocations;this.userData.displayedPrimaryAndSecondaryCarriers=Math.ceil(work.carriers.length/stride);return true;
 }
}
/** Snapshot compatibility wrapper; live viewer uses a persistent WarheadOverlay. */
export function renderWarhead(work:DetonationWork,quality:VisualQuality='HIGH'){const root=new WarheadOverlay();root.update(work,quality);return root;}
