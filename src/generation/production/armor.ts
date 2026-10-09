import type{ShipBlueprint,StructuralVolume,Vec3}from'../../blueprint/types';
import type{StructuralArmorComponent}from'../armor/structural-pilot/types';
import{armorBodyBuilder,addBodyBelt}from'../armor/structural-pilot/geometry';
import{profileRing}from'../hull';
import{boundsOf,sectionRing,add,mul,mix,dot,center,sub}from'../integration/contours';
import{containsProductionVolume as containsVolume}from'./surface-contact';
import{inReservedZone}from'../integration/reservations';
import{area,normal,panelSolid,scalePolygon,solidTriangles,inPolygon}from'../armor/panels';
import{finishingRibbon}from'../functional/geometry';
import{classifyNormal,extractArmorSurfaces}from'../armor/surfaces';
import{reservationBounds,reservationSamples,overlappingBounds}from'../armor/geometry';
import{geometrySamples,solidContains}from'../weapons/collision';
import{getShipyard}from'../../shipyards/config';
import{SeededRng}from'../../random/rng';
import{inArmor}from'../armor/geometry';
import type{ProductionDesign,CoverageDirection}from'./types';
const directions:CoverageDirection[]=['top','bottom','left','right','fore','aft'];
export function generateStructuralArmor(b:ShipBlueprint,d:ProductionDesign,candidate:number){
 const yard=getShipyard(b.shipyardId),rng=new SeededRng(b.seed^0x184a7^candidate*7919),family=d.family,l=b.order.length;
 const closed=b.structuralVolumes.filter(v=>v.type!=='SPINE'&&v.dimensions.x>l*.025).sort((a,c)=>c.dimensions.x*c.dimensions.y*c.dimensions.z-a.dimensions.x*a.dimensions.y*a.dimensions.z);
 const thickness=(.75+b.order.priorities.survivability/160)*yard.armor;
 for(const hull of closed){
  const zmin=hull.position.z+hull.geometry.stations[0].z,len=hull.geometry.stations.at(-1)!.z-hull.geometry.stations[0].z;
  const fraction=(f:number)=>zmin+len*f,small=hull.dimensions.x<l*.12;
  const layoutVariant=rng.int(0,2);
  const crest=(layoutVariant===1?.86:layoutVariant===2?1.10:1)*(family==='WIDE_CARRIER'?.7:family==='SPLIT_FRAME'?.75:1)*Math.min(hull.dimensions.y*.28,hull.dimensions.x*.18)*thickness*(.9+rng.next()*.18),parts:StructuralArmorComponent[]=[];
  const builder=armorBodyBuilder(hull,parts,l,true),familyFore=family==='HAMMERHEAD',familyRear=family==='ENGINE_DOMINANT';
  const start=familyFore?.09:familyRear?.48:family==='WIDE_CARRIER'?.16:family==='WEAPON_DOMINANT'?.35:family==='SPLIT_FRAME'?.28:[.20,.13,.33][layoutVariant],end=familyFore?.48:familyRear?.91:family==='WIDE_CARRIER'?.84:family==='WEAPON_DOMINANT'?.87:family==='SPLIT_FRAME'?.68:[.72,.56,.78][layoutVariant];
  d.decisions.push({stage:'armor-plan',sourceId:hull.id,status:'accepted',reason:`${family} / ${['CONTINUOUS_CITADEL','FORE_FORTRESS','AFT_COMMAND'][layoutVariant]}: normalized protection interval ${start.toFixed(2)}–${end.toFixed(2)}, actual station width and rooted tiers`});
  function deck(id:string,role:StructuralArmorComponent['role'],a:number,c:number,inner:number,outer:number,rise:number,side=0,parent?:string){
   const count=parts.length;try{builder.deck(`${hull.id}/${id}`,role,fraction(a),fraction(c),inner,outer,rise,side,parent,{bevel:yard.structure==='heavy'?.23:yard.structure==='clean'?.14:.18,rise:[[0,.4],[.20,1],[.72,.9],[1,.42]]});}catch(e){parts.splice(count);d.decisions.push({stage:'armor',sourceId:`${hull.id}/${id}`,status:'omitted',reason:(e as Error).message});}
  }
  deck('primary','CITADEL',start,end,0,small?.52:[.30,.38,.26][layoutVariant],crest);
  if(!small&&hull.dimensions.x>hull.dimensions.y*1.5){
   for(const side of[-1,1])deck('shoulder-'+side,'SHOULDER',Math.max(.08,start-.07),Math.min(.93,end+.08),.44,.88,crest*.67,side);
  }
  deck('fore-guard','AXIAL_PROTECTION',.04,Math.max(.20,start+.09),0,small?.55:.25,crest*.42);
  if(hull===closed[0]&&hull.purpose!=='propulsion')deck('command-plinth','COMMAND_PLINTH',familyFore?.67:[.73,.66,.80][layoutVariant],[.88,.86,.94][layoutVariant],0,small?.30:.19,crest*1.2);
  for(const side of[-1,1])try{addBodyBelt(hull,parts,`${hull.id}/belt-${side}`,side,fraction(.12),fraction(.88),l,true);}catch(e){d.decisions.push({stage:'belt',sourceId:hull.id,status:'omitted',reason:(e as Error).message});}
  // Independently designed compact ventral keel and protective belly casemates.
  const reflected:StructuralVolume={...hull,position:{...hull.position,y:-hull.position.y},geometry:{...hull.geometry,stations:hull.geometry.stations.map(s=>({...s,sectionRing:profileRing(s).map(([x,y])=>[x,-y]as[number,number]).reverse()}))}},lower:StructuralArmorComponent[]=[];
  const vb=armorBodyBuilder(reflected,lower,l,true);
  for(const [id,role,a,c,inner,outer,rise,side]of[
   ['keel','VENTRAL_KEEL',.07,.93,0,small?.28:.13,crest*.95,0],
   ['belly-port','BELLY_CITADEL',.29,.75,.22,.68,crest*.54,-1],
   ['belly-starboard','BELLY_CITADEL',.29,.75,.22,.68,crest*.54,1],
   ['rear-cradle','LOWER_HOUSING',.72,.94,0,.43,crest*.73,0],
  ]as const){try{vb.deck(`${hull.id}/${id}`,role,fraction(a),fraction(c),inner,outer,rise,side,undefined,{bevel:.2,rise:[[0,.30],[.25,1],[.78,.85],[1,.35]]});}catch(e){d.decisions.push({stage:'ventral',sourceId:`${hull.id}/${id}`,status:'omitted',reason:(e as Error).message});}}
  for(const c of lower){const reflect=(p:Vec3)=>({...p,y:-p.y});c.rings=c.rings.map(r=>r.map(reflect).reverse());c.solid.vertices=c.solid.vertices.map(reflect);for(let i=0;i<c.solid.indices.length;i+=3)[c.solid.indices[i+1],c.solid.indices[i+2]]=[c.solid.indices[i+2],c.solid.indices[i+1]];c.contactSamples=c.contactSamples.map(reflect);c.bounds=boundsOf(c.solid.vertices);parts.push(c);}
  for(const c of parts){
   const samples=geometrySamples(c.solid),conflict=d.zones.find(z=>overlappingBounds(c.bounds,reservationBounds(z))&&(samples.some(p=>inReservedZone(p,z))||reservationSamples(z).some(p=>solidContains(c.solid,p))))
    ?? b.structuralVolumes.find(v=>v.id!==hull.id&&overlappingBounds(c.bounds,boundsOf(v.geometry.stations.flatMap(s=>profileRing(s).map(([x,y])=>({x:x+v.position.x,y:y+v.position.y,z:s.z+v.position.z})))))&&samples.some(p=>containsVolume(v,p,-l*.0002)));
   const filledVoid=b.macroDesign!.negativeSpaceTargets.find(t=>[-.35,0,.35].some(x=>[-.35,0,.35].some(y=>[-.35,0,.35].some(z=>{const p={x:t.center.x+t.size.x*x,y:t.center.y+t.size.y*y,z:t.center.z+t.size.z*z};return !b.structuralVolumes.some(v=>containsVolume(v,p,0))&&p.x>=c.bounds.min.x&&p.x<=c.bounds.max.x&&p.y>=c.bounds.min.y&&p.y<=c.bounds.max.y&&p.z>=c.bounds.min.z&&p.z<=c.bounds.max.z&&solidContains(c.solid,p);}))));
   if(filledVoid){d.decisions.push({stage:'armor',sourceId:c.id,status:'omitted',reason:`Protected real negative-space sample ${filledVoid.id}`});continue;}
   const badRoot=c.contactSamples.some(p=>!containsVolume(hull,p,l*.0001));
   if(conflict||badRoot){d.decisions.push({stage:'armor',sourceId:c.id,status:'omitted',reason:conflict?`Preserved opening / adjacent structure ${conflict.id}`:'Actual station root contact failed'});continue;}
   d.armor.push(c);d.decisions.push({stage:'armor',sourceId:c.id,status:'accepted',reason:`${family}: actual ${hull.purpose} station width / contact; independent tier`});
  }
  const primary=d.armor.find(c=>c.id===hull.id+'/primary');
  if(primary&&!small)for(const side of[-1,1]){
   const shoulder=d.armor.find(c=>c.id===`${hull.id}/shoulder-${side}`);if(!shoulder)continue;
   const zs=[fraction(start+.08),fraction((start+end)/2),fraction(end-.08)],floor=zs.map(z=>{const ring=sectionRing(hull,z),w=(Math.max(...ring.map(p=>p.x))-Math.min(...ring.map(p=>p.x)))/2;return {x:hull.position.x+side*w*([.30,.38,.26][layoutVariant]+.44)/2,y:builder.deckY(hull.position.x+side*w*([.30,.38,.26][layoutVariant]+.44)/2,z),z};});
   d.channels.push({id:`${hull.id}/service-${side}`,parentStructureId:hull.id,floor,leftBankId:primary.id,rightBankId:shoulder.id,width:hull.dimensions.x*(.44-[.30,.38,.26][layoutVariant])*.48,depth:crest*.6});
  }
 }
 if(!d.armor.length)throw Error('No attached primary or ventral armor masses');
}
/** Coverage uses the actual exposed station triangles and clipped functional openings. Large
 * face patches only where the structural armor has not already protected the source surface. */
