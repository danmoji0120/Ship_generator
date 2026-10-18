# V1.8.6.5 — Missile Warheads & Damage Propagation

2026-10-18 UTC. 실제 코드, 제한적 자동 테스트, Production 브라우저와 실제 저장 함선으로 검증했다. 원격 Push 없음. 전체 테스트 스위트 및 combat-demo 테스트는 실행하지 않았다.

## 기준 / 범위

- 기준 `688acee986b56fcbfcad8e698ba1bf8287b8bdc1` (`feature/v1.8.6.4`, 구현 `b12f9ab`).
- 독립 Worktree `/workspace/shipyard-v1.8.6.5`, 브랜치 `feature/v1.8.6.5`.
- 앱 버전 1.8.6.5. **함선 생성 계약은 1.8.6.3.1, Blueprint schemaVersion 2를 유지**한다. 기존 주문·장갑·선체·골조·구획·내부 설비·자유 장착 생성 코드는 개편하지 않았다.
- 피해는 Blueprint 외부의 기존 schemaVersion 1 `DamageInstance`에 귀속된다. 탄두를 사용할 때만 optional `warheads` 기록이 생긴다. 단순 Load로 탄두·골조·장비·손상을 삽입하지 않는다.
- 기존 작업 폴더, 과거 QA, 기존 무장, 10% UNKNOWN_LEGACY 서비스 질량을 변경하지 않았다. 건조 질량을 실제 손상으로 차감하는 모델도 이번 범위가 아니다.
- 환경: Node24.19, Chromium151, Three0.180, Vite7.3.7, Vitest3.2.7, Linux 2CPU/8GiB, headless SwiftShader. 하드웨어 GPU의 게임 프레임률을 보장하는 결과가 아니다.

## Registry / 전달체 계약

| 게임용 시험 사양 | 계열 | 총질량 kg | 파편 질량 kg | 실제 1차 전달체 | 기본 상대 방출 속도 m/s | 배정 효과 에너지 MJ | 방향 |
|---|---|---:|---:|---|---:|---:|---|
| test-fragmentation | FRAGMENTATION | 400 | 256 | 256 × 1kg, 40mm × 90mm HARDENED_STEEL | 1800 | 414.72 | 전구면 |
| test-directional | DIRECTIONAL | 400 | 256 | 256 × 1kg, 22mm × 160mm TUNGSTEN_ALLOY | 3200 | 1310.72 | 전방 반각25° 원뿔 |
| test-kinetic | KINETIC_IMPACT | 100 | 0 | 기존 dev-210의 100kg 관통체 | 입력 실제 속도 | 추가 폭발 에너지0 | 실제 속도 방향 |

사양은 **SF 게임 시험 예산**이다. 폭약 조성·제조 방법·검증된 실제 탄두 성능을 뜻하지 않는다. 파편 이외의144kg은 미모델링 본체로 명시한다. 기본 비행 수명은0.5초다. 기존 탄도 Registry·재료 반응·유한 교차·국소 관통공을 그대로 사용하며, 새로운 반경 HP나 대기 폭압 공식은 없다.

LOW/MEDIUM/HIGH는 **64/128/256개 방향**이다. 물리적256개 전달체와 총질량·총에너지는 고정이다. LOW는 같은 방향에4개, MEDIUM은2개, HIGH는1개의 실제 단위 파편을 보낸다. 가중치를4kg 관통체 또는4배 피해로 바꾸지 않는다. 에너지를 소실시키기 위해 LOW에서192개의 물리 파편을 버리지도 않는다. 대신 낮은 품질의 방향 집중은 실제 반복 피격과 관통공 분포를 바꿀 수 있다. 이는 정밀한 파편 분포나 불편 추정기가 아니다. **측정에서 큰 차이가 확인되어 최종 UI 기본값을 HIGH로 설정했다.**

입력 source 속도는 목표 상대 운동 에너지로 계산한다. 전 방향 방출의 교차항을 포함하는 스칼라 속도 보정으로 `배정 효과 에너지 + 상속 상대 운동 에너지`를 보존한다. 로켓 유도, 반동·운동량 보존, 실제 케이싱 파괴를 푼 것은 아니다.

## Context / Trigger / 실행 순서

