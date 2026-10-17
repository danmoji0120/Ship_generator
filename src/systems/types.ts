import type { Vec3, ShipBlueprint } from '../blueprint/types';
import type { PanelSolid } from '../generation/armor/types';
import type { HullMaterialId } from '../physical/materials';
export type EquipmentType = 'POWER_GENERATOR' | 'POWER_DISTRIBUTION' | 'ENERGY_STORAGE' | 'COMMAND_CONTROL' | 'PROPULSION_CONTROL' | 'MANEUVER_CONTROL' | 'FIRE_CONTROL' | 'SENSOR_PROCESSING';
export type OperatingState = 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE' | 'DESTROYED';
export interface SystemDefinition {
    type: EquipmentType;
    sizeM: Vec3;
    massKg: number;
    materialId: HullMaterialId;
    massBasis: 'SPECIFICATION_DRY_MASS_NOT_HOMOGENEOUS_VOLUME';
    costIndex: number;
    demandMW: number;
    priority: number;
    capacity: number;
    capacityUnit: 'MW' | 'MJ' | 'AUTHORITY' | 'CHANNELS';
    storageOutputMW?: number;
    description: string;
}
export interface FunctionalEquipment {
    id: string;
    type: EquipmentType;
    compartmentId: string;
    parentStructuralVolumeRef: string;
    position: Vec3;
    quaternion: {
        x: number;
        y: number;
        z: number;
        w: number;
    };
    sizeM: Vec3;
    clearanceM: number;
    solid: PanelSolid;
    geometryReference: string;
    materialId: HullMaterialId;
    massKg: number;
    costIndex: number;
    specification: SystemDefinition;
    supportedEquipmentRefs: string[];
    structuralReferences: string[];
    protection: {
        armorSurfaceIds: string[];
        sampledArmorPathMm: number;
        method: 'SIX_AXIS_FINITE_SURFACE_INTERSECTIONS_NOT_SURVIVAL_PROBABILITY';
    };
    redundancyGroup: string;
    initialState: 'OPERATIONAL';
}
export interface SystemEdge {
    id: string;
    from: string;
    to: string;
    capacityMW?: number;
    compartmentRefs: string[];
    routing: 'LOGICAL_NOT_VERIFIED_CABLE_ROUTE';
}
export interface FunctionalSystemPlan {
    schemaVersion: 1;
    version: '1.8.6.3';
    registryVersion: 1;
    equipment: FunctionalEquipment[];
    powerNetwork: SystemEdge[];
    controlNetwork: SystemEdge[];
    engineRefs: string[];
    maneuverRefs: string[];
    architecturePolicy: string;
    massAccounting: {
        equipmentKg: number;
        retiredServiceEstimateKg: number;
        remainingServiceEstimateKg: number;
        basis: string;
    };
    warnings: string[];
}
export interface SystemInstanceState {
    equipmentStates: Record<string, OperatingState>;
    disabledPowerEdges: string[];
    disabledControlEdges: string[];
    storageMJ: Record<string, number>;
}
export interface ExternalSystemLoad {
    id: string;
    kind: 'WEAPON' | 'SENSOR';
    powerMW?: number;
    channels?: number;
}
export interface EquipmentCapability {
    id: string;
    state: OperatingState;
    demandMW: number;
    suppliedMW: number;
    outputMW: number;
    throughputMW: number;
    powerFraction: number;
    functionalFraction: number;
}
export interface ShipCapabilities {
    availableElectricalPowerMW: number;
    generatedPowerMW: number;
    consumedElectricalPowerMW: number;
    electricalPowerDeficitMW: number;
    commandAvailability: number;
    propulsionControlAvailability: number;
    maneuverControlAvailability: number;
    fireControlAvailability: number;
    sensorProcessingAvailability: number;
    propulsionAuthority: number;
    maneuverAuthority: number;
    availableFireControlChannels: number;
    availableSensorProcessingCapacity: number;
    activeSystemCount: number;
    offlineSystemCount: number;
    backupPowerRemainingMJ: number;
    equipment: EquipmentCapability[];
    externalLoads: {
        id: string;
        specification: 'DEFINED' | 'LEGACY_UNSPECIFIED';
        suppliedMW: number | null;
        controlFraction: number;
        operatingAvailability: number | null;
        supportedControllerIds: string[];
    }[];
    storageDispatchMW: Record<string, number>;
    storageChargeMW: Record<string, number>;
    edgeFlowsMW: Record<string, number>;
    criticalFailureWarnings: string[];
}
export const createSystemInstanceState = (p?: FunctionalSystemPlan): SystemInstanceState => ({ equipmentStates: {}, disabledPowerEdges: [], disabledControlEdges: [], storageMJ: Object.fromEntries((p?.equipment ?? []).filter(e => e.type === 'ENERGY_STORAGE').map(e => [e.id, e.specification.capacity])) });
export const installedSystemLoads = (b: ShipBlueprint): ExternalSystemLoad[] => (b.freeMountPlan?.entries ?? []).map(e => ({ id: e.id, kind: 'WEAPON', ...e.operatingSpecification }));
