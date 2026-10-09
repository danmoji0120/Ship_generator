import {tagSurfaceFinish} from './textured-surface';
import {functionalPartAppearance,type SurfaceAppearance} from './appearance';
import {tagAppearance} from './surface-appearance';
import type {MountFrame} from '../generation/weapons/types';
import * as THREE from 'three';
import {mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
import type{PrefabPlacement}from'../blueprint/types';
import type{shipMaterials}from'./materials';
import{panelGeometry}from'./armor';

/** World solids are Blueprint authority. Batch by material while retaining part/prefab ranges. */
export function renderFunctionalPrefabs(placements:readonly PrefabPlacement[],materials:ReturnType<typeof shipMaterials>,overrides?:Map<string,{spec:SurfaceAppearance;frame:MountFrame}>){
  const root=new THREE.Group();
  const buckets=new Map<string,{geometry:THREE.BufferGeometry;prefabId:string;partId:string;role:string}[]>();
  for(const p of placements)for(const part of p.assembly?.parts??[]){
    const geometry=panelGeometry(part.solid),modern=Boolean(materials.hull.userData.appearance),override=overrides?.get(part.id),spec=override?.spec??functionalPartAppearance(part.role,part.material),category=modern?spec.material:part.material;
    if(modern)tagAppearance(geometry,spec,p.socket?.normal,override?.frame);
    const finish=materials.hull.userData.surfaceAppearance;if(finish)tagSurfaceFinish(geometry,finish,part.id);
    const list=buckets.get(category)??[];list.push({geometry,prefabId:p.id,partId:part.id,role:part.role});buckets.set(category,list);
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
