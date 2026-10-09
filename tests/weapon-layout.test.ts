import * as THREE from 'three';
import {createShip,disposeShip} from '../src/rendering/ship';
import {beforeAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildWeaponLayoutReview} from '../src/generation/weapons/build';
import {mountStandard} from '../src/generation/weapons/standards';
import {armorSurfaces,resolveFoundation,resolveGroupFoundations,mountFrame,worldPoint,localPoint,REGION_NORMAL} from '../src/generation/weapons/surfaces';
import {validateWeaponLayout} from '../src/generation/weapons/validate';
import {validatePattern} from '../src/generation/weapons/plan';
import {envelopesOverlap,rayBlocked,solidsIntrude} from '../src/generation/weapons/collision';
import {facetedBox} from '../src/generation/functional/geometry';
import {boundsOf,dot} from '../src/generation/integration/contours';
import {cross} from '../src/generation/armor/panels';
import {validateBlueprint} from '../src/validation/validate';
import type {ShipBlueprint} from '../src/blueprint/types';
const source=JSON.parse(readFileSync('qa/v1.8.2/functional-exterior/final-review/blueprint.json','utf8')) as ShipBlueprint;
let b:ShipBlueprint;
beforeAll(()=>{b=buildWeaponLayoutReview(source);},120000);
describe('V1.8.3 single-ship weapon layout',()=>{
 it('defines independent physical S/M/L/XL installation contracts',()=>{
  expect(['S','M','L','XL'].map(s=>mountStandard(s as any).footprint.width)).toEqual([4.5,11.5,26,45]);
  expect(mountStandard('L').envelope.length).toBe(43);expect(mountStandard('XL').mode).toBe('HULL_INTEGRATED');
 });
 it('scales physical meters coherently across hull lengths',()=>{
  expect(mountStandard('L',600).footprint.width).toBeGreaterThan(26);
  expect(mountStandard('L',40).footprint.width).toBeGreaterThan(0);
  expect(()=>mountStandard('L',NaN)).toThrow();
 });
 it('rejects XL surface turrets instead of enlarging L',()=>expect(()=>resolveFoundation(armorSurfaces(source),{x:0,y:0,z:0},'TOP',mountStandard('XL'))).toThrow(/integrated spinal/));
 it('retains every approved structural/macro/armor/engine and source JSON',()=>{
  const before=JSON.stringify(source);buildWeaponLayoutReview(source);
  expect(JSON.stringify(source)).toBe(before);
  for(const key of ['structuralVolumes','structuralConnectors','macroDesign','dimensions','structuralArmorPilot','engines','hullIntegration','materialTheme'] as const)expect(b[key]).toEqual(source[key]);
  expect(b.prefabPlacements!.filter(p=>p.functionality==='protection')).toEqual(source.prefabPlacements!.filter(p=>p.functionality==='protection'));
 });
 it('redistributes a finite budget across all four regions',()=>{
  expect(b.weaponLayout!.budget).toEqual({available:58,allocated:52,countLimit:20,byRegion:{TOP:8,BOTTOM:4,PORT:3,STARBOARD:3}});
  expect(b.hardpoints.length).toBe(18);expect(b.hardpoints.length).toBeLessThan(source.hardpoints.length);
 });
 it('gives L two visibly larger assemblies rather than scaled PD',()=>{
  const mounts=b.weaponLayout!.mounts,ls=mounts.filter(m=>m.standard.size==='L');expect(ls).toHaveLength(2);
  for(const m of ls){const bounds=m.equipment.localBounds;expect(bounds.max.z-bounds.min.z).toBeGreaterThan(30);expect(bounds.max.z-bounds.min.z).toBeLessThan(45);expect(bounds.max.x-bounds.min.x).toBeGreaterThan(25);}
  const a=b.prefabPlacements!.find(p=>p.id===ls[0].equipment.prefabId)!.assembly!;
  expect(a.parts.filter(p=>p.role==='HEAVY_SIDE_PROTECTION')).toHaveLength(2);
 });
 it('keeps categories separate from legacy type labels',()=>{
  const copy=structuredClone(b);copy.hardpoints.find(h=>h.size==='L')!.type='Medium Turret';
  expect(validateWeaponLayout(copy).issues).toEqual([]);
 });
 it('uses positive-handed measured tangent frames on all directions',()=>{
  for(const m of b.weaponLayout!.mounts){expect(dot(m.frame.normal,REGION_NORMAL[m.region])).toBeGreaterThan(.65);expect(dot(cross(m.frame.right,m.frame.normal),m.frame.forward)).toBeCloseTo(-1,6);expect(dot(m.frame.normal,m.frame.forward)).toBeCloseTo(0,6);}
 });
 it('round-trips local coordinates on a sloped inverted mount',()=>{
  const f=mountFrame({x:.2,y:-.96,z:.15}),origin={x:20,y:-40,z:2},p={x:4,y:3,z:-8};
  const q=localPoint(origin,f,worldPoint(origin,f,p));for(const k of ['x','y','z'] as const)expect(q[k]).toBeCloseTo(p[k],8);
 });
 it('seats foundations with seventeen actual triangle contacts',()=>{
  for(const m of b.weaponLayout!.mounts){expect(m.contacts).toHaveLength(17);expect(m.foundation.inset).toBe(.18);expect(m.footprint.width).toBe(m.standard.footprint.width);expect(m.foundation.height).toBeGreaterThanOrEqual(m.standard.foundationHeight-1e-6);}
  expect(validateWeaponLayout(b).issues).toEqual([]);
 });
 it('stores lower and side outward assemblies without world-up correction',()=>{
  const mounts=b.weaponLayout!.mounts;for(const m of mounts.filter(m=>m.region==='BOTTOM'))expect(m.frame.normal.y).toBeLessThan(-.65);
  for(const m of mounts.filter(m=>m.region==='PORT'))expect(m.frame.normal.x).toBeLessThan(-.65);
  for(const m of mounts.filter(m=>m.region==='STARBOARD'))expect(m.frame.normal.x).toBeGreaterThan(.65);
 });
 it('preserves atomic mirrored poses and group membership',()=>{
  const w=b.weaponLayout!;expect(w.groups).toHaveLength(9);
  for(const g of w.groups){const ms=w.mounts.filter(m=>m.groupId===g.id);expect(ms.length).toBe(g.members.length);if(g.symmetry==='BILATERAL')for(const m of ms){expect(ms.some(q=>q.id!==m.id&&Math.abs(q.position.x+m.position.x)<1e-6&&Math.abs(q.position.z-m.position.z)<1e-6&&Math.abs(q.position.y-m.position.y)<1e-6)).toBe(true);}}
 });
 it('records coherent group relocation and has no abandoned half-pairs',()=>{
  const w=b.weaponLayout!;expect(w.attempts.some(a=>!a.accepted&&a.reasons.length)).toBe(true);expect(w.omissions).toEqual([]);
  expect(w.attempts.filter(a=>a.accepted)).toHaveLength(w.groups.length);
  expect(w.attempts.find(a=>a.groupId==='broadside-battery'&&a.accepted)!.longitudinalShift).toBe(16);
 });
 it('rejects an impossible mirror group as a whole',()=>{
  const g=structuredClone(b.weaponLayout!.groups[2]);g.members[0].hint.x=-999;g.members[1].hint.x=999;
  expect(()=>resolveGroupFoundations(armorSurfaces(source),g,0,size=>mountStandard(size))).toThrow();
 });
 it('requires real functional references for asymmetric layouts',()=>{
  const g={...b.weaponLayout!.groups[0],pattern:'ASYMMETRIC_FUNCTIONAL' as const,symmetry:'FUNCTIONAL' as const};
  expect(()=>validatePattern(g)).toThrow();expect(()=>validatePattern({...g,reason:'channel equipment',functionalReferenceIds:['missing']},new Set())).toThrow();
  expect(()=>validatePattern({...g,reason:'channel equipment',functionalReferenceIds:['actual-channel']},new Set(['actual-channel']))).not.toThrow();
 });
 it('rejects partial bilateral membership',()=>{const c=structuredClone(b);c.weaponLayout!.mounts.splice(2,1);expect(validateWeaponLayout(c).issues.some(i=>i.includes('Partial group'))).toBe(true);});
 it('checks oriented envelopes and reciprocal geometry intrusion',()=>{
  const a=b.weaponLayout!.mounts[0];expect(envelopesOverlap(a,a)).toBe(true);expect(envelopesOverlap(a,b.weaponLayout!.mounts[1])).toBe(false);
  const s=facetedBox({x:0,y:0,z:0},{x:8,y:8,z:8}),t=facetedBox({x:2,y:0,z:0},{x:8,y:8,z:8});expect(solidsIntrude(s,boundsOf(s.vertices),t,boundsOf(t.vertices))).toBe(true);
 });
 it('detects continuous firing-ray intersections with a protected solid',()=>{
  const s=facetedBox({x:0,y:0,z:10},{x:3,y:3,z:3});expect(rayBlocked({x:0,y:0,z:0},{x:0,y:0,z:1},80,[{id:'blocker',solid:s,bounds:boundsOf(s.vertices)}])).toBe('blocker');
 });
 it('stores local firing arcs, clear samples and outward lower directions',()=>{
  for(const m of b.weaponLayout!.mounts){expect(m.firingArc.coordinateSystem).toBe('LOCAL_MOUNT');expect(m.firingArc.clearanceBounds.max.z).toBeGreaterThanOrEqual(m.firingArc.clearanceBounds.min.z);expect(m.firingArc.samples.every(s=>s.clear)).toBe(true);if(m.region==='BOTTOM')expect(m.firingArc.samples.every(s=>s.direction.y<0)).toBe(true);}
 });
 it('rejects firing vectors unrelated to the local mount frame',()=>{const c=structuredClone(b);c.weaponLayout!.mounts[0].firingArc.samples[0].direction={x:0,y:1,z:0};expect(validateWeaponLayout(c).issues.some(i=>i.includes('outside local arc'))).toBe(true);});
 it('rejects corrupted contacts and foundation authority',()=>{
  const c=structuredClone(b);c.weaponLayout!.mounts[0].contacts[0].position.y+=10;
  expect(validateWeaponLayout(c).issues.some(i=>i.includes('Detached foundation'))).toBe(true);
 });
 it('rejects a world-up substitution for a lower mount',()=>{
  const c=structuredClone(b),m=c.weaponLayout!.mounts.find(m=>m.region==='BOTTOM')!;m.frame.normal={x:0,y:1,z:0};
  expect(validateWeaponLayout(c).issues.some(i=>i.includes('Invalid local mount'))).toBe(true);
 });
 it('validates without mutating authoritative JSON or clearance flags',()=>{
  const json=JSON.stringify(b);expect(validateBlueprint(b)).toEqual([]);expect(JSON.stringify(b)).toBe(json);
 });
 it('reproduces the complete placement and geometry JSON exactly',()=>expect(JSON.stringify(buildWeaponLayoutReview(source))).toBe(JSON.stringify(b)));
 it('retains historical foundation IDs only as inactive archive references',()=>{
  expect(b.weaponLayout!.supersededFoundationIds).toHaveLength(31);expect(b.structuralArmorPilot!.mounts).toEqual(source.structuralArmorPilot!.mounts);
  expect(b.prefabPlacements!.filter(p=>p.assembly?.equipmentIds.some(id=>b.weaponLayout!.retiredHardpointIds.includes(id)))).toEqual([]);
 });
 it('renders finite unit-normal batched assemblies and honors actual expanded bounds',()=>{
  const root=createShip(b,'Normal');let batches=0;root.traverse(n=>{if(n instanceof THREE.Mesh&&n.userData.functionalParts){batches++;const ps=n.geometry.getAttribute('position'),ns=n.geometry.getAttribute('normal');expect([...ps.array].every(Number.isFinite)).toBe(true);for(let i=0;i<ns.count;i++)expect(new THREE.Vector3().fromBufferAttribute(ns,i).length()).toBeCloseTo(1,5);}});expect(batches).toBeLessThanOrEqual(6);
  const box=new THREE.Box3().setFromObject(root),bounds=b.weaponLayout!.overallBounds;for(const k of ['x','y','z'] as const){expect(box.min[k]).toBeGreaterThanOrEqual(bounds.min[k]-.1);expect(box.max[k]).toBeLessThanOrEqual(bounds.max[k]+.1);}disposeShip(root);
 });
 it('prevents scope expansion or retroactive reapplication',()=>{
  const c=structuredClone(source);c.seed=8;expect(()=>buildWeaponLayoutReview(c)).toThrow(/restricted/);expect(()=>buildWeaponLayoutReview(b)).toThrow(/restricted/);
 });
});
