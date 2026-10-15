import {Quaternion,Vector3} from 'three';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const before=await import('/tmp/physical-before.mjs'),after=await import('/tmp/physical-after.mjs'),out='qa/v1.8.6.0.1';
await mkdir(`${out}/audit`,{recursive:true});
const source=JSON.parse(await readFile('qa/v1.8.6.0/before/aegis470.json','utf8'));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const rows=[];
for(const priority of process.env.RAYS_ONLY?[]:['survivability','mobility','balanced']){
 const input=structuredClone(source);input.order.targetDryMassKg=3562847000;for(const k of Object.keys(input.order.priorities))input.order.priorities[k]=50;if(priority!=='balanced')input.order.priorities[priority]=100;
 const a=before.addPhysicalDesign(structuredClone(input)),b=after.addPhysicalDesign(structuredClone(input)),x=a.physicalDesign,y=b.physicalDesign;
 const geometry=d=>d.surfaces.map(s=>({id:s.id,kind:s.kind,materialId:s.materialId,thicknessMm:s.thicknessMm,facets:s.facets,pieces:s.pieces}));
 const choices=d=>({policy:d.policy,coverage:d.coverage,geometry:geometry(d)});
 assert.equal(hash(choices(x)),hash(choices(y)),'Policy/geometry/material/thickness must be exact');
 const layerSum=y.surfaces.reduce((n,s)=>n+s.layerStack.reduce((n,l)=>n+l.volumeM3*l.densityKgM3,0),0),scalarMass=y.mass.armorMassKg+y.mass.hullShellMassKg;
 assert.ok(Math.abs(layerSum-scalarMass)<.0001);
 const l=y.mass.ledger;assert.ok(Math.abs(l.entries.reduce((n,e)=>n+e.massKg,0)-l.mountedEstimatedDryMassKg)<.0001);
 const all=y.surfaces.flatMap(s=>s.pieces.map(p=>hash(p.solid))),duplicateExactCells=all.length-new Set(all).size;assert.equal(duplicateExactCells,0);
 rows.push({priority,geometryAndPolicySHA256:hash(choices(x)),pieces:all.length,duplicateExactCells,beforeArmorKg:x.mass.armorMassKg,afterArmorKg:y.mass.armorMassKg,armorDeltaKg:y.mass.armorMassKg-x.mass.armorMassKg,beforeHullKg:x.mass.hullShellMassKg,afterHullKg:y.mass.hullShellMassKg,hullDeltaKg:y.mass.hullShellMassKg-x.mass.hullShellMassKg,independentLayerSumKg:layerSum,scalarMassKg:scalarMass,thicknessMm:[Math.min(...y.surfaces.filter(s=>s.kind==='ARMOR').map(s=>s.thicknessMm)),Math.max(...y.surfaces.filter(s=>s.kind==='ARMOR').map(s=>s.thicknessMm))],materials:[...new Set(y.surfaces.filter(s=>s.kind==='ARMOR').map(s=>s.materialId))],ledger:l,targetKg:y.mass.targetMassKg,allocationsKg:y.policy.allocationsKg,validation:after.validatePhysicalDesign(b)});
 await writeFile(`${out}/audit/${priority}.json.gz`,gzipSync(JSON.stringify(b)));
}
if(rows.length)await writeFile(`${out}/audit/mass.json`,JSON.stringify(rows,null,2));
// Direct before/after finite-ray regression over real saved curves, boundaries and rigid poses.
const probes=[];
for(const id of ['aegis470','vesper200','forge300','spine300']){
 const b=JSON.parse(gunzipSync(await readFile(id==='spine300'?`${out}/fixtures/spine300-before.json.gz`:`qa/v1.8.6.0/after/${id}.json.gz`))),q=after.preparePhysicalQueries(b);
 const surfaces=b.physicalDesign.surfaces.filter(s=>s.pieces.length),first=surfaces.find(s=>s.kind==='ARMOR'),shell=surfaces.find(s=>s.kind==='HULL');
 const rays=[{label:'center',o:{x:0,y:b.order.length*2,z:0},d:{x:0,y:-1,z:0}}];
 for(const s of [first,shell])if(s){const p=s.pieces[0],f=s.facets[p.facetIndex],v=p.solid.vertices[0];for(const angle of [0,30,60,89.999]){const n=f.normal,base=Math.abs(n.x)<.8?{x:1,y:0,z:0}:{x:0,y:1,z:0},dot=base.x*n.x+base.y*n.y+base.z*n.z,t={x:base.x-n.x*dot,y:base.y-n.y*dot,z:base.z-n.z*dot},len=Math.hypot(t.x,t.y,t.z),r=angle*Math.PI/180,d={x:-n.x*Math.cos(r)+t.x/len*Math.sin(r),y:-n.y*Math.cos(r)+t.y/len*Math.sin(r),z:-n.z*Math.cos(r)+t.z/len*Math.sin(r)};rays.push({label:s.kind+'-edge-'+angle,o:{x:v.x-d.x*10,y:v.y-d.y*10,z:v.z-d.z*10},d});}}
 const rotation=new Quaternion(0,Math.sin(.35),0,Math.cos(.35)),translation={x:12,y:-8,z:31},worldO=new Vector3(0,b.order.length*2,0).applyQuaternion(rotation).add(new Vector3(12,-8,31)),worldD=new Vector3(0,-1,0).applyQuaternion(rotation);rays.push({label:'rotated-translated-center',o:worldO,d:worldD,transform:{position:translation,quaternion:rotation}});
 let worst=0;
 for(const ray of rays){const a=before.armorRayProbe(b,ray.o,ray.d,b.order.length*4,ray.transform),c=q.probe(ray.o,ray.d,b.order.length*4,ray.transform);assert.deepEqual(c.hits.map(h=>[h.surfaceId,h.layerId,h.materialId]),a.hits.map(h=>[h.surfaceId,h.layerId,h.materialId]),id+'/'+ray.label);for(let i=0;i<a.hits.length;i++)for(const key of ['entryDistanceM','exitDistanceM','pathLengthM','measuredNormalThicknessMm']){const error=Math.abs(a.hits[i][key]-c.hits[i][key]);worst=Math.max(worst,error);assert.ok(error<1e-4,`${id}/${ray.label}/${key}: ${error}`);}for(let i=0;i<a.hits.length;i++){for(const key of ['entryPoint','exitPoint','surfaceNormal','entryBoundaryNormal']){assert.equal(a.hits[i][key]===null,c.hits[i][key]===null);if(a.hits[i][key])for(const axis of ['x','y','z'])assert.ok(Math.abs(a.hits[i][key][axis]-c.hits[i][key][axis])<1e-6,`${id}/${ray.label}/${key}/${axis}`);}if(a.hits[i].incidenceDegrees!==null)assert.ok(Math.abs(a.hits[i].incidenceDegrees-c.hits[i].incidenceDegrees)<1e-4,`${id}/${ray.label}/incidence`);}probes.push({id,label:ray.label,hits:a.hits.length,maxNumericDifference:worst,unresolvedCrossings:c.unresolvedCrossings.length});}
}
await writeFile(`${out}/audit/rays.json`,JSON.stringify(probes,null,2));console.log('mass policies',rows.length,'rays',probes.length);
