import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import {createShip,disposeShip} from '../src/rendering/ship';
const failures:unknown[]=[];
const files=readdirSync('qa/v1.8.1/blueprints').filter(f=>f.endsWith('.json.gz'));
for(const [i,file]of files.entries()){
 const b=JSON.parse(gunzipSync(readFileSync('qa/v1.8.1/blueprints/'+file)).toString());
 const root=createShip(b,'Normal'),box=new THREE.Box3().setFromObject(root),bound=b.layeredArmor.overallBounds;
 for(const k of ['x','y','z']as const)if(box.min[k]<bound.min[k]-.001||box.max[k]>bound.max[k]+.001)failures.push({file,axis:k,actual:[box.min[k],box.max[k]],cached:[bound.min[k],bound.max[k]]});
 disposeShip(root);if(i%10===9)await new Promise(r=>setTimeout(r,0));
}
writeFileSync('qa/v1.8.1/regression/render-bounds.json',JSON.stringify({count:files.length,failures},null,2));
console.log('Actual renderer bounds',files.length,'failures',failures.length);if(failures.length)process.exitCode=1;
