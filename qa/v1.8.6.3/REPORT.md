# V1.8.6.3 Functional Internal Systems — QA

Base: `17832b27bf93e15c747de26717a6101fc05dd76c` / `feature/v1.8.6.2.1`.
Worktree: `/workspace/shipyard-v1.8.6.3`, branch `feature/v1.8.6.3`.
Final SHA: completion response and `git log -1`. Local commit only; no Push/Force Push.
Original worktrees, earlier QA and combat-demo are preserved.

## 실제 구현 / 데이터 계약

[`src/systems/README.md`](../../src/systems/README.md)에 API·단위·알고리즘·근사 범위를 기록했다. Registry 8종: POWER_GENERATOR, POWER_DISTRIBUTION, ENERGY_STORAGE, COMMAND_CONTROL, PROPULSION_CONTROL, MANEUVER_CONTROL, FIRE_CONTROL, SENSOR_PROCESSING. 실제 구획/부모 구조, OBB, .2m clearance, 재질, 건조 질량, 안정 ID, 전력·제어 연결, 기존 Engine/RCS 참조를 갖는다. 외부 엔진·공격 무장·전투 센서를 새로 생성하지 않는다.

초기 게임 사양이며 검증된 공학 데이터가 아니다. 발전기 120MW / 18,000kg / 3×3×5m, 배전기 100MW / 2,200kg. 지휘 2MW / 1,000kg, 추진 제어 15MW / 1,300kg, 자세 제어 6MW / 800kg, 사격통제 5MW / 900kg / 8채널, 센서 처리 4MW / 700kg / 8채널. 소형 장치 OBB는 1.2×1.5×2m. ENDURANCE 저장 장치 180MJ / 최대12MW / 3,000kg씩 두 개. 전력 MW × 시간 s = 에너지 MJ. Envelope는 균질 금속 덩어리가 아니며 설비 건조 질량은 내부 기계 부품을 포함한 명시적 사양이다.

MOBILITY 패키지는 경합금 casing, 건조 질량 .72배, 제조 비용 지수 1.25배인 명시적 설비 variant다. 임의의 가속도 보너스가 아니다. ECONOMY는 표준화 설비 비용 지수 .8배와 낮은 80MW 발전기 사양을 쓴다. 비용은 실제 설치 사양 kg × 설비 제조 지수 × 기존 Yard process factor로 계산하며 실제 화폐/시장 가격이 아니다.

## 실제 공간 / Architecture

기존 유한 CSG 구획 및 OBB query를 사용했다. Frame·외피·Connector·Core·Bulkhead와의 겹침, Hull 외부 돌출, 설비 간 겹침을 거절한다. 확정된 경계가 없는 구획, SPINE 미확정 stock, 노출 트러스에는 배치하지 않는다. 기존 벽이나 개구부를 제거하지 않는다. 후보/offset 탐색은 결정적이며 제한적이므로 후보가 없다는 것이 모든 packing의 수학적 불가능성 증명은 아니다. 필수 배치 실패는 `REQUIRED_FUNCTIONAL_SPACE_UNAVAILABLE` 등 구체적 사유로 거절된다.

12개 고정 .2.1 설계의 additive builder/validator 감사와, 실제 Production UI의 전체 신규 Generate는 구분해 수행했다. 전자는 같은 Node 환경에서 기존 compartments, Frame, Hull/Armor, engine, prefab, 벽·개구부·접근·압력 데이터를 정확히 보존했다. 전체 내부 census, 일부 SPINE 외피, 기존 0m³ 실제 Residual Recovery와 Node/Chromium 차이를 해결했다고 주장하지 않는다.

MONOLITHIC: 연속 bay 분산. BLOCK: 실제 block별 서비스. SPINE: 실제 module만 사용. TRUSS: 포드/Core 분산, lattice에 설치하지 않음. TWIN: 좌우 독립 plant 위치. CORE: 실제 Core/Nacelle 공간, solid connector 제외. STACKED: 실제 deck 구획. HYBRID: 여러 실제 host에 분산. 모든 함종에 같은 중앙 reactor 위치를 강제하지 않는다.

