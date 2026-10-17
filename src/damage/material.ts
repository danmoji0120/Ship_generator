import {BALLISTIC_MATERIALS}from'./calibration';
import type{ProjectileSpec,MaterialResult,Contact}from'./types';
import type{Vec3}from'../blueprint/types';
import {dot,mul,sub}from'../generation/integration/contours';
export const length=(v:Vec3)=>Math.hypot(v.x,v.y,v.z);
export const unit=(v:Vec3)=>{const n=length(v);if(n<1e-12)throw Error('ZERO_DIRECTION');return mul(v,1/n);};
export function penetrate(spec:ProjectileSpec,massKg:number,integrity:number,velocity:Vec3,c:Contact,localLossM=0):MaterialResult{
 const speed=length(velocity),dir=unit(velocity),n=unit(c.normal),cos=Math.min(1,Math.abs(dot(dir,n))),angle=Math.acos(cos)*180/Math.PI,E=.5*massKg*speed*speed,path=Math.max(0,c.exit-c.entry),area=Math.PI*(spec.penetratorDiameterMm/2000)**2,m=BALLISTIC_MATERIALS[c.materialId??''];
 const base={incidentJ:E,residualJ:E,massKg,integrity,speedMps:speed,direction:dir,depthM:path,damageRadiusM:spec.penetratorDiameterMm/2000,lossM:0,fracture:0,incidenceDegrees:angle};
 if(!m||c.kind==='UNRESOLVED'||speed>12000||speed<10)return {...base,outcome:'UNRESOLVED',warning:c.kind==='UNRESOLVED'?c.confidence:!m?'MATERIAL_CALIBRATION_UNAVAILABLE':'VELOCITY_OUTSIDE_DEVELOPMENT_RANGE'};
 const effective=Math.max(path*.35,path-Math.max(0,localLossM))*(c.materialFillFraction??1),shape=spec.penetratorGeometry==='LONG_ROD'?.78:spec.penetratorGeometry==='BLUNT'?1.25:1,aspect=spec.projectileLengthMm/spec.penetratorDiameterMm,projectileDensity=spec.projectileMaterial==='TUNGSTEN_ALLOY'?17000:7850,
 work=area*effective*(m.strengthPa*shape*(1+.6*(1-cos)**2)/Math.max(.7,Math.min(1.3,aspect/5))+.5*m.density*speed*speed*m.drag),ratio=Math.min(1,E/Math.max(1,work));
 // A low normal component and a glancing hard face may reflect the surviving projectile.
 if(angle>m.ricochetDegrees&&E*cos*cos<work*.3&&integrity>.25){const loss=.28+.3*m.brittleness,remaining=E*(1-loss),newMass=massKg*.99;return {...base,outcome:'RICOCHET',residualJ:remaining,massKg:newMass,integrity:integrity*.8,speedMps:Math.sqrt(2*remaining/newMass),direction:unit(sub(dir,mul(n,2*dot(dir,n)))),depthM:0,lossM:0,fracture:Math.min(.2,E/Math.max(1,work)*.04)};}
 const erosion=Math.min(.4,(m.density/projectileDensity)*effective/Math.max(.05,spec.projectileLengthMm/1000)*.12/spec.integrityProperties.erosionResistance),newMass=massKg*(1-erosion),newIntegrity=Math.max(0,integrity-(work/Math.max(E,1))*(.08+.32*m.brittleness)/spec.integrityProperties.fractureResistance),residual=Math.max(0,E-work)*(1-erosion);
 const passed=E>work&&newIntegrity>.08,newOutcome=newIntegrity<=.08&&E>work?'PROJECTILE_FAILURE':passed?'PENETRATED':'STOPPED',depth=passed?path:path*ratio;
 return {...base,outcome:newOutcome,residualJ:passed?residual:0,massKg:newMass,integrity:newIntegrity,speedMps:passed?Math.sqrt(2*residual/newMass):0,depthM:depth,direction:passed?unit(sub(dir,mul(n,Math.sign(-dot(dir,n))*m.brittleness*.02*(1-cos)/Math.max(1,aspect)))):dir,damageRadiusM:Math.sqrt(area/Math.PI)*(1+m.brittleness*ratio),lossM:passed?0:Math.min(path*m.craterFraction,depth*.18),fracture:Math.min(1,m.brittleness*ratio)};
}
