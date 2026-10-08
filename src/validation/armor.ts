import type {ShipBlueprint} from '../blueprint/types';
import {area,normal,solidTriangles,inPolygon,inPanel} from '../generation/armor/panels';
import {dot,sub,boundsOf} from '../generation/integration/contours';
import {measureArmorCoverage} from '../generation/armor/coverage';
import {inReservedZone} from '../generation/integration/reservations';
import {DIRECTIONS} from '../generation/armor/surfaces';
export function validateLayeredArmor(b:ShipBlueprint) {
 const a=b.layeredArmor;if(!a)return b.generatorVersion==='1.8.1'?['Missing omnidirectional armor']:[];
 const errors:string[]=[],segments=a.assemblies.flatMap(a=>a.segments),map=new Map(segments.map(s=>[s.id,s])),surfaces=new Map(a.surfaces.map(s=>[s.id,s])),volumes=new Set(b.structuralVolumes.map(v=>v.id));
 const finite=(x:unknown):boolean=>typeof x==='number'?Number.isFinite(x):Array.isArray(x)?x.every(finite):x&&typeof x==='object'?Object.values(x).every(finite):true;
 if(!finite(a))errors.push('Nonfinite armor data');
 if(map.size!==segments.length||surfaces.size!==a.surfaces.length||new Set(a.seams.map(s=>s.id)).size!==a.seams.length)errors.push('Duplicate armor ID');
 for(const s of segments) {
  const surface=surfaces.get(s.surfaceId),parent=s.parentArmorId?map.get(s.parentArmorId):undefined;
  if(!surface||!volumes.has(s.parentStructureId)||surface.parentStructureId!==s.parentStructureId){errors.push(`Armor parent ${s.id}`);continue;}
  if(s.parentArmorId&&(!parent||parent.layer>=s.layer))errors.push(`Armor layer cycle/reference ${s.id}`);
  if(s.thickness<=0||s.chamfer<=0||s.chamfer>=.3||s.insetDepth<0||s.panelGap<=0||Math.abs(Math.hypot(...Object.values(s.orientation))-1)>.001)errors.push(`Armor dimensions/normal ${s.id}`);
  const plane=parent?.topPolygon??surface.triangle;
  if(s.contactSurface.some(c=>Math.abs(dot(sub(c.position,plane[0]),s.orientation))>b.order.length*.00001||!inPolygon(plane,c.position,s.orientation,.00001)))errors.push(`Detached armor root ${s.id}`);
  let volume=0;for(const [p,q,r]of solidTriangles(s.solid)){if(area([p,q,r])<1e-10)errors.push(`Degenerate armor triangle ${s.id}`);volume+=dot(p,{x:q.y*r.z-q.z*r.y,y:q.z*r.x-q.x*r.z,z:q.x*r.y-q.y*r.x})/6;}
  if(!(volume>0))errors.push(`Inverted armor volume ${s.id}`);
  if(s.solid.vertices.some(p=>a.reservedZones.some(z=>inReservedZone(p,z))))errors.push(`Armor functional clearance ${s.id}`);
  if(JSON.stringify(boundsOf(s.solid.vertices))!==JSON.stringify(s.bounds))errors.push(`Armor bounds mismatch ${s.id}`);
  for(const p of s.solid.vertices)if((['x','y','z']as const).some(k=>p[k]<a.overallBounds.min[k]-1e-5||p[k]>a.overallBounds.max[k]+1e-5))errors.push(`Overall armor bounds ${s.id}`);
 }
 for(const seam of a.seams)if(!map.has(seam.panelId)||!surfaces.has(seam.surfaceId)||seam.depthMeters<=0||seam.gapMeters<=0)errors.push(`Invalid physical seam ${seam.id}`);
 if(JSON.stringify(measureArmorCoverage(b,a.assemblies,a.surfaces))!==JSON.stringify(a.coverage))errors.push('Armor coverage cache mismatch');
 for(const dir of DIRECTIONS)if(a.coverage.byDirectionRatio[dir]<.90)errors.push(`Insufficient ${dir} armor coverage`);
 if(a.budget.segmentCount!==segments.length||a.budget.segmentCount>a.budget.segmentLimit||a.budget.triangleCount>a.budget.triangleLimit)errors.push('Armor polygon budget');
 for(const h of b.hardpoints) {
  if(h.type==='Spinal'){if(h.surfaceMount)errors.push('Spinal muzzle must retain axial mounting');continue;}
  const m=h.surfaceMount;if(!m){errors.push(`Missing armor mount ${h.id}`);continue;}
  const panel=map.get(m.armorId);
  if(!panel||panel.surfaceId!==m.surfaceId||panel.parentStructureId!==h.parentId){errors.push(`Hardpoint armor reference ${h.id}`);continue;}
  if(!inPolygon(panel.topPolygon,m.position,panel.orientation,1e-4)||Math.abs(dot(sub(m.position,panel.topPolygon[0]),panel.orientation))>1e-4)errors.push(`Detached armor socket ${h.id}`);
  const expected={x:m.position.x+m.mountNormal.x*m.foundation.height,y:m.position.y+m.mountNormal.y*m.foundation.height,z:m.position.z+m.mountNormal.z*m.foundation.height};
  if(Math.hypot(h.position.x-expected.x,h.position.y-expected.y,h.position.z-expected.z)>.0001||dot(h.normal,m.mountNormal)<.999)errors.push(`Detached surface hardpoint ${h.id}`);
  if(m.foundation.supportedArmorIds.some(id=>!map.has(id))||m.foundation.contactPoints.length!==8||m.foundation.height<=0||m.foundation.height>Math.max(b.order.length*.006,h.radius*.6)+1e-6)errors.push(`Invalid mount foundation ${h.id}`);
  const muzzle={x:h.position.x+h.normal.x*h.radius,y:h.position.y+h.normal.y*h.radius,z:h.position.z+h.normal.z*h.radius};
  if(segments.some(s=>(['x','y','z']as const).every(k=>muzzle[k]>=s.bounds.min[k]&&muzzle[k]<=s.bounds.max[k])&&inPanel(s.solid,muzzle,-1e-4)))errors.push(`Armor firing corridor ${h.id}`);
 }
 const external=b.hardpoints.filter(h=>h.surfaceMount);
 for(let i=0;i<external.length;i++)for(const h of external.slice(i+1)){
  const first=external[i],radius=first.surfaceMount!.clearance.radius+h.surfaceMount!.clearance.radius;
  if(Math.hypot(first.position.x-h.position.x,first.position.z-h.position.z)<radius-1e-5)errors.push(`Overlapping armor mounts ${first.id}/${h.id}`);
 }
 return [...new Set(errors)];
}
