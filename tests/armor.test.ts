import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {generateBlueprintV181 as generateBlueprint,generateBlueprintV18,DEFAULT_ORDER} from './helpers/generate-v181';
import {ARCHITECTURES,type ShipBlueprint} from '../src/blueprint/types';
import {validateLayeredArmor} from '../src/validation/armor';
import {validateBlueprint} from '../src/validation/validate';
import {area,solidTriangles,inPolygon} from '../src/generation/armor/panels';
import {panelGeometry} from '../src/rendering/armor';
import {createShip,disposeShip} from '../src/rendering/ship';
import {armorStageBlueprint} from '../src/rendering/armor-qa';
import {DIRECTIONS} from '../src/generation/armor/surfaces';
import {mountArmorHardpoints} from '../src/generation/armor/mounts';
import {seedSequence} from '../src/qa/diversity';
const sample=(seed=7,shipyardId='aegis')=>generateBlueprint({...structuredClone(DEFAULT_ORDER),shipyardId},seed,{architecture:'BLOCK_ASSEMBLY',family:'HAMMERHEAD'});
const all=(b:ShipBlueprint)=>b.layeredArmor!.assemblies.flatMap(a=>a.segments);
describe('V1.8.1 omnidirectional armor and surface sockets',()=>{
 it('preserves exact V1.8 Macro, structural volumes/mass, engines and integration while relocating external mounts',()=>{
  for(const architecture of ARCHITECTURES)for(const shipyardId of ['aegis','vesper','forge','serein']){
   const o={...structuredClone(DEFAULT_ORDER),shipyardId},old=generateBlueprintV18(o,7,{architecture}),b=generateBlueprint(o,7,{architecture});
   expect(b.generatorVersion).toBe('1.8.1');expect(b.schemaVersion).toBe(2);
   for(const key of ['structuralVolumes','structuralConnectors','macroDesign','dimensions','engines','hullIntegration','prefabPlacements']as const)expect(b[key]).toEqual(old[key]);
   for(const h of b.hardpoints){const prior=old.hardpoints.find(x=>x.id===h.id)!;if(h.type==='Spinal')expect(h).toEqual(prior);else expect(h.surfaceMount!.originalHullPosition).toEqual(prior.position);}
   expect(validateBlueprint(b)).toEqual([]);
  }
 },60000);
 it('coats all six eligible directions above 90%, including real fore/aft cap surfaces',()=>{
  const b=sample();for(const d of DIRECTIONS)expect(b.layeredArmor!.coverage.byDirectionRatio[d]).toBeGreaterThanOrEqual(.90);
  expect(b.layeredArmor!.surfaces.some(s=>s.direction==='fore')).toBe(true);expect(b.layeredArmor!.surfaces.some(s=>s.direction==='aft')).toBe(true);
  expect(b.layeredArmor!.coverage.warnings).toEqual([]);
 });
 it('serializes and reproduces panels, foundations and sockets exactly ten times',()=>{
  const b=sample();for(let i=0;i<10;i++)expect(JSON.stringify(sample())).toBe(JSON.stringify(b));expect(validateBlueprint(JSON.parse(JSON.stringify(b)))).toEqual([]);
 });
 it('maintains actual planar attachment and shallow, broad, noncyclic secondary layers',()=>{
  const b=sample(),panels=all(b);for(const s of panels.filter(s=>s.parentArmorId)){
   const p=panels.find(p=>p.id===s.parentArmorId)!;expect(p.layer).toBeLessThan(s.layer);expect(s.thickness).toBeLessThan(p.thickness);
   expect(s.contactSurface.every(c=>inPolygon(p.topPolygon,c.position,p.orientation,.0001))).toBe(true);
   expect(s.thickness/Math.sqrt(area(s.rootPolygon))).toBeLessThan(.1);
  }
 });
 it('uses finite closed manifold, positive-volume solids with nonzero outward triangles and unit normals',()=>{
  for(const s of all(sample())){
   const edges=new Map<string,number>();let volume=0;const key=(p:{x:number;y:number;z:number})=>`${p.x},${p.y},${p.z}`;
   for(const [a,b,c]of solidTriangles(s.solid)){
    const va=new THREE.Vector3(a.x,a.y,a.z),vb=new THREE.Vector3(b.x,b.y,b.z),vc=new THREE.Vector3(c.x,c.y,c.z);expect(vb.clone().sub(va).cross(vc.clone().sub(va)).length()).toBeGreaterThan(1e-10);volume+=va.dot(vb.cross(vc))/6;
    for(const[p,q]of[[a,b],[b,c],[c,a]]){const e=[key(p),key(q)].sort().join('|');edges.set(e,(edges.get(e)??0)+1);}
   }
   expect(volume).toBeGreaterThan(0);expect([...edges.values()].every(n=>n===2)).toBe(true);
   const g=panelGeometry(s.solid);for(const name of ['position','normal'])expect([...g.getAttribute(name).array].every(Number.isFinite)).toBe(true);const normals=g.getAttribute('normal');for(let i=0;i<normals.count;i++)expect(new THREE.Vector3().fromBufferAttribute(normals,i).length()).toBeCloseTo(1,5);g.dispose();
  }
 });
 // Keep all 220 historical cases and assertions; bounded batches prevent one long
 // synchronous regression from exceeding the runner RPC / test scheduling budget.
 const historicalBatches=ARCHITECTURES.map(architecture=>({label:`forge / ${architecture}`,shipyardId:'forge',architecture})).concat(['aegis','vesper','serein'].map(shipyardId=>({label:`${shipyardId} / BLOCK_ASSEMBLY`,shipyardId,architecture:'BLOCK_ASSEMBLY' as const})));
 it.each(historicalBatches)('validates the original 220 consecutive designs / $label',async({architecture,shipyardId})=>{
  for(const seed of seedSequence(0,20)){
   const b=generateBlueprint({...structuredClone(DEFAULT_ORDER),shipyardId},seed,{architecture});
   expect(validateBlueprint(b),JSON.stringify({architecture,shipyardId,seed})).toEqual([]);expect(new Set(all(b).map(s=>s.id)).size).toBe(all(b).length);
   await new Promise(r=>setTimeout(r,0));
  }
 },120000);
 it('rejects corrupt IDs, cyclic parents, detached roots, degenerate geometry and cached bounds',()=>{
  for(const damage of ['duplicate','parent','root','face','bounds']){const b=sample(),s=all(b)[0];if(damage==='duplicate')b.layeredArmor!.assemblies[0].segments.push(structuredClone(s));if(damage==='parent'){s.layer=2;s.parentArmorId=s.id;}if(damage==='root')s.contactSurface[0].position.y+=1000;if(damage==='face')s.solid.vertices[1]={...s.solid.vertices[0]};if(damage==='bounds')s.bounds.max.y+=10;expect(validateLayeredArmor(b).length).toBeGreaterThan(0);}
 });
 it('records functional/internal surface exclusions with their areas and never reserves base holes for external mounts',()=>{
  const b=sample();expect(b.layeredArmor!.surfaces.flatMap(s=>s.patches).filter(p=>p.exclusionReason).every(p=>p.areaM2>0)).toBe(true);
  const external=new Set(b.hardpoints.filter(h=>h.type!=='Spinal').map(h=>`zone-${h.id}`));expect(b.layeredArmor!.reservedZones.some(z=>external.has(z.id))).toBe(false);
  expect(b.layeredArmor!.decisions.every(d=>d.reason.length>0)).toBe(true);
 });
 it('batches armor into at most three shared meshes while retaining segment vertex identity',()=>{
  const b=sample(),root=createShip(b,'Normal'),meshes:THREE.Mesh[]=[];root.traverse(n=>{if(n instanceof THREE.Mesh&&n.userData.armorLayer)meshes.push(n);});expect(meshes.length).toBeLessThanOrEqual(3);expect(meshes.flatMap(m=>m.userData.armorSegments).map(s=>s.id).sort()).toEqual(all(b).map(s=>s.id).sort());disposeShip(root);
 });
 it('retains identical panel geometry and coverage when mounting hardpoints or hiding them',()=>{
  const b=sample(),before=JSON.stringify(b.layeredArmor!.assemblies),coverage=JSON.stringify(b.layeredArmor!.coverage);
  const c=armorStageBlueprint(b,'NO_HARDPOINTS');expect(c.hardpoints).toEqual([]);expect(JSON.stringify(c.layeredArmor!.assemblies)).toBe(before);
  for(const h of b.hardpoints.filter(h=>h.surfaceMount)){h.position={...h.surfaceMount!.originalHullPosition};h.normal={...h.surfaceMount!.originalHullNormal};delete h.surfaceMount;}mountArmorHardpoints(b);
  expect(JSON.stringify(b.layeredArmor!.assemblies)).toBe(before);expect(JSON.stringify(b.layeredArmor!.coverage)).toBe(coverage);
 });
 it('resolves foundations above armor and reports corrupt socket/position/firing references',()=>{
  const b=sample();for(const h of b.hardpoints.filter(h=>h.type!=='Spinal')){expect(h.surfaceMount).toBeDefined();expect(h.position.y).toBeGreaterThan(h.surfaceMount!.position.y);expect(h.surfaceMount!.foundation.contactPoints).toHaveLength(8);}
  const h=b.hardpoints.find(h=>h.type!=='Spinal')!;h.position.y+=10;expect(validateLayeredArmor(b)).toContain(`Detached surface hardpoint ${h.id}`);
  const other=b.hardpoints.find(q=>q!==h&&q.surfaceMount)!;other.position={...h.position};expect(validateLayeredArmor(b).some(e=>e.startsWith('Overlapping armor mounts'))).toBe(true);
 });
 it('stores real seam gap/depth and bevel, using Hull/integration underlayers rather than line overlays',()=>{
  const b=sample();expect(b.layeredArmor!.seams.length).toBe(all(b).filter(s=>s.layer===1).length);
  for(const s of all(b)){expect(s.solid.vertices.length).toBe(s.rootPolygon.length*3);expect(s.chamfer).toBeGreaterThan(0);expect(s.panelGap).toBeGreaterThan(0);expect(s.thickness).toBeGreaterThan(0);}
 });
 it('keeps saved V1.8 rendering unchanged and records bounds enclosing expanded geometry and foundations',()=>{
  const old=generateBlueprintV18(DEFAULT_ORDER,7),json=JSON.stringify(old),r=createShip(old,'Normal');expect(old.layeredArmor).toBeUndefined();expect(JSON.stringify(old)).toBe(json);disposeShip(r);
  for(const b of [sample(),...[3,13].map(seed=>generateBlueprint({...structuredClone(DEFAULT_ORDER),shipyardId:'forge'},seed,{architecture:'HYBRID'})),...[3,19].map(seed=>generateBlueprint({...structuredClone(DEFAULT_ORDER),shipyardId:'forge'},seed,{architecture:'SPINE_AND_MODULES'}))]) {const root=createShip(b,'Normal'),box=new THREE.Box3().setFromObject(root),bounds=b.layeredArmor!.overallBounds;for(const k of ['x','y','z']as const){expect(box.min[k]).toBeGreaterThanOrEqual(bounds.min[k]-.001);expect(box.max[k]).toBeLessThanOrEqual(bounds.max[k]+.001);}disposeShip(root);}
 });
});
