# V1.8.6.3.1 — Functional Mass & Runtime Memory Integrity

검증 시각: 2026-10-17T18:22:31.901606+00:00

Branch: `feature/v1.8.6.3.1` · Base: `5c9ff588c0e8d7166afd69fe78abf9603a41d94b`. 독립 Worktree `/workspace/shipyard-v1.8.6.3.1`. 최종 로컬 Commit SHA는 완료 응답과 이 브랜치의 `git log -1`에 기록한다. 원격 Push·History Rewrite 없음. 기존 Worktree·QA·combat-demo 변경 없음.

## 결과와 한계

- 반복 생성 목표 달성: 같은 환경 5회 중앙값 3.376 → 2.720초. 최초 생성은 9.073 → 9.992초로 **느려졌다**. 최초 생성 11초 권고 상한은 통과했으나 이전 속도 유지에는 미달했다.
- 같은 메모리 실험에서 GC 후 최대 유지 JS Heap 462.5 → 276.6MiB. GC 전 관측 최대 1,380.7 → 1,003.5MiB. 과거 2.28GiB 측정과 실험 조건이 다르므로 이를 직접적인 2.28→1.00GiB 개선으로 주장하지 않는다.
- 질량 총계는 보존했다. 확인된 실체 중복 소유자는 없었고, 10% 추정치에는 대응 설비를 식별할 근거가 없다. **확정할 수 없는 중복 가능성은 미해결**이다. 실제 생산 자료에서 차감한 질량은 0kg다.
- 60개 고유 관련 자동 테스트, Production UI 55항목, 8종 Normal 픽셀 비교, TypeScript/Build 통과. 전체 테스트 스위트·combat-demo 테스트는 실행하지 않았다.

## 1. 10% Service Estimate 출처와 질량 회계

코드 경로는 `generation/macro/measurement.ts → generation/generate.ts → physical/policy.ts`다. Macro는 Structural Volume별 station loft 단면을 적분해 합산하고, `densityTonnesPerM3 = 0.16 + priorities.survivability * 0.0022`를 곱한다. 그 tonne 추정값을 반올림한 `dimensions.estimatedMass`에 `1000 * 0.10`을 곱한 것이 기존 `unresolvedMassEstimateKg`다. 목표 질량·최종 기본 질량·잔여 예산의 10%가 아니다. Macro 체적 합산은 실제 재료 체적 union이 아니므로 이 proxy를 재료 질량처럼 해석하지 않는다.

신규 발주의 `geometryOrder`는 ARMOR/MOBILITY/ENDURANCE를 기존 형상 입력에 연결한다. 따라서 같은 목표 질량에서도 ARMOR 정책의 생존성 밀도·형상 때문에 10% 값이 달라질 수 있다. 계산은 최종 ledger를 참조하지 않아 자기 참조는 없다. 기존 정책의 propulsion/endurance reserve 역시 실제 설치 질량에 추가 합산하지 않는다.

기존 설명은 propulsion/support proxy뿐이며 냉각·배관·배선·연료탱크 등으로 분해한 내역이나 소유자가 없다. 이 예시들을 실제 모델링된 설비로 선언하지 않았다. 실제 발전기·배전기·저장장치·추진/기동/지휘/사격/센서 제어기는 Registry dry-mass 사양으로 한 번만 계산된다. 엔진의 외장 casing/assembly 체적 추정과 새 추진 제어기는 별도 소유자다. 엔진 자체의 상세 공학 질량은 여전히 분해되어 있지 않다.

새로운 `MassLedger.reconciliation`은 계산 정책 `1.8.6.3.1`, MODELED/ESTIMATED/UNKNOWN_LEGACY 분류, 물리 소유자 참조, 계산 기준·신뢰도·대체 참조·불확실성 메모를 추가한다. Geometry-derived 부재와 장비 사양 질량을 modeled base로, 나머지 representation-density/legacy 값을 remaining estimate로 분리한다. 일부 기존 범주의 owner는 집계 범주 참조이며 세부 엔진 BOM을 의미하지 않는다.

`reconcileOwnedMass`는 **명시적으로 항목화된 추정의 모든 소유자가 실체화됐을 때만 그 추정 전체를 대체**한다. 부분 겹침을 비례 차감하지 않고 오류로 돌려주며, 음수/비유한 질량, 중복 실제/추정 소유자와 중복 원천 ID를 거절한다. 독립 fixture에서 20,000kg 발전기 추정 → 18,000kg 실제 사양으로 대체하고, 별도 4,000kg 미구현 지원 추정 및 90,000kg UNKNOWN_LEGACY는 유지했다. 생산의 10%에는 owner inventory가 없어 `replacements=[]`다. 모든 추정이 해결됐다고 주장하지 않는다.