- 실제 유한 구획과 구조 포함 검사, 실제 물질의 미소 유한 교차로 EXTERNAL_VACUUM / SURFACE_CONTACT / INTERNAL_COMPARTMENT / EXTERIOR_UNRESOLVED / INVALID_LOCATION를 구분한다. 함선 AABB를 방 내부의 증거로 사용하지 않는다. 장치·벽·골조 고체 중심은 거절한다.
- 내부 버튼은 실제 장치 앞의 빈 공간 후보를 다시 검증한다. **수동 내부 기폭은 외부 미사일이 장갑을 관통했다는 증거가 아니다.**
- LAB_MANUAL은 명시적인 실험이다. PROXIMITY는 이름 있는 실제 구조 기준점까지의 거리·관측 시각·arming을 검증한다. TIMED는 실제 인스턴스 관측 시각과 fuse 경과 시간을 확인한다. 미래 시각을 임의 제출하여 fuse를 통과시키면 거절한다.
- IMPACT는 실제 저장된 kinetic 접촉의 shot/owner/layer/time/위치를 요구한다. UI의 kinetic impact link는 **이미 적용된 kinetic 에너지를 재적용하지 않으며 추가 파편도0개**다. 폭발 IMPACT의 미래 어댑터 계약은 있지만 실제 유도 미사일·접촉 신관 Runtime은 없다.
- `beginDetonation` → `workDetonation` 또는 `resolveDetonation`으로 같은 경로를 사용한다. 한 대상의 준비된 physical/frame/interior/equipment Query를 공유한다. 파편당 Blueprint 복사·Hull 재생성·Query 재구축을 하지 않는다.
- 모든 활성 전달체의 다음 실제 진입·물질 이탈·수명 종료 중 가장 이른 시점으로 진행한다. 같은 시각은 안정적인 파편 ID로 정렬한다. 아직 물질 안에 있는 파편을 장치 뒤로 즉시 통과시키지 않는다.
- 재료 반응은 진입 시 평가하고 실제 이탈/정지에서 국소 피해를 commit한다. 먼저 완성된 실제 구멍은 나중 진입하는 경로에 반영된다. **진행 중인 물질 transit 내부에서 연속 파괴장이 변하는 coupled fracture는 계산하지 않는다.**
- 작업 slice의 경계 수와 시간은 yield만 결정한다. 미처리 파편은 PENDING이며 완료로 위장하지 않는다. Pause/Step/Resume를 실제 UI에서 확인했다. 8ms는 단일 Query·후처리·렌더링까지 포함하는 실시간 상한이 아니다.
- 원시 유한 교차 후보만 작업 단위에서 캐시한다. 소비자마다 새 interval 객체를 제공하고, 현재 손상공은 별도로 적용한다. 새로운 구멍과 해당 소유자/층의 다음 경로가 실제로 교차할 때 접근 후보를 무효화한다. 문짝 상태도 캐시 키에 들어간다. UI는 진행 중 해치 상태 변경을 거절한다.

## 실제 피해 / 2차 전달체 / 한계

차폐 뒤 설비에는 실제 잔여 전달체가 도달해야 한다. STOP 뒤에 피해 선을 연장하거나 같은 구획의 모든 장치를 고장 내지 않는다. Hull/Bulkhead의 실제 유한 채널, 기존 국소 손실·균열·박리와 Frame 단면·접합부 손실 API를 재사용한다. 실제 부재가 실패할 때만 해당 edge/joint가 꺼지고 기존 연결 분석을 실행한다. 그래프 분리를 물리적인 함체 두 동강 애니메이션으로 주장하지 않는다.

선택적 2차 파편은 **관통체 침식에서 나온 잔해**의 게임 근사다. 검증된 장갑 spall 모델이 아니다. 실제 관통된 brittle Armor/Hull/Bulkhead 접촉에서만 생성한다. 실제 부모 침식 질량의25% 이내, 개당 최대0.02kg, 에너지는 부모의 소비 에너지 중 제한된 침식 몫에서 재배분한다. 부모의 국소 침적 에너지에서 자식 에너지를 빼고, 이미 계산한 부모 잔여 에너지를 다시 차감하지 않는다. 실제 물질 출구·방향·owner/layer·parentContact/sourceBudgetRef를 보존한다. 세대1 / 최대16, 초과 억제 수를 명시한다.

안전 한계는 1차256 / 2차16 / raw Query cache1024 / 화면 contact512 / history16 / accepted event ID128이다. 기존 실제 국소 손상4096개 한계에서는 새 경로를 UNRESOLVED로 남긴다. 오래된 관통공을 지워 재료가 복구된 것처럼 처리하지 않는다. Display trace의 잘림 수와 물리 상태의 보존을 구분한다. 같은 event ID 중복 적용을 거절한다. 완료·취소 후 raw cache를 비운다.

재질 미정·소유권 중첩·SPINE·회전 중 CCD·안전 한계는 기존 의미의 UNRESOLVED다. `hitFragments`는 미정 경계를 포함한 **접촉 경로 수**이며 검증된 명중/피해 수가 아니다. UI도 contact paths와 owners with local damage를 분리한다. 해당 경로 뒤에는 가짜 피해를 만들지 않고 독립된 다른 경로는 계속 처리한다. 일부 미확정 경로가 있으면 PARTIAL이다. 원인과 미사용 효과 예산을 감추지 않는다.

