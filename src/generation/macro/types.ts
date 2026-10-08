import type {
  ArchitectureGrammar,
  ShapeDefinition,
  StructuralVolume,
  Vec3,
} from "../../blueprint/types";
export const MACRO_FAMILIES = [
  "WEDGE_CITADEL",
  "HAMMERHEAD",
  "SPLIT_FRAME",
  "WIDE_CARRIER",
  "ENGINE_DOMINANT",
  "WEAPON_DOMINANT",
] as const;
export type MacroFamily = (typeof MACRO_FAMILIES)[number];
export interface MacroModulePlan {
  id: string;
  role: "dominant" | "supporting" | "functional" | "connection";
  purpose: StructuralVolume["purpose"];
  position: Vec3;
  dimensions: Vec3;
  shape: ShapeDefinition;
}
export interface MacroMeasurement {
  /** Sum of station polygon integrals. Overlapped material is counted once per module, not a CSG union. */
  approximateVolumeM3: number;
  densityTonnesPerM3: number;
  estimatedMassTonnes: number;
  primaryMassRatio: number;
  foreMassRatio: number;
  midMassRatio: number;
  aftMassRatio: number;
  lateralSpread: number;
  verticalSpread: number;
  centerOfVolume: Vec3;
  moduleVolumesM3: Record<string, number>;
}
export interface MacroDesignPlan extends MacroMeasurement {
  family: MacroFamily;
  architecture: ArchitectureGrammar;
  composition: string;
  dominantMassRegion:
    | "fore"
    | "mid"
    | "aft"
    | "lateral"
    | "distributed"
    | "axis";
  structuralAxis: "+Z aft; -Z bow; X lateral; Y dorsal";
  negativeSpaceTargets: {
    id: string;
    center: Vec3;
    size: Vec3;
    purpose: string;
  }[];
  majorModuleRoles: MacroModulePlan[];
  symmetryPolicy: "BILATERAL" | "FUNCTIONAL_OFFSET";
  silhouetteParameters: {
    beam: number;
    depth: number;
    neckRatio: number;
    machineryBudget: number;
    weaponBudget: number;
    supplyBudget: number;
    sensorBudget: number;
  };
  selectedVariant: string;
  generationSeed: number;
  source: "order" | "qa-fixed";
  realized?: MacroMeasurement;
  attempts?: {
    candidate: number;
    family: MacroFamily;
    architecture: ArchitectureGrammar;
    reasons: string[];
    structures: string[];
    replacement: false;
  }[];
}