### 470m AEGIS / Battleship / MONOLITHIC / Seed 7

Target 3,562,847t, Maximum Base 5,000,000t 고정. 아래는 기존 정책별 저장 geometry에 신규 회계 함수를 독립 적용한 감사이며, 5개 모두 새로 전체 생성했다고 주장하지 않는다. 실제 신규 BALANCED/ARMOR 생성은 별도 성능·브라우저 경로에서도 수행했다. 8종 실제 신규 Chromium 결과는 별도 hash 비교로 검증했다.

| 정책 | 기능 설비 kg | Hull t | Armor t | 실체/사양 modeled t | 잔여 추정 t | 그중 10% 불명 t | Base Before t | Base After t |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BALANCED | 24,900.0 | 59,017.4 | 293,041.3 | 380,767.3 | 247,361.2 | 245,822.3 | 628,128.5 | 628,128.5 |
| ARMOR | 24,900.0 | 60,595.7 | 785,995.0 | 922,333.5 | 419,424.9 | 417,886.0 | 1,341,758.4 | 1,341,758.4 |
| MOBILITY | 17,928.0 | 18,059.9 | 242,196.0 | 265,173.4 | 243,262.0 | 242,002.4 | 508,435.4 | 508,435.4 |
| ENDURANCE | 55,800.0 | 37,338.3 | 301,515.4 | 377,438.7 | 265,446.8 | 263,230.3 | 642,885.5 | 642,885.5 |
| ECONOMY | 24,900.0 | 59,017.4 | 431,140.8 | 496,256.5 | 247,306.7 | 245,822.3 | 743,563.2 | 743,563.2 |

BALANCED 내역: Hull 59,017.4t, Armor 293,041.3t, Frame 14,510.0t, Connector 0t, Bulkhead 14,171.4t, Door/Hatch 2.4t, 기능 설비 24.9t, 기존 Core housing 추정 1,538.9t, 남은 구조 추정 0t, 출처 불명 서비스 245,822.3t. 기본 총계 628,128.5t. Mounted/Platform은 기본 질량에서 제외하고 실제 장착 후 loaded mass에만 더한다. 정지·파괴 상태는 설계 질량을 줄이지 않는다.

ARMOR/MOBILITY의 기존 재질·두께·기능 배치 차이는 보존됐다. MOBILITY 사양은 17,928kg, ENDURANCE는 실제 예비 발전/배전/저장장치를 포함해 55,800kg이다. ECONOMY는 같은 24,900kg이지만 발전 정격 80MW와 낮은 비용 index를 사용한다. 용량·비용 감소가 반드시 외피 질량 감소를 뜻한다고 조작하지 않았다. 기존 추정 질량의 우선순위 결합은 이번 패치에서 재조정하지 않았다.

실제 설비 1개 추가 시 그 사양 질량만 정확히 한 번 증가하고, 엔진 housing/10% 추정은 임의로 변하지 않는지 검사했다. kg↔t, ledger 합계, Target/Maximum 구분, 최대 질량 초과 거절·실패 시 현재 함선 보존도 확인했다. 출고 상한은 **현재 정책의 accounted/estimated base**에 대한 판정이며 정확한 공학 질량 인증이 아니다.

## 2. 구현한 수명·캐시·할당 개선

