/** Optional runtime-only timings; never serialized into deterministic shot/design data. */
let enabled=false;const profiles=new WeakMap<object,Record<string,{ms:number;calls:number}>>();
export const setDamageProfilingEnabled=(value:boolean)=>{enabled=value;};
export const damageProfile=(shot:object)=>profiles.get(shot);
export function timedDamage<T>(shot:object,name:string,fn:()=>T):T{if(!enabled)return fn();const start=performance.now();try{return fn();}finally{let p=profiles.get(shot);if(!p){p={};profiles.set(shot,p);}const entry=p[name]??={ms:0,calls:0};entry.ms+=performance.now()-start;entry.calls++;}}
