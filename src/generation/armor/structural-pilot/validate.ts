import type { ShipBlueprint, Vec3 } from '../../../blueprint/types';
import type { StructuralArmorComponent } from './types';
import { containsVolume } from '../../architecture/volumes';
import { sub, dot, mix } from '../../integration/contours';
import { cross, solidTriangles, area, normal, inPolygon } from '../panels';
import { equipmentReservations, inReservedZone } from '../../integration/reservations';
import { reservationSamples } from '../geometry';
import {undersideHit} from './intersection';
import {ventralBodyBuilder} from './ventral-geometry';
/** Exact stored triangle-ray parity, including faceted nonplanar loft sides. No AABB seating test. */
export function containsStructuralArmor(c:StructuralArmorComponent,p:Vec3,tolerance=0) {
  const ray={x:1,y:.3713907,z:.529817},hits:number[]=[];
  for(const [a,b,d]of solidTriangles(c.solid)) {
    const n=normal([a,b,d]),distance=dot(n,sub(p,a));
    if(tolerance>=0&&Math.abs(distance)<=tolerance&&inPolygon([a,b,d],p,n,1e-6))return true;
    const e1=sub(b,a),e2=sub(d,a),h=cross(ray,e2),det=dot(e1,h);
    if(Math.abs(det)<1e-10)continue;
    const s=sub(p,a),u=dot(s,h)/det;if(u< -1e-9||u>1+1e-9)continue;
    const q=cross(s,e1),v=dot(ray,q)/det;if(v< -1e-9||u+v>1+1e-9)continue;
    const t=dot(e2,q)/det;if(t>1e-7)hits.push(t);
  }
  hits.sort((a,b)=>a-b);
  return hits.filter((t,i)=>i===0||Math.abs(t-hits[i-1])>1e-6).length%2===1;
}
export function validateStructuralArmorPilot(b:ShipBlueprint) {
  const pilot=b.structuralArmorPilot!,issues:string[]=[],checks:string[]=[],ids=new Set<string>();
  const pairs:Record<string,string>={WEDGE_CITADEL:'MONOLITHIC',HAMMERHEAD:'BLOCK_ASSEMBLY',ENGINE_DOMINANT:'CORE_AND_NACELLES'};
  if(!['one-ship-review','limited-family-review'].includes(pilot.status)||b.seed!==7||b.shipyardId!=='aegis'||b.order.length!==300||b.role!=='Cruiser'||pairs[b.macroDesign?.family??'']!==b.architecture.grammar)issues.push('Invalid pilot scope');
  if(pilot.components.length<8||pilot.channels.length<1||pilot.mounts.length!==b.hardpoints.length)issues.push('Incomplete structural review data');
  for(const c of pilot.components){
    if(ids.has(c.id))issues.push(`Duplicate structure ${c.id}`);ids.add(c.id);
    const hull=b.structuralVolumes.find(v=>v.id===c.parentStructureId),parent=pilot.components.find(v=>v.id===c.parentArmorId);
    if(!hull||c.parentArmorId&&!parent)issues.push(`Invalid parent ${c.id}`);
    const parents=[hull,...(c.additionalParentIds??[]).map(id=>b.structuralVolumes.find(v=>v.id===id))];
    if(parents.some(p=>!p))issues.push(`Invalid additional parent ${c.id}`);
    if(c.contactSamples.some(p=>parent?!containsStructuralArmor(parent,p,.001):!parents.some(v=>v&&containsVolume(v,p,.001))))issues.push(`Unseated root ${c.id}`);
    const triangles=solidTriangles(c.solid),edges=new Map<string,number>();let volume=0;
    for(const [a,d,e]of triangles){
      if([a,d,e].some(p=>Object.values(p).some(v=>!Number.isFinite(v))))issues.push(`Nonfinite ${c.id}`);
      if(area([a,d,e])<1e-7)issues.push(`Degenerate ${c.id}`);
      volume+=dot(a,cross(d,e))/6;
    }
    for(let i=0;i<c.solid.indices.length;i+=3)for(let j=0;j<3;j++){
      const a=c.solid.indices[i+j],d=c.solid.indices[i+(j+1)%3],key=[Math.min(a,d),Math.max(a,d)].join('/');edges.set(key,(edges.get(key)??0)+1);
    }
    if([...edges.values()].some(n=>n!==2))issues.push(`Open solid ${c.id}`);
    if(volume<=0)issues.push(`Inverted solid ${c.id}`);
    const ancestors=new Set([c.id]);let ancestor=c.parentArmorId;
    while(ancestor){
      if(ancestors.has(ancestor)){issues.push(`Cyclic armor parent ${c.id}`);break;}
      ancestors.add(ancestor);ancestor=pilot.components.find(c=>c.id===ancestor)?.parentArmorId;
    }
  }
  for(const p of [...pilot.components.flatMap(c=>c.solid.vertices),...pilot.mounts.flatMap(m=>m.foundation.vertices)])
    for(const axis of ['x','y','z'] as const)if(p[axis]<pilot.overallBounds.min[axis]-.001||p[axis]>pilot.overallBounds.max[axis]+.001)issues.push('Structural armor bounds');
  for(const join of pilot.joints??[]) {
    const a=pilot.components.find(c=>c.id===join.fromId),d=pilot.components.find(c=>c.id===join.toId),bridge=pilot.components.find(c=>c.id===join.bridgeId);
    if(!a||!d||!bridge)issues.push(`Invalid armor joint ${join.id}`);
    else if(!containsStructuralArmor(a,join.contactPoints[0])||!containsStructuralArmor(bridge,join.contactPoints[0])||!containsStructuralArmor(d,join.contactPoints[1])||!containsStructuralArmor(bridge,join.contactPoints[1]))issues.push(`Unmated armor joint ${join.id}`);
  }
  checks.push('Actual shared-volume contacts for transition necks');
  checks.push('IDs and parent references','Actual station-root contacts','Closed nondegenerate solids and positive signed volume');
  // Reciprocal cylinder probes supplement vertex/edge samples; this is not exhaustive triangle CSG.
  const reservations=equipmentReservations(b);
  for(const c of pilot.components)for(const z of reservations){
    const samples=solidTriangles(c.solid).flatMap(([a,d,e])=>[a,mix(a,d,.5),mix(d,e,.5),mix(e,a,.5)]);
    if(samples.some(p=>inReservedZone(p,z))||reservationSamples(z).some(p=>containsStructuralArmor(c,p,-.01)))issues.push(`Equipment corridor ${z.id} intersects ${c.id}`);
  }
  checks.push('Sampled exhaust, radiator, weapon and sensor corridors');
  for(const m of pilot.mounts){
    const h=b.hardpoints.find(h=>h.id===m.hardpointId);
    if(!h||!m.parentArmorIds.length||m.parentArmorIds.some(id=>!ids.has(id)))issues.push(`Mount references ${m.hardpointId}`);
    if(m.contactSamples.some(p=>!pilot.components.some(c=>containsStructuralArmor(c,{...p,y:p.y-.01},.02))))issues.push(`Floating foundation ${m.hardpointId}`);
    if(h&&m.height>Math.max(b.order.length*.006,h.radius*.6)+1e-5)issues.push(`Tall foundation ${m.hardpointId}`);
    const actualHeight=Math.max(...m.foundation.vertices.map(p=>p.y))-Math.min(...m.foundation.vertices.map(p=>p.y));
    if(!Number.isFinite(actualHeight)||Math.abs(actualHeight-m.height)>1e-5)issues.push(`Foundation height mismatch ${m.hardpointId}`);
    if(solidTriangles(m.foundation).some(t=>area(t)<1e-7||t.some(p=>Object.values(p).some(v=>!Number.isFinite(v)))))issues.push(`Invalid foundation geometry ${m.hardpointId}`);
    if(h&&m.foundation.vertices.slice(-8).some(p=>Math.abs(p.y-h.position.y)>.00001))issues.push(`Foundation cap ${m.hardpointId}`);
  }
  for(let i=0;i<pilot.mounts.length;i++)for(let j=0;j<i;j++) {
    const a=b.hardpoints.find(h=>h.id===pilot.mounts[i].hardpointId)!,d=b.hardpoints.find(h=>h.id===pilot.mounts[j].hardpointId)!;
    if(Math.hypot(a.position.x-d.position.x,a.position.z-d.position.z)<(a.radius+d.radius)*1.30)issues.push(`Overlapping foundations ${a.id}/${d.id}`);
  }
  checks.push('Low physical foundation height and mount spacing');
  checks.push('8-point surface-seated foundations','Every original hardpoint retained, vertical mount firing clearances');
  for(const channel of pilot.channels){
    const v=b.structuralVolumes.find(v=>v.id===channel.parentStructureId);
    if(channel.width<Math.min(b.order.length*.02,v?v.dimensions.x*.12:Infinity)||channel.depth<Math.min(b.order.length*.03,v?v.dimensions.y*.12:Infinity))issues.push(`Shallow/narrow channel ${channel.id}`);
    if(channel.floor.some(p=>pilot.components.some(c=>containsStructuralArmor(c,{...p,y:p.y+.5},-.01))))issues.push(`Filled channel ${channel.id}`);
  }
  checks.push('Open structural channels above intact structural hull');
  if(pilot.ventral){
    const v=pilot.ventral;
    if(pairs[b.macroDesign?.family??'']!==b.architecture.grammar)issues.push('Ventral review outside authorized family pairs');
    if(v.componentIds.some(id=>!ids.has(id))||v.sourceComponentIds.some(id=>!ids.has(id)))issues.push('Ventral component references');
    const lower=pilot.components.filter(c=>v.componentIds.includes(c.id));
    for(const level of v.levels){
      const hit=undersideHit(lower,level.position.x,level.position.z);
      if(level.parentStructureId){
        const parent=b.structuralVolumes.find(v=>v.id===level.parentStructureId);
        if(!parent)issues.push(`Ventral level parent ${level.id}`);
        else try{if(Math.abs(ventralBodyBuilder(parent,[],b.order.length).hullBottom(level.position.x,level.position.z)-level.hullY)>.001)issues.push(`Ventral hull surface measurement ${level.id}`);}catch{issues.push(`Ventral level outside parent ${level.id}`);}
      }
      if(!hit||Math.abs(hit.y-level.exteriorY)>.001||Math.abs(level.hullY-level.exteriorY-level.depth)>.001)issues.push(`Ventral level measurements ${level.id}`);
    }
    const levels=[...new Set(v.levels.map(p=>Math.round(p.depth)))].sort((a,d)=>a-d);
    if(levels.length<3||levels.at(-1)!-levels[0]<b.order.length*.035)issues.push('Insufficient ventral hierarchy');
    for(const recess of v.recesses){
      if(recess.boundaryIds.some(id=>!v.componentIds.includes(id)))issues.push(`Recess boundary references ${recess.id}`);
      if(recess.floor.some(p=>pilot.components.some(c=>containsStructuralArmor(c,{...p,y:p.y-.5},-.01))))issues.push(`Filled ventral recess ${recess.id}`);
    }
    for(const c of lower){
      const parents=[c.parentStructureId,...(c.additionalParentIds??[])];
      const samples=solidTriangles(c.solid).flatMap(([a,d,e])=>[a,mix(a,d,.5),mix(d,e,.5),mix(e,a,.5)]);
      for(const other of b.structuralVolumes.filter(p=>!parents.includes(p.id)))
        if(samples.some(p=>containsVolume(other,p,-.05)))issues.push(`Ventral intrudes unrelated hull ${c.id}/${other.id}`);
    }
    for(const mate of v.matings??[]){
      const a=lower.find(c=>c.id===mate.fromId),d=lower.find(c=>c.id===mate.toId);
      if(!a||!d||mate.contactPoints.length<3||mate.contactPoints.some(p=>!containsStructuralArmor(a,p)||!containsStructuralArmor(d,p)))issues.push(`Unmated ventral junction ${mate.id}`);
    }
    checks.push('Sampled non-parent Hull intrusion, stored shared ventral junction contacts');
    checks.push('Measured outward ventral tiers and open local maintenance recess');
  }
  return{issues:[...new Set(issues)],checks,minimumChannelDepth:Math.min(...pilot.channels.map(c=>c.depth)),maximumMountLift:pilot.validation.maximumMountLift};
}