- `main.ts`: Reload용 전체 JSON 문자열 상시 보관을 제거하고 현재 immutable 설계 참조를 사용한다. Free-Mount history는 기존의 공유 설계 + 변경분 방식과 40개 제한을 유지한다. Export는 완전한 compact JSON이며 표시용 pretty JSON은 명시 요청 때만 생성한다. JSON dialog 종료 시 큰 DOM 문자열을 해제한다.
- `systems/cache.ts`: 실제 전체 입력을 비교하는 단일 기능 계획 cache. Registry revision, 실제 finite interior/frame/armor geometry, 층·법선·piece mapping, order/priority, 엔진·RCS, legacy mass 입력 포함. 동일 geometry의 반복 OBB/armor query 준비·배치·망 구축을 재사용한다. 반환 plan은 작은 JSON snapshot을 새로 parse하므로 caller mutation/instance state가 cache를 오염시키지 않는다.
- 계획 및 성공한 functional validation cache 각각 UTF-16 추정 64MiB 제한, 1개 항목, 교체 시 eviction. source key 문자열은 가능한 경우 공유한다. 두 byte 진단을 합산해 실제 heap이라고 보고하지 않는다. 큰 입력은 cache 보관만 생략하고 모든 생성·검증을 그대로 수행한다.
- functional validation은 거대한 source+plan 연결 문자열을 또 영구 보관하는 대신 source key와 작은 plan/accounting key를 분리한다. 입력 변이·registry/material/finite cell/piece/engine 변경은 cache miss다. Physical validation identity에도 실제 기능 설비 질량 원본을 추가했다.
- `viewer.ts / physical/probe.ts`: 이전 함선의 owned visual geometry/material을 기존 방식대로 폐기하면서 준비된 interior/physical query 참조도 명시 해제한다. 이미 반환된 snapshot을 파괴하지 않는다. Debug는 기존처럼 선택 시 생성되며 Normal에 내부 설비 mesh를 추가하지 않는다.

전체 Blueprint/geometry를 가상 고장 때 복제하지 않는다. 현재 활성 설계는 UI·viewer·editor가 공유하고, 전력/제어망은 불변 설계에 있다. Failure state/selection은 경량 instance/UI 데이터다. Inspector callback은 현재 설계를 조회하거나 교체 시 갱신한다. preview/free workers와 history는 기존 reset 시 교체된다. 새 대형 무제한 query/placement cache는 만들지 않았다. 기존 physical/frame/interior cache 정책은 유지했다.

## 3. 브라우저 메모리

실제 built Production 앱, Chromium 151, headless SwiftShader, 1440×1100. CDP `Runtime.getHeapUsage`, `Memory.getDOMCounters`, 각 단계 명시적 `HeapProfiler.collectGarbage`. BALANCED/TWIN/STACKED 3척을 6회 교체하고 Internal/Power/Control View, 발전기+배전기 OFFLINE, Reset, Normal 복귀를 반복했다. pre는 해당 경계의 관측값이며 연속 시간 peak가 아니다. 실험은 문서당 하나의 활성 함선을 유지한다. 원래 2.28GiB 관측은 수집 조건이 다르다.

| 단계 | Before pre MiB | Before post-GC MiB | After pre MiB | After post-GC MiB |
|---|---:|---:|---:|---:|
| APP_START_AUTOGENERATED | 501.6 | 172.7 | 240.4 | 129.4 |
| 470_GENERATED | 714.8 | 198.5 | 555.3 | 172.2 |
| NORMAL_0 | 203.2 | 200.5 | 177.7 | 174.5 |
| NORMAL_1 | 463.0 | 459.8 | 275.5 | 274.1 |
| NORMAL_2 | 290.5 | 288.5 | 196.0 | 193.5 |
| NORMAL_3 | 210.2 | 206.3 | 161.7 | 158.4 |
| NORMAL_4 | 464.5 | 462.3 | 280.5 | 276.5 |
| NORMAL_5 | 290.7 | 289.0 | 195.7 | 194.1 |
| APP_RELEASED | 289.5 | 1.0 | 194.6 | 1.0 |

APP START는 기존 UI가 자동으로 초기 함선을 생성한 직후다. 함선이 전혀 없는 초기 UI 단계는 별도로 제공되지 않는다. APP RELEASED는 `about:blank` 이동으로 문서 전체를 해제한 진단이며 새 in-app close-ship 기능을 구현했다고 주장하지 않는다. 개별 Viewer의 직접 dispose는 별도 실험에서 blueprint/ship 참조 해제, scene child 0, Geometry 0, Texture 0으로 확인했다.

두 번의 같은 함선 주기에서 After post-GC는 MONO 174.5→158.4MiB, TWIN 274.1→276.5MiB, STACKED 193.5→194.1MiB다. 6회 범위에서 폐기된 전체 함선이 매번 누적되는 패턴은 보이지 않았다. 이것이 모든 사용 흐름의 누수 부재를 증명하지는 않는다. Before도 주기별 유지량은 안정적이었다. 이번 결과는 확인된 무제한 누수 수정이라기보다 중복 보관과 cache 유지량 감소다.

