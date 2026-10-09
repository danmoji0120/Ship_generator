# V1.8.4.2 판정 보고서

[222개 통제 비교표](controlled-comparisons.md) · [원자료](controlled-comparisons.json) · [구현·요구사항 정의](../../docs/design-requirements-v1.8.4.2.md)

출고 200/222, 명시적 거절 22, 필수 미달 출고 0. 거절을 성공적인 장비 설치로 집계하지 않는다.

## 기존 XL 실패 개선 전후

| Seed | V1.8.4.1 Architecture / XL | V1.8.4.2 Architecture / XL | 구획 수 | 필수 요구사항 |
|---|---|---|---|---|
| 7 | MONOLITHIC / 1 | MONOLITHIC / 1 | 3 | 충족 |
| 11 | SPINE_AND_MODULES / 0 | SPINE_AND_MODULES / 1 | 3 | 충족 |
| 23 | MONOLITHIC / 0 | MONOLITHIC / 1 | 3 | 충족 |

## 함종별 동일 입력 비교

| 함종 | 출고 Seed | 핵심 요구사항 | 실제 함포/미사일/PD/센서 (Seed 7 / 11 / 23) |
|---|---|---|---|
| Corvette | 3/3 | At least one offensive weapon; propulsion allocation fraction >= 0.08 | 9/2/10/1 · 6/2/4/1 · 7/2/7/1 |
| Frigate | 3/3 | Offensive weapon and actual point defense | 4/2/11/1 · 2/2/6/1 · 4/2/9/1 |
| Destroyer | 3/3 | Offensive weapon and actual point defense | 4/4/5/1 · 2/2/4/1 · 2/4/5/1 |
| Cruiser | 3/3 | Actual M/L cannon and actual sensor assembly | 3/2/6/1 · 4/2/4/1 · 3/2/5/1 |
| Battlecruiser | 3/3 | Actual M/L cannon; propulsion allocation fraction >= 0.08 | 5/2/4/1 · 4/2/4/1 · 5/2/2/1 |
| Battleship | 3/3 | Actual L cannon and retained CITADEL armor | 6/2/8/1 · 5/0/7/1 · 5/2/9/1 |
| Missile Ship | 3/3 | Actual missile launcher and missile investment cost >= cannon investment cost | 2/6/6/1 · 2/4/4/1 · 2/6/5/1 |
| Spinal Gun Ship | 3/3 | Actual HULL_INTEGRATED XL plus independent full-envelope/axis/reservation checks | 2/2/9/1 · 2/0/5/1 · 2/2/7/1 |
| Patrol Ship | 3/3 | Actual sensor assembly and actual point defense | 8/0/15/1 · 6/0/8/1 · 6/0/14/1 |

## 우선순위 0 / 50 / 100 민감도

비중은 전체 설계 자원에 대한 실제 분야 예약이다. 무장 개수만으로 성공을 판정하지 않는다. 목표 비중은 8% + 우선순위×0.2%p이며 실제 성능 측정값이 아니다.

