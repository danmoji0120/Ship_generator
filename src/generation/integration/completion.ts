import type { IntegrationContext } from "./context";
import type { ExteriorKind } from "../../blueprint/types";
import { containsVolume } from "../architecture/volumes";
import { sectionRing, scaledRing } from "./contours";
export function addCompletion(ctx: IntegrationContext) {
  const { b, yard, l, p, vs, inset, emit, socket, decisions } = ctx;
  // B. Every exposed leading face gets a deliberate rim and forward shell. Covered module faces stay untouched.
  for (const v of vs) {
    const z = v.position.z + v.geometry.stations[0].z,
      ring = sectionRing(v, z),
      facing = { x: v.position.x, y: v.position.y, z: z - l * 0.002 };
    if (vs.some((other) => other !== v && containsVolume(other, facing)))
      continue;
    const kind: ExteriorKind =
      v.purpose === "axial-weapon"
        ? "SPINAL_MUZZLE"
        : v.purpose === "sensor" || b.role === "Patrol Ship"
          ? "SENSOR_BOW"
          : yard.structure === "heavy"
            ? "ARMORED_BOW"
            : yard.structure === "truss"
              ? "INDUSTRIAL_BOW"
              : "WEDGE_BOW";
    const depth = Math.min(
        l * (yard.structure === "swift" ? 0.028 : 0.015),
        v.dimensions.z * 0.08,
      ),
      rear = sectionRing(v, z + Math.min(inset, depth * 0.35));
    const collar = scaledRing(
      ring,
      kind === "ARMORED_BOW" ? 1.13 : kind === "INDUSTRIAL_BOW" ? 1.09 : 1.025,
      { x: 0, y: 0, z: -depth * 0.35 },
    );
    const tip = scaledRing(
      ring,
      kind === "WEDGE_BOW"
        ? 0.18
        : kind === "SPINAL_MUZZLE"
          ? 0.8
          : kind === "SENSOR_BOW"
            ? 0.58
            : 0.87,
      { x: 0, y: 0, z: -depth },
    );
    rear.reverse();
    collar.reverse();
    tip.reverse();
    const axial = b.hardpoints.find(
      (h) => h.parentId === v.id && h.type === "Spinal",
    );
    if (kind === "SPINAL_MUZZLE" && axial) {
      // Open annular collar leaves the existing muzzle passage unobstructed.
      const r = axial.radius * 0.97;
      emit(
        kind,
        `bow-${v.id}`,
        [
          socket(
            v,
            { x: v.position.x, y: v.position.y, z },
            { x: 0, y: 0, z: -1 },
          ),
        ],
        {
          phase: "bow",
          tube: {
            center: {
              x: axial.position.x,
              y: axial.position.y,
              z: z - depth * 0.15,
            },
            length: depth * 0.65,
            innerRadius: r,
            outerRadius: r * 1.32,
          },
          equipmentZoneId: `zone-${axial.id}`,
          contactSamples: [
            {
              parentId: v.id,
              position: { x: v.position.x, y: v.position.y, z: z + inset },
            },
          ],
          inset,
          armorClass: "EDGE",
        },
      );
    } else
      emit(
        kind,
        `bow-${v.id}`,
        [
          socket(
            v,
            { x: v.position.x, y: v.position.y, z },
            { x: 0, y: 0, z: -1 },
          ),
        ],
        {
          phase: "bow",
          rings: [rear, collar, tip],
          contactSamples: rear.map((position) => ({
            parentId: v.id,
            position,
          })),
          inset,
          armorClass: "EDGE",
        },
      );
  }
  // Exposed non-propulsive modules also need a deliberate aft termination.
  // Keep this short and omit covered faces; never cross a finalized exhaust reservation.
  for (const v of vs.filter(
    (v) => !b.engines.some((e) => e.parentId === v.id),
  )) {
    const end = v.position.z + v.geometry.stations.at(-1)!.z;
    const face = { ...v.position, z: end + l * 0.002 };
    if (vs.some((other) => other !== v && containsVolume(other, face)))
      continue;
    const depth = Math.min(l * 0.004, v.dimensions.z * 0.025),
      embed = Math.min(inset, depth * 0.5);
    const front = sectionRing(v, end - embed),
      rim = scaledRing(
        sectionRing(v, end),
        yard.structure === "heavy" ? 1.065 : 1.035,
      ),
      cap = scaledRing(sectionRing(v, end), 0.93, { x: 0, y: 0, z: depth });
    emit(
      "REAR_TRANSITION",
      `terminal-${v.id}`,
      [socket(v, { ...v.position, z: end }, { x: 0, y: 0, z: 1 })],
      {
        phase: "stern",
        rings: [front, rim, cap],
        contactSamples: front.map((position) => ({ parentId: v.id, position })),
        inset: embed,
        armorClass: "EDGE",
      },
    );
  }
  for (const e of b.engines) {
    const v = vs.find((v) => v.id === e.parentId)!,
      r = e.nozzleRadius * e.bellRatio;
    const length = e.nozzleLength * (0.55 + p.mobility * 0.003),
      inner = r * 1.12,
      outer = inner + r * (0.07 + yard.armor * 0.08);
    emit(
      "ENGINE_HOUSING",
      `engine-${e.id}`,
      [socket(v, e.position, { x: 0, y: 0, z: 1 })],
      {
        phase: "stern",
        tube: {
          center: { ...e.position, z: e.position.z + length * 0.5 - inset },
          length,
          innerRadius: inner,
          outerRadius: outer,
        },
        equipmentZoneId: `zone-${e.id}`,
        contactSamples: [
          {
            parentId: v.id,
            position: { ...e.position, z: e.position.z - inset },
          },
        ],
        inset,
        armorClass: "MACHINERY",
      },
    );
  }
  for (const v of vs.filter((v) =>
    b.engines.some((e) => e.parentId === v.id),
  )) {
    const end = v.position.z + v.geometry.stations.at(-1)!.z,
      front = sectionRing(v, end - inset * 2),
      back = scaledRing(sectionRing(v, end - inset * 0.15), 1.045);
    emit(
      "REAR_TRANSITION",
      `rear-${v.id}`,
      [socket(v, { ...v.position, z: end }, { x: 0, y: 0, z: 1 })],
      {
        phase: "stern",
        rings: [front, back],
        contactSamples: front.map((position) => ({ parentId: v.id, position })),
        inset,
        armorClass: "EDGE",
      },
    );
  }
  for (const e of b.engines) {
    const v = vs.find((v) => v.id === e.parentId)!,
      r = e.nozzleRadius * e.bellRatio;
    emit(
      "THRUSTER_FRAME",
      `frame-${e.id}`,
      [socket(v, e.position, { x: 0, y: 0, z: 1 })],
      {
        phase: "stern",
        tube: {
          center: { ...e.position, z: e.position.z - inset * 0.4 },
          length: inset * 1.2,
          innerRadius: r * 1.11,
          outerRadius: r * 1.35,
        },
        equipmentZoneId: `zone-${e.id}`,
        contactSamples: [
          {
            parentId: v.id,
            position: { ...e.position, z: e.position.z - inset },
          },
        ],
        inset,
        armorClass: "MACHINERY",
      },
    );
  }
}
