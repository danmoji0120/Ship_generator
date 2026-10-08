export const ROLES = [
  "Corvette",
  "Frigate",
  "Destroyer",
  "Cruiser",
  "Battlecruiser",
  "Battleship",
  "Missile Ship",
  "Spinal Gun Ship",
  "Patrol Ship",
] as const;
export type ShipRole = (typeof ROLES)[number];
export const PRIORITIES = [
  "firepower",
  "survivability",
  "mobility",
  "endurance",
  "missile",
  "sensor",
] as const;
export type Priority = (typeof PRIORITIES)[number];
export type MassClass = "Light" | "Standard" | "Heavy" | "Superheavy";
export interface ShipOrder {
  role: ShipRole;
  shipyardId: string;
  length: number;
  massClass: MassClass;
  priorities: Record<Priority, number>;
}
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export type Profile =
  "box" | "chamfer" | "hex" | "diamond" | "flattened" | "rounded";
export interface HullStation {
  sectionRing?: [number, number][];
  z: number;
  width: number;
  height: number;
  profile: Profile;
  topSlope: number;
  sideSlope: number;
  bottomSlope?: number;
  roundness?: number;
  bevel: number;
}
export interface HullSection {
  id: string;
  start: HullStation;
  end: HullStation;
}
export interface SecondaryStructure {
  id: string;
  kind:
    | "armor"
    | "nacelle"
    | "shoulder"
    | "missile"
    | "dorsal"
    | "ventral"
    | "supply";
  position: Vec3;
  size: Vec3;
  profile: Profile;
  parentId: string;
}
export interface EngineMount {
  direction?: Vec3;
  id: string;
  position: Vec3;
  nozzleRadius: number;
  nozzleLength: number;
  bellRatio: number;
  parentId: string;
}
export const HARDPOINT_TYPES = [
  "Small Turret",
  "Medium Turret",
  "Large Turret",
  "Missile",
  "Point Defense",
  "Spinal",
  "Sensor",
  "Utility",
] as const;
export type HardpointType = (typeof HARDPOINT_TYPES)[number];
export interface Hardpoint {
  id: string;
  type: HardpointType;
  size: "S" | "M" | "L" | "XL";
  position: Vec3;
  normal: Vec3;
  allowedCategories: string[];
  parentId: string;
  radius: number;
}
export interface Truss {
  id: string;
  start: Vec3;
  end: Vec3;
  radius: number;
  parentIds: [string, string];
}
export interface SurfaceFeature {
  id: string;
  kind: "panel" | "hatch" | "vent" | "vls" | "sensor";
  position: Vec3;
  size: Vec3;
  normal?: Vec3;
  parentId: string;
}
export interface LegacyShipBlueprint {
  schemaVersion: 1;
  seed: number;
  candidate: number;
  shipyardId: string;
  role: ShipRole;
  order: ShipOrder;
  designName: string;
  dimensions: {
    length: number;
    width: number;
    height: number;
    estimatedMass: number;
  };
  stations: HullStation[];
  hullSections: HullSection[];
  secondaryStructures: SecondaryStructure[];
  engines: EngineMount[];
  hardpoints: Hardpoint[];
  trusses: Truss[];
  surfaceFeatures: SurfaceFeature[];
  materialTheme: {
    hull: string;
    secondary: string;
    accent: string;
    engine: string;
    roughness: number;
    panelScale: number;
  };
  generationStats: {
    firepowerScore: number;
    survivabilityScore: number;
    mobilityScore: number;
    enduranceScore: number;
    missileScore: number;
    sensorScore: number;
    enginePattern: string;
  };
}

export const ARCHITECTURES = [
  "MONOLITHIC",
  "BLOCK_ASSEMBLY",
  "SPINE_AND_MODULES",
  "TRUSS_POD",
  "TWIN_HULL",
  "CORE_AND_NACELLES",
  "STACKED_BLOCKS",
  "HYBRID",
] as const;
export type ArchitectureGrammar = (typeof ARCHITECTURES)[number];
export type VolumeType =
  | "PRIMARY_HULL"
  | "HULL_BLOCK"
  | "POD"
  | "NACELLE"
  | "SPINE"
  | "ARMOR_BLOCK"
  | "DORSAL_STRUCTURE"
  | "VENTRAL_STRUCTURE";
