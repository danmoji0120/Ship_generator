# V1.8.6.0.2 — 구현 및 제한적 QA

## 작업 기준 / 상태

- Branch: `feature/v1.8.6.0.2`, worktree: `/workspace/shipyard-v1.8.6.0.2`.
- 기준: `f8b8e74ed28bab5764131c9b258e4796305a4b5e` (V1.8.6.0.1).
- 원래 `/workspace/Ship_generator`의 `work` / `4186add48573ef9eb4452dbf0dce408d677cef08`, V1.8.6.0 및 V1.8.6.0.1 worktree는 수정하지 않았다. 시작 시 모두 clean이었다.
- 기존 QA/Blueprint와 combat-demo를 수정하지 않았다. 원격 Push / Fetch / Force Push 없음.
- 구현 Commit은 이 보고서와 함께 로컬에 저장한다. 최종 SHA는 완료 응답 및 `git log -1`에서 확인한다.

## 실제 조사한 경로와 새 파이프라인

기존 발주 UI (`src/ui/layout.ts`, `src/main.ts`)는 여섯 우선순위와 Legacy 예약 슬롯 옵션을 읽어 기존 `ShipOrder`를 생성했다. 기존 `generateBlueprint`의 Production 경로는 Role requirements → Macro/Hull → Armor → functional equipment → weapon planner → PhysicalDesign을 실행했다. V1.8.6.0.1의 finite skin builder, material registry, ledger, cache, lazy query 및 Free-Mount 저장 경로를 조사하고 재사용했다.

신규 `generateProcurementBlueprint`는 native order 검증 → 기술/재질 사전 검사 → Architecture/호환 Family 후보 → 공통 Hull → 공통 Armor 및 실제 finishing coverage → 기존 추진/항행 housing → exterior detail/meso → 공통 finite physical geometry → 질량/비용/강제 조건 확인 → Blueprint 순서다. **공격 무장 composition planner, role-specific weapon requirements, XL 예약을 호출하지 않는다.**

새 Family 후보 탐색은 기존 `FAMILY_COMPATIBILITY`와 구조 검증을 그대로 사용한다. REQUIRE는 지정 Architecture만, AUTO/PREFER는 최대 세 Architecture와 각 호환 Family를 탐색한다. 실패 후보는 `candidateRejections`에 기록한다. 조선소와 네 우선순위에 따라 AUTO 가중치를 선택하며 ECONOMY는 단순한 Architecture를 더 선호한다. 같은 Seed에서 선택 순서가 고정된다.

신규 함종은 Corvette / Frigate / Destroyer / Cruiser / Battlecruiser / Battleship / Patrol Ship이다. 무장 특화 Legacy Missile Ship / Spinal Gun Ship은 로드·원래 계약 재생성 경로에 보존했다. 명시적 새 발주 변환 시 Cruiser로 바꾸며 원래 Role과 변경 경고를 기록한다. 신규 발주에 척추포 또는 척추포 구조 예약 옵션은 없다.

## 데이터 계약 / Legacy 호환

- Blueprint `schemaVersion: 2` 유지. 새 생성기 태그 `1.8.6.0.2`와 optional `procurement` 확장을 추가했다. 이 확장이 없는 과거 저장본은 그대로 읽고 렌더링한다.
- Native `ProcurementOrder.version = 1.8.6.0.2`: yard, class, lengthM, seed, targetMassKg, optional maximumBaseMassKg, primary/secondary priorities, Architecture AUTO/PREFER/REQUIRE, main/auxiliary/hull material selection, distribution, 제한적 critical-center thickness requirement, optional cost/tech ceiling.
- `procurement.order`가 발주 권위 데이터다. `b.order`는 기존 Hull 함수와 저장 구조를 위한 검증된 geometry DTO다. DTO의 firepower/missile/sensor는 고정 0이며 native UI나 정책에 무장 선택권을 부여하지 않는다. 상호 불일치 시 validation 실패다.
- `procurement`: PASS/COMPROMISE, 선택·대체 이유, 실제 요구 결과, 상대 비용 명세, core system IDs, 추정 질량 신뢰도와 필요 시 후보 탈락/명시적 변환 기록을 저장한다. REJECT는 출고 Blueprint를 만들지 않는다.
- Legacy `generateBlueprint` 기본 계약은 V1.8.6.0.1 그대로다. Native UI만 새 API를 사용한다. 구형 발주/저장본을 로드하면서 네 우선순위로 바꾸거나 설치 무장을 삭제하지 않는다.
- Legacy 로드 시 신규 Submit을 막고 `Replay original generation contract`, `Convert to new unarmed order`, `New procurement order`를 제공한다. 재생성은 저장된 Seed/Order/Architecture/Family/버전을 사용한다. Schema 1 및 지원하지 않는 재생성 버전은 원본 조회만 지원한다.
- 명시적 변환은 별도 새 발주를 만들고 과거 공격 우선순위 제거·재설계 경고를 기록한다. 원래 함선은 성공적인 Submit 전까지 유지한다. 기존 플레이어 Free-Mount는 종전의 exact-anchor retention 규칙으로 보존하거나 재생성을 거절하며, 자동 Legacy 무장은 새 기본 설계로 복사하지 않는다.

