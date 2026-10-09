import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {DEFAULT_ORDER,generateBlueprintV181} from './helpers/generate-v181';
import {LIMITED_FAMILIES,buildLimitedStructuralArmor} from '../src/generation/armor/structural-pilot/limited';
import {validateStructuralArmorPilot} from '../src/generation/armor/structural-pilot/validate';
import {validateBlueprint} from '../src/validation/validate';
import {createShip,disposeShip} from '../src/rendering/ship';
import type {ArchitectureGrammar} from '../src/blueprint/types';
import type {ShipBlueprint} from '../src/blueprint/types';
import type {MacroFamily} from '../src/generation/macro/types';

// Exactly the three authorized representative designs. This suite is not a bulk rollout.
const cases=Object.entries(LIMITED_FAMILIES).map(([family,architecture])=>{
  const source=generateBlueprintV181(DEFAULT_ORDER,7,{family:family as MacroFamily,architecture:architecture as ArchitectureGrammar});
  return {family,source,ship:buildLimitedStructuralArmor(source)};
});
describe('Limited structural hierarchy refinement',()=>{
  it('retains source macro masses, graph and equipment with immutable, deterministic serialized authority',()=>{
    for(const {source,ship}of cases){
      const original=JSON.stringify(source);
      expect(JSON.stringify(buildLimitedStructuralArmor(source))).toBe(JSON.stringify(ship));
      expect(JSON.stringify(source)).toBe(original);
      for(const key of ['structuralVolumes','structuralConnectors','macroDesign','engines','prefabPlacements','dimensions'] as const)expect(ship[key]).toEqual(source[key]);
      expect(validateBlueprint(JSON.parse(JSON.stringify(ship)))).toEqual([]);
      expect(ship.layeredArmor).toBeUndefined();expect(ship.surfaceFeatures).toEqual([]);
    }
  });
  it('rejects other seeds, orders, yards and family/architecture pairs instead of silently expanding',()=>{
    const source=cases[0].source;
    for(const change of [{seed:8},{shipyardId:'forge'},{role:'Battleship' as const},{order:{...DEFAULT_ORDER,length:600}},{architecture:{...source.architecture,grammar:'TRUSS_POD' as const}}])
      expect(()=>buildLimitedStructuralArmor({...structuredClone(source),...change})).toThrow('restricted');
  });
  it('matches archived V1.8.1 JSON and renders it without retroactive structural armor',()=>{
    for(const name of ['forge-MONOLITHIC-7','forge-BLOCK_ASSEMBLY-0','forge-STACKED_BLOCKS-7']){
      const saved=JSON.parse(gunzipSync(readFileSync(`qa/v1.8.1/blueprints/${name}.json.gz`)).toString()) as ShipBlueprint;
      expect(generateBlueprintV181(saved.order,saved.seed,{architecture:saved.architecture.grammar})).toEqual(saved);
      const original=JSON.stringify(saved),root=createShip(saved,'Normal');let structuralMeshes=0;
      root.traverse(n=>{if(n.userData.structuralArmor)structuralMeshes++;});
      expect(structuralMeshes).toBe(0);disposeShip(root);expect(JSON.stringify(saved)).toBe(original);
    }
  });
  it('makes connected transition necks while preserving local pod channels and separated propulsion',()=>{
    const hammer=cases.find(c=>c.family==='HAMMERHEAD')!.ship.structuralArmorPilot!;
    expect(hammer.joints).toHaveLength(2);
    expect(hammer.components.filter(c=>c.additionalParentIds?.length)).toHaveLength(2);
    const engine=cases.find(c=>c.family==='ENGINE_DOMINANT')!.ship.structuralArmorPilot!;
    expect(engine.channels).toHaveLength(4);
    expect(engine.components.every(c=>!c.additionalParentIds?.length)).toBe(true);
    for(const {ship} of cases)expect(validateStructuralArmorPilot(ship).issues).toEqual([]);
  });
  it('keeps every mount low in actual geometry with eight supporting contacts and unchanged firing normals',()=>{
    for(const {source,ship}of cases){
      expect(ship.hardpoints.map(h=>h.id)).toEqual(source.hardpoints.map(h=>h.id));
      for(const mount of ship.structuralArmorPilot!.mounts){
        const h=ship.hardpoints.find(h=>h.id===mount.hardpointId)!;
        expect(mount.contactSamples).toHaveLength(8);
        const ys=mount.foundation.vertices.map(p=>p.y);
        const physicalHeight=Math.max(...ys)-Math.min(...ys);
        expect(mount.height).toBeCloseTo(physicalHeight,6);
        expect(physicalHeight).toBeLessThanOrEqual(Math.max(ship.order.length*.006,h.radius*.6)+1e-5);
        expect(h.normal).toEqual(source.hardpoints.find(p=>p.id===h.id)!.normal);
      }
    }
  });
  it('detects falsified mount height, cyclic parent hierarchy and unseated transition contacts',()=>{
    const tall=structuredClone(cases[0].ship);
    tall.structuralArmorPilot!.mounts[0].foundation.vertices[0].y-=10;
    expect(validateStructuralArmorPilot(tall).issues.some(s=>s.includes('height mismatch'))).toBe(true);
    const cycle=structuredClone(cases[0].ship),c=cycle.structuralArmorPilot!.components[0];c.parentArmorId=c.id;
    expect(validateStructuralArmorPilot(cycle).issues.some(s=>s.includes('Cyclic'))).toBe(true);
    const detached=structuredClone(cases[1].ship);detached.structuralArmorPilot!.joints![0].contactPoints[0].y+=100;
    expect(validateStructuralArmorPilot(detached).issues.some(s=>s.includes('Unmated'))).toBe(true);
  });
  it('renders offset parent volumes with finite unit normals and bounds even after panels and mounts are hidden',()=>{
    for(const {ship}of cases){
      const b=structuredClone(ship);b.hardpoints=[];b.structuralArmorPilot!.mounts=[];
      const root=createShip(b,'Normal'),record=b.structuralArmorPilot!.overallBounds;
      root.traverse(n=>{if(n instanceof THREE.Mesh){
        expect([...n.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
        const normals=n.geometry.getAttribute('normal');
        for(let i=0;i<normals.count;i++)expect(new THREE.Vector3().fromBufferAttribute(normals,i).length()).toBeCloseTo(1,5);
      }});
      const box=new THREE.Box3().setFromObject(root);
      for(const k of ['x','y','z'] as const){expect(box.min[k]).toBeGreaterThanOrEqual(record.min[k]-.001);expect(box.max[k]).toBeLessThanOrEqual(record.max[k]+.001);}
      disposeShip(root);
    }
  });
});