## 전력 / 제어 / 기능

전력은 deterministic residual flow로 계산한다. 발전기/edge 한도와 배전 vertex 처리 한도를 모두 지키며, 루프와 crossfeed가 전력을 중복 생성하지 않는다. 지휘→추진→자세→기타 처리기→외부 부하 순으로 전력을 배분한다. 발전을 먼저 사용하고 예비 저장은 남은 수요에 사용한다. 저장 전력은 최대 출력과 현재 MJ/평가 간격으로 제한한다. 충·방전 동시 수행 없이 실제 연결된 전력 경로로만 충전한다. 과도 해석, 전압, 손실, 냉각·폐열·연료 모델은 없다.

제어 도달성은 별도 방향성 Graph다. 전력이 있어도 지휘 경로가 없으면 해당 제어 권한은 0이다. 원래 엔진/시각용 RCS ID를 재사용하며 권한은 무차원 기능 값이다. 실제 추력·가속도·토크·레이더 탐지 거리를 계산했다고 주장하지 않는다. 별도 RCS가 없는 경우 기존 엔진 제어 interface fallback을 경고한다.

외부 장비는 실제 Free-Mount ID로 동적 연결된다. 현재 무장 library에 권위 있는 MW 사양이 없어 `LEGACY_UNSPECIFIED`로 표시한다. 장착당 기본 1채널은 명시적 제어 회계 관례다. 명시적 시험용 operatingSpecification으로 과부하를 검증하며 과거 장비에 임의의 소비 전력을 붙이지 않는다. 전투 센서 모델이 Free-Mount에 없어 센서 처리는 분명한 fixture로 검증한다. 설치 허용과 운용 가능성을 분리한다.

## 고장 / 중복성 / Instance

`createSystemInstanceState`, `evaluateShipCapabilities`, `advanceSystemState`를 제공한다. 가상 상태 OPERATIONAL/DEGRADED/OFFLINE/DESTROYED와 저장 에너지는 설계와 독립적이다. Advance는 새 state를 반환한다. 고장/초기화로 Geometry나 무장을 삭제하지 않으며 평가에 Hull triangle 재생성/순회가 필요하지 않다. 실제 Inspector가 결과를 사용한다.

Balanced 단일 계통 정상 소비는 32MW다. 발전기/배전기 고장 시 공급·권한이 끊기고, 지휘 고장 시 전력이 남아도 하위 제어가 멈춘다. 추진·자세·사격통제·센서 처리 장치 고장은 담당 기능에 반영된다. Degraded 추진 제어는 .5 권한이다.

Endurance는 240MW 발전, 64MW 정상 수요, 360MJ 예비 에너지를 갖는다. 개별 설비 하나를 잃어도 지휘·추진·자세 권한을 유지한다. 장치 단일 장애점 분석과 구획 전체 상실 분석을 별도로 수행한다. 결과는 기본 1s 준정상 평가 지평이며 무한 항속이나 장기 생존성을 인증하지 않는다. 두 버스 루프 과부하 및 실제 저장 에너지 고갈/복구/충전을 별도 테스트했다.

## 질량 / 예산 / 호환성

새 질량은 FUNCTIONAL_EQUIPMENT / EQUIPMENT_DEFINED로 한 번만 더한다. 기존 Core 외장 하우징과 Engine 추정 질량은 재생성하거나 제어기 질량으로 대체하지 않는다. 12개 additive 설계의 기본 질량 증가는 새 장비 사양 질량 합과 .001kg 내 일치하고 기존 Core/지지 추정값은 그대로다. 비어 있는 공간은 질량이 없다.