## 네 우선순위의 실제 효과와 경쟁

Primary 100, Secondary 70, 나머지 40으로 공통 가중치를 만든다. 구조·최소 피복·기본 추진/항행의 바닥 예산을 확보한 뒤 남은 질량 계획 자원을 정규화해 분배한다. 실제 질량은 target 값으로 덮어쓰지 않는다. soft target이 바닥 요구량보다 작으면 별도의 계획 예산과 미달 사유를 기록한다. 명시적 maximum은 계획과 실제 추정 base 질량 모두에 적용한다.

- ARMOR: 더 큰 장갑 배분, 핵심 재질·두께 선택, 실제 finite layer 질량 증가.
- MOBILITY: 경합금 Hull, 티타늄 장갑, 낮은 피부 질량과 추진 지원 예약. 실제 추력/기동 보너스는 계산하지 않는다.
- ENDURANCE: 운용 지원 예약과 티타늄 Hull 선호, 분산/구획/중복성 정책. 골조·격벽·탱크·원자로를 생성했다고 주장하지 않는다.
- ECONOMY: 저비용 강재 선택, 선택적 shoulder/rear-cradle 제조 감소, AUTO Architecture 복잡도 선호. 강재의 더 큰 질량은 그대로 지불한다.

동일 AEGIS / Battleship / 470m / MONOLITHIC / WEDGE_CITADEL / Seed 7 / target 3,562,847t / maximum 5,000,000t. 재질·질량·피복은 실제 생성 결과다. 비용은 백만 상대 지표이며 화폐가 아니다. 두께는 **핵심 노출 facet 중심의 최소 실제 material 경로**(법선 방향, 각 설계 397개, ECONOMY 406개)를 표기한다. 전체 표면 최솟값이 아니다.

| Priority | 주 장갑 / Hull | 중심 최소 mm | Armor t | Hull t | Base 추정 t | Cost ×10⁶ |
|---|---|---:|---:|---:|---:|---:|
| ARMOR | TUNGSTEN_COMPOSITE / HIGH_STRENGTH_STRUCTURAL_STEEL | 474.21 | 785,995.0 | 60,595.7 | 2,018,210.4 | 3,517.49 |
| MOBILITY | TITANIUM_ARMOR / LIGHT_STRUCTURAL_ALLOY | 256.50 | 242,196.0 | 18,059.9 | 939,122.2 | 940.34 |
| ENDURANCE | CERAMIC_COMPOSITE / TITANIUM_STRUCTURAL_ALLOY | 322.46 | 301,515.4 | 37,338.3 | 1,078,115.1 | 995.79 |
| ECONOMY | ARMORED_STEEL / HIGH_STRENGTH_STRUCTURAL_STEEL | 322.46 | 431,140.8 | 59,017.4 | 1,179,944.9 | 635.60 |
| BALANCED | CERAMIC_COMPOSITE / HIGH_STRENGTH_STRUCTURAL_STEEL | 322.46 | 293,041.3 | 59,017.4 | 1,041,899.9 | 911.16 |

ARMOR/MOBILITY는 실제 밀도·finite 체적 질량과 두께가 다르다. ECONOMY는 BALANCED보다 약 30.2% 저렴하지만 더 무겁다. ENDURANCE를 ARMOR와 같은 두께 강화로 복제하지 않았다. ENDURANCE와 BALANCED의 핵심 두께가 같은 것은 별도 운용 지원/중복성 정책에 자원을 배분하기 때문이다.