Allocation sampling에서 기존 `present()`의 약 86.5MB 살아 있는 할당과 JSON parse/검증 key가 큰 소유 경로였다. 상시 JSON 복제 제거 후 `present()`의 해당 대형 문자열 할당은 상위 보유 목록에서 사라졌다. 현재 parse된 Blueprint 및 physical/interior exact key 문자열은 여전히 필요 비용으로 남는다. 자세한 함수 위치와 minified source 연결은 `retained-allocation-source-map.json` 및 전후 allocation sample 참조.

최종 post-GC Heap Snapshot은 `/tmp/systems-after-final.heapsnapshot`에만 저장했고 Git에는 요약만 포함했다. self size 합계 기준 string 약 117.0MiB, object 약 25.8MiB, array 약 12.7MiB다. 이 값은 transitive retained size나 GPU 메모리가 아니다. 대형 문자열은 여전히 주요 잔여 비용이다.

마지막 Normal의 `backingStorageSize` 5,323,290 bytes, embedderHeapUsedSize 3,394,280 bytes를 별도로 기록했다. CDP backing storage는 외부 ArrayBuffer/문자열 관련 지표이며 정확한 GPU byte 총계는 측정하지 못했다. Node RSS와 브라우저 JS Heap을 합산하지 않았다. 전체 formatted JSON 요청은 일시적으로 703.1MiB JS Heap을 사용했으며 닫은 뒤 GC 후 163.5MiB로 돌아왔다. 큰 JSON의 명시적 표시/복사에는 여전히 일시 비용이 있다.

## 4. 성능 비교

Node v24.19.0, 2 CPU quota, 8GiB cgroup. 동일 order 파일, 같은 opt-in nested profiling, 버전별 새 프로세스 5회. import는 별도, GC 후 COLD 생성 → 직렬화 hash → GC 후 동일 order WARM_HIT. 각 프로세스 안에서 두 생성의 전체 JSON이 동일한지 검사했다. 병렬 브라우저/테스트 없이 실행했다. Before를 먼저, After를 나중에 실행했으므로 열/스케줄러/JIT 변동의 한계가 있다. n=5 p95 표기는 sample max이며 모집단 추정이 아니다.

| 지표 | V1.8.6.3 재측정 | V1.8.6.3.1 |
|---|---:|---:|
| Cold median | 9,072.7 ms | 9,992.2 ms |
| Cold sample max | 10,348.0 ms | 10,705.6 ms |
| Warm median | 3,375.6 ms | 2,720.1 ms |
| Warm sample max | 3,824.7 ms | 3,159.8 ms |
| 전체 과정 max Node RSS | 943.9 MiB | 930.2 MiB |

보고된 역사적 9.640s/3.157s/893MiB와 현재 기준선 9.073s/3.376s/943.9MiB를 구별한다. After 최대 RSS 930.2MiB는 현재 기준선보다 13.7MiB 낮지만 역사적 893MiB보다 37.2MiB 높다. 절대 893MiB를 재현했다고 주장하지 않는다. Cold는 현재 기준선보다 약 10.1% 느려졌으며 전체 입력 identity 구축이 추가됐다. 기하 생성 자체는 바꾸지 않았지만 물리 구성 phase에서도 실행 변동이 관측됐다.

### 단계 중앙값 (nested이므로 합산 금지)

| 단계 | Before cold ms | Before warm ms | After cold ms | After warm ms |
|---|---:|---:|---:|---:|
| Procurement meso | 835.8 | 784.8 | 877.3 | 818.9 |
| Procurement physical build | 2,084.0 | 157.7 | 2,509.0 | 157.0 |
| Interior total | 1,760.3 | 107.6 | 1,884.5 | 116.5 |
| Functional query preparation | 467.6 | 478.3 | 546.9 | 재사용/미계측 |
| Functional protection query preparation | 371.8 | 307.9 | 365.2 | 재사용/미계측 |
| Functional placement | 13.9 | 13.6 | 14.1 | 재사용/미계측 |
| Functional network construction | 0.4 | 0.1 | 0.3 | 재사용/미계측 |
| Functional capability evaluation | 1.2 | 0.2 | 1.2 | 재사용/미계측 |
| Functional cache identity | 재사용/미계측 | 재사용/미계측 | 191.0 | 180.5 |
| Functional systems | 911.2 | 922.1 | 1,123.9 | 181.1 |
| Procurement final validation | 2,673.8 | 806.5 | 2,732.7 | 906.3 |

