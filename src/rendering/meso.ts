import type {ShipBlueprint,PrefabPlacement} from '../blueprint/types';
import type {shipMaterials} from './materials';
import {renderFunctionalPrefabs} from './functional';
/** Same five-role batching and surface shader as production armor; never an independent material program per piece. */
export function renderMesoStructures(b:ShipBlueprint,m:ReturnType<typeof shipMaterials>){
 const parts=b.mesoStructurePlan?.placements.flatMap(p=>p.parts.map(a=>({...a,material:a.materialRole==='MECHANICAL_STRUCTURE'?'engine':'secondary'})))??[];
 const packets=[{id:'meso-structures',assembly:{parts,attachments:[],equipmentIds:[],clearances:[]}}] as unknown as PrefabPlacement[];
 const root=renderFunctionalPrefabs(packets,m);root.userData.mesoStructures=true;return root;
}

import * as THREE from 'three';
import {worldPoint} from '../generation/weapons/surfaces';
import {detailFrame} from '../generation/details/geometry';
/** Read-only diagnostics: candidate footprints/reasons, actual axes and saved contacts. */
export function renderMesoDiagnostics(b:ShipBlueprint,junctions=false){
 const root=new THREE.Group(),v=(p:{x:number;y:number;z:number})=>new THREE.Vector3(p.x,p.y,p.z);
 const line=(points:{x:number;y:number;z:number}[],color:number,data:unknown)=>{const g=new THREE.BufferGeometry().setFromPoints(points.map(v)),l=new THREE.Line(g,new THREE.LineBasicMaterial({color,depthTest:false}));l.renderOrder=20;l.userData.mesoDiagnostic=data;root.add(l);};
 for(const z of b.mesoStructurePlan?.detectedZones??[]){if(junctions?!z.connectorId:!z.root)continue;
  const accepted=b.mesoStructurePlan!.placements.filter(p=>p.zoneId===z.id),decisions=b.mesoStructurePlan!.decisions.filter(d=>d.zoneId===z.id),frame=detailFrame(z.normal),w=z.root?.availableWidth??Math.sqrt(z.availableAreaM2),l=z.root?.availableLength??w;
  line([[-w/2,-l/2],[w/2,-l/2],[w/2,l/2],[-w/2,l/2],[-w/2,-l/2]].map(([x,y])=>worldPoint(z.hint,frame,{x,y:0,z:y})),accepted.length?0x55dd99:0xff8855,{zone:z,decisions,placements:accepted});
  line([z.hint,worldPoint(z.hint,frame,{x:0,y:Math.max(1,b.order.length*.015),z:0})],0x55bbff,{surface:z.parentSurfaceId,normal:z.normal});
  for(const p of accepted)for(const c of p.attachment.contacts)line([c.position,worldPoint(c.position,p.attachment.frame,{x:0,y:.7,z:0})],0xffff55,{placementId:p.id,contact:c,bounds:p.bounds,validation:b.mesoStructurePlan!.validation});
 }
 if(!junctions)for(const e of b.engines){const n=e.direction??{x:0,y:0,z:1},frame=detailFrame(n);line([e.position,{x:e.position.x+n.x*e.nozzleLength*2,y:e.position.y+n.y*e.nozzleLength*2,z:e.position.z+n.z*e.nozzleLength*2}],0xffdd55,{engine:e});
  // Actual stored exhaust reservation; avoid inventing a diagnostic safety envelope.
  const zone=b.productionDesign?.zones.find(z=>z.equipmentId===e.id);if(zone){const r=zone.radius;for(const axial of [0,zone.depth])line(Array.from({length:17},(_,i)=>worldPoint(zone.position,detailFrame(zone.normal),{x:r*Math.cos(i*Math.PI/8),y:axial,z:r*Math.sin(i*Math.PI/8)})),0xdd6699,{reservation:zone});}
 }
 return root;
}
