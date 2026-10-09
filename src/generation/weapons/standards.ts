import type{MountSize,MountStandard}from'./types';
/** Installation area, equipment envelope and category are independent contracts, in meters. */
export const MOUNT_STANDARDS:Record<MountSize,MountStandard>={
 S:{size:'S',mode:'SURFACE',footprint:{width:4.5,length:5.5},envelope:{width:5,height:6,length:8},foundationHeight:.65,cost:1},
 M:{size:'M',mode:'SURFACE',footprint:{width:11.5,length:13},envelope:{width:13,height:19,length:22},foundationHeight:1.4,cost:3},
 L:{size:'L',mode:'SURFACE',footprint:{width:26,length:30},envelope:{width:27,height:16,length:43},foundationHeight:2.4,cost:8},
 XL:{size:'XL',mode:'HULL_INTEGRATED',footprint:{width:45,length:75},envelope:{width:45,height:30,length:105},foundationHeight:0,cost:18},
};
export function mountStandard(size:MountSize,length=300):MountStandard{
 if(!Number.isFinite(length)||length<=0)throw Error('Invalid ship scale');
 const s=structuredClone(MOUNT_STANDARDS[size]),scale=Math.max(.65,Math.min(2,Math.cbrt(length/300)));
 for(const d of[s.footprint,s.envelope])for(const k of Object.keys(d)as (keyof typeof d)[])d[k]*=scale;
 s.foundationHeight*=scale;return s;
}