export function finishArmorCoverage(b:ShipBlueprint,d:ProductionDesign){
 const {surfaces}=extractArmorSurfaces(b),yard=getShipyard(b.shipyardId),l=b.order.length;
 d.coverage={method:'actual-triangle-area / exposed contact samples',directions:Object.fromEntries(directions.map(k=>[k,{exposedM2:0,eligibleM2:0,coveredM2:0,excludedM2:0,ratio:0}]))as ProductionDesign['coverage']['directions'],excluded:[]};
 const thickness=l*(yard.structure==='heavy'?.0038:yard.structure==='clean'?.0015:.0023)*(0.8+b.order.priorities.survivability/180);
 const emit=(id:string,parent:string,solid:import('../armor/types').PanelSolid,root:Vec3[],n:Vec3)=>{
  const bounds=boundsOf(solid.vertices);
  if(d.zones.some(z=>overlappingBounds(bounds,reservationBounds(z))&&(geometrySamples(solid).some(p=>inReservedZone(p,z))||reservationSamples(z).some(p=>solidContains(solid,p))))){d.decisions.push({stage:'finish',sourceId:id,status:'omitted',reason:'Broad finishing skin intersects a protected opening; bounded local sections will be tried'});return false;}
  d.finish.push({id,parentStructureId:parent,solid,bounds,direction:classifyNormal(n),root,normal:n,thickness});return true;
 };
 for(const hull of b.structuralVolumes.filter(v=>v.type!=='SPINE')){
  const rings=hull.geometry.stations.map(s=>profileRing(s).reverse().map(([x,y])=>({x:x+hull.position.x,y:y+hull.position.y,z:s.z+hull.position.z})));
  // One long, surface-conforming course per actual facet. Break only at real protected
  // intervals or internal contacts, never subdivide a broad deck into a decorative tile grid.
  for(let face=0;face<8;face++){
   let run:Vec3[][]=[];let number=0;
   const flush=()=>{if(run.length<2){run=[];return;}const fake={rings:run}as StructuralArmorComponent,{solid,contacts}=finishingRibbon(fake,face,thickness,.008),n=contacts[Math.floor(contacts.length/2)].normal;
    if(!emit(`skin-${hull.id}-${face}-${number++}`,hull.id,solid,contacts.map(c=>c.position),n)){
     // A local functional opening must not discard the entire flank. Keep long station
     // sections on both sides, and use clipped actual surface polygons only at the opening.
     for(let j=0;j<run.length-1;j++){
      const pair=[run[j],run[j+1]],r=finishingRibbon({rings:pair}as StructuralArmorComponent,face,thickness,.008);
      if(emit(`skin-${hull.id}-${face}-${number++}`,hull.id,r.solid,r.contacts.map(c=>c.position),r.contacts[0].normal))continue;
      const a=pair[0],c=pair[1],triangles=[[a[face],a[(face+1)%8],c[(face+1)%8]],[a[face],c[(face+1)%8],c[face]]];
      for(const surface of surfaces.filter(s=>s.parentStructureId===hull.id&&!s.parentExteriorId))for(const patch of surface.patches){
       const q=center(patch.polygon);if(patch.exclusionReason||patch.areaM2<l*l*.000001||!triangles.some(t=>{const tn=normal(t);return Math.abs(dot(tn,sub(q,t[0])))<l*.00001&&inPolygon(t,q,tn,l*.000001);}))continue;
       emit(`opening-finish-${hull.id}-${face}-${number++}`,hull.id,panelSolid(scalePolygon(patch.polygon,.998),surface.normal,thickness,l*.0004,.10).solid,patch.polygon,surface.normal);
      }
     }
    }
    run=[];
   };
   for(let j=0;j<rings.length-1;j++){
    const a=rings[j],c=rings[j+1],poly=[a[face],a[(face+1)%8],c[(face+1)%8],c[face]],n=normal([poly[0],poly[1],poly[3]]),samples=[center(poly),...poly.map(p=>mix(p,center(poly),.05))];
    const hidden=samples.every(p=>b.structuralVolumes.some(v=>v.id!==hull.id&&containsVolume(v,add(p,mul(n,l*.0001)),-l*.00001)));
    const covered=samples.every(p=>d.armor.some(c=>p.x>=c.bounds.min.x&&p.x<=c.bounds.max.x&&p.z>=c.bounds.min.z&&p.z<=c.bounds.max.z&&solidContains(c.solid,add(p,mul(n,l*.0002)))));
    const reserved=samples.some(p=>d.zones.some(z=>inReservedZone(add(p,mul(n,thickness)),z)));
    if(hidden||covered){flush();continue;}
    if(!run.length)run.push(a);run.push(c);
   }
   flush();
  }
  for(const[station,n]of[[hull.geometry.stations[0],{x:0,y:0,z:-1}],[hull.geometry.stations.at(-1)!,{x:0,y:0,z:1}]]as const){
   let root=profileRing(station).map(([x,y])=>({x:x+hull.position.x,y:y+hull.position.y,z:station.z+hull.position.z}));if(n.z>0)root=root.reverse();
   const cap=panelSolid(scalePolygon(root,.996),n,thickness,l*.0004,.16);
   if(d.zones.some(z=>overlappingBounds(boundsOf(cap.solid.vertices),reservationBounds(z)))){
    // Functional cap openings use the existing exact surface-plane clipping, not a flat cover.
    for(const s of surfaces.filter(s=>s.parentStructureId===hull.id&&s.direction===(n.z<0?'fore':'aft')))for(const patch of s.patches.filter(p=>!p.exclusionReason&&Math.abs(p.polygon[0].z-root[0].z)<l*.00001)){
     if(patch.areaM2<area(root)*.002)continue;emit(`cap-${s.id}-${d.finish.length}`,hull.id,panelSolid(scalePolygon(patch.polygon,.999),s.normal,thickness,l*.0004,.10).solid,patch.polygon,s.normal);
    }
   }else emit(`cap-${hull.id}-${n.z}`,hull.id,cap.solid,root,n);
  }
 }
 d.coverage=measureProductionCoverage(b,d,surfaces);
 for(const[direction,m]of Object.entries(d.coverage.directions)){m.ratio=m.eligibleM2?Math.min(1,m.coveredM2/m.eligibleM2):1;if(m.ratio<.9)d.decisions.push({stage:'coverage',sourceId:direction,status:'omitted',reason:`Eligible protection coverage ${(100*m.ratio).toFixed(1)}%; residual exposed surface retained to avoid covering functional openings / adjacent structures`});}
}

