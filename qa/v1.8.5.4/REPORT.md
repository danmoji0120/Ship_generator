# V1.8.5.4 — 구현 및 선택 QA 결과

## 원인과 변경

기존 Production 경로는 `architecture/equipment.ts`에서 통합 척추 장착점만 남긴 뒤 `production/weapons.ts`에서 실제 설치한 무장당 하드포인트 하나씩 다시 생성했다. 따라서 무장 예산·배치 제한이 빈 장착 용량까지 제한했다. 주 설치 부모 위주 탐색, 카테고리별 최대 8그룹 및 제한된 길이 방향 후보도 구성의 병목이었다. 해당 상수나 무장 수를 증폭하지 않고, 완성된 실제 구조에 별도의 빈 설치 용량을 준비하는 단계로 분리했다.

새 단계는 기존 17접촉 Foundation, 실제 Hull/Armor 삼각형, 내장 지원 포켓, 장비 Envelope와 OBB 충돌, 설치된 무장의 Clearance, 엔진/개구부/센서/정비 접근을 검증한다. 구조·장갑·Meso·외장·기존 장비는 수정하지 않는다. 내부 포켓은 기존 구조 예산의 하위 예약이며 전력 인덱스는 추상 인터페이스다. 실제 원자로·탄약·전력망이 완성됐다는 의미가 아니다.

S/M/L/XL의 기존 물리 규격 및 스케일을 유지한다. 크기와 6개 호환 유형, 복합 모듈 구성요소 수는 별도다. 작은 장비도 실제 외형·공간·유형·내부 자원·방향 조건이 맞아야 큰 슬롯에 들어간다. 표면 XL과 통합 SPINAL은 다른 계약이다.

## 대표 8척 — 같은 주문서와 Seed의 비교

STANDARD 밀도. 설치된 실제 무장 수는 각 사례에서 Before/After 동일하다.

| Architecture / 길이 / Yard / Seed | Before → After | 빈 슬롯 | 무장 | S/M/L/XL | TOP/BOTTOM/PORT/STARBOARD/FORE/AFT |
|---|---:|---:|---:|---|---|
| MONOLITHIC / 80m / aegis / 7 | 16 → 22 | 6 | 16 | 22/0/0/0 | 8/10/2/2/0/0 |
| BLOCK_ASSEMBLY / 500m / forge / 7 | 15 → 215 | 200 | 15 | 150/53/12/0 | 74/100/14/14/5/8 |
| SPINE_AND_MODULES / 300m / serein / 7 | 10 → 101 | 91 | 10 | 87/13/0/1 | 43/43/5/5/2/3 |
| TRUSS_POD / 300m / vesper / 7 | 10 → 93 | 83 | 10 | 77/15/1/0 | 39/25/12/8/4/5 |
| TWIN_HULL / 400m / forge / 11 | 18 → 131 | 113 | 18 | 103/23/5/0 | 20/33/44/26/3/5 |
| CORE_AND_NACELLES / 200m / vesper / 7 | 6 → 57 | 51 | 6 | 47/10/0/0 | 18/15/8/12/1/3 |
| STACKED_BLOCKS / 300m / aegis / 7 | 15 → 114 | 99 | 15 | 81/32/1/0 | 43/53/9/9/0/0 |
| HYBRID / 300m / serein / 11 | 5 → 93 | 88 | 5 | 89/4/0/0 | 41/40/1/1/6/4 |

| Architecture | TURRET | FIXED | MISSILE | SPINAL | UTILITY | DEFENSIVE |
|---|---:|---:|---:|---:|---:|---:|
| MONOLITHIC | 8 | 2 | 6 | 0 | 2 | 8 |
| BLOCK_ASSEMBLY | 112 | 59 | 59 | 0 | 47 | 113 |
| SPINE_AND_MODULES | 48 | 22 | 24 | 1 | 23 | 51 |
| TRUSS_POD | 44 | 21 | 23 | 0 | 21 | 48 |
| TWIN_HULL | 63 | 32 | 34 | 0 | 27 | 71 |
| CORE_AND_NACELLES | 27 | 13 | 13 | 0 | 13 | 29 |
| STACKED_BLOCKS | 54 | 25 | 27 | 0 | 25 | 57 |
| HYBRID | 45 | 22 | 22 | 0 | 22 | 48 |

