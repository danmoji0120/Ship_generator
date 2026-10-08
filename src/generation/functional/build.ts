import type {ShipBlueprint,Vec3,PrefabPlacement} from '../../blueprint/types';
import type {ParametricPrefabAssembly,FunctionalExteriorReview} from './types';
import type {PanelSolid} from '../armor/types';
import {facetedBox,annularHousing,finishingRibbon} from './geometry';
import {boundsOf,add,mul,mix} from '../integration/contours';
import {solidFromRings,area,normal} from '../armor/panels';
import {surfaceHit} from '../armor/structural-pilot/intersection';
import {validateFunctionalExterior} from './validate';

/** One approved saved Wedge only. Never invoked implicitly by generation or JSON rendering. */
export function buildFunctionalExteriorReview(source:ShipBlueprint):ShipBlueprint {
  if(source.seed!==7||source.shipyardId!=='aegis'||source.role!=='Cruiser'||source.order.length!==300||source.architecture.grammar!=='MONOLITHIC'||source.macroDesign?.family!=='WEDGE_CITADEL'||source.structuralArmorPilot?.revision!=='ventral-flow-review'||source.functionalExterior)
    throw Error('Functional exterior review is restricted to the approved WEDGE_CITADEL / Seed 7 export.');
  const b=structuredClone(source),pilot=b.structuralArmorPilot!,hull=b.structuralVolumes[0],newPrefabs:PrefabPlacement[]=[],armorFinish:FunctionalExteriorReview['armorFinish']=[],serviceRegions:FunctionalExteriorReview['serviceRegions']=[];
  const armor=(id:string)=>pilot.components.find(c=>c.id===id)!;
  const part=(assembly:ParametricPrefabAssembly,id:string,role:string,material:ParametricPrefabAssembly['parts'][number]['material'],solid:PanelSolid)=>assembly.parts.push({id,role,material,solid,bounds:boundsOf(solid.vertices)});
  function kit(id:string,kind:PrefabPlacement['kind'],functionality:PrefabPlacement['functionality'],position:Vec3,n:Vec3):ParametricPrefabAssembly {
    const assembly:ParametricPrefabAssembly={parts:[],attachments:[],equipmentIds:[],clearances:[]};
    newPrefabs.push({id,kind,functionality,socket:{kind:'HULL_FACE',hostId:hull.id,position,normal:n},dimensions:{x:1,y:1,z:1},variant:0,assembly});return assembly;
  }
  // Long, quiet armor lands. Do not introduce a lattice of small panels or edit any source mass.
  for(const c of pilot.components.filter(c=>['AXIAL_PROTECTION','CITADEL','SHOULDER','REAR_HOUSING','VENTRAL_KEEL','BELLY_CITADEL','LOWER_HOUSING','VENTRAL_TRANSITION','SIDE_BELT'].includes(c.role))){
    const lower=pilot.ventral!.componentIds.includes(c.id),side=c.role==='SIDE_BELT',target=side?{x:Math.sign(c.bounds.min.x+c.bounds.max.x),y:0,z:0}:{x:0,y:lower?-1:1,z:0};
    let face=lower?1:3;
    if(side){let best=-Infinity;for(let i=0;i<c.rings[0].length;i++){const n=normal([c.rings[0][i],c.rings[0][(i+1)%6],c.rings[1][i]]),score=n.x*target.x;if(score>best){best=score;face=i;}}}
    const thickness=lower?.28:side?.34:.28,{solid,contacts}=finishingRibbon(c,face,thickness),p=contacts[Math.floor(contacts.length/2)];
    const id=`finish-${c.id}`,a=kit(id,'ARMOR_ENVELOPE','protection',p.position,p.normal);
    a.attachments=contacts.map(contact=>({kind:'ARMOR',parentId:c.id,...contact}));part(a,id+'-land','BROAD_ARMOR_LAND','armor',solid);
    // Contact area is the actual parent face band, not bounding-box surface area.
    let contactAreaM2=0;for(let j=0;j<c.rings.length-1;j++){const r=c.rings[j],s=c.rings[j+1],k=(face+1)%r.length;contactAreaM2+=area([r[face],r[k],s[face]])+area([r[k],s[k],s[face]]);}
    armorFinish.push({prefabId:id,parentArmorId:c.id,direction:side?(target.x<0?'PORT':'STARBOARD'):lower?'BOTTOM':'TOP',thickness,contactAreaM2});
  }
  // Existing surface mounts and their eight-point foundations remain the attachment authority.
  // Low armored installations replace marker visuals; no weapon simulation or turret aiming.
  for(const h of b.hardpoints){
    const foundation=pilot.mounts.find(m=>m.hardpointId===h.id)!,r=h.radius,n=h.normal;
    const sensor=h.type==='Sensor',utility=h.type==='Utility',missile=h.type==='Missile';
    const id=`installation-${h.id}`,a=kit(id,sensor?'SENSOR_HOUSING':utility?'MACHINERY_HOUSING':missile?'MISSILE_BAY_HOUSING':'WEAPON_FOUNDATION',sensor?'sensor':utility?'machinery':'weapon',h.position,n);
    a.equipmentIds=[h.id];a.attachments=[{kind:'FOUNDATION',parentId:h.id,position:h.position,normal:n}];
    const height=h.type==='Large Turret'?r*2.65:h.type==='Medium Turret'?r*1.45:sensor?r*.85:missile?r*.55:r*.65;
    const housingWidth=r*(h.type==='Large Turret'?2.8:2.02);
    const yaw=sensor||utility||missile?0:-Math.sign(h.position.x)*Math.PI/2;
    part(a,id+'-seat','ARMORED_MOUNT_COLLAR','secondary',annularHousing(add(h.position,mul(n,r*.10)),n,r*1.14,r*.54,r*.24,8));
    part(a,id+'-body',sensor?'SENSOR_CASING':missile?'VLS_HOUSING':utility?'UTILITY_CASING':'ARMORED_WEAPON_HOUSING','armor',facetedBox({...h.position,y:h.position.y+height/2-.12},{x:housingWidth,y:height,z:housingWidth},yaw));
    if(missile){
      for(const x of[-1,1])for(const z of[-1,1])part(a,`${id}-lid-${x}-${z}`,'PROTECTED_LAUNCH_HATCH','mount',facetedBox({x:h.position.x+x*r*.42,y:h.position.y+height+.04,z:h.position.z+z*r*.42},{x:r*.66,y:.14,z:r*.68}));
    }else if(sensor){
      part(a,id+'-optic','SENSOR_APERTURE','engine',facetedBox({x:h.position.x,y:h.position.y+height*.55,z:h.position.z-r*.91},{x:r*1.1,y:height*.42,z:.20}));
      part(a,id+'-window','SENSOR_GLAZING','glow',facetedBox({x:h.position.x,y:h.position.y+height*.55,z:h.position.z-r*.98},{x:r*.64,y:height*.19,z:.08}));
    }else if(utility){
      part(a,id+'-service','SERVICE_ACCESS','mount',facetedBox({...h.position,y:h.position.y+height},{x:r*1.12,y:.18,z:r*1.3}));
    }else{
      const out={x:Math.sign(h.position.x),y:0,z:0},portY=h.position.y+height*.69;
      const large=h.type==='Large Turret',portLength=r*(large?2:.4);
      for(const side of[-1,1]){
        const p={x:h.position.x+out.x*r*(large?2:1.05),y:portY,z:h.position.z+side*r*.4};
        part(a,`${id}-port-${side}`,large?'PROTECTED_WEAPON_SHROUD':'WEAPON_APERTURE',large?'secondary':'engine',annularHousing(p,out,r*.27,r*.16,portLength,8));
        a.clearances.push({id:`clear-${h.id}-${side}`,parentId:h.parentId,equipmentId:h.id,kind:'weapon',position:add(p,mul(out,portLength/2+r*.04)),normal:out,radius:r*.18,depth:r*8,rootClearance:0});
      }
    }
    // The stored foundation is preserved, including its actual physical height and seat position.
    if(!foundation.parentArmorIds.length)throw Error(`Missing approved foundation ${h.id}`);
  }
  // Integrated command glazing on the existing plinth. Its underside follows actual roof triangles.
  const command=armor('command-plinth'),base={x:0,y:surfaceHit([command],0,81)!.y,z:81},bridge=kit('command-suite','SENSOR_HOUSING','sensor',base,{x:0,y:1,z:0});
  // Broad, clipped front facet seats the glazing across its full width, unlike a pointed octagon.
  const footprint=[[5.4,72],[-5.4,72],[-7.2,73.8],[-7.2,88.2],[-5.4,90],[5.4,90],[7.2,88.2],[7.2,73.8]].map(([x,z])=>({x,z}));
  const root=footprint.map(p=>({...p,y:surfaceHit([command],p.x,p.z)!.y-.15}));
  const cap=root.map(p=>({x:p.x*.84,y:p.y+3.8,z:81+(p.z-81)*.86}));
  part(bridge,'command-casing','COMMAND_SENSOR_HOUSING','armor',solidFromRings([root,cap]));
  bridge.attachments=root.map(p=>({kind:'ARMOR',parentId:command.id,position:{...p,y:p.y+.15},normal:{x:0,y:1,z:0}}));
  const frontY=surfaceHit([command],0,73)!.y+2.6;
  part(bridge,'command-window-frame','PROTECTED_COMMAND_APERTURE','engine',facetedBox({x:0,y:frontY,z:73.25},{x:9.4,y:1.1,z:.65}));
  part(bridge,'command-window','COMMAND_GLAZING','glow',facetedBox({x:0,y:frontY,z:72.93},{x:8.4,y:.48,z:.12}));
  // Actual nozzle remains unchanged; open annular casing and connected mechanical braces surround it.
  const e=b.engines[0],drive=kit('drive-protection','ENGINE_HOUSING','propulsion',{x:0,y:0,z:144},{x:0,y:0,z:1});drive.equipmentIds=[e.id];
  part(drive,'drive-armored-casing','OPEN_ENGINE_CASING','secondary',annularHousing({x:0,y:0,z:148},{x:0,y:0,z:1},20.5,e.nozzleRadius*e.bellRatio*1.13,14,12));
  part(drive,'drive-rear-collar','NOZZLE_PROTECTION_COLLAR','armor',annularHousing({x:0,y:0,z:155},{x:0,y:0,z:1},21,e.nozzleRadius*e.bellRatio*1.13,1.4,12));
  drive.attachments=[{kind:'HULL',parentId:hull.id,position:{x:0,y:18,z:142},normal:{x:0,y:0,z:1}}];
  for(const side of[-1,1]){
    const rings=[{x:side*13,y:30,z:135},{x:side*10,y:18,z:146},{x:side*10,y:17,z:150}].map(p=>[{x:p.x-2,y:p.y-2,z:p.z},{x:p.x+2,y:p.y-2,z:p.z},{x:p.x+2,y:p.y+2,z:p.z},{x:p.x-2,y:p.y+2,z:p.z}]);
    part(drive,`drive-support-${side}`,'CONNECTED_ENGINE_SUPPORT','engine',solidFromRings(rings));
    drive.attachments.push({kind:'ARMOR',parentId:`stern-housing-${side}`,position:{x:side*13,y:30,z:135},normal:{x:0,y:0,z:1}});
  }
  // Selective equipment islands occupy less than one third of each deep maintenance channel.
  for(const ch of pilot.channels){
    const ids:string[]=[];
    for(const z of[-23,-4]){
      const i=z< -30?0:z<0?1:2,a=ch.floor[i],d=ch.floor[i+1],t=(z-a.z)/(d.z-a.z),p=mix(a,d,t),id=`service-${ch.id}-${z}`,m=kit(id,'MACHINERY_HOUSING','machinery',p,{x:0,y:1,z:0});ids.push(id);
      m.attachments=[{kind:'HULL',parentId:hull.id,position:p,normal:{x:0,y:1,z:0}}];
      part(m,id+'-chassis','MAINTENANCE_BED','engine',facetedBox({...p,y:p.y+.3},{x:6,y:.8,z:10}));
      for(const side of[-1,1]){
        const pump={x:p.x+side*1.65,y:p.y+2,z:p.z};
        part(m,id+'-pump-'+side,'EXPOSED_SERVICE_PUMP','secondary',annularHousing(pump,{x:0,y:0,z:1},1.2,.7,8,8));
        for(const end of[-1,1])part(m,`${id}-pump-collar-${side}-${end}`,'MACHINERY_SUPPORT_COLLAR','mount',annularHousing({...pump,z:p.z+end*3}, {x:0,y:0,z:1},1.4,1,.65,8));
      }
      part(m,id+'-cover','PARTIAL_MAINTENANCE_COVER','armor',facetedBox({...p,y:p.y+3.65,z:p.z+3},{x:5.2,y:.7,z:3.2}));
      for(const side of[-1,1])part(m,id+'-conduit-'+side,'SERVICE_CONDUIT','mount',facetedBox({x:p.x+side*3.8,y:p.y+.7,z:p.z},{x:.7,y:1.2,z:12}));
    }
    serviceRegions.push({id:ch.id,purpose:'MAINTENANCE',prefabIds:ids,occupiedFraction:2*8.3*12/(ch.width*50),remainingDepth:ch.depth-4.5});
  }
  const recess=pilot.ventral!.recesses[0],floor=recess.floor[1],belly=kit('belly-service-equipment','MACHINERY_HOUSING','machinery',floor,{x:0,y:-1,z:0});
  belly.attachments=[{kind:'HULL',parentId:hull.id,position:floor,normal:{x:0,y:-1,z:0}}];
  part(belly,'belly-machinery','VENTRAL_MACHINERY_BED','engine',facetedBox({...floor,y:floor.y-.3},{x:9,y:.8,z:17}));
  for(const side of[-1,1])part(belly,'belly-pump-'+side,'VENTRAL_SERVICE_PUMP','secondary',annularHousing({...floor,x:floor.x+side*2.3,y:floor.y-2},{x:0,y:0,z:1},1.5,.8,13,8));
  part(belly,'belly-maintenance-door','VENTRAL_PARTIAL_ACCESS_COVER','armor',facetedBox({...floor,y:floor.y-3.95,z:floor.z+5},{x:7,y:.7,z:4}));
  serviceRegions.push({id:recess.id,purpose:'MAINTENANCE',prefabIds:['belly-service-equipment'],occupiedFraction:9*17/(recess.width*recess.length),remainingDepth:recess.mouthDepth-4.5});
  for(const p of newPrefabs){const q=boundsOf(p.assembly!.parts.flatMap(p=>p.solid.vertices));p.dimensions={x:q.max.x-q.min.x,y:q.max.y-q.min.y,z:q.max.z-q.min.z};}
  b.prefabPlacements!.push(...newPrefabs);
  b.functionalExterior={status:'one-ship-review',source:{seed:source.seed,generatorVersion:source.generatorVersion,structuralGeometryPreserved:true},finishPalette:{hull:'#667d8c',armor:'#98aebc',secondary:'#3b5469',mount:'#263c4a',engine:'#132735',glow:'#6bcbdd'},prefabIds:newPrefabs.map(p=>p.id),replacedHardpointVisuals:b.hardpoints.map(h=>h.id),armorFinish,serviceRegions,overallBounds:boundsOf([pilot.overallBounds.min,pilot.overallBounds.max,...newPrefabs.flatMap(p=>p.assembly!.parts.flatMap(p=>p.solid.vertices))]),validation:{issues:[],checks:[]}};
  b.functionalExterior.validation=validateFunctionalExterior(b);
  if(b.functionalExterior.validation.issues.length)throw Error(b.functionalExterior.validation.issues.join('; '));
  return b;
}
