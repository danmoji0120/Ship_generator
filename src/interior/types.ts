import type { Vec3, BoundsData, ArchitectureGrammar } from '../blueprint/types';
import type { PanelSolid } from '../generation/armor/types';
import type { HullMaterialId } from '../physical/materials';
export type OpeningState = 'OPEN' | 'CLOSED' | 'SEALED' | 'BLOCKED';
export interface OccupancyRef {
    id: string;
    kind: 'SKIN' | 'FRAME_ENVELOPE' | 'CORE';
    ownerId: string;
    index: number;
    partIndex?: number;
}
export interface InteriorCompartment {
    id: string;
    parentStructuralVolumeRef: string;
    architectureRegionRef: string;
    /** Finite positive cells minus the referenced occupied material. These are NOT filled room boxes. */
    extractionAudit: { candidateDomainVolumeM3:number; excludedSolidVolumeM3:number; unresolvedVoidVolumeM3:number; significantOtherComponents:number };
    physicalVolume: {
        model: 'FINITE_CONNECTED_CSG_COMPONENT';
        domains: PanelSolid[];
        connectedCells: PanelSolid[];
        occupiedRefs: string[];
    };
    volumeM3: number;
    occupiedVolumeM3: number;
    domainVolumeM3: number;
    centroid: Vec3;
    localBounds: BoundsData;
    worldTransformReference: 'SHIP_LOCAL_RIGID_TRANSFORM';
    boundaryReferences: string[];
    adjacentCompartmentIds: string[];
    openingReferences: string[];
    structuralFrameReferences: string[];
    hullShellReferences: string[];
    pressureCapability: 'PRESSURIZABLE' | 'UNPRESSURIZED' | 'EXPOSED';
    boundaryCertainty: 'FINITE_MATERIAL_CLOSURE' | 'OPEN_TO_EXTERIOR' | 'UNRESOLVED';
    grammar: string;
    partitionAxis: 'y' | 'z';
    partitionRange: [
        number,
        number
    ];
    exteriorPatches: Vec3[][];
    unresolvedBoundaryReasons: string[];
    futureSystemPlacement: {
        status: 'SPACE_QUERY_ONLY_NO_SYSTEMS_GENERATED';
        requireFiniteCsgCollision: true;
        bulkheadRefs: string[];
    };
}
export interface InteriorBoundary {
    id: string;
    kind: 'BULKHEAD' | 'FREE_INTERFACE' | 'EXTERIOR_GAP';
    compartmentIds: string[];
    polygons: Vec3[][];
    normal: Vec3;
    bulkheadRef?: string;
    openingRefs: string[];
}
export interface Bulkhead {
    id: string;
    boundaryReference: string;
    materialId: HullMaterialId;
    thicknessMm: number;
    stockEnvelope: PanelSolid[];
    pieces: PanelSolid[];
    volumeM3: number;
    massKg: number;
    grossAreaM2: number;
    adjacentCompartmentIds: [
        string,
        string
    ];
    pressureTight: boolean;
    protective: boolean;
    loadBearing: boolean;
    roles: ('SEPARATION' | 'PRESSURE_BOUNDARY' | 'INTERNAL_PROTECTION' | 'STRUCTURAL_SUPPORT')[];
    openingIds: string[];
    structuralAttachmentRefs: string[];
    hullShellRefs: string[];
    geometryApproximationInfo: string;
}
export interface InteriorOpening {
    id: string;
    type: 'DOOR' | 'HATCH' | 'PASSAGE' | 'EXTERIOR_OPENING';
    boundaryReference: string;
    fromCompartmentId: string;
    toCompartmentId: string | 'EXTERIOR';
    aperture: PanelSolid[];
    aperturePolygons: Vec3[][];
    apertureAreaM2: number;
    frameReference: string | null;
    closure: {
        id: string;
        materialId: HullMaterialId;
        thicknessMm: number;
        pieces: PanelSolid[];
        volumeM3: number;
        massKg: number;
    } | null;
    defaultState: OpeningState;
    pressureSealingCapability: boolean;
}
export interface InteriorGraphEdge {
    id: string;
    from: string;
    to: string;
    boundaryRef: string;
    openingRef: string;
}
export interface IsolationAnalysis {
    accessGroups: string[][];
    pressureGroups: string[][];
    exteriorConnectedCompartmentIds: string[];
    exteriorPaths: Record<string, string[]>;
    /** Topologically disconnected groups. Any group containing uncertainCompartmentIds is NOT certified airtight. */
    isolatedGroups: string[][];
    exposedVolumeM3: number;
    exposureRatio: number;
    uncertainCompartmentIds: string[];
    warnings: string[];
}
export interface CompartmentPlan {
    schemaVersion: 1;
    version: '1.8.6.2';
    sourceSignature: string;
    architecture: ArchitectureGrammar;
    compartments: InteriorCompartment[];
    boundaries: InteriorBoundary[];
    bulkheads: Bulkhead[];
    openings: InteriorOpening[];
    occupancy: OccupancyRef[];
    unresolvedVoidPockets: {id:string;candidateCompartmentId:string;volumeM3:number;bounds:BoundsData;reason:string}[];
    adjacency: {
        from: string;
        to: string;
        boundaryRef: string;
    }[];
    /** Real portal definitions; opening states are evaluated separately by analyzeInterior. */
    accessGraph: InteriorGraphEdge[];
    pressureGraphDefinition: InteriorGraphEdge[];
    exteriorNode: 'EXTERIOR';
    analysis: IsolationAnalysis;
    spatialAccounting: {
        compartmentVoidM3: number;
        openBulkheadPortalVoidM3: number;
        note: string;
    };
    regions: {
        volumeId: string;
        state: 'EXTRACTED' | 'SOLID_OR_EXPOSED' | 'UNRESOLVED';
        reason: string;
        grammar: string;
    }[];
    budgetAccounting: {
        structureAllowanceKg: number;
        knownStructureUseKg: number;
        remainingStructureAllowanceKg: number;
        unfundedReservationKg: number;
        note: string;
    };
    massAccounting: {
        bulkheadMassKg: number;
        closureMassKg: number;
        materialVolumeM3: number;
        remainingEstimateTreatment: string;
        source: 'GEOMETRY_DERIVED_FINITE_UNION';
    };
    policy: {
        primary: string;
        materialId: HullMaterialId;
        thicknessMm: number;
        maxPartitions: number;
        sealing: 'ISOLATED' | 'MIXED' | 'OPEN_PASSAGES';
        reason: string[];
    };
    approximation: {
        model: 'FACETED_HULL_CSG';
        toleranceM: number;
        volumeRelativeTolerance: number;
        hullModelLimitations: string[];
        sealModel: 'IDEAL_FINITE_CONTACT_NOT_ENGINEERING_CERTIFICATION';
    };
    validationWarnings: string[];
}
/** Independent future instance boundary. No live pressure, health or material destruction is simulated. */
export interface InteriorInstanceState {
    openingStates: Record<string, OpeningState>;
    disabledBulkheadIds: string[];
    hypotheticalHullBreaches: {
        compartmentId: string;
        exteriorPatchIndex: number;
    }[];
}
export const createInteriorInstanceState = (): InteriorInstanceState => ({ openingStates: {}, disabledBulkheadIds: [], hypotheticalHullBreaches: [] });
