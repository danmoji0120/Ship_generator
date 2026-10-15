# V1.8.6.0.1 — Physical Geometry Performance & Mass Integrity

검증일: 2026-10-15. 원격 Push 없음. 별도 worktree에서 구현했으며 combat-demo와 기존 QA는 변경하지 않았다.

## 1. 기준 및 작업 보호

- 기준: `c8f791cc03a0c0605ed8f6ebbc30e1bf0f446bdc` (`feature/v1.8.6.0`).
- 작업: `feature/v1.8.6.0.1`, `/workspace/shipyard-v1.8.6.0.1`.
- 기존 `/workspace/Ship_generator`는 `work` / `4186add48573ef9eb4452dbf0dce408d677cef08`, 기존 V1.8.6.0 worktree는 기준 Commit에 보존. 시작/종료 시 두 작업 폴더의 tracked/untracked 사용자 변경 없음 확인.
- 이 보고서를 포함한 로컬 Commit ID는 최종 응답 및 `git log -1`로 확인한다. 보고서 안에 자기 Commit SHA를 삽입해 다시 Commit하는 순환은 만들지 않는다.

## 2. 측정 환경 및 프로토콜

Linux x86_64 / AMD EPYC 9V74 / 표시 메모리 약 9.7GiB / Node 24.19.0 / Chromium SwiftShader / Vite 7.3.7. 동일 호스트, 두 버전의 plain esbuild ESM 번들, 실행을 직렬로 수행했다. 패키지 의존성은 변경하지 않았다.

주 대표: AEGIS **Battleship**, 470m, Standard, Seed 7, MONOLITHIC / WEDGE_CITADEL, 목표 **3,562,847,000kg**, 나머지 우선순위 50. 과거 보고의 정확한 저장본 `aegis470`은 **Cruiser**였다. 이를 Battleship으로 잘못 부르지 않고 과거 사례 연속성 실험과 신규 Battleship 기준을 분리했다.

- Cold: 새 Node 프로세스, 캐시 없음, 첫 생성의 cold JIT 포함. 모듈 초기화 별도 기록(중앙값 약 22–24ms). 표의 generation 시간은 API 호출 전체이며 애플리케이션 모듈 로드를 더하면 cold core 총비용이 된다. 큰 저장본 JSON 읽기/파싱은 벤치마크 입력 fixture 준비로 구분한다. 실제 Order 정규화/검증은 generation 안에 포함된다.
- Warm miss: 관련 없는 100m Patrol을 명시적 target 1e10kg로 먼저 생성한 런타임. 대상 주문서 캐시는 비어 있다. Warmup은 API 시간에서 제외, 프로세스 wall time에는 포함.
- Hit: 같은 프로세스에서 같은 주문/Seed로 **전체 생성기를 다시 실행**. 최종 함선 전체를 캐시 반환한 결과로 속이지 않는다. 기존 physical/source/validation 캐시 재사용만 포함.
- Changed: 첫 warm 표본에서 Seed 8 추가 생성. Before 8,898.9ms → After 5,695.3ms. Seed-only 무효화는 별도의 진단 단위 검사에서도 실제 miss로 확인.
- 주 표본은 cold/warm 각각 N=3, p95 nearest-rank. N=3 p95는 관측 최댓값이며 모집단 성능 보장이 아니다. A/M 및 보조 사례는 N=1로 명시한다.
- AST 함수 계측/V8 CPU 샘플링은 별도 프로세스에서 수행했다. 주 성능 집계에는 포함하지 않았다. 번들 컴파일/개발 서버 모듈 네트워크 비용은 별도이다.

재현 도구와 명령: [benchmark README](../../tests/performance/README.md), 원시 결과 [performance-summary.json](performance-summary.json).

## 3. Cold / Warm / Cache Hit 결과

