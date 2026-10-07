import type {
  ShipOrder,
  HullStation,
  SecondaryStructure,
  Hardpoint,
  HardpointType,
  SurfaceFeature,
} from "../blueprint/types";
import { exposedSurface } from "./attachment";
import type { Shipyard } from "../shipyards/config";
import type { SeededRng } from "../random/rng";
import { ROLE_RULES, stationAt, topAt, hullSurfaceAt } from "./hull";
export function generateHardpoints(
  order: ShipOrder,
  yard: Shipyard,
  stations: HullStation[],
  modules: SecondaryStructure[],
  rng: SeededRng,
) {
  const l = order.length,
    p = order.priorities,
    h: Hardpoint[] = [],
    features: SurfaceFeature[] = [];
  const add = (
    type: HardpointType,
    x: number,
    y: number,
    z: number,
    parentId = "hull",
    normal = { x: 0, y: 1, z: 0 },
  ) => {
    if (type !== "Spinal") {
      const surface = exposedSurface(stations, modules, x, z);
      parentId = surface.parentId;
      y = surface.y;
      normal = surface.normal;
    }
    const size =
      type === "Spinal"
        ? "XL"
        : type === "Large Turret"
          ? "L"
          : type === "Medium Turret"
            ? "M"
            : "S";
    h.push({
      id: `mount-${h.length}`,
      type,
      size,
      position: { x, y, z },
      normal,
      allowedCategories:
        type === "Spinal"
          ? ["spinal-energy", "spinal-kinetic"]
          : type === "Missile"
            ? ["missile"]
            : type === "Sensor"
              ? ["sensor", "electronic-warfare"]
              : type === "Utility"
                ? ["utility"]
                : ["turret"],
      parentId,
      radius:
        l *
        (size === "XL"
          ? 0.018
          : size === "L"
            ? 0.019
            : size === "M"
              ? 0.013
              : 0.008),
    });
  };
  const budget = Math.round(
    ROLE_RULES[order.role].budget * (0.35 + p.firepower * 0.012),
  );
  // Top mounts stay on the planar central portion of the section profile.
  for (let i = 0; i < budget; i++) {
    const z = l * (-0.26 + (i / Math.max(1, budget - 1)) * 0.55),
      s = stationAt(stations, z),
      side = i % 2 === 0 ? -1 : 1;
    add(
      p.firepower > 70 && i % 4 === 0
        ? "Large Turret"
        : i % 3 === 0
          ? "Small Turret"
          : "Medium Turret",
      side * s.width * 0.07,
      topAt(stations, z),
      z,
    );
  }
  const missileCount =
    Math.round(p.missile / 12) + (order.role === "Missile Ship" ? 10 : 0);
  const pods = modules.filter((m) => m.kind === "missile");
  for (let i = 0; i < missileCount; i++) {
    const m = pods[i % Math.max(1, pods.length)],
      row = Math.floor(i / 2);
    if (m) {
      const z =
        m.position.z -
        m.size.z * 0.32 +
        (row / Math.max(1, Math.ceil(missileCount / 2) - 1)) * m.size.z * 0.64;
      add("Missile", m.position.x, m.position.y + m.size.y * 0.475, z, m.id);
    } else {
      const z = l * (-0.12 + (i / Math.max(1, missileCount - 1)) * 0.34),
        s = stationAt(stations, z);
      add("Missile", (i % 2 ? -1 : 1) * s.width * 0.14, topAt(stations, z), z);
    }
  }
  for (let i = 0; i < 2 + Math.floor(p.survivability / 25); i++) {
    const z = l * (-0.18 + i * 0.09);
    add(
      "Point Defense",
      (i % 2 ? -1 : 1) * stationAt(stations, z).width * 0.12,
      topAt(stations, z),
      z,
    );
  }
  const dorsal = modules.find((m) => m.kind === "dorsal")!;
  for (let i = 0; i < 1 + Math.floor(p.sensor / 25); i++)
    add(
      "Sensor",
      (i - Math.floor(p.sensor / 25) / 2) * dorsal.size.x * 0.12,
      dorsal.position.y + dorsal.size.y * 0.475,
      dorsal.position.z,
      dorsal.id,
    );
  add("Utility", 0, topAt(stations, l * 0.31), l * 0.31);
  if (order.role === "Spinal Gun Ship" || p.firepower > 92)
    add("Spinal", 0, 0, stations[0].z, "hull", { x: 0, y: 0, z: -1 });
  // Section-aware repeating panels, never arbitrary floating noise.
  for (let i = 1; i < stations.length - 1; i++) {
    const s = stations[i];
    for (const side of [-1, 1])
      features.push({
        id: `detail-${features.length}`,
        kind: i % 3 === 0 ? "vent" : "panel",
        position: {
          x: side * s.width * 0.18,
          y: hullSurfaceAt(stations, s.z, side * s.width * 0.18).y + l * 0.001,
          z: s.z,
        },
        normal: hullSurfaceAt(stations, s.z, side * s.width * 0.18).normal,
        size: { x: s.width * 0.14, y: l * 0.001, z: l * 0.026 },
        parentId: "hull",
      });
  }
  for (const mount of h.filter((m) => m.type === "Missile"))
    features.push({
      id: `detail-${features.length}`,
      kind: "vls",
      position: { ...mount.position, y: mount.position.y + l * 0.003 },
      size: { x: l * 0.019, y: l * 0.002, z: l * 0.028 },
      normal: mount.normal,
      parentId: mount.parentId,
    });
  for (const m of modules.filter((m) => m.kind === "supply"))
    for (let i = 0; i < 3; i++)
      features.push({
        id: `detail-${features.length}`,
        kind: "hatch",
        position: {
          x: m.position.x,
          y: m.position.y + m.size.y * 0.475,
          z: m.position.z + (i - 1) * m.size.z * 0.2,
        },
        size: { x: m.size.x * 0.5, y: l * 0.001, z: m.size.z * 0.12 },
        parentId: m.id,
      });
  // Variation chooses coherent finish rather than placement jitter.
  void yard;
  void rng;
  return { hardpoints: h, surfaceFeatures: features };
}
