# V1.8.4.2 — Design Requirement Guarantee

## 기준과 버전 계약

작업 시작 HEAD는 `cc4476a` (`work`)였다. 원격 `origin/work`와 같았지만, 로컬에는 V1.8.4.1의 Doctrine, 무장 재계획, UI, 테스트 및 QA가 미커밋으로 존재했다. 해당 로컬 구현을 기준으로 조사했다. 변경 전 diff와 새 파일 백업을 별도로 확보했으며 기존 QA 디렉터리를 삭제하지 않았다.

`schemaVersion: 2`, `generatorVersion: 1.8.4`, Production/무장 규격 버전 계약은 그대로다. 선택적인 `designRequirements.version: 1.8.4.2`가 신규 설계 경로를 구분한다. Doctrine은 기존 `designDoctrine` 원장을 그대로 사용한다. `designRequirements`는 필수/목표/선택 계약, 원장의 분야 참조, 예약 구획 및 판정 증거를 기록하며 같은 자원 총량을 새로 만들지 않는다.

기본 Production 생성은 requirements-first다. `generateBlueprint(order, seed, {version:'1.8.4.1'})`는 기존 Production 생성 규칙을 검사하는 명시적 회귀 경로다. 기존 Production/Doctrine QA 입력과 단언은 이 경로에서 유지한다. 신규 요구사항 테스트는 기본 경로에서 작동하며 작은 XL 주문서 거절을 검사한다. 과거 저장 Blueprint는 생성 경로를 실행하지 않고 원본 데이터로 렌더링한다.

## 함종별 Mandatory

모든 함선에는 실제 부모 구조물에 부착된 양의 크기의 기본 추진계, 접합·장갑·개구부·Foundation·대칭·충돌·사격을 검사하는 기존 전체 Validation이 필수다. 다음은 그 위에 적용하는 함종의 최소 기능 계약이다. 임의의 모든 함종 공통 고정 포 수량은 없다.

| 함종 | 최소 기능 계약 |
|---|---|
| Corvette | 실제 공격 무장 및 추진 체적 비중 8% 이상 |
| Frigate | 실제 공격 무장과 근접방어 |
| Destroyer | 실제 공격 무장과 요격용 근접방어 |
| Cruiser | 실제 M/L 함포 및 실제 센서 조립체 |
| Battlecruiser | 실제 M/L 함포 및 추진 체적 비중 8% 이상 |
| Battleship | 실제 L 함포와 유지된 CITADEL 보호 구조 |
| Missile Ship | 실제 발사기; 발사기 규격 Cost 투자 ≥ 함포 규격 Cost 투자 |
| Spinal Gun Ship | 변경하지 않은 XL 장착 계약, 전체 Envelope·포미·공급/에너지 구획·실제 출구·발사축 |
| Patrol Ship | 실제 센서 조립체와 근접방어 |

Cruiser/Battlecruiser의 M 및 Battleship의 L은 이 버전의 최소 주무장 체급 정책이다. 그 장비를 수용할 수 없는 작은 함종/길이/질량 조합은 다른 체급으로 정상 출고하지 않고 거절한다. 최소 추진 비중은 추력이나 실제 가속도 수치가 아닌 설계 자원 정책이다. 미사일 투자 비교는 공통 규격 Cost 지수이며 전투 피해량이 아니다.

## 파이프라인과 공간 예약

1. Order를 복제하고 입력 범위와 Seed를 정규화한다.
2. Role 및 여섯 Priority에서 Mandatory / Target / Optional 계약을 생성한다.
3. 규격을 바탕으로 필수 무장과 공급 공간의 자원 하한, 구조·추진·장갑·항속·센서 비중 하한을 만든다.
4. 조선소 및 Role의 기존 Architecture 가중치 순서를 유지하고 Family 호환성 안에서 후보를 사전 필터링한다.
5. Macro의 **모듈 recipe가 stations·접합·추진·장갑보다 먼저** 필수 단면과 장착 공간을 예약한다.
6. 실제 Hull에 구획 Bounds를 결합하고 구획이 모든 관련 station 단면에 들어가는지 검사한다.
7. 기존 기능 개구부와 장갑 생성기를 사용한다. 예약된 전방 개구부에 보강 cap을 씌우지 않는다.
8. 필수 자원 하한을 먼저 확보하고 나머지 자원만 기존 경쟁 가중치로 배분한다. 완성된 장갑 비용이 필수 무장 하한까지 잠식하면 후보를 거절한다.
9. 무장 beam search가 함종의 필수 구성 달성을 Target 점수보다 먼저 비교한다. 완전한 대칭 그룹·표준 규격 대체·충돌·사격 검증은 유지한다.
10. 실제 장착·센서·추진·예약 구획을 독립적으로 확인하고, 기존 전체 Blueprint validator를 통과한 결과만 반환한다.