| 버전 / 상태 | N | 생성 중앙값 ms | 생성 p95 ms | 후속 Hit 중앙값 ms |
|---|---:|---:|---:|---:|
| before / cold | 3 | 9,984.8 | 10,361.1 | 4,185.8 |
| before / warm | 3 | 9,733.2 | 9,792.9 | 3,959.1 |
| after / cold | 3 | 6,811.6 | 7,636.7 | 3,109.6 |
| after / warm | 3 | 6,036.5 | 6,082.5 | 2,965.7 |

주 Cold 중앙값 **9,984.8 → 6,811.6ms (31.8% 감소)**. Cold 후 Hit **4,185.8 → 3,109.6ms (25.7% 감소)**. Warm miss **9,733.2 → 6,036.5ms**, warm 후 Hit **3,959.1 → 2,965.7ms**. Cold 관측 1회는 **7,636.7ms**였다.

브라우저(새 페이지, renderer 생략, N=1):

| 버전 | 모듈 로드 ms | 첫 생성 ms | Hit ms | 셀 |
|---|---:|---:|---:|---:|
| before | 742.8 | 8,546.0 | 3,118.5 | 13,777 |
| after | 771.9 | 6,355.8 | 2,819.3 | 13,777 |

브라우저에서도 같은 결과의 JSON 결정성과 Console 오류 0 확인. 위 시간은 단일 관측이며 개발 서버 초기 로드와 실제 생성 계산을 분리했다. [브라우저 원시 결과](browser-performance.json)

## 4. 추가 표본 및 성능 목표의 한계

보조 사례는 버전별 fresh process N=1, original 주문서 그대로이다.

| 사례 | Before 첫 생성 ms | After 첫 생성 ms | Before Hit ms | After Hit ms | 동일 셀 수 |
|---|---:|---:|---:|---:|---:|
| cruiser470 | 9,022.9 | 5,925.2 | 3,568.9 | 2,724.2 | 12,380 |
| spine300 | 13,086.3 | 9,357.1 | 4,166.7 | 3,649.2 | 24,366 |
| truss300 | 28,561.5 | 20,328.7 | 13,332.7 | 10,032.1 | 38,773 |
| vesper200 | 16,208.6 | 13,153.5 | 4,883.3 | 4,244.5 | 31,330 |
| forge300 | 20,039.2 | 16,363.7 | 7,931.2 | 7,016.6 | 35,540 |

**목표는 부분 달성이다.** 대표 Battleship의 최초 중앙값 5–7초, Hit 5초 이하는 충족했다. SPINE/TRUSS 및 복잡한 기존 200/300m 사례는 최초 목표 미달이며 TRUSS/Forge의 반복 생성도 5초를 넘는다. 기존 세 저장 사례(Cruiser470/Vesper200/Forge300)를 과거 보고처럼 묶은 현재 N=1 사례 중앙값은 최초 **16,209 → 13,154ms**, Hit **4,883 → 4,245ms**이다. 최초 생성 목표를 전체 선박에 달성했다고 주장하지 않는다. 과거 4,646/19,158/6,726ms는 다른 당시 환경의 보고값이며 현재 결과로 덮어쓰거나 직접 속도 비율을 계산하지 않았다.

## 5. 실제 병목과 단계별 프로파일

V8 self-sample 상위(과거 저장 Cruiser470, generation/repeat/query 포함)는 `solidContains` 1,513ms, GC 1,397ms, BVH `visit` 1,390ms, `clipCell` 776ms, bounds `meets` 576ms, `boundsOf` 576ms, `area` 515ms였다. [원시 CPU 샘플](before/cpu-profile.json.gz), [상위 함수](before/cpu-hotspots.json).

Battleship generation 단계 AST 계측 N=1 비교(중첩 inclusive, 합산 금지):

