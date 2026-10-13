import {readFileSync,writeFileSync} from 'node:fs';
import type {ShipBlueprint} from '../src/blueprint/types';
import {evaluateFreeMount,nearbyAnchor} from '../src/free-mount/planner';
const b:ShipBlueprint=JSON.parse(readFileSync('qa/v1.8.5.5/470.json','utf8'));
const records=[];
for(const x of [-55,-80,-110,-140])for(const z of [185,150,100,60,0,-60]){
 try{const anchor=nearbyAnchor(b,{x,y:0,z},{x:0,y:1,z:0},300),q={equipmentId:'gun-210',anchor,headingDegrees:0,platforms:true,mode:'BATTERY' as const,count:4,spacing:30,mirrorBattery:true},r=evaluateFreeMount(b,q);console.log(x,z,r.status,r.reason,r.elapsedMs);records.push({x,z,request:q,status:r.status,reason:r.reason,types:r.entries.map(e=>e.platform.kind),attempts:r.attempts.slice(-3)});if(r.status!=='INVALID'){writeFileSync('qa/v1.8.5.5/battery-request.json',JSON.stringify(q));writeFileSync('qa/v1.8.5.5/probe.json',JSON.stringify(records));process.exit(0);}}catch(e){console.log(x,z,String(e));}
}
writeFileSync('qa/v1.8.5.5/probe.json',JSON.stringify(records));
