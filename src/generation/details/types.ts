import type {BoundsData,Vec3} from '../../blueprint/types';
import type {MountFrame,SurfaceContact} from '../weapons/types';
import type {ParametricPrefabAssembly} from '../functional/types';
export type DetailZoneKind='COMMAND'|'WEAPON_PRIMARY'|'MISSILE_BAY'|'PROPULSION'|'ARMOR_JOINT'|'SERVICE_CHANNEL'|'SENSOR'|'MANEUVERING'|'GENERAL_HULL';
export type DetailMode='OFF'|'LOW'|'HIGH'|'AUTO';
export type DetailLOD='MESO'|'MICRO';
export interface DetailZone {id:string;kind:DetailZoneKind;parentStructureId:string;equipmentId?:string;surfaceIds:string[];hint:Vec3;normal:Vec3;allow:DetailKitType[];density:number;reason:string}
export type DetailKitType='ACCESS_HATCH'|'PANEL_SEAM'|'ARMOR_CLAMP'|'REINFORCEMENT_BRACKET'|'RECESSED_SERVICE_PANEL'|'EVA_LADDER'|'EVA_HANDRAIL'|'SERVICE_CATWALK'|'SERVICE_PORT'|'DRONE_DOCK'|'CONDUIT_BUNDLE'|'COOLANT_PIPE'|'VENT_LOUVER'|'MACHINE_ACCESS_COVER'|'ENGINE_SERVICE_FRAME'|'RCS_CLUSTER'|'OPTICAL_SENSOR'|'SENSOR_STRIP'|'WEAPON_SERVICE_RING'|'MISSILE_CELL_DETAIL'|'HAZARD_MARKING';
export interface DetailPlacement {
 id:string;kit:DetailKitType;zoneId:string;parentStructureId:string;parentEquipmentId?:string;styleVariant:string;lodClass:DetailLOD;
 attachment:SurfaceContact&{frame:MountFrame;contacts:SurfaceContact[];inset:number;footprint:{width:number;length:number}};
 assembly:ParametricPrefabAssembly;bounds:BoundsData;access:{origin:Vec3;direction:Vec3;depth:number};
 geometryParameters?:{routeLength:number};hierarchy:'MACRO'|'MESO'|'MICRO';
 physicalOrVisualRole:'VISUAL_ONLY';functionalConnection:string;importance:number;
 rcs?:{nozzleCount:number;thrustDirectionCandidates:Vec3[];axes:('TRANSLATION'|'PITCH'|'YAW'|'ROLL')[];status:'RESERVED_FOR_COMBAT';constraints:string[]};
}
export interface ExteriorDetailPlan {
 version:'1.8.5';baseGeneratorVersion:string;generationSeed:number;rngNamespace:'exterior-detail-v1';styleLanguage:string;
 detectedZones:DetailZone[];kitPlacements:DetailPlacement[];
 densityDecisions:{zoneId:string;attempted:number;accepted:number;maximum:number;reason:string}[];
 decisions:{id:string;kit?:DetailKitType;zoneId:string;status:'accepted'|'omitted';reason:string}[];
 reservedClearances:{id:string;source:string}[];bounds:BoundsData;
 validationResults:{issues:string[];checks:string[]};
}