| 함수/단계 | Before 호출 | Before ms | After 호출 | After ms |
|---|---:|---:|---:|---:|
| `physical/build.ts:addPhysicalDesign` | 1 | 5,321.4 | 1 | 4,015.1 |
| `physical/convex.ts:clipCell` | 548568 | 3,130.3 | 402894 | 1,374.2 |
| `physical/layers.ts:pieceLayers` | 27554 | 2,157.6 | 0 | 0.0 |
| `physical/integration.ts:integratedLayerVolumes` | 0 | 0.0 | 27554 | 420.8 |
| `physical/validate.ts:validatePhysicalDesign` | 3 | 1,676.2 | 3 | 677.0 |
| `physical/geometry.ts:physicalSources` | 2 | 84.5 | 2 | 62.5 |
| `physical/policy.ts:createDesignPolicy` | 2 | 2.9 | 2 | 3.1 |
| `physical/policy.ts:finishPhysicalMass` | 2 | 2.8 | 2 | 3.8 |
| `generation/production/build.ts:buildProduction` | 1 | 1,491.7 | 1 | 1,302.1 |
| `generation/macro/plan.ts:createMacroPlan` | 1 | 1.4 | 1 | 1.9 |
| `generation/architecture/layout.ts:architectureLayout` | 1 | 1.5 | 1 | 1.2 |

- `pieceLayers`: build+validation에서 **27,554회**, 최초 Query 준비 시 다시 **13,777회**. 동일 셀을 층별 절단 Geometry로 반복 구성하던 것이 핵심 중복이었다. 새 생산/검증/Query 경로에서는 이 함수 호출 0이며 독립 검산용 함수는 보존했다.
- finite coating 셀은 **13,777개**, 저장 Triangle **134,234개**로 유지했다. 구체적인 원본 셀/재질/두께/정책 SHA가 동일하다. 파생 층 메시만 더 이상 생성하지 않는다.
- Order parsing/validation은 Base generation에 포함되어 별도 독립 숫자로 분리되지 않았다. Macro/Layout, Production Hull/Armor/Coverage/Functional/Installation/Validation, Physical source/build/integration/mass/cache/validation, JSON serialization, Query 준비의 기록을 확보했다. 실제로 분리 계측하지 않은 세부 단계를 측정한 것처럼 쓰지 않는다.
- After coarse(동시에 AST 계측한 실행): Base 4,219ms, Physical build 4,016ms, Physical validation 677ms. Armor 3,199ms / Hull 261ms, outer-area union 291ms, layer integration 223ms, mass ledger 2.3ms, cache store 191ms. 이들 역시 **중첩** 시간이다. 전체 [프로파일](after/battleship470-profile.json).
- 계측 실행 전체: Before 11,734.9ms / After 8,912.5ms. plain cold 중앙값보다 각각 약 17.5% / 30.8% 높다. N=1/JIT 변동을 포함하므로 순수 계측 오버헤드의 확정값은 아니지만, AST 결과를 실제 성능 수치로 쓰면 안 될 정도의 비용임을 확인했다. 사용자 Inspector의 coarse-only 계측 표본 balanced는 6,030ms였다(혼합 warm runtime, 속도 비교 표본 아님).
- Renderer/debug initialization 및 snapshot/draw는 [픽셀 비교 JSON](visual/report.json)에 별도 기록했다. SwiftShader 컨텍스트 준비가 약 275–1,003ms로 변동했으며 최적화 성과로 주장하지 않는다. Normal renderer는 수정하지 않았다.
- JSON은 동일 finite cell 표현을 유지한다. 주 physical JSON 23,183,713 → 23,185,186 bytes(+1,473; ledger 추가). JSON/복제 비용은 남아 있으며 전체 Blueprint 캐시로 우회하지 않았다.

## 6. 적용한 최적화와 Query 계약

최종 Query 전용 재측정: 동일 저장 Battleship의 새 Blueprint 객체 N=3/버전, fixture 파싱/GC 제외, 첫 prepare+shot 포함. Before **2,231.2ms → After 509.5ms**. 새 프로세스에서 생성 직후가 아닌 별도 조회 실험이므로 주 생성 표의 초기 Query 숫자와 혼합하지 않는다. [최종 Query](final-query-performance.json)

