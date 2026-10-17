# V1.8.6.4 — Ballistic Penetration & Localized Damage

구현 및 QA 기준: 2026-10-17 UTC. 원격 Push 없음. 전체 테스트 스위트와 combat-demo 테스트는 실행하지 않았다.

## 기준과 보존

- 기준: `feature/v1.8.6.3.1` / `73feb6c2b5aa50274eaafde068068cdb08765425`.
- 독립 Worktree: `/workspace/shipyard-v1.8.6.4`, 작업 브랜치 `feature/v1.8.6.4`.
- 기존 9개 Worktree, 미커밋 작업, 과거 QA, 장착 장비를 삭제하거나 수정하지 않았다.
- 앱 버전은 1.8.6.4. **함선 생성 계약은 1.8.6.3.1을 유지한다.** 생성 알고리즘·질량 회계 개편이 아니므로 기존 설계를 자동 재작성하지 않는다. Blueprint schemaVersion 2와 기존 Registry를 유지한다.
- 피해는 별도 schemaVersion 1 `DamageInstance`에만 저장한다. A/B는 같은 설계의 독립 건조 인스턴스다. 설계 원본·건조 질량·10% UNKNOWN_LEGACY 서비스 질량은 그대로다. 실제 파편 질량 손실은 계산하지 않는다.

## 실제 구현

`src/damage`가 기존 유한 물리 조회를 재사용한다. `prepareDamageQueries`가 준비한 한 대상에서 매 발사마다 Hull/Armor/Frame/Interior/설비를 다시 생성하지 않는다. 고정 1/60초 비행, 실제 위치·속도·비행시간, 상대속도, 선분 CCD, 고정 초기 Quaternion과 등속 직선 이동 목표를 지원한다. 빈 공간은 MISS다. 선택한 표적을 자동 명중시키지 않는다.

현재 물리 위치에서 Armor/Hull 구성 재료 → 실제 배타적 Frame 재료 → Bulkhead/Closure → 실제 설비 OBB 등을 **거리 순서**로 합친다. 이는 고정된 시스템별 처리 순서가 아니다. 선행 재료를 통과할 때마다 잔여 에너지·질량·온전도·방향으로 다음 경로를 다시 조회한다. 같은 소유자/층의 중복 셀을 합치고, 다른 소유자가 개입하는 경계에서는 경로를 잘라 다시 계산한다. 시작부터 겹친 소유권이 불명확하면 UNRESOLVED다.

재질 미정 SPINE, 미분류 외부 구조, 공격 장비 하우징/플랫폼처럼 형상만 있고 탄도 재질 계약이 없는 부분은 유한 형상에서 UNRESOLVED를 반환한다. 가짜 강철이나 투명 공간으로 대체하지 않는다. 별도 Joint 금속 구체도 만들지 않는다. 실제 공유 부재 재료를 맞혀야 Joint/Edge를 변경할 수 있다.

## 시험탄 및 재료 모델

| 시험탄 | 구경 mm | 관통체 지름×길이 mm | 질량 kg | 속도 m/s | 관통체/형상 |
|---|---:|---:|---:|---:|---|
| dev-105 | 105 | 75×330 | 12 | 1050 | 경화강 / CAPPED_OGIVE |
| dev-210 | 210 | 185×650 | 100 | 1500 | 경화강 / BLUNT |
| dev-406 | 406 | 170×1200 | 400 | 2400 | 텅스텐 합금 / LONG_ROD |
| dev-500 | 500 | 220×1800 | 1100 | 3500 | 텅스텐 합금 / LONG_ROD |

모두 개발용 가상 시험 제원이다. 역사적 실탄이나 검증된 관통 성능이 아니다. 구경, 관통체 지름, 길이, 질량, 재질, 형상, 침식·파괴 저항을 분리한다. 보이는 무장 구경에서 탄도 성능을 자동 추론하지 않는다. 미래 외부 무장 연결은 `KineticEmitterBinding` 데이터 계약만 제공하며, 장착 무장 발사 Runtime은 구현하지 않았다.

`calibration.ts`에는 기존 구성 재료별 강도형 계수, 관성 항력, 취성, 스침각, 국소 크레이터 반응을 분리했다. 밀도는 기존 Material Registry에서 읽는다. 세라믹면/금속 지지층/파편층을 별개로 처리한다. 단일 방어력 배율·장갑 전체 HP·구경 비교 판정은 사용하지 않는다.

