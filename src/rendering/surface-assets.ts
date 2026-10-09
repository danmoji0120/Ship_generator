import * as THREE from 'three';
import type {SurfaceAppearancePlan} from '../generation/appearance/types';
import {surfaceHash} from '../generation/appearance/profile';
/** Fixed bitmap alphabet: deterministic across browsers/OS, no system-font dependency or network asset. */
const glyphs:Record<string,string>={
 A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',C:'01111/10000/10000/10000/10000/10000/01111',D:'11110/10001/10001/10001/10001/10001/11110',E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',G:'01111/10000/10000/10111/10001/10001/01111',H:'10001/10001/10001/11111/10001/10001/10001',I:'11111/00100/00100/00100/00100/00100/11111',J:'00111/00010/00010/00010/00010/10010/01100',K:'10001/10010/10100/11000/10100/10010/10001',L:'10000/10000/10000/10000/10000/10000/11111',M:'10001/11011/10101/10101/10001/10001/10001',N:'10001/11001/10101/10011/10001/10001/10001',O:'01110/10001/10001/10001/10001/10001/01110',P:'11110/10001/10001/11110/10000/10000/10000',Q:'01110/10001/10001/10001/10101/10010/01101',R:'11110/10001/10001/11110/10100/10010/10001',S:'01111/10000/10000/01110/00001/00001/11110',T:'11111/00100/00100/00100/00100/00100/00100',U:'10001/10001/10001/10001/10001/10001/01110',V:'10001/10001/10001/10001/10001/01010/00100',W:'10001/10001/10001/10101/10101/11011/10001',X:'10001/10001/01010/00100/01010/10001/10001',Y:'10001/10001/01010/00100/00100/00100/00100',Z:'11111/00001/00010/00100/01000/10000/11111',
 '0':'01110/10001/10011/10101/11001/10001/01110','1':'00100/01100/00100/00100/00100/00100/01110','2':'01110/10001/00001/00010/00100/01000/11111','3':'11110/00001/00001/01110/00001/00001/11110','4':'00010/00110/01010/10010/11111/00010/00010','5':'11111/10000/10000/11110/00001/00001/11110','6':'01110/10000/10000/11110/10001/10001/01110','7':'11111/00001/00010/00100/01000/01000/01000','8':'01110/10001/10001/01110/10001/10001/01110','9':'01110/10001/10001/01111/00001/00001/01110','-':'00000/00000/00000/11111/00000/00000/00000',' ':'00000/00000/00000/00000/00000/00000/00000'};
interface Asset {grain:THREE.DataTexture;atlas:THREE.DataTexture;refs:number;bytes:number}
const cache=new Map<string,Asset>();let builds=0,hits=0;
export const surfaceAssetKey=(p:SurfaceAppearancePlan)=>JSON.stringify([p.version,p.language,p.texture,p.decals.map(d=>[d.id,d.kind,d.text])]);
function texture(data:Uint8Array,w:number,h:number){const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.unpackAlignment=1;t.needsUpdate=true;return t;}
export function acquireSurfaceAssets(p:SurfaceAppearancePlan){
 const key=surfaceAssetKey(p);let a=cache.get(key);if(a){a.refs++;hits++;return {key,...a};}
 const n=128,g=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,h=surfaceHash(`${p.texture.seed}/${x}/${y}`);g[i]=h&255;g[i+1]=(h>>>8)&255;g[i+2]=Math.round(128+65*Math.sin(y*.38)+25*Math.sin(y*1.1));g[i+3]=255;}
 const grain=texture(g,n,n);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;
 const w=512,h=THREE.MathUtils.ceilPowerOfTwo(Math.max(32,p.decals.length*32)),data=new Uint8Array(w*h*4);
 const set=(x:number,y:number,value=255)=>{if(x<0||x>=w||y<0||y>=h)return;const i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;};
 for(const [index,d]of p.decals.entries()){
  const chars=d.text.length,spacing=p.language==='vesper'?2:1,total=chars*(5+spacing)-spacing,scaleX=Math.max(1,Math.floor(440/total)),scaleY=3,startX=Math.floor((w-total*scaleX)/2),base=index*32+5;
  for(let c=0;c<chars;c++){const grid=(glyphs[d.text[c]]??glyphs[' ']).split('/');for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(grid[y][x]==='1')for(let sy=0;sy<scaleY;sy++)for(let sx=0;sx<scaleX;sx++)set(startX+(c*(5+spacing)+x)*scaleX+sx,base+(6-y)*scaleY+sy);}
  if(d.kind==='SHIPYARD'){ // Yard-specific geometric insignia, not a hue substitution.
   for(let y=7;y<25;y++)for(let x=6;x<26;x++){const dx=x-16,dy=y-16,on=p.language==='aegis'?Math.abs(dx)+Math.abs(dy)<9&&Math.abs(dx)+Math.abs(dy)>5:p.language==='vesper'?Math.abs(dx-dy*.6)<2:p.language==='forge'?Math.abs(dx)>6||Math.abs(dy)>6:Math.abs(dx)+Math.abs(dy)<6;if(on)set(x,index*32+y);}
  }
  if(d.kind==='HAZARD')for(let x=5;x<w-5;x++)if(Math.floor(x/12)%2===0)for(let y=1;y<3;y++)set(x,index*32+y);
 }
 const atlas=texture(data,w,h);atlas.anisotropy=8;grain.anisotropy=4;a={grain,atlas,refs:1,bytes:Math.ceil((g.byteLength+data.byteLength)*4/3)};cache.set(key,a);builds++;return {key,...a};
}
export function releaseSurfaceAssets(key:string){const a=cache.get(key);if(!a)return;if(--a.refs===0){a.grain.dispose();a.atlas.dispose();cache.delete(key);}}
export function surfaceAssetStats(){return{entries:cache.size,references:[...cache.values()].reduce((s,a)=>s+a.refs,0),allocatedTextureBytesIncludingMipmaps:[...cache.values()].reduce((s,a)=>s+a.bytes,0),builds,hits};}