최종 검토에서 기존 최소 represented-volume cutoff를 constituent 조회에도 동일하게 적용했다. 작은 유한 층의 누락/오검출 기준을 바꾸지 않기 위한 수정이며 cell/두께/질량은 불변이다. 생성은 Query 준비를 실행하지 않으므로 앞의 generation/hit 수치에는 영향이 없다. 초기 matrix/profile 파일의 first-query 및 전체 프로세스 RSS는 이 마지막 Query 조정 전의 스냅샷이다. 최종 조회 시간/retained 메모리는 별도 재측정 파일을 기준으로 한다. 실제 함선 Ray40/최소 체적 경계 단위 검사와 최종 Chromium Probe(8 material intervals, 오류0)를 다시 확인했다([browser probe](final-browser-probe.json)).


1. 실제 닫힌 convex mesh를 내부 기준점의 tetrahedron들로 분해하고, 원래 depth plane 아래의 누적 체적을 determinant로 적분한다. 차이를 층별 체적으로 사용한다. 밀도·두께·면적·표면·겹침 제거와 경계 공차는 그대로다.
2. Query는 전체 셀의 supporting planes + 원래 층 depth planes를 교차한다. 유한 체적, 측면 탈출, 곡면의 실제 faceted 경계와 entry/exit를 유지한다. 무한 평판 근사로 교체하지 않았다.
3. 계측된 vector/array 할당 병목에 scalar cross/normal/area/bounds/half-space 계산을 적용했다. 연산 순서와 threshold는 보존했고 실제 생성 결과 SHA/픽셀로 확인했다.
4. `preparePhysicalQueries(ship)`를 명시적으로 호출하여 출항 전 준비할 수 있고, 반환 handle의 `.probe(...)`를 반복 사용한다. `armorRayProbe`는 mutation을 검사하는 one-shot 편의 API다. handle 자체는 immutable snapshot이며 Blueprint 수정 후 기존 handle은 이전 설계를 계속 조회한다. 다시 prepare하면 새 입력으로 무효화한다.
5. Normal 생성/렌더링은 query BVH/Debug geometry를 만들지 않는다. generation 단계 함수 프로파일에 Query 준비 호출 0. 명시적 Probe 또는 Prepare 시 최초 구축한다. Debug ON/OFF가 실제 방호 데이터를 바꾸지 않는다.

## 7. Cache 무결성 및 메모리

물리 design 캐시 1개, source geometry 캐시 4개, ordinary validation 성공 캐시 1개라는 기존 상한을 유지했다. source/validation은 전체 내용 signature를 사용하며 explicit overlap 검사는 shortcut을 사용하지 않는다. design key에 registry/schema/architecture/family 및 legacy armor fallback을 명시했다. Query WeakMap은 schema/registry/재질/층/실제 셀/두께/원래 facet planes/미지정 SPINE geometry의 전체 signature를 확인한다. 캐시와 진단은 직렬화되지 않는다.

검증: 동일 입력 hit/miss JSON 일치, seed-only 실제 miss, 우선순위·치수·원본 Geometry 변경, armor/hull 재질·layer nominal thickness·physical vertices 수정 후 query 무효화, 준비된 snapshot 독립성, Blueprint load/migration, debug-off 동작.

| 상태 | Before peak RSS MiB | After peak RSS MiB | Before 종료 heap 중앙값 MiB | After 종료 heap 중앙값 MiB |
|---|---:|---:|---:|---:|
| cold | 813.3 | 819.8 | 566.1 | 494.1 |
| warm | 1,191.7 | 1,245.8 | 588.4 | 430.3 |

Query 캐시 자체는 Vesper200 / 31,330셀 표본에서 Blueprint를 유지한 채 explicit GC 전후로 분리 측정했다(N=5 새 객체 생성/해제). 기존 **94.5MiB → 새 110.1MiB**, 즉 **+15.6MiB**다. 전체 내용 signature와 immutable snapshot/compiled planes의 비용이다. 속도는 개선됐지만 **메모리 감소라고 보고하지 않는다**. UI의 plane 수치 저장 추정 약 9.7MiB는 JavaScript 객체/BVH/key/metadata 비용을 제외하므로 실제 retained heap과 같지 않다.

