import type { BoundsData, EquipmentZone, PrefabSocket, Vec3 } from '../../blueprint/types';
export const ARMOR_GEOMETRIES = ['RECTANGULAR_PANEL','TRAPEZOIDAL_PANEL','HEXAGONAL_PANEL','CLIPPED_CORNER_PANEL','TAPERED_PANEL','ANGULAR_POLYGON_PANEL','LONGITUDINAL_STRIP','SEGMENTED_BAND'] as const;
export type ArmorGeometryKind = typeof ARMOR_GEOMETRIES[number];
export type ArmorLayer = 1 | 2 | 3;
export type LayeringStyle = 'STEPPED' | 'OVERLAPPING_SCALE' | 'ANGULAR_CAP' | 'FACETED_SHOULDER' | 'EDGE_OVERLAY';
export type ArmorDirection = 'top'|'bottom'|'left'|'right'|'fore'|'aft';
export interface PanelSolid { vertices: Vec3[]; indices: number[]; }
/** Exact renderer triangles are the attachment authority, including tapered loft faces and caps. */
export interface ArmorSurface {
 id:string; parentStructureId:string; parentExteriorId?:string; region:string;
 triangle:[Vec3,Vec3,Vec3]; normal:Vec3; direction:ArmorDirection; areaM2:number;
 patches:{ polygon:Vec3[]; areaM2:number; exclusionReason?:string; reservationId?:string }[];
}
export interface ArmorSegment {
 id:string; parentStructureId:string; parentArmorId?:string; surfaceId:string;
 layer:ArmorLayer; protectedZone:'CITADEL'|'BOW'|'HANGAR_FLANK'|'PROPULSION'|'WEAPON_SUPPORT'|'POD'|'JOINT';
 geometryKind:ArmorGeometryKind; layeringStyle?:LayeringStyle;
 /** Optional loft compatibility; new panels use closed, chamfered polygon solids. */
 rings:Vec3[][]; solid:PanelSolid; rootPolygon:Vec3[]; topPolygon:Vec3[];
 bounds:BoundsData; thickness:number; outwardOffset:number; insetDepth:number; panelGap:number; chamfer:number;
 orientation:Vec3; socket:PrefabSocket; contactSurface:{position:Vec3;normal:Vec3}[];
 geometryParameters:{face:number;start:number;end:number;widthRatio:number;capRatio:number;endTaper:number};
 reservationReferences:string[];
 protection:{classification:'PRIMARY'|'SECONDARY'|'REINFORCEMENT';rating:number;simulated:false};
 validationStatus:'accepted'|'adapted'; sizeClass:'LARGE'|'MEDIUM'|'SMALL';
}
export interface ArmorAssembly { id:string;parentStructureId:string;family:string;language:string;segments:ArmorSegment[]; }
export interface HardpointSurfaceMount {
 armorId:string; surfaceId:string; socketId:string; position:Vec3; normal:Vec3; tangent:Vec3;
 mountNormal:Vec3; originalHullPosition:Vec3; originalHullNormal:Vec3; footprint:number; localCoordinates:[number,number,number];
 foundation:{id:string;solid:PanelSolid;bounds:BoundsData;height:number;contactPoints:Vec3[];supportedArmorIds:string[]};
 clearance:{radius:number;depth:number;direction:Vec3;status:'accepted';};
}
export interface LayeredArmor {
 surfaces:ArmorSurface[]; assemblies:ArmorAssembly[]; supersededExteriorIds:string[];
 seams:{id:string;panelId:string;surfaceId:string;gapMeters:number;depthMeters:number;underlayer:'STRUCTURAL_HULL'|'INTEGRATION_HOUSING'}[];
 mountDecisions:{hardpointId:string;status:'accepted'|'adapted'|'rejected';reason:string}[];
 decisions:{sourceId:string;status:'accepted'|'adapted'|'omitted';reason:string;attemptedVariants:number}[];
 reservedZones:EquipmentZone[]; exteriorBounds:BoundsData; overallBounds:BoundsData;
 budget:{segmentLimit:number;triangleLimit:number;segmentCount:number;triangleCount:number}; units:'meters';
 coverage:{byDirectionM2:Record<ArmorDirection,number>;availableByDirectionM2:Record<ArmorDirection,number>;
 byDirectionRatio:Record<ArmorDirection,number>;excludedByDirectionM2:Record<ArmorDirection,number>;
 exclusions:{reason:string;areaM2:number}[];coveredAreaM2:number;primaryAreaM2:number;secondaryAreaM2:number;
 warnings:string[];bowPolicy:string;sternPolicy:string};
}
