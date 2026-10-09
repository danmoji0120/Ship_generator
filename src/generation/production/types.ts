import type {BoundsData,EquipmentZone,Vec3} from '../../blueprint/types';
import type {StructuralArmorComponent} from '../armor/structural-pilot/types';
import type {PanelSolid} from '../armor/types';
import type {MacroFamily} from '../macro/types';
export type CoverageDirection='top'|'bottom'|'left'|'right'|'fore'|'aft';
export interface ProductionDesign {
 status:'generated';pipelineVersion:'1.8.4';family:MacroFamily;axisAligned:true;
 armor:StructuralArmorComponent[];
 finish:{id:string;parentStructureId:string;solid:PanelSolid;bounds:BoundsData;direction:CoverageDirection;root:Vec3[];normal:Vec3;thickness:number}[];
 channels:{id:string;parentStructureId:string;floor:Vec3[];leftBankId:string;rightBankId:string;width:number;depth:number}[];
 zones:EquipmentZone[];
 coverage:{method:'actual-triangle-area / exposed contact samples';directions:Record<CoverageDirection,{exposedM2:number;eligibleM2:number;coveredM2:number;excludedM2:number;ratio:number}>;excluded:{surfaceId:string;areaM2:number;reason:string}[]};
 functionalPrefabIds:string[];overallBounds:BoundsData;
 decisions:{stage:string;sourceId:string;status:'accepted'|'omitted'|'rejected';reason:string}[];
 attempts:{candidate:number;reasons:string[]}[];
 stages:{stage:string;input:string;output:string}[];
 validation:{issues:string[];checks:string[]};
}

export interface ProductionTimings {hullMs:number;armorMs:number;coverageMs:number;functionalMs:number;installationMs:number;validationMs:number;totalMs:number}
