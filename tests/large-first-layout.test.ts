import {it,expect,beforeAll} from 'vitest';
import {generateBlueprint,DEFAULT_ORDER} from '../src/generation/generate';
import {addModularHardpoints} from '../src/generation/hardpoint-system/planner';
import {validateModularHardpoints} from '../src/generation/hardpoint-system/validate';
import type {ShipBlueprint} from '../src/blueprint/types';
let savedOld:ShipBlueprint,savedCurrent:ShipBlueprint;
beforeAll(()=>{
 savedOld=generateBlueprint({...structuredClone(DEFAULT_ORDER),shipyardId:'aegis',role:'Battleship',length:470,hardpointDensity:'SPARSE'},7,{architecture:'MONOLITHIC',family:'WEDGE_CITADEL',version:'1.8.5.4'});
 savedCurrent=structuredClone(savedOld);savedCurrent.hardpoints=savedCurrent.hardpoints.filter(h=>h.modular?.state==='OCCUPIED');for(const h of savedCurrent.hardpoints)delete h.modular;delete savedCurrent.modularHardpoints;addModularHardpoints(savedCurrent);
},60000);
const current=()=>structuredClone(savedCurrent);
it('retains ordered large-first reservations, atomic mirrored batteries and canonical equipment',()=>{
 const b=current(),old=structuredClone(savedOld);
 const hs=b.hardpoints.filter(h=>h.modular?.state==='EMPTY');
 const rank={XL:3,L:2,M:1,S:0};expect(hs.every((h,i)=>!i||rank[h.size]<=rank[hs[i-1].size])).toBe(true);
 const pairs=new Map<string,typeof hs>();for(const h of hs)if(h.modular!.pairId)pairs.set(h.modular!.pairId,[...(pairs.get(h.modular!.pairId)??[]),h]);
 expect(pairs.size).toBeGreaterThan(30);expect([...pairs.values()].every(a=>a.length===2)).toBe(true);
 expect(hs.filter(h=>h.size==='L'&&h.modular!.region==='TOP')).toHaveLength(2);
 const batteries=new Map<string,typeof hs>();for(const h of hs)if(h.modular!.batteryGroupId)batteries.set(h.modular!.batteryGroupId,[...(batteries.get(h.modular!.batteryGroupId)??[]),h]);
 expect([...batteries.values()].some(a=>a.filter(h=>h.position.x<0).length>=3&&a[0].size==='M')).toBe(true);
 for(const k of ['structuralVolumes','structuralConnectors','productionDesign','engines','weaponLayout','mesoStructurePlan','exteriorDetailPlan','prefabPlacements','designRequirements'])expect((b as any)[k]).toEqual((old as any)[k]);
 expect(b.hardpoints.filter(h=>h.modular?.state==='OCCUPIED')).toEqual(old.hardpoints.filter((h:any)=>h.modular?.state==='OCCUPIED'));
 expect(validateModularHardpoints(b)).toEqual([]);
});
it('rejects incomplete saved pairs without accepting a singleton as symmetric',()=>{
 const b=current();const h=b.hardpoints.find(h=>h.modular?.pairId)!;h.modular!.pairId='tampered-pair';expect(validateModularHardpoints(b)).toContain('Incomplete bilateral pair tampered-pair');
});
it('reconstructs deterministic layout without applying a new planner to stored old Blueprints',()=>{
 const old=structuredClone(savedOld) as ShipBlueprint;
 const saved=JSON.stringify(old);expect(addModularHardpoints(old)).toBe(old);expect(JSON.stringify(old)).toBe(saved);expect(validateModularHardpoints(old)).toEqual([]);
 const base=current();base.hardpoints=base.hardpoints.filter(h=>h.modular?.state==='OCCUPIED');for(const h of base.hardpoints)delete h.modular;delete base.modularHardpoints;
 expect(addModularHardpoints(base)).toEqual(current());
});
it('reserves valid surface XL before preferred S in an isolated flat installation fixture',()=>{
 const b=current(),host=structuredClone(b.structuralVolumes[0]);
 host.position={x:0,y:0,z:0};host.dimensions={x:200,y:70,z:400};
 host.geometry.stations=[-200,200].map(z=>({z,width:200,height:70,profile:'box',bevel:0,topSlope:0,sideSlope:0}));host.shape=undefined;host.geometry.primitive='Box';
 b.structuralVolumes=[host];b.structuralConnectors=[];b.engines=[];b.prefabPlacements=[];b.hardpoints=[];b.trusses=[];b.mesoStructurePlan=undefined;b.exteriorDetailPlan=undefined;b.modularHardpoints=undefined;
 b.productionDesign!.armor=[];b.productionDesign!.finish=[];b.productionDesign!.zones=[];b.designRequirements=undefined;
 b.weaponLayout!.mounts=[];b.weaponLayout!.integrated=[];
 b.designDoctrine!.hosts=b.designDoctrine!.hosts.filter(h=>h.id===host.id);b.designDoctrine!.allocations.structure.volumeM3=400000;
 b.order.hardpointRequests=[{id:'small-preferred',type:'UTILITY',size:'S',count:2,mandatory:false,priority:100}];
 const directional=structuredClone(b);directional.order.hardpointRequests=[{id:"starboard-directed",type:"UTILITY",size:"S",count:1,mandatory:true,priority:100,direction:{x:1,y:0,z:0}}];addModularHardpoints(directional);expect(directional.modularHardpoints!.requests[0].status).toBe("SATISFIED");expect(validateModularHardpoints(directional)).toEqual([]);
 const odd=structuredClone(b);odd.order.hardpointRequests=[{id:"one-required",type:"UTILITY",size:"S",count:1,mandatory:true,priority:100,region:"TOP"}];
 addModularHardpoints(odd);expect(odd.modularHardpoints!.requests[0].status).toBe("SATISFIED");expect(odd.modularHardpoints!.diagnostics.passes![0].phase).toBe("REQUIRED");expect(validateModularHardpoints(odd)).toEqual([]);
 addModularHardpoints(b);
 expect(b.hardpoints[0].size).toBe('XL');
 const passes=b.modularHardpoints!.diagnostics.passes!;expect(passes[0].size).toBe('XL');expect(passes[0].accepted).toBeGreaterThan(0);
 expect(validateModularHardpoints(b)).toEqual([]);
},60000);
