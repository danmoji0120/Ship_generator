import{it,expect,afterEach}from'vitest';import{generateBlueprint,DEFAULT_ORDER}from'../src/generation/generate';import{ROLES}from'../src/blueprint/types';
// Let the runner flush RPC updates between bounded synchronous generation batches.
afterEach(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
const cases=['aegis','vesper','forge','serein'].flatMap(shipyardId=>ROLES.map(role=>({shipyardId,role})));
it.each(cases)('supports $shipyardId / $role at 40, 300 and 600m without review templates',({shipyardId,role})=>{
 for(const length of[40,300,600]){const b=generateBlueprint({...DEFAULT_ORDER,shipyardId,role,length},11);expect(b.productionDesign?.status).toBe('generated');expect(b.hardpoints.length).toBeGreaterThan(0);}
},120000);
const extremes=['aegis','vesper','forge','serein'].flatMap(shipyardId=>[40,600].flatMap(length=>[0,100].map(level=>({shipyardId,length,level}))));
it.each(extremes)('handles priority/mass extremes $shipyardId / $length m / $level with explicit physical failure',({shipyardId,length,level})=>{
 const order={...DEFAULT_ORDER,shipyardId,length,massClass:level===0?'Light' as const:'Superheavy' as const,priorities:Object.fromEntries(Object.keys(DEFAULT_ORDER.priorities).map(k=>[k,level])) as typeof DEFAULT_ORDER.priorities};
 if(shipyardId==='aegis'&&length===40&&level===0){expect(()=>generateBlueprint(order,41)).toThrow(/rejected after 3 candidates.*no physically installable complete group/);return;}
 const b=generateBlueprint(order,41);expect(b.productionDesign!.status).toBe('generated');expect(b.weaponLayout!.budget.allocated).toBeLessThanOrEqual(b.weaponLayout!.budget.available);
},120000);