에너지 `½mv_rel²`, 유한 재료 경로, 관통체 면적, 형상·종횡비·입사각, 재료 밀도/게임용 강도 항으로 소요 일을 계산한다. 침식과 온전도 상실, 실제 반사/작은 출구 편향을 다음 비행에 반영한다. PENETRATED / STOPPED / RICOCHET / PROJECTILE_FAILURE / UNRESOLVED를 구분한다. 수식·적용 범위는 `src/damage/README.md`에 기록했다. 실험으로 보정된 공학 해석이라고 주장하지 않는다.

## 국소 손상과 기능

- 각 국소 손상에 실제 소유자·재료층·함선 로컬 위치/법선·표면 좌표·영향 반경·국소 손실/소성변형/균열/박리·유한 관통 채널·shot ID를 저장한다.
- 실제 채널과 교차하는 후속 경로만 비운다. STOP 크레이터의 저항 감소도 그 위치에 한정한다. 다른 위치의 반복 명중이 전 함선 장갑을 소모하지 않는다.
- Hull/Bulkhead 관통 채널은 실제 shell/boundary 참조를 통해 향후 Breach/압력 모델에서 사용할 수 있다. 지금은 감압·산소·기밀 피해를 계산하지 않는다. Hull Breach만으로 모든 설비를 고장 내지 않는다.
- Frame 단면은 실제 소유 재료를 투영한 경계 직사각형의 16×16 타일로 보수적으로 평가한다. 한 실제 채널이 타일 네 꼭짓점을 모두 제거한 경우만 제거로 센다. 중복 구멍 면적을 중복 합산하지 않는다. 부재 온전도가 1% 이하일 때 실제 member/edge를 비활성화한다. 실제 접합 위치의 유효 단면이 사라진 경우만 joint 참조를 끊는다.
- 구조 손실은 기존 `analyzeStructuralInstance`로 Components/도달성을 다시 계산한다. 파괴된 모듈을 별도 물리 객체로 날려 보내지는 않는다.
- 설비와 실제 교차할 때만 결합 에너지 기반 국소 기능 온전도를 줄여 OPERATIONAL / DEGRADED / OFFLINE / DESTROYED로 전이한다. 기존 Power/Control 네트워크 평가 API가 실제 기능 감소를 계산한다. 단순히 전체 함선 HP를 줄이지 않는다. 순수 기능 평가로 보조 전력을 소비하지 않는다.

## 독립 Fixture와 실제 함선의 구분

독립 Fixture: 유한 삼각 평판, 알려진 두께/법선, 복합장갑 층, 얇은 Hull, 경사·모서리, 수작업 유한 용접 부재와 실제 Edge 연결을 사용한다. 기대값은 동일 관통 함수의 출력 복사 대신 기하 길이·TOI·에너지 감소·다른 영역 불변·실제 그래프 분리 등 불변 조건으로 검사한다.

검증된 예: 105 시험탄은 300mm 복합장갑에서 정지해 뒤 Hull에 도달하지 않는다. 500 시험탄은 세라믹→지지층→파편층→얇은 Hull을 잔여 에너지 감소와 함께 통과한다. 30° 유한 평판 길이는 0.3/cos30°와 일치한다. 경계 밖 MISS, 스침각 반사 후 실제 방향 변경, 1초 큰 시간 구간에서도 1mm Hull CCD, 이동 목표의 실제 Hit/Miss와 상대속도, 고정 회전 법선을 검사했다.

동일 국소 관통공을 후속 105탄이 통과하지만 먼 장갑은 계속 방호한다. 다른 위치의 비관통 8발은 중앙 장갑에 영향을 주지 않는다. 수작업 실제 두 부재 용접 Fixture는 실제 재료를 맞고 joint/edge가 끊겨 Components가 증가한다. **이 결과를 대형 생성 함선의 모든 골조가 한 발에 절단된 결과로 주장하지 않는다.**

실제 함선: 과거 Chromium에서 실제 생성·저장한 `.3`/`.3.1` Blueprint 8척을 사용했다. 새로운 가짜 단순 함선을 Architecture별 대용품으로 만들지 않았다. Node 기록은 `actual-ships.json`, Production UI 기록은 `browser/report.json`과 각 실제 손상 JSON이다. 바깥에서의 탄도 실험과 내부 설비 바로 앞에서 시작한 국소 시험을 명시적으로 구분한다. **내부 설비 시험은 외부 장갑 관통 성공을 뜻하지 않는다.**

