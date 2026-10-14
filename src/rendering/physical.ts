import * as THREE from "three";
import type { ShipBlueprint, Vec3 } from "../blueprint/types";
import type { ProbeHit } from "../physical/probe";
const palette: Record<string, number> = {
  ARMORED_STEEL: 0xa5adba,
  TITANIUM_ARMOR: 0x77d5df,
  CERAMIC_COMPOSITE: 0xffca74,
  TUNGSTEN_COMPOSITE: 0xc082cf,
  NANO_LAMINATE: 0x7ee3a2,
  LIGHT_STRUCTURAL_ALLOY: 0x477daf,
  TITANIUM_STRUCTURAL_ALLOY: 0x487d75,
  HIGH_STRENGTH_STRUCTURAL_STEEL: 0x586071,
};
/** Debug-only finite physical surfaces; Normal never calls this renderer. */
export function renderPhysicalDesign(b: ShipBlueprint, mode: string) {
  const root = new THREE.Group(),
    positions: number[] = [],
    colors: number[] = [];
  root.userData.physicalDebug = true;
  for (const s of b.physicalDesign?.surfaces ?? [])
    for (const p of s.pieces) {
      const f = s.facets[p.facetIndex],
        color =
          mode === "Physical Materials"
            ? new THREE.Color(palette[s.materialId])
            : mode === "Physical Coverage"
              ? new THREE.Color(s.kind === "ARMOR" ? 0xf5b55d : 0x548de0)
              : s.kind === "HULL"
                ? new THREE.Color(0x405778)
                : new THREE.Color().setHSL(
                    0.6 - Math.min(1, f.thicknessMm / 600) * 0.6,
                    0.72,
                    0.54,
                  );
      for (const i of p.solid.indices) {
        const v = p.solid.vertices[i];
        positions.push(v.x, v.y, v.z);
        colors.push(color.r, color.g, color.b);
      }
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  root.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      }),
    ),
  );
  return root;
}
export function renderArmorProbe(
  origin: Vec3,
  direction: Vec3,
  maxDistance: number,
  hits: ProbeHit[],
) {
  const group = new THREE.Group(),
    positions: number[] = [],
    colors: number[] = [],
    o = new THREE.Vector3(origin.x, origin.y, origin.z),
    d = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
  const segment = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Color) => {
    positions.push(...a.toArray(), ...b.toArray());
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
  };
  const distance = hits.length
    ? Math.min(maxDistance, Math.max(...hits.map((h) => h.exitDistanceM)) + 10)
    : maxDistance;
  segment(o, o.clone().addScaledVector(d, distance), new THREE.Color(0x79c6ff));
  for (const h of hits)
    segment(
      new THREE.Vector3(h.entryPoint.x, h.entryPoint.y, h.entryPoint.z),
      new THREE.Vector3(h.exitPoint.x, h.exitPoint.y, h.exitPoint.z),
      new THREE.Color(h.plateId ? 0xffb13c : 0x77efdc),
    );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  group.add(
    new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false }),
    ),
  );
  return group;
}
