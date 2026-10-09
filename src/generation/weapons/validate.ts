import type{ShipBlueprint}from'../../blueprint/types';
import{mountStandard}from'./standards';
import{armorSurfaces,localPoint,worldDirection,REGION_NORMAL}from'./surfaces';
import{solidTriangles,normal,inPolygon,area,cross}from'../armor/panels';
import{dot,sub,add,mul,boundsOf}from'../integration/contours';
import{validatePattern}from'./plan';
import{candidateIssues,collisionScene}from'./collision';
export function validateWeaponLayout(b:ShipBlueprint){
 const w=b.weaponLayout;if(!w)return{issues:[],checks:[]};const issues:string[]=[],surfaces=armorSurfaces(b),scene=collisionScene(b);
 if(b.generatorVersion!=='1.8.3'||w.status!=='one-ship-review'||b.seed!==7||b.order.length!==300||b.shipyardId!=='aegis'||b.role!=='Cruiser'||b.macroDesign?.family!=='WEDGE_CITADEL'||b.architecture.grammar!=='MONOLITHIC')issues.push('Invalid weapon review scope');
 if(new Set(w.mounts.map(m=>m.id)).size!==w.mounts.length||w.mounts.length!==b.hardpoints.length||w.mounts.length>w.budget.countLimit)issues.push('Invalid mount IDs/count');
 if(JSON.stringify([...w.retiredHardpointIds].sort())!==JSON.stringify(b.structuralArmorPilot!.mounts.map(m=>m.hardpointId).sort())||JSON.stringify(w.supersededFoundationIds)!==JSON.stringify(w.retiredHardpointIds))issues.push('Invalid retired baseline mount contract');
 if(new Set(w.groups.map(g=>g.id)).size!==w.groups.length)issues.push('Duplicate layout group IDs');
 const active=w.mounts.map(m=>({mount:m,assembly:b.prefabPlacements!.find(p=>p.id===m.equipment.prefabId)?.assembly}));
 let cost=0;const counts={TOP:0,BOTTOM:0,PORT:0,STARBOARD:0};
 for(const group of w.groups){
  try{validatePattern(group,new Set([...(b.prefabPlacements??[]).map(p=>p.id),...b.engines.map(e=>e.id),...b.structuralArmorPilot!.channels.map(c=>c.id),...(b.structuralArmorPilot!.ventral?.recesses??[]).map(c=>c.id)]));}catch(e){issues.push((e as Error).message);}
  const mounts=w.mounts.filter(m=>m.groupId===group.id);
  if(mounts.length&&mounts.length!==group.members.length)issues.push(`Partial group ${group.id}`);
  if(!mounts.length&&!w.omissions.some(o=>o.groupId===group.id))issues.push(`Unreported missing group ${group.id}`);
  if(group.symmetry==='BILATERAL')for(const m of mounts){
   const pair=mounts.find(d=>d.id!==m.id&&d.standard.size===m.standard.size&&d.category===m.category&&Math.abs(d.position.z-m.position.z)<.01&&Math.abs(d.position.x+m.position.x)<.01&&Math.abs(d.position.y-m.position.y)<.02);
   if(!pair||Math.abs(pair.frame.normal.x+m.frame.normal.x)>.001||Math.abs(pair.frame.normal.y-m.frame.normal.y)>.001||Math.abs(pair.frame.normal.z-m.frame.normal.z)>.001)issues.push(`Asymmetric group ${group.id}`);
  }
 }
 for(const{mount:m,assembly:a}of active){
  if(!a){issues.push(`Missing weapon assembly ${m.id}`);continue;}
  cost+=m.standard.cost;counts[m.region]++;
  if(JSON.stringify(m.standard)!==JSON.stringify(mountStandard(m.standard.size,b.order.length))||m.standard.mode!=='SURFACE')issues.push(`Invalid standard ${m.id}`);
  const h=b.hardpoints.find(h=>h.id===m.id);
  if(!h||h.plannedMountId!==m.id||h.size!==m.standard.size||!h.allowedCategories.includes(m.category)||JSON.stringify(h.position)!==JSON.stringify(m.position)||JSON.stringify(h.normal)!==JSON.stringify(m.frame.normal)||h.radius!==m.footprint.width/2||m.category==='SPINAL')issues.push(`Mount authority mismatch ${m.id}`);
  const axes=[m.frame.right,m.frame.normal,m.frame.forward];
  if(axes.some(v=>Object.values(v).some(x=>!Number.isFinite(x))||Math.abs(Math.hypot(v.x,v.y,v.z)-1)>1e-6)||Math.abs(dot(axes[0],axes[1]))>1e-6||Math.abs(dot(axes[0],axes[2]))>1e-6||Math.abs(dot(axes[1],axes[2]))>1e-6||dot(cross(m.frame.right,m.frame.normal),m.frame.forward)>-.99999||dot(m.frame.normal,REGION_NORMAL[m.region])<.65)issues.push(`Invalid local mount frame ${m.id}`);
  if(m.contacts.length!==17||m.contacts.some(c=>dot(c.normal,m.frame.normal)<.85||!surfaces.some(s=>s.id===c.surfaceId&&s.structureId===c.structureId&&s.triangles.some(t=>dot(t.n,c.normal)>.99999&&Math.abs(dot(t.n,sub(c.position,t.vertices[0])))<.001&&inPolygon(t.vertices,c.position,t.n,1e-5)))))issues.push(`Detached foundation contacts ${m.id}`);
  if(m.foundation.solid.vertices.slice(-8).some(p=>Math.abs(localPoint(m.position,m.frame,p).y)>.001))issues.push(`Foundation cap plane ${m.id}`);
  if(m.foundation.solid.vertices.slice(0,8).some((p,i)=>{const c=m.contacts[i];return!c||Math.abs(dot(sub(c.position,p),m.frame.normal)-m.foundation.inset)>.00001;}))issues.push(`Foundation root embed ${m.id}`);
  if(m.footprint.width!==m.standard.footprint.width||m.footprint.length!==m.standard.footprint.length)issues.push(`Shrunk mount footprint ${m.id}`);
  if(m.foundation.height<m.standard.foundationHeight-1e-6||m.foundation.height>m.standard.foundationHeight+2.51)issues.push(`Invalid foundation support depth ${m.id}`);
  const local=m.equipment.localBounds,span={width:local.max.x-local.min.x,height:local.max.y-local.min.y,length:local.max.z-local.min.z};
  for(const k of['width','height','length']as const)if(span[k]>m.standard.envelope[k]+.01)issues.push(`Equipment exceeds standard envelope ${m.id}/${k}`);
  const kit=b.prefabPlacements!.find(p=>p.id===m.equipment.prefabId)!;
  if(!w.prefabIds.includes(kit.id)||kit.socket.hostId!==h?.parentId||JSON.stringify(kit.socket.position)!==JSON.stringify(m.position)||JSON.stringify(kit.socket.normal)!==JSON.stringify(m.frame.normal))issues.push(`Weapon socket authority ${m.id}`);
  for(const sample of m.firingArc.samples){const yaw=sample.yaw*Math.PI/180,pitch=sample.pitch*Math.PI/180,expected=worldDirection(m.frame,{x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)});
   if(sample.yaw<m.firingArc.yawMin||sample.yaw>m.firingArc.yawMax||sample.pitch<m.firingArc.pitchMin||sample.pitch>m.firingArc.pitchMax||(['x','y','z']as const).some(k=>!Number.isFinite(sample.direction[k])||Math.abs(sample.direction[k]-expected[k])>1e-6)||!m.firingArc.muzzles.some(p=>JSON.stringify(p)===JSON.stringify(sample.origin)))issues.push(`Firing sample outside local arc ${m.id}`);
  }
  if(JSON.stringify(m.firingArc.clearanceBounds)!==JSON.stringify(boundsOf(m.firingArc.samples.flatMap(s=>[s.origin,add(s.origin,mul(s.direction,m.firingArc.rangeMeters))]))))issues.push(`Firing clearance bounds ${m.id}`);
  if(m.firingArc.coordinateSystem!=='LOCAL_MOUNT'||!m.firingArc.samples.length||m.firingArc.samples.some(s=>!s.clear))issues.push(`Invalid static firing arc ${m.id}`);
  for(const p of a.parts){
   const tris=solidTriangles(p.solid),edges=new Map<string,number>();let volume=0;
   for(const[t,u,v]of tris){if([t,u,v].some(p=>Object.values(p).some(n=>!Number.isFinite(n)))||area([t,u,v])<1e-7)issues.push(`Invalid weapon geometry ${p.id}`);volume+=dot(t,cross(u,v))/6;}
   for(let i=0;i<p.solid.indices.length;i+=3)for(let j=0;j<3;j++){const u=p.solid.indices[i+j],v=p.solid.indices[i+(j+1)%3],k=[Math.min(u,v),Math.max(u,v)].join('/');edges.set(k,(edges.get(k)??0)+1);}
   if(volume<=0||[...edges.values()].some(n=>n!==2))issues.push(`Open/inverted weapon solid ${p.id}`);
   if(JSON.stringify(boundsOf(p.solid.vertices))!==JSON.stringify(p.bounds))issues.push(`Weapon bounds mismatch ${p.id}`);
  }
  const foundationPart=a.parts.find(p=>p.role==='SURFACE_FOUNDATION');if(!foundationPart||JSON.stringify(foundationPart.solid)!==JSON.stringify(m.foundation.solid))issues.push(`Foundation authority mismatch ${m.id}`);
  const equipmentVertices=a.parts.filter(p=>p.role!=='SURFACE_FOUNDATION').flatMap(p=>p.solid.vertices);
  if(JSON.stringify(boundsOf(equipmentVertices))!==JSON.stringify(m.equipment.bounds)||JSON.stringify(boundsOf(equipmentVertices.map(p=>localPoint(m.position,m.frame,p))))!==JSON.stringify(m.equipment.localBounds))issues.push(`Equipment bounds cache ${m.id}`);
  issues.push(...candidateIssues(b,m,a,active.filter(o=>o.mount.id!==m.id&&o.assembly).map(o=>({mount:o.mount,assembly:o.assembly!})),scene));
 }
 if(cost!==w.budget.allocated||cost>w.budget.available||JSON.stringify(counts)!==JSON.stringify(w.budget.byRegion))issues.push('Invalid weapon budget distribution');
 if(JSON.stringify(b.functionalExterior?.overallBounds)!==JSON.stringify(w.overallBounds)||active.some(o=>o.assembly?.parts.some(p=>(['x','y','z']as const).some(k=>p.bounds.min[k]<w.overallBounds.min[k]-.001||p.bounds.max[k]>w.overallBounds.max[k]+.001))))issues.push('Weapon overall bounds do not include installations');
 if(w.prefabIds.length!==w.mounts.length||new Set(w.prefabIds).size!==w.mounts.length)issues.push('Invalid weapon prefab references');
 return{issues:[...new Set(issues)],checks:['Shared physical standards and independent categories','Actual final armor triangles, 17 footprint contacts and local normal frame','Atomic bilateral/centerline groups; explicit rejected candidates','Oriented equipment envelopes and reciprocal solid probes','Protected exhaust/thermal openings and sampled static local firing arcs','Approved source armor retained; inactive legacy foundations preserved as archive']};
}
