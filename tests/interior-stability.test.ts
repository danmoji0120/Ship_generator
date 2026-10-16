import {it,expect,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import type{ShipBlueprint}from'../src/blueprint/types';
import {connectedVoidCells}from'../src/interior/connectivity';
import {classifyVoidComponents,recoverVoidCompartment}from'../src/interior/volume';
import {prepareInteriorQueries,placementBox,releaseInteriorQueries,clearInteriorQueryCache}from'../src/interior/query';
import {solidCell,cellVolume}from'../src/physical/convex';
import {carve}from'../src/interior/geometry';
import {analyzeInterior}from'../src/interior/graph';
import {buildCompartmentPlan,clearInteriorCache,updateInteriorSpaceAccounting}from'../src/interior/build';
import {validateCompartmentPlan}from'../src/interior/validate';
const load=(id='BALANCED')=>JSON.parse(gunzipSync(readFileSync(`qa/v1.8.6.2.1/fixtures/${id}.json.gz`)).toString())as ShipBlueprint;
afterEach(()=>new Promise<void>(r=>setImmediate(r)));
it('normal-index connectivity retains finite face contacts across normal bin boundaries; edge-only contact does not connect',()=>{
 for(const angle of[0,.00999,.01001,.785398]){const q={x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)},a=solidCell(placementBox({x:0,y:0,z:0},{x:2,y:2,z:2},0,q)),b=solidCell(placementBox({x:2*Math.cos(angle),y:2*Math.sin(angle),z:0},{x:2,y:2,z:2},0,q));expect(connectedVoidCells([a,b])).toHaveLength(1);}
 expect(connectedVoidCells([solidCell(placementBox({x:0,y:0,z:0},{x:2,y:2,z:2})),solidCell(placementBox({x:2,y:2,z:0},{x:2,y:2,z:2}))])).toHaveLength(2);
});
it('actual solid cage leaves an independent recoverable cavity; recovery adds no fictitious access or pressure edge',()=>{
 const domain=solidCell(placementBox({x:0,y:0,z:0},{x:20,y:20,z:20}));
 const blocks:ReturnType<typeof solidCell>[]=[];for(const axis of['x','y','z']as const)for(const sign of[-1,1]){const p={x:0,y:0,z:0},s={x:4,y:4,z:4};p[axis]=sign*1.5;s[axis]=1;blocks.push(solidCell(placementBox(p,s)));}
 // The six finite solids, not a connectivity flag, separate the interior cavity.
 const parts=carve([domain],{near:()=>blocks.map(cell=>({cell})),cells:(i:{cell:typeof domain})=>[i.cell]}as never),groups=connectedVoidCells(parts),info=classifyVoidComponents(groups,'z',[-10,10]);
 expect(info).toHaveLength(2);const inner=info.find(g=>g.classification==='RECOVERABLE')!;expect(inner.volumeM3).toBeCloseTo(8,7);expect(inner.witness).toBeTruthy();
 const p=load().compartmentPlan!,c=recoverVoidCompartment(p.compartments[0],inner.cells,'recovered-fixture');expect(c.volumeM3).toBeCloseTo(8,7);expect(c.openingReferences).toEqual([]);
 const analysis=analyzeInterior({...p,compartments:[p.compartments[0],c],bulkheads:[],boundaries:[],openings:[]});expect(analysis.pressureGroups.some(g=>g.length===1&&g[0]===c.id)).toBe(true);expect(analysis.accessGroups).toHaveLength(2);
});
it('a long thin residual is nonallocatable despite large total volume; partition contact stays unassigned',()=>{
 const main=solidCell(placementBox({x:0,y:0,z:0},{x:20,y:20,z:20})),sliver=solidCell(placementBox({x:30,y:0,z:0},{x:.1,y:100,z:100})),usable=solidCell(placementBox({x:40,y:0,z:9},{x:2,y:2,z:2}));
 const a=classifyVoidComponents([main,sliver,usable].map(c=>({cells:[c],volumeM3:cellVolume(c)})),'z',[-10,10]);expect(a[1].classification).toBe('NONALLOCATABLE');expect(a[2].classification).toBe('USABLE_RESIDUAL');
});
for(const id of['BALANCED','BLOCK_ASSEMBLY','SPINE_AND_MODULES','TRUSS_POD','TWIN_HULL','CORE_AND_NACELLES','STACKED_BLOCKS','HYBRID'])it(`new ${id} category ledger, finite geometry, graph and unchanged mass`,()=>{
 const b=load(id),old=JSON.parse(gunzipSync(readFileSync(`qa/v1.8.6.2/fixtures/${id}.json.gz`)).toString())as ShipBlueprint,p=b.compartmentPlan!,v=p.volumeAudit!;
 expect(validateCompartmentPlan(b)).toEqual([]);expect(v.validInteriorM3).toBeCloseTo(v.assignedM3+v.usableResidualM3+v.nonallocatableM3,5);expect(Math.abs(v.conservationErrorM3)).toBeLessThan(Math.max(1e-5,v.candidateDomainM3*1e-7));
 expect(b.physicalDesign!.mass).toEqual(old.physicalDesign!.mass);expect(p.bulkheads).toEqual(old.compartmentPlan!.bulkheads);expect(p.openings).toEqual(old.compartmentPlan!.openings);expect(p.analysis).toEqual(old.compartmentPlan!.analysis);expect(p.volumeAudit!.overlapVolumeM3).toBe(0);
 const copy={...p};updateInteriorSpaceAccounting(copy);expect(copy.volumeAudit).toEqual(p.volumeAudit);
},60000);
it('small/medium/large OBB candidate search checks actual continuous space, clearance and confidence deterministically',()=>{
 const b=load(),q=prepareInteriorQueries(b);for(const size of[{x:1,y:1,z:2},{x:4,y:4,z:6},{x:10,y:10,z:20}]){const a=q.placementCandidates(size,{clearanceM:.1});expect(a.candidates.length).toBeGreaterThan(0);expect(q.placementCandidates(size,{clearanceM:.1})).toEqual(a);for(const c of a.candidates)expect(q.fits(c.compartmentId,placementBox(c.position,size,c.clearanceM))).toBe(true);}
 const midpoint=(s:{vertices:{x:number;y:number;z:number}[]})=>s.vertices.reduce((p,v)=>({x:p.x+v.x/s.vertices.length,y:p.y+v.y/s.vertices.length,z:p.z+v.z/s.vertices.length}),{x:0,y:0,z:0});
 const fp=midpoint(b.structuralFrame!.members.find(m=>m.type==='PRIMARY_LONGITUDINAL')!.pieces[0]);expect(q.occupancyAt(fp).length).toBeGreaterThan(0);expect(q.fits(b.compartmentPlan!.compartments[0].id,placementBox(fp,{x:.1,y:.1,z:.1}))).toBe(false);
 const wall=b.compartmentPlan!.bulkheads[0],wp=midpoint(wall.pieces[0]);expect(q.fits(wall.adjacentCompartmentIds[0],placementBox(wp,{x:.1,y:.1,z:.1}))).toBe(false);
 const slim=load(),anchor=q.placementCandidates({x:1,y:1,z:1}).candidates[0].position,thin=slim.compartmentPlan!.compartments[0];thin.volumeM3=1000;thin.localBounds={min:{x:anchor.x-10,y:anchor.y-50,z:anchor.z-50},max:{x:anchor.x+10,y:anchor.y+50,z:anchor.z+50}};thin.physicalVolume.connectedCells=[placementBox(anchor,{x:.1,y:100,z:100})];const slimQ=prepareInteriorQueries(slim);expect(slimQ.availableVolume(thin.id).volumeM3).toBeGreaterThan(4);expect(slimQ.fits(thin.id,placementBox(anchor,{x:1,y:2,z:2}))).toBe(false);
 const meta=q.availableVolume(b.compartmentPlan!.compartments[0].id);meta.accessGroup.push('fake');expect(q.availableVolume(b.compartmentPlan!.compartments[0].id).accessGroup).not.toContain('fake');
 const rotation={x:0,y:0,z:Math.sin(Math.PI/8),w:Math.cos(Math.PI/8)},turned=q.placementCandidates({x:1,y:2,z:1},{quaternion:rotation,clearanceM:.1});expect(turned.candidates.length).toBeGreaterThan(0);for(const c of turned.candidates)expect(q.fits(c.compartmentId,placementBox(c.position,c.size,c.clearanceM,c.quaternion))).toBe(true);
 expect(q.placementCandidates({x:1000,y:1000,z:1000}).candidates).toEqual([]);expect(()=>q.placementCandidates({x:-1,y:1,z:1})).toThrow('INVALID');
 const room=b.compartmentPlan!.compartments[0];room.boundaryCertainty='UNRESOLVED';room.pressureCapability='UNPRESSURIZED';const next=prepareInteriorQueries(b);expect(next).not.toBe(q);expect(next.placementCandidates({x:1,y:1,z:1},{compartmentId:room.id}).candidates).toEqual([]);expect(next.availableVolume(room.id).confirmed).toBe(false);releaseInteriorQueries(b);expect(prepareInteriorQueries(b)).not.toBe(next);clearInteriorQueryCache();
},30000);
it('category audit corruption is rejected and edited source geometry invalidates exact content caches',()=>{const b=load();b.compartmentPlan!.volumeAudit!.assignedM3++;expect(validateCompartmentPlan(b).length).toBeGreaterThan(0);const c=load();clearInteriorCache();buildCompartmentPlan(c);const key=c.compartmentPlan!.sourceSignature;c.structuralFrame!.members[0].envelope[0].vertices[0].x+=.001;buildCompartmentPlan(c);expect(c.compartmentPlan!.sourceSignature).not.toBe(key);},60000);