export type VolumePrimitive =
  | "Box"
  | "Chamfered Box"
  | "Wedge"
  | "Hexagonal Prism"
  | "Tapered Box"
  | "Rounded Box"
  | "Short Loft"
  | "Long Loft";
export type NoseArchitecture =
  | "pointed"
  | "blunt armored"
  | "wedge"
  | "split nose"
  | "spinal muzzle"
  | "sensor nose"
  | "block nose"
  | "tapered industrial";
export const SHAPE_KINDS = [
  "BOX",
  "CHAMFERED_BOX",
  "WEDGE",
  "TAPERED_PRISM",
  "HEX_PRISM",
  "FLATTENED_HEX",
  "ARMORED_CYLINDER",
  "CLIPPED_BOX",
  "SHORT_LOFT",
  "LONG_LOFT",
  "COMPOUND_LOFT",
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];
/** Local +Z is aft. Stations are derived from these parameters, never from a Mesh. */
export interface ShapeDefinition {
  kind: ShapeKind;
  length: number;
  width: number;
  height: number;
  frontScale: number;
  rearScale: number;
  topSlope: number;
  bottomSlope: number;
  sideSlope: number;
  chamfer: number;
  roundness: number;
  frontProfile: Profile;
  rearProfile: Profile;
  taper: number;
  waist: number;
  shoulder: number;
}
export const JOIN_TYPES = [
  "FLUSH",
  "OVERLAP",
  "ARMORED_COLLAR",
  "STRUCTURAL_NECK",
  "TRANSITION",
  "RECESSED",
  "TRUSS",
  "BOOM",
  "BRIDGE",
  "NACELLE_MOUNT",
] as const;
export type JoinType = (typeof JOIN_TYPES)[number];
export interface JoinDefinition {
  type: JoinType;
  length: number;
  width: number;
  height: number;
  overlap: number;
  inset: number;
  transitionRatio: number;
  armorScale: number;
  supportScale: number;
  styleVariant: number;
  supportLoad: number;
}
export interface StructuralVolume {
  id: string;
  type: VolumeType;
  purpose:
    | "habitat"
    | "weapon"
    | "propulsion"
    | "axial-weapon"
    | "command"
    | "armor"
    | "sensor"
    | "supply";
  position: Vec3;
  rotation: Vec3;
  dimensions: Vec3;
  shape?: ShapeDefinition;
  hierarchyTier?: 1 | 2 | 3;
  geometry: { primitive: VolumePrimitive; stations: HullStation[] };
  connectionIds: string[];
}
export interface StructuralConnector {
  id: string;
  fromStructureId: string;
  toStructureId: string;
  type: "DIRECT" | "TRUSS" | "BOOM" | "BRIDGE" | "NACELLE_MOUNT";
  start: Vec3;
  end: Vec3;
  thickness: number;
  join?: JoinDefinition;
  style:
    | "armored collar"
    | "straight beam"
    | "double beam"
    | "triangular truss"
    | "box truss";
}
export interface SilhouetteMetrics {
  massHierarchy?: {
    primaryRatio: number;
    foreRatio: number;
    aftRatio: number;
    lateralSpread: number;
    verticalSpread: number;
    joinDistribution: Partial<Record<JoinType, number>>;
  };
  slenderness: number;
  majorVolumeCount: number;
  occupancy: { front: number; side: number; top: number };
  symmetry: number;
  disconnectedPenalty: number;
}
export interface ShipBlueprint extends Omit<
  LegacyShipBlueprint,
  "schemaVersion"
> {
  schemaVersion: 2;
  generatorVersion: "1.0" | "1.5";
  architecture: {
    composition?: string;
    source?: "order" | "qa-fixed";
    grammar: ArchitectureGrammar;
    requestedGrammar: ArchitectureGrammar;
    components: ArchitectureGrammar[];
    rootVolumeId: string;
    nose: NoseArchitecture;
    engineArchitecture: string;
    selectionWeights: Record<ArchitectureGrammar, number>;
    parameters: { volumeBudget: number; beamRatio: number; armorRatio: number };
    fallbackReason?: string;
  };
  structuralVolumes: StructuralVolume[];
  structuralConnectors: StructuralConnector[];
  silhouette: SilhouetteMetrics;
}
export type AnyShipBlueprint = ShipBlueprint | LegacyShipBlueprint;
