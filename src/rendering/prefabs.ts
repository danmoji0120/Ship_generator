import * as THREE from "three";
import type { PrefabPlacement, Vec3 } from "../blueprint/types";
import type { shipMaterials } from "./materials";
import { loftGeometry } from "./geometry";
import { shapeDefinition, shapeStations } from "../generation/shapes/definition";

function vector(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

/** Deterministic mesh kit; local +Y is the outboard socket normal. */
export function renderPrefabs(
  placements: readonly PrefabPlacement[],
  materials: ReturnType<typeof shipMaterials>,
) {
  const root = new THREE.Group();
  const radiatorSurface = new THREE.MeshStandardMaterial({
    color: "#455963", metalness: 0.56, roughness: 0.62, side: THREE.DoubleSide,
  });
  for (const p of placements) {
    const g = new THREE.Group();
    g.name = p.id;
    g.userData.prefabId = p.id;
    g.userData.prefabKind = p.kind;
    g.userData.socket = p.socket;
    g.position.copy(vector(p.socket.position));
    g.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      vector(p.socket.normal).normalize(),
    );
    const d = p.dimensions;
    if (p.kind === "ARMOR_PLATE") {
      const body = new THREE.Mesh(
        loftGeometry(shapeStations(shapeDefinition("CHAMFERED_BOX", d))),
        materials.hull,
      );
      body.position.y = d.y * 0.37;
      g.add(body);
      const ridge = new THREE.Mesh(
        new THREE.BoxGeometry(d.x * 0.83, d.y * 0.23, d.z * 0.76),
        p.variant === 2 ? materials.secondary : materials.accent,
      );
      ridge.position.y = d.y * 0.95;
      g.add(ridge);
      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(
          new THREE.BoxGeometry(d.y * 0.24, d.y * 0.47, d.z * 0.96),
          materials.secondary,
        );
        rim.position.set(side * d.x * 0.44, d.y * 0.35, 0);
        g.add(rim);
      }
    } else if (p.kind === "RADIATOR_BANK") {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(d.x * 0.52, d.y * 0.13, d.z),
        materials.secondary,
      );
      base.position.y = d.y * 0.05;
      g.add(base);
      const count = 4 + p.variant * 2;
      for (let i = 0; i < count; i++) {
        const z = ((i + 0.5) / count - 0.5) * d.z;
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(
            d.x * 0.96,
            d.y * (0.74 + p.variant * 0.07),
            d.z / count * 0.47,
          ),
          radiatorSurface,
        );
        fin.position.set(0, d.y * 0.43, z);
        g.add(fin);
        const tip = new THREE.Mesh(
          new THREE.BoxGeometry(d.x, d.y * 0.075, d.z / count * 0.55),
          materials.accent,
        );
        tip.position.set(0, d.y * (0.80 + p.variant * 0.05), z);
        g.add(tip);
      }
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(d.y * 0.10, d.y * 0.18, d.z * 1.03),
          materials.secondary,
        );
        rail.position.set(side * d.x * 0.42, d.y * 0.12, 0);
        g.add(rail);
      }
    } else if (p.kind === "JOINT_HOUSING") {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(d.x * 0.48, d.z * 0.48, d.y, 8),
        materials.secondary,
      );
      body.position.y = d.y * 0.10;
      g.add(body);
      for (const t of [-0.30, 0.30]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(
            Math.min(d.x, d.z) * 0.44,
            Math.min(d.x, d.z) * 0.075,
            4,
            8,
          ),
          p.variant === 1 ? materials.accent : materials.hull,
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = d.y * t;
        g.add(ring);
      }
    }
    root.add(g);
  }
  return root;
}
