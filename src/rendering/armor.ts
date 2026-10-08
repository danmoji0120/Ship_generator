import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ShipBlueprint } from '../blueprint/types';
import { contourGeometry } from './exterior';
import type { PanelSolid } from '../generation/armor/types';
export function panelGeometry(s:PanelSolid) {
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(s.vertices.flatMap(p=>[p.x,p.y,p.z]),3));g.setIndex(s.indices);const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();flat.computeBoundingSphere();return flat;
}
import type { shipMaterials } from './materials';
export function renderLayeredArmor(b: ShipBlueprint, materials: ReturnType<typeof shipMaterials>) {
  const root = new THREE.Group();
  root.name = 'Layered Armor';
  for (const layer of [1,2,3]) {
    const segments = b.layeredArmor?.assemblies.flatMap(a => a.segments).filter(s => s.layer === layer) ?? [];
    if (!segments.length) continue;
    const geometries = segments.map(s => s.solid ? panelGeometry(s.solid) : contourGeometry(s.rings));
    const merged = mergeGeometries(geometries, false)!;
    let firstVertex = 0;
    // Identity survives batching: vertex ranges map each visible segment back to authority data.
    const ranges = segments.map((s,i) => {
      const count = geometries[i].getAttribute('position').count;
      const r = {id:s.id,parentStructureId:s.parentStructureId,firstVertex,vertexCount:count};
      firstVertex += count; return r;
    });
    geometries.forEach(g=>g.dispose());
    const mesh = new THREE.Mesh(merged, layer === 1 ? materials.secondary : layer === 2 ? materials.hull : materials.secondary);
    mesh.userData.armorLayer = layer;
    mesh.userData.armorSegments = ranges;
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}
