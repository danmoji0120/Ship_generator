import type { EquipmentModule } from "../generation/hardpoint-system/types";
export interface PreviewEquipment extends EquipmentModule {
  name: string;
  kind: "GUN" | "MISSILE";
  caliberMm?: number;
  tubes: number;
  body: { width: number; height: number; length: number; z: number };
  barrel: { length: number; radius: number };
  pivotHeight: number;
  yaw: number[];
  elevation: number[];
  launchRange: number;
  /** Interface proxies only; no load-bearing, power, feed or ammunition simulation. */
  physics: "NOT_SIMULATED";
}
function gun(
  id: string,
  name: string,
  size: EquipmentModule["size"],
  caliberMm: number,
  tubes: number,
  w: number,
  l: number,
  h: number,
  z: number,
  barrel: number,
  foot: [number, number],
  env: [number, number, number],
  internal: number,
): PreviewEquipment {
  return {
    id,
    name,
    size,
    kind: "GUN",
    mountType: "TURRET",
    caliberMm,
    tubes,
    body: { width: w, height: h, length: l, z },
    barrel: { length: barrel, radius: caliberMm / 2000 + 0.12 },
    pivotHeight: 1 + h * 0.55,
    footprint: { width: foot[0], length: foot[1] },
    envelope: { width: env[0], height: env[1], length: env[2] },
    internalVolumeM3: internal,
    powerInterfaceIndex: { S: 1, M: 3, L: 8, XL: 18 }[size],
    componentCount: tubes,
    clearanceMeters: 2,
    yaw: Array.from({ length: 13 }, (_, i) => -180 + i * 30),
    elevation: [0, 20, 45, 70],
    launchRange: 60,
    physics: "NOT_SIMULATED",
  };
}
function missile(
  id: string,
  name: string,
  size: EquipmentModule["size"],
  tubes: number,
  w: number,
  l: number,
  h: number,
): PreviewEquipment {
  return {
    id,
    name,
    size,
    kind: "MISSILE",
    mountType: "MISSILE",
    tubes,
    body: { width: w, height: h, length: l, z: 0 },
    barrel: { length: l, radius: 0.35 },
    pivotHeight: 1,
    footprint: { width: w, length: l },
    envelope: { width: w + 0.4, height: h + 1.4, length: l + 0.4 },
    internalVolumeM3: w * l * 0.25,
    powerInterfaceIndex: { S: 1, M: 3, L: 8, XL: 18 }[size],
    componentCount: tubes,
    clearanceMeters: 2,
    yaw: [0],
    elevation: [90], // Fixed launch tubes point along the local outward normal.
    launchRange: 35,
    physics: "NOT_SIMULATED",
  };
}
/** Physical meters; caliber and mount rating remain independent. Not scaled with ship length. */
export const PREVIEW_EQUIPMENT: readonly PreviewEquipment[] = [
  gun(
    "gun-105",
    "105mm rapid gun",
    "S",
    105,
    1,
    3.2,
    3.2,
    1.6,
    0.6,
    3.2,
    [3.5, 4],
    [4, 4.8, 7.8],
    3,
  ),
  gun(
    "gun-210",
    "210mm twin turret",
    "M",
    210,
    2,
    8,
    8,
    3.8,
    2,
    8.4,
    [8.5, 10],
    [10, 12, 20],
    35,
  ),
  gun(
    "gun-406",
    "406mm twin turret",
    "L",
    406,
    2,
    20,
    18,
    7,
    5,
    17,
    [21, 24],
    [24, 15, 41],
    240,
  ),
  gun(
    "gun-500",
    "500mm single turret",
    "L",
    500,
    1,
    20,
    18,
    8,
    5,
    17,
    [21, 24],
    [24, 16, 41],
    260,
  ),
  missile("missile-small", "Compact 6-tube launcher", "S", 6, 3, 4, 2.8),
  missile("missile-medium", "Medium 12-cell launcher", "M", 12, 8, 10, 5),
  missile("missile-large", "Heavy 24-cell launcher", "L", 24, 19, 22, 9),
];
