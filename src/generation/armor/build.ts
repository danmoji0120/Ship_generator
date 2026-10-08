import type {ShipBlueprint,Vec3} from '../../blueprint/types';
import type {ArmorSegment,ArmorAssembly,ArmorSurface} from './types';
import {extractArmorSurfaces} from './surfaces';
import {measureArmorCoverage} from './coverage';
import {area,panelSolid,scalePolygon,solidTriangles,panelCourses} from './panels';
import {center,boundsOf,mix,add,mul} from '../integration/contours';
import {ARMOR_LANGUAGES} from './language';
import {mountArmorHardpoints} from './mounts';
/** Finishes stored V1.8 geometry. Structural volumes, Macro mass and integration remain immutable. */
export function buildLayeredArmor(b:ShipBlueprint) {
 const {surfaces,zones}=extractArmorSurfaces(b),language=ARMOR_LANGUAGES[b.shipyardId],l=b.order.length;
 const assemblies:ArmorAssembly[]=b.structuralVolumes.map(v=>({id:`armor-${v.id}`,parentStructureId:v.id,family:b.macroDesign!.family,language:b.shipyardId,segments:[]}));
 const assemblyMap=new Map(assemblies.map(a=>[a.parentStructureId,a])),segments:ArmorSegment[]=[],decisions:NonNullable<ShipBlueprint['layeredArmor']>['decisions']=[];
 const family=b.macroDesign!.family;
 const sizes=[l*.075,l*.022];
 function create(s:ArmorSurface,polygon:Vec3[],id:string,layer:1|2|3,parent?:ArmorSegment) {
  // Constant small fractional gaps preserve >90% coverage even on narrow cap facets.
  const gapRatio=b.shipyardId==='aegis'?.009:b.shipyardId==='forge'?.010:b.shipyardId==='vesper'?.006:.005;
  let root=scalePolygon(polygon,parent?.layer===1?.73:1-gapRatio);
  const volume=b.structuralVolumes.find(v=>v.id===s.parentStructureId)!;
  const shortest=Math.min(...root.map((p,i)=>Math.hypot(p.x-root[(i+1)%root.length].x,p.y-root[(i+1)%root.length].y,p.z-root[(i+1)%root.length].z)));
  const depth=Math.min(l*.0035,volume.dimensions.y*.028,shortest*.055)*(language.depth/.20)*(.75+b.order.priorities.survivability*.004);
  const thickness=parent?parent.thickness*(layer===2?.42:.22):Math.max(l*.000005,depth);
  const inset=parent?thickness*.12:thickness*.15;

  const chamfer=b.shipyardId==='aegis'?.16:b.shipyardId==='forge'?.13:b.shipyardId==='vesper'?.08:.07;
  // Truncated corners differ by doctrine; cap and top are flat, never a narrow wedge or horn.
  const clip=b.shipyardId==='forge'?.014:b.shipyardId==='aegis'?.023:.010;
  if((s.direction==='top'||s.direction==='bottom')&&layer===1)root=root.flatMap((p,i)=>[mix(p,root[(i+root.length-1)%root.length],clip),mix(p,root[(i+1)%root.length],clip)]);
  const {solid,top}=panelSolid(root,s.normal,thickness,inset,chamfer),c=center(root),a=area(root);
  const segment:ArmorSegment={id,parentStructureId:s.parentStructureId,...(parent?{parentArmorId:parent.id}:{}),surfaceId:s.id,layer,protectedZone:family==='SPLIT_FRAME'?'POD':family==='ENGINE_DOMINANT'?'PROPULSION':family==='WEAPON_DOMINANT'?'WEAPON_SUPPORT':family==='WIDE_CARRIER'?'HANGAR_FLANK':family==='HAMMERHEAD'?'BOW':'CITADEL',
   geometryKind:root.length===4?'RECTANGULAR_PANEL':root.length===6?'HEXAGONAL_PANEL':b.shipyardId==='vesper'?'LONGITUDINAL_STRIP':b.shipyardId==='serein'?'TRAPEZOIDAL_PANEL':b.shipyardId==='forge'?'CLIPPED_CORNER_PANEL':'ANGULAR_POLYGON_PANEL',
   ...(parent?{layeringStyle:language.style}:{}),rings:[],solid,rootPolygon:root,topPolygon:top,bounds:boundsOf(solid.vertices),thickness,outwardOffset:thickness,insetDepth:inset,panelGap:shortest*gapRatio,chamfer,orientation:s.normal,
   socket:{kind:'HULL_FACE',hostId:parent?.id??s.parentStructureId,position:parent?add(c,mul(s.normal,-inset)):c,normal:s.normal},contactSurface:root.map(position=>({position,normal:s.normal})),geometryParameters:{face:surfaces.indexOf(s),start:Math.min(...root.map(p=>p.z)),end:Math.max(...root.map(p=>p.z)),widthRatio:1-gapRatio,capRatio:1-chamfer*.12,endTaper:1},reservationReferences:zones.filter(z=>z.parentId===s.parentStructureId).map(z=>z.id),protection:{classification:layer===1?'PRIMARY':layer===2?'SECONDARY':'REINFORCEMENT',rating:b.order.priorities.survivability/100,simulated:false},validationStatus:'accepted',sizeClass:Math.sqrt(a)>sizes[0]?'LARGE':Math.sqrt(a)>sizes[1]?'MEDIUM':'SMALL'};
  segments.push(segment);assemblyMap.get(s.parentStructureId)!.segments.push(segment);
  return segment;
 }
 for(const s of surfaces)for(const [i,p]of s.patches.entries()) {
  if(p.exclusionReason){decisions.push({sourceId:`${s.id}-${i}`,status:'omitted',reason:p.exclusionReason,attemptedVariants:1});continue;}
  const lengthStep=l*(b.shipyardId==='aegis'?.18:b.shipyardId==='vesper'?.24:b.shipyardId==='forge'?.12:.16);
  const widthStep=l*(b.shipyardId==='aegis'?.15:b.shipyardId==='vesper'?.045:b.shipyardId==='forge'?.10:.12);
  const courses=panelCourses(p.polygon,s.direction==='fore'||s.direction==='aft'?'y':'z',lengthStep)
    .flatMap(poly=>panelCourses(poly,s.direction==='left'||s.direction==='right'?'y':'x',widthStep,b.shipyardId==='serein'?l*.035:0));
  for(const [course,poly]of courses.entries()) {
  const primary=create(s,poly,`panel-${s.id}-${i}-${course}`,1);
  // Sparse broad overlays follow the same exact facet. No axial ridge, no off-surface decoration.
  const ordinal=segments.length;
  const overlayRate=family==='SPLIT_FRAME'?19:b.shipyardId==='aegis'?7:b.shipyardId==='forge'?11:13;
  if(ordinal%overlayRate===0&&p.areaM2>l*l*.001)create(s,primary.topPolygon,`${primary.id}-overlay`,2,primary);
  if(ordinal%37===0&&ordinal%overlayRate!==0&&area(poly)>l*l*.001)create(s,primary.topPolygon,`${primary.id}-edge`,3,primary);
  }
 }
 const points=segments.flatMap(s=>s.solid.vertices),old=b.hullIntegration!.overallBounds;
 const triangles=segments.reduce((n,s)=>n+solidTriangles(s.solid).length,0);
 b.layeredArmor={surfaces,assemblies,supersededExteriorIds:(b.prefabPlacements??[]).filter(p=>p.kind==='ARMOR_ENVELOPE'||p.exterior?.phase==='equipment'&&['WEAPON_FOUNDATION','MISSILE_BAY_HOUSING','SENSOR_HOUSING'].includes(p.kind)).map(p=>p.id),
 seams:segments.filter(s=>s.layer===1).map(s=>({id:`seam-${s.id}`,panelId:s.id,surfaceId:s.surfaceId,gapMeters:s.panelGap,depthMeters:s.thickness,underlayer:surfaces.find(f=>f.id===s.surfaceId)?.parentExteriorId?'INTEGRATION_HOUSING':'STRUCTURAL_HULL'})),
 mountDecisions:[],decisions,reservedZones:zones,exteriorBounds:boundsOf(points),overallBounds:boundsOf([...points,old.min,old.max]),budget:{segmentLimit:5000,triangleLimit:200000,segmentCount:segments.length,triangleCount:triangles},units:'meters',coverage:measureArmorCoverage(b,assemblies,surfaces)};
 mountArmorHardpoints(b);
 return b;
}