첫 병목은 OBB 설치 자체 약 14ms가 아니라 internal/armor 조회 준비 약 0.8~0.9초였다. 기존 호출 수는 매 생성 각각 1회; warm hit에서는 두 조회 준비·배치·network/capability 생성 호출이 0회이며, exact source identity 1회와 소형 plan parse/회계만 수행한다. warm Functional systems 922.1→181.1ms. cache miss의 동일 준비·검증은 계속 수행한다. Power/Control은 실제 기존 builder가 한 루프에서 구성하므로 합친 network construction만 계측했다. OBB 후보/충돌/instance allocation도 기존 placement timer 안에 포함되며 별도 검증되지 않은 수치를 만들지 않았다. JSON hash 직렬화는 생성 timer 밖이며 별도 serialization 단계 시간은 이번 동일 프로토콜에서 분리 측정하지 않았다. maxRSS에는 그 비용이 포함된다.

| 추가 한 프로세스 실험 | 시간 ms |
|---|---:|
| COLD | 9,921.2 |
| WARM_HIT | 2,650.0 |
| FUNCTIONAL_CACHE_MISS | 3,226.7 |
| CHANGED_SEED | 9,884.1 |
| CHANGED_PRIORITY | 10,068.8 |

FUNCTIONAL_CACHE_MISS는 기능 계획 cache만 지운 warm runtime이며 전체 geometry cache가 비어 있다고 주장하지 않는다. Changed Seed/Changed Priority는 실제 입력을 바꿔 source cache miss를 검증했다. 이 1회 실험은 5회 중앙값에 섞지 않았다. Cold process가 완전 초기 상태 기준이다.

## 5. 기능 상태·전력·제어 일관성

8종 Registry와 기존 graph/finite reserve를 보존한다. evaluate는 시간과 설계를 변경하지 않는다. advance는 반환된 경량 state에만 MJ와 elapsedSeconds를 적용한다. 새 explicit interval API는 재적용/역순 구간을 거절한다. 같은 원본 state·같은 구간의 반복 호출은 같은 결과를 내며, 호출자는 반환 state를 채택해야 한다. Reset은 새 instance를 만들어 초기 완충량을 복구하는 debug 정책이며 실제 수리/충전 simulation이 아니다.

단일 발전기/배전기 정지, 이중 발전/배전 중 하나 손실, A 발전기 정지→B 배전기 정지→A 복구→B 복구, DEGRADED/DESTROYED, 저장 출력 제한과 MJ 소진·재충전, 반복 evaluate 순수성, 두 instance 독립성, 단일 공유 배전기 의존성, 실제 mounted gun의 power/control 부족을 검증했다. 부품 정지는 질량을 줄이지 않는다. 명시되지 않은 외부 장비 power는 여전히 LEGACY_UNSPECIFIED이며 가짜 사용 가능 전력을 만들지 않는다.

동일 470m graph의 프로세스별 1000회 평균의 중앙값: Before 0.029394ms → After 0.030947ms. 고장 토글도 경량 경로다. 다음은 각 조건 100 warmup + 1000회 별도 측정이며 외부 32개 load는 allocator fixture다. 실제 32개 외부 무장을 설치했다고 주장하지 않는다.

| 조건 | Units / Power edges / Control edges | 외부 요청 | 평균 ms |
|---|---|---:|---:|
| NORMAL | 7 / 6 / 4 | 0 | 0.028228 |
| MULTIPLE_OFFLINE | 7 / 6 / 4 | 0 | 0.028886 |
| ENDURANCE | 16 / 28 / 16 | 0 | 0.116729 |
| POWER_DEFICIT | 16 / 28 / 16 | 1 | 0.116579 |
| FINITE_RESERVE | 16 / 28 / 16 | 0 | 0.106913 |
| EXTERNAL_32_SYNTHETIC | 16 / 28 / 16 | 32 | 0.238175 |

## 6. Blueprint·Architecture·Free-Mount 회귀

구버전 load는 generatorVersion·질량·geometry·설치 장비를 재작성하지 않는다. top schemaVersion 2를 유지하고 신규 계산 정책만 명시적으로 opt-in했다. 기본 신규 발주는 비무장이며 엔진 유지. .2/.2.1/.1 역사적 계약 replay도 기존 selected integration test로 확인했다.

