# V1.8.4.1 — 여러 Seed 설계 경향 판정

전체 A–E 수량·방향·자원·설비 비용 표는 [controlled-comparisons.md](controlled-comparisons.md), Seed별 목표/실제/생략 기록은 [원자료](controlled-comparisons.json)에 있다. 이 판정은 성공한 단일 Seed를 선택하지 않고 Seed 7·11·23의 동일 입력 쌍을 모두 비교한다. 예산은 예약 모델이고, 외장 설비의 실제 고체 비용은 별도다.

| 우선순위 10 → 90 | 경쟁 예산 분야 | 예산 비중 변화 %p (Seed 7 / 11 / 23) | 실제 관측 지표 | 실제 지표 변화 (같은 순서) | 기대 방향 관측 |
|---|---|---|---|---|---|
| firepower | weapons | 13.81 / 13.30 / 11.50 | 함포 규격 투자 지수 (S=1/M=3/L=8/XL=18) | 20.00 / 12.00 / 14.00 | 3/3 Seed |
| missile | weapons | 7.49 / 7.44 / 5.65 | 실제 발사기 수 | 4.00 / 4.00 / 2.00 | 3/3 Seed |
| survivability | armor | 9.35 / 7.84 / 7.55 | 실제 근접방어 수 | 7.00 / 4.00 / 6.00 | 3/3 Seed |
| mobility | propulsion | 11.56 / 11.56 / 11.56 | 함선 질량 한도 대비 실제 무장 질량 % (감소 목표) | -3.47 / -0.79 / -7.26 | 3/3 Seed |
| endurance | endurance | 13.72 / 13.72 / 13.72 | 실제 방열/정비 조립체 수 | 4.00 / 4.00 / 4.00 | 3/3 Seed |
| sensor | sensor | 11.14 / 11.14 / 11.14 | 실제 센서 조립체 수 | 2.00 / 2.00 / 2.00 | 3/3 Seed |

함포 투자 지수는 실제 규격별 수량의 비교용 지표이며 피해량 시뮬레이션이 아니다. Mobility는 실제 무장 질량 비중 감소를 판정하므로 총 무장 개수가 반드시 줄어야 한다고 가정하지 않는다. Endurance는 실제 방열·정비 설비와 연료/운용 예약을 함께 본다.

## 수량이 그대로인 경우

- **mobility, Seed 11:** 함포/미사일/PD/센서 수량이 그대로다. 실제 무장 질량은 112886 → 90210 t, 방열/정비 조립체는 3 → 3개다. 수량 민감도가 검증된 것으로 계산하지 않았다. 높은 우선순위 설계의 목표 미달과 공간·사격·자원 제약: Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; Explicit replacement M CENTERLINE TOP → M BILATERAL PORT: standard-size whole group selected for resource / footprint / clearance fit; original target retained; Explicit replacement M BILATERAL TOP → S BILATERAL TOP: standard-size whole group selected for resource / footprint / clearance fit; original target retained
- **endurance, Seed 11:** 함포/미사일/PD/센서 수량이 그대로다. 실제 무장 질량은 112886 → 112886 t, 방열/정비 조립체는 0 → 4개다. 수량 민감도가 검증된 것으로 계산하지 않았다. 높은 우선순위 설계의 목표 미달과 공간·사격·자원 제약: Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor; Explicit replacement L CENTERLINE TOP → M BILATERAL PORT: standard-size whole group selected for resource / footprint / clearance fit; original target retained; No coherent whole-group candidate: Firing arc point_defense-2-0 hits fore-armor/primary; Firing arc point_defense-2-1 hits fore-armor/primary; Firing arc point_defense-2-0 hits fore-armor/shoulder--1; Firing arc point_defense-2-1 hits fore-armor/shoulder-1; armor and standards retained

## XL 목표의 물리적 제한

- Seed 7: XL 목표 1, 실제 1. 
- Seed 11: XL 목표 1, 실제 0. XL omitted: actual axial host cannot contain unchanged XL envelope; legacy macro and muzzle geometry retained, no scaled-down XL installed
- Seed 23: XL 목표 1, 실제 0. XL omitted: actual axial host cannot contain unchanged XL envelope; legacy macro and muzzle geometry retained, no scaled-down XL installed

이 입력에서는 축무장 임무 목표가 미달이다. 방어/보조 구성의 차이는 관측되지만 이를 XL 교리의 실제 설치 성공으로 주장하지 않는다. 기존 Macro의 축 구조물·개구부가 변경하지 않은 XL 규격을 수용하지 못하면 생략한다. 표준 규격을 축소하거나 설치되지 않은 축무장을 집계하지 않는다. 충분한 사각 축 구조물과 자원 예산에서는 XL 수용 계약의 양성 검사가 통과한다.

## 모든 우선순위가 높은 경우

| Seed | 전체 질량 / 체적 한도 t / m³ | 실제 예약/무장/장갑 사용 t / m³ | 남은 t / m³ | 한도 준수 |
|---|---|---|---|---|
| 7 | 821816 / 1408827 | 801136 / 909465 | 20680 / 499362 | 통과 |
| 11 | 589593 / 1010731 | 552216 / 650054 | 37377 / 360678 | 통과 |
| 23 | 756831 / 1297424 | 718285 / 842400 | 38546 / 455024 | 통과 |

전체 126개 통제 입력 중 126개 생성, 0개 거부. 조정 기록 resources는 경쟁 수요 정규화, armor는 보존된 장갑 비용과 무장 예산의 절충을 설명한다.
