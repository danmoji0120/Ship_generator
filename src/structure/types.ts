import type { Vec3, BoundsData, ArchitectureGrammar } from '../blueprint/types';
import type { PanelSolid } from '../generation/armor/types';
import type { HullMaterialId } from '../physical/materials';
export type MemberRole = 'PRIMARY_LONGITUDINAL' | 'TRANSVERSE_FRAME' | 'REINFORCEMENT' | 'TRUSS_MEMBER' | 'STRUCTURAL_CONNECTOR' | 'STRUCTURAL_SUPPORT';
export interface FrameMember {
    id: string;
    type: MemberRole;
    hostIds: string[];
    start: Vec3;
    end: Vec3;
    /** Span between connection points. Full reused stock extent is in envelope/bounds. */
    lengthM: number;
    section: {
        kind: 'SOLID_RECTANGLE' | 'SOLID_HEXAGON' | 'STATION_LOFT';
        widthM: number;
        heightM: number;
    };
    materialId: HullMaterialId;
    densityKgM3: number;
    geometryReference: {
        kind: 'GENERATED_INTERNAL' | 'EXISTING_CONNECTOR';
        sourceId: string;
        partId: string;
        fragment?: number;
    };
    /** Original construction cells define weld contacts; exclusive pieces own material exactly once. */
    envelope: PanelSolid[];
    pieces: PanelSolid[];
    bounds: BoundsData;
    volumeM3: number;
    massKg: number;
    nodeIds: [
        string,
        string
    ];
    jointIds: string[];
    structuralRole: string;
    redundancyGroup: string;
    exposure: 'INTERNAL' | 'EXISTING_EXPOSED';
}
export interface StructuralNode {
    id: string;
    position: Vec3;
    kind: 'FRAME_JUNCTION' | 'VOLUME_ATTACHMENT' | 'MODULE_ATTACHMENT' | 'TRUSS_JUNCTION' | 'STRUCTURAL_ROOT';
    hostIds: string[];
    memberIds: string[];
    attachmentReferences: {
        kind: 'VOLUME_CONTEXT' | 'ENGINE' | 'CONNECTOR' | 'PHYSICAL_SKIN';
        id: string;
    }[];
}
export interface StructuralJoint {
    id: string;
    nodeId: string;
    memberIds: string[];
    connectionType: 'WELDED_CONTACT' | 'ENGINE_MOUNT_INTERFACE' | 'CAPPED_MEMBER_END' | 'SKIN_ATTACHMENT';
    contacts: {
        memberIds: [
            string,
            string
        ];
        method: 'FINITE_OVERLAP' | 'FINITE_COMMON_FACE';
        measure: number;
        unit: 'm3' | 'm2';
    }[];
    geometryReference: {
        kind: 'SHARED_CONSTRUCTION_INTERSECTION';
        position: Vec3;
        toleranceM: number;
    };
    massReference: 'OWNED_BY_MEMBER_UNION_NOT_ADDITIONAL' | 'OWNED_BY_EXISTING_PHYSICAL_SKIN_NOT_ADDITIONAL';
}
export interface StructuralEdge {
    id: string;
    nodeIds: [
        string,
        string
    ];
    physicalMemberRef: string;
    jointRefs: [
        string,
        string
    ];
    connectionType: MemberRole;
    structuralRole: string;
    redundancyGroup: string;
    massReference: string;
    geometryReference: string;
}
export interface ConnectivityAnalysis {
    components: string[][];
    componentByNode: Record<string, number>;
    bridges: string[];
    articulationPoints: string[];
    cycleRank: number;
    roots: string[];
    unreachableVolumeIds: string[];
    partiallyDisconnectedVolumeIds?: string[];
    volumeComponents: Record<string, number[]>;
}
export interface StructuralFramePlan {
    schemaVersion: 1;
    version: '1.8.6.1';
    provenance: 'NEW_PROCUREMENT' | 'EXPLICIT_REDESIGN';
    architecture: ArchitectureGrammar;
    members: FrameMember[];
    joints: StructuralJoint[];
    nodes: StructuralNode[];
    edges: StructuralEdge[];
    roots: string[];
    volumeFrames: {
        volumeId: string;
        template: string;
        nodeIds: string[];
        frameStationZ: number[];
        hullShellRefs: string[];
        externalEnvelope: 'HULL_SHELL_SEPARATE' | 'SPINE_OUTER_SHELL_UNRESOLVED';
    }[];
    skinAttachments: {
        id: string;
        volumeId: string;
        surfaceId: string;
        pieceIndex: number;
        physicalMemberRef: string;
        point: Vec3;
        contactVolumeM3: number;
        reusedExistingMember: boolean;
    }[];
    analysis: ConnectivityAnalysis;
    policy: {
        priorityWeights: Record<string, number>;
        materialId: HullMaterialId;
        sideM: number;
        stationCount: number;
        extraPaths: boolean;
        reason: string[];
        source: 'SHARED_PROCUREMENT_POLICY';
    };
    massAccounting: {
        method: 'EXCLUSIVE_FINITE_MATERIAL_UNION';
        frameVolumeM3: number;
        connectorVolumeM3: number;
        frameMassKg: number;
        connectorMassKg: number;
        preSkinMassUpperBoundKg: number;
        /** Conservative stock-volume allocation before shell construction; never installed mass. */
        plannedHullTieReserveKg: number;
        remainingStructuralEstimateKg: number;
        retiredLegacyFrameProxyKg: number;
        resolvedVolumeIds: string[];
        resolvedConnectorIds: string[];
        scope: string;
        unquantified: string[];
    };
    sourceSignature: string;
    warnings: string[];
    materialIntegration: 'PRE_SKIN_BOUND' | 'SKINS_SUBTRACTED';
    futureCompartments: {
        status: 'STRUCTURAL_GUIDES_NOT_BULKHEADS';
        volumeIds: string[];
        stationInterfaces: {
            volumeId: string;
            z: number;
        }[];
        moduleConnections: {
            connectorId: string;
            from: string;
            to: string;
        }[];
    };
}
/** Per-instance analysis state. No health/strength calibration or separation simulation. */
export interface StructuralInstanceState {
    schemaVersion: 1;
    disabledMemberIds: string[];
    disabledJointIds: string[];
    disabledEdgeIds: string[];
}
export const createStructuralInstanceState = (): StructuralInstanceState => ({ schemaVersion: 1, disabledMemberIds: [], disabledJointIds: [], disabledEdgeIds: [] });