## 독립 Fixture / 실제 함선 QA

독립 유한 Fixture는 약한 파편의600mm 강철 정지, 강한 단위 관통체의100mm 복합장갑과18mm Hull 통과, 기존500 시험탄이 만든 실제 관통공·먼 위치의 정상 장갑, 반대 방향 원뿔, 미정 재질, 실제 문짝 OPEN/CLOSED/BLOCKED, 실제 두 부재/용접 접합과 그래프 분리, 한계4096에서 이전 손상 보존을 검증한다. 이것을 대형 생성 함선의 모든 골조가 절단됐다는 증거로 확대하지 않는다.

실제 함선은 이전 Production Chromium에서 생성·저장한 `.3.1/browser/*-generated.json.gz` 8척을 재사용했다. `.3/fixtures/ENDURANCE`도 별도 사용했다. 단순 박스 모형으로 Architecture QA를 대체하지 않았다. Blueprint Seed는7, 탄두 Seed도7이다. 아래 주 비교는 명시적으로 LOW64방향 / 실제256개 파편이다. Node 실행과 실제 Production UI 실행을 별도로 기록했다. JSON에 원본 Blueprint SHA256도 남겼다.

| 실제 Architecture / 길이 | 조선소 | Context / 시나리오 | Query 준비 ms | resolve ms (준비·초기화 제외) | 접촉 / STOP / UNRESOLVED | 상태 |
|---|---|---|---:|---:|---|---|
| MONOLITHIC / 470m | aegis | EXTERNAL_ARMOR_OCCLUSION / EXTERNAL_VACUUM | 823.8 | 181.9 | 16 / 12 / 0 | COMPLETE |
| BLOCK_ASSEMBLY / 500m | forge | ACTUAL_BULKHEAD_AND_APERTURE / INTERNAL_COMPARTMENT | 1710.2 | 948.1 | 1212 / 120 / 12 | PARTIAL |
| SPINE_AND_MODULES / 300m | vesper | ACTUAL_SPINE_UNRESOLVED / EXTERNAL_VACUUM | 1728.0 | 245.2 | 256 / 0 / 256 | PARTIAL |
| TRUSS_POD / 300m | vesper | ACTUAL_EXPOSED_TRUSS / EXTERNAL_VACUUM | 2419.8 | 388.4 | 256 / 256 / 0 | COMPLETE |
| TWIN_HULL / 400m | forge | ONE_REAL_TWIN_HULL / EXTERNAL_VACUUM | 2590.8 | 1430.4 | 944 / 16 / 24 | PARTIAL |
| CORE_AND_NACELLES / 200m | vesper | ACTUAL_SOLID_CONNECTOR / EXTERNAL_VACUUM | 2696.4 | 371.2 | 256 / 256 / 0 | COMPLETE |
| STACKED_BLOCKS / 300m | aegis | ACTUAL_BULKHEAD_AND_APERTURE / INTERNAL_COMPARTMENT | 1289.5 | 972.2 | 1028 / 64 / 0 | COMPLETE |
| HYBRID / 300m | serein | MANUAL_INTERNAL_MULTIPLE_PATHS / INTERNAL_COMPARTMENT | 1950.5 | 967.9 | 884 / 188 / 4 | PARTIAL |

SPINE은256개 경로 모두 미정 경계에서 멈췄으며 물리적 관통 성공으로 판정하지 않는다. TWIN은 실제 한쪽 shell만 손상됐다. STACKED는 Y 법선의 실제 수직 경계/closure를 사용했다. HYBRID는 미확정4개를 남기고 독립된 다른 경로를 처리했다.

별도 실제 TRUSS 포드 시험은 실제 발전 설비까지 가는 원시 선상에서 Armor와 Hull이 먼저 존재함을 확인한 뒤 같은 각도 샘플을 발사했다.8개 실제 접촉/4개 정지, 선택된 실제 POWER_GENERATOR는 피해 없음이었다. 노출 TRUSS 직접 접촉과 포드 안쪽 설비 방호를 혼동하지 않았다 (`pod-protection.json.gz`). 실제 CORE 시험은 `link-0/body` 고체 Connector를 맞고256개가 정지했다. 실제 대형 부재의 edge 실패가0일 수 있으며 이를 강제 파괴하지 않았다.

### 실제 기능 결과

| 실제 설계 / 시험 | 전력 MW | 추진 | 기동 | Fire channels | Sensor capacity |
|---|---:|---:|---:|---:|---:|
| BALANCED-internal | 120 → 120 | 1 → 0 | 1 → 0 | 8 → 0 | 8 → 0 |
| ENDURANCE-internal | 264 → 264 | 1 → 1 | 1 → 1 | 16 → 16 | 16 → 16 |

