import * as THREE from 'three';
import type {ShipBlueprint} from '../blueprint/types';
import {armorSurfaces} from '../generation/weapons/surfaces';
import {panelGeometry} from '../rendering/armor';
import type {SurfaceAnchor} from './types';
/** CPU raycast proxy: exact Hull/Armor triangles, not Ghosts, equipment or debug markers. */
export function createMountPicking(b:ShipBlueprint){const group=new THREE.Group(),material=new THREE.MeshBasicMaterial({side:THREE.FrontSide});for(const s of armorSurfaces(b)){const mesh=new THREE.Mesh(panelGeometry(s.solid),material);mesh.userData.mountSurface={surfaceId:s.id,structureId:s.structureId};group.add(mesh);}return group;}
export function pickMountSurface(root:THREE.Group,ray:THREE.Raycaster,shipMatrix:THREE.Matrix4):SurfaceAnchor|undefined{
 root.matrix.copy(shipMatrix);root.matrixAutoUpdate=false;root.updateMatrixWorld(true);
 const hit=ray.intersectObjects(root.children,false)[0];if(!hit?.face)return;
 const inverse=shipMatrix.clone().invert(),position=hit.point.clone().applyMatrix4(inverse),normal=hit.face.normal.clone().normalize();
 return{...hit.object.userData.mountSurface,position:{x:position.x,y:position.y,z:position.z},normal:{x:normal.x,y:normal.y,z:normal.z},space:'SHIP_LOCAL'};
}
