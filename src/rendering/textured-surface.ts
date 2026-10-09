import * as THREE from 'three';
import {appearanceMaterials} from './surface-appearance';
import {APPEARANCE_PALETTES,MATERIAL_ROLES,type MaterialRole} from './appearance';
import {SURFACE_PROFILES} from '../generation/appearance/profile';
import type {SurfaceAppearancePlan,FinishProfile,DecalPlacement} from '../generation/appearance/types';
import {acquireSurfaceAssets,releaseSurfaceAssets} from './surface-assets';
import {dot,sub} from '../generation/integration/contours';
/** Adds only shading attributes; immutable physical position/index/normal buffers are unchanged. */
export function tagSurfaceFinish(g:THREE.BufferGeometry,p:SurfaceAppearancePlan,parentId:string){
 const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),variation=p.componentVariations.find(c=>c.parentId===parentId),decals=p.decals.filter(d=>d.parentId===parentId),finish:number[]=[],coords:number[]=[],rects:number[]=[],modes:number[]=[];
 for(let i=0;i<pos.count;i++){
  const q={x:pos.getX(i),y:pos.getY(i),z:pos.getZ(i)},n={x:normal.getX(i),y:normal.getY(i),z:normal.getZ(i)};
  const d=decals.find(d=>dot(n,d.normal)>.995&&Math.abs(dot(sub(q,d.position),d.normal))<.025);
  finish.push(variation?.tone??0,variation?.wearEligible?1:0);
  if(d){const a=sub(q,d.position),row=p.decals.indexOf(d),height=THREE.MathUtils.ceilPowerOfTwo(Math.max(32,p.decals.length*32));coords.push(dot(a,d.right)/d.size.width+.5,dot(a,d.up)/d.size.height+.5);rects.push(0,row*32/height,1,32/height);modes.push(d.color==='WARNING'?2:1,d.visibility==='FAR'?0:d.visibility==='MEDIUM'?1:2);}
  else{coords.push(-2,-2);rects.push(0,0,0,0);modes.push(0,0);}
 }
 g.setAttribute('finishData',new THREE.Float32BufferAttribute(finish,2));g.setAttribute('paintUV',new THREE.Float32BufferAttribute(coords,2));g.setAttribute('paintRect',new THREE.Float32BufferAttribute(rects,4));g.setAttribute('paintMode',new THREE.Float32BufferAttribute(modes,2));
}
export function texturedMaterials(p:SurfaceAppearancePlan){
 const layers=appearanceMaterials(p),asset=acquireSurfaceAssets(p),style=SURFACE_PROFILES[p.language],palette=APPEARANCE_PALETTES[p.language];let remaining=MATERIAL_ROLES.length;
 for(const role of MATERIAL_ROLES){const m=layers[role],previous=m.onBeforeCompile,profile=style.roles[role];
  m.userData.surfaceUniformBindings=[];m.userData.surfaceAppearance=p;m.userData.surfaceSettings={finish:p.finish,debug:'NONE'};
  m.addEventListener('dispose',()=>{if(--remaining===0)releaseSurfaceAssets(asset.key);});
  m.onBeforeCompile=(shader,renderer)=>{previous(shader,renderer);
   const settings=m.userData.surfaceSettings;shader.uniforms.surfaceGrain={value:asset.grain};shader.uniforms.surfaceAtlas={value:asset.atlas};shader.uniforms.surfacePeriod={value:p.texture.grainPeriodMeters};shader.uniforms.surfaceRowHeight={value:32/asset.atlas.image.height};shader.uniforms.finishLevel={value:settings.finish==='WEATHERED'?2:settings.finish==='SERVICE'?1:0};shader.uniforms.surfaceDebug={value:settings.debug==='TEXTURE'?1:settings.debug==='DECAL'?2:0};m.userData.surfaceUniformBindings.push(shader.uniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nattribute vec2 finishData; attribute vec2 paintUV; attribute vec4 paintRect; attribute vec2 paintMode; varying vec3 finishPosition; varying vec3 finishNormal; varying vec2 componentFinish; varying vec2 decalUV; varying float decalRow; varying float decalCode;`).replace('#include <begin_vertex>','#include <begin_vertex>\nfinishPosition=position; finishNormal=normal; componentFinish=finishData; decalUV=paintUV; decalRow=paintRect.y; decalCode=paintMode.x+paintMode.y*.1;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 finishPosition; varying vec3 finishNormal; varying vec2 componentFinish; varying vec2 decalUV; varying float decalRow; varying float decalCode;
    uniform sampler2D surfaceGrain; uniform sampler2D surfaceAtlas; uniform float surfacePeriod; uniform float surfaceRowHeight; uniform float finishLevel; uniform float surfaceDebug;
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 fq=finishPosition/surfacePeriod;
    vec3 grainDx=dFdx(fq),grainDy=dFdy(fq);
    float resolvable=1.-smoothstep(.45,1.4,max(max(length(grainDx),length(grainDy)),.0001));
    vec3 sampleGrain=vec3(.5);
    // FAR fragments do not fetch three sub-pixel textures. Explicit gradients keep mip selection
    // valid at the boundary of this per-fragment visibility branch (WebGL2).
    if(resolvable>.001){vec3 fn=abs(normalize(finishNormal));fn=pow(fn,vec3(4.));fn/=max(dot(fn,vec3(1.)),.0001);sampleGrain=textureGrad(surfaceGrain,fq.yz,grainDx.yz,grainDy.yz).rgb*fn.x+textureGrad(surfaceGrain,fq.xz,grainDx.xz,grainDy.xz).rgb*fn.y+textureGrad(surfaceGrain,fq.xy,grainDx.xy,grainDy.xy).rgb*fn.z;}
    float grain=(sampleGrain.r-.5)*resolvable;
    float brush=(sampleGrain.b-.5)*resolvable;
    float surfaceValue=grain+brush*${(role==='MECHANICAL_STRUCTURE'?style.brushing:style.brushing*.15).toFixed(4)};
    float broadPaint=sin(finishPosition.z*.17+finishPosition.x*.09)*.007;
    diffuseColor.rgb*=1.+componentFinish.x+broadPaint+surfaceValue*${(profile.albedo*style.contrast).toFixed(5)};
    // Localized service wear: existing access/edge structures only; CLEAN has no invented damage.
    float serviceWear=componentFinish.y*finishLevel*${(style.wear*.014).toFixed(5)}*max(0.,brush);
    diffuseColor.rgb*=1.-serviceWear;
    float packedPaint=floor(decalCode*10.+.5),decalKind=floor(packedPaint*.1),decalVisibility=packedPaint-decalKind*10.;
    float decalInside=step(0.,decalUV.x)*step(0.,decalUV.y)*step(decalUV.x,1.)*step(decalUV.y,1.)*step(.5,decalKind);
    vec2 decalSizePixels=1./max(fwidth(decalUV),vec2(.0001));
    float decalReadable=smoothstep(decalVisibility>1.5?10.:4.,decalVisibility>1.5?22.:10.,min(decalSizePixels.x,decalSizePixels.y));
    vec2 atlasUV=vec2(clamp(decalUV.x,0.,1.),decalRow+clamp(decalUV.y,0.,1.)*surfaceRowHeight);
    vec2 atlasDx=dFdx(atlasUV),atlasDy=dFdy(atlasUV);float ink=0.;
    if(decalInside>.5&&decalReadable>.001)ink=textureGrad(surfaceAtlas,atlasUV,atlasDx,atlasDy).r*decalReadable;
    diffuseColor.rgb=mix(diffuseColor.rgb,decalKind>1.5?warningColor:markingColor*${role==='PRIMARY_ARMOR'||role==='SECONDARY_ARMOR'?'.24':'1.'},ink*.98);
    if(surfaceDebug>.5&&surfaceDebug<1.5)diffuseColor.rgb=vec3(.48+surfaceValue*.25+componentFinish.x);
    if(surfaceDebug>1.5)diffuseColor.rgb=mix(vec3(.08),decalKind>1.5?warningColor:markingColor,ink);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+surfaceValue*${(profile.roughness*style.contrast).toFixed(5)}+serviceWear,.08,.98);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    // Derivative bump in view space. Tiny real-scale paint/metal grain, never a deep fake groove.
    vec3 surfaceDx=dFdx(-vViewPosition),surfaceDy=dFdy(-vViewPosition);vec2 bumpSlope=vec2(dFdx(surfaceValue),dFdy(surfaceValue));
    if(resolvable>.001){vec3 bumpX=cross(surfaceDy,normal),bumpY=cross(normal,surfaceDx);float bumpDet=dot(surfaceDx,bumpX);
    normal=normalize(abs(bumpDet)*normal-sign(bumpDet)*(bumpSlope.x*bumpX+bumpSlope.y*bumpY)*${profile.normal.toFixed(5)});}
   `);
  };
  m.customProgramCacheKey=()=>`ship-surface-1.8.5.2/${p.language}/${role}`;
 }
 return layers;
}
/** Appearance overrides are viewer state only; serialized recipes and physical data remain untouched. */
export function setSurfacePresentation(root:THREE.Object3D,finish?:FinishProfile,debug:'NONE'|'TEXTURE'|'DECAL'='NONE'){
 const materials=new Set<THREE.Material>();root.traverse(n=>{if(n instanceof THREE.Mesh)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);});
 for(const m of materials){const p=m.userData.surfaceAppearance;if(!p)continue;const state=m.userData.surfaceSettings;state.finish=finish??p.finish;state.debug=debug;for(const uniforms of m.userData.surfaceUniformBindings??[]){uniforms.finishLevel.value=state.finish==='WEATHERED'?2:state.finish==='SERVICE'?1:0;uniforms.surfaceDebug.value=debug==='TEXTURE'?1:debug==='DECAL'?2:0;}}
}
