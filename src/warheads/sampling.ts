import {Quaternion,Vector3} from 'three';
import type {Vec3} from '../blueprint/types';
import type {WarheadSpec,DetonationEvent} from './types';
import type {ProjectileSpec} from '../damage/types';
import {SAMPLE_COUNTS} from './registry';
import {dot,add,mul} from '../generation/integration/contours';
import {unit} from '../damage/material';
export function seeded(seed:number){let x=seed>>>0;return ()=>{x+=0x6d2b79f5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function angularDirections(spec:WarheadSpec,event:DetonationEvent):Vec3[]{
 const count=SAMPLE_COUNTS[event.approximationQuality],random=seeded(event.randomSeed),phase=random()*Math.PI*2,roll=random()*Math.PI*2,
 forward=unit(event.forwardDirection),q=new Quaternion().setFromUnitVectors(new Vector3(0,0,1),new Vector3(forward.x,forward.y,forward.z)),out:Vec3[]=[];
 // Equal-solid-angle strata. The same physical population is quantized onto these directions.
 for(let i=0;i<count;i++){const z=spec.warheadFamily==='DIRECTIONAL'?1-(i+.5)/count*(1-Math.cos(spec.directionalProfile.halfAngleDegrees*Math.PI/180)):1-2*(i+.5)/count,r=Math.sqrt(Math.max(0,1-z*z)),phi=phase+i*Math.PI*(3-Math.sqrt(5)),v=new Vector3(r*Math.cos(phi+roll),r*Math.sin(phi+roll),z).applyQuaternion(q);out.push({x:v.x,y:v.y,z:v.z});}
 return out;
}
export function fragmentPopulation(spec:WarheadSpec,event:DetonationEvent,targetVelocity:Vec3){
 const directions=angularDirections(spec,event),count=spec.fragmentationProfile.physicalPopulation,mass=spec.casingMassKg/count,speed=Math.sqrt(2*spec.abstractEffectBudget.carrierKineticJ/spec.casingMassKg),inherited={x:event.worldVelocity.x-targetVelocity.x,y:event.worldVelocity.y-targetVelocity.y,z:event.worldVelocity.z-targetVelocity.z},multiplicity=count/directions.length,
 b=directions.reduce((sum,d)=>sum+mass*multiplicity*speed*dot(inherited,d),0),a=spec.abstractEffectBudget.carrierKineticJ,k=(-b+Math.sqrt(b*b+4*a*a))/(2*a);
 const projectile:ProjectileSpec={projectileId:spec.warheadSpecId+'/physical-fragment',provenance:'DEVELOPMENT_PRESET',ammunitionType:spec.warheadFamily==='DIRECTIONAL'?'DIRECTIONAL':'FRAGMENT',caliberMm:spec.fragmentationProfile.diameterMm,penetratorDiameterMm:spec.fragmentationProfile.diameterMm,projectileLengthMm:spec.fragmentationProfile.lengthMm,projectileMassKg:mass,muzzleVelocityMps:speed,projectileMaterial:spec.fragmentationProfile.material,penetratorGeometry:spec.warheadFamily==='DIRECTIONAL'?'LONG_ROD':'BLUNT',integrityProperties:{fractureResistance:1,erosionResistance:1},collisionProfile:spec.damageCarrierProfile};
 return Array.from({length:count},(_,i)=>{const angularSampleId=Math.floor(i/multiplicity),direction=directions[angularSampleId],velocity=add(event.worldVelocity,mul(direction,speed*k));return{projectile,angularSampleId,direction,velocity};});
}