두 실험 모두 실제 배전 장치를 파괴했다. ENDURANCE는 살아 있는 실제 예비 공급망으로 기능을 유지했고, 각180MJ 저장량은 평가만으로 소비되지 않았다. A 피해가 B로 전달되지 않았고 Reset은 선택한 인스턴스의 손상·탄두 이력을 비웠다.

추가 실제 HIGH/25° 내부 시험 (`functional-impact.json.gz`): 발전기 직접 파괴는 전력120→0MW. 기동 제어 장치 직접 파괴 시험은 뒤쪽 발전기도 실제로 맞아 전력이0이 됐다. 사격통제 장치 시험은 뒤쪽 배전기도 실제로 맞아 사격·기동·센서 공급이 끊겼다. **이 둘을 한 장치만 고장 난 격리 실험으로 주장하지 않는다.** 각 시험에는14~28개의 미확정 경로도 있어 PARTIAL이며, 알려진 충돌에서의 기능 결과만 기록했다. 같은 폭발 반경이라는 이유로 인접 장치를 자동 파괴하지 않았다.

## 성능 / 샘플링

기존 kinetic 비교는 동일470m AEGIS MONOLITHIC 저장 설계, 새 프로세스별 한 번 Query 준비와12발 순차 warm 전체 비행을 사용했다. 최초 준비와 warm 비행을 섞지 않는다. 네 kinetic preset은 **완전한 projectile + instance JSON의 SHA256이 모두 이전 버전과 일치**했다.

| 항목 | .4 Before | .5 After |
|---|---:|---:|
| 첫 Query 준비 ms | 822.17 | 853.36 |
| warm kinetic 중앙값 ms | 12.39 | 6.77 |

준비 시간은 각N=1이며 유의미한 개선/악화를 확정할 표본이 아니다. 새 탄두 기능의 이전 버전 시간은 존재하지 않으므로 만들어 비교하지 않았다. 실제 최적화는 damage adapter에서 재료가 아닌 방/개구부 빈 공간의 교차 계산을 생략하는 것이다. 모든 Bulkhead/Closure 교차는 기존 코드를 그대로 실행한다. 기존 interior probe의 기본 전체 조회는 보존한다. 단위 Query exact 결과·문짝 테스트·kinetic 전체 JSON으로 회귀를 확인했다.

새 탄두 벤치마크는 Node 단일 순차 실행, 함선당 Query handle 하나, BALANCED 각 품질3회, CORE/TRUSS 각1회다. 초기 read/parse와 준비 비용, 프로세스 유지 중 warm 기폭을 분리했다. 초기 Query 준비: BALANCED903.52ms, CORE2592.75ms, TRUSS2514.26ms. 프로세스 시작/번들 import는 이 값 밖이다. 최초 Query를 파편 수만큼 다시 준비하지 않았다.

| 실제 대상 | 방향 수 | 물리 1차 수 | 반복 N | warm 중앙값 ms | empirical p95 ms | 실제 접촉 | STOP | UNRESOLVED |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BALANCED | 64 | 256 | 3 | 193.72 | 263.10 | 16 | 12 | 0 |
| BALANCED | 128 | 256 | 3 | 233.49 | 244.60 | 12 | 8 | 0 |
| BALANCED | 256 | 256 | 3 | 391.30 | 410.63 | 9 | 6 | 0 |
| CORE_AND_NACELLES | 64 | 256 | 1 | 422.43 | 422.43 | 256 | 256 | 0 |
| CORE_AND_NACELLES | 128 | 256 | 1 | 655.06 | 655.06 | 256 | 256 | 0 |
| CORE_AND_NACELLES | 256 | 256 | 1 | 1064.44 | 1064.44 | 256 | 256 | 0 |
| TRUSS_POD | 64 | 256 | 1 | 503.66 | 503.66 | 256 | 256 | 0 |
| TRUSS_POD | 128 | 256 | 1 | 769.41 | 769.41 | 264 | 254 | 0 |
| TRUSS_POD | 256 | 256 | 1 | 1408.43 | 1408.43 | 263 | 255 | 0 |

N=1/3의 p95는 안정된 tail 지표가 아니다. 전 품질에서 casing256kg / fragmentation414.72MJ 또는 directional1310.72MJ로 같다. 실제256개 carrier를 계산하므로64→256방향은 물리 파편 수4배가 아니다. LOW의 원시 Query 재사용192회와 HIGH의 독립 방향 조회가 비용 차이의 큰 원인이다. CORE LOW 예: Query275.21ms, material0.89ms, local damage78.25ms, aggregate capability0.80ms. TRUSS LOW: Query373.46ms, material0.70ms, local damage40.91ms. broad/narrow/sort는 합친 Query 시간이며 따로 계측했다고 주장하지 않는다. Query·스케줄링·기록 후처리와 계측 범위가 겹칠 수 있어 항목을 임의 합산하지 않는다.