| 우선순위 | Seed | 분야 비중 0/50/100 (%) | 예약 체적 0/50/100 (m³) | 실제 관련 장비 0/50/100 | 실제 형상/설비 지표 0/50/100 | 판정 / 동일 결과 이유 |
|---|---|---|---|---|---|---|
| firepower | 7 | 17.46/24.56/30.00 | 202200/284326/347395 | 1/3/7 | 3.0/14.0/26.0 (cost-index) | 실제 배분/구성 변화 |
| firepower | 11 | 17.60/24.68/30.11 | 139768/195943/239083 | 2/4/6 | 6.0/12.0/18.0 (cost-index) | 실제 배분/구성 변화 |
| firepower | 23 | 17.49/24.58/30.02 | 186489/262084/320138 | 2/3/5 | 6.0/14.0/20.0 (cost-index) | 실제 배분/구성 변화 |
| missile | 7 | 20.99/24.56/27.65 | 242987/284326/320208 | 0/2/4 | 0.0/14671.8/29343.6 (geometric-m3) | 실제 배분/구성 변화 |
| missile | 11 | 21.12/24.68/27.83 | 167667/195943/187027 | 0/2/2 | 0.0/14671.8/648.0 (geometric-m3) | 실제 배분/구성 변화 |
| missile | 23 | 21.01/24.58/27.68 | 224033/262084/295112 | 0/2/4 | 0.0/14671.8/29343.6 (geometric-m3) | 실제 배분/구성 변화 |
| survivability | 7 | 11.53/17.56/22.59 | 110419/203359/311114 | 37/38/38 | 561682.8/840293.3/1188267.6 (geometric-m3) | 실제 배분/구성 변화 |
| survivability | 11 | 11.50/17.53/22.55 | 61900/139223/213017 | 169/140/140 | 352944.0/595964.0/848473.8 (geometric-m3) | 실제 배분/구성 변화 |
| survivability | 23 | 11.53/17.56/22.58 | 101659/187219/286428 | 55/57/57 | 589253.8/893261.9/1275397.0 (geometric-m3) | 실제 배분/구성 변화 |
| mobility | 7 | 12.28/17.86/22.58 | 146558/206782/253331 | 1/1/4 | 247.8/346.7/312.3 (geometric-m2) | 실제 배분/구성 변화 |
| mobility | 11 | 12.27/17.83/22.52 | 96739/141605/146882 | 4/4/4 | 158.4/158.4/114.4 (geometric-m2) | 실제 배분/구성 변화; 장비 수 동일: Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| mobility | 23 | 12.28/17.85/22.57 | 134947/190380/233224 | 4/4/4 | 315.0/315.0/315.0 (geometric-m2) | 실제 배분/구성 변화; 장비 수 동일: Measured retained armor exceeds reservation; weapon capacity reduced to protect completed armor |
| endurance | 7 | 7.92/14.65/20.17 | 86444/169680/246877 | 0/3/4 | 0.0/1093.3/1173.8 (geometric-m3) | 실제 배분/구성 변화 |
| endurance | 11 | 7.91/14.63/20.10 | 58630/116146/138291 | 0/3/4 | 0.0/1034.8/1146.6 (geometric-m3) | 실제 배분/구성 변화 |
| endurance | 23 | 7.92/14.65/20.16 | 79588/156208/227272 | 0/3/4 | 0.0/1203.5/1394.2 (geometric-m3) | 실제 배분/구성 변화 |
| sensor | 7 | 4.84/10.18/14.76 | 56013/117914/170883 | 1/1/3 | 1137.9/1547.8/1986.8 (geometric-m3) | 실제 배분/구성 변화 |
| sensor | 11 | 4.83/10.16/14.73 | 38365/80706/116938 | 1/1/3 | 763.9/1038.6/1361.7 (geometric-m3) | 실제 배분/구성 변화 |
| sensor | 23 | 4.84/10.18/14.75 | 51572/108550/157308 | 1/1/3 | 1124.7/1529.7/1964.5 (geometric-m3) | 실제 배분/구성 변화 |

Mobility의 실제 노즐 출구 면적은 단조 증가하지 않는다. Seed 23은 0/50/100에서 315m²로 동일하며, 기존 nozzle bell 간격에 따른 반경 상한이 적용된다. Seed 11은 HAMMERHEAD→WIDE_CARRIER Family 선택과 실제 rear/노즐 간격 변화로 158.4→114.4m² 감소한다. Seed 7도 50→100에서 엔진 cluster 구성이 바뀌며 면적이 줄었다. 추진 예약 비중 증가는 검증됐으나 더 높은 추력·가속도를 달성했다고 판정하지 않는다.

## 명시적 거절과 극단 예산

| 분류 | 수량 | 주요 코드 |
|---|---|---|
| C | 21 | REQUIRED_XL_BREECH_SPACE_UNAVAILABLE; REQUIRED_DESIGN_BUDGET_EXCEEDED; REQUIRED_ROLE_CAPABILITY_UNAVAILABLE |
| E | 1 | REQUIRED_XL_STRUCTURE_UNSUPPORTED |