후보 수는 최대 6개다. 다른 유효 Architecture/Family를 먼저 시도하고 뒤에서 가까운 Macro variant를 재시도한다. 후보 순서와 retry seed는 입력만으로 결정된다. 사전 필터로 거절된 조합과 실제 후보의 실패 이유를 분리 기록한다. 전체 Target 전역 최적해를 탐색하지 않으며 Mandatory를 통과한 첫 유효 후보를 반환한다.

## XL 구조 및 실제 실패 원인

300m 기준 설치 규격은 45×75m, 장비 Envelope은 45×30×105m, HULL_INTEGRATED, Cost 18이다. 기존 cbrt 스케일과 0.65–2 제한을 그대로 호출한다.

| 기존 Seed | 기존 결과 | 확인된 원인 |
|---|---|---|
| 7 | MONOLITHIC / WEAPON_DOMINANT, XL 1 | 기본 host가 기존 Envelope 수용 |
| 11 | SPINE_AND_MODULES / WEAPON_DOMINANT, XL 0 | 선수 단면 약 28.1×22.9m, XL 45×30m보다 작음 |
| 23 | MONOLITHIC / WEAPON_DOMINANT, XL 0 | 최대 폭은 충분하지만 선수 폭 약 37.8m로 Envelope 앞부분 수용 불가 |

새 Macro는 기존 축 host의 실제 단면을 확보한다. 모서리 bevel과 slope까지 감안한 단면 여유를 두며 인접 측면 모듈과 지지부를 예약 공간 밖으로 계획한다. 지지부를 삭제하거나 이미 만들어진 장갑을 제거하는 방식은 사용하지 않는다. MONOLITHIC의 WEAPON_DOMINANT, SPINE_AND_MODULES와 HYBRID의 WEAPON_DOMINANT/SPLIT_FRAME을 후보로 지원한다. 나머지 기존 Family 호환 조합은 유지하지만 현재 연속 축 host recipe가 없는 조합은 XL 후보에서 제외한다.

축무장 구획은 실제 Envelope 전체이며 포미를 포함한다. 후방에는 총 25m(규격 scale 적용)의 공급/에너지 예약을 두 개의 인접 비중복 구획으로 나눈다. 마지막으로 20m scale의 후방 구조 여유가 필요하다. 이에 따라 40m 및 100m XL 주문서는 최소 전체 길이 검사에서 즉시 거절된다. 이 수치는 전투 원자로/탄약 모델이 아니라 향후 시스템을 위한 명시적인 설치·접근 공간 정책이다.

최종 검사에서는 모든 station 경계에서 Envelope와 후방 구획을 확인하고, 장갑/설비 침입과 실제 forward ray를 검사한다. 실제 개방된 muzzle collar와 HULL_INTEGRATED XL reference도 확인한다. 선언된 `SATISFIED`나 수량만 신뢰하지 않는다.

## 자원 의미와 중복 방지

질량 필드는 기존 추정 계수의 **estimated-tonne-equivalent**, 체적과 표면은 기하 형상을 기준으로 한 **geometric-m3-reservation / geometric-m2**다. 실측 질량이나 실제 재료 밀도가 확정된 Combat Blueprint가 아니다. `resourceUnits`가 이를 명시한다. 에너지는 **abstract-design-units**이고 MW·추력·부스트 성능으로 표시하지 않는다.

분야 원장은 기존 Doctrine의 `structure / propulsion / armor / weapons / endurance / sensor` 하나다. 하한을 먼저 차감하고 잔여 질량·체적만 경쟁 배분한다. 설치 표면은 Hull/장갑 이후 측정해 판정한다. 측정 전 표면 0을 설치 불가능으로 오판하지 않는다.

XL은 전체 Envelope 체적을 무장 예약에 차감한다. 공급/에너지의 두 구획은 구조 분야 안에서 차감한다. Energy 체적도 구조의 하위 예약이며 독립적인 추가 capacity가 아니다. 필수 XL host에 무장 체적 하한을 먼저 할당한 뒤 다른 host가 잔여 체적만 공유한다. 글로벌 원장과 host 원장에서 같은 예약을 다시 더하지 않는다.