옵션 프로파일러 비용은 원래 GC가 불균형한3쌍에서 역전됐다. 이를 개선으로 해석하지 않고 별도 ABBA/ABBA, 매 발사 전 GC와2회 warmup으로 재측정했다 (`profiling-overhead.json`).

최종 N=4씩 중앙값 OFF 267.15ms / ON 279.63ms. 소표본·JIT·GC의 분산이 있으며 일반적 오버헤드 비율로 확정하지 않는다. 옵션은 기존 per-projectile 단계 계측을 켜는 것으로, 작업 자체의 기본 clock 측정은 양쪽에 있다.

### 방향 근사 오차

| 탄두 Seed | LOW / HIGH 실제 접촉 | LOW / HIGH 피격 파편 | LOW / HIGH 손상 owner 수 | LOW / HIGH footprint 합 m² |
|---|---|---|---|---|
| 7 | 16 / 9 | 12 / 6 | 2 / 3 | 0.03945 / 0.02416 |
| 19 | 24 / 11 | 8 / 8 | 4 / 3 | 0.04844 / 0.03162 |
| 41 | 16 / 8 | 12 / 6 | 2 / 5 | 0.03815 / 0.02453 |

footprint는 실제 국소 기록의 πr² 합이며 **겹침 제거된 총 손상 면적이 아니다**. Seed7에서 LOW의 합은 HIGH보다 약63% 높다. 다른 두 Seed에서도 약53~56% 높았다. 손상 owner 수는 단조 수렴하지 않았다. 작은 대상의 낮은 solid angle과 일치한 방향에 파편이 집중되기 때문이다. HIGH도 현실의 정답이나 오차0이 아니다. 낮은 품질의 결과를 높은 정확도와 동등한 피해로 취급하지 않으며, 통계 검증이나 전투 밸런스 확정에 사용하지 않는다. UI 기본값 HIGH 변경 이유다.

## 메모리 / 시각 리소스 / UI 지연

Node의6회 기폭/상태 폐기 후 GC에서 세 함선과 준비된 Query를 의도적으로 유지한 heap은711.73~711.96MiB, RSS1135.40~1136.02MiB였다. 직전 세 대상 준비 과정의 sampled RSS 최대는 약1207MiB다. 이는 정밀 OS peak가 아니며 Node RSS와 Browser heap을 합치지 않는다. Query 캐시가 가진 큰 기본 비용은 남아 있다. 반복 기폭마다 선형 증가하는 retained heap은 관측되지 않았지만6회 측정으로 장기 누수 부재를 증명하지 않는다.

Production6회 실제 기폭/Reset 후 GC heap216MiB 부근, 마지막 기록/작업/history는 Reset으로 비워졌다. 첫 GC 전688MiB와 GC 후216MiB를 구분한다. 별도 실제 Viewer에서 서로 다른2개 함선 교체/overlay on/off6회를 수행했다. Normal의 Draw Call은 복원됐고 dispose 후 geometry0 / texture0 / scene child0, Blueprint/ship 참조가 해제됐다. GL driver 전체 메모리와 JS heap은 동일 지표가 아니다.

| 실제 대상 | Normal 이전/이후 pixel | Normal Draw Calls |
|---|---|---:|
| BALANCED | identical | 29 |
| BLOCK_ASSEMBLY | identical | 49 |
| SPINE_AND_MODULES | identical | 57 |
| TRUSS_POD | identical | 135 |
| TWIN_HULL | identical | 91 |
| CORE_AND_NACELLES | identical | 67 |
| STACKED_BLOCKS | identical | 29 |
| HYBRID | identical | 97 |

Normal은 UI/version 문구를 제외한 같은 실제 ShipViewer·같은 저장 Blueprint·같은 카메라의 PNG byte 전체 비교다. Overlay on 때 BALANCED83 / TWIN492 draw calls, off 때29 /91. 많은 기존 국소 손상 marker가 draw call을 늘리는 비용은 남았다. Debug OFF에서 탄두 marker/trajectory를 그리지 않는다.

**UI 지연은 미해결 항목이다.** 최초 Production 계측에서 물리 작업336ms에 비해 표시 포함6.71초, 최대 long task3.07초가 관측됐다 (`browser-final/report.json`). 이 값을 숨기거나8ms queue가 전체 화면 비용까지 보장한다고 주장하지 않는다. 최초/반복을 분리한 후속 동일 대상 측정은 아래와 같다.

| 실제 Production 측정 | 표시까지 wall ms | 물리 work ms | 최대 browser long task ms | 측정 밖 명시 GC ms |
|---|---:|---:|---:|---:|
| FIRST_VISIBLE_BURST | 3975 | 349.5 | 231 | 0 |
| WARM_SAME_TARGET_AFTER_RESET_GC | 3677 | 307.1 | 300 | 391 |

