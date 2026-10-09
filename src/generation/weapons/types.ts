import type {BoundsData,Vec3} from '../../blueprint/types';
import type {PanelSolid} from '../armor/types';
export type MountSize='S'|'M'|'L'|'XL';
export type MountRegion='TOP'|'BOTTOM'|'PORT'|'STARBOARD';
export type WeaponCategory='CANNON'|'MISSILE'|'POINT_DEFENSE'|'SENSOR'|'UTILITY'|'SPINAL';
export type LayoutPattern='CENTERLINE_SINGLE'|'BILATERAL_PAIR'|'LONGITUDINAL_BATTERY'|'POINT_DEFENSE_GROUP'|'ASYMMETRIC_FUNCTIONAL';
export interface MountStandard {
 size:MountSize;mode:'SURFACE'|'HULL_INTEGRATED';footprint:{width:number;length:number};
 envelope:{width:number;height:number;length:number};foundationHeight:number;cost:number;
}
export interface MountFrame {normal:Vec3;right:Vec3;forward:Vec3}
export interface SurfaceContact {surfaceId:string;structureId:string;position:Vec3;normal:Vec3}
export interface PlannedMount {id:string;region:MountRegion;size:MountSize;category:WeaponCategory;hint:Vec3}
export interface WeaponGroupPlan {id:string;pattern:LayoutPattern;symmetry:'CENTERLINE'|'BILATERAL'|'FUNCTIONAL';reason?:string;functionalReferenceIds?:string[];members:PlannedMount[]}
export interface WeaponMount {
 id:string;groupId:string;pattern:LayoutPattern;region:MountRegion;category:WeaponCategory;standard:MountStandard;
 position:Vec3;frame:MountFrame;contacts:SurfaceContact[];
 orientationPolicy:'MEASURED_SURFACE'|'PAIRED_SURFACE_AVERAGE';
 footprint:{width:number;length:number;polygon:Vec3[]};
 foundation:{solid:PanelSolid;bounds:BoundsData;inset:number;height:number};
 equipment:{prefabId:string;bounds:BoundsData;localBounds:BoundsData;model:'NAVAL_TURRET'|'CASEMATE'|'VLS'|'PD'};
 firingArc:{coordinateSystem:'LOCAL_MOUNT';yawMin:number;yawMax:number;pitchMin:number;pitchMax:number;staticPitch:number;rangeMeters:number;clearanceBounds:BoundsData;muzzles:Vec3[];samples:{yaw:number;pitch:number;origin:Vec3;direction:Vec3;clear:boolean}[]};
}
export interface WeaponLayout {
 status:'one-ship-review';standardsVersion:'1.8.3';sourceVersion:string;sourceSeed:number;
 budget:{available:number;allocated:number;countLimit:number;byRegion:Record<MountRegion,number>};
 composition:{size:MountSize;category:WeaponCategory;count:number}[];
 groups:WeaponGroupPlan[];mounts:WeaponMount[];prefabIds:string[];supersededFoundationIds:string[];
 retiredHardpointIds:string[];
 attempts:{groupId:string;candidate:number;longitudinalShift:number;accepted:boolean;reasons:string[]}[];
 omissions:{groupId:string;reason:string}[];overallBounds:BoundsData;
 validation:{issues:string[];checks:string[]};
}