해제 후 첫 cycle에는 transient GC 잔류 약 70MiB가 있었으나 후속 cycle은 약 5.5MiB로 돌아왔고 누적 증가가 없었다. [Before](query-memory-before.json) / [After](query-memory.json). 제한된 5회 결과는 장시간 브라우저 누수 부재의 증명이 아니다. Peak RSS는 소폭 증가했고 복잡한 사례의 메모리는 여전히 크다.

## 8. 장갑 질량 독립 감사 — 과거 동일 Geometry 사례

실제 과거 AEGIS470 **Cruiser** / Seed7 / MONOLITHIC / WEDGE_CITADEL / Standard를 고정하고 우선순위만 바꿨다. 목표 3,562,847t, 나머지 우선순위50. 각 버전에서 동일 정책/재질/두께/셀 SHA 일치. mass는 층 체적×실제 층 밀도의 합이며 render 메시를 별도 합산하지 않았다.

| 정책 | Before Armor t | After Armor t | 차이 kg | After Hull t | nominal 장갑 mm | 재질 |
|---|---:|---:|---:|---:|---|---|
| survivability | 835,496.813572 | 835,496.813577 | 0.005607 | 65,985.600 | 169.46–511.91 | TUNGSTEN_COMPOSITE, CERAMIC_COMPOSITE |
| mobility | 506,900.009980 | 506,900.009981 | 0.001205 | 20,006.352 | 152.08–459.42 | TITANIUM_ARMOR |
| balanced | 510,117.312237 | 510,117.312241 | 0.004663 | 65,985.600 | 160.33–484.33 | CERAMIC_COMPOSITE |

독립적인 기존 plane clipping + 면적/높이 체적과 새 determinant 적분을 원본 저장본 **12,380셀 전체**에서 비교했다. 최대 개별 체적 차이 2.091e-7m³, 전체 absolute 체적 차이 합 9.263e-7m³, Hull+Armor 762,828,581.913595 → 762,828,581.916774kg(**+0.003178kg**). 아주 작은 fragment에서는 기존 cap/EPS 오차 때문에 상대 차이가 크게 보이는 사례가 있으며 [전체 mismatch](before/integration-comparison.json)에 보존했다. 전역 질량과 실제 경계 정확도에 비해 작은 수치 차이지 밀도/두께 감소가 아니다.

새 tetra 1/3/2/2 분기와 임의 depth를 독립 clipping과 비교한 단위 검사도 통과했다. 세 정책의 모든 층 sum(volume×density), Hull+Armor scalar 합, ledger 합이 일치하고 정확히 같은 중복 셀은 0개다. 실제 겹침 검사는 별도로 balanced 12,376셀에서 full finite-volume validation을 실행해 오류 0 확인([deep-overlap](audit/deep-overlap.json)).

## 9. 주 Battleship의 실제 Before/After 질량 및 설계 경쟁

같은 target/architecture/seed지만 priority를 바꾸면 기존 생성기가 Hull/Armor 배치까지 달리할 수 있다. 다음은 실제 전체 pipeline 결과이며 위의 frozen-geometry 실험과 분리한다.

| 정책 | Before Armor t | After Armor t | After Hull t | After 총 추정 dry t | target 잔여 t | 재질 |
|---|---:|---:|---:|---:|---:|---|
| survivability | 1,007,720.999290 | 1,007,720.999295 | 72,904.809 | 2,269,730.849 | 1,293,116.151 | TUNGSTEN_COMPOSITE, CERAMIC_COMPOSITE |
| mobility | 703,461.915191 | 703,461.915194 | 21,625.385 | 1,503,210.005 | 2,059,636.995 | TITANIUM_ARMOR |
| balanced | 670,631.806836 | 670,631.806847 | 71,325.409 | 1,520,383.280 | 2,042,463.720 | CERAMIC_COMPOSITE |

