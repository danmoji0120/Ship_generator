import type {ShipBlueprint} from '../blueprint/types';
import {savedFit} from '../free-mount/planner';
import {renderEquipmentPreview} from './equipment-preview';
export function renderFreeMounts(b:ShipBlueprint){const root=renderEquipmentPreview({version:'1.8.5.4.2',request:{scope:'AUTO',equipmentId:'gun-210'},results:(b.freeMountPlan?.entries??[]).map(savedFit),elapsedMs:0,cached:false,limitations:[]},b);root.name='Installed free-mount equipment';root.userData.freeEquipment=true;return root;}
