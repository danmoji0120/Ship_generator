import type { MacroFamily } from "./types";
export interface DesignLanguage {
  weights: Record<MacroFamily, number>;
  beam: number;
  depth: number;
  machinery: number;
  gap: number;
  taper: number;
  offsetEquipment: boolean;
}
/** Geometry doctrine, independent of paint / panel density. */
export const DESIGN_LANGUAGES: Record<string, DesignLanguage> = {
  aegis: {
    weights: {
      WEDGE_CITADEL: 6,
      HAMMERHEAD: 5,
      SPLIT_FRAME: 1,
      WIDE_CARRIER: 3,
      ENGINE_DOMINANT: 2,
      WEAPON_DOMINANT: 3,
    },
    beam: 1.14,
    depth: 1.2,
    machinery: 0.92,
    gap: 0.8,
    taper: 0.65,
    offsetEquipment: false,
  },
  vesper: {
    weights: {
      WEDGE_CITADEL: 2,
      HAMMERHEAD: 2,
      SPLIT_FRAME: 5,
      WIDE_CARRIER: 2,
      ENGINE_DOMINANT: 7,
      WEAPON_DOMINANT: 4,
    },
    beam: 0.8,
    depth: 0.85,
    machinery: 1.2,
    gap: 1.15,
    taper: 1.25,
    offsetEquipment: false,
  },
  forge: {
    weights: {
      WEDGE_CITADEL: 2,
      HAMMERHEAD: 4,
      SPLIT_FRAME: 7,
      WIDE_CARRIER: 5,
      ENGINE_DOMINANT: 4,
      WEAPON_DOMINANT: 2,
    },
    beam: 1,
    depth: 1.1,
    machinery: 1.08,
    gap: 1.25,
    taper: 0.8,
    offsetEquipment: true,
  },
  serein: {
    weights: {
      WEDGE_CITADEL: 6,
      HAMMERHEAD: 2,
      SPLIT_FRAME: 2,
      WIDE_CARRIER: 5,
      ENGINE_DOMINANT: 3,
      WEAPON_DOMINANT: 5,
    },
    beam: 1.1,
    depth: 0.72,
    machinery: 1,
    gap: 0.9,
    taper: 1.05,
    offsetEquipment: false,
  },
};