여기서는 MOBILITY의 armor mass가 BALANCED보다 크다. 두 재질을 무조건 “경량/중량”으로 서열화하면 안 된다. 기존 titanium은 **4,500kg/m³**, ceramic 평균은 **4,300kg/m³**이며, 이 두 주문은 같은 nominal 두께 범위(218.63–660.45mm)로 이미 포화되어 있다. 실제 armor volume도 156,324.87 vs 156,072.33m³다. 따라서 titanium 장갑 자체는 더 무겁지만 경합금 Hull 및 다른 분배로 **총 dry mass는 낮다**. 이를 숨기거나 새 재질 밸런스를 도입하지 않았다. ARMOR는 193.98–585.98mm의 Tungsten/Ceramic 조합으로 더 무거운 방호를 얻는다.

정책별 실제 분배(kg)와 면적/체적/정책 전체는 [primary-policy-details](primary-policy-details.json)에 있다. 예: armor allocation ARMOR 1,018,385,909.8 / MOBILITY 772,930,078.5 / BALANCED 813,799,125.4kg; propulsion은 각각 442,873,651.3 / 632,533,707.5 / 446,012,632.0kg다. 모든 allocation의 합은 고정 target이다. 미래 시스템 예약은 설치된 질량으로 더하지 않는다.

## 10. Ledger 및 예산 수정

새 optional version-1 ledger는 `HULL_SHELL`, `ARMOR`, `STRUCTURE`, `CORE_EQUIPMENT`, `MOUNTED_EQUIPMENT`, `PLATFORM`, `OTHER_ESTIMATED`를 구분한다.

- Hull/Armor: `GEOMETRY_DERIVED` — 실제 finite layer volume × density.
- Frame 18%, unresolved/support 10%: `LEGACY_ESTIMATE` — 실제 frame/reactor/tank가 없는 proxy. 100% legacy reference는 다시 더하지 않는다. 이 비율이 실제 골조와 일치한다고 검증한 것은 아니다.
- Core/installed equipment: 기존 실제 존재 assembly 또는 saved equipment solid volume×160kg/m³의 `ESTIMATED` representation mass. 실제 장비 사양 질량으로 위장하지 않는다. core part ID 중복과 known armor IDs는 제외한다.
- Platform: 소유한 platform solid volume×2800kg/m³, mounted equipment에서 제외하고 **한 번** 합산한다. 신규 설치되지 않은 자유 무장은 계산하지 않는다.
- kg/t, mm/m, m²/m³ 변환 및 각 composite thickness 합/nominal density/volume-weighted 실제 질량 검증. 장갑 면적만으로 목표 질량을 덮어쓰지 않는다.
- Base dry vs mounted dry, base/mounted remaining/violation을 분리했다. `maximumAllowedMassKg=null`: 기존 Order target에 새로운 최대 운용 질량 의미를 추가하지 않았다. Consumables는 포함하지 않는다.
- 실제 버그: 기존 validator는 자유 장비가 하나라도 있으면 기본 설계의 target 초과도 면제했다. 이제 **기본 설계 초과는 항상 거절**하고, 유효한 기본 함선에 외부 장비를 더해 target을 넘는 경우는 경고/보고로 유지한다. 이 변경은 과거 잘못된 허용을 보존하지 않는 의도적 수정이다.
- 내부 공간/하중/급탄/배전 검사를 free-mount 조건으로 추가하지 않았다. 실제 프레임·내부 장비와 core representation의 재료 체적 중첩을 완전히 풀어 계산하는 시스템은 아직 없다. estimated 항목을 정밀 실측으로 취급하지 않는다.

## 11. SPINE 점검 및 미완료 물리 사양의 노출

`architecture/layout.ts`의 SPINE_AND_MODULES 축은 `SPINE` / `axial-weapon`, 실제 finite loft로 Normal에 렌더링된다. 중앙 bridge/축 지지체도 있어서 모든 SPINE을 Hull 또는 Armor로 분류할 근거가 없다. 기존 `physicalSources`는 이 타입을 일괄 제외했다.