유형은 호환 태그이므로 합산하면 슬롯 수보다 크다. 500m 전함의 215개는 초기 100~200 튜닝 범위를 약간 넘지만 실제 유효 표면에 따른 연속 규모 산정 결과다. 대형함의 S/M 비중을 유지하며 L이 설치 가능한 표면에만 남는다. CORE_AND_NACELLES 및 HYBRID 대표 사례에는 L/XL 빈 슬롯을 억지로 추가하지 않았다.

## 밀도·주문서·규격

같은 STACKED_BLOCKS / Aegis / Cruiser / 300m / Seed 7:

| Density | Total | Empty | S/M/L/XL | 슬롯 계획 ms | 슬롯 검증 ms |
|---|---:|---:|---|---:|---:|
| SPARSE | 68 | 53 | 46/21/1/0 | 964 | 465 |
| STANDARD | 114 | 99 | 81/32/1/0 | 1374 | 550 |
| DENSE | 171 | 156 | 125/43/3/0 | 1567 | 277 |

- 필수 UTILITY / S / TOP / 4개: 충족, 서로 다른 슬롯 ID 4개.
- 선호 SPINAL / XL / 4개를 일반 순양함에 요청: 0개 충족 / 4개 미달 기록.
- 같은 주문을 필수로 변경: `REQUIRED_HARDPOINT_CAPACITY_UNAVAILABLE`, 출고 거절.
- 실제 XL 1개가 있는 척추무장함에 필수 XL 4개 요청: 1개 충족 / 3개 누락을 명시하고 거절. 규격 축소 및 임의 장착점 추가 없음.
- 500m BLOCK_ASSEMBLY 전함의 추가 표면 TURRET / XL / 1개 선호: 0개, 미달. XL 후보 57개에서 일관된 설치 면적 부족 36개, 일관된 전후면 Footprint 부재 19개, 노출 표면 부재 2개가 발생했다(요청 없는 동일 결과의 진단과 차이 비교). 기존 장갑을 제거하거나 Hull을 개조하지 않았다.
- 실제 평평한 삼각형 선체를 사용하는 격리 Geometry 단위 사례에서 XL 표면 슬롯의 17접촉/Envelope/내부 포켓을 검증하고 S 복합 미사일 모듈(구성요소 8개) 호환을 확인했다. 이 단위 사례는 출고 가능한 Production 함선의 성공 사례로 집계하지 않는다. SPINAL 유형, 과대 Footprint, 반대 설치 방향은 거절된다.

## 물리·시각·결정성

8개 대표 Architecture와 4개 조선소의 현재 Blueprint 검증 오류 0개. 기존 구조/장갑/엔진/접합/Meso/외장/설치 무장 데이터 비교가 8/8 일치했고, 동일 카메라·같은 렌더러의 Normal 이미지 픽셀이 8/8 완전히 일치했다. 슬롯 증가는 Debug에서만 보이며 Production 실루엣을 바꾸지 않는다.

추가 Seed 12~21의 10척(300m Frigate, 8개 Architecture와 4개 Yard 순환)을 생성·렌더링했다. 모두 유효한 93개 슬롯을 확보했고 오류 0개, 슬롯 계층 재계획 JSON 일치 10/10이다. 이는 동일 함급 목표 개수를 달성한 결과이며 배치 좌표·부모·면별/규격 분포는 서로 다르다. 선택된 Architecture/Family는 저장 JSON에 확인했으며 샘플을 성공 Seed로 교체하지 않았다. 동일 주문서 전체 Production 재생성 JSON 일치는 별도 Seed 7 STACKED_BLOCKS 통합 자동 테스트에서 확인한다. 대규모 무작위 실험이나 다른 JS 런타임 간 문자열 동일성을 검증한 것은 아니다.

