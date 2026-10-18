import*as THREE from'three';
/** Owned reusable attribute storage. Changing a draw range never changes physical data. */
export class DynamicPositions{
 geometry=new THREE.BufferGeometry();capacity=0;allocations=0;values=new Float32Array(0);
 reserve(vertices:number){if(vertices<=this.capacity)return;let size=Math.max(64,this.capacity);while(size<vertices)size*=2;if(this.capacity)this.geometry.dispose();this.capacity=size;this.values=new Float32Array(size*3);this.geometry.setAttribute('position',new THREE.BufferAttribute(this.values,3).setUsage(THREE.DynamicDrawUsage));this.allocations++;}
 finish(vertices:number){this.geometry.setDrawRange(0,vertices);const a=this.geometry.getAttribute('position')as THREE.BufferAttribute;if(a){a.clearUpdateRanges();if(vertices)a.addUpdateRange(0,vertices*3);a.needsUpdate=true;}this.geometry.boundingSphere=null;}
}