후속 최대 long task는231/300ms였다. 최초3초 지연은 같은 크기로 재현되지는 않았고 원인을 GC·shader 등 하나로 단정하지 않았다. idle Normal/Lab 각1초에는 long task0, 실행 중29개가 관측된 최초 세션도 보존했다. export/reset/강제GC를 burst 측정에 넣지 않았다. UI6회 수명 실험의 long-task 값에는 reset/GC가 포함되므로 순수 solver 지연으로 사용하지 않는다. 최초 준비는 여전히 동기이며 복잡한 함선에서2.6초 수준이다. 다음 개선은 Query 준비/Debug 재질 초기화 분리와 실제 marker 배칭·렌더링 프로파일링이다. 미처리 파편을 삭제해서 빠르게 보이게 만들지는 않았다.

## Production UI / 호환성

기존 Damage Laboratory 안에 KINETIC / WARHEAD 모드만 추가했다. 기존 독립 A/B, Pause/Step/Reset, 실제 개구부 상태, X-Ray, contact focus, instance export를 공유한다. 탄두 preset, 실제 world XYZ/속도/방향, Context, 확인된 compartment, Seed, 품질, 명시적인 trigger proof, secondary 선택과 예산·실제 결과·작업 진단을 제공한다. `Frame burst + ship`은 실제 burst와 ship 위치로 카메라를 맞춘다.

실제 Production preview 검사:

- 주 실행74개:8종 실제 Load/기폭/실제 owner·context/에너지/A·B/Reset/Blueprint 전체 hash/Normal, 동일 Seed 재실행, 품질 변경, 실제 내부 배전기, 고체 중심 거절, kinetic 모드 복귀, ENDURANCE, legacy armed,390px UI, console.
- 추가14개: PENDING Pause/Step/Resume, 실제 OPEN/CLOSED leaf, 반대 방향 cone,6회 burst/reset, 실제 캔버스와 worker의 함포·미사일 장착, 장착 질량과 기본 질량 분리, 삭제/Undo/Redo, 저장·복원, console.
- 최종8개: HIGH 기본값, TIMED 미도달 거절·실제 경과 수락, PROXIMITY 실제 거리 거절·수락, 실제 kinetic contact 기반 IMPACT link와0 추가 에너지, console.
- 별도 표시 성능2개: 실제 burst2회 완료·page error0. 별도 Normal 픽셀 비교8척.

표기를 명확히 한 뒤 SPINE만 다시 확인한10개 check는 중복 검증으로 따로 남겼다 (`browser/followup.json`). 기능 check96개와 성능 check2개를 자동 테스트63개의 숫자에 섞지 않는다. 모든 브라우저의 page/console error는0이었다. UI 검사는 실제 Production 빌드의 DOM·다운로드·Load·실제 캔버스 picking·기존 worker 설치를 이용했고, DEV API로 장치 상태를 강제로 고장 내거나 장비를 설치하지 않았다.

구형 무장 Blueprint는 전체 JSON이 그대로 보존됐다. Free-Mount에서 실제 함포/미사일 설치 후 Mounted Equipment Mass가 증가하고 원래 Base Mass는 같았다. 플랫폼·장비 이동·미러·배터리·지지대·Anchor의 기존 관련18개 자동 테스트도 그대로 통과했다. 새로운 내부 공간·전력·급탄·응력 검사를 설치 조건에 추가하지 않았다. 기존 미사일 장비를 임의로 test-warhead 사양에 연결하지 않는다. `MountedWarheadBinding`은 명시적인 미래 연결 계약일 뿐이다. 실제 외장 척추포 모델을 새로 만들지도 않았다.

## 관련 자동 테스트 / 빌드

| 직접 관련 파일 | 최종 유일 case 수 | 결과 |
|---|---:|---|
| tests/warhead.test.ts | 14 | PASS |
| tests/damage.test.ts | 14 | PASS |
| tests/physical-foundation.test.ts | 16 | PASS |
| tests/free-mount.test.ts | 18 | PASS |
| tests/interior.test.ts / `real door aperture`만 선택 | 1 | PASS, 나머지19개는 실행하지 않음 |
| 합계 | **63** | PASS |

최초 묶음에서는 새 탄두13개를 포함한61개와 별도 문짝1개가 통과했고, 외부 계약 경계의 잘못된 enum을 거절하는14번째 탄두 case 추가 후 탄두14개를 다시 실행했다. 반복 실행을 새로운 case로 세지 않는다. TypeScript `npx tsc --noEmit` 통과, `npm run build` 통과(최종 Vite4.27초). 기존 large chunk 경고는 남았으며 오류는 아니다. 전체600개 이상 테스트나 무관한 combat-demo 테스트는 실행하지 않았다.

핵심 재현 명령(프로젝트 루트):