일반 사선 Before/After 8쌍, 추가 10개 Seed 사선, 밀도 3종, 대형/STACKED_BLOCKS 측면·하부를 확인했다. Debug 마커는 반대편도 보이는 x-ray 표시이며 공간 유효성은 실제 Geometry 검사가 판정한다. 실제 캔버스 클릭→InstancedMesh Raycast→선택 콜백도 확인했다.

- [Before / After 8척 이미지](before-after-hardpoints.jpg)
- [추가 Seed 10개](additional-seeds.jpg)
- [대형함 하부](controls/large-blocks-underside.png)
- [STACKED_BLOCKS 측면](controls/stacked-blocks-side.png)
- [일반 Production 외형](after/large-blocks-Normal.png)
- [밀도·요청·마커 선택 원본 결과](controls/)

## 성능

동일 환경 Chromium/SwiftShader의 사례별 단일 측정이다. 통계적 벤치마크가 아니며 JIT/CPU 부하의 영향을 받는다. 생성 ms에는 신규 슬롯 계획 및 그 출고 검증이 포함되고 별도 캡처는 제외한다.

| Architecture | 기존 ms | 신규 ms | 증분 | Normal Draw Calls | Debug Draw Calls 기존 → 신규 |
|---|---:|---:|---:|---:|---:|
| MONOLITHIC | 2391 | 3202 | 34% | 23 (동일) | 100 → 9 |
| BLOCK_ASSEMBLY | 6957 | 11020 | 58% | 50 (동일) | 92 → 22 |
| SPINE_AND_MODULES | 3660 | 5214 | 42% | 66 (동일) | 84 → 31 |
| TRUSS_POD | 12149 | 12688 | 4% | 135 (동일) | 151 → 98 |
| TWIN_HULL | 4883 | 5990 | 23% | 92 (동일) | 153 → 60 |
| CORE_AND_NACELLES | 4688 | 5518 | 18% | 68 (동일) | 51 → 26 |
| STACKED_BLOCKS | 2750 | 3992 | 45% | 31 (동일) | 91 → 13 |
| HYBRID | 3809 | 4794 | 26% | 101 (동일) | 86 → 66 |

렌더링 마커는 유형별 최대 6개 InstancedMesh + 방향 LineSegments 1개로 묶는다. 기존 하드포인트마다 생성하던 여러 Debug 메시를 교체하여 슬롯이 크게 늘어도 Debug Draw Call은 감소했다. Normal Draw Call/삼각형 수는 8/8 동일하다. 프레임레이트/GPU 실기기 벤치마크는 수행하지 않았다.

BVH와 공간 셀 인덱스, 최대 512 슬롯 및 18,000 후보 제한으로 무제한 후보 간 전수 비교를 피한다. 다만 500m 대표는 6.96s→11.02s(+58%)로 의미 있는 생성 비용 증가가 있다. 기존 표면 삼각형·접촉 탐색의 추가 비용이며 차후 표면별 Ray 질의 가속이 필요하다. 이를 성능 비용이 없는 개선으로 보고하지 않는다. TRUSS 최초 After 측정은 병렬 테스트/렌더러 부하에서 19.66s였고, 최종 격리 실행은 12.69s(기존 12.15s)였다.

## 실행한 검증

- `npx vitest run tests/modular-hardpoints.test.ts`: 관련 1파일 / 8개 테스트 통과. 이후 전체 생성 결정성 assertion을 같은 통합 테스트에 추가해 그 1개만 재실행.
- `npm run build`: TypeScript `tsc --noEmit` 및 Production Vite Build 통과. 기존 대형 번들 경고(500kB 초과)는 남아 있다.
- 대표 Before/After 8쌍 + 추가 10개 Seed: 전체 Blueprint 물리 검증 오류 0개. 이는 테스트 스위트 전체 실행이 아니라 변경된 공통 슬롯 계층의 대표 검증이다.
- 밀도 3종, 필수/선호 요청, 표면 XL 미달, 실제 마커 선택: 통과.
- Production 빌드의 슬롯 관련 UI·Export/Import·과거 데이터 검증: 14개 확인 항목 통과, Console 오류 0개. `ui/report.json`에 결과 저장.
- 브라우저 Console 오류: 저장된 대표/추가 Seed/밀도 결과에서 0개. Production UI에서도 0개, 별도 `ui/report.json` 참조.

