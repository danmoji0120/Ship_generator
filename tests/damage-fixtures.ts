import type{ShipBlueprint,Vec3}from'../src/blueprint/types';
import {materialLayers}from'../src/physical/materials';
import {triangleLayer,cellSolid,cellVolume}from'../src/physical/convex';
import {normal,area}from'../src/generation/armor/panels';
import {prepareDamageQueries}from'../src/damage/contacts';
import type{DamageTarget}from'../src/damage/types';
export const plate=(id:string,kind:'ARMOR'|'HULL',z:number,mm:number,materialId:string)=>{
 const polygon=[{x:-10,y:-10,z},{x:10,y:-10,z},{x:0,y:10,z}],layers=materialLayers(materialId,mm).map(l=>({...l,volumeM3:0,massKg:0}));let depth=0;
 const pieces=layers.map(l=>{const c=triangleLayer(polygon,depth,depth+l.thicknessMm/1000);depth+=l.thicknessMm/1000;l.volumeM3=cellVolume(c);l.massKg=l.volumeM3*l.densityKgM3;return {facetIndex:0,layerOrder:l.layerOrder,solid:cellSolid(c),volumeM3:l.volumeM3};});
 return {id,kind,materialId,thicknessMm:mm,facets:[{sourceTriangle:0,normal:normal(polygon),areaM2:area(polygon),thicknessMm:mm,planeOffsetM:z,maximumThicknessMm:mm}],layerStack:layers,pieces,massKg:layers.reduce((n,l)=>n+l.massKg,0),volumeM3:layers.reduce((n,l)=>n+l.volumeM3,0),surfaceAreaM2:area(polygon)};
};
export function fixture(surfaces:any[]=[plate('armor','ARMOR',0,300,'CERAMIC_COMPOSITE')]){return {schemaVersion:2,generatorVersion:'1.8.6.3.1',order:{length:100},structuralVolumes:[],prefabPlacements:[],physicalDesign:{version:'1.8.6.0',materialRegistryVersion:1,surfaces,geometryModel:'FINITE_TEST_TRIANGLES',approximation:'INDEPENDENT_CALIBRATION_FIXTURE',warnings:[]}} as unknown as ShipBlueprint;}
export function target(b=fixture()):DamageTarget{return {blueprint:b,queries:prepareDamageQueries(b),motion:{position:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},quaternion:{x:0,y:0,z:0,w:1}}};}
