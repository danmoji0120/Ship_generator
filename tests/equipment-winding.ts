import {readFileSync} from 'node:fs';import {fitEquipment} from '../src/equipment-preview/fitment';import {PREVIEW_EQUIPMENT} from '../src/equipment-preview/library';
const b=JSON.parse(readFileSync('qa/v1.8.5.4.2/470-baseline.json','utf8')),h=b.hardpoints.find((h:any)=>h.id==='slot-27'),r=fitEquipment(b,h,PREVIEW_EQUIPMENT[1]);
console.log(r.parts.map(p=>{let volume=0;for(let i=0;i<p.solid.indices.length;i+=3){const [a,b,c]=p.solid.indices.slice(i,i+3).map(j=>p.solid.vertices[j]);volume+=(a.x*(b.y*c.z-b.z*c.y)+a.y*(b.z*c.x-b.x*c.z)+a.z*(b.x*c.y-b.y*c.x))/6;}return {id:p.id,volume};}));
