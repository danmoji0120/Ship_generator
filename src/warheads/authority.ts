import type{DamageInstance,DamageTarget}from'../damage/types';
import type{DetonationEvent}from'./types';
import{beginDetonation}from'./engine';
export const AUTHORITATIVE_PHYSICS_POLICY=Object.freeze({id:'AUTHORITATIVE_HIGH_V1',angularDirections:256,physicalPopulation:256,approximationQuality:'HIGH' as const,provenance:'GAME_APPROXIMATION_NOT_REAL_FRAGMENT_TRUTH'});
/** The combat-facing contract has no graphics/visual quality input. Legacy LOW/MEDIUM
 * beginDetonation calls remain explicit laboratory diagnostics, never client graphics policy. */
export function beginAuthoritativeDetonation(target:DamageTarget,state:DamageInstance,input:Omit<DetonationEvent,'approximationQuality'>){return beginDetonation(target,state,{...input,approximationQuality:AUTHORITATIVE_PHYSICS_POLICY.approximationQuality});}
