import {planEquipmentPreview} from '../src/equipment-preview/fitment';
import {readFileSync} from 'node:fs';import {surfaceSlot,slotEnvironment,slotPhysicalIssues} from '../src/generation/hardpoint-system/planner';import {boxesOverlap} from '../src/generation/hardpoint-system/geometry';
const b=JSON.parse(readFileSync('qa/v1.8.5.4.2/470-baseline.json','utf8')),env=slotEnvironment(b);
for(const z of[130,138,145,155,178,185,210])try{
 const r=surfaceSlot(b,{x:-53.1,y:40,z},'TOP','M',env);console.log(z,r.position,slotPhysicalIssues(b,r.slot,env),b.hardpoints.filter((h:any)=>h.modular?.state==='EMPTY'&&boxesOverlap(h.modular.envelope,r.slot.envelope)).map((h:any)=>h.id));
}catch(e){console.log(z,String(e));}

const p=planEquipmentPreview(b,{scope:'BATTERY',slotId:'slot-54',equipmentId:'gun-210',refineBattery:true});console.log('REFINEMENT',p.elapsedMs,p.batteryRefinement,p.results.map(r=>[r.slotId,r.status,r.pose]));
