import {readFileSync,writeFileSync} from 'node:fs';
const dir='qa/v1.8.4.1',rows=JSON.parse(readFileSync(`${dir}/controlled-comparisons.json`,'utf8')),seeds=[7,11,23];
const keys=['CANNON','MISSILE','POINT_DEFENSE','SENSOR'],weights={S:1,M:3,L:8,XL:18};
const gunInvestment=r=>r.actual.filter(c=>c.category==='CANNON'||c.category==='SPINAL').reduce((n,c)=>n+weights[c.size]*c.count,0);
const maintenance=r=>r.facilities.thermal+r.facilities.service;
const definitions={firepower:{sector:'weapons',label:'함포 규격 투자 지수 (S=1/M=3/L=8/XL=18)',metric:gunInvestment},missile:{sector:'weapons',label:'실제 발사기 수',metric:r=>r.categories.MISSILE},survivability:{sector:'armor',label:'실제 근접방어 수',metric:r=>r.categories.POINT_DEFENSE},mobility:{sector:'propulsion',label:'함선 질량 한도 대비 실제 무장 질량 % (감소 목표)',metric:r=>r.usage.weapons.massTonnes/r.total.massTonnes*100,sign:-1},endurance:{sector:'endurance',label:'실제 방열/정비 조립체 수',metric:maintenance},sensor:{sector:'sensor',label:'실제 센서 조립체 수',metric:r=>r.categories.SENSOR}};
const result={seeds,comparisons:[],plateaus:[],spinal:[],allHigh:[],rejected:rows.filter(r=>r.status!=='generated')};
let md='# V1.8.4.1 — 여러 Seed 설계 경향 판정\n\n전체 A–E 수량·방향·자원·설비 비용 표는 [controlled-comparisons.md](controlled-comparisons.md), Seed별 목표/실제/생략 기록은 [원자료](controlled-comparisons.json)에 있다. 이 판정은 성공한 단일 Seed를 선택하지 않고 Seed 7·11·23의 동일 입력 쌍을 모두 비교한다. 예산은 예약 모델이고, 외장 설비의 실제 고체 비용은 별도다.\n\n';
md+='| 우선순위 10 → 90 | 경쟁 예산 분야 | 예산 비중 변화 %p (Seed 7 / 11 / 23) | 실제 관측 지표 | 실제 지표 변화 (같은 순서) | 기대 방향 관측 |\n|---|---|---|---|---|---|\n';
for(const [priority,d] of Object.entries(definitions)){
 const comparisons=seeds.map(seed=>{
  const lo=rows.find(r=>r.experiment==='D'&&r.label===`${priority}=10`&&r.seed===seed),hi=rows.find(r=>r.experiment==='D'&&r.label===`${priority}=90`&&r.seed===seed);
  if(lo?.status!=='generated'||hi?.status!=='generated')return {seed,rejected:true};
  const budgetDelta=100*(hi.allocations[d.sector].massTonnes/hi.total.massTonnes-lo.allocations[d.sector].massTonnes/lo.total.massTonnes),actualDelta=d.metric(hi)-d.metric(lo),countsUnchanged=keys.every(k=>hi.categories[k]===lo.categories[k]);
  if(countsUnchanged)result.plateaus.push({priority,seed,counts:hi.categories,targetLow:lo.target,targetHigh:hi.target,weaponMassLow:lo.usage.weapons.massTonnes,weaponMassHigh:hi.usage.weapons.massTonnes,equipmentLow:lo.facilities,equipmentHigh:hi.facilities,highDifferences:hi.differences,highReasons:hi.adjustments});
  return {seed,budgetDelta,actualLow:d.metric(lo),actualHigh:d.metric(hi),actualDelta,expectedDirection:actualDelta*(d.sign??1)>1e-6,countsUnchanged};
 });
 const successful=comparisons.filter(c=>!c.rejected),positive=successful.filter(c=>c.expectedDirection).length;
 result.comparisons.push({priority,metric:d.label,comparisons,positive,consistent:positive>=2&&successful.length===3});
 md+=`| ${priority} | ${d.sector} | ${comparisons.map(c=>c.rejected?'거부':c.budgetDelta.toFixed(2)).join(' / ')} | ${d.label} | ${comparisons.map(c=>c.rejected?'거부':c.actualDelta.toFixed(2)).join(' / ')} | ${positive}/3 Seed |\n`;
}
md+='\n함포 투자 지수는 실제 규격별 수량의 비교용 지표이며 피해량 시뮬레이션이 아니다. Mobility는 실제 무장 질량 비중 감소를 판정하므로 총 무장 개수가 반드시 줄어야 한다고 가정하지 않는다. Endurance는 실제 방열·정비 설비와 연료/운용 예약을 함께 본다.\n\n## 수량이 그대로인 경우\n\n';
if(!result.plateaus.length)md+='세 Seed 모두 독립 우선순위 변경에서 범주 수량 변화가 관측됐다.\n';
for(const r of result.plateaus){
 md+=`- **${r.priority}, Seed ${r.seed}:** 함포/미사일/PD/센서 수량이 그대로다. 실제 무장 질량은 ${r.weaponMassLow.toFixed(0)} → ${r.weaponMassHigh.toFixed(0)} t, 방열/정비 조립체는 ${r.equipmentLow.thermal+r.equipmentLow.service} → ${r.equipmentHigh.thermal+r.equipmentHigh.service}개다. 수량 민감도가 검증된 것으로 계산하지 않았다. 높은 우선순위 설계의 목표 미달과 공간·사격·자원 제약: ${[...new Set(r.highReasons.map(a=>a.reason))].join('; ')}\n`;
}
md+='\n## XL 목표의 물리적 제한\n\n';
for(const seed of seeds){const r=rows.find(r=>r.experiment==='A'&&r.label==='Spinal Gun Ship'&&r.seed===seed);if(!r||r.status!=='generated')continue;const target=r.target.filter(t=>t.size==='XL').reduce((n,t)=>n+t.count,0),actual=r.sizes.XL,entry={seed,target,actual,reasons:r.adjustments.filter(a=>a.reason.startsWith('XL omitted'))};result.spinal.push(entry);md+=`- Seed ${seed}: XL 목표 ${target}, 실제 ${actual}. ${entry.reasons.map(a=>a.reason).join('; ')}\n`;}
if(result.spinal.some(r=>r.actual<r.target))md+='\n이 입력에서는 축무장 임무 목표가 미달이다. 방어/보조 구성의 차이는 관측되지만 이를 XL 교리의 실제 설치 성공으로 주장하지 않는다. 기존 Macro의 축 구조물·개구부가 변경하지 않은 XL 규격을 수용하지 못하면 생략한다. 표준 규격을 축소하거나 설치되지 않은 축무장을 집계하지 않는다. 충분한 사각 축 구조물과 자원 예산에서는 XL 수용 계약의 양성 검사가 통과한다.\n';
md+='\n## 모든 우선순위가 높은 경우\n\n| Seed | 전체 질량 / 체적 한도 t / m³ | 실제 예약/무장/장갑 사용 t / m³ | 남은 t / m³ | 한도 준수 |\n|---|---|---|---|---|\n';
for(const seed of seeds){const r=rows.find(r=>r.experiment==='E'&&r.label==='all-high'&&r.seed===seed);if(r?.status!=='generated')continue;const mass=Object.values(r.usage).reduce((n,s)=>n+s.massTonnes,0),volume=Object.values(r.usage).reduce((n,s)=>n+s.volumeM3,0),within=mass<=r.total.massTonnes+1e-6&&volume<=r.total.volumeM3+1e-6;result.allHigh.push({seed,mass,volume,total:r.total,within,adjustments:r.adjustments});md+=`| ${seed} | ${r.total.massTonnes.toFixed(0)} / ${r.total.volumeM3.toFixed(0)} | ${mass.toFixed(0)} / ${volume.toFixed(0)} | ${r.remaining.massTonnes.toFixed(0)} / ${r.remaining.volumeM3.toFixed(0)} | ${within?'통과':'초과'} |\n`;}
md+=`\n전체 ${rows.length}개 통제 입력 중 ${rows.filter(r=>r.status==='generated').length}개 생성, ${result.rejected.length}개 거부. 조정 기록 resources는 경쟁 수요 정규화, armor는 보존된 장갑 비용과 무장 예산의 절충을 설명한다.\n`;
writeFileSync(`${dir}/sensitivity.json`,JSON.stringify(result,null,2));writeFileSync(`${dir}/sensitivity.md`,md);
console.log(JSON.stringify({cases:rows.length,generated:rows.length-result.rejected.length,consistentPriorities:result.comparisons.filter(c=>c.consistent).map(c=>c.priority),plateaus:result.plateaus.map(r=>({priority:r.priority,seed:r.seed})),unmetXL:result.spinal.filter(r=>r.actual<r.target).length}));
