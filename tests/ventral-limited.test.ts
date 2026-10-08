import {describe,it,expect}from'vitest';
import{readFileSync}from'node:fs';
import * as THREE from 'three';
import type{ShipBlueprint}from'../src/blueprint/types';
import{buildLimitedVentralReview}from'../src/generation/armor/structural-pilot/ventral-limited';
import{validateStructuralArmorPilot,containsStructuralArmor}from'../src/generation/armor/structural-pilot/validate';
import{stationCacheEqual}from'../src/validation/station-cache';
import{validateBlueprint}from'../src/validation/validate';
import{createShip,disposeShip}from'../src/rendering/ship';
const cases=['WEDGE_CITADEL','HAMMERHEAD','ENGINE_DOMINANT'].map(family=>{
  const source=JSON.parse(readFileSync(`qa/v1.8.2/limited-families/final-review/${family}/blueprint.json`,'utf8'))as ShipBlueprint;
  return{family,source,ship:buildLimitedVentralReview(source)};
});
describe('Three fixed ventral representatives, no broad rollout',()=>{
  it('keeps upper volumes, source macro, equipment and all foundations exactly unchanged',()=>{
    for(const{source,ship}of cases){
      for(const key of['structuralVolumes','structuralConnectors','macroDesign','engines','hardpoints','prefabPlacements','dimensions']as const)expect(ship[key]).toEqual(source[key]);
      const p=ship.structuralArmorPilot!,old=source.structuralArmorPilot!;
      expect(p.components.slice(0,old.components.length)).toEqual(old.components);expect(p.mounts).toEqual(old.mounts);
      expect(p.channels).toEqual(old.channels);expect(p.joints).toEqual(old.joints);
      expect(source.structuralArmorPilot!.ventral).toBeUndefined();expect(validateBlueprint(ship)).toEqual([]);
    }
  });
  it('accepts only machine-rounding cache differences without changing saved geometry',()=>{
    expect(stationCacheEqual([{width:20,profile:'hex'}],[{width:20+Number.EPSILON*20,profile:'hex'}])).toBe(true);
    expect(stationCacheEqual([{width:20}],[{width:20.000001}])).toBe(false);
    expect(stationCacheEqual([{width:20}],[{width:20,extra:1}])).toBe(false);
    expect(stationCacheEqual([{width:20,profile:'hex'}],[{width:20,profile:'box'}])).toBe(false);
    expect(stationCacheEqual([{width:20}],[{width:NaN}])).toBe(false);
    const wrong=structuredClone(cases[2].ship);wrong.structuralVolumes[0].geometry.stations[0].width+=.000001;
    expect(validateBlueprint(wrong).some(s=>s.includes('Shape cache mismatch'))).toBe(true);
  });
  it('serializes deterministic geometry and refuses different seeds, family pairs or reapplication',()=>{
    for(const{source,ship}of cases){
      const original=JSON.stringify(source);expect(JSON.stringify(buildLimitedVentralReview(source))).toBe(JSON.stringify(ship));expect(JSON.stringify(source)).toBe(original);
      expect(validateBlueprint(JSON.parse(JSON.stringify(ship)))).toEqual([]);
      expect(()=>buildLimitedVentralReview({...source,seed:8})).toThrow('restricted');
      expect(()=>buildLimitedVentralReview(ship)).toThrow('restricted');
    }
  });
  it('measures three distinct substantial tiers and uses actual shared solids at junctions',()=>{
    for(const{ship}of cases){
      const p=ship.structuralArmorPilot!,v=p.ventral!;
      expect(new Set(v.levels.map(l=>Math.round(l.depth))).size).toBeGreaterThanOrEqual(3);
      expect(Math.max(...v.levels.map(l=>l.depth))-Math.min(...v.levels.map(l=>l.depth))).toBeGreaterThanOrEqual(10.5);
      expect(v.matings!.length).toBeGreaterThan(0);
      for(const mate of v.matings!)for(const point of mate.contactPoints){
        expect(containsStructuralArmor(p.components.find(c=>c.id===mate.fromId)!,point)).toBe(true);
        expect(containsStructuralArmor(p.components.find(c=>c.id===mate.toId)!,point)).toBe(true);
      }
    }
    expect(cases[0].ship.structuralArmorPilot!.ventral!.componentIds).toHaveLength(7);
    expect(cases[0].ship.structuralArmorPilot!.ventral!.matings).toHaveLength(6);
  });
  it('preserves independent propulsion and actual open gaps, including the rear thermal area',()=>{
    const ship=cases[2].ship,p=ship.structuralArmorPilot!,lower=p.components.filter(c=>p.ventral!.componentIds.includes(c.id));
    expect(lower.every(c=>!c.additionalParentIds?.length)).toBe(true);
    for(const x of[-50,50])for(const z of[45,65,85])for(const y of[-30,0,30])expect(lower.some(c=>containsStructuralArmor(c,{x,y,z}))).toBe(false);
    expect(lower.filter(c=>c.role==='LOWER_HOUSING')).toHaveLength(4);
    // Local cradles stop ahead of thermal equipment; no new rear blanket skin.
    for(const c of lower.filter(c=>c.parentStructureId.startsWith('lateral-drive')))expect(c.bounds.max.z).toBeLessThan(99);
  });
  it('rejects false junction contacts, false Hull measurements and blocked exhaust',()=>{
    const wrong=structuredClone(cases[0].ship);wrong.structuralArmorPilot!.ventral!.matings![0].contactPoints[0].y-=100;
    expect(validateStructuralArmorPilot(wrong).issues.some(s=>s.includes('Unmated ventral'))).toBe(true);
    const falseHull=structuredClone(cases[1].ship),level=falseHull.structuralArmorPilot!.ventral!.levels[0];level.hullY+=5;level.depth+=5;
    expect(validateStructuralArmorPilot(falseHull).issues.some(s=>s.includes('hull surface measurement'))).toBe(true);
    const blocked=structuredClone(cases[2].ship);const c=blocked.structuralArmorPilot!.components.find(c=>c.id==='core-lower-axis')!;
    blocked.engines[0].position={x:0,y:c.bounds.min.y+2,z:-80};
    expect(validateStructuralArmorPilot(blocked).issues.some(s=>s.includes('Equipment corridor'))).toBe(true);
  });
  it('renders finite normals and exact Bounds with all panels and mounts hidden; historical exports remain unchanged',()=>{
    for(const{source,ship}of cases){
      const b=structuredClone(ship);b.hardpoints=[];b.structuralArmorPilot!.mounts=[];
      const root=createShip(b,'Normal');let lower=0;
      root.traverse(n=>{if(n instanceof THREE.Mesh&&b.structuralArmorPilot!.ventral!.componentIds.includes(n.userData.structuralArmor)){
        lower++;expect([...n.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
        const normals=n.geometry.getAttribute('normal');for(let i=0;i<normals.count;i++)expect(new THREE.Vector3().fromBufferAttribute(normals,i).length()).toBeCloseTo(1,5);
      }});
      expect(lower).toBe(b.structuralArmorPilot!.ventral!.componentIds.length);
      const box=new THREE.Box3().setFromObject(root),bounds=b.structuralArmorPilot!.overallBounds;
      for(const k of['x','y','z']as const){expect(box.min[k]).toBeGreaterThanOrEqual(bounds.min[k]-.001);expect(box.max[k]).toBeLessThanOrEqual(bounds.max[k]+.001);}disposeShip(root);
      const historical=createShip(source,'Normal');const ids=new Set(b.structuralArmorPilot!.ventral!.componentIds);let added=0;
      historical.traverse(n=>{if(ids.has(n.userData.structuralArmor))added++;});expect(added).toBe(0);disposeShip(historical);
    }
  });
});
