import {kitPartAppearance} from './appearance';
import * as THREE from 'three';
import type {ShipBlueprint,PrefabPlacement} from '../blueprint/types';
import type {DetailMode} from '../generation/details/types';
import {renderFunctionalPrefabs} from './functional';
import type {shipMaterials} from './materials';
export function renderExteriorDetails(b:ShipBlueprint,m:ReturnType<typeof shipMaterials>,mode:DetailMode='HIGH'){
 const root=new THREE.Group();root.userData.exteriorDetails=true;
 for(const lod of['MESO','MICRO'] as const){const selected=b.exteriorDetailPlan!.kitPlacements.filter(p=>p.lodClass===lod),packet={id:'exterior-detail-'+lod,assembly:{parts:selected.flatMap(p=>p.assembly.parts),attachments:[],equipmentIds:[],clearances:[]}} as unknown as PrefabPlacement;
  const overrides=new Map(selected.flatMap(p=>p.assembly.parts.map(part=>[part.id,{spec:kitPartAppearance(p.kit,part.role),frame:p.attachment.frame}] as const)));
  const group=renderFunctionalPrefabs([packet],m,overrides);group.userData.exteriorLOD=lod;group.userData.detailPlacements=selected.map(p=>({id:p.id,kit:p.kit,parent:p.parentStructureId,zoneId:p.zoneId,partIds:p.assembly.parts.map(a=>a.id)}));root.add(group);
 }
 setDetailVisibility(root,mode,Infinity);return root;
}
/** Visibility-only LOD: stored Blueprint and batched geometry are never regenerated. */
export function setDetailVisibility(root:THREE.Object3D,mode:DetailMode,projectedPixels:number){
 root.traverse(n=>{if(n.userData.exteriorLOD){n.visible=mode!=='OFF'&&(n.userData.exteriorLOD==='MESO'?(mode!=='AUTO'||projectedPixels>=90):mode==='HIGH'||(mode==='AUTO'&&projectedPixels>=650));}});
}
