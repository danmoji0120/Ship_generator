import type { ArchitectureGrammar, ShipRole } from '../blueprint/types';
import type { ArmorMaterialId, HullMaterialId } from '../physical/materials';
export const PROCUREMENT_PRIORITIES = ['ARMOR', 'MOBILITY', 'ENDURANCE', 'ECONOMY'] as const;
export type ProcurementPriority = typeof PROCUREMENT_PRIORITIES[number];
export const PROCUREMENT_CLASSES = ['Corvette', 'Frigate', 'Destroyer', 'Cruiser', 'Battlecruiser', 'Battleship', 'Patrol Ship'] as const;
export type ProcurementClass = typeof PROCUREMENT_CLASSES[number];
export type Selection<T extends string> = {
    mode: 'AUTO';
    materialId?: never;
} | {
    mode: 'PREFER' | 'REQUIRE';
    materialId: T;
};
export interface ProcurementOrder {
    version: '1.8.6.0.2';
    shipyardId: string;
    shipClass: ProcurementClass;
    lengthM: number;
    seed: number;
    targetMassKg: number;
    maximumBaseMassKg?: number;
    primaryPriority: ProcurementPriority | 'BALANCED';
    secondaryPriority?: ProcurementPriority;
    architecture: {
        mode: 'AUTO';
    } | {
        mode: 'PREFER' | 'REQUIRE';
        grammar: ArchitectureGrammar;
    };
    mainArmor: Selection<ArmorMaterialId>;
    auxiliaryArmor: Selection<ArmorMaterialId>;
    hull: Selection<HullMaterialId>;
    armorDistribution: 'CITADEL' | 'BALANCED' | 'BROAD_COVERAGE';
    /** Guaranteed only at the explicitly audited centers, not every tapered edge. */
    armorZoneRequirements: {
        zone: 'CRITICAL_ZONE';
        verification: 'EXPOSED_FACET_CENTERS';
        minimumThicknessMm: number;
    }[];
    maximumCostIndex?: number;
    availableTechLevel?: number;
}
export interface ProcurementDelivery {
    version: '1.8.6.0.2';
    order: ProcurementOrder;
    status: 'PASS' | 'COMPROMISE';
    contract: 'UNARMED_YARD_DESIGN';
    compromises: string[];
    materialDecisions: {
        field: 'mainArmor' | 'auxiliaryArmor' | 'hull';
        requested: string;
        selected: string;
        reason: string;
    }[];
    requirements: {
        id: string;
        mandatory: boolean;
        status: 'SATISFIED' | 'LIMITED';
        actual: number;
        target: number;
        unit: string;
        reason: string;
    }[];
    cost?: {
        model: 'MATERIAL_AND_FABRICATION_INDEX_V1';
        unit: 'RELATIVE_INDEX_NOT_CURRENCY';
        material: number;
        fabrication: number;
        estimatedStructureAndCore: number;
        yardProcessFactor: number;
        total: number;
        assumptions: string[];
    };
    massConfidence: 'ESTIMATE_INCLUDES_UNGENERATED_FRAME_AND_SUPPORT';
    coreSystems?: {
        propulsionIds: string[];
        navigationControlIds: string[];
        description: string;
    };
    candidateRejections?:{architecture:ArchitectureGrammar;family:string;reason:string}[];
    conversion?: {
        sourceVersion: string;
        originalRole: ShipRole;
        discardedPriorities: string[];
        equipmentHandling: 'ORIGINAL_BLUEPRINT_UNCHANGED_NEW_DESIGN_UNARMED';
        warning: string;
    };
}