**600개 이상의 전체 테스트, 전체 Production UI 회귀, 역사적 Blueprint 전체 픽셀 회귀, 전체 조합 및 combat-demo 테스트는 실행하지 않았다.** 기존 테스트·QA 결과를 삭제하거나 판정 기준을 약화하지 않았다. 과거 schemaVersion 2 대표 파일을 import/reload 시 새 교리로 자동 재작성하지 않는다.

초기 개발 중 실제 실패도 있었다: Foundation 재검증에서 힌트 좌표 대신 측정 접촉 중심을 사용해야 하는 문제, float 문자열의 과도한 완전 비교, 신규 generatorVersion 허용 목록 누락을 수정했다. Production UI 첫 실행은 닫힌 요구사항 상세를 열지 않은 자동화 스크립트의 타임아웃이었고, 사용자와 같은 펼치기 조작을 추가했다(`logs/ui-initial-harness-failure.log`). 두 번째 UI 실행에서는 파일 읽기 완료 전에 과거 Import 판정이 진행되는 대기 조건 오류가 발생해, 실제 JSON 일치까지 기다리도록 수정했다(`logs/ui-import-wait-race.log`). 수정 후 관련 검증을 재실행해 통과했다.

## 남은 제한

1. 대표 500m 전함에서도 추가 표면 XL 용량은 확보되지 않았다. 실제 척추 XL은 유지되지만 일반 표면 XL의 광범위한 성공을 보장하지 않는다. 기존 Hull/장갑 보존 조건을 우회하지 않는다.
2. 자동 정책은 S/M 및 유효한 L 여유를 우선하고 표면 XL은 요청이 있을 때 탐색한다. 모든 함선에서 모든 규격 비율을 고정 보장하지 않는다.
3. 지원 포켓과 인터페이스 예약은 실제 설치 가능성의 기하학적 계약이다. 실제 장비 교체 UI, 전력/탄약 공급, 상세 내부 장비 패킹 또는 복합 무기의 게임플레이는 구현하지 않았다. 구체적인 장비 설치 시 기존 실제 무장 충돌·사격 규칙을 다시 적용해야 한다.
4. 요구 슬롯이 부족해도 이 버전은 Hull을 다시 설계하거나 개구부를 만들지 않는다. 필수 주문을 구체적으로 거절한다. 엔진/보호 구역 일부는 보수적 영역으로 제외하여 사용 가능한 공간을 과소평가할 수 있다.
5. 빈 슬롯은 미래 설치 용량으로 개별 예약한다. 장착 시 최종 모듈 Envelope가 달라지는 상황은 향후 실제 조립 단계가 처리해야 한다.
6. 생성 시간 증가, 특히 대형함 비용은 남은 최적화 과제다. 슬롯 수와 렌더링은 제한·배치 처리했으나 동일 생성 시간을 보장하지 않는다.

## 변경 파일과 Git

- `src/generation/hardpoint-system/{types,compatibility,geometry,planner,validate}.ts`: 주문 정규화, 설치 계약, 실제 표면/공간 예약, 요구 배정, 권위 데이터 재검증.
- `src/generation/generate.ts`, `src/blueprint/types.ts`, Production/무장/Blueprint validator: 최소 통합과 구/신규 버전 분기.
- `src/rendering/modular-hardpoints.ts`, `ship.ts`, `viewer.ts`: Debug 배치/선택 및 GPU 자원 정리; Production 외형 보존.
- `src/ui/hardpoints.ts`, `layout.ts`, `main.ts`, `style.css`: 밀도·요구 편집과 요약/선택 Inspector.
- package 버전 1.8.5.4; 의존성 변경 없음. 관련 테스트·브라우저 스크립트·보고서·QA 이미지/JSON 추가.
- 작업 시작 HEAD `3c37c95` / branch `work`. 기존 STACKED_BLOCKS 작업과 combat-demo는 보존했다. 새 작업은 독립된 로컬 커밋으로 저장하며 정확한 SHA는 최종 응답에 제공한다. 이번 요청에서는 원격 Push/Force Push를 하지 않는다.
