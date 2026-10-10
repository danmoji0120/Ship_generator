import type {BoundsData,Vec3} from '../../blueprint/types';
import type {PanelSolid} from '../armor/types';
import type {MountFrame,SurfaceContact} from '../weapons/types';
import type {MaterialRole} from '../../rendering/appearance';
export const MESO_KINDS=['ARMOR_STEP','ARMOR_SHOULDER_EXTENSION','WEAPON_BARBETTE_INTEGRATION','MACHINERY_GALLERY','ENGINE_ROOT_TRANSITION','FLANK_ARMOR_BELT','VENTRAL_KEEL_SUPPORT','SERVICE_RECESS_FRAME'] as const;
export type MesoKind=typeof MESO_KINDS[number];
export type MesoZoneKind='PRIMARY_ARMOR'|'ARMOR_SHOULDER'|'WEAPON_FOUNDATION'|'PROPULSION_ROOT'|'SERVICE_CHANNEL'|'ARMOR_JOINT'|'SIDE_BELT'|'VENTRAL_KEEL'|'COMMAND_BASE'|'SPINE_MODULE_JUNCTION'|'TRUSS_POD_ROOT'|'CORE_NACELLE_ROOT'|'TWIN_HULL_INTERFACE'|'HYBRID_JUNCTION';
export type RootVariant='WIDE_ROOT_FAIRING'|'NARROW_ROOT_FAIRING'|'SEGMENTED_ROOT_SUPPORT'|'LOW_PROFILE_TRANSITION';
export interface RootSource {engineId:string;position:Vec3;direction:Vec3;radius:number;nozzleLength:number;bellRatio:number;variant:RootVariant;clusterId:string;availableWidth:number;availableLength:number}
export interface MesoZone {id:string;kind:MesoZoneKind;parentStructureId:string;parentSurfaceId:string;equipmentId?:string;hint:Vec3;normal:Vec3;availableAreaM2:number;allowed:MesoKind[];reason:string;candidateCount:number;root?:RootSource;connectorId?:string;finalStatus?:'accepted'|'omitted';omissionCategory?:string}
export interface MesoPlacement {
 id:string;kind:MesoKind;zoneId:string;parentStructureId:string;parentSurfaceId:string;parentEquipmentId?:string;
 attachment:{position:Vec3;frame:MountFrame;contacts:SurfaceContact[];inset:number;footprint:{width:number;length:number};rootPatch?:PanelSolid};
 parameters:{width:number;length:number;height:number;taper:number;clip:number;style:string;rootVariant?:RootVariant};
 parts:{id:string;role:string;materialRole:MaterialRole;solid:PanelSolid;bounds:BoundsData}[];bounds:BoundsData;
 lodClass:'SILHOUETTE_RELEVANT'|'STRUCTURAL_READABLE'|'CLOSE_DETAIL';importance:number;
 physicalOrVisualRole:'VISUAL_STRUCTURE_ONLY';combatProtection:'NOT_SIMULATED';references:string[];
}
export interface MesoStructurePlan {
 version:'1.8.5.3'|'1.8.5.3.1';generationSeed:number;namespace:'meso-structure-v1';styleLanguage:string;sourceBlueprintVersion:string;
 detectedZones:MesoZone[];placements:MesoPlacement[];
 decisions:{zoneId:string;kind:MesoKind;candidate:number;status:'accepted'|'omitted';reason:string;category?:string;variant?:RootVariant}[];
 functionBudget?:{limit:number;engineEvaluationPriority:boolean;rootZones:number;junctionZones:number};
 bounds:BoundsData;validation:{issues:string[];checks:string[]};
}
