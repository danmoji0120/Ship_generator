import {PROJECTILES} from '../damage/registry';
import type {WarheadSpec,SamplingQuality} from './types';
export const SAMPLE_COUNTS:Readonly<Record<SamplingQuality,number>>=Object.freeze({LOW:64,MEDIUM:128,HIGH:256});
const specification=(id:string,family:WarheadSpec['warheadFamily'],diameterMm:number,lengthMm:number,speed:number,cone:number):WarheadSpec=>Object.freeze({
 warheadSpecId:id,provenance:'FICTIONAL_GAME_TEST_V1',warheadFamily:family,nominalMassKg:400,casingMassKg:256,
 fragmentationProfile:Object.freeze({physicalPopulation:256,diameterMm,lengthMm,material:family==='DIRECTIONAL'?'TUNGSTEN_ALLOY':'HARDENED_STEEL'}),
 directionalProfile:Object.freeze({halfAngleDegrees:cone,distribution:family==='DIRECTIONAL'?'UNIFORM_SOLID_ANGLE_CONE':'SPHERE'}),
 abstractEffectBudget:Object.freeze({carrierKineticJ:.5*256*speed*speed,units:'GAME_ASSIGNED_J_NOT_EXPLOSIVE_CHEMISTRY'}),
 detonationBehavior:Object.freeze({flightSeconds:.5,secondaryAllowed:true}),deterministicSamplingProfile:'FIXED_POPULATION_ANGULAR_QUADRATURE_V1',damageCarrierProfile:'CENTERLINE_SWEPT_FINITE_VOLUMES',
});
/** Invented SF game test budgets, not construction data or certified warhead performance. */
export const WARHEADS:Readonly<Record<string,WarheadSpec>>=Object.freeze({
 'test-fragmentation':specification('test-fragmentation','FRAGMENTATION',40,90,1800,180),
 'test-directional':specification('test-directional','DIRECTIONAL',22,160,3200,25),
 'test-kinetic':Object.freeze({...specification('test-kinetic','KINETIC_IMPACT',185,650,0,0),nominalMassKg:100,casingMassKg:0,fragmentationProfile:Object.freeze({physicalPopulation:0,diameterMm:185,lengthMm:650,material:'HARDENED_STEEL'}),kineticBody:PROJECTILES['dev-210'],detonationBehavior:Object.freeze({flightSeconds:.5,secondaryAllowed:false})}),
});
export const WARHEAD_LIMITS=Object.freeze({primaryPopulation:256,secondaryPopulation:16,secondaryGenerations:1,acceptedDetonations:128,history:16,contactTrace:512,rawQueryCache:1024});
export function validateWarhead(s:WarheadSpec){
 if(!['KINETIC_IMPACT','FRAGMENTATION','DIRECTIONAL'].includes(s.warheadFamily)||s.provenance!=='FICTIONAL_GAME_TEST_V1'||s.deterministicSamplingProfile!=='FIXED_POPULATION_ANGULAR_QUADRATURE_V1'||s.damageCarrierProfile!=='CENTERLINE_SWEPT_FINITE_VOLUMES')throw Error('UNSUPPORTED_WARHEAD_CONTRACT');
 if(![s.nominalMassKg,s.casingMassKg,s.abstractEffectBudget.carrierKineticJ].every(n=>Number.isFinite(n)&&n>=0)||s.nominalMassKg<=0||s.casingMassKg>s.nominalMassKg||!Number.isInteger(s.fragmentationProfile.physicalPopulation)||s.fragmentationProfile.physicalPopulation>WARHEAD_LIMITS.primaryPopulation||s.detonationBehavior.flightSeconds<=0||s.detonationBehavior.flightSeconds>5)throw Error('INVALID_WARHEAD_SPECIFICATION');
 if(![s.fragmentationProfile.diameterMm,s.fragmentationProfile.lengthMm,s.detonationBehavior.flightSeconds].every(n=>Number.isFinite(n)&&n>0)||!Number.isFinite(s.directionalProfile.halfAngleDegrees)||s.directionalProfile.halfAngleDegrees<0||s.directionalProfile.halfAngleDegrees>180)throw Error('INVALID_WARHEAD_PHYSICAL_PROFILE');
 if(s.warheadFamily!=='KINETIC_IMPACT'&&(s.fragmentationProfile.physicalPopulation!==256||s.casingMassKg<=0||s.abstractEffectBudget.carrierKineticJ<=0))throw Error('INVALID_FRAGMENT_POPULATION_OR_BUDGET');
}
