import type {Vec3} from '../../blueprint/types';
import type {DetailKitType} from './types';
import type {ParametricPrefabAssembly} from '../functional/types';
import type {MountFrame} from '../weapons/types';
import {DETAIL_KITS,STYLE} from './registry';
import {facetedBox,annularHousing} from '../functional/geometry';
import {transformSolid,worldPoint} from '../weapons/surfaces';
import {geometrySamples,provideGeometrySamples} from '../weapons/collision';
import type {PanelSolid} from '../armor/types';
const localGeometry=new Map<string,{solid:PanelSolid;samples?:Vec3[]}>();
function instanceSolid(key:string,build:()=>PanelSolid,position:Vec3,frame:MountFrame){
 let prototype=localGeometry.get(key);if(!prototype){prototype={solid:build()};if(localGeometry.size>=1024)localGeometry.delete(localGeometry.keys().next().value!);localGeometry.set(key,prototype);}const fixed=prototype,world=transformSolid(fixed.solid,position,frame);
 provideGeometrySamples(world,()=>{fixed.samples??=geometrySamples(fixed.solid);return fixed.samples.map(v=>worldPoint(position,frame,v));});return world;
}

import {add,sub,mul,dot,unit,boundsOf} from '../integration/contours';
import {cross,solidFromRings} from '../armor/panels';
import {shapeDefinition,shapeStations} from '../shapes/definition';
import {profileRing} from '../hull';
/** Stable right-handed X/Y/Z basis even on FORE/AFT; tangent preference is longitudinal unless parallel. */
export function detailFrame(normal:Vec3,tangent:Vec3={x:0,y:0,z:-1}):MountFrame{
 const n=unit(normal),project=(v:Vec3)=>sub(v,mul(n,dot(n,v)));let t=project(tangent);
 if(Math.hypot(t.x,t.y,t.z)<1e-6)t=project({x:0,y:1,z:0});
 if(Math.hypot(t.x,t.y,t.z)<1e-6)t=project({x:1,y:0,z:0});
 const forward=unit(t);return {normal:n,forward,right:unit(cross(forward,n))};
}
export function kitSize(kit:DetailKitType,yard:string):[number,number,number]{const r=DETAIL_KITS[kit],s=STYLE[yard as keyof typeof STYLE];return[r.size[0]*s.width,r.size[1]*s.height,r.size[2]];}
export function detailAssembly(id:string,kit:DetailKitType,yard:string,position:Vec3,frame:MountFrame,parameters?:{routeLength:number}):ParametricPrefabAssembly {
 const s=STYLE[yard as keyof typeof STYLE],[w,h,baseLength]=kitSize(kit,yard),l=parameters?.routeLength??baseLength,parts:ParametricPrefabAssembly['parts']=[];
 const box=(name:string,p:Vec3,size:Vec3,material:ParametricPrefabAssembly['parts'][number]['material']='secondary')=>{const def=shapeDefinition('CHAMFERED_BOX',size,s.bevel);def.chamfer=s.bevel;def.frontScale=yard==='vesper'?.66:yard==='forge'?.98:yard==='serein'?.90:.84;def.rearScale=yard==='forge'?1:.94;const stations=shapeStations(def);/* CHAMFERED_BOX stations have identical profiles: intermediate rings are exactly coplanar. Keep the same closed boundary with two end rings. */const solid=instanceSolid(JSON.stringify(['box',yard,p,size]),()=>solidFromRings([stations[0],stations[stations.length-1]].map(st=>profileRing(st).reverse().map(([x,y])=>({x:p.x+x,y:p.y+y,z:p.z+st.z})))),position,frame);parts.push({id:id+'-'+name,role:kit+'_'+name.toUpperCase(),material,solid,bounds:boundsOf(solid.vertices)});};
 const ring=(name:string,p:Vec3,outer:number,inner:number,length:number,material:ParametricPrefabAssembly['parts'][number]['material']='engine')=>{const solid=instanceSolid(JSON.stringify(['annulus',p,outer,inner,length]),()=>annularHousing(p,{x:0,y:1,z:0},outer,inner,length,8),position,frame);parts.push({id:id+'-'+name,role:kit+'_'+name.toUpperCase(),material,solid,bounds:boundsOf(solid.vertices)});};
 const base=(height=h)=>box('seat',{x:0,y:height/2-.012,z:0},{x:w,y:height,z:l},'armor');
 if(['ACCESS_HATCH','RECESSED_SERVICE_PANEL','MACHINE_ACCESS_COVER','DRONE_DOCK'].includes(kit)){
  base(h*.4);box('inset',{x:0,y:h*.48,z:0},{x:w*.77,y:h*.25,z:l*.78},'engine');
  for(const side of[-1,1])box('hinge'+side,{x:side*w*.40,y:h*.72,z:0},{x:w*.10,y:h*.40,z:l*.52});
  if(s.exposed)box('handle',{x:0,y:h*.92,z:l*.2},{x:w*.25,y:.09,z:.16},'mount');
 }else if(kit==='EVA_LADDER'){
  for(const side of[-1,1])box('rail'+side,{x:side*w*.43,y:h*.7,z:0},{x:.055,y:.07,z:l},'mount');
  for(let i=0;i<8;i++)box('rung'+i,{x:0,y:h*.7,z:-l*.43+i*l*.86/7},{x:w*.87,y:.055,z:.065},'secondary');
  for(const side of[-1,1])for(const end of[-1,1])box('anchor'+side+end,{x:side*w*.43,y:h*.35,z:end*l*.42},{x:.10,y:h*.7,z:.13},'armor');
 }else if(['EVA_HANDRAIL','SERVICE_CATWALK','ENGINE_SERVICE_FRAME','REINFORCEMENT_BRACKET'].includes(kit)){
  if(kit==='SERVICE_CATWALK')box('walk',{x:0,y:.055,z:0},{x:w,y:.13,z:l},'engine');
  const railH=kit==='REINFORCEMENT_BRACKET'?h*.5:h;
  for(const side of[-1,1]){box('long'+side,{x:side*w*.43,y:railH,z:0},{x:.10,y:.10,z:l},'secondary');for(const end of[-1,1])box('support'+side+end,{x:side*w*.43,y:railH/2-.01,z:end*l*.40},{x:.15,y:railH,z:.18},'armor');}
  if(kit==='ENGINE_SERVICE_FRAME'||kit==='REINFORCEMENT_BRACKET')for(const end of[-1,1])box('cross'+end,{x:0,y:railH,z:end*l*.4},{x:w,y:.13,z:.17},'armor');
 }else if(['CONDUIT_BUNDLE','COOLANT_PIPE'].includes(kit)){
  const count=kit==='CONDUIT_BUNDLE'?3:2;
  for(let i=0;i<count;i++)box('run'+i,{x:(i-(count-1)/2)*w/count,y:h*.7,z:0},{x:w/count*.55,y:h*.45,z:l},'engine');
  for(const z of[-l*.35,l*.35])box('clamp'+z,{x:0,y:h*.4,z},{x:w,y:h*.8,z:.14},'secondary');
 }else if(kit==='VENT_LOUVER'){
  base(h*.35);for(let i=0;i<6;i++)box('blade'+i,{x:0,y:h*.68,z:(i-2.5)*l*.13},{x:w*.85,y:h*.5,z:l*.07},'engine');
 }else if(kit==='RCS_CLUSTER'){
  base(h*.4);for(const side of[-1,1])for(const z of[-1,1])ring('nozzle'+side+z,{x:side*w*.26,y:h*.7,z:z*l*.25},Math.min(w,l)*.15,Math.min(w,l)*.09,h*.5);
 }else if(kit==='WEAPON_SERVICE_RING'){
  // Arc-like maintenance saddle on the OUTER foundation edge, never a second weapon housing.
  for(const end of[-1,1])box('outer'+end,{x:0,y:h*.35,z:end*l*.4},{x:w,y:h*.7,z:.15},'engine');
  for(const side of[-1,1])box('brace'+side,{x:side*w*.4,y:h*.4,z:0},{x:.17,y:h*.8,z:l*.8},'secondary');
 }else if(kit==='SERVICE_PORT'||kit==='OPTICAL_SENSOR'){
  base(h*.35);ring('rim',{x:0,y:h*.65,z:0},w*.35,w*.24,h*.55);box('core',{x:0,y:h*.52,z:0},{x:w*.3,y:h*.3,z:w*.3},'engine');
 }else if(kit==='SENSOR_STRIP'||kit==='MISSILE_CELL_DETAIL'){
  base(h*.55);for(let i=0;i<4;i++)box('cell'+i,{x:(i-1.5)*w*.2,y:h*.8,z:0},{x:w*.16,y:h*.35,z:l*.65},'engine');
 }else if(kit==='HAZARD_MARKING'){
  for(let i=0;i<5;i++)box('stripe'+i,{x:(i-2)*w*.18,y:h/2+.005,z:0},{x:w*.09,y:h,z:l},'mount');
 }else if(kit==='PANEL_SEAM'){
  // Raised joint lips around a recessed dark underlayer, never a full-hull grid.
  for(const side of[-1,1])box('lip'+side,{x:side*w*.33,y:h*.65,z:0},{x:w*.25,y:h,z:l},'secondary');
 }else {base(h*.6);box('lock',{x:0,y:h*.75,z:0},{x:w*.52,y:h*.5,z:l*.45},'engine');}
 return {parts,attachments:[],equipmentIds:[],clearances:[]};
}
