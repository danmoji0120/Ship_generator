import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {planEquipmentPreview} from '../src/equipment-preview/fitment';
const b=JSON.parse(readFileSync('qa/v1.8.5.4.2/470-baseline.json','utf8'));
for(const equipmentId of ['gun-210','missile-medium']){const slot=b.hardpoints.find((h:any)=>h.modular?.state==='EMPTY'&&h.size==='M'&&h.modular.region==='TOP');const p=planEquipmentPreview(b,{equipmentId,scope:'SINGLE',slotId:slot.id});console.log(slot.id,equipmentId,p.elapsedMs,p.results.map(r=>({status:r.status,reasons:r.reasons,clear:r.samples.filter(s=>s.clear).length})));}
const p=planEquipmentPreview(b,{equipmentId:'gun-210',scope:'AUTO'});mkdirSync('qa/v1.8.5.4.2',{recursive:true});writeFileSync('qa/v1.8.5.4.2/probe.json',JSON.stringify(p.results.map(({parts,shots,contacts,...r})=>({...r,partCount:parts.length,contactCount:contacts.length})),null,2));console.log('AUTO',p.elapsedMs,p.results.reduce((c:any,r)=>(c[r.status]=(c[r.status]??0)+1,c),{}));