계획 배분 (10⁶ kg). 아래는 설비 실제 설치 질량이 아니라 경쟁하는 예약 예산이며 각 행 합계는 3,562.847이다. 실제 설치 질량은 위 표 및 ledger에서 별도 조회한다.

| Priority | Structure incl. shell allowance | Armor | Propulsion | Endurance | Basic navigation | Core allowance |
|---|---:|---:|---:|---:|---:|---:|
| ARMOR | 981.48 | 1,175.19 | 689.29 | 605.71 | 25.30 | 85.88 |
| MOBILITY | 673.64 | 699.22 | 1,377.03 | 668.72 | 33.00 | 111.24 |
| ENDURANCE | 724.95 | 680.44 | 713.78 | 1,302.50 | 32.07 | 109.11 |
| ECONOMY | 781.65 | 895.06 | 875.86 | 826.70 | 42.02 | 141.56 |
| BALANCED | 783.35 | 883.35 | 880.29 | 831.12 | 42.28 | 142.46 |

주/보조 장갑: ARMOR는 Tungsten / Ceramic, MOBILITY는 Titanium / Titanium, ENDURANCE와 BALANCED는 Ceramic / Ceramic, ECONOMY는 Steel / Steel을 선택했다. Full allocation·future policy·실제 물리 피복 면적은 [controlled-comparisons.json](controlled-comparisons.json)에 있다. 두께 범위/면적 포화 및 형상 경계 taper를 숨기지 않았다.

## 재질 선택 / 방호 분포 / 최소 두께

공식 장갑 5종과 Hull 3종의 기존 registry, 밀도와 복합 layer 정의를 그대로 사용했다. AUTO는 조선소/정책/기술로 선택한다. PREFER는 기술 부족 시 대체하며 Hull 최소 예산 제약에 경량 대체를 허용한다. REQUIRE는 해당 scope에 실제 적용하거나 거절한다. 비용/질량 제약 전체에 대한 모든 조성의 전역 탐색은 제공하지 않는다.

AEGIS/VESPER 기술 4, FORGE 3, SEREIN 5의 기존 정책 값을 재사용했다. 사용자 기술 ceiling은 조선소 능력을 높이지 못한다. 기본 재질은 AEGIS Ceramic, VESPER Titanium, FORGE Steel, SEREIN Nano(가용 기술 충족 시)이며 Primary/Secondary에 따라 조정한다. 같은 ID의 밀도나 성질은 어느 조선소에서도 변하지 않는다.

- Main selection scope: 실제 `CRITICAL` 장갑판. Auxiliary: 그 외 실제 장갑판. Hull은 독립된 실제 Hull shell이다.
- PREFER Ceramic: 실제 적용 PASS. REQUIRE Titanium + Structural Steel Hull: 실제 scope 적용 PASS.
- AEGIS PREFER Nano: 명시적 기술 대체와 COMPROMISE. REQUIRE Nano: `REQUIRED_MATERIAL_TECH_UNAVAILABLE`.
- REQUIRE Titanium + 1kg maximum: 거절. Unknown material / unsupported FORE full-zone specification: 명시적 schema 거절.
- 복합 layer 합계/밀도/실제 질량, native 모든 표면의 layer mass 합계는 관련 자동 테스트로 검증했다.

세 distribution은 기존 Hull과 필수 구조 장갑을 보존하면서 신규 주문의 optional finishing course를 다르게 만든다. CITADEL은 optional finish 0, BALANCED는 측면·끝 피복, BROAD_COVERAGE는 기존 설치 가능한 모든 방향 finishing을 사용한다. 실제 표면 측정으로 coverage를 다시 계산한다. ECONOMY의 선택 구조 생략은 별도의 비용 정책이다.

| Distribution | Finish 수 | 핵심 중심 최소 mm | Armor t | T / B / P / S / F / A coverage % |
|---|---:|---:|---:|---|
| CITADEL | 0 | 399.85 | 254,558.1 | 62.9 / 15.0 / 23.0 / 23.0 / 56.1 / 19.7 |
| BALANCED | 38 | 322.46 | 293,041.3 | 62.9 / 15.0 / 99.6 / 99.6 / 99.2 / 98.8 |
| BROAD_COVERAGE | 45 | 270.87 | 381,305.4 | 98.0 / 98.5 / 99.6 / 99.6 / 99.2 / 98.8 |