| 실제 설계 | Query 준비 ms | 외부 500 시험의 마지막 결과 | 순차 접촉 수 | 내부 배전기 파괴 후 추진 권한 |
|---|---:|---|---:|---:|
| BALANCED | 805.2 | PENETRATED | 10 | 0% |
| BLOCK_ASSEMBLY | 1705.2 | PENETRATED | 14 | 50% |
| SPINE_AND_MODULES | 1899.0 | STOPPED | 5 | 0% |
| TRUSS_POD | 2671.2 | PENETRATED | 12 | 50% |
| TWIN_HULL | 2529.6 | RICOCHET | 1 | 50% |
| CORE_AND_NACELLES | 3212.9 | PENETRATED | 8 | 0% |
| STACKED_BLOCKS | 1607.4 | PENETRATED | 6 | 0% |
| HYBRID | 1957.8 | STOPPED | 10 | 50% |

외부 MONOLITHIC 실제 경로는 장갑 3층→Hull→격벽→배전기→후면 Hull/장갑이다. SPINE 외부 경로는 배전기를 통과한 뒤 실제 골조에서 STOPPED, TWIN은 실제 경사 장갑에서 RICOCHET, HYBRID는 뒤쪽 Frame에서 STOPPED였다. STACKED의 해당 선상은 장갑 없는 Hull부터 시작했다. 각 최종 잔여 상태와 STOP의 실제 이동 길이/이용 가능 재료 길이는 JSON에 별도로 남겼다.

추가 제한 경로 `architecture-paths.json`: 실제 노출 TRUSS 부재→Hull/장갑과 포드 내부 설비 경로를 구분했고, TWIN의 `independent-hull--1` / `independent-hull-1` 두 별도 shell을 맞혔다. 첫 shell 손상이 다른 shell을 손상시키지 않았다. 실제 TRUSS 시험에서는 Frame의 국소 관통은 발생했으나 실패 Edge는 0개였다. 이를 생성 함선 절단 성공으로 표시하지 않는다.

동일 실제 설계의 국소 설비 시험: POWER_DISTRIBUTION / dev-105 → DEGRADED, 기능 온전도 0.5738, 전력 120.00→120.00MW.
동일 실제 설계의 국소 설비 시험: POWER_GENERATOR / dev-500 → DESTROYED, 기능 온전도 0.0000, 전력 120.00→0.00MW.

약한 105탄의 실제 설비 명중이 무조건 DESTROYED가 되지 않고 DEGRADED에 그쳤음을 확인했다. 위 국소 시험은 장갑 뒤 설비를 임의 선택해 파괴한 것이 아니라, 명시적으로 내부에 둔 발사 원점에서 실제 유한 장치 형상과 교차한 결과다.


## 기능 결과와 인스턴스

8척 모두 실제 배전 설비 OBB에 명중해 해당 장비가 DESTROYED가 됐다. Blueprint 전체 JSON SHA와 질량은 그대로다. 배전계 구성에 따라 추진 권한은 0 또는 0.5로 감소했고, 이는 같은 장비 ID라도 실제 중복 네트워크에 따라 다르다.

별도 ENDURANCE 실제 설계에서는 한 배전기 파괴 후에도 실제 대체 네트워크로 추진 100%를 유지했다. 순수 충돌/기능 평가 후 각 저장 장치의 180MJ는 그대로였다. A만 사격하면 B는 100%의 초기 기능을 유지하고, Reset은 선택된 인스턴스만 초기화한다. 프레임/배전기 파괴를 UI의 가상 고장 버튼으로 대신하지 않았다.


| 실제 배전기 피격 설계 | 전력 MW | 추진 | 기동 | 사격통제 채널 | 센서 처리 |
|---|---:|---:|---:|---:|---:|
| BALANCED | 120→120 | 1→0 | 1→0 | 8→0 | 8→0 |
| BLOCK_ASSEMBLY | 240→240 | 1→0.5 | 1→0.444444 | 16→8 | 16→8 |
| SPINE_AND_MODULES | 120→120 | 1→0 | 1→0 | 8→0 | 8→0 |
| TRUSS_POD | 240→240 | 1→0.5 | 1→0.5 | 16→8 | 16→8 |
| TWIN_HULL | 240→240 | 1→0.5 | 1→0.5 | 16→8 | 16→8 |
| CORE_AND_NACELLES | 120→120 | 1→0 | 1→0 | 8→0 | 8→0 |
| STACKED_BLOCKS | 240→240 | 1→0 | 1→0.5 | 16→8 | 16→8 |
| HYBRID | 240→240 | 1→0.5 | 1→0.444444 | 16→8 | 16→8 |
| ENDURANCE | 264→264 | 1→1 | 1→1 | 16→16 | 16→16 |