| Architecture | 실제 신규 Chromium geometry·frame·interior·systems·networks·기존 mass 필드 | Normal 픽셀 |
|---|---|---|
| MONOLITHIC | SHA-256 전부 일치 | 일치 |
| BLOCK_ASSEMBLY | SHA-256 전부 일치 | 일치 |
| SPINE_AND_MODULES | SHA-256 전부 일치 | 일치 |
| TRUSS_POD | SHA-256 전부 일치 | 일치 |
| TWIN_HULL | SHA-256 전부 일치 | 일치 |
| CORE_AND_NACELLES | SHA-256 전부 일치 | 일치 |
| STACKED_BLOCKS | SHA-256 전부 일치 | 일치 |
| HYBRID | SHA-256 전부 일치 | 일치 |

새 provenance만 mass hash 비교에서 제외했다. 실제 렌더러 픽셀 실험은 동일 archived .3 설계를 .3/.3.1 Viewer에서 비교한 것이며, 신규 전체 생성의 보존은 별도의 실제 Chromium export hash로 확인했다. 서로 다른 Node/Chromium 산출물을 같다고 비교하지 않았다. 각 아키텍처 virtual failure/Inspector와 실체 선택도 확인했다. source-only viewer dispose/Normal에서는 불필요한 internal draw call이 없다. MONO Normal 29 calls/14,576 triangles, network 16 calls/84 triangles; 상세 다른 값은 visual report에 있다.

외부 함포 실제 클릭 설치, platform, 질량 증가, 삭제·Undo·Redo, 저장·복원, 200MW/12channel 명시 fixture의 부족 경고를 확인했다. 전력·내부 공간·설비·frame 검사는 설치 거절 조건에 추가하지 않았다. 역사적 `qa/v1.8.6.0.2/ui/player-equipped.json.gz`의 무장 2개와 전체 JSON 데이터가 그대로 load/export된다. 신규 모델이나 외장 척추포 지원을 추가했다고 주장하지 않는다.

## 7. 검증 실행과 실패 기록

- 기존 관련 51개: `systems.test.ts` 17, `free-mount.test.ts` 18, `physical-foundation.test.ts` 16. Registry 5/3, 층·질량·ray/경계/회전/곡면, free mount·platform 회귀 포함.
- 신규 integrity 6개 + 기존 interior 선택 3개 = **고유 60개**. 중복 재실행 횟수는 더하지 않았다. `targeted-tests.log`, `integrity-final.log`, `interior-selected.log` 참조. 전체 600+ suite 미실행.
- Production 48 + 후속 7 = 55항목. 실제 8종 Generate, 저장·복원, 비무장·엔진 유지, 가상 장애/Reset/finite reserve, hard reject 시 기존 함선 보존, 자유 장착, 390px 화면, mass provenance, JSON 닫기, old armed load. console/page errors 0.
- TypeScript 및 Production Build 통과 (`build.log`). 기존 >500kB bundle warning은 남아 있다.

실패를 보존했다. 첫 cache fixture는 방 하나를 UNRESOLVED로 바꿨을 때 전체 실패를 예상했지만 다른 유효 방에 재배치하는 정상 동작이 나왔다. 수정된 assertion은 해당 방 미사용·실제 재계획·유효성을 검증한다. 첫 공유 배전 fixture는 남은 저장 에너지를 빠뜨려 완전 정지를 잘못 예상했다. 저장장치 없는 2-reactor/common-bus fixture로 의도를 분리했고 실제 finite backup 시험은 그대로 유지했다. 초기 로그 2개를 삭제하지 않았다.

브라우저 최초 실행은 TRUSS 생성의 동기 작업 중 Playwright 기본 action 30초 timeout이 발생했다. 첫 3종 성공/로그를 보존하고 TRUSS부터 120초 action 제한으로 재개했으며 남은 5종과 후속 조작이 통과했다. 앱 console 오류로 위장하거나 검증 실패를 지우지 않았다. 이 방식은 TRUSS 생성 지연 자체를 해결한 것은 아니다. 마지막 검토에서 추정 owner/source ID 중복 방어를 보강해 해당 1개 테스트와 최종 Build를 다시 통과했다 (`mass-owner-final.log`). 이 부가 입력 검사의 5회 성능 재측정은 하지 않았으며, 위 성능 표는 그 직전의 동일 생산 공식·생성 결과에 대한 측정이다.

## 8. 남은 한계와 목표 판정

