import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {generateBlueprint,DEFAULT_ORDER} from '../src/generation/generate';
import {validateModularHardpoints} from '../src/generation/hardpoint-system/validate';
import {addModularHardpoints} from '../src/generation/hardpoint-system/planner';
it('checks five seed values and two affected open architectures without broad regression',()=>{
 const rows:any[]=[];
 const cases=[11,13,23,41].map(seed=>({seed,architecture:'MONOLITHIC',family:'WEDGE_CITADEL',length:300,role:'Cruiser'}));
 cases.push({seed:7,architecture:'TRUSS_POD',family:'SPLIT_FRAME',length:300,role:'Frigate'},{seed:11,architecture:'TWIN_HULL',family:'WIDE_CARRIER',length:400,role:'Frigate'});
 for(const c of cases){
  const start=performance.now();const old=generateBlueprint({...structuredClone(DEFAULT_ORDER),shipyardId:'aegis',length:c.length,role:c.role as any,hardpointDensity:'SPARSE'},c.seed,{architecture:c.architecture as any,family:c.family as any,version:'1.8.5.4'});
  const oldMs=performance.now()-start;
  const b=structuredClone(old);b.hardpoints=b.hardpoints.filter(h=>h.modular?.state==='OCCUPIED');for(const h of b.hardpoints)delete h.modular;delete b.modularHardpoints;
  const physical=JSON.stringify([b.structuralVolumes,b.productionDesign,b.weaponLayout,b.exteriorDetailPlan]);
  const now=performance.now();addModularHardpoints(b);const newPlanningMs=performance.now()-now;
  const issues=validateModularHardpoints(b);expect(issues).toEqual([]);expect(JSON.stringify([b.structuralVolumes,b.productionDesign,b.weaponLayout,b.exteriorDetailPlan])).toBe(physical);
  rows.push({...c,oldGenerationMs:oldMs,newPlanningMs,before:old.modularHardpoints!.summary,after:b.modularHardpoints!.summary,pairs:new Set(b.hardpoints.flatMap(h=>h.modular?.pairId?[h.modular.pairId]:[])).size,issues});
 }
 writeFileSync('qa/v1.8.5.4.1/samples.json',JSON.stringify(rows,null,2));
},180000);
