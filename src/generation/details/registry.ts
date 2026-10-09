import type {DetailKitType,DetailZoneKind,DetailLOD} from './types';
/** Meters, not a scale transform of ship length. Kit assemblies reuse the existing world-solid contract. */
export const DETAIL_KITS:Record<DetailKitType,{size:[number,number,number];lod:DetailLOD;zones:DetailZoneKind[];importance:number;access:number}>={
 ACCESS_HATCH:{size:[1.25,.16,1.65],lod:'MESO',zones:['COMMAND','GENERAL_HULL','ARMOR_JOINT','WEAPON_PRIMARY'],importance:3,access:1.4},
 PANEL_SEAM:{size:[.09,.03,3.5],lod:'MICRO',zones:['ARMOR_JOINT'],importance:1,access:0},
 ARMOR_CLAMP:{size:[.65,.22,.75],lod:'MICRO',zones:['ARMOR_JOINT'],importance:2,access:.3},
 REINFORCEMENT_BRACKET:{size:[1.4,.48,1.1],lod:'MESO',zones:['ARMOR_JOINT','PROPULSION'],importance:3,access:.4},
 RECESSED_SERVICE_PANEL:{size:[1.5,.10,1.8],lod:'MESO',zones:['COMMAND','GENERAL_HULL','SERVICE_CHANNEL'],importance:2,access:1},
 EVA_LADDER:{size:[.65,.18,2.4],lod:'MICRO',zones:['SERVICE_CHANNEL','COMMAND'],importance:2,access:.7},
 EVA_HANDRAIL:{size:[.75,.42,1.8],lod:'MICRO',zones:['COMMAND','SERVICE_CHANNEL'],importance:1,access:.6},
 SERVICE_CATWALK:{size:[.9,.46,3.5],lod:'MESO',zones:['SERVICE_CHANNEL'],importance:4,access:1.2},
 SERVICE_PORT:{size:[.65,.16,.8],lod:'MICRO',zones:['SERVICE_CHANNEL','PROPULSION'],importance:2,access:.7},
 DRONE_DOCK:{size:[1.5,.32,1.7],lod:'MESO',zones:['SERVICE_CHANNEL'],importance:3,access:1.5},
 CONDUIT_BUNDLE:{size:[.6,.26,4],lod:'MESO',zones:['SERVICE_CHANNEL','PROPULSION'],importance:3,access:.3},
 COOLANT_PIPE:{size:[.45,.3,3],lod:'MESO',zones:['SERVICE_CHANNEL','PROPULSION'],importance:3,access:.4},
 VENT_LOUVER:{size:[2.4,.22,2.2],lod:'MESO',zones:['PROPULSION','SERVICE_CHANNEL'],importance:3,access:.8},
 MACHINE_ACCESS_COVER:{size:[1.35,.25,2.0],lod:'MESO',zones:['PROPULSION','SERVICE_CHANNEL'],importance:4,access:1},
 ENGINE_SERVICE_FRAME:{size:[2.6,.65,3.8],lod:'MESO',zones:['PROPULSION'],importance:4,access:.7},
 RCS_CLUSTER:{size:[1.6,.55,1.8],lod:'MESO',zones:['MANEUVERING'],importance:4,access:2},
 OPTICAL_SENSOR:{size:[.55,.3,.65],lod:'MICRO',zones:['SENSOR'],importance:2,access:2},
 SENSOR_STRIP:{size:[1.9,.08,.4],lod:'MICRO',zones:['SENSOR','COMMAND'],importance:2,access:1.8},
 WEAPON_SERVICE_RING:{size:[.85,.24,2.4],lod:'MESO',zones:['WEAPON_PRIMARY'],importance:3,access:.7},
 MISSILE_CELL_DETAIL:{size:[1.8,.12,.7],lod:'MICRO',zones:['MISSILE_BAY'],importance:2,access:0},
 HAZARD_MARKING:{size:[1.8,.02,.22],lod:'MICRO',zones:['MISSILE_BAY','PROPULSION','SERVICE_CHANNEL'],importance:1,access:0},
};
export const STYLE={
 aegis:{name:'NAVAL_REINFORCED',height:1.35,width:1.10,density:1,bevel:.18,exposed:true},
 vesper:{name:'STREAMLINED_SERVICE',height:.65,width:.82,density:.75,bevel:.30,exposed:false},
 forge:{name:'INDUSTRIAL_ACCESS',height:1.1,width:1,density:1.2,bevel:.08,exposed:true},
 serein:{name:'PRECISION_INSET',height:.55,width:1.05,density:.7,bevel:.28,exposed:false},
};
export const zoneKits=(kind:DetailZoneKind)=>Object.entries(DETAIL_KITS).filter(([,r])=>r.zones.includes(kind)).map(([k])=>k as DetailKitType);
