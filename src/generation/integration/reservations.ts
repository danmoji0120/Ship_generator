import type {
  EquipmentZone,
  ShipBlueprint,
  Vec3,
  PrefabPlacement,
} from "../../blueprint/types";
import { dot, sub, mul } from "./contours";
export function equipmentReservations(b: ShipBlueprint): EquipmentZone[] {
  return [
    ...b.hardpoints.map((h) => ({
      id: `zone-${h.id}`,
      parentId: h.parentId,
      equipmentId: h.id,
      kind:
        h.type === "Missile"
          ? ("missile" as const)
          : h.type === "Sensor"
            ? ("sensor" as const)
            : ("weapon" as const),
      position: h.position,
      normal: h.normal,
      radius: h.radius * (h.type === "Missile" ? 1.75 : 1.4),
      depth: h.type === "Spinal" ? b.order.length * 0.065 : h.radius * 3,
      rootClearance: h.radius * 0.13,
    })),
    ...b.engines.map((e) => ({
      id: `zone-${e.id}`,
      parentId: e.parentId,
      equipmentId: e.id,
      kind: "exhaust" as const,
      position: e.position,
      normal: { x: 0, y: 0, z: 1 },
      radius: e.nozzleRadius * e.bellRatio * 1.08,
      depth: e.nozzleLength + b.order.length * 0.065,
      rootClearance: 0,
    })),
    ...(b.prefabPlacements ?? [])
      .filter((p) => p.kind === "RADIATOR_BANK")
      .map((p) => ({
        id: `zone-${p.id}`,
        parentId: p.socket.hostId,
        equipmentId: p.id,
        kind: "thermal" as const,
        position: p.socket.position,
        normal: p.socket.normal,
        radius: Math.hypot(p.dimensions.x, p.dimensions.z) * 0.5,
        depth: p.dimensions.y,
        rootClearance: p.dimensions.y * 0.12,
      })),
  ];
}
export function inReservedZone(p: Vec3, z: EquipmentZone) {
  const delta = sub(p, z.position),
    axial = dot(delta, z.normal),
    radial = sub(delta, mul(z.normal, axial));
  return (
    axial > z.rootClearance &&
    axial < z.depth &&
    Math.hypot(radial.x, radial.y, radial.z) < z.radius
  );
}
export function permittedOwnZone(p: PrefabPlacement, z: EquipmentZone) {
  return (
    p.exterior?.equipmentZoneId === z.id &&
    [
      "SENSOR_HOUSING",
      "SPINAL_MUZZLE",
      "ENGINE_HOUSING",
      "THRUSTER_FRAME",
      "RADIATOR_MOUNT",
    ].includes(p.kind)
  );
}