**미해결 질량 한계:** 이전 10% 추진·서비스 proxy의 항목별 내역이 없어 새 기능 설비와 잠재적 중복을 독립적으로 해소하지 못했다. 보수적인 미배분 추정값으로 유지하고 잠재 중복을 기록했다. 근거 없는 차감 또는 완전히 정확한 총질량이라고 주장하지 않는다. 실제 기본 질량/비용 상한은 최종 출고에서 검사하고 초과 시 거절한다. 플레이어 장비는 기본 질량 이후에 별도로 합산한다.

기존 저장본을 Load해도 설비를 자동 삽입하지 않는다. 최상위 schemaVersion 2, 선택적 functionalSystems schemaVersion 1을 사용하며 기존 compartment contract .2.1을 보존한다. 명시적 .2.1/.2/.1 생성 경로와 과거 무장/Anchor도 유지한다. 내부 설비가 추가되어도 Free-Mount에 내부 공간·전력·제어·급탄·응력 거절 조건을 추가하지 않았다.

## 12개 설계의 실제 수치

| 설계 | 설비 / 설치 구획 / Host | 전력 / 제어 edge | 설비 kg | 발전 / 배전 MW | 기본 추정 t |
|---|---:|---:|---:|---:|---:|
| BALANCED | 7 / 3 / 1 | 6 / 4 | 24,900 | 120 / 100 | 628,128.485 |
| ARMOR | 7 / 2 / 1 | 6 / 4 | 24,900 | 120 / 100 | 1,341,758.353 |
| MOBILITY | 7 / 2 / 1 | 6 / 4 | 17,928 | 120 / 100 | 508,435.429 |
| ENDURANCE | 16 / 6 / 1 | 28 / 16 | 55,800 | 240 / 200 | 642,885.508 |
| ECONOMY | 7 / 2 / 1 | 6 / 4 | 24,900 | 80 / 100 | 743,563.151 |
| BLOCK_ASSEMBLY | 14 / 7 / 4 | 12 / 8 | 49,800 | 240 / 200 | 1,003,119.674 |
| SPINE_AND_MODULES | 7 / 6 / 4 | 6 / 4 | 24,900 | 120 / 100 | 247,344.557 |
| TRUSS_POD | 14 / 8 / 6 | 12 / 8 | 49,800 | 240 / 200 | 240,578.663 |
| TWIN_HULL | 14 / 3 / 2 | 12 / 8 | 49,800 | 240 / 200 | 542,575.724 |
| CORE_AND_NACELLES | 7 / 7 / 4 | 6 / 4 | 24,900 | 120 / 100 | 342,377.307 |
| STACKED_BLOCKS | 14 / 4 / 3 | 12 / 8 | 49,800 | 240 / 200 | 226,552.159 |
| HYBRID | 14 / 5 / 4 | 12 / 8 | 49,800 | 240 / 200 | 282,641.275 |

