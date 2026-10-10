import { Vector3 } from "three";
export type WeaponSize = "S" | "M" | "L" | "XL";
export type WeaponKind = "MISSILE" | "SPINAL" | "TURRET";
export type ControlMode = 1 | 2 | 3;
export type PartKind =
  "hull" | "armor" | "engine" | "missile" | "spinal" | "turret" | "core";
export interface PartDefinition {
  id: string;
  kind: PartKind;
  center: Vector3;
  size: Vector3;
  hp: number;
  resistance: number;
}
export interface ShipDefinition {
  name: string;
  parts: PartDefinition[];
  weapons: { kind: WeaponKind; size: WeaponSize; partId: string }[];
}
// Conversion boundary only: generator data is neither imported nor modified.
export interface BlueprintAdapter<T> {
  convert(blueprint: T): ShipDefinition;
}
const part = (
  id: string,
  kind: PartKind,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  hp: number,
  resistance = 0,
): PartDefinition => ({
  id,
  kind,
  center: new Vector3(x, y, z),
  size: new Vector3(w, h, d),
  hp,
  resistance,
});
export const TEST_SHIP: ShipDefinition = {
  name: "Aegis / strike battleship",
  parts: [
    part("core", "core", 0, 0, 2, 12, 9, 22, 600, 8),
    part("hull", "hull", 0, 0, 0, 20, 12, 56, 350, 12),
    part("bow", "armor", 0, 0, -26, 23, 15, 8, 110, 35),
    part("port", "armor", -11, 0, 0, 4, 16, 43, 100, 30),
    part("starboard", "armor", 11, 0, 0, 4, 16, 43, 100, 30),
    part("deck", "armor", 0, 7, 0, 21, 3, 42, 100, 28),
    part("belly", "armor", 0, -7, 0, 21, 3, 42, 100, 28),
    part("engine-l", "engine", -7, 0, 30, 8, 10, 12, 100, 8),
    part("engine-r", "engine", 7, 0, 30, 8, 10, 12, 100, 8),
    part("spinal", "spinal", 0, 0, -36, 5, 5, 24, 100, 12),
    part("missile-l", "missile", -15, 2, 7, 6, 7, 16, 75, 8),
    part("missile-r", "missile", 15, 2, 7, 6, 7, 16, 75, 8),
    part("turret-top", "turret", 0, 11, -9, 7, 5, 8, 70, 8),
    part("turret-bottom", "turret", 0, -11, -9, 7, 5, 8, 70, 8),
  ],
  weapons: [
    { kind: "SPINAL", size: "XL", partId: "spinal" },
    { kind: "MISSILE", size: "M", partId: "missile-l" },
    { kind: "MISSILE", size: "M", partId: "missile-r" },
    { kind: "TURRET", size: "L", partId: "turret-top" },
    { kind: "TURRET", size: "L", partId: "turret-bottom" },
  ],
};
