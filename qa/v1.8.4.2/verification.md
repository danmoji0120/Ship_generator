# V1.8.4.2 검증 및 출고 기록

[함종별 계약·구현 설명](../../docs/design-requirements-v1.8.4.2.md) · [통제 실험 및 민감도·성능 판정](assessment.md) · [222개 비교표](controlled-comparisons.md)

- 로컬 기준: `cc4476a`, `work`; 원격 origin/work와 일치. 미커밋 V1.8.4.1 구현을 기준으로 확장했다.
- V1.8.4.1 원자료 보존: [126개 재검사 대조](legacy-doctrine/preservation.json). 실행 시간 외의 전체 행 차이 0건. 기존 QA 파일은 원본으로 보존했다.
- 신규 통제 실험: 222개 테스트 통과, 200개 출고, 22개 명시적 거절, Mandatory 미달 출고 0건.
- 기존 XL 사례: Seed 7/11/23이 모두 실제 표준 XL 설치에 성공. MONOLITHIC과 SPINE_AND_MODULES 구조를 유지한 개선이다.
- 다양성: 4개 조선소, 3개 XL Architecture 및 호환된 WEAPON_DOMINANT/SPLIT_FRAME, 9개 함종, 40/100/200/300/500/600m 및 4개 질량 등급 검사.
- 여섯 Priority: 각 3개 Seed의 0/50/100 비교에서 실제 경쟁 배분 변화. Mobility의 노즐 면적 포화·감소도 기록했으며 추력 개선으로 판정하지 않는다.
- 실제 Production UI: 18개 검사, Console/Page 오류 0. 저장·재로드·JSON Import/Export·픽셀 재현·과거 Blueprint·실제 XL·작은 XL 주문 거절·390px 설명 영역 포함. [원자료](ui/report.json), [XL 화면](ui/required-xl.png), [모바일 거절](ui/rejected-order-mobile.png).
- TypeScript 및 Production 빌드 통과. 기존 큰 rendering chunk의 Vite 안내는 유지된다.

## 회귀 실행 해석

광범위한 회귀 실행은 17개 파일, 297개 테스트 중 295개가 통과했다. 124개 Production 매트릭스 및 기존 역사적 형태·장갑·접합·무장·렌더링 검사들이 포함된다. 두 실패는 기존 Architecture 대량 검사의 30초 시간 초과와 개발 중 추가한 계약 변조 단언이었다. 입력·단언·제한시간을 줄이지 않고 현재 소스로 해당 검사를 단독 재실행하고 신규 계약 전체를 다시 검사했다. 두 실패 항목의 단독 재검사 2개가 통과했고(Architecture 다양성 약 18초), 최종 소스의 신규 계약 전체 8개와 동일 입력 성능 검사 1개도 통과했다. 성능 수치는 assessment.md에 기록한다. 광범위한 실행을 새 전체-suite 무실패 실행으로 표현하지 않는다.

최초 통제 실험의 사전 표면 예산 오류(78개 테스트 실패)는 수정 후 같은 성공 기준으로 222개를 통과했다. initial-experiment-failures.json 및 initial-experiment.log.txt를 보존했다. 실패한 실험이나 명시적 주문 거절을 성공적인 설치로 합산하지 않는다.

## 자원 모델의 한계

질량은 기존 설계 추정 계수의 tonne-equivalent, 공간은 기하학적 설치/운용 예약, 에너지는 추상 설계 단위다. 실제 원자로·연료·탄약·추력·가속도·전투 피해·탐지 거리를 완성한 것으로 취급하지 않는다. 제한된 후보·beam 탐색이 모든 수용 가능한 주문을 찾아낸다는 보장은 없다. 작은 함종/체급 조합과 현재 지원하지 않는 축 구조 recipe는 명시적 거절 대상이다.

Commit SHA와 정상 Fast-forward Push 결과는 최종 완료 응답에 기록한다. 작업 시작 당시의 미커밋 V1.8.4.1 소스와 QA도 최종 작업물에 함께 보존한다.

[초기 광범위 회귀 로그](logs/regression-initial.txt) · [실패 항목 단독 재검사](logs/failed-checks-retested.txt) · [최종 계약·성능 검사](logs/final-contracts-performance.txt)

기존 V1.8.4.1 sensitivity.md의 한 줄 끝 공백도 원본 보존 대상이다. 신규 소스·보고서·로그의 공백 검사는 통과했다.
