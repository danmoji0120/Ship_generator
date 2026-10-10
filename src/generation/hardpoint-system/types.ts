import type { BoundsData, Vec3 } from "../../blueprint/types";
import type { MountFrame, MountSize, SurfaceContact } from "../weapons/types";
export const MOUNT_TYPES = [
  "TURRET",
  "FIXED",
  "MISSILE",
  "SPINAL",
  "UTILITY",
  "DEFENSIVE",
] as const;
export type ModularMountType = (typeof MOUNT_TYPES)[number];
export const SLOT_REGIONS = [
  "TOP",
  "BOTTOM",
  "PORT",
  "STARBOARD",
  "FORE",
  "AFT",
] as const;
export type SlotRegion = (typeof SLOT_REGIONS)[number];
export type HardpointDensity = "SPARSE" | "STANDARD" | "DENSE";
export interface HardpointRequest {
  id: string;
  type: ModularMountType;
  size: MountSize;
  count: number;
  mandatory: boolean;
  priority: number;
  region?: SlotRegion;
  parentId?: string;
  direction?: Vec3;
}
export interface SlotBox {
  position: Vec3;
  frame: MountFrame;
  localBounds: BoundsData;
}
export interface ModularSlot {
  state: "EMPTY" | "OCCUPIED";
  mountTypes: ModularMountType[];
  region: SlotRegion;
  localPosition: Vec3;
  frame: MountFrame;
  contacts: SurfaceContact[];
  footprint: { width: number; length: number };
  envelope: SlotBox;
  internal?: SlotBox;
  internalVolumeM3: number;
  interface: {
    power: "RESERVED_INTERFACE_NOT_SIMULATED";
    ratingIndex: number;
    spinalReservationId?: string;
  };
  clearanceMeters: number;
}
export interface ModularHardpointPlan {
  version: "1.8.5.4";
  density: HardpointDensity;
  target: number;
  limit: number;
  /** Contained within existing structure allocation, not additional ship capacity. */
  budget: {
    sector: "structure";
    method: string;
    availableM3: number;
    reservedM3: number;
    byHost: Record<string, { availableM3: number; reservedM3: number }>;
  };
  requests: {
    request: HardpointRequest;
    matchedIds: string[];
    missing: number;
    status: "SATISFIED" | "LIMITED" | "FAILED";
    reason: string;
  }[];
  diagnostics: {
    candidates: number;
    rejections: Record<string, number>;
    surfaceAreaM2: number;
    stopReason: string;
  };
  summary: {
    total: number;
    empty: number;
    occupied: number;
    bySize: Record<MountSize, number>;
    byType: Record<ModularMountType, number>;
    byRegion: Record<SlotRegion, number>;
  };
}
/** Size is installation scale, independent of damage or number of barrels. */
export interface EquipmentModule {
  id: string;
  size: MountSize;
  mountType: ModularMountType;
  footprint: { width: number; length: number };
  envelope: { width: number; height: number; length: number };
  internalVolumeM3: number;
  powerInterfaceIndex: number;
  componentCount: number;
  /** Optional required outward world direction. Default acceptance cone: 15 degrees. */
  requiredDirection?: Vec3;
  maxDirectionDeviationDegrees?: number;
  clearanceMeters: number;
}
