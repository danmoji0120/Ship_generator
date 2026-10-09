import * as THREE from 'three';
import type {Vec3} from '../blueprint/types';
import type {MountFrame} from '../generation/weapons/types';
import {detailFrame} from '../generation/details/geometry';
import {APPEARANCE_PALETTES,EMISSIVE_ROLES,MATERIAL_ROLES,type MaterialAppearance,type SurfaceAppearance} from './appearance';
const patterns=['NONE','STATUS','GUIDE','LENS','WINDOW','HATCH','HAZARD','IDENTIFICATION'];
/** Additional vertex attributes only. Position/index/normal buffers and physical Blueprint remain untouched. */
export function tagAppearance(geometry:THREE.BufferGeometry,spec:SurfaceAppearance,normal:Vec3={x:0,y:1,z:0},givenFrame?:MountFrame){
 const frame=givenFrame??detailFrame(normal),axes=[frame.right,frame.normal,frame.forward].map(v=>new THREE.Vector3(v.x,v.y,v.z));
 const pos=geometry.getAttribute('position'),norm=geometry.getAttribute('normal'),local:THREE.Vector3[]=[],box=new THREE.Box3(),point=new THREE.Vector3();
 for(let i=0;i<pos.count;i++){point.fromBufferAttribute(pos,i);const p=new THREE.Vector3(...axes.map(a=>point.dot(a)) as [number,number,number]);local.push(p);box.expandByPoint(p);}
 const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),coords:number[]=[],marks:number[]=[],scales:number[]=[];
 for(let i=0;i<pos.count;i++){const p=local[i].sub(center);coords.push(p.x/Math.max(size.x,1e-5),p.y/Math.max(size.y,1e-5),p.z/Math.max(size.z,1e-5));point.fromBufferAttribute(norm,i);scales.push(Math.max(size.x,.001),Math.max(size.z,.001));marks.push(spec.emissive?EMISSIVE_ROLES.indexOf(spec.emissive)+1:0,patterns.indexOf(spec.pattern),point.dot(axes[1]),point.dot(axes[2]));}
 geometry.setAttribute('surfaceScale',new THREE.Float32BufferAttribute(scales,2));
 geometry.setAttribute('surfacePoint',new THREE.Float32BufferAttribute(coords,3));geometry.setAttribute('surfaceMark',new THREE.Float32BufferAttribute(marks,4));
}
/** Small functional marks are analytic shading on existing surfaces, not new solids, lights or decals. */
export function appearanceMaterials(appearance:MaterialAppearance){
 const palette=APPEARANCE_PALETTES[appearance.language],result={} as Record<(typeof MATERIAL_ROLES)[number],THREE.MeshStandardMaterial>;
 for(const role of MATERIAL_ROLES){
  const m=new THREE.MeshStandardMaterial({color:palette.colors[role],roughness:palette.roughness[role],metalness:palette.metalness[role]});m.name=role;m.userData.appearance=appearance;m.userData.materialRole=role;
  m.onBeforeCompile=shader=>{
   shader.uniforms.functionalLights={value:EMISSIVE_ROLES.map(r=>new THREE.Color(palette.lights[r]))};
   shader.uniforms.functionalIntensity={value:palette.intensity};shader.uniforms.warningColor={value:new THREE.Color(palette.warning)};shader.uniforms.markingColor={value:new THREE.Color(palette.marking)};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 surfaceScale; varying vec2 appearanceScale; attribute vec3 surfacePoint; attribute vec4 surfaceMark; varying vec3 appearancePoint; varying vec4 appearanceMark;').replace('#include <begin_vertex>','#include <begin_vertex>\nappearanceScale=surfaceScale; appearancePoint=surfacePoint; appearanceMark=surfaceMark;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec2 appearanceScale; varying vec3 appearancePoint; varying vec4 appearanceMark;
    uniform vec3 functionalLights[7]; uniform float functionalIntensity; uniform vec3 warningColor; uniform vec3 markingColor;
    float surfaceBox(vec2 p,vec2 center,vec2 halfSize){vec2 d=abs(p-center)-halfSize;vec2 aa=max(fwidth(p),vec2(.001));return (1.-smoothstep(-aa.x,aa.x,d.x))*(1.-smoothstep(-aa.y,aa.y,d.y));}
    `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 ap=appearancePoint.xz; float pattern=appearanceMark.y; float front=step(.55,appearanceMark.z);
    float signal=0.; float paint=0.;
    if(pattern>.5&&pattern<1.5)signal=surfaceBox(ap,vec2(.28,.25),min(vec2(.065,.065),vec2(.12,.18)/max(appearanceScale,vec2(.001))))*front;
    if(pattern>1.5&&pattern<2.5)signal=surfaceBox(ap,vec2(0.,.34),min(vec2(.24,.026),vec2(.55,.07)/max(appearanceScale,vec2(.001))))*front;
    if(pattern>2.5&&pattern<3.5)signal=surfaceBox(ap,vec2(0.),vec2(.23,.24))*front;
    if(pattern>3.5&&pattern<4.5){vec2 wp=vec2(appearancePoint.x,appearancePoint.y);signal=surfaceBox(wp,vec2(0.,.12),vec2(.40,.045))*step(.5,abs(appearanceMark.w));signal*=step(.13,fract((wp.x+.5)*7.));}
    if(pattern>4.5&&pattern<5.5){float outer=surfaceBox(ap,vec2(0.),vec2(.37,.38));float inner=surfaceBox(ap,vec2(0.),vec2(.348,.357));paint=max(0.,outer-inner)*front*.5;signal=surfaceBox(ap,vec2(.25,.25),vec2(.045,.065))*front;}
    if(pattern>5.5&&pattern<6.5)paint=front*surfaceBox(ap,vec2(0.),vec2(.38,.32));
    if(pattern>6.5)paint=front*surfaceBox(ap,vec2(.25,.20),vec2(.055,.15));
    diffuseColor.rgb=mix(diffuseColor.rgb,pattern>5.5&&pattern<6.5?warningColor:markingColor,paint);
    `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    vec3 functionalGlow=vec3(0.);
    ${EMISSIVE_ROLES.map((_,i)=>`if(abs(appearanceMark.x-${(i+1).toFixed(1)})<.25)functionalGlow=functionalLights[${i}];`).join('\n')}
    totalEmissiveRadiance+=functionalGlow*signal*functionalIntensity;
    `);
  };
  m.customProgramCacheKey=()=>`functional-appearance-1.8.5.1/${appearance.language}/${role}`;
  result[role]=m;
 }
 return result;
}
