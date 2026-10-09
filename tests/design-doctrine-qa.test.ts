import {it,expect,afterAll,afterEach} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {generateBlueprint as generateBaselineBlueprint,DEFAULT_ORDER} from '../src/generation/generate';
// Preserve the complete V1.8.4.1 regression contract; new requirements are tested separately.
const generateBlueprint=(...args:Parameters<typeof generateBaselineBlueprint>)=>generateBaselineBlueprint(args[0],args[1],{...args[2],version:args[2]?.version??'1.8.4.1'});
import {ROLES,PRIORITIES,type ShipOrder} from '../src/blueprint/types';
import {validateBlueprint} from '../src/validation/validate';
const base:ShipOrder={...DEFAULT_ORDER,priorities:Object.fromEntries(PRIORITIES.map(p=>[p,50])) as ShipOrder['priorities']};
const cases:{experiment:string;label:string;order:ShipOrder}[]=[];
const add=(experiment:string,label:string,patch:Partial<ShipOrder>)=>cases.push({experiment,label,order:{...base,...patch}});
for(const role of ROLES)add('A',role,{role});
for(const massClass of ['Light','Standard','Heavy','Superheavy'] as const)add('B',massClass,{massClass});
for(const length of [100,200,300,500])add('C',`${length}m`,{length});
for(const priority of PRIORITIES)for(const level of [10,50,90])add('D',`${priority}=${level}`,{priorities:{...base.priorities,[priority]:level}});
for(const priority of PRIORITIES)add('E',`high-${priority}`,{priorities:Object.fromEntries(PRIORITIES.map(p=>[p,p===priority?90:30])) as ShipOrder['priorities']});
add('E','all-high',{priorities:Object.fromEntries(PRIORITIES.map(p=>[p,100])) as ShipOrder['priorities']});
const seeds=[7,11,23],filter=process.env.DOCTRINE_QA_FILTER;const prior=(process.env.DOCTRINE_QA_OUT??'qa/v1.8.4.1')+'/controlled-comparisons.json';const rows:any[]=filter&&existsSync(prior)?JSON.parse(readFileSync(prior,'utf8')):[];
const record=(row:any)=>{const index=rows.findIndex(r=>r.experiment===row.experiment&&r.label===row.label&&r.seed===row.seed);if(index<0)rows.push(row);else rows[index]=row;};
afterEach(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
it.each(cases.filter(c=>!filter||new RegExp(filter).test(`${c.experiment}/${c.label}`)).flatMap(c=>seeds.map(seed=>({...c,seed}))))('controlled QA $experiment / $label / $seed',({experiment,label,order,seed})=>{
 const start=performance.now();try{
 const b=generateBlueprint(order,seed),d=b.designDoctrine!,w=b.weaponLayout!;
 const counts=(keys:string[],field:'size'|'category')=>Object.fromEntries(keys.map(k=>[k,w.composition.filter(c=>c[field]===k).reduce((n,c)=>n+c.count,0)]));
 const row={experiment,label,seed,order,status:'generated',family:b.macroDesign!.family,candidate:b.candidate,sizes:counts(['S','M','L','XL'],'size'),categories:{...counts(['CANNON','MISSILE','POINT_DEFENSE','SPINAL'],'category'),SENSOR:d.equipment.filter(e=>e.sector==='sensor').length},directions:w.budget.byRegion,total:d.total,allocations:d.allocations,usage:d.usage,equipment:d.equipment,equipmentTargets:d.equipmentTargets,functionalDecisions:b.productionDesign!.decisions.filter(a=>a.stage==='functional'),facilities:{engines:b.engines.length,engineCasings:d.equipment.filter(e=>e.sector==='propulsion').length,thermal:d.equipment.filter(e=>e.id.startsWith('thermal-')).length,service:d.equipment.filter(e=>e.id.startsWith('service-')).length},remaining:d.remaining,target:d.target,actual:d.actual,differences:d.differences,surfaces:d.directions,hosts:d.hosts,adjustments:d.adjustments,search:d.search,issues:validateBlueprint(b),ms:Math.round(performance.now()-start)};
 record(row);expect(row.issues).toEqual([]);expect(d.remaining.massTonnes).toBeGreaterThanOrEqual(-1e-6);expect(d.remaining.volumeM3).toBeGreaterThanOrEqual(-1e-6);
 }catch(e){record({experiment,label,seed,order,status:'rejected',error:String(e)});throw e;}
},120000);
afterAll(()=>{
 const path=process.env.DOCTRINE_QA_OUT??'qa/v1.8.4.1';mkdirSync(path,{recursive:true});writeFileSync(path+'/controlled-comparisons.json',JSON.stringify(rows,null,2));
 const avg=(rs:any[],get:(r:any)=>number)=>rs.reduce((n,r)=>n+get(r),0)/rs.length;
 const fmt=(n:number)=>n.toFixed(1),usage=(rs:any[],field:'massTonnes'|'volumeM3')=>['structure','propulsion','armor','weapons','endurance','sensor'].map(k=>fmt(avg(rs,r=>r.usage[k][field]))).join(' / ');
 let md='# V1.8.4.1 controlled design comparisons\n\nSeeds: 7, 11, 23. Default yard aegis, Cruiser, 300m, Standard, all priorities 50; only the stated input changes. Each row is the mean of successful designs, not a synthetic Blueprint. Full per-seed inputs, targets, actual counts, reservations, equipment solids, resource use, candidate/replan reasons and failures are in controlled-comparisons.json. Sensor counts are real SENSOR_HOUSING assemblies, not gun mounts.\n\nResource model: tonnes and cubic metres are engineering reservations including ammunition and maintenance, not an interior simulation. Surface figures include measured exposed eligible hull area and a 5×8-per-host/per-face coherent S-footprint sample estimate, capped below eligible area; every actual mount separately passes final-armor footprint/contact and clearance checks. Unused area does not guarantee a coherent mount or unobstructed firing arc. Structure/propulsion/endurance/sensor use is their committed internal reservation; external equipment solid volumes are recorded separately in JSON.\n\n';
 for(const experiment of ['A','B','C','D','E']){
 md+=`## ${experiment}\n\n| Input | Valid seeds | S/M/L/XL | Gun/Missile/PD/Sensor/Spinal | TOP/BOTTOM/PORT/STARBOARD | Resource use t (structure/propulsion/armor/weapons/endurance/sensor) | Resource use m³ (same order) | Weapon surface used / allocated / coherent / eligible m² | Weapon volume utilization | Main omissions / replacements |\n|---|---|---|---|---|---|---|---|---|---|\n`;
 for(const c of cases.filter(c=>c.experiment===experiment)){
  const all=rows.filter(r=>r.experiment===experiment&&r.label===c.label),rs=all.filter(r=>r.status==='generated');
  if(!rs.length){md+=`| ${c.label} | 0/${seeds.length} | — | — | — | — | — | — | — | ${all[0]?.error?.replaceAll('|','/')} |\n`;continue;}
  const sizes=['S','M','L','XL'].map(k=>fmt(avg(rs,r=>r.sizes[k]))).join(' / '),categories=['CANNON','MISSILE','POINT_DEFENSE','SENSOR','SPINAL'].map(k=>fmt(avg(rs,r=>r.categories[k]))).join(' / '),directions=['TOP','BOTTOM','PORT','STARBOARD'].map(k=>fmt(avg(rs,r=>r.directions[k]))).join(' / ');
  const reasons=[...new Set(rs.flatMap(r=>r.adjustments.map((a:any)=>a.reason.startsWith('Explicit replacement')?'standard-size group replacement':a.reason.startsWith('No coherent')?'coherent footprint / armor / firing clearance':a.reason.startsWith('Replanned')?'composition competition':a.reason.startsWith('XL')?'XL host envelope / doctrine':a.reason)))];
  md+=`| ${c.label} | ${rs.length}/${seeds.length} | ${sizes} | ${categories} | ${directions} | ${usage(rs,'massTonnes')} | ${usage(rs,'volumeM3')} | ${['usedM2','allocatedM2','coherentSupportM2','eligibleM2'].map(k=>fmt(avg(rs,r=>Object.values(r.surfaces).reduce((n:number,s:any)=>n+s[k],0) as number))).join(' / ')} (${fmt(avg(rs,r=>100*r.usage.weapons.surfaceM2/r.allocations.weapons.surfaceM2))}% of allocation) | ${fmt(avg(rs,r=>100*r.usage.weapons.volumeM3/r.allocations.weapons.volumeM3))}% | ${reasons.join('; ').replaceAll('|','/')} |\n`;
 }
 md+='\n| Input | Engine / casing / radiator / service counts | External engine protection t / m³ | External sensor t / m³ | External thermal / service t / m³ | Equipment omissions |\n|---|---|---|---|---|---|\n';
 for(const c of cases.filter(c=>c.experiment===experiment)){
  const rs=rows.filter(r=>r.experiment===experiment&&r.label===c.label&&r.status==='generated');if(!rs.length)continue;
  const facility=['engines','engineCasings','thermal','service'].map(k=>fmt(avg(rs,r=>r.facilities[k]))).join(' / ');
  const cost=(sector:string)=>['massTonnes','volumeM3'].map(field=>fmt(avg(rs,r=>r.equipment.filter((e:any)=>e.sector===sector).reduce((n:number,e:any)=>n+e.resources[field],0)))).join(' / ');
  md+=`| ${c.label} | ${facility} | ${cost('propulsion')} | ${cost('sensor')} | ${cost('endurance')} | ${[...new Set(rs.flatMap(r=>(r.equipmentTargets??[]).filter((e:any)=>e.missing).flatMap((e:any)=>e.reasons)))].join('; ').replaceAll('|','/')} |\n`;
 }
 md+='\n';
 }
 md+='## Independent priority sensitivity across seeds\n\nCounts can plateau or reverse when a different coherent whole-group layout wins. These cases are reported, not treated as evidence of success. Each seed delta below is high (90) minus low (10); mass and volume reservation changes should be read alongside actual count changes.\n\n| Priority | Per-seed actual gun / missile / PD / sensor deltas (seeds 7,11,23) | Per-seed weapon mass deltas t | Interpretation |\n|---|---|---|---|\n';
 for(const p of PRIORITIES){const comparisons=seeds.map(seed=>{const lo=rows.find(r=>r.experiment==='D'&&r.label===`${p}=10`&&r.seed===seed),hi=rows.find(r=>r.experiment==='D'&&r.label===`${p}=90`&&r.seed===seed);return lo?.status==='generated'&&hi?.status==='generated'?{lo,hi}:null;});
 const deltas=comparisons.map(pair=>pair?['CANNON','MISSILE','POINT_DEFENSE','SENSOR'].map(k=>pair.hi.categories[k]-pair.lo.categories[k]).join('/'):'rejected');
 const unchanged=comparisons.filter(pair=>pair&&['CANNON','MISSILE','POINT_DEFENSE','SENSOR'].every(k=>pair.lo.categories[k]===pair.hi.categories[k])).length;
 md+=`| ${p} | ${deltas.join(' · ')} | ${comparisons.map(pair=>pair?fmt(pair.hi.usage.weapons.massTonnes-pair.lo.usage.weapons.massTonnes):'rejected').join(' / ')} | ${unchanged?`${unchanged} seeds have unchanged counts: inspect target differences and rejected footprint/clearance candidates; resource allocation alone is not actual count sensitivity.`:'Actual count changes observed in every successful seed; consistency of direction must also be assessed.'} |\n`;
 }
 md+=`\nGenerated ${rows.filter(r=>r.status==='generated').length}/${rows.length} designs; rejected cases remain in the report.\n`;
 writeFileSync(path+'/controlled-comparisons.md',md);
},120000);
