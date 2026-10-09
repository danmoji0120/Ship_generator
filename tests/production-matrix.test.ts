import{it,expect,afterEach}from'vitest';import{generateBlueprint as generateBaselineBlueprint,DEFAULT_ORDER}from'../src/generation/generate';import{ROLES}from'../src/blueprint/types';
// Preserve the complete V1.8.4.1 regression contract; new requirements are tested separately.
const generateBlueprint=(...args:Parameters<typeof generateBaselineBlueprint>)=>generateBaselineBlueprint(args[0],args[1],{...args[2],version:args[2]?.version??'1.8.4.1'});
// Let the runner flush RPC updates between bounded synchronous generation batches.
afterEach(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
const cases=['aegis','vesper','forge','serein'].flatMap(shipyardId=>ROLES.flatMap(role=>[40,300,600].map(length=>({shipyardId,role,length}))));
it.each(cases)('supports $shipyardId / $role / $length m without review templates',({shipyardId,role,length})=>{
 {const b=generateBlueprint({...DEFAULT_ORDER,shipyardId,role,length},11);expect(b.productionDesign?.status).toBe('generated');expect(b.hardpoints.length).toBeGreaterThan(0);}
},120000);
const extremes=['aegis','vesper','forge','serein'].flatMap(shipyardId=>[40,600].flatMap(length=>[0,100].map(level=>({shipyardId,length,level}))));
it.each(extremes)('handles priority/mass extremes $shipyardId / $length m / $level with explicit physical failure',({shipyardId,length,level})=>{
 const order={...DEFAULT_ORDER,shipyardId,length,massClass:level===0?'Light' as const:'Superheavy' as const,priorities:Object.fromEntries(Object.keys(DEFAULT_ORDER.priorities).map(k=>[k,level])) as typeof DEFAULT_ORDER.priorities};
 let b;try{b=generateBlueprint(order,41);}catch(e){
  // A 40m Light hull may have no standard-size weapon left after finite reservations.
  // The improved planner may also find a legal fallback where V1.8.4 rejected it.
  if(length!==40||level!==0)throw e;expect(String(e)).toMatch(/rejected after 3 candidates.*no physically installable complete group/);return;
 }expect(b.productionDesign!.status).toBe('generated');expect(b.weaponLayout!.budget.allocated).toBeLessThanOrEqual(b.weaponLayout!.budget.available);
},120000);
