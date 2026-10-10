import * as THREE from "three";
import type { ShipBlueprint } from "../blueprint/types";
import { MOUNT_TYPES } from "../generation/hardpoint-system/types";
const colors = { S: 0x79dfff, M: 0x96f0b0, L: 0xffc36d, XL: 0xe397ff };
/** Empty slots have no Production mesh. Debug markers batch by mounting type (<=7 calls). */
export function renderModularHardpoints(b: ShipBlueprint) {
  const root = new THREE.Group();
  root.userData.modularMarkers = true;
  const lines: number[] = [],
    matrix = new THREE.Matrix4(),
    rotation = new THREE.Quaternion();
  for (const type of MOUNT_TYPES) {
    const hs = b.hardpoints.filter((h) => h.modular?.mountTypes[0] === type);
    if (!hs.length) continue;
    const geometry =
      type === "TURRET"
        ? new THREE.SphereGeometry(1, 8, 5)
        : type === "MISSILE"
          ? new THREE.OctahedronGeometry(1)
          : type === "UTILITY"
            ? new THREE.BoxGeometry(1.4, 1.4, 1.4)
            : type === "SPINAL" || type === "FIXED"
              ? new THREE.ConeGeometry(0.8, 2, 6)
              : new THREE.IcosahedronGeometry(1);
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({
        depthTest: false,
        transparent: true,
        opacity: 0.92,
      }),
      hs.length,
    );
    mesh.renderOrder = 20;
    mesh.userData.modularSlotIds = hs.map((h) => h.id);
    hs.forEach((h, i) => {
      const scale =
          b.order.length * 0.0036 * { S: 1, M: 1.25, L: 1.55, XL: 1.9 }[h.size],
        p = new THREE.Vector3(h.position.x, h.position.y, h.position.z),
        n = new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z);
      rotation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      matrix.compose(p, rotation, new THREE.Vector3(scale, scale, scale));
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, new THREE.Color(colors[h.size]));
      const end = p.clone().addScaledVector(n, scale * 4);
      lines.push(p.x, p.y, p.z, end.x, end.y, end.z);
    });
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const arrows = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xb0cfe0,
      depthTest: false,
      transparent: true,
      opacity: 0.6,
    }),
  );
  arrows.renderOrder = 19;
  root.add(arrows);
  return root;
}
