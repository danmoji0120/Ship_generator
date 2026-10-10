import type { Hardpoint } from "../../blueprint/types";
import type { MountSize } from "../weapons/types";
import { mountStandard } from "../weapons/standards";
import type {
  EquipmentModule,
  HardpointRequest,
  ModularMountType,
} from "./types";
export const SIZE_RANK: Record<MountSize, number> = { S: 0, M: 1, L: 2, XL: 3 };
/** Surface XL uses the unchanged dimensions, while integrated XL retains its separate axial contract. */
export function slotStandard(size: MountSize, length: number) {
  return { ...mountStandard(size, length), mode: "SURFACE" as const };
}
export function moduleCompatibility(slot: Hardpoint, e: EquipmentModule) {
  const m = slot.modular,
    issues: string[] = [];
  if (!m)
    return {
      allowed: false,
      reasons: [
        "Historical slot has no prepared modular installation contract",
      ],
    };
  if (m.state !== "EMPTY") issues.push("Slot occupied");
  if (SIZE_RANK[e.size] > SIZE_RANK[slot.size])
    issues.push("Equipment exceeds slot size");
  if (!m.mountTypes.includes(e.mountType))
    issues.push("Incompatible mounting type");
  if (e.mountType === "SPINAL" && !m.interface.spinalReservationId)
    issues.push("No integrated axis, breech or muzzle contract");
  if (e.requiredDirection) {
    const d = e.requiredDirection, a = e.maxDirectionDeviationDegrees ?? 15;
    if (![d.x, d.y, d.z].every(Number.isFinite) ||
      Math.abs(Math.hypot(d.x, d.y, d.z) - 1) > 1e-5 ||
      !Number.isFinite(a) || a < 0 || a > 180)
      issues.push("Invalid equipment direction requirement");
    else if (slot.normal.x*d.x + slot.normal.y*d.y + slot.normal.z*d.z < Math.cos(a*Math.PI/180))
      issues.push("Incompatible mounting direction");
  }
  const b = m.envelope.localBounds;
  if (
    e.footprint.width > m.footprint.width ||
    e.footprint.length > m.footprint.length ||
    e.envelope.width > b.max.x - b.min.x + 1e-6 ||
    e.envelope.length > b.max.z - b.min.z + 1e-6 ||
    e.envelope.height > b.max.y - b.min.y + 1e-6
  )
    issues.push(
      "Equipment footprint / operating envelope exceeds reserved space",
    );
  if (e.internalVolumeM3 > m.internalVolumeM3 + 1e-6)
    issues.push("Insufficient prepared internal space");
  if (e.powerInterfaceIndex > m.interface.ratingIndex)
    issues.push(
      "Interface rating exceeded (abstract design index, not simulated power)",
    );
  if (e.clearanceMeters > m.clearanceMeters + 1e-6)
    issues.push("Requested outward access exceeds verified clearance");
  if (
    !Object.hasOwn(SIZE_RANK, e.size) ||
    !["TURRET", "FIXED", "MISSILE", "SPINAL", "UTILITY", "DEFENSIVE"].includes(
      e.mountType,
    ) ||
    !Number.isInteger(e.componentCount) ||
    e.componentCount < 1 ||
    Object.values(e.envelope).some((x) => !Number.isFinite(x) || x <= 0) ||
    !Number.isFinite(e.internalVolumeM3) ||
    e.internalVolumeM3 < 0 ||
    !Number.isFinite(e.powerInterfaceIndex) ||
    e.powerInterfaceIndex < 0 ||
    !Number.isFinite(e.clearanceMeters) ||
    e.clearanceMeters < 0 ||
    Object.values(e.footprint).some((x) => !Number.isFinite(x) || x <= 0)
  )
    issues.push("Invalid equipment module");
  return { allowed: !issues.length, reasons: issues };
}
export function matchesRequest(h: Hardpoint, r: HardpointRequest) {
  return (
    !!h.modular &&
    SIZE_RANK[h.size] >= SIZE_RANK[r.size] &&
    h.modular.mountTypes.includes(r.type) &&
    (!r.region || h.modular.region === r.region) &&
    (!r.parentId || h.parentId === r.parentId) &&
    (!r.direction ||
      h.normal.x * r.direction.x +
        h.normal.y * r.direction.y +
        h.normal.z * r.direction.z >=
        0.85)
  );
}
