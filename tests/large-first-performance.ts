import {readFileSync,writeFileSync} from 'node:fs';
import {addModularHardpoints} from '../src/generation/hardpoint-system/planner';
import {addModularHardpoints as legacy} from '../src/generation/hardpoint-system/legacy-planner';

 const original=JSON.parse(readFileSync('qa/v1.8.5.4.1/1.8.5.4.json','utf8'));const rows:any[]=[];
 for(let i=0;i<4;i++)for(const [version,fn] of i%2?[['new',addModularHardpoints],['old',legacy]] as const:[['old',legacy],['new',addModularHardpoints]] as const){
  const b=structuredClone(original);b.hardpoints=b.hardpoints.filter((h:any)=>h.modular.state==='OCCUPIED');for(const h of b.hardpoints)delete h.modular;delete b.modularHardpoints;
  const start=performance.now();fn(b);rows.push({iteration:i,version,planningMs:performance.now()-start,candidates:b.modularHardpoints.diagnostics.candidates,summary:b.modularHardpoints.summary});
 }
 writeFileSync('qa/v1.8.5.4.1/performance.json',JSON.stringify({environment:'Node, same machine and same 470m Seed 7 physical Blueprint; one warmup pair, three measured alternating pairs',rows},null,2));

import {generateBlueprint,DEFAULT_ORDER} from '../src/generation/generate';
const full:any[]=[];
for(let i=0;i<3;i++)for(const version of i%2?['1.8.5.4.1','1.8.5.4'] as const:['1.8.5.4','1.8.5.4.1'] as const){const t=performance.now();const b=generateBlueprint({...structuredClone(DEFAULT_ORDER),shipyardId:'aegis',role:'Battleship',length:470,hardpointDensity:'SPARSE'},7,{architecture:'MONOLITHIC',family:'WEDGE_CITADEL',version});full.push({iteration:i,version,generationMs:performance.now()-t,summary:b.modularHardpoints!.summary});}
const p=JSON.parse(readFileSync('qa/v1.8.5.4.1/performance.json','utf8'));p.fullGeneration={method:'Three alternating same Order/Seed full-generation pairs after planner warmup; no other test or browser job active',rows:full};writeFileSync('qa/v1.8.5.4.1/performance.json',JSON.stringify(p,null,2));
