import type {Vec3} from '../blueprint/types';
import type {DamageEvent, DamageInstance, DamageTarget, ProjectileSpec, ProjectileState, CapabilitySummary} from '../damage/types';

export type WarheadFamily = 'KINETIC_IMPACT' | 'FRAGMENTATION' | 'DIRECTIONAL';
export type DetonationContext = 'EXTERNAL_VACUUM' | 'SURFACE_CONTACT' | 'INTERNAL_COMPARTMENT' | 'EXTERIOR_UNRESOLVED' | 'INVALID_LOCATION';
export type SamplingQuality = 'LOW' | 'MEDIUM' | 'HIGH';
export interface WarheadSpec {
  warheadSpecId: string;
  provenance: 'FICTIONAL_GAME_TEST_V1';
  warheadFamily: WarheadFamily;
  nominalMassKg: number;
  casingMassKg: number;
  fragmentationProfile: {physicalPopulation: number; diameterMm: number; lengthMm: number; material: ProjectileSpec['projectileMaterial']};
  directionalProfile: {halfAngleDegrees: number; distribution: 'SPHERE' | 'UNIFORM_SOLID_ANGLE_CONE'};
  abstractEffectBudget: {carrierKineticJ: number; units: 'GAME_ASSIGNED_J_NOT_EXPLOSIVE_CHEMISTRY'};
  detonationBehavior: {flightSeconds: number; secondaryAllowed: boolean};
  deterministicSamplingProfile: 'FIXED_POPULATION_ANGULAR_QUADRATURE_V1';
  damageCarrierProfile: ProjectileSpec['collisionProfile'];
  kineticBody?: ProjectileSpec;
}
export type TriggerProof =
 | {kind:'LAB_MANUAL'}
 | {kind:'IMPACT';shotId:string;ownerId:string;layerId:string;time:number;kineticAlreadyApplied:true}
 | {kind:'PROXIMITY';referenceStructureId:string;maximumDistanceM:number;sampleTimeSeconds:number;elapsedSeconds:number;armAfterSeconds:number}
 | {kind:'TIMED';launchedAtSeconds:number;fuseDelaySeconds:number;observedTimeSeconds:number};
export interface DetonationEvent {
  eventId:string; warheadSpecId:string; sourceEquipmentId?:string; sourceMissileId?:string;
  timeSeconds:number; worldPosition:Vec3; worldVelocity:Vec3; forwardDirection:Vec3;
  detonationTrigger:TriggerProof['kind']; triggerProof:TriggerProof; detonationContext:DetonationContext;
  compartmentId?:string; shipInstanceId:string; randomSeed:number; approximationQuality:SamplingQuality;
  secondaryEnabled:boolean;
}
export interface ContextResult {context:DetonationContext; compartmentIds:string[]; physicalOwners:string[]; reasons:string[];}
export interface FragmentSummary {
  fragmentId:string; angularSampleId:number; generation:0|1; parentContactId?:string;sourcePhysicalOwnerId?:string;sourceLayerId?:string;sourcePosition?:Vec3;sourceDirection?:Vec3; sourceBudgetRef:string;
  initialMassKg:number; initialRelativeEnergyJ:number; status:ProjectileState['status']; outcome?:string;
  contacts:number; finalMassKg:number; finalRelativeEnergyJ:number;
}
export interface DetonationRecord {
  schemaVersion:1; specification:WarheadSpec; event:DetonationEvent; status:'PENDING'|'COMPLETE'|'PARTIAL'|'UNRESOLVED'|'REJECTED'|'CANCELLED';
  context:ContextResult; warnings:string[]; elapsedSeconds:number;
  generatedAngularSamples:number; generatedPhysicalFragments:number; representedPhysicalFragments:number;
  secondaryFragments:number; secondarySuppressed:number; contactCount:number; blockedFragments:number; penetratedFragments:number;
  /** Paths encountering a boundary, including unresolved boundaries; not a verified damage count. */
  hitFragments:number; unresolvedFragments:number; resolvedFragments:number; uniqueHitOwners:string[]; damagedObjects:string[];
  traceTruncatedContacts:number; fragments:FragmentSummary[];
  budget:{nominalMassKg:number;casingMassKg:number;unmodeledBodyMassKg:number;primaryMassKg:number;primaryKineticJ:number;
    assignedEffectJ:number;unmodeledAssignedEffectJ:number;inheritedKineticJ:number;secondaryReallocatedMassKg:number;secondaryReallocatedJ:number;
    localDepositedJ:number;finalCarrierKineticJ:number;energyBalanceErrorJ:number;};
  capabilityBefore?:CapabilitySummary; capabilityAfter?:CapabilitySummary;
}
/** Runtime handle only: target/query/working arrays never go into Blueprint or instance history. */
export interface DetonationWork {
  record:DetonationRecord; target:DamageTarget; state:DamageInstance; carriers:ProjectileState[]; contacts:DamageEvent[];
  elapsedSeconds:number; phase:'PENDING'|'COMPLETE'; lastDamageCount:Map<string,number>; processedContacts:Set<string>;
  rawQueryCache:Map<string,readonly import('../damage/types').Contact[]>;
  scan?:{active:ProjectileState[];index:number;next?:ProjectileState;time:number;};
  diagnostics:{initializationMs:number;queryMs:number;materialMs:number;damageMs:number;capabilityMs:number;workMs:number;boundaries:number;queryCalls:number;rawCacheHits:number;};
}
export interface MountedWarheadBinding {mountedEquipmentId:string; warheadSpecId:string; provenance:'EXPLICIT_GAME_SPEC_BINDING';}