센서·항속·추진 등은 실내 상세 부품이 전부 구현된 것이 아니다. 기존 실제 엔진·센서·방열·정비 조립체와 분야별 내부 운용 예약을 구분한다. 주추진계 형상, 실제 무장 질량 및 공급 공간은 비교할 수 있지만 실제 전투 가속도·연료 소모·탐지 거리·피해량은 이 버전의 계산 대상이 아니다.

## 우선순위 및 설명

각 Target은 독립적인 무한 보너스가 아니라 분야 비중 목표다. 실제 비중이 목표보다 낮으면 `LIMITED`를 기록한다. 각 Priority의 입력값뿐 아니라 실제 분야 비중, 체적 예약, 실제 관련 설비 수, 주포 규격 투자·노즐 출구 면적·장갑 고체 체적·외장 설비 체적 및 목표 대비 비중 지수를 저장한다. 변경된 우선순위가 같은 장비 수를 만들어도 예약·경쟁 결과가 달라지는지 QA에서 검사한다. 같은 예약과 같은 최종 결과라면 포화/필수 하한/공간 제한을 기록하며 성공 변화로 세지 않는다.

UI 요약은 필수 조건 충족 개수와 Spinal XL 설치 수만 보여준다. 기존 Doctrine 상세 Inspector에 목표 달성도, 예약 공간, 분야 비중 및 한계를 추가한다. 설계 거절 시 `ORDER INVALID`와 구체적인 코드, 별도 실패 상세를 보여준다. 이전 유효 Blueprint는 자동 수정하거나 새로운 주문의 성공품으로 교체하지 않는다.

## 검사와 제한

`npm run qa:requirements`는 신규 계약/변조 검사 및 여러 Seed 통제 실험을 수행한다. `npm run qa:doctrine`은 기존 V1.8.4.1 입력/기준을 유지한다. Production preview에서 `OUT=qa/v1.8.4.2/ui REQUIREMENTS_QA=1 node tests/unified-ui-qa.mjs`로 저장·Import·픽셀 재현·XL 설치·불가능 주문 거절·모바일 설명을 검사한다.

[통제 비교표](../qa/v1.8.4.2/controlled-comparisons.md), [판정 보고서](../qa/v1.8.4.2/assessment.md), [기존 실패 원자료](../qa/v1.8.4.2/baseline-xl.json)를 참조한다. 최초 사전 표면 예산 오류로 실패한 실험도 `initial-experiment-failures.json`에 보존한다. 예약·장착 실패는 정상적인 설계 거절일 수 있으나 가능한 대표 입력의 Mandatory 검사 실패는 테스트 실패로 취급한다.

## 실제 수정 파일

V1.8.4.1 로컬 기준 위에서 추가·확장한 핵심 파일:

- `src/generation/production/requirements.ts`: 사전 계약, 호환 후보, Macro 예약, 구획 결합, 실제 기능 판정, 독립 Validation.
- `src/generation/generate.ts`: 기본 requirements-first 경로, 결정적 후보 재시도, 명시적 거절, 이전 Production 회귀 경로.
- `src/generation/macro/plan.ts`: stations 생성 이전 필수 단면·설치 공간 반영.
- `src/generation/architecture/equipment.ts`, `src/generation/integration/reservations.ts`: XL 실제 muzzle 및 전방 개구부 보호.
- `src/generation/production/doctrine.ts`: 필수 하한 우선·잔여 경쟁 배분, XL 전체 Envelope 체적, host 체적 배분.
- `src/generation/production/weapons.ts`: 함종의 Mandatory 구성 달성을 먼저 비교하는 beam 상태 순위.
- `src/generation/production/build.ts`, `validate.ts`, `functional.ts`: 파이프라인 기록·최종 출고 계약·실제 필수 센서 후보.
- `src/blueprint/types.ts`, `src/main.ts`, `src/ui/layout.ts`, `src/style.css`: 선택적 schema 확장과 요약·상세·거절 UI.
- `tests/design-requirements*.test.ts`, `summarize-design-requirements.mjs`: 계약 변조·통제 실험·성능·판정 원자료.
- 기존 Production/Doctrine 테스트에는 버전 회귀 경로를 명시했으며 기존 입력·단언을 유지했다. `tests/unified-ui-qa.mjs`의 기존 검사를 보존하고 requirements 검사를 추가했다.

전체 Git 변경에는 작업 시작 시 미커밋이던 V1.8.4.1 구현도 함께 보존된다. 최종 Commit SHA와 Push 결과는 완료 응답에 기록한다.
