import type {ShipBlueprint} from '../../blueprint/types';
import {dot,sub} from '../integration/contours';
import {applySurfaceAppearance} from './build';
/** Metadata validity only. The planner records optional omissions, never rejects a physical hull. */
export function validateSurfaceAppearance(b:ShipBlueprint):string[]{
 const p=b.materialAppearance;if(!p||p.version!=='1.8.5.2')return[];const errors:string[]=[],ids=new Set<string>();
 if(p.texture.namespace!=='ship-surface-v1'||p.texture.tileResolution!==128||p.texture.projection!=='OBJECT_LOCAL_TRIPLANAR'||!Number.isFinite(p.texture.seed)||!['CLEAN','SERVICE','WEATHERED'].includes(p.finish)||p.decals.length>48)errors.push('Invalid procedural surface recipe');
 const parents=new Set([...(b.mesoStructurePlan?.placements??[]).flatMap(p=>p.parts.map(a=>a.id)),...b.structuralVolumes.map(v=>v.id),...(b.productionDesign?.armor??[]).map(c=>c.id),...(b.productionDesign?.finish??[]).map(c=>c.id),...(b.prefabPlacements??[]).filter(p=>p.exterior?.rings).map(p=>p.id),...(b.prefabPlacements??[]).flatMap(c=>(c.assembly?.parts??[]).map(p=>p.id)),...(b.exteriorDetailPlan?.kitPlacements??[]).flatMap(c=>c.assembly.parts.map(p=>p.id))]);
 for(const d of p.decals){if(ids.has(d.id)||!parents.has(d.parentId)||!b.structuralVolumes.some(v=>v.id===d.parentStructureId)||d.contacts.length!==9||!d.text||d.size.width<=0||d.size.height<=0||!Number.isFinite(d.size.width+d.size.height)||[d.position,d.normal,d.right,d.up].some(v=>Object.values(v).some(x=>!Number.isFinite(x)))||Math.abs(dot(d.normal,d.right))>1e-6||Math.abs(dot(d.normal,d.up))>1e-6||Math.abs(dot(d.normal,d.normal)-1)>1e-6||d.contacts.some(c=>c.surfaceId!==d.parentId||Math.abs(dot(sub(c.position,d.position),d.normal))>.03||Math.abs(dot(sub(c.position,d.position),d.right))>d.size.width*.5001||Math.abs(dot(sub(c.position,d.position),d.up))>d.size.height*.5001))errors.push('Invalid paint surface attachment '+d.id);ids.add(d.id);}
 for(const v of p.componentVariations)if(!parents.has(v.parentId)||!Number.isFinite(v.tone)||Math.abs(v.tone)>.1)errors.push('Invalid component finish '+v.parentId);
 return errors;
}
/** Optional precise QA replay: confirms all recorded exposed contacts and exclusion decisions from authoritative solids. */
export function validateSurfaceReplay(b:ShipBlueprint):string[]{const p=b.materialAppearance;if(p?.version!=='1.8.5.2')return[];const q=structuredClone(b);applySurfaceAppearance(q,p.finish);return JSON.stringify(q.materialAppearance)===JSON.stringify(p)?[]:['Surface appearance differs from deterministic exposed-surface replay'];}