- **미해결 질량:** 10% legacy service proxy의 실제 구성·오차·기능 설비 범위 중복 가능성을 수치로 결정할 근거가 없다. 별도 uncertainty로 유지한다. “확정된 중복 0건”과 “모든 잠재 중복 해결”은 다르다.
- Warm ≤3s: 통과(2.720s median), 일부 sample은 3s를 넘었다(max 3.160s). Cold <11s 권고: 통과(9.992s), 이전 현재 환경 속도 유지: 미달(+0.919s).
- Node RSS: 현재 기준선 대비 감소, 역사적 893MiB 절대값은 미달. Browser 유지량 감소와 6회 반복 안정성을 확인했으나 모든 장시간/worker/장비 편집 조합의 누수 부재를 증명하지 않는다.
- 대형 문자열·정확한 source identity 비용과 parse/CSG/geometry cache는 여전히 큼. Byte cap 초과 시 재검증 비용이 발생한다. TRUSS 지연과 동기 UI 생성, explicit pretty JSON의 일시 heap 사용은 남는다.
- SPINE 외피 재질/두께·hollow 계약, 전체 내부 void census의 기존 불완전 영역은 유지했다. 이를 새 유효 공간으로 등록하거나 재료 질량을 발명하지 않았다.
- 기존 finite faceted skins/CSG의 근사·오차와 runtime 미구현 범위는 그대로다. 이번 패치에서 ray 경로 정확도를 낮추거나 평면으로 대체하지 않았다. GPU bytes, OS별 외부 메모리 상세, 별도 serialization 단계 시간은 측정 완료로 표시하지 않는다.

## 9. 산출물과 재현

입력: `order.json`. 요약: `summary.json`, `performance.json`, `variants.json`, `mass-capability-audit.json`, `capability-conditions.json`, `browser-preservation.json`. 메모리: `memory-before/`, `memory-after-final/` (중간 `memory-after/`도 보존). 브라우저: `browser/combined-report.json`, `followup/report.json`, `visual/report.json`. 이미지: [갤러리](index.html). 359MB raw heap snapshot은 `/tmp`에만 두고 Git에 포함하지 않았다.

```sh
node tests/systems-harness.mjs build /workspace/shipyard-v1.8.6.3 /tmp/integrity-before.mjs
node tests/systems-harness.mjs build . /tmp/integrity-after.mjs
node --expose-gc tests/systems-integrity-performance.mjs sample /tmp/integrity-before.mjs /tmp/before-check.json
node --expose-gc tests/systems-integrity-performance.mjs sample /tmp/integrity-after.mjs /tmp/after-check.json
npm run dev
```

Production UI/메모리 스크립트는 `npm run build` 후 preview port 4187을 사용한다. 8종 viewer 픽셀 비교는 구/신 source dev ports 5186/5187을 사용한다. 실제 사용된 명령과 선택 테스트는 로그에 남겼다. 재현을 위해 전체 suite를 실행할 필요는 없다.

## 10. 변경 파일

- `package-lock.json`
- `package.json`
- `src/blueprint/types.ts`
- `src/interior/build.ts`
- `src/interior/validate.ts`
- `src/main.ts`
- `src/physical/policy.ts`
- `src/physical/probe.ts`
- `src/physical/reconcile.ts`
- `src/physical/types.ts`
- `src/physical/validate.ts`
- `src/procurement/generate.ts`
- `src/rendering/viewer.ts`
- `src/systems/README.md`
- `src/systems/build.ts`
- `src/systems/cache.ts`
- `src/systems/evaluate.ts`
- `src/systems/types.ts`
- `src/systems/validate.ts`
- `src/ui/layout.ts`
- `src/ui/physical.ts`
- `src/ui/systems.ts`
- `src/validation/validate.ts`
- `tests/interior.test.ts`
- `tests/systems-capability-conditions.mjs`
- `tests/systems-harness.mjs`
- `tests/systems-heap-summary.py`
- `tests/systems-integrity-audit.mjs`
- `tests/systems-integrity-browser.mjs`
- `tests/systems-integrity-followup.mjs`
- `tests/systems-integrity-performance.mjs`
- `tests/systems-integrity-preservation.mjs`
- `tests/systems-integrity-variants.mjs`
- `tests/systems-integrity-visual.mjs`
- `tests/systems-integrity.test.ts`
- `tests/systems-memory.mjs`
- `tests/systems.test.ts`

QA 변경은 새 `qa/v1.8.6.3.1/`에만 있다. 기존 QA와 combat-demo는 수정하지 않았다. 원격 Push는 실행하지 않았다.
