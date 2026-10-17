import {prepareUnresolvedSpines,unresolvedCrossings}from'../physical/unresolved';
import type {ShipBlueprint,Vec3}from'../blueprint/types';
import type {Contact,DamageQueries,DamageInstance}from'./types';
import {preparePhysicalQueries}from'../physical/probe';
import {prepareStructuralQueries}from'../structure/query';
import {prepareInteriorQueries}from'../interior/query';
import {prepareFunctionalQueries}from'../systems/query';
import {HULL_MATERIALS}from'../physical/materials';
import {dot,sub,mul,add,boundsOf}from'../generation/integration/contours';
import {convexParts}from'../structure/geometry';
import {planes,rayPlanes}from'../physical/convex';
import {boundsIndex}from'../generation/hardpoint-system/geometry';
import {savedFit}from'../free-mount/planner';
const constituent=(id:string)=>HULL_MATERIALS[id as keyof typeof HULL_MATERIALS]?.layerDefinition[0].constituentMaterialId??null;
export function mergeContacts(list:Contact[]){
 const grouped=[...list].sort((a,b)=>a.ownerId.localeCompare(b.ownerId)||a.layerId.localeCompare(b.layerId)||a.entry-b.entry),merged:Contact[]=[];
 for(const c of grouped){if(c.exit-c.entry<=1e-8&&c.kind!=='UNRESOLVED')continue;const prev=merged.at(-1);if(prev&&prev.ownerId===c.ownerId&&prev.layerId===c.layerId&&prev.materialId===c.materialId&&c.entry<=prev.exit+1e-7){prev.exit=Math.max(prev.exit,c.exit);}else merged.push({...c});}
 return merged.sort((a,b)=>a.entry-b.entry||a.ownerId.localeCompare(b.ownerId)||a.layerId.localeCompare(b.layerId));
}
/** Prepared immutable finite queries; acceleration data is acquired once per laboratory target. */
export function prepareDamageQueries(b:ShipBlueprint):DamageQueries{
 if(!b.physicalDesign)throw Error('DAMAGE_PHYSICAL_CONTRACT_ABSENT_LEGACY_NOT_MIGRATED');
 const unspecified=prepareUnresolvedSpines(b,b.structuralVolumes.filter(v=>v.type!=='SPINE'&&!b.physicalDesign!.surfaces.some(s=>s.kind==='HULL'&&s.geometryReference.parentStructureId===v.id)));
 const physical=b.physicalDesign?preparePhysicalQueries(b):undefined,frame=b.structuralFrame?prepareStructuralQueries(b):undefined,interior=b.compartmentPlan?prepareInteriorQueries(b):undefined,systems=b.functionalSystems?prepareFunctionalQueries(b.functionalSystems):undefined;
 const members=new Map(b.structuralFrame?.members.map(m=>[m.id,{section:m.section,joints:m.jointIds}])??[]),equipment=new Map(b.functionalSystems?.equipment.map(e=>[e.id,e])??[]);
 // Exterior housings have geometry but no material specification. They are barriers of uncertainty.
 const alias=new Set([...(b.productionDesign?.armor??[]),...(b.productionDesign?.finish??[])].map(p=>p.id));
 const external=[...(b.prefabPlacements??[]).flatMap(p=>p.assembly?.parts.filter(p=>!alias.has(p.id)).map(q=>({id:q.id,solid:q.solid}))??[]),...(b.freeMountPlan?.entries??[]).flatMap(e=>savedFit(e).parts.map(p=>({id:p.id,solid:p.solid})))];
 const unique=[...new Map(external.map(p=>[p.id,p])).values()],unknown=unique.flatMap(e=>convexParts(e.solid).map(c=>({id:e.id,planes:planes(c),bounds:boundsOf(c.faces.flat())}))),near=boundsIndex(unknown);
 return {extentM:Math.max(b.order.length*4,100),warnings:[...(!physical?['LEGACY_PHYSICAL_SKINS_ABSENT']:[]),'Centerline swept collision. Finite penetrator radius influences work and local channel size, not lateral collision broadening.','Equipment uses specified OBB and smeared specification mass; joints share member material and have no independent solid.','Unspecified exterior housings stop resolution as UNRESOLVED.'],collect(o,d,max,state){
  const list:Contact[]=[],n=mul(d,-1),probe=physical?.probe(o,d,max);
  for(const h of probe?.hits??[])list.push({ownerId:h.surfaceId,geometryId:h.surfaceId,layerId:h.layerId,kind:h.isArmorLayer?'ARMOR':'HULL',materialId:h.constituentMaterialId,entry:h.entryDistanceM,exit:h.exitDistanceM,normal:h.entryBoundaryNormal??h.surfaceNormal,thicknessM:h.localFacetLayerThicknessMm/1000,confidence:'FINITE_FACETED_MATERIAL_CELLS'});
  for(const h of [...(probe?.unresolvedCrossings??[]),...unresolvedCrossings(unspecified,o,d,max).map(h=>({...h,reason:'STRUCTURAL_VOLUME_MATERIAL_CONTRACT_UNSPECIFIED'}))])list.push({ownerId:h.structureId,geometryId:h.structureId,layerId:'UNKNOWN',kind:'UNRESOLVED',materialId:null,entry:h.distanceM,exit:h.distanceM,normal:h.normal,thicknessM:0,confidence:h.reason});
  for(const h of frame?.probe(o,d,max).hits??[]){const m=members.get(h.memberId)!;list.push({ownerId:h.memberId,geometryId:h.memberId,layerId:'STRUCTURAL_MATERIAL',kind:'FRAME',materialId:constituent(h.materialId),entry:h.entryDistanceM,exit:h.exitDistanceM,normal:h.entryNormal??n,thicknessM:h.pathLengthM,sectionAreaM2:m.section.widthM*m.section.heightM,jointRefs:[...m.joints],confidence:'EXCLUSIVE_FINITE_FRAME_CELLS'});}
  const openingStates={...state.interior.openingStates};for(const [id,value]of Object.entries(openingStates))if(value==='BLOCKED'){const original=b.compartmentPlan?.openings.find(p=>p.id===id);openingStates[id]=state.blockedClosurePositions[id]??(original?.defaultState==='OPEN'?'OPEN':'CLOSED');}
  for(const h of interior?.probe(o,d,max,{...state.interior,openingStates}).hits??[])if(h.kind==='BULKHEAD'||h.kind==='CLOSURE')list.push({ownerId:h.id,geometryId:h.id,layerId:'STRUCTURAL_MATERIAL',kind:h.kind,materialId:constituent(h.materialId??''),entry:h.entryDistanceM,exit:h.exitDistanceM,normal:h.entryNormal??n,thicknessM:(h.thicknessMm??h.pathLengthM*1000)/1000,confidence:'FINITE_INTERIOR_MATERIAL'});
  for(const h of systems?.probe(o,d,max)??[]){const e=equipment.get(h.equipmentId)!,vol=e.sizeM.x*e.sizeM.y*e.sizeM.z,rho=HULL_MATERIALS[e.materialId as keyof typeof HULL_MATERIALS]?.densityKgM3??7850;list.push({ownerId:h.equipmentId,geometryId:e.geometryReference,layerId:'DEVICE_SMEARED_MASS',kind:'EQUIPMENT',materialId:constituent(h.materialId),entry:h.entryDistanceM,exit:h.exitDistanceM,normal:h.entryNormal??n,thicknessM:h.pathLengthM,equipmentMassKg:e.massKg,materialFillFraction:Math.min(1,e.massKg/(rho*vol)),confidence:h.approximation});}
  for(const p of near(boundsOf([o,add(o,mul(d,max))]))){const h=rayPlanes(p.planes,o,d,max);if(h)list.push({ownerId:p.id,geometryId:p.id,layerId:'UNKNOWN',kind:'UNRESOLVED',materialId:null,entry:h.entry,exit:h.exit,normal:h.entryNormal??n,thicknessM:h.exit-h.entry,confidence:'EXTERNAL_MATERIAL_UNSPECIFIED'});}
  return mergeContacts(list);
 }};
}
/** Exact interval of a ray in a finite, capped cylindrical penetration channel. */
export function cylinderInterval(o:Vec3,d:Vec3,a:Vec3,b:Vec3,r:number):[number,number]|undefined{
 const axis=sub(b,a),len=Math.hypot(axis.x,axis.y,axis.z);if(len<1e-9)return;const u=mul(axis,1/len),v=sub(o,a),dv=dot(d,u),vv=dot(v,u),dp=sub(d,mul(u,dv)),vp=sub(v,mul(u,vv)),A=dot(dp,dp),B=2*dot(dp,vp),C=dot(vp,vp)-r*r;
 let lo=-Infinity,hi=Infinity;if(A<1e-16){if(C>1e-10)return;}else{const disc=B*B-4*A*C;if(disc<0)return;lo=(-B-Math.sqrt(Math.max(0,disc)))/(2*A);hi=(-B+Math.sqrt(Math.max(0,disc)))/(2*A);}
 if(Math.abs(dv)<1e-12){if(vv<0||vv>len)return;}else{const x=-vv/dv,y=(len-vv)/dv;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}
 if(hi<=lo+1e-9)return;return [lo,hi];
}
export function damagedContacts(contacts:Contact[],state:DamageInstance,o:Vec3,d:Vec3):Contact[]{return contacts.flatMap(c=>{let spans:[[number,number]]|[number,number][]=[[c.entry,c.exit]];for(const region of state.local)if(region.ownerId===c.ownerId&&region.layerId===c.layerId&&region.channel){const h=region.channel,cut=cylinderInterval(o,d,h.entry,h.exit,h.radiusM);if(cut)spans=spans.flatMap(([a,b])=>cut[1]<=a+1e-8||cut[0]>=b-1e-8?[[a,b]]:[...(cut[0]>a+1e-8?[[a,cut[0]] as [number,number]]:[]),...(cut[1]<b-1e-8?[[cut[1],b] as [number,number]]:[])]);}
 return c.kind==='UNRESOLVED'?[c]:spans.filter(([a,b])=>b-a>1e-8).map(([entry,exit])=>({...c,entry,exit}));}).sort((a,b)=>a.entry-b.entry||a.ownerId.localeCompare(b.ownerId)||a.layerId.localeCompare(b.layerId));}
