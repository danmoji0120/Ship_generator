import type { BoundsData, Vec3 } from '../../../blueprint/types';
import type { PanelSolid } from '../types';
/** Limited structural review prototype. These are large armor volumes, not panel tiles.
 * Optional export data; never synthesized when loading a historical blueprint. */
export interface StructuralArmorComponent {
  id: string;
  role: 'AXIAL_PROTECTION' | 'CITADEL' | 'SHOULDER' | 'SIDE_BELT' | 'SUPERSTRUCTURE_BASE' | 'COMMAND_PLINTH' | 'TRANSITION_NECK' | 'BELT_HAUNCH' | 'REAR_HOUSING' | 'VENTRAL_KEEL' | 'BELLY_CITADEL' | 'LOWER_HOUSING' | 'VENTRAL_TRANSITION';
  parentStructureId: string;
  parentArmorId?: string;
  additionalParentIds?: string[];
  rings: Vec3[][];
  solid: PanelSolid;
  contactSamples: Vec3[];
  inset: number;
  bounds: BoundsData;
}
export interface StructuralArmorPilot {
  status: 'one-ship-review' | 'limited-family-review';
  revision?: 'refined-connections' | 'ventral-keel-review' | 'ventral-flow-review';
  ventral?: {
    matings?: {id:string;fromId:string;toId:string;contactPoints:Vec3[]}[];
    sourceComponentIds: string[];
    componentIds: string[];
    levels: {id:string;parentStructureId?:string;position:Vec3;hullY:number;exteriorY:number;depth:number}[];
    recesses: {id:string;purpose:'MAINTENANCE';floor:Vec3[];mouthDepth:number;width:number;length:number;boundaryIds:string[]}[];
  };
  joints?: { id:string; fromId:string; toId:string; bridgeId:string; contactPoints:Vec3[] }[];
  source: { seed: number; generatorVersion: string; structuralDataUnchanged: true };
  components: StructuralArmorComponent[];
  channels: { id: string; parentStructureId?:string; floor: Vec3[]; leftBankId: string; rightBankId: string; width: number; depth: number }[];
  mounts: { hardpointId: string; parentArmorIds: string[]; originalPosition: Vec3; foundation: PanelSolid; contactSamples: Vec3[]; height: number; adjustmentReason?:string }[];
  supersededPrefabIds: string[];
  overallBounds: BoundsData;
  validation: { issues: string[]; checks: string[]; minimumChannelDepth: number; maximumMountLift: number };
}
