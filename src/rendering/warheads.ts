import * as THREE from 'three';
import type {DetonationWork} from '../warheads/types';
/** Owned, batched debug resources; every segment comes from a propagated carrier. */
export function renderWarhead(work:DetonationWork){
 const root=new THREE.Group();root.name='warhead-laboratory-owned-overlay';
 const event=work.record.event,origin=new THREE.Vector3(event.worldPosition.x,event.worldPosition.y,event.worldPosition.z),forward=new THREE.Vector3(event.forwardDirection.x,event.forwardDirection.y,event.forwardDirection.z).normalize(),tip=origin.clone().addScaledVector(forward,12),side=new THREE.Vector3().crossVectors(forward,Math.abs(forward.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize(),back=tip.clone().addScaledVector(forward,-2);
 const arrow=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([origin,tip,tip,back.clone().addScaledVector(side,1),tip,back.clone().addScaledVector(side,-1)]),new THREE.LineBasicMaterial({color:0xffd797,depthTest:false}));root.add(arrow);
 const marker=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8),new THREE.MeshBasicMaterial({color:0xffdcaa,depthTest:false,wireframe:true}));marker.position.copy(origin);root.add(marker);
 const lines=new Map<number,number[]>();
 for(const p of work.carriers){const color=p.status==='UNRESOLVED'?0xdba2ff:p.status==='STOPPED'||p.status==='PROJECTILE_FAILURE'?0xff8a62:p.hitCount?0x70ecae:0x6094a6,points=[...p.trajectory,p.position],data=lines.get(color)??[];
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];data.push(a.x,a.y,a.z,b.x,b.y,b.z);}lines.set(color,data);
 }
 for(const[color,data]of lines){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));root.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.65,depthTest:false})));}
 root.renderOrder=101;return root;
}
