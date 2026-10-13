import {readFileSync,writeFileSync} from 'node:fs';
import type {ShipBlueprint,Vec3} from '../src/blueprint/types';
import type {FreeMountRequest} from '../src/free-mount/types';
import {evaluateFreeMount,nearbyAnchor} from '../src/free-mount/planner';
import {EquipmentHistory} from '../src/free-mount/store';
const summary=[];
for(const name of ['470','stacked-blocks','spinal-modules','truss-pods']){
 const before:ShipBlueprint=JSON.parse(readFileSync('qa/v1.8.5.5/'+name+'.json','utf8')),history=new EquipmentHistory(before),cases=[];
 const tryOne=(label:string,equipmentId:string,n:Vec3,hints:Vec3[],extra:Partial<FreeMountRequest>={})=>{
  const failures=[];
  for(const hint of hints)try{const anchor=nearbyAnchor(history.blueprint,hint,n,before.order.length),q:FreeMountRequest={equipmentId,anchor,headingDegrees:0,mode:'SINGLE',platforms:true,...extra},r=evaluateFreeMount(history.blueprint,q);if(r.status==='INVALID'){failures.push(r.reason);continue;}history.install(q,r);cases.push({label,request:q,status:r.status,mounts:r.entries.map(e=>({id:e.id,platform:e.platform.kind,pose:e.pose})),elapsedMs:r.elapsedMs});return true;}catch(e){failures.push(String(e));}
  cases.push({label,status:'FAILED',reasons:[...new Set(failures)].slice(0,8)});return false;
 };
 if(name==='470'){
  const q=JSON.parse(readFileSync('qa/v1.8.5.5/battery-request.json','utf8')),r=evaluateFreeMount(before,q);history.install(q,r);cases.push({label:'Mirrored 210mm battery: four per side',status:r.status,count:r.entries.length,elapsedMs:r.elapsedMs,request:q});
 }
 const l=before.order.length;
 tryOne('Central 500mm main gun','gun-500',{x:0,y:1,z:0},[.32,.2,-.32,-.2,0,.42].map(z=>({x:0,y:0,z:z*l})));
 tryOne('Side missile module','missile-medium',{x:-1,y:0,z:0},[.3,-.3,.15,-.15,0,.4].flatMap(z=>[0,-.03,.03].map(y=>({x:0,y:y*l,z:z*l}))),{mode:'MIRROR'});
 tryOne('Utility pod with external pylon','test-pod',{x:1,y:0,z:0},[.4,-.4,.28,-.28,.1,-.1].flatMap(z=>[0,.06,-.06].map(y=>({x:0,y:y*l,z:z*l}))),{platformPreference:'PYLON_BRACE'});
 if(name!=='470')tryOne('Mirrored 210mm battery','gun-210',{x:0,y:1,z:0},[.36,.2,-.25].flatMap(z=>[-.15,-.25].map(x=>({x:x*l,y:0,z:z*l}))),{mode:'BATTERY',count:3,spacing:27,mirrorBattery:true});
 writeFileSync('qa/v1.8.5.5/'+name+'-equipped.json',JSON.stringify(history.blueprint));summary.push({name,cases,count:history.blueprint.freeMountPlan!.entries.length,basePreserved:['structuralVolumes','productionDesign','weaponLayout','hardpoints','engines','mesoStructurePlan','exteriorDetailPlan'].every(k=>JSON.stringify((before as any)[k])===JSON.stringify((history.blueprint as any)[k]))});console.log(name,cases.map(c=>[c.label,c.status]),history.blueprint.freeMountPlan!.entries.length);
}
writeFileSync('qa/v1.8.5.5/scenario-results.json',JSON.stringify(summary,null,2));
