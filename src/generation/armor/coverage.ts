import type {ShipBlueprint} from '../../blueprint/types';
import type {ArmorAssembly,ArmorSurface,LayeredArmor} from './types';
import {DIRECTIONS} from './surfaces';
import {area} from './panels';
export function measureArmorCoverage(_b:ShipBlueprint,assemblies:ArmorAssembly[],surfaces:ArmorSurface[]=_b.layeredArmor?.surfaces??[]):LayeredArmor['coverage'] {
 const eligible=Object.fromEntries(DIRECTIONS.map(k=>[k,0])) as LayeredArmor['coverage']['byDirectionM2'], covered={...eligible},excluded={...eligible},reasons=new Map<string,number>();
 for(const s of surfaces)for(const p of s.patches)if(p.exclusionReason){excluded[s.direction]+=p.areaM2;reasons.set(p.exclusionReason,(reasons.get(p.exclusionReason)??0)+p.areaM2);}else eligible[s.direction]+=p.areaM2;
 const map=new Map(surfaces.map(s=>[s.id,s]));let secondary=0;
 for(const s of assemblies.flatMap(a=>a.segments))if(s.layer===1)covered[map.get(s.surfaceId)!.direction]+=area(s.rootPolygon);else if(s.layer===2)secondary+=area(s.rootPolygon);
 const ratios={...eligible};for(const k of DIRECTIONS)ratios[k]=eligible[k]?covered[k]/eligible[k]:1;
 const warnings=DIRECTIONS.filter(k=>ratios[k]<.90).map(k=>`${k} eligible surface coverage below 90%: ${ratios[k].toFixed(4)}`);
 const total=Object.values(covered).reduce((a,b)=>a+b,0);
 return {byDirectionM2:covered,availableByDirectionM2:eligible,excludedByDirectionM2:excluded,byDirectionRatio:ratios,exclusions:[...reasons].map(([reason,areaM2])=>({reason,areaM2})),coveredAreaM2:total,primaryAreaM2:total,secondaryAreaM2:secondary,warnings,bowPolicy:'Actual cap triangles paneled; spinal opening explicitly excluded',sternPolicy:'Actual cap triangles paneled around reserved exhaust outlets'};
}
