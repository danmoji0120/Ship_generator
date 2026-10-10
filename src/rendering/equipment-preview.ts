import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { panelGeometry } from "./armor";
import type { PreviewPlan } from "../equipment-preview/fitment";
import { equipmentGeometry } from "../equipment-preview/geometry";
import { PREVIEW_EQUIPMENT } from "../equipment-preview/library";
import type { ShipBlueprint } from "../blueprint/types";
export function renderEquipmentPreview(
  plan: PreviewPlan,
  b: ShipBlueprint,
  debug = false,
) {
  const root = new THREE.Group();
  root.name = "Equipment Preview — temporary";
  const materials = {
    ARMOR: new THREE.MeshStandardMaterial({
      color: 0x899fac,
      roughness: 0.57,
      metalness: 0.45,
    }),
    FOUNDATION: new THREE.MeshStandardMaterial({
      color: 0x526571,
      roughness: 0.64,
      metalness: 0.55,
    }),
    MECHANICAL: new THREE.MeshStandardMaterial({
      color: 0x313f49,
      roughness: 0.46,
      metalness: 0.78,
    }),
    BORE: new THREE.MeshStandardMaterial({ color: 0x080e13, roughness: 0.85 }),
  };
  for (const role of ["ARMOR", "FOUNDATION", "MECHANICAL", "BORE"] as const) {
    const parts = plan.results.flatMap((r) =>
      r.parts.filter((p) => p.role === role),
    );
    if (!parts.length) {
      materials[role].dispose();
      continue;
    }
    const geometries = parts.map((p) => panelGeometry(p.solid)),
      geometry = mergeGeometries(geometries, false)!;
    geometries.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geometry, materials[role]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.previewParts = parts.map((p) => p.id);
    root.add(mesh);
  }
  if (debug) {
    const vertices: number[] = [],
      colors: number[] = [];
    for (const r of plan.results.filter((r) => r.parts.length).slice(0, 12)) {
      const h =
          plan.slotOverrides?.find((h) => h.id === r.slotId) ??
          b.hardpoints.find((h) => h.id === r.slotId)!,
        e = PREVIEW_EQUIPMENT.find((e) => e.id === r.equipmentId)!;
      for (const s of r.samples.filter(
        (s) => s.elevation === 20 || e.kind === "MISSILE",
      )) {
        const shot = equipmentGeometry(h, e, s.yaw, s.elevation).shots[0],
          end = new THREE.Vector3(
            shot.origin.x,
            shot.origin.y,
            shot.origin.z,
          ).addScaledVector(
            new THREE.Vector3(
              shot.direction.x,
              shot.direction.y,
              shot.direction.z,
            ),
            e.kind === "MISSILE" ? 12 : 20,
          ),
          c = new THREE.Color(s.clear ? 0x55dbaa : 0xe96950);
        vertices.push(
          shot.origin.x,
          shot.origin.y,
          shot.origin.z,
          end.x,
          end.y,
          end.z,
        );
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    root.add(
      new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.7,
        }),
      ),
    );
  }
  return root;
}
