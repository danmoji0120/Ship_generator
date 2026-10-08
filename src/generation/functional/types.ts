import type {BoundsData,EquipmentZone,Vec3} from '../../blueprint/types';
import type {PanelSolid} from '../armor/types';

/** Optional world-space kit assembly, using the existing Prefab registry and sockets. */
export interface ParametricPrefabAssembly {
  parts:{id:string;role:string;material:'hull'|'secondary'|'armor'|'mount'|'engine'|'glow';solid:PanelSolid;bounds:BoundsData}[];
  attachments:{kind:'HULL'|'ARMOR'|'FOUNDATION';parentId:string;position:Vec3;normal:Vec3}[];
  equipmentIds:string[];
  clearances:EquipmentZone[];
}
export interface FunctionalExteriorReview {
  status:'one-ship-review';
  source:{seed:number;generatorVersion:string;structuralGeometryPreserved:true};
  finishPalette:{hull:string;armor:string;secondary:string;mount:string;engine:string;glow:string};
  prefabIds:string[];
  replacedHardpointVisuals:string[];
  armorFinish:{prefabId:string;parentArmorId:string;direction:'TOP'|'BOTTOM'|'PORT'|'STARBOARD';thickness:number;contactAreaM2:number}[];
  serviceRegions:{id:string;purpose:'MAINTENANCE';prefabIds:string[];occupiedFraction:number;remainingDepth:number}[];
  overallBounds:BoundsData;
  validation:{issues:string[];checks:string[]};
}