위 coverage는 기존 생성기의 유효 source 표면 샘플 비율이다. PhysicalDesign의 surviving outer area / eligible area는 별도 finite-skin 면적 유지율이며 함선 전체의 탄도 방호율로 바꿔 표시하지 않는다. 존재하지 않는 판이나 빈 공간을 방호로 채우지 않는다.

**최소 두께 지원 한계:** `CRITICAL_ZONE / EXPOSED_FACET_CENTERS`만 지원한다. 각 핵심 facet에서 가장 큰 surviving 외측 triangle의 중심을 실제 finite volume에 법선 방향으로 Probe한다. 해당 plate의 실제 composite material intervals만 합산하고 Hull은 제외한다. UI에 이 범위와 전체 표면/가장자리 보장 불가를 명시했다. FORE/AFT/PORT/STARBOARD/DORSAL/VENTRAL 전체 구역 최소 두께 보장은 이번 버전에 구현하지 않았다. 300m 기본 설계는 397개 중심에서 242.352mm를 확인했다. 임의의 중심 요구 미달은 `REQUIRED_CRITICAL_CENTER_THICKNESS_UNAVAILABLE`로 거절한다. 추가로 REQUIRE Titanium + Steel Hull + 현실적인 200,000t 상한에서 실제 추정 base 195,033.6t으로 통과했다(장갑 예산에 따른 실제 중심 두께 44.08mm, REQUIRE 재질 유지). 2,000mm 중심 요구도 397개 중심의 실제 경로 2,000mm 및 base 496,365.8t으로 통과했다. 이는 중심 범위의 검증이며 가장자리 보장은 아니다. [additional-constraints.json](additional-constraints.json)에 기록했다.

## 질량 및 비용

V1.8.6.0.1 ledger를 사용한다: Hull shell + Armor + 추정 Structure + 추정 Core + 추정 Other = base. 실제 장착된 player equipment + owned platform을 별도 합산해 operational dry estimate로 표시한다. 탄약/추진제는 포함하지 않는다. 구조/지원은 아직 historical reference의 18%/10% 추정이며 설계 계산값과 동일 정밀도라고 표시하지 않는다. 따라서 maximum 준수는 **현 추정 모델에 대한 판정이며 실제 건조 질량의 인증이 아니다.**

Target는 soft objective다. maximum이 없을 때 target 미달(초과)을 `COMPROMISE`로 기록한다. maximum 위반은 `REJECT`다. 무장/플랫폼 추가는 base cap과 분리하며 내부 공간/급탄/전력/골조 응력 검사를 장착 거절 조건으로 추가하지 않았다.

상대 비용 모델 `MATERIAL_AND_FABRICATION_INDEX_V1`:

```
material = Σ(actual finite layer-derived mass kg × registry manufacturingCostIndex)
fabrication = Σ(physical outer m² × [8+3×(layerCount−1)] × [1+0.1×requiredTech])
              + length² × (12×actual structural modules + 6×connectors + 2×distinctMaterials²)
estimated frame/core = 0.3×estimated structural kg + 2×estimated core kg
total = (material + fabrication + estimated frame/core) × yardProcessFactor
```

Process factor: AEGIS 1, VESPER 1.12, FORGE .85, SEREIN 1.25. 계수는 명시적인 초기 게임 제조 지표이며 실제 공정 가격/재료공학 성능이 아니다. 미설치 무장과 미래 내부 설비 비용을 가짜로 합산하지 않았다. `maximumCostIndex`를 실제 계산과 비교해 초과하면 거절한다.

## 비무장 출고 / 장착 / Legacy 증거

모든 통제 발주에서 자동 함포·미사일·척추포 0, 빈 예약 슬롯 0, 기존 실제 엔진과 기본 항행/control housing은 유지됐다. nav housing은 기존 sensor-role 외형을 기본 항행용으로 재사용한 것이며 전투 탐지/원자로/항속 성능을 구현한 것으로 보고하지 않는다.

