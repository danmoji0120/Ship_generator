import {generateBlueprint,DEFAULT_ORDER} from '../src/generation/generate';
import {readFileSync,writeFileSync} from 'node:fs';
for(const name of ['470','stacked-blocks','spinal-modules','truss-pods']){
 const old=name==='470'?null:JSON.parse(readFileSync('qa/v1.8.5.4/after/'+name+'.json','utf8'));
 const order=old?.order??{...structuredClone(DEFAULT_ORDER),role:'Battleship',length:470,hardpointDensity:'SPARSE'};
 order.hardpointRequests=[];
 const options=old?{architecture:old.architecture.grammar,family:old.macroDesign.family}:{architecture:'MONOLITHIC' as const,family:'WEDGE_CITADEL' as const};
 const start=performance.now(),b=generateBlueprint(order,7,options);writeFileSync('qa/v1.8.5.5/'+name+'.json',JSON.stringify(b));console.log(name,performance.now()-start,b.hardpoints.length,b.generatorVersion);
}
