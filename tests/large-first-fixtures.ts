import {generateBlueprint,DEFAULT_ORDER} from '../src/generation/generate';
import {writeFileSync,mkdirSync} from 'node:fs';

 mkdirSync('qa/v1.8.5.4.1',{recursive:true});
 const order={...structuredClone(DEFAULT_ORDER),shipyardId:'aegis',role:'Battleship' as const,length:470,hardpointDensity:'SPARSE' as const};
 for(const version of ['1.8.5.4','1.8.5.4.1'] as const){const start=performance.now();const b=generateBlueprint(order,7,{architecture:'MONOLITHIC',family:'WEDGE_CITADEL',version});writeFileSync(`qa/v1.8.5.4.1/${version}.json`,JSON.stringify(b));console.log(version,performance.now()-start,b.modularHardpoints?.summary, Object.keys(b.modularHardpoints!.diagnostics.rejections),new Set(b.hardpoints.flatMap(h=>h.modular?.pairId?[h.modular.pairId]:[])).size);}