원시 기록은 `capability-comparison.json`이다. 추진/기동은 0–1 권한이며 실제 추력/회전율 측정이 아니다. 장착하지 않은 센서/무장을 생성해 채널을 사용한 것으로 계산하지 않는다.

## Production UI와 시각 검증

기존 Inspector 아래 접이식 **Damage Laboratory**를 추가했다. 실제 현재 함선, A/B, 4종 시험탄, 질량/속도/형상, 임의 world origin/direction, 표적 초기 위치/등속도, 카메라 Ray, 외부 조준선, 명시적인 내부 설비 시험, Fire / Step / Play-Pause / Reset을 제공한다. 기존 조선소 카메라/Renderer를 사용한다.

실제 접촉 선택 → 해당 사건의 국소 손상 Inspector → 실제 접촉면 법선 방향으로 Focus, 순서별 에너지/재료/경로 Trace, 기능 Before/After, 실제 Edge 손실/Components, 인스턴스 JSON Export를 제공한다. 개구부 OPEN/CLOSED/SEALED/BLOCKED와 BLOCKED의 실제 문짝 위치를 분리한다. 문짝 없는 개구부에 닫힌 금속판을 발명하지 않는다.

표시는 실제 궤적·접촉·국소 기록에서만 만든다. 색상 Ring/Marker와 채널 선은 디버그 표현이며, 실제 3D Mesh를 절단해 만든 구멍이 아니다. 원본 물리 Probe는 설계를 조회하고, 현재 손상 경로는 Damage adapter가 조회한다. Laboratory 활성 동안 기존 네트워크/설비·개구부 Debug View는 해당 피해 인스턴스를 사용한다. 닫으면 기존 Inspector의 가상 시험 상태와 선택, Pose/Camera/Overlay를 복원한다. Debug OFF에서 전용 Geometry를 만들지 않는다. 고정 60Hz 시뮬레이션과 약 20Hz 자유 비행 시각화 갱신을 분리했다.

- Production 전체 흐름 52 확인: 8종 실제 함선, A/B, Reset, 장갑 STOP, 외부 연속 관통, 같은 위치 후속탄, MISS, 비행 Pause와 정확한 1/60 Step, ENDURANCE, 과거 무장 저장본, 390px UI.
- 최종 UI 추가 13 확인: 4 시험탄 필드, 실제 외부 피격, 일시 Query cache 없는 Export, 실제 접촉 선택 Inspector, 카메라 Ray, 이동 목표 MISS, BLOCKED 문짝 위치, 모바일, Normal 복귀.
- 실제 접촉 6 확인: SPINE 설계의 Frame/Bulkhead/Equipment 실제 피격 좌표와 별도 미정 SPINE 표면 UNRESOLVED, 활성 피해 인스턴스의 Power Network 표시, 콘솔/페이지 오류 없음.
- 총 71개의 브라우저 확인. 전 Architecture마다 동일한 전체 탄도 매트릭스를 반복한 것은 아니다.
- 별도 실제 ShipViewer 비교에서 기존 `.3.1` 대비 동일 저장 설계 8척의 **Normal Canvas 픽셀과 Draw Calls가 모두 일치**했다. 전체 역사적 Blueprint 픽셀 회귀는 하지 않았다.
- 실제 스크린샷은 `gallery.html`에서 확인할 수 있다. 개념도/생성 이미지를 사용하지 않았다.

## 성능과 메모리

측정 환경: Node 24.19.0, Linux, 2 CPU quota, 8GiB cgroup, Three 0.180.0, Chromium 151/SwiftShader. 생성 benchmark는 브라우저/테스트를 종료하고 동일 470m AEGIS Battleship/MONOLITHIC/Seed 7/목표 3,562,847t/상한 5,000,000t로 측정했다. 버전별 **새 Node 프로세스 3개**, 각 프로세스에서 Cold 1회 + 동일 주문 Cache-hit 1회다. Cold는 번들 import 이후 최초 전체 생성이며 import는 별도 기록했다. OS 파일 캐시까지 비운 실험은 아니다.

