import {ARMOR_MATERIALS,HULL_MATERIALS} from '../physical/materials';
/** DEVELOPMENT_CALIBRATION_V1: work pressure, inertial drag and local failure modes.
 * Values are game calibration, not measured material/penetration performance. */
export interface BallisticMaterial {strengthPa:number;density:number;drag:number;brittleness:number;ricochetDegrees:number;craterFraction:number;}
const densities=new Map(Object.values({...ARMOR_MATERIALS,...HULL_MATERIALS}).flatMap(m=>m.layerDefinition.map(l=>[l.constituentMaterialId,l.densityKgM3] as const)));
const metal=(strengthPa:number,constituent:string,brittleness=.15):BallisticMaterial=>({strengthPa,density:densities.get(constituent)!,drag:.35,brittleness,ricochetDegrees:76,craterFraction:.12});
const ceramic=(strengthPa:number,constituent:string):BallisticMaterial=>({...metal(strengthPa,constituent,.9),ricochetDegrees:72,craterFraction:.35});
export const BALLISTIC_MATERIALS:Readonly<Record<string,BallisticMaterial>>=Object.freeze({
 ARMOR_STEEL:metal(4.5e9,'ARMOR_STEEL'),ARMOR_TITANIUM:metal(3.7e9,'ARMOR_TITANIUM',.2),
 CERAMIC_STRIKE_FACE:ceramic(8e9,'CERAMIC_STRIKE_FACE'),STEEL_BACKING:metal(3.8e9,'STEEL_BACKING'),FIBER_SPALL_BACKING:metal(.7e9,'FIBER_SPALL_BACKING',.7),
 TUNGSTEN_RICH_ALLOY:ceramic(7e9,'TUNGSTEN_RICH_ALLOY'),TITANIUM_BACKING:metal(3.2e9,'TITANIUM_BACKING'),LIGHT_SPALL_BACKING:metal(.6e9,'LIGHT_SPALL_BACKING',.65),
 SF_HARD_LAMINATE:ceramic(7.4e9,'SF_HARD_LAMINATE'),SF_TOUGH_LAMINATE:metal(4e9,'SF_TOUGH_LAMINATE',.25),SF_SPALL_LAMINATE:metal(1.6e9,'SF_SPALL_LAMINATE',.55),
 ALUMINUM_STRUCTURAL:metal(.55e9,'ALUMINUM_STRUCTURAL'),TITANIUM_STRUCTURAL:metal(1.1e9,'TITANIUM_STRUCTURAL'),STEEL_STRUCTURAL:metal(1.25e9,'STEEL_STRUCTURAL'),
});
export const DAMAGE_LIMITS=Object.freeze({history:256,localRegions:4096,contactsPerStep:128,ricochets:6,epsilonM:1e-7});