/** Recomputed from stored solids for import/QA; no saved percentage is trusted. */
export function measureProductionCoverage(b:ShipBlueprint,d:ProductionDesign,surfaces=extractArmorSurfaces(b).surfaces){
 const yard=getShipyard(b.shipyardId),l=b.order.length,thickness=l*(yard.structure==='heavy'?.0038:yard.structure==='clean'?.0015:.0023)*(0.8+b.order.priorities.survivability/180);
 const coverage:ProductionDesign['coverage']={method:'actual-triangle-area / exposed contact samples',directions:Object.fromEntries(directions.map(k=>[k,{exposedM2:0,eligibleM2:0,coveredM2:0,excludedM2:0,ratio:0}]))as ProductionDesign['coverage']['directions'],excluded:[]};
 const within=(p:Vec3,c:{bounds:import('../../blueprint/types').BoundsData;solid:import('../armor/types').PanelSolid})=>p.x>=c.bounds.min.x&&p.x<=c.bounds.max.x&&p.y>=c.bounds.min.y&&p.y<=c.bounds.max.y&&p.z>=c.bounds.min.z&&p.z<=c.bounds.max.z&&solidContains(c.solid,p);
 for(const surface of surfaces)for(const patch of surface.patches){const m=coverage.directions[surface.direction];m.exposedM2+=patch.areaM2;
  const reason=patch.exclusionReason??(b.structuralVolumes.find(v=>v.id===surface.parentStructureId)?.type==='SPINE'?'Intentional exposed structural axis / frame':undefined);
  if(reason){m.excludedM2+=patch.areaM2;coverage.excluded.push({surfaceId:surface.id,areaM2:patch.areaM2,reason});continue;}m.eligibleM2+=patch.areaM2;
  const samples=[center(patch.polygon),...patch.polygon.map(p=>mix(p,center(patch.polygon),.08))];
  const covered=surface.parentExteriorId?1:samples.filter(p=>{const q=add(p,mul(surface.normal,Math.min(thickness*.4,l*.0004)));return [...d.armor,...d.finish].some(c=>within(q,c));}).length/samples.length;
  m.coveredM2+=patch.areaM2*covered;
 }
 for(const m of Object.values(coverage.directions))m.ratio=m.eligibleM2?Math.min(1,m.coveredM2/m.eligibleM2):1;return coverage;
}
