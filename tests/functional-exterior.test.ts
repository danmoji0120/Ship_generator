import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import type {ShipBlueprint} from '../src/blueprint/types';
import {buildFunctionalExteriorReview} from '../src/generation/functional/build';
import {validateFunctionalExterior} from '../src/generation/functional/validate';
import {annularHousing} from '../src/generation/functional/geometry';
import {containsStructuralArmor} from '../src/generation/armor/structural-pilot/validate';
import {boundsOf} from '../src/generation/integration/contours';
import {validateBlueprint} from '../src/validation/validate';
import {createShip,disposeShip} from '../src/rendering/ship';
import {shipMaterials} from '../src/rendering/materials';

const source=JSON.parse(readFileSync('qa/v1.8.2/ventral-flow/seed7-final/blueprint.json','utf8')) as ShipBlueprint;
const ship=buildFunctionalExteriorReview(source);
const kits=(b=ship)=>b.prefabPlacements!.filter(p=>p.assembly);

describe('One approved Wedge functional exterior, without broad rollout',()=>{
  it('preserves every approved mass, channel, pocket, foundation and source equipment contract',()=>{
    for(const k of ['structuralVolumes','structuralConnectors','macroDesign','dimensions','structuralArmorPilot','hardpoints','engines','hullIntegration','materialTheme'] as const)expect(ship[k]).toEqual(source[k]);
    expect(ship.prefabPlacements!.slice(0,source.prefabPlacements!.length)).toEqual(source.prefabPlacements);
    expect(ship.structuralArmorPilot!.components).toHaveLength(29);
    expect(ship.hardpoints).toHaveLength(31);expect(ship.schemaVersion).toBe(2);expect(ship.generatorVersion).toBe('1.8.2');
    expect(ship.layeredArmor).toEqual(source.layeredArmor);expect(ship.surfaceFeatures).toEqual(source.surfaceFeatures);
    expect(validateBlueprint(ship)).toEqual([]);
  });
  it('is immutable and deterministic in serialized geometry; rejects unauthorized designs and reapplication',()=>{
    const before=JSON.stringify(source);expect(JSON.stringify(buildFunctionalExteriorReview(source))).toBe(JSON.stringify(ship));
    expect(JSON.stringify(source)).toBe(before);expect(validateBlueprint(JSON.parse(JSON.stringify(ship)))).toEqual([]);
    for(const change of [{seed:8},{shipyardId:'forge'},{macroDesign:{...source.macroDesign!,family:'HAMMERHEAD' as const}}])expect(()=>buildFunctionalExteriorReview({...source,...change})).toThrow('restricted');
    expect(()=>buildFunctionalExteriorReview(ship)).toThrow('restricted');
  });
  it('seats each existing mount on its stored foundation and retains the complete armor packet',()=>{
    expect(ship.functionalExterior!.replacedHardpointVisuals).toEqual(source.hardpoints.map(h=>h.id));
    for(const h of ship.hardpoints){
      const p=kits().find(p=>p.assembly!.equipmentIds.includes(h.id))!;
      expect(p.assembly!.attachments).toEqual([{kind:'FOUNDATION',parentId:h.id,position:h.position,normal:h.normal}]);
      expect(p.assembly!.parts.some(p=>p.role==='ARMORED_MOUNT_COLLAR')).toBe(true);
    }
    const bad=structuredClone(ship);kits(bad)[23].assembly!.attachments[0].position.y+=100;
    expect(validateFunctionalExterior(bad).issues.some(s=>s.includes('Detached functional attachment'))).toBe(true);
  });
  it('keeps deep service space, actual exposed pump bodies and broad quiet skins without panel spam',()=>{
    const f=ship.functionalExterior!;expect(f.armorFinish).toHaveLength(23);
    expect(new Set(f.armorFinish.map(p=>p.direction))).toEqual(new Set(['TOP','BOTTOM','PORT','STARBOARD']));
    for(const region of f.serviceRegions){expect(region.occupiedFraction).toBeLessThan(.33);expect(region.remainingDepth).toBeGreaterThan(6);}
    expect(kits().flatMap(p=>p.assembly!.parts).filter(p=>p.role.includes('SERVICE_PUMP'))).toHaveLength(10);
    const bad=structuredClone(ship);bad.functionalExterior!.serviceRegions[0].occupiedFraction=.8;
    expect(validateFunctionalExterior(bad).issues.some(s=>s.includes('Filled maintenance region'))).toBe(true);
  });
  it('preserves the physical nozzle opening and detects exhaust obstruction and blocked firing paths',()=>{
    const drive=kits().find(p=>p.id==='drive-protection')!,casing=drive.assembly!.parts.find(p=>p.id==='drive-armored-casing')!;
    // Open axis through both ends, not an opaque decorative disk in front of the nozzle.
    for(const z of [141.5,148,154.5])expect(containsStructuralArmor({solid:casing.solid} as any,{x:0,y:0,z})).toBe(false);
    const bad=structuredClone(ship),body=kits(bad).find(p=>p.id==='drive-protection')!.assembly!.parts.find(p=>p.id==='drive-armored-casing')!;
    body.solid=annularHousing({x:0,y:0,z:155},{x:0,y:0,z:1},20.5,2,14);body.bounds=boundsOf(body.solid.vertices);
    expect(validateFunctionalExterior(bad).issues.some(s=>s.includes('Blocked functional corridor'))).toBe(true);
    const firing=structuredClone(ship),clear=kits(firing).find(p=>p.assembly!.clearances.length)!.assembly!.clearances[0];
    clear.position={x:0,y:0,z:0};expect(validateFunctionalExterior(firing).issues.some(s=>s.includes('Blocked visual firing path'))).toBe(true);
  });
  it('batches finite closed geometry with unit normals, authoritative bounds and every part ID retained',()=>{
    const root=createShip(ship,'Normal');let batches=0,parts=0;
    root.traverse(n=>{if(n instanceof THREE.Mesh&&n.userData.functionalParts){
      batches++;parts+=n.userData.functionalParts.length;
      expect([...n.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);
      const ns=n.geometry.getAttribute('normal');for(let i=0;i<ns.count;i++)expect(new THREE.Vector3().fromBufferAttribute(ns,i).length()).toBeCloseTo(1,5);
      expect(n.userData.functionalParts.reduce((s:number,p:any)=>s+p.vertexCount,0)).toBe(n.geometry.getAttribute('position').count);
    }});
    expect(batches).toBeLessThanOrEqual(6);expect(parts).toBe(207);
    const box=new THREE.Box3().setFromObject(root),bounds=ship.functionalExterior!.overallBounds;
    for(const k of ['x','y','z'] as const){expect(box.min[k]).toBeGreaterThanOrEqual(bounds.min[k]-.001);expect(box.max[k]).toBeLessThanOrEqual(bounds.max[k]+.001);}
    disposeShip(root);
    const invalid=structuredClone(ship);kits(invalid)[0].assembly!.parts[0].bounds.min.x-=1;
    expect(validateFunctionalExterior(invalid).issues.some(s=>s.includes('bounds cache'))).toBe(true);
  });
  it('suppresses Normal placeholders only for the stored installations and keeps all hardpoint debug markers',()=>{
    for(const [b,mode,count] of [[ship,'Normal',0],[ship,'Hardpoints',31],[source,'Normal',31]] as const){
      const root=createShip(b,mode);let markers=0;root.traverse(n=>{if(n.userData.hardpoint)markers++;});expect(markers).toBe(count);disposeShip(root);
    }
  });
  it('does not retroactively add functional geometry or change materials when historical JSON is rendered',()=>{
    const original=JSON.stringify(source),root=createShip(source,'Normal');let added=0;root.traverse(n=>{if(n.userData.functionalParts)added++;});
    expect(added).toBe(0);disposeShip(root);expect(JSON.stringify(source)).toBe(original);
    const materials=shipMaterials(source);expect(materials.hull.color.getHexString()).toBe(source.materialTheme.hull.slice(1));
    Object.values(materials).forEach(m=>m.dispose());
  });
  it('renders archived V0, V1, V1.5, V1.7, V1.8 and V1.8.1 JSON without new installations',()=>{
    for(const file of ['qa/v0/export.blueprint.json','qa/v1/export.blueprint.json','qa/v1.5/regression/export.blueprint.json','qa/v1.7/regression/export.blueprint.json','qa/v1.8/regression/export.blueprint.json','qa/v1.8.1/regression/export.blueprint.json']){
      const b=JSON.parse(readFileSync(file,'utf8')),before=JSON.stringify(b),root=createShip(b,'Normal');let batches=0;
      root.traverse(n=>{if(n.userData.functionalParts)batches++;if(n instanceof THREE.Mesh)expect([...n.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);});
      expect(batches).toBe(0);disposeShip(root);expect(JSON.stringify(b)).toBe(before);
    }
  });
});
