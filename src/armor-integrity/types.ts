import type{ShipBlueprint,Vec3}from'../blueprint/types';
import type{PreparedPhysicalQueries,ProbeHit}from'../physical/probe';
export type IntegrityStatus='COVERED'|'INTENTIONALLY_EXPOSED'|'MISSING_ARMOR'|'UNRESOLVED'|'VISUAL_PHYSICAL_MISMATCH';
export type AuditDomain='HULL_TARGET_FOOTPRINT'|'ARMOR_SOURCE_SKINS';
export interface IntegrityPatch{
 id:string;domain:AuditDomain;surfaceId:string;parentStructureId:string;protectionZone:string;polygon:Vec3[];point:Vec3;normal:Vec3;areaM2:number;
 planned:'REQUIRED'|'EXCLUDED'|'UNKNOWN';policy:string;sourceReferences:string[];exclusionReason?:string;reservationId?:string;
 status:IntegrityStatus;visual:{covered:boolean|null;sourceIds:string[]};physical:{covered:boolean|null;layers:Pick<ProbeHit,'surfaceId'|'layerId'|'materialId'|'constituentMaterialId'|'pathLengthM'|'measuredNormalThicknessMm'|'entryPoint'|'exitPoint'>[];pieceReferences:string[];hullOnly:boolean};
 ray:{origin:Vec3;direction:Vec3;maxDistanceM:number};reason:string;warnings:string[];
}
export interface ArmorAudit{
 version:'1.8.6.5.1';status:'PENDING'|'COMPLETE'|'CANCELLED';method:'AREA_WEIGHTED_INTERIOR_AND_EDGE_BAND_FINITE_RAYS';patches:IntegrityPatch[];
 summary:Record<AuditDomain,{sourceAreaM2:number;plannedEligibleAreaM2:number;intentionalExclusionAreaM2:number;physicalCoveredAreaEstimateM2:number;physicalUncoveredAreaEstimateM2:number;unresolvedAreaM2:number;visualMismatchAreaEstimateM2:number;sampledAreaM2:number;unsampledAreaM2:number;coverageEstimate:number|null;counts:Record<IntegrityStatus,number>}>;
 confidence:string;warnings:string[];diagnostics:{preparationMs:number;physicalQueryPreparationMs:number;queryMs:number;queryCount:number;visualQueryMs:number;workMs:number};
}
export interface AuditOptions{maxSamples?:number;edgeBandFraction?:number;visibleArmorSourceIds?:readonly string[];domains?:AuditDomain[];}
export interface AuditWork{blueprint:ShipBlueprint;result:ArmorAudit;tasks:IntegrityPatch[];index:number;options:AuditOptions;queries?:PreparedPhysicalQueries;visualQuery:(o:Vec3,d:Vec3,max:number)=>string[];physicalById:Map<string,import('../physical/types').ProtectionSurface>;}