실제 위치·OBB·재질·질량·연결은 fixtures/*.json.gz와 comparison.json에 보존했다.

## 동일 Seed 우선순위 비교

470m AEGIS Battleship / MONOLITHIC / Seed 7 / Target 3,562,847t / Maximum 5,000,000t. Priority만 변경했다. 기존 형상·골조·장갑·구획 우선순위 결과를 그대로 사용한다.

| 우선순위 | 설비 / 구획 | 설비 t | 발전 MW | 6축 합산 Armor 경로 mm | 상대 기본 건조 비용 | 발전기 1개 OFF: 추진 / 자세 |
|---|---:|---:|---:|---:|---:|---:|
| BALANCED | 7 / 3 | 24.900 | 120 | 12253.524 | 807,769,439.9 | 0.00 / 0.00 |
| ARMOR | 7 / 2 | 24.900 | 120 | 14515.367 | 3,368,547,418.8 | 0.00 / 0.00 |
| MOBILITY | 7 / 2 | 17.928 | 120 | 7185.455 | 815,968,291.0 | 0.00 / 0.00 |
| ENDURANCE | 16 / 6 | 55.800 | 240 | 20243.620 | 971,112,136.1 | 1.00 / 1.00 |
| ECONOMY | 7 / 2 | 24.900 | 80 | 7965.530 | 510,567,406.0 | 0.00 / 0.00 |

ARMOR는 2개 실제 구획에 집중하고 Balanced의 3개 구획 분산보다 표본 Armor 경로가 크다. 합산 ray는 전방위 피복률·생존확률이 아니다. MOBILITY는 동일 제어 권한에서 설비 6,972kg을 절약한다. ECONOMY는 발전기 정격과 명시적 제조 지수를 줄이며 필수 장비를 유지한다. ENDURANCE는 실제 이중 발전·배전·지휘와 crossfeed, 유한 저장을 사용하며 증가한 질량·비용을 합산한다. 주 우선순위가 설비 패키지를 결정한다. Secondary의 별도 설비 혼합 모델은 없고 기존 Hull/Frame/구획 정책과 설치 공간에 계속 반영된다.

## 성능·메모리 (최종 코드 재측정)

같은 컨테이너, Node 새 프로세스 버전당3회, `--expose-gc`, 동일470m 주문. 모듈 import는 별도 기록하고 generation timer에서 제외했다. 단계 전 명시적 GC와 동일 profile timer를 사용했다. 다른 QA가 끝난 뒤 idle Vite 서버만 유지해 측정했다. n=3 p95는 표본 최댓값이고 장기 분포 보장이 아니다. 샘플은 시간 순서별이며 교차 무작위 배치가 아니므로 모든 변동을 코드 한 변경의 인과효과로 단정하지 않는다. 이 order-only harness RSS를 이전 full-fixture-retaining 보고 RSS와 직접 비교하지 않는다.

| 지표 | Before .2.1 | Final .3 |
|---|---:|---:|
| Cold median | 7.787s | 9.640s |
| Cold sample p95/max | 7.857s | 9.698s |
| Warm median | 2.324s | 3.157s |
| Warm sample p95/max | 2.343s | 3.301s |
| Peak process RSS | 753.277MiB | 893.133MiB |

최종 대표 Node 조건: Cold<=11s **PASS**, Warm median<=3s **MISS**, Peak RSS<=1,150MiB **PASS**. 반복3초 목표를 미달했다. 기능 추가로 실제 시간과 RSS가 늘었다. 큰 CORE/TRUSS와 Browser 전체 RSS의 목표 달성을 주장하지 않는다.

초기 .3 표본 8.760s / 2.962s / 913.746MiB는 `performance-pre-final.json`, `after-pre-final-*.json`에 보존했다. 최종 검토에서 사용할 수 없는 저장 에너지 표시를 고치고, 검증 cache가 읽는 질량 요약/RCS ID 입력을 key에 추가한 뒤 .3만 새 프로세스3회 다시 측정했다. 기존 .2.1 측정3개는 유지했다. 추가 key는430 UTF-16 추정 bytes이며 최종 시간 차이 전체를 이 작은 key 추가의 영향이라고 단정하지 않는다. 유리한 초기 숫자를 최종 숫자로 보고하지 않는다.

### 새 Cold 단계 (최종3개 표본의 중앙값)

| 단계 | ms |
|---|---:|
| Functional query preparation | 529.9786 |
| Functional protection query preparation | 393.5235 |
| Functional placement | 17.1418 |
| Functional network construction | 0.3297 |
| Functional capability evaluation | 1.1296 |
| Functional systems | 951.0593 |

Nested timing은 모두 합산하지 않는다. placement는 기존 finite space/protection query 준비 이후 위치 탐색이다. 기존 CSG/Armor/Frame 검사와 계산을 생략하지 않았다. 기본 제어기의 정상 소비32MW는 실제 배전 경로를 통해 전달된다.

### 경량 Runtime

- 정상 평가 평균: 프로세스별1,000회, 평균의 중앙값 **0.03104ms**. JIT 후 평균이며 tail latency 보장이 아니다.
- 고장 toggle+재평가 평균: 프로세스별1,000회, 평균의 중앙값 **0.02275ms**. JIT 후 평균이며 tail latency 보장이 아니다.
- 설비 7개 / power edge 6개 / control edge 4개. Instance JSON UTF-16 추정 246 bytes, plan 53992 bytes.
- validation exact key1개: 40.965MiB UTF-16 추정. 실제 JS object allocation과 다르며 기존 캐시 비용과 별개다. Query/검증 key 복제·메모리 비용은 계속 추적해야 한다.

Cold/Warm-hit JSON 해시는 각 프로세스에서 일치했다. `before-performance.json`은 별도 초기 cold/warm-hit/명시적 cache-miss/changed-seed 표본이다. .3은 별도 functional generation cache가 없으며, validation key가 source/room/equipment/설치 사양/질량 요약/RCS ID 변경을 검사한다. 대표8종 additive build+validation 시간은 comparison.json에 따로 있으며 전체 생성 시간과 혼동하지 않는다.

## 자동·브라우저 QA 결과

- `npx vitest run tests/systems.test.ts tests/free-mount.test.ts tests/physical-foundation.test.ts --maxWorkers=1`: 3파일 **51개 통과** (`targeted-tests-final.log`).
- `npx vitest run tests/interior.test.ts -t 'default native|real door|future system placement|JSON roundtrip|external free' --maxWorkers=1`: 관련 **5개 통과**, 나머지15개 실행하지 않음 (`interior-regression.log`). 고유 자동 테스트 합계 **56개**.
- 기존 사례 보강 후 equipment finite query 1개, 파괴/정지된 저장 장치의 사용 가능한 reserve 제외 검사1개, 전력 루프·저장·중복성·edge 차단·query 관련5개만 추가 재실행해 통과했다. 고유 수에 중복 합산하지 않았다.
- TypeScript `--noEmit` + Production Build 통과 (`build-release.log`). 기존 >500KB JS chunk 경고는 남는다. 새9개 TS 파일의 가독성 정리 전후 emitted JS 구문트리 일치를 확인했다 (`format-equivalence.json`).
- 전체600+ suite, 역사적 전체 pixel, 대규모 무작위 Seed, 무관한 combat-demo 테스트는 실행하지 않았다.
- 실제 built Production UI **48개 checks** 통과. 8종 각각 실제 Generate, 기능망·Inspector, 고장·Reset, 비무장·엔진·질량 상한·저장/복원, 물리 함포 설치/제거/Undo/Redo, 실제 장착 장비의 UNKNOWN/명시적 시험 사양 과부하를 검증했다. Console/page errors **0**.
- 뒤이어 기존 공통 fallback legend가 새 시스템 view에 맞지 않는 것을 고쳤다. Label만 바뀐 뒤 전체 생성 matrix를 재실행하지 않고 **8개 focused UI checks**로 새 legend 5종, 실제 3D mesh 클릭 선택, 기능 설비 Ray layer, console0을 확인했다. 첫 matrix 사진은 당시 증거로 보존하고 `current-*` 사진을 최종 UI 증거로 구분한다.
- 외부 센서 모델이 없어 실제 radar 설치 QA를 했다고 주장하지 않는다. Sensor processing과 장애는 명시적 센서 load fixture로 검사했다. 새 척추포 모델/지지대를 구현하지 않았다.

### Normal / 물리·과거 데이터

실제 이전/현재 ShipViewer로 고정8척을 렌더링해 Normal pixel과 draw calls가 정확히 같았다. 새5개 system view의 실제 Geometry finite, mesh picking도8종에서 통과했다. 이는 저장 fixture 렌더 비교이며, 실제 full browser Generate는 별도 matrix 증거다.

이전 .2.1 실제 Production Chromium export와 이번 .3 실제 Production Chromium export 8개도 같은 Order로 비교했다. 기존 구조 볼륨·Connector·Frame·compartmentPlan 전체·Engine·Prefab·외부 detail·production armor/finish·physical skin 해시가 모두 같고, 질량 차이는 새 설비 kg와 .001kg 내 일치했다 (`browser-preservation.json`). 같은 Node의12개 additive 감사와 같은 Browser의 생성 결정성은 별도 검사다. Node/Chromium 사이 기존 수치 차이를 해결했다고 주장하지 않는다.

### 제한된 메모리 수명 검사

실제 ShipViewer에서 Balanced/Twin 교체와 Debug ON/OFF를6회 반복하고 명시적 Chrome GC 후 JS heap을 측정했다. 초기 진단의 dispose 뒤 `getDiagnostics`는 마지막 frame draw info와 ship 없는 상태의 false finite flag를 반환하므로 이를 resource 해제 증거로 쓰지 않았다. 실제 ref/scene/geometry counters를 확인하는 제한6회 후속 검사로 검증했다.

| Cycle | 설계 | Debug draw calls | Normal draw calls | post-GC JS heap MiB |
|---|---|---:|---:|---:|
| 0 | BALANCED | 16 | 29 | 29.778 |
| 1 | TWIN_HULL | 30 | 91 | 77.204 |
| 2 | BALANCED | 16 | 29 | 30.219 |
| 3 | TWIN_HULL | 30 | 91 | 77.502 |
| 4 | BALANCED | 16 | 29 | 30.464 |
| 5 | TWIN_HULL | 30 | 91 | 77.642 |

실제 dispose: `{"blueprintReleased": true, "shipReleased": true, "sceneChildren": 0, "geometryCount": 0, "textureCount": 0}`. GPU byte량이나 장기간 leak-free 보장은 아니다.

**Production UI의 별도 큰 메모리 부담:** 아래는 실제 각 Generate/Export 직후, case 종료 GC 전 JS heap이다. 이 값은 프로세스 RSS와 다르며, 제한 Node 대표 benchmark의 913.746MiB와 혼동하지 않는다. 전체 Browser RSS 1,150MiB 준수를 검증한 것이 아니다. 대형 Blueprint/source/Frame 캐시 및 Export 임시 할당 비용이 계속 크다.

| 설계 | GC 전 UI JS heap MiB |
|---|---:|
| BALANCED | 198.126 |
| BLOCK_ASSEMBLY | 1247.341 |
| SPINE_AND_MODULES | 1978.441 |
| TRUSS_POD | 1675.479 |
| TWIN_HULL | 1672.395 |
| CORE_AND_NACELLES | 1770.852 |
| STACKED_BLOCKS | 2284.432 |
| HYBRID | 649.425 |

공유 cgroup은 CPU quota2 / memory8GiB였다. 전체 실행 후 memory.max events563, OOM/OOM-kill0을 기록했다. 높은 공유 메모리 압박을 숨기지 않으며 memory.max event를 Node의 peak RSS라고 부르지 않는다.

## 실패 실험·한계

- 초기16개 새 기능 테스트는 통과했다. 이후 Mass Ledger의 설명을 정확한 미해결 추정 의미로 바꾼 뒤, 새 V3 fixture를 갱신하기 전 실행한51개 중8개가 이전 설명 문자열과 달라 실패했다 (`targeted-tests.log`). 기존 버전 fixture/기준/오차를 약화하지 않고 실제 builder로 새 V3 fixture를 재생성했다. 최종51개와 관련5개 모두 통과했다.
- 실행 환경의 exec transport가 간헐적으로 끊겼다가 복구됐다. 실패한 명령은 재실행했고 진행 중 브라우저 검증은 계속 완료됐다. OOM-kill 증거는 없으며 이를 원인으로 단정하지 않는다.
- 새 debug view에 기존 일반 legend가 표시되는 실제 UI 문제를 시각 검사에서 발견하고 수정했다. 후속 실제 UI로 확인했다.
- 전체 선내 빈 체적 census/미해결 SPINE/Node-vs-Chromium 커널 차이는 기존 한계로 남는다. 설치된 설비는 별도 점유/target layer이며 원래 architectural room 계약을 조용히 다시 쓰지 않는다. Interior Ray UI는 새 실제 설비 interval을 추가하고 배치 후보는 실제 설비와의 겹침도 제외한다. API에서는 `equipmentSpaceClear`와 기존 interior `fits`를 함께 쓴다.
- 단순 OBB envelope와 지정 dry mass다. 내부 복잡한 기계 구성, 실제 연료·냉각·열·동력 추진·토크·탐지거리·케이블, 화재·산소·관통·폭발·전투 피해·Crew·FEM은 구현하지 않았다. Controller15MW는 엔진 자체의 추진 전력 사양이 아니다.
- 초기 equipment catalog 고정 크기와 제한적 placement 탐색으로 실패할 수 있다. 강제 장비 축소/가짜 방/벽 제거 없이 거절한다. 별도 전체 packing 최적화나 내부 설비 편집기를 구현하지 않았다.
- 기존 10% service proxy 잠재 질량 중복은 미해결이다. 사양 질량과 geometry-derived 재료 질량을 구분한다. Maximum compliance도 전체 실제 질량을 공학적으로 확증한 것이 아닌 기존 estimated base mass 계약이다.
- 주 우선순위 패키지는 구현했으나 secondary의 별도 장비 혼합 모델은 없다. 장기적 다중 함선 전역 cache 예산/GPU bytes/전체 Browser RSS 상한/모든 플랫폼 bit identity도 보장하지 않는다.

## 실행·재현

이 Worktree에서 `npm run dev`. Internal Systems / Power Network / Control Network / System Redundancy / Equipment Mass를 선택하고 Inspector에서 장치·가상 상태·Apply / Reset / Advance reserve / Analyze single failures를 사용할 수 있다. Focus equipment로 실제 작은 OBB를 확대한다. 이 버튼과 실제 mesh picking을 검증했다.

성능 재현: 기존 `node tests/interior-stability-benchmark.mjs build /workspace/shipyard-v1.8.6.2.1 /tmp/systems-before.mjs`, 새 `node tests/systems-harness.mjs build . /tmp/systems-after.mjs`, `node tests/systems-performance.mjs matrix`. 기존 builder bundle은 읽기 전용 hook export만 추가하며 원래 소스를 수정하지 않는다. Actual UI `tests/systems-browser.mjs`는 preview4186, source-only visual `tests/systems-visual.mjs`는 old/new dev5186/5187을 사용한다. 자료의 역할은 각각 스크립트/JSON에 명시했다.

[실제 Browser 화면 갤러리](index.html), [우선순위·고장 원본](comparison.json), [성능 원본](performance.json), [실제 Native UI](browser/report.json), [현재 UI 후속](browser/followup.json), [Normal 비교](visual/report.json), [실제 Viewer 수명](visual/memory-lifecycle.json), [Chromium 과거/현재 보존](browser-preservation.json).

## 중복성·필수 기능 비교 수치

SPOF는 구조 Graph bridge가 아니라 실제 전력·제어 기능별 장치 제거 실험으로 계산했다. 한 기능이라도 완전히 잃는 장치 수이며, 전체 함선이 동시에 멈춘다는 뜻은 아니다.

| Priority | 발전기 / 저장 장치 | 기능별 total-loss SPOF 장치 | 정상 추진 / 자세 | 배전기 1개 OFF 후 추진 / 자세 |
|---|---:|---:|---:|---:|
| BALANCED | 1 / 0 | 7 | 1.00 / 1.00 | 0.00 / 0.00 |
| ARMOR | 1 / 0 | 7 | 1.00 / 1.00 | 0.00 / 0.00 |
| MOBILITY | 1 / 0 | 7 | 1.00 / 1.00 | 0.00 / 0.00 |
| ENDURANCE | 2 / 2 | 0 | 1.00 / 1.00 | 1.00 / 1.00 |
| ECONOMY | 1 / 0 | 7 | 1.00 / 1.00 | 0.00 / 0.00 |

기본 Mandatory는 실제 발전·배전·지휘·추진·자세 제어가 가능해야 한다. 사격통제·센서 처리 장치도 생성/검증하되 비무장 신규 함선에는 실제 연결 공격 장비0개다. 전체5개 우선순위의 고정 대형 주문은 상한을 준수했다. 실패한 상한 주문은 자동·실제 UI에서 REJECT되고 이전 정상 Blueprint를 보존했다.

## 실제 변경 파일

- `package-lock.json`
- `package.json`
- `src/blueprint/types.ts`
- `src/free-mount/types.ts`
- `src/interior/build.ts`
- `src/interior/validate.ts`
- `src/main.ts`
- `src/physical/policy.ts`
- `src/physical/types.ts`
- `src/procurement/generate.ts`
- `src/procurement/result.ts`
- `src/procurement/types.ts`
- `src/rendering/ship.ts`
- `src/rendering/systems.ts`
- `src/rendering/viewer.ts`
- `src/structure/validate.ts`
- `src/systems/README.md`
- `src/systems/build.ts`
- `src/systems/evaluate.ts`
- `src/systems/query.ts`
- `src/systems/registry.ts`
- `src/systems/types.ts`
- `src/systems/validate.ts`
- `src/ui/interior.ts`
- `src/ui/layout.ts`
- `src/ui/systems.ts`
- `src/validation/validate.ts`
- `tests/interior.test.ts`
- `tests/systems-browser-followup.mjs`
- `tests/systems-browser.mjs`
- `tests/systems-harness.mjs`
- `tests/systems-performance.mjs`
- `tests/systems-preservation.mjs`
- `tests/systems-qa.mjs`
- `tests/systems-replay.mjs`
- `tests/systems-visual.mjs`
- `tests/systems.test.ts`

추가 증거는 `qa/v1.8.6.3/`의 실제 JSON/압축 Blueprint/이미지/로그다. 원래 QA 파일을 덮어쓰거나 삭제하지 않았다.

## 대표 Architecture 입력

| Architecture | Yard / Class | 길이 m / Seed |
|---|---|---:|
| MONOLITHIC | aegis / Battleship | 470 / 7 |
| BLOCK_ASSEMBLY | forge / Battleship | 500 / 7 |
| SPINE_AND_MODULES | vesper / Cruiser | 300 / 12 |
| TRUSS_POD | vesper / Frigate | 300 / 7 |
| TWIN_HULL | forge / Frigate | 400 / 11 |
| CORE_AND_NACELLES | vesper / Frigate | 200 / 11 |
| STACKED_BLOCKS | aegis / Cruiser | 300 / 7 |
| HYBRID | serein / Frigate | 300 / 11 |

최종 검토에서 사용 불가능한 저장 장치의 충전량을 사용 가능한 reserve 합계에 포함하던 표시 의미를 수정했다. 원래 MJ는 Instance에 남기되 OFFLINE/DESTROYED 장치의 에너지는 `backupPowerRemainingMJ`에서 제외한다. 기존 유한 저장 사례에 독립 state 검증을 보강해1개만 재실행했고 통과했다 (`reserve-availability-final.log`). 정상·발전기 고장·생성 설계/질량/위치 결과는 변하지 않는다.

최종 cache 무결성 검사: key에 빠졌던 실제 기능 설비 질량 요약·미해결 서비스 추정값·기존 RCS ID를 포함했다. 검증 이후 이 입력을 바꿔도 캐시가 성공을 반환하지 않는지 기존 사례1개만 보강·재실행해 통과했다 (`cache-inputs-final.log`). 고유 자동 테스트 수56개에는 중복 합산하지 않는다.
