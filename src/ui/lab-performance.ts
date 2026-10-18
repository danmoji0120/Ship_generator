/** Optional runtime diagnostics, intentionally outside Blueprint and DamageInstance. */
export const laboratoryPerformance={enabled:false,stages:{}as Record<string,{ms:number;calls:number;maximumMs:number}>};
export function labTimed<T>(name:string,fn:()=>T):T{if(!laboratoryPerformance.enabled)return fn();const start=performance.now();try{return fn();}finally{const ms=performance.now()-start,s=laboratoryPerformance.stages[name]??={ms:0,calls:0,maximumMs:0};s.ms+=ms;s.calls++;s.maximumMs=Math.max(ms,s.maximumMs);}}
export function resetLaboratoryPerformance(){laboratoryPerformance.stages={};}
