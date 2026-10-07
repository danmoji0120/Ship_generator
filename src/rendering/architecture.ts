import * as THREE from "three";
import type {
  ShipBlueprint,
  StructuralConnector,
  VolumeType,
} from "../blueprint/types";
import { loftGeometry, beamBetween } from "./geometry";
import type { DebugView } from "./ship";
import { shipMaterials } from "./materials";
const vector = (p: { x: number; y: number; z: number }) =>
  new THREE.Vector3(p.x, p.y, p.z);
export const VOLUME_COLORS: Record<VolumeType, number> = {
  PRIMARY_HULL: 0x80bdd8,
  HULL_BLOCK: 0xa0b8df,
  POD: 0xe5ae69,
  NACELLE: 0x95dcc5,
  SPINE: 0xe7cf88,
  ARMOR_BLOCK: 0xad9cda,
  DORSAL_STRUCTURE: 0xc9b4e0,
  VENTRAL_STRUCTURE: 0x8493a5,
};
function connectorGroup(
  c: StructuralConnector,
  material: THREE.Material,
  scale: number,
) {
  const root = new THREE.Group(),
    start = vector(c.start),
    end = vector(c.end),
    delta = end.clone().sub(start),
    length = delta.length(),
    axis = delta.clone().normalize();
  if (c.style === "armored collar") {
    const collar = new THREE.Mesh(
      new THREE.BoxGeometry(c.thickness, c.thickness, length + scale * 0.003),
      material,
    );
    collar.position.copy(start).add(end).multiplyScalar(0.5);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    root.add(collar);
    return root;
  }
  if (c.style === "straight beam") {
    root.add(beamBetween(start, end, c.thickness * 0.5, material));
    return root;
  }
  const up =
      Math.abs(axis.y) > 0.85
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0),
    u = axis
      .clone()
      .cross(up)
      .normalize()
      .multiplyScalar(c.thickness * 0.65),
    v = axis
      .clone()
      .cross(u)
      .normalize()
      .multiplyScalar(c.thickness * 0.65);
  const corners =
    c.style === "double beam"
      ? [u.clone(), u.clone().negate()]
      : c.style === "triangular truss"
        ? [
            u.clone(),
            u.clone().multiplyScalar(-0.5).add(v),
            u.clone().multiplyScalar(-0.5).sub(v),
          ]
        : [
            u.clone().add(v),
            u.clone().sub(v),
            u.clone().negate().sub(v),
            u.clone().negate().add(v),
          ];
  const bays = Math.max(2, Math.min(4, Math.ceil(length / (c.thickness * 5))));
  // End shoes extend a little into the mating face; no free-standing decorative rails.
  const a = start.clone().addScaledVector(axis, -c.thickness * 0.7),
    b = end.clone().addScaledVector(axis, c.thickness * 0.7),
    d = b.clone().sub(a);
  for (const offset of corners)
    root.add(
      beamBetween(
        a.clone().add(offset),
        b.clone().add(offset),
        c.thickness * 0.13,
        material,
      ),
    );
  for (let i = 0; i < bays; i++)
    for (let j = 0; j < corners.length; j++) {
      const next = (j + 1) % corners.length;
      root.add(
        beamBetween(
          a
            .clone()
            .addScaledVector(d, i / bays)
            .add(corners[j]),
          a
            .clone()
            .addScaledVector(d, (i + 1) / bays)
            .add(corners[next]),
          c.thickness * 0.085,
          material,
        ),
      );
    }
  for (const t of [0, 1])
    for (let j = 0; j < corners.length; j++)
      root.add(
        beamBetween(
          a.clone().addScaledVector(d, t).add(corners[j]),
          a
            .clone()
            .addScaledVector(d, t)
            .add(corners[(j + 1) % corners.length]),
          c.thickness * 0.14,
          material,
        ),
      );
  return root;
}
export function renderArchitecture(
  b: ShipBlueprint,
  mode: DebugView,
  materials: ReturnType<typeof shipMaterials>,
  ghost: THREE.Material,
) {
  const root = new THREE.Group(),
    showStructure = ["Normal", "Structure", "Architecture"].includes(mode);
  for (const [index, v] of b.structuralVolumes.entries()) {
    const g = new THREE.Group();
    g.position.copy(vector(v.position));
    g.rotation.set(v.rotation.x, v.rotation.y, v.rotation.z);
    g.userData.structureId = v.id;
    const material =
      mode === "Architecture"
        ? new THREE.MeshStandardMaterial({
            color: VOLUME_COLORS[v.type],
            roughness: 0.68,
          })
        : showStructure
          ? v.type === "NACELLE" || v.type === "POD"
            ? materials.secondary
            : materials.hull
          : ghost;
    if (mode === "Hull Sections")
      for (let i = 0; i < v.geometry.stations.length - 1; i++) {
        const mesh = new THREE.Mesh(
          loftGeometry(v.geometry.stations.slice(i, i + 2)),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(
              0.45 + (index * 2 + i) * 0.045,
              0.44,
              0.52,
            ),
            roughness: 0.7,
          }),
        );
        g.add(mesh);
        g.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(mesh.geometry, 16),
            new THREE.LineBasicMaterial({ color: 0x17303b }),
          ),
        );
      }
    else {
      const mesh = new THREE.Mesh(loftGeometry(v.geometry.stations), material);
      g.add(mesh);
      if (showStructure)
        g.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(mesh.geometry, 24),
            new THREE.LineBasicMaterial({
              color: mode === "Architecture" ? 0x29394d : 0x334c5b,
              transparent: true,
              opacity: 0.38,
            }),
          ),
        );
    }
    root.add(g);
    if (mode === "Structural Graph") {
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(b.order.length * 0.01, 8, 6),
        new THREE.MeshBasicMaterial({ color: VOLUME_COLORS[v.type] }),
      );
      node.position.copy(vector(v.position));
      root.add(node);
    }
  }
  for (const c of b.structuralConnectors) {
    const graph = mode === "Structural Graph";
    const color =
      c.type === "TRUSS" ? 0xe8b477 : c.type === "DIRECT" ? 0xb9cad5 : 0x8cdec8;
    const material =
      graph || mode === "Architecture"
        ? new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
        : showStructure
          ? c.style === "armored collar"
            ? materials.hull
            : materials.secondary
          : ghost;
    root.add(connectorGroup(c, material, b.order.length));
    if (graph) {
      const a = b.structuralVolumes.find((v) => v.id === c.fromStructureId)!,
        d = b.structuralVolumes.find((v) => v.id === c.toStructureId)!;
      root.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            vector(a.position),
            vector(c.start),
            vector(c.end),
            vector(d.position),
          ]),
          new THREE.LineBasicMaterial({ color }),
        ),
      );
    }
  }
  return root;
}