| 생성 | Before 중앙값 ms | After 중앙값 ms | Before 표본 p95 ms | After 표본 p95 ms |
|---|---:|---:|---:|---:|
| cold | 9387.1 | 9863.2 | 10258.8 | 10334.6 |
| warm | 2573.8 | 2670.3 | 2604.2 | 2882.4 |

표본 3개의 p95는 nearest-rank 방식의 최댓값이며 모집단 p95 보장은 아니다. Cold 중앙값은 +5.1%, Warm +3.7%다. 분포가 겹치고 생성 코드는 보존됐으나 **회귀가 완전히 0이라고 단정하지 않는다**. 전체 생성 결과 12개의 완전한 Blueprint JSON SHA-256이 모두 일치했다: `b110b664e7089ba2316e60e2e5967468f2d39ad6747972c0296fc08e39cd0270`.

| Cold 내부 단계 (포함 관계, 합산 금지) | Before 중앙값 ms | After 중앙값 ms |
|---|---:|---:|
| Structural generation | 73.7 | 72.8 |
| Procurement physical build | 2277.4 | 2192.2 |
| Interior total | 1778.6 | 1823.4 |
| Functional systems | 1065.2 | 1125.1 |
| Procurement final validation | 2558.3 | 2762.5 |

동일 질량 명세 (Before=After, 사격 후도 불변):

| 항목 | t |
|---|---:|
| hullShellMassKg | 59,017.367 |
| armorMassKg | 293,041.272 |
| actualFrameMassKg | 14,510.042 |
| actualBulkheadMassKg | 14,171.360 |
| totalEstimatedDryMassKg | 628,128.485 |
| UNKNOWN_LEGACY 서비스 추정 | 245,822.300 |

총량은 실제 계산+기존 추정의 합이며 순수 실측 구조 질량이 아니다. UNKNOWN_LEGACY의 항목별 불확실성은 기존 계약 그대로 유지된다. 상세 owner/estimate 구분은 `generation.json`의 mass ledger에 있다.

단발 성능: 실제 470m 함선의 동일 외부 경로를 **독립 인스턴스 12개**에서 사격하고 준비된 Query handle 하나를 공유했다. 실제 5초 비행 전체를 300 step으로 계산한 시간은 중앙값 **10.12ms**, 표본 p95 **44.94ms**, 범위 8.18–44.94ms였다. Query 최초 준비 **846.7ms**는 별도이며 첫 사용 지연에 포함된다. 이 준비를 단발 수 ms 수치에 숨겨 합치지 않았다. **수 ms 수준 목표 미달**이며 기존 유한 query 재조회가 주 병목이다. 후보를 누락해 수치를 맞추지 않았다.

| 단발 세부 항목 | 12발 중앙값 ms |
|---|---:|
| Finite queries + ordered contacts | 6.857 |
| Material response | 0.071 |
| Local damage + capability | 1.627 |
| Advance total | 10.068 |
| 기존 Graph 분석 (별도 순수 호출) | 0.197 |

준비 전 Node heap 45.8MiB → 준비 직후 151.5MiB → 12발 후 강제 GC 159.4MiB. 실제 인스턴스 피해 JSON은 중앙값 19,923bytes/발이다. Query 구조와 기존 캐시 메모리가 상당하며 **첫 준비 비용과 캐시 메모리는 여전히 개선 대상**이다.


Query Profile의 `Finite queries + ordered contacts`는 기존 API 내부 Broadphase/Narrowphase와 합성·정렬을 묶은 시간이다. 내부 각 단계를 별도 계측했다고 주장하지 않는다. `Local damage + capability`도 결합 측정이며, Graph 분석은 따로 기록했다. 포함 관계인 `Advance total`과 세부 시간을 합산하면 안 된다. 단발 heap delta는 GC/JIT가 섞인 전후 차이이며 정확한 allocation 총량/Peak RSS가 아니다.

