import type { Vec3, BoundsData, Priority } from "../blueprint/types";
import type { PanelSolid } from "../generation/armor/types";
import type { ArmorMaterialId, HullMaterialId } from "./materials";
export interface PhysicalLayer {
  layerId: string;
  layerOrder: number;
  constituentMaterialId: string;
  thicknessMm: number;
  densityKgM3: number;
  physicalRole: string;
  futureFailureModelId: string;
  volumeM3: number;
  massKg: number;
}
export interface ConvexCell {
  faces: Vec3[][];
}
export interface PhysicalFacet {
  sourceTriangle: number;
  normal: Vec3;
  planeOffsetM: number;
  areaM2: number;
  maximumThicknessMm: number;
  thicknessMm: number;
}
/** layerOrder=-1 is a complete coating cell partitioned by the stored facet/layer depth planes. */
export interface PhysicalPiece {
  facetIndex: number;
  layerOrder: number;
  solid: PanelSolid;
  volumeM3: number;
}
export interface ProtectionSurface {
  id: string;
  minimumFacetThicknessMm: number;
  maximumFacetThicknessMm: number;
  kind: "ARMOR" | "HULL";
  materialId: ArmorMaterialId | HullMaterialId;
  thicknessMm: number;
  geometryReference: {
    sourceId: string;
    parentStructureId: string;
    sourceKind: "HULL_VOLUME" | "PRODUCTION_ARMOR" | "PRODUCTION_FINISH";
  };
  protectionZoneId: "CRITICAL" | "SECONDARY" | "SHELL";
  layerStack: PhysicalLayer[];
  facets: PhysicalFacet[];
  surfaceAreaM2: number;
  physicalOuterAreaM2: number;
  volumeM3: number;
  massKg: number;
  normalEquivalentDensityKgM3: number;
  integratedMeanDensityKgM3: number;
  pieces: PhysicalPiece[];
  bounds: BoundsData;
  coverage: "FINITE_MESH";
}
export interface DesignPolicy {
  version: "1.8.6.0";
  priorityWeights: Record<Priority, number>;
  priorityMapping: {
    ARMOR: "survivability";
    MISSILES: "missile";
    SENSORS: "sensor";
  };
  targetMassBudgetKg: number;
  budgetSource: "ORDER_TARGET" | "LEGACY_ESTIMATE_AS_TARGET";
  allocationsKg: {
    structure: number;
    armor: number;
    propulsion: number;
    endurance: number;
    sensor: number;
    equipment: number;
  };
  hullMaterialPreference: HullMaterialId;
  armorMaterialPreference: ArmorMaterialId;
  criticalArmorMaterialPreference: ArmorMaterialId;
  hullThicknessMm: number;
  armorCoveragePreference: number;
  criticalZoneProtectionPreference: number;
  future: {
    status: "POLICY_ONLY_NOT_GENERATED";
    frameDensityPreference: number;
    frameRedundancyPreference: number;
    compartmentSubdivisionPreference: number;
    bulkheadProtectionPreference: number;
    systemRedundancyPreference: number;
    systemPlacementPreference: "DISTRIBUTED" | "PROTECTED_CORE";
    protectedVolumePreference: number;
    propulsionSupportPreference: number;
    fireControlProtectionPreference: number;
    missileSupportProtectionPreference: number;
    sensorSupportProtectionPreference: number;
  };
  costPreference: number;
  manufacturingTechPreference: number;
  tradeoffs: string[];
  legacyDoctrineReference: "RESERVATION_MODEL_NOT_ADDITIONAL_PHYSICAL_MASS";
}
export interface MassLedger {
 version:1;
 entries:{component:'HULL_SHELL'|'ARMOR'|'STRUCTURE'|'CORE_EQUIPMENT'|'MOUNTED_EQUIPMENT'|'PLATFORM'|'OTHER_ESTIMATED';massKg:number;source:'GEOMETRY_DERIVED'|'ESTIMATED'|'LEGACY_ESTIMATE';basis:string}[];
 baseEstimatedDryMassKg:number;
 mountedEstimatedDryMassKg:number;
 targetSemantics:'EXISTING_BASE_DESIGN_LIMIT';
 maximumAllowedMassKg:null;
 baseRemainingKg:number;
 mountedRemainingKg:number;
 baseBudgetViolation:boolean;
 mountedLoadoutOverTarget:boolean;
 operationalConsumables:'NOT_INCLUDED';
}
export interface PhysicalMass {
 ledger?:MassLedger;
  hullShellMassKg: number;
  armorMassKg: number;
  structuralMassEstimateKg: number;
  coreEquipmentMassEstimateKg: number;
  playerMountedEquipmentMassEstimateKg: number;
  unresolvedMassEstimateKg: number;
  totalEstimatedDryMassKg: number;
  targetMassKg: number;
  remainingMassKg: number;
  armorBudgetRemainingKg: number;
  manufacturingCostIndexKg: number;
  estimatedComponents: string[];
  legacyMassEstimateReplacedKg: number;
}
export interface PhysicalDesign {
  version: "1.8.6.0";
  materialRegistryVersion: 1;
  provenance: "GENERATED" | "MIGRATED_DEFAULT_ESTIMATE";
  geometryModel: "BOUNDED_NORMAL_FACET_SKINS";
  approximation: string;
  policy: DesignPolicy;
  surfaces: ProtectionSurface[];
  mass: PhysicalMass;
  warnings: string[];
  coverage: {
    method: "AREA_OF_SURVIVING_OUTER_FACET_POLYGONS";
    armorOuterAreaM2: number;
    hullOuterAreaM2: number;
    eligibleArmorAreaM2: number;
    armorRetainedFraction: number;
    criticalRetainedFraction: number;
  };
}
/** Design data remain immutable. Future localized damage belongs to each separately built instance. */
export interface ShipPhysicalInstanceState {
  instanceId: string;
  designRef: string;
  armorDamage: Record<string, { localPosition: Vec3; modelId: string }[]>;
  hullPerforations: Record<string, Vec3[]>;
}
export const createPhysicalInstanceState = (
  instanceId: string,
  designRef: string,
): ShipPhysicalInstanceState => ({
  instanceId,
  designRef,
  armorDamage: {},
  hullPerforations: {},
});