이번에는 원래 stations/shape와 실제 position/rotation으로 **렌더된 유한 삼각형 경계**를 lazy query한다. 교차 지점·법선·구조 ID·purpose를 `unresolvedCrossings`에 반환하고 `complete=false`, `SPINE_MATERIAL_AND_SHELL_THICKNESS_UNSPECIFIED`를 명시한다. 알려진 armor/hull 층의 기존 ID/순서는 바꾸지 않는다. SPINE 표본의 center/rigid-rotated ray에서 기존 material hit 0은 유지되지만 실제 경계 교차 2개를 더 이상 빈 공간으로 숨기지 않는다.

**SPINE 재질/외피 두께는 미해결이다.** 실제로 없는 재료 사양이나 완전 solid-metal 질량, 골조 생성/연결 그래프를 발명하지 않았다. 따라서 이 영역의 탄도 방호층은 여전히 확정할 수 없고 결과는 부분 조회다. Inspector에도 그 사실을 표시한다.

## 12. Ray / Blueprint / Normal 보존

- 실제 저장 함선 4척의 **40 ray**: 정면/30/60/89.999°, armor/hull 경계, 다층, 실제 faceted 곡면, 빈 공간, 여러 구간, rigid 회전+이동, SPINE. 층/재질 ID와 순서 동일. Entry/Exit/LOS/측정 두께 최대 수치 차이 6.11e-10(각 기록의 m/mm 단위), 점/법선 성분 1e-6 이내, 입사각 1e-4° 이내. [수치 결과](audit/rays.json)
- 극단 스침각·edge escape·bare Hull·유효하지 않은 ray는 기존 단위 검사 보존. 실제 연속 smooth curve 모델이 아니라 원래 faceted approximation이며 기존 warning을 유지한다.
- 전체 비물리 Blueprint 필드 **6건 SHA exact**: generatorVersion과 새 physicalDesign만 제외했다. Hull, Armor, Macro, Engine/Connector, Meso, 기존 무장/플랫폼/좌표/저장자료 모두 동일. 5종 Architecture 대표 포함. [hash](blueprint-regression.json)
- 모든 주 cold/warm hit의 같은 입력 JSON exact, 보조 5건도 repeat exact. Query/진단 캐시가 JSON에 섞이지 않음 확인.
- Schema 2 유지, physical contract/material registry/DesignPolicy version 유지. patch generation tag `1.8.6.0.1`와 additive ledger만 확장. 구버전은 ledger 없이 그대로 load. 새 patch tag는 ledger 누락 거절. [full Blueprint validation](blueprint-validation.json)
- Historical import/export/reload exact, 자동 재작성 없음. V1.8.5.5는 명시적 migration에서만 default estimate 표기. 기존 형상/장비 보존 확인.
- **Normal 4척, 960×620 PNG byte exact**: pristine 렌더러 vs patch 렌더러 동일 카메라. [visual report](visual/report.json)

| 사례 | Normal 픽셀 |
|---|---|
| cruiser470 | exact 동일 |
| vesper200 | exact 동일 |
| forge300 | exact 동일 |
| spine300 | exact 동일 |

대표 이미지: [Before](visual/cruiser470-before.png) / [After](visual/cruiser470-after.png) / [Thickness](visual/Armor-Thickness.png) / [Materials](visual/Physical-Materials.png) / [Coverage](visual/Physical-Coverage.png). 이미지를 실제로 열어 Normal 및 Thickness 형상을 확인했다.

## 13. Production UI 및 선택적 자동 검사

