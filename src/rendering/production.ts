import type{ShipBlueprint,PrefabPlacement}from'../blueprint/types';
import{renderFunctionalPrefabs}from'./functional';
import type{shipMaterials}from'./materials';
export function renderProductionArmor(b:ShipBlueprint,m:ReturnType<typeof shipMaterials>){
 const d=b.productionDesign!,parts=[...d.armor.map(c=>({id:c.id,role:c.role,material:c.role==='SIDE_BELT'?'secondary' as const:'armor' as const,solid:c.solid,bounds:c.bounds})),...d.finish.map(c=>({id:c.id,role:'BROAD_FINISH',material:'hull' as const,solid:c.solid,bounds:c.bounds}))];
 const packet={id:'production-armor',assembly:{parts,attachments:[],equipmentIds:[],clearances:[]}} as unknown as PrefabPlacement;
 const root=renderFunctionalPrefabs([packet],m);root.userData.productionArmor=true;return root;
}
