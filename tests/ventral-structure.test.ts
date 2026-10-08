import {readFileSync}from'node:fs';
import {describe,it,expect}from'vitest';
import * as THREE from 'three';
import type{ShipBlueprint}from'../src/blueprint/types';
import {buildVentralArmorReview}from'../src/generation/armor/structural-pilot/ventral';
import {validateStructuralArmorPilot,containsStructuralArmor}from'../src/generation/armor/structural-pilot/validate';
import {validateBlueprint}from'../src/validation/validate';
import {createShip,disposeShip}from'../src/rendering/ship';
const source=JSON.parse(readFileSync('qa/v1.8.2/structural-pilot/refinement-02/pilot.blueprint.json','utf8'))as ShipBlueprint;
const ship=buildVentralArmorReview(source);
describe('Seed 7 dedicated ventral hierarchy',()=>{
 it('preserves the reviewed upper geometry, mounts, source macro and equipment',()=>{
  for(const key of ['structuralVolumes','structuralConnectors','macroDesign','engines','hardpoints','prefabPlacements','dimensions']as const)expect(ship[key]).toEqual(source[key]);
  expect(ship.structuralArmorPilot!.components.slice(0,source.structuralArmorPilot!.components.length)).toEqual(source.structuralArmorPilot!.components);
  expect(ship.structuralArmorPilot!.mounts).toEqual(source.structuralArmorPilot!.mounts);
  expect(source.structuralArmorPilot!.ventral).toBeUndefined();
 });
 it('rejects other ships and duplicate application without broadening the reviewed scope',()=>{
  for(const change of [{seed:8},{shipyardId:'forge'},{role:'Battleship' as const},{architecture:{...source.architecture,grammar:'BLOCK_ASSEMBLY' as const}}])expect(()=>buildVentralArmorReview({...structuredClone(source),...change})).toThrow('restricted');
  expect(()=>buildVentralArmorReview(ship)).toThrow('restricted');
 });
 it('creates a long keel and at least three measured substantial depth tiers',()=>{
  const p=ship.structuralArmorPilot!,v=p.ventral!,keel=p.components.find(c=>c.role==='VENTRAL_KEEL')!;
  expect(v.componentIds).toHaveLength(7);
  expect(keel.bounds.max.z-keel.bounds.min.z).toBeGreaterThan(250);
  expect(v.levels.find(l=>l.id==='forward-pan')!.depth).toBeCloseTo(7);
  expect(v.levels.find(l=>l.id==='belly-casemate')!.depth).toBeCloseTo(12);
  expect(v.levels.find(l=>l.id==='central-keel')!.depth).toBeCloseTo(23);
  expect(v.levels.find(l=>l.id==='aft-cradle')!.depth).toBeCloseTo(16);
  expect(ship.layeredArmor).toBeUndefined();expect(ship.surfaceFeatures).toEqual([]);
 });
 it('has a genuinely open local recess under the unchanged original hull',()=>{
  for(const recess of ship.structuralArmorPilot!.ventral!.recesses){
   expect(recess.length).toBeGreaterThan(30);expect(recess.mouthDepth).toBeGreaterThan(10);
   for(const point of recess.floor)for(const component of ship.structuralArmorPilot!.components)expect(containsStructuralArmor(component,{...point,y:point.y-1})).toBe(false);
  }
  expect(validateBlueprint(ship)).toEqual([]);
 });
 it('detects detached roots, falsified tiers, filled recesses and obstructed equipment',()=>{
  const detached=structuredClone(ship),p=detached.structuralArmorPilot!;
  p.components.find(c=>c.id==='ventral-keel')!.contactSamples[0].y-=50;
  expect(validateStructuralArmorPilot(detached).issues.some(s=>s.includes('Unseated root ventral-keel'))).toBe(true);
  const wrong=structuredClone(ship);wrong.structuralArmorPilot!.ventral!.levels[0].depth=1;
  expect(validateStructuralArmorPilot(wrong).issues.some(s=>s.includes('level measurements'))).toBe(true);
  const filled=structuredClone(ship);filled.structuralArmorPilot!.ventral!.recesses[0].floor[0].x=0;
  expect(validateStructuralArmorPilot(filled).issues.some(s=>s.includes('Filled ventral recess'))).toBe(true);
  const blocked=structuredClone(ship);blocked.engines[0].position={x:0,y:-40,z:-40};
  expect(validateStructuralArmorPilot(blocked).issues.some(s=>s.includes('Equipment corridor zone-engine-0'))).toBe(true);
 });
 it('serializes deterministic geometry and renders finite unit normals within extended bounds without panels or mounts',()=>{
  const before=JSON.stringify(source);expect(JSON.stringify(buildVentralArmorReview(source))).toBe(JSON.stringify(ship));expect(JSON.stringify(source)).toBe(before);
  const b=JSON.parse(JSON.stringify(ship))as ShipBlueprint;b.hardpoints=[];b.structuralArmorPilot!.mounts=[];
  const root=createShip(b,'Normal');let lowerCount=0;
  root.traverse(n=>{if(n instanceof THREE.Mesh){
   expect([...n.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
   if(b.structuralArmorPilot!.ventral!.componentIds.includes(n.userData.structuralArmor)){
    lowerCount++;const normals=n.geometry.getAttribute('normal');
    for(let i=0;i<normals.count;i++)expect(new THREE.Vector3().fromBufferAttribute(normals,i).length()).toBeCloseTo(1,5);
   }
  }});
  expect(lowerCount).toBe(7);const box=new THREE.Box3().setFromObject(root),bounds=b.structuralArmorPilot!.overallBounds;
  for(const k of ['x','y','z']as const){expect(box.min[k]).toBeGreaterThanOrEqual(bounds.min[k]-.001);expect(box.max[k]).toBeLessThanOrEqual(bounds.max[k]+.001);}
  disposeShip(root);
 });
 it('does not add ventral geometry to a historical saved structural review',()=>{
  const root=createShip(source,'Normal');let count=0;
  root.traverse(n=>{if(String(n.userData.structuralArmor??'').startsWith('ventral-'))count++;});
  expect(count).toBe(0);disposeShip(root);
 });
});
