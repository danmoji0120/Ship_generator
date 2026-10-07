import * as THREE from "three";
import type { HullStation, SecondaryStructure } from "../blueprint/types";
import { moduleStations } from "../generation/attachment";
import { profileRing } from "../generation/hull";
export function loftGeometry(stations: HullStation[]) {
  const points: number[] = [],
    indices: number[] = [];
  for (const s of stations)
    for (const [x, y] of profileRing(s)) points.push(x, y, s.z);
  for (let i = 0; i < stations.length - 1; i++)
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j,
        b = i * 8 + ((j + 1) % 8),
        c = (i + 1) * 8 + j,
        d = (i + 1) * 8 + ((j + 1) % 8);
      indices.push(a, c, b, b, c, d);
    }
  for (let j = 1; j < 7; j++) {
    indices.push(0, j, j + 1);
    const o = (stations.length - 1) * 8;
    indices.push(o, o + j + 1, o + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  g.setIndex(indices);
  // Flat facets make the station loft readable without inventing geometry noise.
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  flat.computeBoundingSphere();
  return flat;
}
export function moduleGeometry(m: SecondaryStructure) {
  return loftGeometry(moduleStations(m));
}
export function beamBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const v = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, v.length(), 6),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  return beam;
}
