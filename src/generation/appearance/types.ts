import type {Vec3} from '../../blueprint/types';
import type {MaterialLanguage,MaterialRole} from '../../rendering/appearance';
export type FinishProfile='CLEAN'|'SERVICE'|'WEATHERED';
export type SurfaceVisibility='FAR'|'MEDIUM'|'NEAR'|'CLOSE';
export type DecalKind='IDENTIFICATION'|'COMPARTMENT'|'SHIPYARD'|'MAINTENANCE'|'HAZARD'|'NAVAL';
export interface DecalPlacement {
 id:string;parentId:string;parentStructureId:string;kind:DecalKind;text:string;
 position:Vec3;normal:Vec3;right:Vec3;up:Vec3;size:{width:number;height:number};
 contacts:{position:Vec3;surfaceId:string}[];visibility:SurfaceVisibility;
 color:'MARKING'|'WARNING';reason:string;
}
export interface SurfaceAppearancePlan {
 version:'1.8.5.2';language:MaterialLanguage;finish:FinishProfile;
 texture:{namespace:'ship-surface-v1';seed:number;grainPeriodMeters:number;tileResolution:128;projection:'OBJECT_LOCAL_TRIPLANAR'};
 componentVariations:{parentId:string;role:MaterialRole;tone:number;wearEligible:boolean;reason:string}[];
 decals:DecalPlacement[];
 decisions:{id:string;parentId:string;status:'accepted'|'omitted';reason:string}[];
 policy:{maximumDecals:48;atlasWidth:512;rowHeight:32;defaultFinish:'CLEAN';visibility:'derivative-filtered / physical footprint'};
}
