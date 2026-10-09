import type {MaterialLanguage,MaterialRole} from '../../rendering/appearance';
/** Physical wavelengths do not depend on hull length. Values are bounded visual modulation, not protection stats. */
export const SURFACE_PROFILES:Record<MaterialLanguage,{grain:number;contrast:number;brushing:number;markScale:number;wear:number;roles:Record<MaterialRole,{albedo:number;roughness:number;normal:number}>}> = Object.fromEntries(
 ['aegis','vesper','forge','serein'].map((yard,i)=>[yard,{
 grain:[.24,.16,.31,.12][i],contrast:[1,.7,1.2,.5][i],brushing:[.22,.65,.82,.32][i],markScale:[1,.8,1.05,.68][i],wear:[.8,.35,1,.25][i],
 roles:{PRIMARY_ARMOR:{albedo:.045,roughness:.045,normal:.008},SECONDARY_ARMOR:{albedo:.065,roughness:.065,normal:.010},MECHANICAL_STRUCTURE:{albedo:.065,roughness:.09,normal:.012},RECESSED_INTERIOR:{albedo:.08,roughness:.08,normal:.009},FUNCTIONAL_SURFACE:{albedo:.025,roughness:.025,normal:.004}}
 }])
) as unknown as Record<MaterialLanguage,{grain:number;contrast:number;brushing:number;markScale:number;wear:number;roles:Record<MaterialRole,{albedo:number;roughness:number;normal:number}>}>;
export function surfaceHash(s:string){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
