import {createHash} from 'node:crypto';
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Quaternion,Vector3,Euler} from 'three';
import type {ShipBlueprint,Vec3} from '../src/blueprint/types';
import {analyzeConnectivity,analyzeStructuralInstance} from '../src/structure/graph';
import {createStructuralInstanceState,type StructuralNode,type StructuralEdge} from '../src/structure/types';
import {beamSolid,exclusiveMaterial,convexParts} from '../src/structure/geometry';
import {jointContacts} from '../src/structure/joints';
import {solidCell,cellVolume,intersectCells,subtractCell} from '../src/physical/convex';
import {solidVolume} from '../src/generation/production/doctrine';
import {boundsIndex} from '../src/generation/hardpoint-system/geometry';
import {solidFromRings} from '../src/generation/armor/panels';
import {shapeStations} from '../src/generation/shapes/definition';
import {profileRing} from '../src/generation/hull';
import {boundsOf,center,add,mul} from '../src/generation/integration/contours';
import {HULL_MATERIALS} from '../src/physical/materials';
import {buildStructuralFrame,clearStructuralCache} from '../src/structure/build';
import {integrateStructuralMaterial,clearStructuralIntegrationCache} from '../src/structure/integrate';
import {validateStructuralFrame} from '../src/structure/validate';
import {prepareStructuralQueries,structuralRayProbe} from '../src/structure/query';
import {generateProcurementBlueprint} from '../src/procurement/generate';
import {procurementCost} from '../src/procurement/result';
import {validateBlueprint} from '../src/validation/validate';
import {armorRayProbe} from '../src/physical/probe';
import {nearbyAnchor,evaluateFreeMount} from '../src/free-mount/planner';
import {EquipmentHistory,validateFreeMountPlan} from '../src/free-mount/store';
const load=(name:string,root='qa/v1.8.6.1/fixtures/')=>JSON.parse(gunzipSync(readFileSync(root+name+'.json.gz')).toString())as ShipBlueprint;
const previousPaths:Record<string,string>={BALANCED:'qa/v1.8.6.0.2/fixtures/BALANCED.json.gz',SPINE_AND_MODULES:'qa/v1.8.6.0.2/fixtures/native-spine300.json.gz',CORE_AND_NACELLES:'qa/v1.8.6.0.2/fixtures/native-vesper200.json.gz',...Object.fromEntries(['BLOCK_ASSEMBLY','TRUSS_POD','TWIN_HULL','STACKED_BLOCKS','HYBRID'].map(n=>[n,'qa/v1.8.6.1/before/fixtures/'+n+'.json.gz']))};
const digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const names=['BALANCED','BLOCK_ASSEMBLY','SPINE_AND_MODULES','TRUSS_POD','TWIN_HULL','CORE_AND_NACELLES','STACKED_BLOCKS','HYBRID'];
for(const name of names)it(`real ${name} frame/graph/geometry/material/mass/module and unarmed contract`,()=>{
 const b=load(name),f=b.structuralFrame!,previous=JSON.parse(gunzipSync(readFileSync(previousPaths[name])).toString())as ShipBlueprint;expect(digest(b.structuralVolumes)).toBe(digest(previous.structuralVolumes));expect(digest(b.productionDesign!.armor)).toBe(digest(previous.productionDesign!.armor));expect(digest(b.physicalDesign!.surfaces)).toBe(digest(previous.physicalDesign!.surfaces));expect(validateBlueprint(b)).toEqual([]);expect(f.members.length).toBeGreaterThan(0);expect(f.analysis.components).toHaveLength(1);expect(f.analysis.unreachableVolumeIds).toEqual([]);expect(f.edges).toHaveLength(f.members.length);
 expect(new Set(f.members.map(m=>m.id)).size).toBe(f.members.length);expect(f.volumeFrames).toHaveLength(b.structuralVolumes.length);expect(f.skinAttachments.length).toBeGreaterThan(0);for(const v of f.volumeFrames)if(v.hullShellRefs.length)expect(f.skinAttachments.some(a=>a.volumeId===v.volumeId&&a.contactVolumeM3>0)).toBe(true);
 const hostCells=new Map(b.structuralVolumes.map(v=>{const rings=(v.shape?shapeStations(v.shape):v.geometry.stations).map(s=>profileRing(s).map(([x,y])=>({x:x+v.position.x,y:y+v.position.y,z:s.z+v.position.z})));return[v.id,rings.slice(1).flatMap((r,i)=>convexParts(solidFromRings([rings[i],r])))];}));
 for(const m of f.members){if(m.geometryReference.kind==='GENERATED_INTERNAL')for(const nominal of m.envelope)for(const cell of convexParts(nominal)){let outside=[cell];for(const host of hostCells.get(m.hostIds[0])!)outside=outside.flatMap(c=>subtractCell(c,host));expect(outside.reduce((n,c)=>n+cellVolume(c),0)).toBeLessThan(1e-7);}const independent=m.pieces.reduce((n,p)=>n+solidVolume(p),0);expect(independent).toBeCloseTo(m.volumeM3,4);expect(independent*HULL_MATERIALS[m.materialId].densityKgM3).toBeCloseTo(m.massKg,1);expect(m.pieces.length).toBeGreaterThan(0);}
 for(const j of f.joints){expect(j.contacts.length).toBe(j.memberIds.length-1);expect(j.contacts.every(c=>c.measure>0)).toBe(true);}
 for(const e of b.engines)expect(f.nodes.some(n=>n.attachmentReferences.some(r=>r.kind==='ENGINE'&&r.id===e.id))).toBe(true);
 const mass=b.physicalDesign!.mass,ledger=mass.ledger!;expect(mass.structuralMassEstimateKg).toBe(0);expect(ledger.entries.reduce((n,e)=>n+e.massKg,0)).toBeCloseTo(mass.totalEstimatedDryMassKg,2);expect(mass.actualFrameMassKg!+mass.actualStructuralConnectorMassKg!).toBeCloseTo(f.members.reduce((n,m)=>n+m.massKg,0),2);
 expect(ledger.entries.find(e=>e.component==='STRUCTURE')!.massKg).toBe(0);expect(f.massAccounting.retiredLegacyFrameProxyKg).toBe(b.dimensions.estimatedMass*1000*.18);
 expect(b.weaponLayout!.mounts).toEqual([]);expect(b.weaponLayout!.integrated).toEqual([]);expect(b.engines.length).toBeGreaterThan(0);
 const cost=procurementCost(b);expect(cost.total).toBe((cost.material+cost.fabrication+cost.estimatedStructureAndCore+cost.structuralMaterial!+cost.structuralFabrication!)*cost.yardProcessFactor);
},30000);
it('volume units, hexagonal existing rails and exclusive weld union use finite geometry',()=>{
 const a={x:0,y:0,z:0},z={x:0,y:10,z:0},rect=beamSolid(a,z,2,3),hex=beamSolid(a,z,2,2,true);
 expect(solidVolume(rect)).toBeCloseTo(60,10);expect(solidVolume(hex)).toBeCloseTo(3*Math.sqrt(3)/2*10,10);
 const previous:Parameters<typeof exclusiveMaterial>[1]=[];const first=exclusiveMaterial([rect],previous),copy=exclusiveMaterial([rect],previous);expect(first.reduce((n,c)=>n+cellVolume(c),0)).toBeCloseTo(60);expect(copy).toEqual([]);
 expect(60*HULL_MATERIALS.LIGHT_STRUCTURAL_ALLOY.densityKgM3/1000).toBe(168);
});
it('Tarjan multigraph fixtures identify bridges, cut vertices, independent paths and unsupported modules',()=>{
 const fixture=(pairs:string[][],extra:string[]=[])=>{const ids=[...new Set([...pairs.flat(),...extra])],nodes=ids.map(id=>({id}))as StructuralNode[],edges=pairs.map((nodeIds,i)=>({id:'e'+i,nodeIds}))as StructuralEdge[];return analyzeConnectivity(nodes,edges,['a'],ids.map(id=>({volumeId:id,nodeIds:[id]})));};
 const chain=fixture([['a','b'],['b','c']]);expect(chain.bridges).toEqual(['e0','e1']);expect(chain.articulationPoints).toEqual(['b']);expect(chain.cycleRank).toBe(0);
 const cycle=fixture([['a','b'],['b','c'],['c','a']]);expect(cycle.bridges).toEqual([]);expect(cycle.articulationPoints).toEqual([]);expect(cycle.cycleRank).toBe(1);
 expect(fixture([['a','b'],['a','b']]).bridges).toEqual([]);expect(fixture([['a','b']],['c']).unreachableVolumeIds).toEqual(['c']);
});
it('coincident names without finite contact cannot certify a welded joint',()=>{
 const a=beamSolid({x:0,y:0,z:0},{x:0,y:1,z:0},.2),b=beamSolid({x:10,y:0,z:0},{x:10,y:1,z:0},.2);
 expect(()=>jointContacts(['a','b'],{x:0,y:1,z:0},id=>convexParts(id==='a'?a:b))).toThrow('OUTSIDE_MEMBER');
 const c=beamSolid({x:0,y:1,z:0},{x:0,y:2,z:0},.2);expect(jointContacts(['a','c'],{x:0,y:1,z:0},id=>convexParts(id==='a'?a:c))[0].method).toBe('FINITE_COMMON_FACE');
});
it('four policies change real section/material/mass and ENDURANCE adds physical alternative paths',()=>{
 const bs=['ARMOR','MOBILITY','ENDURANCE','ECONOMY'].map(name=>load(name)),fs=bs.map(b=>b.structuralFrame!);expect(fs[0].massAccounting.frameMassKg).toBeGreaterThan(fs[1].massAccounting.frameMassKg);expect(fs[2].analysis.cycleRank).toBeGreaterThan(fs[0].analysis.cycleRank);expect(fs[2].analysis.bridges.length).toBeLessThanOrEqual(fs[0].analysis.bridges.length);expect(bs[3].procurement!.cost!.total).toBeLessThan(bs[0].procurement!.cost!.total);expect(bs[3].procurement!.cost!.structuralFabrication!).toBeLessThan(bs[2].procurement!.cost!.structuralFabrication!);expect(fs[1].policy.materialId).toBe('LIGHT_STRUCTURAL_ALLOY');expect(bs[2].physicalDesign!.policy.future.status).toBe('FRAME_APPLIED_INTERNAL_SYSTEMS_NOT_GENERATED');for(const b of bs){const p=b.physicalDesign!.policy;expect(Object.values(p.allocationsKg).reduce((n,v)=>n+v,0)).toBeCloseTo(p.planningMassBudgetKg!,1);}
});
it('cold and cached raw+skin frame results are identical and invalidate on seed, geometry and priorities',()=>{
 const b=load('BALANCED');clearStructuralCache();clearStructuralIntegrationCache();buildStructuralFrame(b);integrateStructuralMaterial(b);const json=JSON.stringify(b.structuralFrame);buildStructuralFrame(b);integrateStructuralMaterial(b);expect(JSON.stringify(b.structuralFrame)).toBe(json);
 const old=b.structuralFrame!.sourceSignature;b.seed++;buildStructuralFrame(b);expect(b.structuralFrame!.sourceSignature).not.toBe(old);b.procurement!.order.primaryPriority='ENDURANCE';buildStructuralFrame(b);expect(b.structuralFrame!.analysis.cycleRank).toBeGreaterThan(JSON.parse(json).analysis.cycleRank);
 const changed=b.structuralFrame!.sourceSignature;b.structuralVolumes[0].position.x+=.01;buildStructuralFrame(b);expect(b.structuralFrame!.sourceSignature).not.toBe(changed);
});
it('JSON restore retains complete frame; existing native and armed historical loads never insert new frame',()=>{
 const b=load('BALANCED'),restored=JSON.parse(JSON.stringify(b));expect(validateBlueprint(restored)).toEqual([]);expect(JSON.stringify(restored)).toBe(JSON.stringify(b));
 const native=load('BALANCED','qa/v1.8.6.0.2/fixtures/'),armed=load('vesper200-after','qa/v1.8.6.0.1/fixtures/');for(const old of[native,armed]){const json=JSON.stringify(old);expect(validateBlueprint(old)).toEqual([]);expect(old.structuralFrame).toBeUndefined();expect(JSON.stringify(old)).toBe(json);expect(structuralRayProbe(old,{x:0,y:0,z:0},{x:1,y:0,z:0},100).valid).toBe(false);}expect(armed.weaponLayout!.mounts.length).toBeGreaterThan(0);
});
it('frame instance disable analysis changes connectivity without mutating design or another instance',()=>{
 const f=load('SPINE_AND_MODULES').structuralFrame!,before=JSON.stringify(f),a=createStructuralInstanceState(),b=createStructuralInstanceState(),bridge=f.analysis.bridges[0];expect(bridge).toBeTruthy();a.disabledEdgeIds=[bridge];expect(analyzeStructuralInstance(f,a).components.length).toBeGreaterThan(1);expect(analyzeStructuralInstance(f,b).components.length).toBe(1);expect(JSON.stringify(f)).toBe(before);
});
it('prepared finite OBB/loft queries retain real entry/exit, material, local/world rotation and point candidates',()=>{
 const b=load('BALANCED'),f=b.structuralFrame!,m=f.members.find(m=>m.type==='PRIMARY_LONGITUDINAL')!,point=center(m.pieces[0].vertices),origin=add(point,{x:10,y:0,z:0}),dir={x:-1,y:0,z:0},q=prepareStructuralQueries(b),r=q.probe(origin,dir,20);expect(r.valid).toBe(true);const hit=r.hits.find(h=>h.memberId===m.id)!;expect(hit).toBeTruthy();expect(hit.pathLengthM).toBeGreaterThan(0);expect(q.candidates(point).some(m=>m.id===hit.memberId)).toBe(true);expect(prepareStructuralQueries(b)).toBe(q);
 const quaternion=new Quaternion().setFromEuler(new Euler(.2,.5,-.3)),position={x:20,y:10,z:-30},world=(p:Vec3)=>{const v=new Vector3(p.x,p.y,p.z).applyQuaternion(quaternion).add(new Vector3(position.x,position.y,position.z));return{x:v.x,y:v.y,z:v.z};},v=new Vector3(dir.x,dir.y,dir.z).applyQuaternion(quaternion),turned=q.probe(world(origin),v,20,{position,quaternion});expect(turned.hits.map(h=>h.memberId)).toEqual(r.hits.map(h=>h.memberId));for(let i=0;i<r.hits.length;i++)expect(turned.hits[i].pathLengthM).toBeCloseTo(r.hits[i].pathLengthM,6);
 const attachment=f.skinAttachments.find(a=>!a.reusedExistingMember)!,tie=f.members.find(m=>m.id===attachment.physicalMemberRef)!,axis=new Vector3(tie.end.x-tie.start.x,tie.end.y-tie.start.y,tie.end.z-tie.start.z).normalize(),o=add(tie.end,{x:axis.x*2,y:axis.y*2,z:axis.z*2}),inward={x:-axis.x,y:-axis.y,z:-axis.z},frameHit=q.probe(o,inward,100).hits.find(h=>h.memberId===tie.id),shellHit=armorRayProbe(b,o,inward,100).hits.find(h=>h.shellId===attachment.surfaceId);expect(frameHit).toBeTruthy();expect(shellHit).toBeTruthy();expect(shellHit!.entryDistanceM).toBeLessThanOrEqual(frameHit!.entryDistanceM+1e-6);
 b.structuralFrame!.members[0].materialId='TITANIUM_STRUCTURAL_ALLOY';expect(prepareStructuralQueries(b)).not.toBe(q);expect(q.probe(origin,dir,20).hits.find(h=>h.memberId===hit.memberId)!.materialId).toBe(hit.materialId);expect(q.probe(origin,{x:0,y:0,z:0},20).valid).toBe(false);
});
it('independent pair intersections find no double-counted frame material or frame/skin overlap',()=>{
 const b=load('TRUSS_POD'),f=b.structuralFrame!,parts=f.members.flatMap(m=>m.pieces.map(s=>({id:m.id,cell:solidCell(s),bounds:boundsOf(s.vertices)}))).map((p,i)=>({...p,i})),near=boundsIndex(parts),skins=boundsIndex(b.physicalDesign!.surfaces.flatMap(s=>s.pieces.map(p=>({cell:solidCell(p.solid),bounds:boundsOf(p.solid.vertices)}))));let overlap=0;
 for(const p of parts){for(const q of near(p.bounds))if(q.i>p.i){const c=intersectCells(p.cell,q.cell);if(c)overlap+=cellVolume(c);}for(const q of skins(p.bounds)){const c=intersectCells(p.cell,q.cell);if(c)overlap+=cellVolume(c);}}expect(overlap).toBeLessThan(1e-5);
},30000);
it('validates missing/floating/edited physical members instead of certifying a synthetic connected graph',()=>{
 const b=load('BALANCED');delete b.structuralFrame;expect(validateBlueprint(b)).toContain('Required structural frame absent');
 const unbound=load('BALANCED');unbound.structuralFrame!.skinAttachments[0].surfaceId='imaginary-shell';expect(validateStructuralFrame(unbound).join()).toContain('Invalid finite Hull/frame contact');
 const wrong=load('BALANCED');wrong.structuralFrame!.edges[0].physicalMemberRef='imaginary';expect(validateStructuralFrame(wrong).join()).toContain('Virtual/invalid');
 const moved=load('BALANCED');moved.structuralFrame!.members[0].pieces[0].vertices.forEach(v=>v.x+=1000);expect(validateStructuralFrame(moved).join()).toContain('Detached');
});
it('rejects an impossible base mass with actual frame retained as a mandatory floor',()=>{
 const b=load('BALANCED');expect(()=>generateProcurementBlueprint({...b.procurement!.order,maximumBaseMassKg:1})).toThrow('MAXIMUM_BASE_MASS');
});
it('native default is deterministic with query/debug data absent from JSON; explicit prior version still replays original',()=>{
 const old=load('BALANCED','qa/v1.8.6.0.2/fixtures/'),o=old.procurement!.order,current=generateProcurementBlueprint(o),json=JSON.stringify(current),copy=generateProcurementBlueprint(o);expect(JSON.stringify(copy)).toBe(json);prepareStructuralQueries(current);expect(JSON.stringify(current)).toBe(json);expect(current.generatorVersion).toBe('1.8.6.1');const replay=generateProcurementBlueprint(o,{version:'1.8.6.0.2'});expect(JSON.stringify(replay)).toBe(JSON.stringify(old));
},30000);
it('new frame has no influence on external fitting, owned platforms, mass, move/delete/undo or old armor probe',()=>{
 const b=load('BALANCED'),frame=JSON.stringify(b.structuralFrame),environment=structuredClone(b);delete environment.structuralFrame;
 const queries=[{x:0,y:1000,z:0},{x:600,y:0,z:0}];for(const origin of queries){const d=origin.y?{x:0,y:-1,z:0}:{x:-1,y:0,z:0};expect(armorRayProbe(b,origin,d,2000)).toEqual(armorRayProbe(environment,origin,d,2000));}
 let request:Parameters<typeof evaluateFreeMount>[1]|undefined;for(const x of[-40,0,40])for(const z of[-80,0,80]){try{const candidate={equipmentId:'gun-105',anchor:nearbyAnchor(b,{x,y:0,z},{x:0,y:1,z:0},200),headingDegrees:0,platforms:true,mode:'SINGLE' as const};if(evaluateFreeMount(b,candidate).status!=='INVALID'){request=candidate;break;}}catch{}}
 expect(request).toBeTruthy();const result=evaluateFreeMount(b,request!),without=evaluateFreeMount(environment,request!);expect({...result,elapsedMs:0}).toEqual({...without,elapsedMs:0});const history=new EquipmentHistory(b);history.install(request!);expect(history.blueprint.physicalDesign!.mass.totalEstimatedDryMassKg).toBeGreaterThan(b.physicalDesign!.mass.totalEstimatedDryMassKg);expect(JSON.stringify(history.blueprint.structuralFrame)).toBe(frame);expect(validateFreeMountPlan(JSON.parse(JSON.stringify(history.blueprint)))).toEqual([]);const installed=JSON.stringify(history.blueprint);history.remove(history.blueprint.freeMountPlan!.entries.map(e=>e.id));history.undo();expect(JSON.stringify(history.blueprint)).toBe(installed);history.undo();expect(JSON.stringify(history.blueprint)).toBe(JSON.stringify(b));history.redo();expect(JSON.stringify(history.blueprint)).toBe(installed);
},30000);
it('historical no-join box collar stays an actual finite box, not a chamfered loft approximation',async()=>{
 const{connectorGeometryParts}=await import('../src/generation/architecture/connector-geometry'),{connectorSolids,structuralMaterialVolume}=await import('../src/structure/geometry');
 const c={id:'legacy-box',fromStructureId:'a',toStructureId:'b',type:'DIRECT' as const,style:'armored collar' as const,start:{x:0,y:0,z:0},end:{x:0,y:0,z:10},thickness:2};const parts=connectorGeometryParts(c,100);expect(parts).toHaveLength(1);expect(connectorSolids(parts[0]).reduce((n,s)=>n+structuralMaterialVolume(s),0)).toBeCloseTo(2*2*10.3,8);
});
