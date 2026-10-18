import{Ray,Vector3}from'three';
import{MATERIALS}from'../physical/materials';
import{solidCell,planes,rayPlanes}from'../physical/convex';
import type{ShipBlueprint,Vec3}from'../blueprint/types';
import{extractArmorSurfaces}from'../generation/armor/surfaces';
import{physicalSources,exposedFacetPolygons}from'../physical/geometry';
import{preparePhysicalQueries}from'../physical/probe';
import{area,normal}from'../generation/armor/panels';
import{boundsIndex}from'../generation/hardpoint-system/geometry';
import{add,mul,sub,center,mix,boundsOf}from'../generation/integration/contours';
import type{IntegrityPatch,ArmorAudit,AuditOptions,AuditWork,AuditDomain,IntegrityStatus}from'./types';
export const INTEGRITY_COLORS:Record<IntegrityStatus,number>={COVERED:0x65dc9c,INTENTIONALLY_EXPOSED:0xf2ce63,MISSING_ARMOR:0xff5769,UNRESOLVED:0xba82ed,VISUAL_PHYSICAL_MISMATCH:0x65aefc};
const constituentIds=new Set(Object.values(MATERIALS).flatMap(m=>m.layerDefinition.map(l=>l.constituentMaterialId)));
const piecePlanes=new WeakMap<object,ReturnType<typeof planes>>();
const domains:AuditDomain[]=['HULL_TARGET_FOOTPRINT','ARMOR_SOURCE_SKINS'];
const statuses:IntegrityStatus[]=['COVERED','INTENTIONALLY_EXPOSED','MISSING_ARMOR','UNRESOLVED','VISUAL_PHYSICAL_MISMATCH'];
const vec=(p:Vec3)=>new Vector3(p.x,p.y,p.z);
const triangles=(p:Vec3[])=>p.slice(1,-1).map((v,i)=>[p[0],v,p[i+2]]);
/** Stratify a real polygon into its interior and narrow edge bands. Weights are actual
 * tile areas, not equal weights on arbitrary sample points. Tiny unobserved holes remain possible. */
