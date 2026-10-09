import{it,expect,afterEach,afterAll}from'vitest';
import{mkdirSync,writeFileSync}from'node:fs';
import{generateBlueprint,DEFAULT_ORDER}from'../src/generation/generate';
import{ROLES,PRIORITIES,type ShipOrder,type ArchitectureGrammar}from'../src/blueprint/types';
import{validateBlueprint}from'../src/validation/validate';
import{DesignRejection,spinalStructureIssues,ROLE_CAPABILITIES}from'../src/generation/production/requirements';
import type{MacroFamily}from'../src/generation/macro/types';
const base:ShipOrder={...DEFAULT_ORDER,length:300,massClass:'Standard',priorities:Object.fromEntries(PRIORITIES.map(p=>[p,50])) as ShipOrder['priorities']},cases:{experiment:string;label:string;order:ShipOrder;seed:number;architecture?:ArchitectureGrammar;family?:MacroFamily;mustGenerate?:boolean}[]=[],rows:any[]=[];
const add=(experiment:string,label:string,patch:Partial<ShipOrder>,seeds=[7,11,23],opts:Partial<typeof cases[number]>={})=>{for(const seed of seeds)cases.push({experiment,label,order:{...base,...patch},seed,...opts});};
for(const yard of['aegis','vesper','forge','serein'])add('A',`XL ${yard}`,{role:'Spinal Gun Ship',shipyardId:yard},[7,11,23,41],{mustGenerate:true});
for(const architecture of['MONOLITHIC','SPINE_AND_MODULES','HYBRID'] as const)for(const family of(architecture==='MONOLITHIC'?['WEAPON_DOMINANT']:['WEAPON_DOMINANT','SPLIT_FRAME']) as MacroFamily[])add('A',`${architecture}/${family}`,{role:'Spinal Gun Ship'},[7,23],{architecture,family,mustGenerate:true});
for(const role of ROLES)add('B',role,{role},undefined,{mustGenerate:true});
for(const length of[40,100,200,300,500,600])for(const massClass of['Light','Standard','Heavy','Superheavy'] as const)add('C',`XL ${length}m ${massClass}`,{role:'Spinal Gun Ship',length,massClass},[7,23],{mustGenerate:length>=200});
for(const length of[100,200,300,500,40,600])add('C',`Cruiser ${length}m`,{length});
for(const massClass of['Light','Standard','Heavy','Superheavy'] as const)add('C',`Cruiser ${massClass}`,{massClass});
for(const role of ROLES)for(const length of[40,600])add('C',`${role} boundary ${length}`,{role,length},[11]);
for(const priority of PRIORITIES)for(const level of[0,50,100])add('D',`${priority}=${level}`,{priorities:{...base.priorities,[priority]:level}},undefined,{mustGenerate:true});
for(const role of['Cruiser','Spinal Gun Ship','Missile Ship'] as const)for(const massClass of['Light','Superheavy'] as const)add('E',`${role} all100 ${massClass}`,{role,massClass,priorities:Object.fromEntries(PRIORITIES.map(p=>[p,100])) as ShipOrder['priorities']});
add('E','forced unsupported axial architecture',{role:'Spinal Gun Ship'},[11],{architecture:'CORE_AND_NACELLES',family:'ENGINE_DOMINANT'});
afterEach(async()=>{await new Promise(r=>setTimeout(r,0));});
it.each(cases)('requirements QA $experiment / $label / $seed',c=>{
 const start=performance.now();
 try{let timings:any;const b=generateBlueprint(c.order,c.seed,{architecture:c.architecture,family:c.family,onTimings:t=>timings=t}),d=b.designDoctrine!,r=b.designRequirements!,w=b.weaponLayout!;
  const counts=(field:'size'|'category',keys:string[])=>Object.fromEntries(keys.map(k=>[k,w.composition.filter(x=>x[field]===k).reduce((n,x)=>n+x.count,0)]));
  const row={...c,status:'released',architecture:b.architecture.grammar,family:b.macroDesign!.family,sizes:counts('size',['S','M','L','XL']),categories:counts('category',['CANNON','MISSILE','POINT_DEFENSE','SPINAL']),directions:w.budget.byRegion,requirements:r,targets:d.target,actual:d.actual,allocations:d.allocations,usage:d.usage,remaining:d.remaining,hosts:d.hosts,surfaces:d.directions,equipment:d.equipment,equipmentTargets:d.equipmentTargets,adjustments:d.adjustments,issues:validateBlueprint(b),timings,ms:performance.now()-start};rows.push(row);
  expect(row.issues).toEqual([]);expect(r.phase).toBe('RELEASED');expect(r.requirements.filter(x=>x.type==='MANDATORY').every(x=>x.status==='SATISFIED')).toBe(true);
  if(c.order.role==='Spinal Gun Ship'){expect(w.integrated).toHaveLength(1);expect(spinalStructureIssues(b)).toEqual([]);}
  if(c.order.role==='Missile Ship')expect(w.mounts.some(m=>m.category==='MISSILE')).toBe(true);
 }catch(e){if(rows.at(-1)?.label===c.label&&rows.at(-1)?.seed===c.seed&&rows.at(-1)?.experiment===c.experiment&&rows.at(-1)?.status==='released')throw e;
  rows.push({...c,status:'rejected',codes:e instanceof DesignRejection?e.codes:[],candidates:e instanceof DesignRejection?e.candidates:[],error:String(e),ms:performance.now()-start});expect(e).toBeInstanceOf(DesignRejection);expect((e as DesignRejection).codes.length).toBeGreaterThan(0);if(c.mustGenerate)throw e;
 }
},120000);
afterAll(()=>{mkdirSync('qa/v1.8.4.2',{recursive:true});writeFileSync('qa/v1.8.4.2/controlled-comparisons.json',JSON.stringify(rows,null,2));let md='# V1.8.4.2 Requirements-first 통제 실험\n\n개별 입력·예약 구획·후보 거절·필수/목표 판정·외장 설비·실제 원장은 controlled-comparisons.json에 보존한다. 예산 t/m³는 기존 설계 추정 계수이며, 에너지는 abstract-design-units로만 표시한다. 공간 예약은 원장 분야 안의 하위 배분이므로 합산하지 않는다.\n\n';
 for(const experiment of['A','B','C','D','E']){md+=`## ${experiment}\n\n| 입력 | Seed | 출고 / 거절 | Architecture / Family | S/M/L/XL | 함포/미사일/PD | T/B/P/S | Mandatory | 분야 체적 예약 m³ (구조/추진/장갑/무장/항속/센서) | 무장 표면 사용/배정 m² | 남은 질량/체적 | 사유 |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;for(const r of rows.filter(r=>r.experiment===experiment)){if(r.status==='rejected'){md+=`| ${r.label} | ${r.seed} | 거절 | — | — | — | — | 출고 없음 | — | — | — | ${[...new Set(r.codes)].join('; ')} |\n`;continue;}md+=`| ${r.label} | ${r.seed} | 출고 | ${r.architecture} / ${r.family} | ${Object.values(r.sizes).join('/')} | ${['CANNON','MISSILE','POINT_DEFENSE'].map(k=>r.categories[k]).join('/')} | ${Object.values(r.directions).join('/')} | ${r.requirements.requirements.filter((q:any)=>q.type==='MANDATORY').map((q:any)=>`${q.id}: ${q.status}`).join('; ')} | ${['structure','propulsion','armor','weapons','endurance','sensor'].map(k=>r.allocations[k].volumeM3.toFixed(0)).join('/')} | ${r.usage.weapons.surfaceM2.toFixed(0)}/${r.allocations.weapons.surfaceM2.toFixed(0)} | ${r.remaining.massTonnes.toFixed(0)}/${r.remaining.volumeM3.toFixed(0)} | ${r.adjustments.slice(0,2).map((a:any)=>a.reason).join('; ').replaceAll('|','/')} |\n`;}}
 writeFileSync('qa/v1.8.4.2/controlled-comparisons.md',md);
},120000);
