import type {Vec3,Hardpoint,ShipBlueprint} from '../blueprint/types';
import type {MountFrame,SurfaceContact} from '../generation/weapons/types';
import type {PreviewPart} from '../equipment-preview/geometry';
import type {FitResult} from '../equipment-preview/fitment';
export type PlatformKind='DIRECT'|'FLUSH_BASE'|'RAISED_BARBETTE'|'SIDE_SPONSON'|'BOX_PLATFORM'|'PYLON_BRACE';
export interface SurfaceAnchor extends SurfaceContact {space:'SHIP_LOCAL'}
export interface PlatformRecipe {version:1;kind:PlatformKind;style:string;position:Vec3;frame:MountFrame;width:number;length:number;height:number;rootWidth:number;rootLength:number;contacts:SurfaceContact[];capHeight:number;raiseTier:number;}
export interface FreeMountEntry {id:string;equipmentId:string;anchor:SurfaceAnchor;headingDegrees:number;launchTiltDegrees?:number;platform:PlatformRecipe;pairId?:string;batteryId?:string;pose:{yaw:number;elevation:number};arc:FitResult['samples'];validation:'EXTERNAL_GEOMETRY_ONLY';}
export interface FreeMountPlan {version:'1.8.5.5';nextId:number;entries:FreeMountEntry[];internalValidation:'NOT_PERFORMED';}
export interface FreeMountRequest {equipmentId:string;anchor:SurfaceAnchor;headingDegrees:number;launchTiltDegrees?:number;platforms:boolean;mode:'SINGLE'|'MIRROR'|'BATTERY';count?:number;spacing?:number;arrayDirection?:Vec3;mirrorBattery?:boolean;replaceIds?:string[];platformPreference?:PlatformKind;}
export interface FreeMountResult {status:'DIRECT_VALID'|'PLATFORM_VALID'|'INVALID';reason:string;entries:FreeMountEntry[];fits:FitResult[];mounts:Hardpoint[];elapsedMs:number;attempts:{kind:PlatformKind;reason:string}[];}
export interface FreeMountBlueprint extends ShipBlueprint {freeMountPlan?:FreeMountPlan;}
export const accepted=(r:FreeMountResult)=>r.status!=='INVALID';
