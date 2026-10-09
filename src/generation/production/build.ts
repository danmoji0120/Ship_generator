import {finishRequirements} from './requirements';
import type{ShipBlueprint}from'../../blueprint/types';
import type{ProductionDesign,ProductionTimings}from'./types';
import{extractArmorSurfaces}from'../armor/surfaces';
import{boundsOf}from'../integration/contours';
import{profileRing}from'../hull';
import{generateFunctionalExterior}from'./functional';
import{generateStructuralArmor,finishArmorCoverage}from'./armor';
import{generateProductionWeapons}from'./weapons';
import{createDesignDoctrine,finalizeDoctrineCapacity,finishDesignDoctrine,prepareIntegratedArmament}from'./doctrine';
import{validateBlueprint,type ValidationDetails}from'../../validation/validate';
export function buildProduction(base:ShipBlueprint,candidate:number,attempts:ProductionDesign['attempts'],hullMs=0,onTimings?:(t:ProductionTimings)=>void):ShipBlueprint{
 const start=performance.now(),b=base;b.generatorVersion='1.8.4';b.designDoctrine=createDesignDoctrine(b);prepareIntegratedArmament(b);
 const d:ProductionDesign={status:'generated',pipelineVersion:'1.8.4',family:b.macroDesign!.family,axisAligned:true,armor:[],finish:[],channels:[],zones:[...extractArmorSurfaces(b).zones,...(b.hullIntegration?.reservedZones.filter(z=>z.kind==='machinery'&&b.prefabPlacements?.some(p=>p.id===z.equipmentId&&p.kind==='SPINAL_MUZZLE'))??[])],coverage:null as any,functionalPrefabIds:[],overallBounds:boundsOf([]),decisions:[],attempts:structuredClone(attempts),stages:[...(b.designRequirements?[{stage:'requirement-planning',input:'normalized Order / role / size / mass / priorities BEFORE hull',output:'mandatory/target/optional contracts; prefiltered compatible candidates; axial and supply spaces reserved in Macro recipes'}]:[]),{stage:'macro/hull',input:'normalized Order + Seed + yard doctrine',output:'StructuralVolume/Connector, MacroPlan, integrated openings'},{stage:'doctrine',input:'actual hull module volume + mass class + nine role doctrines + six competing priorities',output:'finite sector reservations / integrated weapon acceptance'},{stage:'armor',input:'actual station surfaces + finalized opening reservations',output:'primary masses / shoulder / belt / keel / contact data'},{stage:'coverage',input:'exposed station triangles minus protected openings',output:'uncovered large face skins + measured eligible area'},{stage:'functional',input:'command plinth / real engines / service channels',output:'stored parametric registry assemblies'},{stage:'weapons',input:'composition targets + mass/volume/host/surface allocations + final armor',output:'bounded beam replan / atomic standard-size alternatives / reciprocal firing clearance / doctrine target-actual accounting'}],validation:{issues:[],checks:[]}};
 b.productionDesign=d;generateStructuralArmor(b,d,candidate);const armorEnd=performance.now();finishArmorCoverage(b,d);const coverageEnd=performance.now();finalizeDoctrineCapacity(b);generateFunctionalExterior(b,d);const functionalEnd=performance.now();
 d.overallBounds=boundsOf([...b.structuralVolumes.flatMap(v=>v.geometry.stations.flatMap(s=>profileRing(s).map(([x,y])=>({x:x+v.position.x,y:y+v.position.y,z:s.z+v.position.z})))),...d.armor.flatMap(c=>c.solid.vertices),...d.finish.flatMap(c=>c.solid.vertices),...b.prefabPlacements!.flatMap(p=>p.assembly?.parts.flatMap(p=>p.solid.vertices)??p.exterior?.rings?.flat()??[]),...b.engines.flatMap(e=>[{x:e.position.x-e.nozzleRadius*(e.bellRatio+.12),y:e.position.y-e.nozzleRadius*(e.bellRatio+.12),z:e.position.z},{x:e.position.x+e.nozzleRadius*(e.bellRatio+.12),y:e.position.y+e.nozzleRadius*(e.bellRatio+.12),z:e.position.z+e.nozzleLength+e.nozzleRadius*.12}])]);
 generateProductionWeapons(b);finishDesignDoctrine(b);finishRequirements(b);const installationEnd=performance.now(),results:ValidationDetails={},errors=validateBlueprint(b,results);
 b.weaponLayout!.validation=results.weapon!;d.validation=results.production!;
 if(errors.length)throw Error(errors.join('; '));
 const end=performance.now();onTimings?.({hullMs,armorMs:armorEnd-start,coverageMs:coverageEnd-armorEnd,functionalMs:functionalEnd-coverageEnd,installationMs:installationEnd-functionalEnd,validationMs:end-installationEnd,totalMs:end-start+hullMs});
 return b;
}