| 모든 우선순위 100 | Seed | 잔여 설계 질량 환산 / 체적 | 에너지 예약 (추상 단위) | 한도 준수 |
|---|---|---|---|---|
| Cruiser all100 Light | 7 | 2951 / 365263 | 38/100 | 충족 |
| Cruiser all100 Light | 11 | 13797 / 266869 | 38/100 | 충족 |
| Cruiser all100 Light | 23 | 12510 / 330323 | 38/100 | 충족 |
| Cruiser all100 Superheavy | 7 | 193249 / 404261 | 38/100 | 충족 |
| Cruiser all100 Superheavy | 11 | 265522 / 337369 | 38/100 | 충족 |
| Cruiser all100 Superheavy | 23 | 199302 / 373641 | 38/100 | 충족 |
| Spinal Gun Ship all100 Light | 7 | 4336 / 286601 | 38/100 | 충족 |
| Spinal Gun Ship all100 Light | 11 | 20688 / 304479 | 38/100 | 충족 |
| Spinal Gun Ship all100 Light | 23 | 37750 / 352891 | 38/100 | 충족 |
| Spinal Gun Ship all100 Superheavy | 7 | 286141 / 357421 | 38/100 | 충족 |
| Spinal Gun Ship all100 Superheavy | 11 | 157498 / 235065 | 38/100 | 충족 |
| Spinal Gun Ship all100 Superheavy | 23 | 137705 / 232695 | 38/100 | 충족 |
| Missile Ship all100 Light | 7 | 3528 / 364049 | 38/100 | 충족 |
| Missile Ship all100 Light | 11 | 1906 / 256964 | 38/100 | 충족 |
| Missile Ship all100 Light | 23 | 368 / 319757 | 38/100 | 충족 |
| Missile Ship all100 Superheavy | 7 | 161902 / 365731 | 38/100 | 충족 |
| Missile Ship all100 Superheavy | 11 | 280603 / 335801 | 38/100 | 충족 |
| Missile Ship all100 Superheavy | 23 | 156877 / 334704 | 38/100 | 충족 |

## 같은 주문서·Seed의 성능 비교

동일 프로세스의 wall time이며 성능 보장은 아니다. Blueprint에는 시간 값을 넣지 않는다. 이전 버전과 새로운 버전은 의도적으로 Hull/구성 및 검증량이 다르다.

| 함종 | Seed | V1.8.4.1 ms | V1.8.4.2 ms | 배율 | 신규 실패 후 재시도 수 |
|---|---|---|---|---|---|
| Cruiser | 7 | 2213 | 1216 | 0.55 | 0 |
| Cruiser | 11 | 1820 | 1752 | 0.96 | 0 |
| Cruiser | 23 | 1977 | 1124 | 0.57 | 0 |
| Missile Ship | 7 | 1607 | 1072 | 0.67 | 0 |
| Missile Ship | 11 | 1673 | 1585 | 0.95 | 0 |
| Missile Ship | 23 | 1560 | 1225 | 0.79 | 0 |
| Spinal Gun Ship | 7 | 1288 | 1832 | 1.42 | 0 |
| Spinal Gun Ship | 11 | 1842 | 1642 | 0.89 | 0 |
| Spinal Gun Ship | 23 | 1607 | 1252 | 0.78 | 0 |

## 남은 한계와 보존한 실패

- 최초 실험에서 78개 테스트가 사전 표면 예산 검사 오류로 실패했다. 같은 입력과 성공 기준을 유지해 수정 후 재검사했다. [실패 원자료](initial-experiment-failures.json)와 initial-experiment.log.txt를 보존했다.
- 내부 연료·원자로·탄약·추력·탐지 거리·전투 피해는 아직 시뮬레이션하지 않는다. 질량은 추정 tonne-equivalent, 에너지는 추상 설계 단위다.
- 현재 XL 후보 recipe는 3 Architecture, 호환된 WEAPON_DOMINANT/SPLIT_FRAME Family다. 연속 축 구조가 없는 다른 조합은 사전 거절한다.
- 작은 capital/medium battery 역할은 물리 규격을 낮춰 출고하지 않고 거절할 수 있다. 예약 목표 미달 및 Optional 생략은 Blueprint에 남는다.
- 제한된 후보 및 beam 폭으로 전역 최적해를 보장하지 않는다. 미달 거절은 기록되며 수용 가능성이 있는 모든 주문서를 완전히 찾았다는 주장은 하지 않는다.
