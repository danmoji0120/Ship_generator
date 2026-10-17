import type{ProjectileSpec}from'./types';
const preset=(id:string,caliber:number,diameter:number,length:number,mass:number,velocity:number,material:ProjectileSpec['projectileMaterial'],geometry:ProjectileSpec['penetratorGeometry'],fracture:number,erosion:number):ProjectileSpec=>Object.freeze({projectileId:id,provenance:'DEVELOPMENT_PRESET',ammunitionType:'KINETIC',caliberMm:caliber,penetratorDiameterMm:diameter,projectileLengthMm:length,projectileMassKg:mass,muzzleVelocityMps:velocity,projectileMaterial:material,penetratorGeometry:geometry,integrityProperties:Object.freeze({fractureResistance:fracture,erosionResistance:erosion}),collisionProfile:'CENTERLINE_SWEPT_FINITE_VOLUMES'});
/** Invented test specifications. Not historical ammunition, empirical certification or final combat balance. */
export const PROJECTILES=Object.freeze({
 'dev-105':preset('dev-105',105,75,330,12,1050,'HARDENED_STEEL','CAPPED_OGIVE',1,.8),
 'dev-210':preset('dev-210',210,185,650,100,1500,'HARDENED_STEEL','BLUNT',1.2,1),
 'dev-406':preset('dev-406',406,170,1200,400,2400,'TUNGSTEN_ALLOY','LONG_ROD',.85,1.5),
 'dev-500':preset('dev-500',500,220,1800,1100,3500,'TUNGSTEN_ALLOY','LONG_ROD',1.1,1.8),
});
export function validateProjectile(p:ProjectileSpec){if(![p.caliberMm,p.penetratorDiameterMm,p.projectileLengthMm,p.projectileMassKg,p.muzzleVelocityMps,p.integrityProperties.fractureResistance,p.integrityProperties.erosionResistance].every(n=>Number.isFinite(n)&&n>0)||p.penetratorDiameterMm>p.caliberMm||p.projectileMassKg>100000||p.muzzleVelocityMps>12000||p.muzzleVelocityMps<10||!['CAPPED_OGIVE','BLUNT','LONG_ROD'].includes(p.penetratorGeometry)||!['HARDENED_STEEL','TUNGSTEN_ALLOY'].includes(p.projectileMaterial)||p.collisionProfile!=='CENTERLINE_SWEPT_FINITE_VOLUMES')throw Error('INVALID_PROJECTILE_SPECIFICATION');}