```sh
node tests/warhead-harness.mjs
npx vitest run tests/warhead.test.ts tests/damage.test.ts tests/physical-foundation.test.ts tests/free-mount.test.ts --maxWorkers=1
npx vitest run tests/interior.test.ts -t 'real door aperture' --maxWorkers=1
npx tsc --noEmit
npm run build
npm run preview -- --port 4189 --strictPort
# 별도 터미널
node tests/warhead-browser.mjs
node tests/warhead-browser-extra.mjs
node tests/warhead-browser-final.mjs
node tests/warhead-ui-performance.mjs
node --expose-gc tests/warhead-benchmark.mjs
node tests/warhead-actual.mjs
node tests/warhead-pod-protection.mjs
node tests/warhead-functional.mjs
```

기존 kinetic Before 번들은 `node tests/damage-harness.mjs build /workspace/shipyard-v1.8.6.4 /tmp/warhead-before.mjs`, After는 warhead harness로 준비한다. `node --expose-gc tests/warhead-kinetic-benchmark.mjs before`와`after`가 같은 실제 설계로 비교한다. Visual 드라이버는 `.4` Vite5188 / `.5` Vite5189를 사용한다. 브라우저 스크립트는 Chromium 경로와 포트를 이 환경에 맞춰 명시했다. 앱 실행 자체는 기존 `npm install` / `npm run dev`다.

## 실패한 실험 / 수정 근거

실패 원본 로그와 실패 화면을 삭제하지 않았다. 이전 버전 QA도 수정하지 않았다.

1. 첫 baseline 스크립트는 `/tmp/damage-after.mjs`가 없어 실행에 실패했다. 새 전용 bundle 경로로 수정 후 측정했다. 실패 실행을 성능 표본으로 쓰지 않았다.
2. 첫 새 scheduler 테스트가 물질 경계의 미소 양수 잔여 TOI 때문에 진행하지 못해 중단했다. 0시간 경계 처리에 합리적인1e-7m/부동소수점 시간 허용 오차를 적용하고 **기존 kinetic 경로의 계산은 그대로 유지**했다. 이후 work budget1/128, 실제 UI8ms yield에서 같은 물리 결과를 검증했다. 감지 guard는 진행하지 않는 상태를 조용히 버리지 않는다.
3. 후속 관통공 테스트에서 기존500탄이 Armor와 Hull 둘 다 관통한 것을 무시하고 Hull 접촉을 기대해 실패했다. 독립적으로 실제 두 관통공을 확인하고 기대를 실제 빈 경로(접촉0)로 수정했다. 먼 위치는 계속 저지한다. 기존 테스트를 약화한 것이 아니라 새 Fixture의 잘못된 기대를 바로잡았다.
4. 실제 내부 배전기 접촉은 성공했지만, 마지막512개 trace만 검사해 초기 접촉이 없다고 단정한 새 검사가 실패했다. 해당 실제 persistent local channel·damaged owner·장치 상태를 확인하도록 수정했다. 초기 접촉을 복원하기 위해 history를 무제한 늘리지 않았다.
5. CORE의 첫 QA pose helper는 작은 매립 contact web을 골라 유효 기폭점을 찾지 못했다. 분류기를 완화하지 않고 실제 넓은 `link-0/body`와 중간 cell의 외부 위치를 탐색했다. 실험 위치 선정 실패와 물리 실패를 구분했다.
6. 초기 ES2022 타입 검사에서 findLast/Buffer 타입 문제가 있었고 수정했다. 마지막 외부 비정상 계약 fixture의 강제 cast도 TypeScript가 거절하여 `unknown`을 거치는 명시적인 비정상 입력으로 고쳤다. 런타임 조건을 느슨하게 하지 않았다.
7. LOW/HIGH의 큰 피해 분포 차이, 불균형 초기 profiler 비용 결과, 실제 첫 UI3초 long task를 모두 보존했다. LOW를 정확한 모델로 성공 처리하지 않았고 기본값 HIGH로 변경했다. UI 표시 병목을 해결했다고 주장하지 않는다.

## 미해결 / 근사 / 다음 단계