- Vitest **27 통과**: 기존 foundation 9 + 패치 7(총16), 관련 free-mount 11. free-mount 파일의 무관한 7개는 필터로 실행하지 않았다. [실행 로그](targeted-tests.txt)
- 재질 5/3 registry, composite layer sum/density/mass, finite integration, 단위/ledger/예산, seed/mutation cache, query, migration, external-only 조건, 5종 platform, mirror/battery, collision/clearance, move/rotation/history/undo/redo 관련 선택 검사.
- Production Chromium **24 통과**, final Console error **0**. Debug3종, 실제 Probe/prewarm, export/import/reload, legacy explicit migration, free editor 토글, profile opt-in, 7항목 ledger, 진단 비직렬화, 불가능한 target 거절과 기존 설계 보존. [UI report](ui/report.json), [Inspector](ui/patch-diagnostics.png), [export](ui/export.json.gz).
- TypeScript `tsc --noEmit` + Production Vite build 통과. 기존 >500kB chunk 경고는 남음. [build](build.txt)
- full finite overlap 1건과 3 full Blueprint validation + 신규 ledger 제거 거절 별도 script 검사. 이 숫자를 Vitest 개수에 합쳐 부풀리지 않았다.
- **600개 이상 전체 suite, 전체 Architecture×Seed, 역사적 전체 픽셀, combat-demo 테스트, 장시간 stress는 실행하지 않았다.** 나머지 Architecture 3종의 전수 회귀를 주장하지 않는다. 실제 Architecture/Family/무장 규격/장착 알고리즘은 수정하지 않았다.

## 14. 실패 실험 및 남은 한계

- 최초 unrelated Patrol warmup은 기존 target 정책에서 실제 budget 거절. 양쪽에 명시적 warmup target만 추가해 프로토콜 수정; 대상 Battleship 입력 불변. [실패](before/warmup-failed.txt)
- 신규 테스트 fixture 2건이 초기에 실패: policy target만 바꾸고 order/allocation을 동기화하지 않았던 fixture, 120.00000000000001m에 exact integer equality를 요구했던 fixture. 실제 정책 제약과 부동소수점 공차를 반영해 새 fixture 수정. 기존 테스트 기준을 약화하지 않았다. [실패](test-fixtures-failed.txt)
- 첫 visual QA script에 초기화 전 `y` 참조 오류가 있어 수정하고 재실행. 제품 형상 불일치가 아님. [실패](visual-harness-failed.txt)
- 첫 UI session은 약 57MB pretty JSON 전체를 CDP로 다시 가져오는 단계에서 `Target crashed`. 마지막 전체 전송을 브라우저 내부 동등 비교/작은 summary 반환으로 바꾼 후 24검사 통과. 원인을 장기 heap 분석으로 확정하지 않았고 실제 대형 JSON/브라우저 메모리 비용이 사라졌다고 주장하지 않는다. [실패](ui-transfer-failed.txt)
- 다수 셀의 접촉 절단/겹침 제거와 반복 Base generation, JSON/clone이 남은 병목. TRUSS 38,773셀과 복잡한 200/300m 생성은 성능 목표 미달.
- query retained 메모리 증가 약 17MiB, 전체 peak RSS 소폭 증가. 5-cycle weak release만 확인, 장기 누수 검증은 하지 않았다.
- SPINE 재질·외피 사양은 unresolved. 원래 nonconvex Hull의 faceted skin approximation/cap warnings, 1e-7m 기하 공차 및 미세 조각의 수치 오차도 남음. 실제 관통/구조 프레임은 범위 밖이다.

## 15. 변경 파일 및 출고 상태

핵심: `src/physical/{integration,diagnostics,unresolved}.ts` 신규, `build/validate/probe/convex/policy/types` 수정, `generate.ts`와 root Blueprint version validation, scalar hot paths `armor/panels`, `armor/geometry`, `integration/contours`, `weapons/collision`, 기존 Inspector/layout, version metadata. 테스트/benchmark와 QA 문서 추가. free-mount 및 combat-demo 구현 파일은 수정하지 않았다.

실제 전체 파일 명세: [CHANGED_FILES.txt](CHANGED_FILES.txt). 데이터 계약 설명: [PHYSICAL_GEOMETRY_PATCH.md](../../docs/PHYSICAL_GEOMETRY_PATCH.md).

로컬 Commit만 수행한다. 원격 Push/Force Push/PR 생성/원본 work 폴더 덮어쓰기 없음. 주 대표 성능 목표는 충족했고 전체 표본 성능 목표는 부분 미달이라는 상태로 보고한다.
