import {validateRequirements} from './requirements';
import{validateDesignDoctrine}from'./doctrine';
import type{ShipBlueprint}from'../../blueprint/types';
import{measureProductionCoverage}from'./armor';
import{containsProductionVolume as containsVolume}from'./surface-contact';
import{boundsOf,dot,sub}from'../integration/contours';
import{solidTriangles,area,normal,cross,inPolygon}from'../armor/panels';
import{geometrySamples,solidContains}from'../weapons/collision';
import{inReservedZone}from'../integration/reservations';
import{reservationBounds,reservationSamples,overlappingBounds}from'../armor/geometry';
import{FAMILY_COMPATIBILITY}from'../macro/plan';
export function validateProduction(b:ShipBlueprint){
 const d=b.productionDesign;if(!d)return{issues:[],checks:[]};const issues:string[]=[],ids=new Set<string>(),volumes=new Map(b.structuralVolumes.map(v=>[v.id,v]));
 if(!['1.8.4','1.8.5','1.8.5.1','1.8.5.2','1.8.5.3','1.8.5.3.1','1.8.5.4','1.8.5.4.1'].includes(b.generatorVersion)||d.pipelineVersion!=='1.8.4'||d.status!=='generated'||b.structuralArmorPilot||b.functionalExterior||b.layeredArmor||!b.weaponLayout||b.weaponLayout.status!=='production')issues.push('Invalid production ownership/version');
 if(d.family!==b.macroDesign?.family||!FAMILY_COMPATIBILITY[b.architecture.grammar].includes(d.family))issues.push('Unsupported family/architecture');
 if(!d.armor.length||!d.armor.some(c=>c.role==='VENTRAL_KEEL'||c.role==='BELLY_CITADEL'))issues.push('Missing mandatory structural armor / ventral protection');
 const solids=[...d.armor,...d.finish];
 for(const c of solids){
  if(ids.has(c.id)||!volumes.has(c.parentStructureId))issues.push(`Invalid production armor reference ${c.id}`);ids.add(c.id);
  if(JSON.stringify(boundsOf(c.solid.vertices))!==JSON.stringify(c.bounds))issues.push(`Stale armor bounds ${c.id}`);
  let volume=0;const edges=new Map<string,number>();
  for(const[a,u,v]of solidTriangles(c.solid)){if([a,u,v].some(p=>Object.values(p).some(x=>!Number.isFinite(x)))||area([a,u,v])<1e-7||Object.values(normal([a,u,v])).some(x=>!Number.isFinite(x)))issues.push(`Invalid armor triangle ${c.id}`);volume+=dot(a,cross(u,v))/6;}
  for(let i=0;i<c.solid.indices.length;i+=3)for(let j=0;j<3;j++){const a=c.solid.indices[i+j],u=c.solid.indices[i+(j+1)%3],key=[Math.min(a,u),Math.max(a,u)].join('/');edges.set(key,(edges.get(key)??0)+1);}
  if(volume<=0||[...edges.values()].some(n=>n!==2))issues.push(`Open/inverted armor ${c.id}`);
  const parent=volumes.get(c.parentStructureId),roots='contactSamples'in c?c.contactSamples:c.root;
  if(!parent||!roots.length||roots.some(p=>!containsVolume(parent,p,b.order.length*.0005)))issues.push(`Detached armor root ${c.id}`);
  if(roots.some(p=>!solidContains(c.solid,p)&&!solidTriangles(c.solid).some(t=>{const n=normal(t),distance=dot(n,sub(p,t[0]));return Math.abs(distance)<=Math.max(b.order.length*.002,('inset'in c?c.inset:0)*1.5)&&inPolygon(t,{x:p.x-n.x*distance,y:p.y-n.y*distance,z:p.z-n.z*distance},n,b.order.length*.002);})))issues.push(`Floating armor away from recorded attachment ${c.id}`);
  for(const z of d.zones)if(overlappingBounds(c.bounds,reservationBounds(z))&&(geometrySamples(c.solid).some(p=>inReservedZone(p,z))||reservationSamples(z).some(p=>solidContains(c.solid,p))))issues.push(`Armor occludes ${z.id}/${c.id}`);
 }
 for(const c of d.channels)if(!ids.has(c.leftBankId)||!ids.has(c.rightBankId)||!volumes.has(c.parentStructureId)||c.depth<=0||c.width<=0||c.floor.some(p=>!containsVolume(volumes.get(c.parentStructureId)!,p,b.order.length*.0001)))issues.push(`Invalid service channel ${c.id}`);
 if(JSON.stringify(measureProductionCoverage(b,d))!==JSON.stringify(d.coverage))issues.push('Armor coverage does not match actual stored surfaces');
 for(const [direction,m]of Object.entries(d.coverage.directions))if(m.eligibleM2<0||m.excludedM2<0||m.coveredM2>m.eligibleM2+.001||Math.abs(m.eligibleM2+m.excludedM2-m.exposedM2)>.01||Math.abs(m.ratio-(m.eligibleM2?m.coveredM2/m.eligibleM2:1))>1e-6)issues.push(`Invalid measured coverage ${direction}`);
 if(b.weaponLayout?.sourceVersion!=='1.8.4'||b.weaponLayout.sourceSeed!==b.seed||b.weaponLayout.retiredHardpointIds.length||b.weaponLayout.supersededFoundationIds.length)issues.push('Production weapon ownership mismatch');
 for(const id of d.functionalPrefabIds){const p=b.prefabPlacements?.find(p=>p.id===id);if(!p?.assembly||!volumes.has(p.socket.hostId))issues.push(`Invalid functional socket ${id}`);
  else for(const part of p.assembly.parts){let volume=0;const edges=new Map<string,number>();for(const[a,u,v]of solidTriangles(part.solid)){if(area([a,u,v])<1e-7||[a,u,v].some(q=>Object.values(q).some(x=>!Number.isFinite(x))))issues.push(`Invalid functional geometry ${part.id}`);volume+=dot(a,cross(u,v))/6;}for(let i=0;i<part.solid.indices.length;i+=3)for(let j=0;j<3;j++){const a=part.solid.indices[i+j],v=part.solid.indices[i+(j+1)%3],key=[Math.min(a,v),Math.max(a,v)].join('/');edges.set(key,(edges.get(key)??0)+1);}if(volume<=0||[...edges.values()].some(n=>n!==2)||JSON.stringify(boundsOf(part.solid.vertices))!==JSON.stringify(part.bounds))issues.push(`Open/inverted/stale functional geometry ${part.id}`);}
 }
 for(const target of b.macroDesign!.negativeSpaceTargets)for(const x of[-.35,0,.35])for(const y of[-.35,0,.35])for(const z of[-.35,0,.35]){const p={x:target.center.x+target.size.x*x,y:target.center.y+target.size.y*y,z:target.center.z+target.size.z*z};if(!b.structuralVolumes.some(v=>containsVolume(v,p,0))&&solids.some(c=>p.x>=c.bounds.min.x&&p.x<=c.bounds.max.x&&p.y>=c.bounds.min.y&&p.y<=c.bounds.max.y&&p.z>=c.bounds.min.z&&p.z<=c.bounds.max.z&&solidContains(c.solid,p)))issues.push(`Armor fills actual negative-space sample ${target.id}`);}
 const allVertices=[...solids.flatMap(c=>c.solid.vertices),...(b.prefabPlacements??[]).flatMap(p=>p.assembly?.parts.flatMap(c=>c.solid.vertices)??[])];
 if(allVertices.some(p=>(['x','y','z']as const).some(k=>p[k]<d.overallBounds.min[k]-.001||p[k]>d.overallBounds.max[k]+.001)))issues.push('Production bounds exclude exterior');
 issues.push(...validateDesignDoctrine(b),...validateRequirements(b));
 return{issues:[...new Set(issues)],checks:['Compatible macro plan and exclusive generated ownership','Closed finite armor volumes, measured station root contacts','Explicit functional opening exclusions and independent six-direction area measurement','Stored command/engine/service assemblies and armor-mounted atomic weapon groups','Exterior bounds include armor, functional equipment and weapons']};
}
