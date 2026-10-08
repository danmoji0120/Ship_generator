import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateBlueprintV181, DEFAULT_ORDER } from '../src/generation/generate';
import { buildStructuralArmorPilot, surfaceHit } from '../src/generation/armor/structural-pilot/build';
import { validateStructuralArmorPilot, containsStructuralArmor } from '../src/generation/armor/structural-pilot/validate';
import { validateBlueprint } from '../src/validation/validate';
import { createShip, disposeShip } from '../src/rendering/ship';
const baseline = generateBlueprintV181(DEFAULT_ORDER, 7, {architecture:'MONOLITHIC',family:'WEDGE_CITADEL'});
const sample = () => buildStructuralArmorPilot(baseline);
describe('Single-ship structural depth review (no panel/language rollout)', () => {
  it('preserves the source and its macro/structural graph, engines and exterior attachments', () => {
    const json=JSON.stringify(baseline), b=sample();
    expect(JSON.stringify(baseline)).toBe(json);
    for(const k of ['structuralVolumes','structuralConnectors','macroDesign','engines','prefabPlacements','dimensions'] as const)expect(b[k]).toEqual(baseline[k]);
    expect(b.layeredArmor).toBeUndefined();expect(b.surfaceFeatures).toEqual([]);
  });
  it('refuses expansion beyond the one authorized representative', () => {
    for(const change of [{seed:8},{shipyardId:'forge'},{order:{...DEFAULT_ORDER,length:600}}])
      expect(()=>buildStructuralArmorPilot({...structuredClone(baseline),...change})).toThrow('restricted');
  });
  it('keeps large real tiers while sculpting the upper plinth and connective necks', () => {
    const b=sample(), c=b.structuralArmorPilot!.components;
    const y=(id:string,x:number,z:number)=>surfaceHit(c.filter(c=>c.id===id),x,z)!.y;
    expect(y('main-citadel',0,0)-y('fore-axial-guard',0,-90)).toBeCloseTo(11);
    expect(y('command-foundation',0,75)-y('main-citadel',0,0)).toBeCloseTo(8);
    expect(y('command-plinth',0,75)-y('command-foundation',0,75)).toBeGreaterThan(10);
    expect(c.filter(c=>c.role==='TRANSITION_NECK')).toHaveLength(2);
    expect(c.filter(c=>c.role==='REAR_HOUSING')).toHaveLength(2);
    expect(b.structuralArmorPilot!.joints).toHaveLength(2);
    expect(c.every(c=>c.bounds.max.z-c.bounds.min.z>=32)).toBe(true);
  });
  it('leaves deep open channels between actual structural banks with lower hull floors', () => {
    const b=sample(),p=b.structuralArmorPilot!;
    for(const channel of p.channels){
      expect(channel.depth).toBeGreaterThan(12);expect(channel.width).toBeGreaterThan(16);
      for(const point of channel.floor)for(const c of p.components)
        expect(containsStructuralArmor(c,{...point,y:point.y+5})).toBe(false);
    }
    expect(p.validation.minimumChannelDepth).toBeGreaterThan(12);
  });
  it('makes thick side belts protrude from actual station contours', () => {
    const b=sample(),belts=b.structuralArmorPilot!.components.filter(c=>c.role==='SIDE_BELT');
    expect(belts).toHaveLength(6);
    for(const c of belts){expect(c.bounds.max.y-c.bounds.min.y).toBeGreaterThanOrEqual(23);expect(c.bounds.max.y-c.bounds.min.y).toBeLessThanOrEqual(38);expect(c.contactSamples.length).toBeGreaterThan(6);}
    expect(b.structuralArmorPilot!.overallBounds.max.x).toBeGreaterThan(baseline.dimensions.width/2+5);
  });
  it('keeps every hardpoint, reseats 8 foundation perimeter contacts and preserves firing normals', () => {
    const b=sample(), p=b.structuralArmorPilot!;
    expect(b.hardpoints.map(h=>h.id)).toEqual(baseline.hardpoints.map(h=>h.id));
    expect(p.mounts).toHaveLength(b.hardpoints.length);
    for(const m of p.mounts){
      expect(m.contactSamples).toHaveLength(8);
      const h=b.hardpoints.find(h=>h.id===m.hardpointId)!;
      expect(h.normal).toEqual(baseline.hardpoints.find(h=>h.id===m.hardpointId)!.normal);
      expect(h.position.y).toBeGreaterThan(m.originalPosition.y);
      expect(m.foundation.vertices.slice(-8).every(p=>p.y===h.position.y)).toBe(true);
    }
    expect(validateBlueprint(b)).toEqual([]);
  });
  it('detects detached roots, filled channels, invalid references and inverted volumes', () => {
    const a=sample();a.structuralArmorPilot!.components[0].contactSamples[0].y+=300;
    expect(validateStructuralArmorPilot(a).issues.some(s=>s.includes('Unseated'))).toBe(true);
    const b=sample();b.structuralArmorPilot!.components[0].parentStructureId='missing';
    expect(validateStructuralArmorPilot(b).issues.some(s=>s.includes('parent'))).toBe(true);
    const c=sample();const face=c.structuralArmorPilot!.components[0].solid.indices;
    for(let i=0;i<face.length;i+=3)[face[i],face[i+1]]=[face[i+1],face[i]];
    expect(validateStructuralArmorPilot(c).issues.some(s=>s.includes('Inverted'))).toBe(true);
    const d=sample();d.structuralArmorPilot!.channels[0].floor=[{x:0,y:30,z:0}];
    expect(validateStructuralArmorPilot(d).issues.some(s=>s.includes('Filled channel'))).toBe(true);
  });
  it('detects a blocked engine corridor rather than hiding the collision', () => {
    const b=sample();b.engines[0].position={x:0,y:30,z:-50};
    expect(validateStructuralArmorPilot(b).issues.some(s=>s.includes('Equipment corridor zone-engine-0'))).toBe(true);
  });
  it('serializes deterministically and emits finite unit normals within recorded complete bounds', () => {
    const b=sample();expect(JSON.stringify(sample())).toBe(JSON.stringify(b));
    expect(validateBlueprint(JSON.parse(JSON.stringify(b)))).toEqual([]);
    const root=createShip(b,'Normal'), bounds=b.structuralArmorPilot!.overallBounds;
    root.traverse(n=>{if(n instanceof THREE.Mesh){
      for(const key of ['position','normal'])expect([...n.geometry.getAttribute(key).array].every(Number.isFinite)).toBe(true);
      const normals=n.geometry.getAttribute('normal');for(let i=0;i<normals.count;i++)expect(new THREE.Vector3().fromBufferAttribute(normals,i).length()).toBeCloseTo(1,5);
      expect(n.userData.armorLayer).toBeUndefined();
    }});
    const box=new THREE.Box3().setFromObject(root);for(const k of ['x','y','z'] as const){expect(box.min[k]).toBeGreaterThanOrEqual(bounds.min[k]-.001);expect(box.max[k]).toBeLessThanOrEqual(bounds.max[k]+.001);}
    disposeShip(root);
  });
  it('renders saved historical data without adding pilot volumes', () => {
    const root=createShip(baseline,'Normal');let count=0;root.traverse(n=>{if(n.userData.structuralArmor)count++;});expect(count).toBe(0);disposeShip(root);
  });
});
