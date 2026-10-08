import * as THREE from 'three';
import {mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import type{PrefabPlacement}from'../blueprint/types';
import type{shipMaterials}from'./materials';
import{panelGeometry}from'./armor';

/** World solids are Blueprint authority. Batch by material while retaining part/prefab ranges. */
export function renderFunctionalPrefabs(placements:readonly PrefabPlacement[],materials:ReturnType<typeof shipMaterials>){
  const root=new THREE.Group();
  const buckets=new Map<string,{geometry:THREE.BufferGeometry;prefabId:string;partId:string;role:string}[]>();
  for(const p of placements)for(const part of p.assembly?.parts??[]){
    const list=buckets.get(part.material)??[];list.push({geometry:panelGeometry(part.solid),prefabId:p.id,partId:part.id,role:part.role});buckets.set(part.material,list);
  }
  for(const[category,list]of buckets){
    const geometry=mergeGeometries(list.map(p=>p.geometry),false)!;let vertexStart=0;
    const ranges=list.map(p=>{const vertexCount=p.geometry.getAttribute('position').count,r={prefabId:p.prefabId,partId:p.partId,role:p.role,vertexStart,vertexCount};vertexStart+=vertexCount;return r;});
    list.forEach(p=>p.geometry.dispose());
    const mesh=new THREE.Mesh(geometry,materials[category as keyof typeof materials]);mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData.functionalParts=ranges;mesh.userData.materialCategory=category;root.add(mesh);
  }
  return root;
}
