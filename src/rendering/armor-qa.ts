import * as THREE from 'three';
import type { ShipBlueprint } from '../blueprint/types';
export type ArmorView='TOP'|'BOTTOM'|'LEFT'|'RIGHT'|'SIDE'|'FRONT'|'AFT'|'ISOMETRIC'|'LOW-ISOMETRIC';
import { createShip, disposeShip } from './ship';
export const ARMOR_STAGES = ['HULL_ONLY','PRIMARY','SECONDARY','REINFORCEMENT','SEAMS','NO_HARDPOINTS','COMPLETE'] as const;
export type ArmorStage = typeof ARMOR_STAGES[number];
/** QA-only visibility projection. The underlying stored data is never regenerated. */
export function armorStageBlueprint(b: ShipBlueprint, stage: ArmorStage) {
  const copy = structuredClone(b);
  if(stage === 'COMPLETE') return copy;
  if(stage==='HULL_ONLY'){copy.structuralArmorPilot=undefined;copy.functionalExterior=undefined;copy.prefabPlacements=copy.prefabPlacements?.filter(p=>!p.assembly);}
  copy.hardpoints=[];
  if(stage==='NO_HARDPOINTS')return copy;
  copy.prefabPlacements=copy.prefabPlacements?.filter(p=>p.exterior&&['integration','bow','stern'].includes(p.exterior.phase)); copy.engines=[]; copy.surfaceFeatures=[];
  if(copy.layeredArmor) copy.layeredArmor.assemblies.forEach(a=>a.segments=a.segments.filter(s=>s.layer <= (stage==='HULL_ONLY'?0:stage==='PRIMARY'||stage==='SEAMS'?1:stage==='SECONDARY'?2:3)));
  return copy;
}
/** Lit orthographic progression, fixed projection / world scale across every layer and legacy comparison. */
export class ArmorQARenderer {
  private renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  private scene = new THREE.Scene();
  private ship?: THREE.Group;
  private cachedBlueprint?:ShipBlueprint;
  private cachedVisualKey="";
  private ambient = new THREE.HemisphereLight(0xc8d8eb,0x40434c,1.8);
  private key = new THREE.DirectionalLight(0xffebd3,4.1);
  private fill = new THREE.DirectionalLight(0xb4d1ef,1.6);
  private ventral = new THREE.DirectionalLight(0xc4d5e7,2.4);
  constructor(private size=480) {
    this.renderer.setSize(size,size); this.renderer.setPixelRatio(1);
    this.renderer.setClearColor('#172431');
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.3;
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene.add(this.ambient,this.key,this.fill,this.ventral,this.key.target);
    this.key.castShadow=true; this.key.shadow.mapSize.set(1024,1024); this.key.shadow.bias=-.0012;
  }
  capture(b:ShipBlueprint,stage:ArmorStage,view:ArmorView,options:{neutral?:boolean;black?:boolean;scale?:'fixed'|'fit';isolate?:number;reviewLighting?:boolean;underbodyLighting?:boolean;closeup?:{center:THREE.Vector3;extent:number}}={}) {
    const visualKey=`${stage}/${Boolean(options.neutral)}/${Boolean(options.black)}/${options.isolate??'all'}/${Boolean(options.reviewLighting)}/${Boolean(options.underbodyLighting)}`;
    // QA blueprints are immutable. Reuse the exact geometry across camera views, not design data.
    if(this.cachedBlueprint!==b||this.cachedVisualKey!==visualKey) {
    if(this.ship) {this.scene.remove(this.ship);disposeShip(this.ship);}
    this.ship=createShip(armorStageBlueprint(b,stage),'Normal');
    const shared=new THREE.MeshStandardMaterial({color:options.reviewLighting?0x798b9a:0x98a4af,roughness:.82,metalness:.12});
    // A consistent neutral clay rig, equally applied to source and prototype, reveals deep structural walls.
    this.ambient.intensity=options.underbodyLighting?1.2:options.reviewLighting ? .8 : 1.8;
    this.key.intensity=options.reviewLighting?3:4.1;
    this.fill.intensity=options.reviewLighting ? 1.25 : 1.6;
    this.ventral.intensity=options.underbodyLighting?2.4:options.reviewLighting ? 1 : 2.4;
    this.renderer.toneMappingExposure=options.reviewLighting?1:1.3;
    const black=new THREE.MeshBasicMaterial({color:0});
    const disposed=new Set<THREE.Material>();
    this.ship.traverse(n=>{
      if(n instanceof THREE.Line) n.visible=false;
      if(n instanceof THREE.Mesh) {
        n.receiveShadow=true; n.castShadow=Boolean(n.userData.functionalParts||n.userData.armorLayer||(b.structuralArmorPilot&&(n.userData.structuralArmor||n.userData.mountFoundation)));
        if(options.isolate!==undefined) n.visible=n.userData.armorLayer===options.isolate;
        if(options.neutral||options.black) {
          (Array.isArray(n.material)?n.material:[n.material]).forEach(m=>disposed.add(m));
          n.material=options.black?black:(stage==='SEAMS'&&!n.userData.armorLayer?new THREE.MeshStandardMaterial({color:0x344350,roughness:.8}):shared);
        }
      }
    });
    disposed.forEach(m=>m.dispose());
    if(!options.neutral||options.black) shared.dispose(); if(!options.black) black.dispose();
    this.scene.add(this.ship); this.ship.updateMatrixWorld(true);
    this.cachedBlueprint=b;this.cachedVisualKey=visualKey;
    }
    const direction=view==='TOP'?new THREE.Vector3(0,1,0):view==='BOTTOM'?new THREE.Vector3(0,-1,0):view==='SIDE'||view==='RIGHT'?new THREE.Vector3(1,0,0):view==='LEFT'?new THREE.Vector3(-1,0,0):view==='FRONT'?new THREE.Vector3(0,0,-1):view==='AFT'?new THREE.Vector3(0,0,1):new THREE.Vector3(-1.08,view==='LOW-ISOMETRIC'?-.88:.88,-1.25).normalize();
    const up=view==='TOP'||view==='BOTTOM'?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0);
    const right=up.clone().cross(direction).normalize(), vertical=direction.clone().cross(right).normalize();
    // Use Complete's authoritative bounds for every progression stage, including fitted views.
    const bounds=b.functionalExterior?.overallBounds??b.structuralArmorPilot?.overallBounds??b.layeredArmor?.overallBounds??b.hullIntegration?.overallBounds;
    const center=options.scale==='fit'&&bounds?new THREE.Vector3().addVectors(new THREE.Vector3(bounds.min.x,bounds.min.y,bounds.min.z),new THREE.Vector3(bounds.max.x,bounds.max.y,bounds.max.z)).multiplyScalar(.5):new THREE.Vector3();
    let extent=b.order.length*1.50;
    if(options.scale==='fit'&&bounds) {
      const pts=[bounds.min.x,bounds.max.x].flatMap(x=>[bounds.min.y,bounds.max.y].flatMap(y=>[bounds.min.z,bounds.max.z].map(z=>new THREE.Vector3(x,y,z).sub(center))));
      extent=Math.max(...pts.map(p=>Math.abs(p.dot(right))*2),...pts.map(p=>Math.abs(p.dot(vertical))*2))*1.12;
    }
    if(options.closeup){center.copy(options.closeup.center);extent=options.closeup.extent;}
    const l=b.order.length;
    this.key.position.copy(center).add(new THREE.Vector3(-l,l*(options.underbodyLighting?-1.7:1.7),-l*1.2)); this.key.target.position.copy(center);
    this.fill.position.set(l,l*.6,l); this.ventral.position.set(-l,-l*1.5,-l*.7);
    const shadow=this.key.shadow.camera; shadow.left=shadow.bottom=-l*.9;shadow.right=shadow.top=l*.9;shadow.near=l*.1;shadow.far=l*5;shadow.updateProjectionMatrix();this.key.shadow.normalBias=l*.0006;
    const camera=new THREE.OrthographicCamera(-extent/2,extent/2,extent/2,-extent/2,.01,l*20);
    camera.up.copy(up); camera.position.copy(center).addScaledVector(direction,l*5); camera.lookAt(center);camera.updateProjectionMatrix();
    this.renderer.setClearColor(options.black?0xffffff:0x172431);
    this.renderer.shadowMap.enabled=!options.black;
    this.renderer.render(this.scene,camera);
    return {pixels:this.renderer.domElement.toDataURL('image/png'),stage,view,frameMeters:extent,projection:'orthographic',scale:options.scale??'fixed',size:this.size,diagnostics:{calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles}};
  }
  dispose(){if(this.ship)disposeShip(this.ship);this.renderer.dispose();}
}
