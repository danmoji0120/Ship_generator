import * as THREE from 'three';
import type {ShipBlueprint} from '../../blueprint/types';
import type {PanelSolid} from '../armor/types';
import {boundsOf} from '../integration/contours';
import {connectorGroup} from '../../rendering/architecture';
/** Use the same connector loft/beam recipes as the renderer. The temporary GPU-
 * independent geometries are transformed into immutable world solids and disposed.
 * They are collision obstacles, never attachment surfaces or armor authority. */
const cache=new WeakMap<ShipBlueprint,{id:string;solid:PanelSolid;bounds:ReturnType<typeof boundsOf>}[]>();
export function mesoConnectorScene(b:ShipBlueprint){
 let solids=cache.get(b);if(solids)return solids;solids=[];const material=new THREE.MeshBasicMaterial();
 for(const c of b.structuralConnectors){const group=connectorGroup(c,material,b.order.length);group.updateMatrixWorld(true);let part=0;
  group.traverse(n=>{if(!(n instanceof THREE.Mesh))return;const g=n.geometry,p=g.getAttribute('position'),vertices=[];
   for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);vertices.push({x:v.x,y:v.y,z:v.z});}
   const indices=g.index?Array.from(g.index.array,Number):Array.from({length:p.count},(_,i)=>i),solid={vertices,indices};solids!.push({id:`structural-connector/${c.id}/${part++}`,solid,bounds:boundsOf(vertices)});g.dispose();
  });
 }
 material.dispose();cache.set(b,solids);return solids;
}
