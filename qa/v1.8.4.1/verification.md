# V1.8.4.1 검증 기록

## 구현 및 재현

- [설계 모델과 제약](../../docs/design-doctrine-v1.8.4.1.md)
- [A–E 비교표](controlled-comparisons.md): 42개 조건 × Seed 7·11·23 = 126개 입력
- [전체 비교 원자료](controlled-comparisons.json)
- [Seed별 경향·미달 판정](sensitivity.md)
- 재현: `npm run qa:doctrine`; UI: `node tests/unified-ui-qa.mjs` (Production preview 서버 필요)

## 실행 결과

| 검사 | 결과 |
|---|---|
| TypeScript 및 Production 빌드 (`npm run build`) | 통과 |
| Production + Doctrine 최종 단위/계약 검사 | 28개 통과 |
| Production 함종·조선소·길이·극단 입력 매트릭스 | 124개 통과 |
| A–E 여러 Seed 통제 실험 | 126개 생성 및 물리 검증 통과 |
| 기존 architecture / ventral-limited 회귀 | 9개 / 7개 통과 |
| 기존 shapes-joins 회귀 (1,460개 생성 포함) | 6개 통과 |
| 실제 Production UI / 저장·Import / 픽셀 재현 / 모바일 설명 영역 | 14개 검사, 오류 0 |
| `git diff --check` | 통과 |

전체 회귀 실행에서 발견한 Production 실패는 수정 후 매트릭스를 다시 통과했다. 기존 대규모 동기 생성 검사의 시간 초과는 입력·단언을 유지하면서 배치 간 이벤트 루프 양보와 제한시간 조정 후 재검사했다. 위 표는 각 검사의 완료된 실행 결과이며, 하나의 새 전체-suite 실행 결과로 합산하지 않는다. 마지막 감사 기록 변경 후 Production + Doctrine 28개를 재실행했다.

Blueprint 자원 원장 위조(무장 비용, 잔여량, 실제 수량, 설비 목표·비용), 실제 장착 그룹과 선택 후보의 불일치, XL 규격 축소 및 과거 Blueprint 호환성을 별도로 검사했다. Macro와 완성된 장갑을 유지하며 Foundation, 충돌, 사격 공간 및 원자적 대칭 그룹 검증을 계속 적용한다.

## 해석과 남은 한계

여섯 우선순위의 기대 방향 지표가 각각 3/3 Seed에서 관측됐다. 기동성 Seed 11과 항속성 Seed 11에서는 함포/미사일/PD/센서 수량이 동일하므로 수량 변화의 성공으로 판정하지 않았다. 기동성은 실제 무장 질량, 항속성은 실제 방열·정비 설비와 운용 예약의 변화로 확인했다.

Spinal Gun Ship의 XL 목표는 3개 Seed 중 2개에서 미달했다. 기존 축 구조물이 변경하지 않은 XL 외곽 규격을 수용하지 못해 생략했으며, 해당 함선을 XL 설치 성공으로 계산하지 않았다. 충분한 축 구조물의 양성 계약 검사에서는 실제 XL 수용을 확인했다.

질량·체적 배분은 명시된 계수의 설계 예약 모델이다. 내부 연료·장갑·기관을 전부 상세 형상으로 시뮬레이션하지 않는다. 외장 설비 고체 비용을 예약과 구분해 기록하며, 남은 면적이 새로운 무장의 충돌·사격 검증 통과를 보장하지 않는다. 구성 탐색은 제한된 폭의 beam search로 재계획·대체를 지원하며 전역 최적해를 보장하지 않는다.

[UI 검사 원자료](ui/report.json) · [데스크톱](ui/production-desktop.png) · [모바일 설계 설명](ui/doctrine-mobile.png)