메모리 수명: 실제 Viewer에서 6회 BALANCED/TWIN 교체, 실제 Export된 피해 Overlay 생성→해제→Normal→강제 GC. BALANCED post-GC 32.3→32.4MB, TWIN 81.8→81.9MB. Overlay 활성은 21 Draw Calls 증가했고 Normal에서는 기존 29/91로 복귀했다. Dispose 후 Blueprint/Ship 참조 해제, Scene children 0, Geometry 0, Texture 0을 확인했다. 이 검사는 전체 Production 앱 메모리와 구분한다. Production 8척 순차 조작 후 post-GC heap은 173.3–318.9MB였다. 서로 다른 설계와 기존 생성 캐시를 포함하므로 이를 Laboratory 순수 비용이라고 부르지 않는다.

History는 최근 256 사건, 궤적 256 점, 물리 국소 피해 최대 4096 영역으로 제한한다. 물리 손상 한계 도달 후에는 UNRESOLVED로 중단하고 과거 관통공을 조용히 잊지 않는다. 화면은 최근 128 영역/64 접촉만 그린다. 프로파일링은 opt-in WeakMap으로 결정적 Blueprint/피해 JSON에 섞지 않는다.

## Targeted 테스트·빌드

관련 자동 테스트 **3파일, 중복 제외 48개 통과**: `damage.test.ts` 14개, `physical-foundation.test.ts` 16개, `free-mount.test.ts` 18개. 개발 중 같은 테스트를 다시 실행한 횟수를 성과로 합산하지 않았다. 최종 구조 단면 보수성 수정 후 직접 영향 테스트 2개를 추가 재실행했고 통과했다.

물리 재질 5+3종, 구성 층 밀도, 유한 입출구/경사·곡면·가장자리/질량, Legacy·자유 장착·플랫폼, 배전/보조전원, 국소 피해, 결정성·JSON을 검사했다. 원본 생성 및 외형은 완전한 Blueprint JSON 비교와 Normal 픽셀 비교로 추가 확인했다. 기존 테스트를 삭제하거나 실패 기준을 완화하지 않았다.

TypeScript `tsc --noEmit`, `npm run build` 통과. 기존 대형 chunk 경고는 남아 있다. 새 의존성/엔진을 추가하지 않았다. 전체 600개 이상 테스트와 무관한 Combat Demo/경제/역사적 전수 UI 검사는 실행하지 않았다.

## 실패·중단 실험

- 초기 브라우저 검사는 반복 사격 후 전체 Armor 접촉 수가 줄어야 한다고 가정해 실패했다. 전면에서 편향이 줄면 후면의 다른 물리 위치와 교차할 수 있어 잘못된 기대였다.
- 두 번째 검사도 owner/layer ID만 비교해 실패했다. 한 장갑판 소유자/재료층이 전후의 다른 면에 걸쳐 존재한다. 실제 **첫 관통공의 위치**로 범위를 한정한 후 통과했다. 물리 Solver를 완화하거나 후방 접촉을 버리지 않았다. 두 실패의 로그/화면/Trace를 보존했다.
- 추가 Architecture 경로 도구가 실제 enum `EXISTING_EXPOSED` 대신 `EXPOSED`를 사용해 대상이 비어 실패했다. 기존 실제 타입에 맞춰 수정했고, 물리 판정은 완화하지 않았다. 원문 실패를 보존했다.
- Visual helper의 문법 오류와 꺼져 있던 비교용 개발 서버도 원문 로그로 보존했다. 수정 후 실제 8척 비교와 해제를 완료했다.
- 환경 재시작으로 첫 생성 성능 측정이 2쌍 후 중단됐다. 중단 로그를 남기고 새 프로세스 측정을 다시 수행했다. 완성되지 않은 표본을 성공 수치에 합치지 않았다.
- 검토 중 STOP Trace가 전체 이용 가능 재료 경로를 실제 이동 길이처럼 표시하던 문제를 발견했다. 실제 entry→stop 길이와 available path를 분리하고, 각 접촉의 잔여 질량·온전도·속도·방향도 기록했다. 해당 독립 경로 검사를 다시 실행했다.
- 생성 함선의 실제 SPINE 미정 표면은 의도적으로 UNRESOLVED다. 내부 설비 파괴 성공을 SPINE 방호 완성으로 주장하지 않는다.

## 남은 한계 / 완료하지 않은 항목

