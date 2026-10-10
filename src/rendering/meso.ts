import type {ShipBlueprint,PrefabPlacement} from '../blueprint/types';
import type {shipMaterials} from './materials';
import {renderFunctionalPrefabs} from './functional';
/** Same five-role batching and surface shader as production armor; never an independent material program per piece. */
export function renderMesoStructures(b:ShipBlueprint,m:ReturnType<typeof shipMaterials>){
 const parts=b.mesoStructurePlan?.placements.flatMap(p=>p.parts.map(a=>({...a,material:a.materialRole==='MECHANICAL_STRUCTURE'?'engine':'secondary'})))??[];
 const packets=[{id:'meso-structures',assembly:{parts,attachments:[],equipmentIds:[],clearances:[]}}] as unknown as PrefabPlacement[];
 const root=renderFunctionalPrefabs(packets,m);root.userData.mesoStructures=true;return root;
}