Production 브라우저에서 실제 canvas picking → Worker external-fit 검증 → gun-105 및 missile-small 설치를 수행했다. 이후 mounted mass 증가/base mass 불변, 삭제, Undo/Redo, JSON 다운로드·로드의 exact 일치를 확인했다. Mirror/Battery, 이동·회전, 5종 platform, 실제 support/arc, 내부 공간 무시와 저장 데이터 변조 거절은 재사용한 Free-Mount 자동 테스트로 확인했다. 해당 모든 드래그 조작을 브라우저에서 반복한 것은 아니다.

**외장 척추포와 전용 고정식 함포 모델은 현재 Free-Mount catalog에 없다.** 이번 작업에서 모델/대형 지지대 시스템을 새로 만들지 않았으며 설치 완료로 보고하지 않는다. 기존 turret/missile/utility와 저장된 Legacy integrated XL은 보존한다.

- [legacy-seed-proof.json](legacy-seed-proof.json): 동일 470m Legacy Order/Seed를 pristine f8와 현재 코드에서 생성한 **25,425,993-byte JSON 및 SHA-256 완전 일치**. 기존 기본 API 버전도 1.8.6.0.1로 유지.
- [visual/report.json](visual/report.json): VESPER 200 / Cruiser 470 / SPINE 300 저장본을 같은 pose에서 원래/현재 renderer로 그린 Normal PNG **3/3 byte 일치**. 전체 UI 픽셀은 의도적으로 바뀌었으며 이 검사는 함선 viewport만 비교한다.
- Production에서 55MB VESPER 저장본을 load/export해 원본 weapons/materials/geometry를 포함한 JSON hash 일치. 설치 무장 보존 화면은 아래 참조.
- 기존 S/M/L/XL registry와 실물 Geometry는 변경하지 않았다. Node/Chromium `Math.cbrt` 차이(최대 3.553e−15m)가 과거 JSON-string equality에 걸리던 오류를 발견했다. `sameMountStandard`는 최대 16 machine epsilons의 숫자 반올림만 허용하고 크기/설치 방식/cost/키는 그대로 검증한다. 1µm 변경도 거절하는 테스트를 추가했다. 저장 Geometry는 다시 쓰지 않는다.

## 성능 비교

동일 환경(Node + headless Chromium 가능 Linux), 세 대표 Legacy 주문. 각 행 **새 프로세스 cold 계산 1회 + 동일 Order 전체 반복 1회**다. N=1이므로 p95/통계적 중앙값을 주장하지 않는다. JS module initialization은 별도 JSON에 있고 프로세스 시작/파일 I/O/브라우저 렌더 시간은 아래 계산 시간에 포함하지 않았다. 반복은 완성 Blueprint 전체를 반환하는 fake cache가 아니라 기존 물리 캐시를 재사용한 전체 생성이다.

| Legacy case | 최초 계산 ms Before → After | 반복 ms Before → After | 첫 Query ms Before → After | Physical cells |
|---|---:|---:|---:|---:|
| battleship470 | 7,200 → 6,776 | 3,044 → 2,912 | 540 → 596 | 13777 → 13777 |
| vesper200 | 14,711 → 13,057 | 4,603 → 4,026 | 1,180 → 1,154 | 31330 → 31330 |
| spine300 | 9,910 → 9,666 | 3,704 → 3,878 | 909 → 1,169 | 24366 → 24366 |

세 경우 ledger 및 직렬화 길이가 같았다. 470m는 전체 JSON hash도 같았다. 생성 시간에 유의미한 악화는 관측되지 않았다. SPINE 반복/Query의 소폭·일회성 변동은 N=1로 원인을 단정하지 않는다. Query/integration 알고리즘은 바꾸지 않았다. 기존 복잡한 CORE/TRUSS 계열의 높은 최초 비용 및 query 메모리 문제를 해결했다고 주장하지 않는다.

아래는 **새 계약의 비무장** 결과이므로 Legacy와 같은 설계를 더 빨리 생성했다는 뜻이 아니다. 동일 470m에서 물리 cell 감소는 자동 무장/해당 foundation 및 신규 distribution의 차이다. material/layer를 생략한 최적화가 아니다.

| Native case | Module init ms | Cold 계산 ms | 전체 반복 ms | 첫 Query ms | Cells | Peak RSS MiB |
|---|---:|---:|---:|---:|---:|---:|
| BALANCED | 21 | 4,293 | 1,757 | 316 | 9575 | 618 |
| native-vesper200 | 23 | 11,670 | 3,556 | 1,284 | 29386 | 1,318 |
| native-spine300 | 27 | 7,045 | 2,531 | 606 | 17204 | 795 |