1. CCD는 유한 물리 체적을 통과하는 **중심선** 모델이다. 관통체 반지름은 소요 일·국소 채널에 쓰며, 측면 접촉을 확장한 완전한 원통 Sweep은 아니다. 중심선은 빗나가고 반지름만 닿는 경계 사례는 놓칠 수 있다.
2. 고정 초기 회전 + 등속 직선 이동만 지원한다. 계속 회전하는 목표, 가속·회전 비행 표적은 물리 정확도를 보장하지 않으며 충돌 시 명시적으로 UNRESOLVED다.
3. 재료 내부는 직선 chord와 평균 속도 체류, 편향은 출구 impulse로 근사한다. 탄체 유한 요소/세부 질량 분포/완전 유체·탄소성 해석은 아니다.
4. 설비는 실제 OBB에 사양 질량을 분포시킨 등가 모델이다. 상세 케이싱·회로·회전자 형상은 없다. 국소 손상에서 기능 온전도로의 결합도 게임용 보정이다.
5. 손상 채널은 유한 capped cylinder이므로 다른 각도의 후속탄은 cap 근처 잔여 재료를 맞힐 수 있다. 곡면·비정형 부재의 단면 Grid는 보수적 근사이며 미세한 잔존/손실을 정확히 해석하지 않는다. 크레이터의 피로·열·장기 성장 모델은 없다.
6. 실제 Joint는 공유 부재/접합 참조다. 독립 금속 재질/두께가 정의되지 않은 Joint를 별도 방호층으로 취급하지 않는다. 정확한 접합 응력/FEM은 없다.
7. 미정 SPINE/일부 외부 장비/플랫폼의 탄도 재료 계약은 아직 없다. 해당 부분은 UNRESOLVED로 남는다. 외부 Free-Mount 장착 조건과 내부 공간 검사는 추가하지 않았다.
8. 감압·산소·화재·파편·폭발·배선 전파·함선 절단·실제 포드 분리·파괴 Mesh/질량 손실·Combat Runtime은 구현하지 않았다.
9. DamageInstance와 Trace JSON Export는 제공한다. 런타임 피해 세이브게임 Import/재개, 장착 무장 실제 발사는 아직 없다. Blueprint의 기존 저장/복원과 무장 보존은 별개로 검증했다.
10. 단발 수 ms 목표와 원통 CCD 전체 정확도는 완료라고 표시하지 않는다. 제한된 시드·대표 설계 QA이며 전수 회귀나 장시간 누수/스트레스 보장은 아니다.

## 변경 파일과 Commit

- `package-lock.json`
- `package.json`
- `src/damage/README.md`
- `src/damage/calibration.ts`
- `src/damage/contacts.ts`
- `src/damage/diagnostics.ts`
- `src/damage/flight.ts`
- `src/damage/material.ts`
- `src/damage/registry.ts`
- `src/damage/state.ts`
- `src/damage/types.ts`
- `src/main.ts`
- `src/physical/unresolved.ts`
- `src/rendering/damage.ts`
- `src/rendering/viewer.ts`
- `src/structure/query.ts`
- `src/style.css`
- `src/ui/damage.ts`
- `src/ui/layout.ts`
- `tests/damage-actual.mjs`
- `tests/damage-capabilities.mjs`
- `tests/damage-benchmark.mjs`
- `tests/damage-browser-contacts.mjs`
- `tests/damage-browser-extra.mjs`
- `tests/damage-browser.mjs`
- `tests/damage-fixtures.ts`
- `tests/damage-harness.mjs`
- `tests/damage-paths.mjs`
- `tests/damage-visual.mjs`
- `tests/damage.test.ts`
- `qa/v1.8.6.4/`: 보고서, 실제 JSON/Trace/Profile, 원문 로그, 실제 Chromium 이미지 및 갤러리.


구현 로컬 Commit: `b12f9ab533d95084c0c7459312ebadd60c8aad5f` (`feat: add finite ballistic flight and localized ship instance damage laboratory`). 이 보고서와 원문 QA 자료는 별도 후속 로컬 문서 Commit으로 보관한다. 최종 문서 Commit ID는 최종 응답 및 `git log -1`에서 확인할 수 있다. 원격 Push/Force Push는 수행하지 않았다.

실행 예: `npm install`, `npm run dev`; 기존 Production 화면에서 함선 생성/불러오기 후 Inspector의 Damage Laboratory를 연다. Enable → 시험탄/실제 조준선 → Fire. 단위는 m/kg/m/s, 에너지는 MJ 표시다. UI는 개발용 시험 도구이며 별도 전투 게임을 만들지 않았다.
