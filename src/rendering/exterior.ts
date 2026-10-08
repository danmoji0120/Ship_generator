import * as THREE from "three";
import type { ExteriorDefinition, Vec3 } from "../blueprint/types";
/** Extends the same loft topology to stored world contours; caps/side faces contain no design decisions. */
export function contourGeometry(rings: Vec3[][]) {
  const n = rings[0].length,
    vertices = rings.flatMap((r) => r.flatMap((p) => [p.x, p.y, p.z])),
    indices: number[] = [];
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i,
        b = j * n + ((i + 1) % n),
        c = (j + 1) * n + i,
        d = (j + 1) * n + ((i + 1) % n);
      indices.push(a, c, b, b, c, d);
    }
  for (let i = 1; i < n - 1; i++) {
    indices.push(0, i, i + 1);
    const o = (rings.length - 1) * n;
    indices.push(o, o + i + 1, o + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  flat.computeBoundingSphere();
  return flat;
}
export function exteriorGeometry(e: ExteriorDefinition) {
  if (e.rings) return contourGeometry(e.rings);
  const t = e.tube!,
    rings: Vec3[][] = [];
  const n = 16;
  for (const [radius, z] of [
    [t.outerRadius, -t.length / 2],
    [t.outerRadius, t.length / 2],
    [t.innerRadius, t.length / 2],
    [t.innerRadius, -t.length / 2],
  ] as const)
    rings.push(
      Array.from({ length: n }, (_, i) => ({
        x: t.center.x + radius * Math.cos((-i * Math.PI * 2) / n),
        y: t.center.y + radius * Math.sin((-i * Math.PI * 2) / n),
        z: t.center.z + z,
      })),
    );
  const vertices = rings.flatMap((r) => r.flatMap((p) => [p.x, p.y, p.z])),
    indices: number[] = [];
  // Closed annular wall; no disk caps across the engine or axial weapon aperture.
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < n; i++) {
      const a = j * n + i,
        b = j * n + ((i + 1) % n),
        c = ((j + 1) % 4) * n + i,
        d = ((j + 1) % 4) * n + ((i + 1) % n);
      indices.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  flat.computeBoundingSphere();
  return flat;
}