Runtime-only diagnostics와 geometry cache, lazy queries를 유지했다. 기본 생성에 query acceleration을 강제 생성하지 않으며 명시적 Probe/critical-center 조건일 때 준비한다. Native core200의 cold 11.67s 등 복잡한 형상의 비용은 여전히 남아 있다. 개별 메모리/단계 시간과 cache hit/miss는 [after](after) JSON에 있고, 장시간 메모리 누수/스트레스 검사는 실행하지 않았다.

## 자동 테스트 / 브라우저 QA / 실패 기록

- `npx vitest run tests/procurement.test.ts tests/free-mount.test.ts tests/physical-foundation.test.ts --maxWorkers=1`: **47/47 PASS** (13 native, 18 Free-Mount, 16 physical). [final-targeted-tests.log](final-targeted-tests.log)
- TypeScript `tsc --noEmit` 및 Production Build PASS. 기존 500kB chunk 경고는 남아 있다. [build.log](build.log)
- Production preview + Chromium WebGL/SwiftShader: native procurement/editor 23개 성공 항목과 수정 후 Legacy/responsive follow-up 12개 성공 항목, 중복 제외 **32개**. [ui/report.json](ui/report.json). 이는 두 실행의 명시적 합산이며 첫 전체 실행이 성공했다고 위장하지 않는다. 제품 콘솔/page 오류 0.
- 390px 폭에서 수평 page overflow 0, 125% UI scale에서 Generate 접근 확인. 입력만 바꿀 때 생성하지 않음, Generate Seed 유지, 강제 실패 시 이전 함선 보존, 명시적 Legacy 변환 확인.
- 전체 600+ suite, 무관한 combat-demo, 전 Architecture×Seed/역사 저장본 전수 검사는 실행하지 않았다.

실패·수정 이력도 보존했다:

1. 낮은 soft target에서 최소 두께 clamp가 단순 비율 배분을 초과했다. native bounded thickness sum을 풀어 최소 요구를 보존하면서 배분을 지키도록 수정했다. 기존 Legacy 산출은 바꾸지 않았다.
2. SPINE/Seed12 첫 SPLIT_FRAME 후보가 기존 slenderness 기준으로 실패했다. 호환 WEAPON_DOMINANT에서 같은 Architecture로 재계획했으며 실패 이유를 기록했다. 완화/강제 통과 없음.
3. 기존 Free-Mount 테스트는 현 기본 API가 .1인데 .5.5를 기대해 **수정 전 f8에서도 실패**했다. 테스트의 세 호출을 명시적 .5.5 계약으로 고정했다. 기존 assertion/물리 기준은 삭제·완화하지 않았고 현 기본 .1의 완전 일치는 별도 Legacy proof로 확인했다. [preexisting-version-assertion.log](preexisting-version-assertion.log)
4. 동시 브라우저 실행 중 첫 46개 assertion 실행은 모두 통과했지만 Vitest RPC timeout 1건이 발생했다. [rpc-contention-tests.log](rpc-contention-tests.log). 브라우저를 종료한 독립 실행에서 최종 47개와 runner 오류 0을 확인했다.
5. 첫 benchmark artifact 저장은 fixtures directory 생성 누락으로 실패했다. runner의 mkdir을 수정하고 실측/저장했다.
6. Playwright memory buffer 50MB 제한 → path upload로 수정. 이후 과거 browser import가 ULP 검증 오류로 실패한 것을 실제 화면에서 확인·수정했다. [browser-standard-rounding.json](browser-standard-rounding.json), [ui/legacy-large-file-timeout-run.json](ui/legacy-large-file-timeout-run.json)
7. 작은 화면의 기존 Free-Mount select가 page 폭을 넘었다. 좁은 화면에서 label wrap/min-width만 수정했고 후속 검사가 통과했다. [ui/mobile-overflow-first-followup.json](ui/mobile-overflow-first-followup.json)

## 실제 화면