- 운동량·반동, 실제 파편 케이싱 분포, 실제 폭약·성형작약 제트·압력·열·감압·산소·원자로/탄약 2차 폭발은 구현하지 않았다.
- 유한 centreline CCD이다. 파편 반경은 재료 반응/국소 채널에 작용하며 centreline 밖 옆면 접촉까지 넓히지 않는다. 고정 Quaternion과 등속 이동 목표만 지원한다. 회전 중 목표 CCD는 UNRESOLVED다.
- 진입 시 재료 응답, 이탈 시 commit의 근사를 유지한다. 진행 중 transit에 다른 파편이 만든 균열을 연속 재해석하지 않는다.
- LOW/MEDIUM의 coincident 방향 집중, HIGH의 남은 이산화 오차, 단순 시험 재질 보정, 설비 OBB와 smeared mass,16×16 보수적 Frame 단면 모델의 한계가 있다. 실제 공학 해석이나 전투 밸런스 최종안이 아니다.
- 미정 SPINE와 외장 장비/플랫폼의 탄도 재질 계약은 미해결이다. 빈 공간 또는 가짜 steel로 채우지 않는다.
- 최초 Query 준비와 실제 UI 표시/marker 비용, 큰 기하 캐시 메모리, debug에서 많은 local marker의 Draw Call은 남아 있다. 반복6회·소수 Seed만 측정했으므로 장기 누수/통계 수렴 보장은 없다.
- 실제 미사일 장착 사양 선택·발사·유도·요격·비행 신관 Runtime, 실시간 함체 분리/파편 물체 물리 Runtime은 구현하지 않았다. 이번 결과는 실제 설계 위의 탄두 피해 실험실이다.
- 다음 권장 작업은 **Game Foundation / Shipyard–Combat Integration**이다. 불변 Ship Design, 독립 Ship Instance, 실제 projectile/warhead 어댑터와 고정 시간 시뮬레이션을 연결하되 새로운 조선소 형상 개편이나 Combat Runtime을 이번 패치에 끼워 넣지 않는다.

## 실제 변경 파일

구현 커밋 `1ee3df8`의32개 파일과 표기 정리 `9ccddd1`의 동일 파일3개:

- `src/warheads/{types,registry,sampling,context,engine}.ts`, `src/warheads/README.md`: 계약·샘플링·유한 위치 검증·연대기 queue·예산·secondary.
- `src/damage/{types,contacts,flight,state}.ts`: 기존 solver 공유 경계 API, carrier metadata, void Query 최적화, defer capability, 이탈 시 state 한계 안전 검사.
- `src/interior/query.ts`: 기본 전체 조회를 보존한 선택적 material-only 경로.
- `src/ui/{damage,warheads,layout}.ts`, `src/style.css`: 기존 실험실 안의 모드/controls/실제 결과/진단/기본 HIGH.
- `src/rendering/{viewer,warheads}.ts`: 실제 궤적과 소유 리소스 수명.
- `package.json`, `package-lock.json`: 앱 버전.
- `tests/warhead.test.ts`와`tests/warhead-*.mjs`12개: 한정된 unit / 실제 함선 / 브라우저 / 계측 드라이버.
- 이 QA 커밋은 `qa/v1.8.6.5/`의 보고서·실제 이미지·원시 결과·실패 로그를 추가한다. 세부 목록은 `changes.txt`.

## 요구 항목 대조 (최종 보고46항목)

| 요청 항목 | 증거 / 판정 |
|---|---|
| 1–2 Branch/Base/변경 파일 | 위 기준 및 changes.txt |
| 3–12 Registry/context/trigger/kinetic/fragment/directional/internal/vacuum/sampling/budget | src/warheads/README.md, unit14, actual-ships, browser-final |
| 13–15 차폐/관통공/재질 | 유한 Fixture, actual8, pod-protection, 기존 damage14/physical16 |
| 16–18 secondary/aggregation/Hull/Bulkhead | 세대/예산/4096 한계 검사, 실제 Block/Stacked, retained local channels |
| 19 구조 Graph | 실제 작은 welded geometry Fixture에서 joint/edge/components 변화. 대형 함체 절단은 미구현 |
| 20–22 설비/Capability/ENDURANCE | 실제 배전기/발전기/제어장치와 실제 예비망, functional-impact, UI capability 이미지 |
| 23–26 A/B/불변/Reset/UNRESOLVED | 실제8척의 whole Blueprint hash, selected state reset, partial 경로 |
| 27–31 실제8/kinetic/legacy/free-mount/Normal | browser3개 report, kinetic SHA4개, visual8 PNG 동일 |
| 32–35 준비/warm/품질/오차 | benchmark.json, Node 순차 소수 측정, Seed7/19/41 오차 표. 수렴 보장 없음 |
| 36–40 메모리/Production/TypeScript/targeted/console | Node/Production/Viewer6회씩, 관련63개, build, console0 |
| 41–44 실패/근사/미사일Runtime/SPINE | 실패 로그, 미해결 절, 최초 UI 지연 포함 |
| 45 Local Commit | 구현1ee3df8 / UI 의미 명확화9ccddd1. 보고서/증거는 후속 로컬 QA 커밋으로 저장. 최종 SHA는 최종 응답 및 git log 참조 |
| 46 Remote Push | 이 버전에서 Push/Force Push를 실행하지 않음 |

핵심 구현과 제한적 검증은 완료했다. **정확한 현실 파편 모델, UI 지연 완전 해결, 미정 SPINE 해소, 실제 미사일 Runtime 완료를 뜻하지 않는다.**
