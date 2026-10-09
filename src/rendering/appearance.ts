import type {ShipBlueprint} from '../blueprint/types';
import type {DetailKitType} from '../generation/details/types';
/** Immutable version selector. Rendering modes do not change this serialized contract. */
export interface MaterialAppearance {version:'1.8.5.1';language:'aegis'|'vesper'|'forge'|'serein'}
export type MaterialRole='PRIMARY_ARMOR'|'SECONDARY_ARMOR'|'MECHANICAL_STRUCTURE'|'RECESSED_INTERIOR'|'FUNCTIONAL_SURFACE';
export type EmissiveRole='BRIDGE_LIGHT'|'STATUS_LIGHT'|'MAINTENANCE_GUIDE'|'SENSOR_EMISSIVE'|'PROPULSION_EMISSIVE'|'WEAPON_STATUS'|'NAV_LIGHT';
export type SurfacePattern='NONE'|'STATUS'|'GUIDE'|'LENS'|'WINDOW'|'HATCH'|'HAZARD'|'IDENTIFICATION';
export interface SurfaceAppearance {material:MaterialRole;emissive?:EmissiveRole;pattern:SurfacePattern}
export const MATERIAL_ROLES:MaterialRole[]=['PRIMARY_ARMOR','SECONDARY_ARMOR','MECHANICAL_STRUCTURE','RECESSED_INTERIOR','FUNCTIONAL_SURFACE'];
export const EMISSIVE_ROLES:EmissiveRole[]=['BRIDGE_LIGHT','STATUS_LIGHT','MAINTENANCE_GUIDE','SENSOR_EMISSIVE','PROPULSION_EMISSIVE','WEAPON_STATUS','NAV_LIGHT'];
export const KIT_APPEARANCE:Record<DetailKitType,SurfaceAppearance>={
 ACCESS_HATCH:{material:'SECONDARY_ARMOR',emissive:'STATUS_LIGHT',pattern:'HATCH'},
 PANEL_SEAM:{material:'MECHANICAL_STRUCTURE',pattern:'NONE'},
 ARMOR_CLAMP:{material:'MECHANICAL_STRUCTURE',pattern:'NONE'},
 REINFORCEMENT_BRACKET:{material:'MECHANICAL_STRUCTURE',pattern:'IDENTIFICATION'},
 RECESSED_SERVICE_PANEL:{material:'FUNCTIONAL_SURFACE',emissive:'STATUS_LIGHT',pattern:'HATCH'},
 EVA_LADDER:{material:'MECHANICAL_STRUCTURE',emissive:'MAINTENANCE_GUIDE',pattern:'GUIDE'},
 EVA_HANDRAIL:{material:'MECHANICAL_STRUCTURE',emissive:'MAINTENANCE_GUIDE',pattern:'GUIDE'},
 SERVICE_CATWALK:{material:'MECHANICAL_STRUCTURE',emissive:'MAINTENANCE_GUIDE',pattern:'GUIDE'},
 SERVICE_PORT:{material:'FUNCTIONAL_SURFACE',emissive:'STATUS_LIGHT',pattern:'STATUS'},
 DRONE_DOCK:{material:'FUNCTIONAL_SURFACE',emissive:'NAV_LIGHT',pattern:'HATCH'},
 CONDUIT_BUNDLE:{material:'MECHANICAL_STRUCTURE',emissive:'STATUS_LIGHT',pattern:'STATUS'},
 COOLANT_PIPE:{material:'MECHANICAL_STRUCTURE',emissive:'PROPULSION_EMISSIVE',pattern:'STATUS'},
 VENT_LOUVER:{material:'RECESSED_INTERIOR',emissive:'PROPULSION_EMISSIVE',pattern:'STATUS'},
 MACHINE_ACCESS_COVER:{material:'SECONDARY_ARMOR',emissive:'PROPULSION_EMISSIVE',pattern:'HATCH'},
 ENGINE_SERVICE_FRAME:{material:'MECHANICAL_STRUCTURE',emissive:'PROPULSION_EMISSIVE',pattern:'GUIDE'},
 RCS_CLUSTER:{material:'MECHANICAL_STRUCTURE',emissive:'STATUS_LIGHT',pattern:'STATUS'},
 OPTICAL_SENSOR:{material:'FUNCTIONAL_SURFACE',emissive:'SENSOR_EMISSIVE',pattern:'LENS'},
 SENSOR_STRIP:{material:'FUNCTIONAL_SURFACE',emissive:'SENSOR_EMISSIVE',pattern:'LENS'},
 WEAPON_SERVICE_RING:{material:'MECHANICAL_STRUCTURE',emissive:'WEAPON_STATUS',pattern:'STATUS'},
 MISSILE_CELL_DETAIL:{material:'FUNCTIONAL_SURFACE',emissive:'WEAPON_STATUS',pattern:'STATUS'},
 HAZARD_MARKING:{material:'FUNCTIONAL_SURFACE',pattern:'HAZARD'},
};
export interface AppearancePalette {colors:Record<MaterialRole,string>;roughness:Record<MaterialRole,number>;metalness:Record<MaterialRole,number>;lights:Record<EmissiveRole,string>;intensity:number;warning:string;marking:string}
const roughness={PRIMARY_ARMOR:.68,SECONDARY_ARMOR:.52,MECHANICAL_STRUCTURE:.40,RECESSED_INTERIOR:.88,FUNCTIONAL_SURFACE:.30};
const metalness={PRIMARY_ARMOR:.30,SECONDARY_ARMOR:.42,MECHANICAL_STRUCTURE:.70,RECESSED_INTERIOR:.15,FUNCTIONAL_SURFACE:.50};
export const APPEARANCE_PALETTES:Record<MaterialAppearance['language'],AppearancePalette>={
 aegis:{colors:{PRIMARY_ARMOR:'#778995',SECONDARY_ARMOR:'#a6b4ba',MECHANICAL_STRUCTURE:'#384651',RECESSED_INTERIOR:'#101b23',FUNCTIONAL_SURFACE:'#526879'},roughness,metalness,lights:{BRIDGE_LIGHT:'#b5dcf0',STATUS_LIGHT:'#79bfcf',MAINTENANCE_GUIDE:'#acd7e2',SENSOR_EMISSIVE:'#87cede',PROPULSION_EMISSIVE:'#91cddd',WEAPON_STATUS:'#ddae5d',NAV_LIGHT:'#d7e4ed'},intensity:1.35,warning:'#ca9453',marking:'#c6cdd0'},
 vesper:{colors:{PRIMARY_ARMOR:'#727f8f',SECONDARY_ARMOR:'#97a6b9',MECHANICAL_STRUCTURE:'#2c3649',RECESSED_INTERIOR:'#101724',FUNCTIONAL_SURFACE:'#435a76'},roughness:{...roughness,PRIMARY_ARMOR:.50,SECONDARY_ARMOR:.39},metalness,lights:{BRIDGE_LIGHT:'#98cbea',STATUS_LIGHT:'#69b5dc',MAINTENANCE_GUIDE:'#6aaecb',SENSOR_EMISSIVE:'#78c5f0',PROPULSION_EMISSIVE:'#71bce2',WEAPON_STATUS:'#9bc6dd',NAV_LIGHT:'#cae6f0'},intensity:1.05,warning:'#b09c61',marking:'#afbecb'},
 forge:{colors:{PRIMARY_ARMOR:'#837e70',SECONDARY_ARMOR:'#b1a995',MECHANICAL_STRUCTURE:'#45413a',RECESSED_INTERIOR:'#201e19',FUNCTIONAL_SURFACE:'#686452'},roughness:{...roughness,PRIMARY_ARMOR:.82,MECHANICAL_STRUCTURE:.60},metalness:{...metalness,PRIMARY_ARMOR:.22},lights:{BRIDGE_LIGHT:'#ebd2a5',STATUS_LIGHT:'#e4ac63',MAINTENANCE_GUIDE:'#edb46a',SENSOR_EMISSIVE:'#abd4be',PROPULSION_EMISSIVE:'#dd9958',WEAPON_STATUS:'#e7b666',NAV_LIGHT:'#e8ddc6'},intensity:1.25,warning:'#ce9450',marking:'#c5baa4'},
 serein:{colors:{PRIMARY_ARMOR:'#a0b0b0',SECONDARY_ARMOR:'#c0ceca',MECHANICAL_STRUCTURE:'#455b5a',RECESSED_INTERIOR:'#17292a',FUNCTIONAL_SURFACE:'#7f9e9a'},roughness:{...roughness,PRIMARY_ARMOR:.46,SECONDARY_ARMOR:.35},metalness:{...metalness,MECHANICAL_STRUCTURE:.52},lights:{BRIDGE_LIGHT:'#d4ede5',STATUS_LIGHT:'#a7dace',MAINTENANCE_GUIDE:'#bbdcd1',SENSOR_EMISSIVE:'#a7dfd4',PROPULSION_EMISSIVE:'#b5dfd0',WEAPON_STATUS:'#d3ddd3',NAV_LIGHT:'#d5e8e3'},intensity:.90,warning:'#b6b695',marking:'#d6e0db'},
};
export function applyMaterialAppearance(b:ShipBlueprint):ShipBlueprint{
 if(!(b.shipyardId in APPEARANCE_PALETTES))throw Error('Unsupported material language');
 b.materialAppearance={version:'1.8.5.1',language:b.shipyardId as MaterialAppearance['language']};b.generatorVersion='1.8.5.1';return b;
}
/** Part-level hierarchy is appearance only. No placement, solid, or collision data is rewritten. */
export function kitPartAppearance(kit:DetailKitType,role:string):SurfaceAppearance{
 const base=KIT_APPEARANCE[kit];
 if(/NOZZLE|RIM|BLADE|RUN|HANDLE|RUNG|ANCHOR|SUPPORT|CLAMP/.test(role))return{material:/NOZZLE|BLADE|RUN/.test(role)?'RECESSED_INTERIOR':'MECHANICAL_STRUCTURE',pattern:'NONE'};
 if(/INSET/.test(role))return{...base,material:'RECESSED_INTERIOR'};
 if(/CELL|CORE/.test(role))return base;
 if(/SEAT/.test(role))return{...base,material:'SECONDARY_ARMOR',pattern:kit==='RCS_CLUSTER'?'STATUS':kit==='MISSILE_CELL_DETAIL'?'STATUS':'NONE',emissive:kit==='RCS_CLUSTER'||kit==='MISSILE_CELL_DETAIL'?base.emissive:undefined};
 if(kit==='SENSOR_STRIP'||kit==='OPTICAL_SENSOR'||kit==='SERVICE_PORT')return{material:'MECHANICAL_STRUCTURE',pattern:'NONE'};
 return base;
}
export function functionalPartAppearance(role:string,material:string):SurfaceAppearance{
 if(role==='COMMAND_HOUSING')return{material:'PRIMARY_ARMOR',emissive:'BRIDGE_LIGHT',pattern:'WINDOW'};
 if(role==='PROTECTED_SENSOR')return{material:'FUNCTIONAL_SURFACE',emissive:'SENSOR_EMISSIVE',pattern:'LENS'};
 if(/OPEN_WEAPON_SHROUD|REINFORCED_MANTLET/.test(role))return{material:'MECHANICAL_STRUCTURE',pattern:'NONE'};
 if(/TURRET|CASEMATE|LAUNCHER/.test(role))return{material:'SECONDARY_ARMOR',pattern:'NONE'};
 if(/SERVICE_PUMP/.test(role))return{material:'MECHANICAL_STRUCTURE',emissive:'STATUS_LIGHT',pattern:'STATUS'};
 if(/THERMAL_EXCHANGER|RADIATOR|OPEN_ENGINE/.test(role))return{material:'MECHANICAL_STRUCTURE',pattern:'NONE'};
 if(/VENTRAL|KEEL|SIDE_BELT|SHOULDER|CRADLE/.test(role))return{material:'SECONDARY_ARMOR',pattern:'NONE'};
 if(/CHANNEL|RECESS|FLOOR/.test(role))return{material:'RECESSED_INTERIOR',pattern:'NONE'};
 return{material:material==='engine'?'MECHANICAL_STRUCTURE':material==='mount'?'FUNCTIONAL_SURFACE':material==='secondary'?'SECONDARY_ARMOR':'PRIMARY_ARMOR',pattern:'NONE'};
}