- [기본 발주서](ui/basic-order.png)
- [고급 방호 설정](ui/advanced-protection.png)
- [설계 결과 / 질량](ui/design-result.png)
- [선호 재질 타협](ui/compromise.png)
- [실패 시 기존 함선 보존](ui/rejection-keeps-ship.png)
- [ARMOR Normal](visual/ARMOR-Normal.png) / [MOBILITY Normal](visual/MOBILITY-Normal.png)
- [ARMOR 실제 두께 View](visual/ARMOR-Armor-Thickness.png) / [MOBILITY 실제 두께 View](visual/MOBILITY-Armor-Thickness.png)
- [기본 출고 이후 플레이어 장착](ui/player-equipped.png)
- [과거 무장 Blueprint 보존](ui/legacy-armed-preserved.png)
- [390px](ui/mobile.png) / [125%](ui/scale-125.png)

## 남은 한계 / 검증하지 않은 범위

- 최소 두께는 명시적 critical facet center 범위이며 전 구역/가장자리 보장이 아니다. 곡면은 기존 finite faceted approximation이다.
- Frame/compartments/functional internals, 실제 추력·항속, currency/시장, 신규 외장 척추포/고정포 모델 미구현.
- SPINE의 재질 미지정 구조는 이전 계약대로 실제 유한 경계와 unresolved 경고를 유지하며 임의의 Hull/Armor 질량을 만들지 않았다.
- PREFER의 기술/Hull 최소 예산 대체와 제한된 Architecture 탐색을 지원하지만 모든 재질·비용 조합의 최적 가능해 탐색을 보장하지 않는다. 남은 강제 위반은 거절한다.
- Legacy renderer 픽셀 3척, Native 주요 형상 3척 및 통제 정책에 한정했다. 8 Architecture 전체 조합, 모든 오래된 버전의 재생성, 모든 UI drag/mirror/battery 조작을 브라우저 전수 검사하지 않았다.
- N=1 성능 표본과 process peak RSS는 장시간 성능/메모리 보증이 아니다. core200/복잡한 TRUSS 및 query snapshot 메모리는 후속 추적 대상이다.

## 실행 / 재현

```
npm install
npm run dev
npm run qa:procurement
npm run build
npm run preview -- --port 4173
# 별도 터미널: Production browser checks (Chromium 필요)
npm run qa:procurement:ui
```

Benchmark 입력은 [orders](orders)에 저장했다. 기존 `tests/performance/physical-harness.mjs`로 pristine f8와 현재 코드를 각각 plain bundle 후 같은 legacy 주문에 `REPEAT=1`로 실행한다. Native는 `node tests/procurement-harness.mjs build . /tmp/procurement-final.mjs`, 이어 `PROFILE=1 REPEAT=1 node tests/procurement-harness.mjs run /tmp/procurement-final.mjs qa/v1.8.6.0.2/orders/BALANCED.json /tmp/native-balanced.json`. Legacy proof/visual/통제 비교 스크립트도 tests에 포함했다. Visual은 old port5174/current5173, Production QA는 port4173을 사용한다.

## 변경 파일

- `package-lock.json`
- `package.json`
- `src/blueprint/types.ts`
- `src/generation/production/armor.ts`
- `src/generation/production/functional.ts`
- `src/generation/weapons/standards.ts`
- `src/generation/weapons/validate.ts`
- `src/main.ts`
- `src/physical/build.ts`
- `src/physical/policy.ts`
- `src/physical/types.ts`
- `src/physical/validate.ts`
- `src/style.css`
- `src/ui/layout.ts`
- `src/ui/physical.ts`
- `src/validation/validate.ts`
- `tests/free-mount.test.ts`
- `src/procurement/generate.ts`
- `src/procurement/order.ts`
- `src/procurement/policy.ts`
- `src/procurement/result.ts`
- `src/procurement/types.ts`
- `src/ui/procurement.ts`
- `tests/procurement-controls.mjs`
- `tests/procurement-harness.mjs`
- `tests/procurement-legacy-proof.mjs`
- `tests/procurement-summary.mjs`
- `tests/procurement-ui.mjs`
- `tests/procurement-visual.mjs`
- `tests/procurement.test.ts`

새 QA 데이터/이미지는 이 디렉터리에만 추가했다. 실행 dependencies 링크와 dist는 Git에 포함하지 않았다. 최종 로컬 Commit 후 worktree clean 및 보호 worktree HEAD/상태를 다시 확인한다. 원격 Push 없음.