function tiles(p:Vec3[],band:number){const c=center(p),inner=p.map(v=>mix(v,c,band)),out=triangles(inner);for(let i=0;i<p.length;i++){const j=(i+1)%p.length;out.push([p[i],p[j],inner[j]],[p[i],inner[j],inner[i]]);}return out.filter(t=>area(t)>1e-9);}
export function beginArmorAudit(b:ShipBlueprint,options:AuditOptions={}):AuditWork{
 const start=performance.now(),max=options.maxSamples??20000,band=options.edgeBandFraction??.02;if(!Number.isInteger(max)||max<1||!Number.isFinite(band)||band<=0||band>=.25)throw Error('INVALID_ARMOR_AUDIT_OPTIONS');
 const sources=physicalSources(b),exposed=exposedFacetPolygons(sources),physicalById=new Map(b.physicalDesign?.surfaces.map(s=>[s.id,s])??[]),visible=new Set(options.visibleArmorSourceIds??sources.filter(s=>s.kind==='ARMOR').map(s=>s.id)),visualTriangles=sources.filter(s=>s.kind==='HULL'||visible.has(s.id)).flatMap(s=>s.triangles.map(t=>({id:s.id,kind:s.kind,triangle:t,bounds:boundsOf(t)}))),query=boundsIndex(visualTriangles),ray=new Ray(),hit=new Vector3();
 const result:ArmorAudit={version:'1.8.6.5.1',status:'PENDING',method:'AREA_WEIGHTED_INTERIOR_AND_EDGE_BAND_FINITE_RAYS',patches:[],summary:Object.fromEntries(domains.map(d=>[d,{sourceAreaM2:0,plannedEligibleAreaM2:0,intentionalExclusionAreaM2:0,physicalCoveredAreaEstimateM2:0,physicalUncoveredAreaEstimateM2:0,unresolvedAreaM2:0,visualMismatchAreaEstimateM2:0,sampledAreaM2:0,unsampledAreaM2:0,coverageEstimate:null,counts:Object.fromEntries(statuses.map(s=>[s,0]))}]))as ArmorAudit['summary'],confidence:'Stratified finite-ray area estimate, NOT proof of complete coverage. Edge bands are sampled explicitly. Unsampled/sub-tile holes may remain; no finite error bound claimed. Hull footprint and raised armor skin areas are separate domains and MUST NOT be added.',warnings:[],diagnostics:{preparationMs:0,physicalQueryPreparationMs:0,queryMs:0,queryCount:0,visualQueryMs:0,workMs:0}};
 let queries:AuditWork['queries'];if(b.physicalDesign){const qstart=performance.now();queries=preparePhysicalQueries(b);result.diagnostics.physicalQueryPreparationMs=performance.now()-qstart;}
 const work:AuditWork={blueprint:b,result,index:0,tasks:[],options:{...options,maxSamples:max},queries,physicalById,visualQuery(o,d,max){const hits:{id:string;kind:string;distance:number}[]=[];ray.set(vec(o),vec(d));for(const t of query(boundsOf([o,add(o,mul(d,max))]))){if(ray.intersectTriangle(vec(t.triangle[0]),vec(t.triangle[1]),vec(t.triangle[2]),false,hit)&&hit.distanceTo(ray.origin)<=max+1e-7)hits.push({id:t.id,kind:t.kind,distance:hit.distanceTo(ray.origin)});}const firstHull=Math.min(Infinity,...hits.filter(h=>h.kind==='HULL').map(h=>h.distance));return[...new Set(hits.filter(h=>h.kind==='ARMOR'&&h.distance<=firstHull+1e-7).map(h=>h.id))];}};
 const append=(domain:AuditDomain,surfaceId:string,parent:string,polygon:Vec3[],n:Vec3,planned:IntegrityPatch['planned'],policy:string,refs:string[],reason?:string,reservationId?:string)=>{
  if(options.domains&&!options.domains.includes(domain))return;
  for(const tile of tiles(polygon,band)){const point=center(tile),span=domain==='ARMOR_SOURCE_SKINS'?Math.max(.05,...[...physicalById.values()].filter(s=>s.geometryReference.sourceId===surfaceId).map(s=>s.thicknessMm/1000+.03)):Math.max(1,...sources.filter(s=>s.kind==='ARMOR'&&s.parent===parent).flatMap(s=>s.solid.vertices.map(v=>{const d=sub(v,point);return d.x*n.x+d.y*n.y+d.z*n.z+.05;}))),origin=add(point,mul(n,span));
   work.tasks.push({id:`audit/${domain}/${surfaceId}/${work.tasks.length}`,domain,surfaceId,parentStructureId:parent,protectionZone:domain==='ARMOR_SOURCE_SKINS'?(sources.find(s=>s.id===surfaceId)?.zone??'UNKNOWN'):'HULL_TARGET',polygon:tile,point,normal:n,areaM2:area(tile),planned,policy,sourceReferences:refs,...(reason?{exclusionReason:reason}:{}),...(reservationId?{reservationId}:{}),status:'UNRESOLVED',visual:{covered:null,sourceIds:[]},physical:{covered:null,layers:[],pieceReferences:[],hullOnly:false},ray:{origin,direction:mul(n,-1),maxDistanceM:span+(domain==='ARMOR_SOURCE_SKINS'?span:.02)},reason:'NOT_SAMPLED',warnings:[]});result.summary[domain].sourceAreaM2+=area(tile);
  }
 };
 const distribution=b.procurement?.order.armorDistribution;
 for(const s of extractArmorSurfaces(b).surfaces){const v=b.structuralVolumes.find(v=>v.id===s.parentStructureId);for(const p of s.patches){const unknown=v?.type==='SPINE'||!!s.parentExteriorId||!b.productionDesign,selective=distribution==='CITADEL'||distribution==='BALANCED'&&['top','bottom'].includes(s.direction),reason=p.exclusionReason;
  append('HULL_TARGET_FOOTPRINT',s.id,s.parentStructureId,p.polygon,s.normal,unknown?'UNKNOWN':reason?'EXCLUDED':selective?'UNKNOWN':'REQUIRED',distribution??(b.productionDesign?'LEGACY_PRODUCTION_FINISH':'UNKNOWN_LEGACY'),[s.id,s.parentStructureId,...(s.parentExteriorId?[s.parentExteriorId]:[])],unknown?'Unspecified exterior/SPINE or historical protection intent':reason,reservationId(p));
 }}
 for(const s of sources.filter(s=>s.kind==='ARMOR'))for(const[i,t]of s.triangles.entries())for(const poly of exposed(s,i))append('ARMOR_SOURCE_SKINS',s.id,s.parent,poly,normal(t),'REQUIRED','STORED_ARMOR_SOURCE',[s.id]);
 // Physical material with no Normal armor render source: preserve it and report, never regenerate a mesh.
 for(const s of physicalById.values())if(s.kind==='ARMOR'&&!visible.has(s.geometryReference.sourceId)){
  const piece=s.pieces[0];if(!piece)continue;const f=s.facets[piece.facetIndex],poly=piece.solid.vertices.filter(v=>Math.abs(v.x*f.normal.x+v.y*f.normal.y+v.z*f.normal.z-f.planeOffsetM)<1e-6);if(poly.length>=3)append('ARMOR_SOURCE_SKINS',s.geometryReference.sourceId,s.geometryReference.parentStructureId,poly.slice(0,3),f.normal,'REQUIRED','PHYSICAL_WITHOUT_NORMAL_RENDER_REFERENCE',[s.id]);
 }
 result.diagnostics.preparationMs=performance.now()-start;return work;
}
function reservationId(p:{reservationId?:string}){return p.reservationId;}
export function workArmorAudit(w:AuditWork,maxQueries=32,timeBudgetMs=8){const start=performance.now(),r=w.result;if(r.status!=='PENDING')return r;
 for(let count=0;w.index<w.tasks.length&&count<maxQueries;count++){
  const p=w.tasks[w.index++],s=r.summary[p.domain];
  if(r.diagnostics.queryCount>=w.options.maxSamples!){s.unsampledAreaM2+=p.areaM2;s.unresolvedAreaM2+=p.areaM2;s.counts.UNRESOLVED++;continue;}
  const vs=performance.now(),visual=w.visualQuery(p.ray.origin,p.ray.direction,p.ray.maxDistanceM);r.diagnostics.visualQueryMs+=performance.now()-vs;p.visual={covered:visual.length>0,sourceIds:visual};
  const qs=performance.now(),probe=w.queries?.probe(p.ray.origin,p.ray.direction,p.ray.maxDistanceM);r.diagnostics.queryMs+=performance.now()-qs;r.diagnostics.queryCount++;
  const armor=probe?.hits.filter(h=>h.isArmorLayer)??[];p.physical={covered:probe?.valid&&probe.complete?armor.length>0:null,layers:armor.map(({surfaceId,layerId,materialId,constituentMaterialId,pathLengthM,measuredNormalThicknessMm,entryPoint,exitPoint})=>({surfaceId,layerId,materialId,constituentMaterialId,pathLengthM,measuredNormalThicknessMm,entryPoint,exitPoint})),pieceReferences:[...new Set([...new Set(armor.map(h=>h.surfaceId))].flatMap(id=>{const s=w.physicalById.get(id);return s?.pieces.flatMap((piece,i)=>{let ps=piecePlanes.get(piece);if(!ps){ps=planes(solidCell(piece.solid));piecePlanes.set(piece,ps);}return rayPlanes(ps,p.ray.origin,p.ray.direction,p.ray.maxDistanceM)?[s.id+'/piece/'+i]:[];})??[];}))],hullOnly:!!probe?.hits.length&&!armor.length};
  if(p.planned==='UNKNOWN'&&!p.exclusionReason){if(armor.length||visual.length){p.planned='REQUIRED';p.policy+=' / retained actual structural armor';}else{p.planned='EXCLUDED';p.exclusionReason='Procurement '+p.policy+': optional broad finish not commissioned';}}
  const invalid=armor.some(h=>{const s=w.physicalById.get(h.surfaceId);return !constituentIds.has(h.constituentMaterialId)||!s||!MATERIALS[s.materialId]||!Number.isFinite(s.thicknessMm)||s.thicknessMm<=0||s.layerStack.some(l=>!Number.isFinite(l.thicknessMm)||l.thicknessMm<=0||!Number.isFinite(l.densityKgM3)||l.densityKgM3<=0);});if(invalid)p.physical.covered=null;
  p.warnings=probe?.unresolvedCrossings.map(u=>u.structureId+': '+u.reason)??['PHYSICAL_DATA_ABSENT'];
  if(invalid)p.warnings.push('UNKNOWN_MATERIAL_OR_INVALID_PHYSICAL_THICKNESS');
  if(p.planned==='UNKNOWN'||p.physical.covered===null){p.status='UNRESOLVED';p.reason=p.exclusionReason??p.warnings.join(';')??'Unresolved material or intent';}
  else if(p.planned==='EXCLUDED'){p.status='INTENTIONALLY_EXPOSED';p.reason=p.exclusionReason??'Actual exclusion';}
  else if(p.visual.covered!==p.physical.covered){p.status='VISUAL_PHYSICAL_MISMATCH';p.reason=p.visual.covered?'Stored Normal armor source intersects; finite physical armor does not':'Finite physical armor intersects; Normal armor source does not';}
  else if(p.physical.covered){p.status='COVERED';p.reason='Actual finite armor layer intersection';}
  else{p.status='MISSING_ARMOR';p.reason='Commissioned protection; no finite physical armor or Normal armor on this path';}
  s.sampledAreaM2+=p.areaM2;s.counts[p.status]++;
  if(p.status==='UNRESOLVED')s.unresolvedAreaM2+=p.areaM2;else if(p.planned==='EXCLUDED')s.intentionalExclusionAreaM2+=p.areaM2;else{s.plannedEligibleAreaM2+=p.areaM2;if(p.physical.covered)s.physicalCoveredAreaEstimateM2+=p.areaM2;else s.physicalUncoveredAreaEstimateM2+=p.areaM2;if(p.status==='VISUAL_PHYSICAL_MISMATCH')s.visualMismatchAreaEstimateM2+=p.areaM2;}
  r.patches.push(p);if(performance.now()-start>=timeBudgetMs)break;
 }
 for(const s of Object.values(r.summary))s.coverageEstimate=s.plannedEligibleAreaM2?s.physicalCoveredAreaEstimateM2/s.plannedEligibleAreaM2:null;
 if(w.index===w.tasks.length)r.status='COMPLETE';r.diagnostics.workMs+=performance.now()-start;return r;
}
export function auditArmorIntegrity(b:ShipBlueprint,options:AuditOptions={}){const w=beginArmorAudit(b,options);while(w.result.status==='PENDING')workArmorAudit(w,128,Infinity);return w.result;}
