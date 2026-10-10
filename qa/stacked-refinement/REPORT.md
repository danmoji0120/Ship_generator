# STACKED_BLOCKS — 선택적 QA 결과

기준 HEAD: `b16a0c6`. 생성 알고리즘 수정 전 확보한 Blueprint를 Before로 보존했다. 원본 Reference A/B/C 이미지·Seed가 없어 아래 로컬 주문서를 고정했다.

4개 조선소 × Seed 4/7/11 = 통제 주문서 12개. 120m Frigate/Standard/HAMMERHEAD, 300m Cruiser/Standard/WEDGE_CITADEL, 500m Frigate/Heavy/HAMMERHEAD. 추가 300m Cruiser/Standard 표본 Seed 12–20 = 9개. **총 12개 서로 다른 Seed, 현재 설계 21개**이며 모두 유효성·JSON 결정성 통과. 무장/장갑/엔진 접촉 및 clearance 검증 기준은 유지했다.

|조선소–Seed|길이|중층/주 선체 체적 Before → After|전체 union 중심 Before → After|상부 중심 After|정면 occupancy Before → After|
|---|---:|---:|---:|---:|---:|
|aegis-11|500|0.587 → 0.362|0.360 → 0.478|0.473|0.699 → 0.699|
|aegis-4|120|0.578 → 0.347|0.360 → 0.464|0.420|0.691 → 0.684|
|aegis-7|300|0.626 → 0.316|0.478 → 0.549|0.591|0.704 → 0.699|
|forge-11|500|0.526 → 0.347|0.365 → 0.478|0.473|0.699 → 0.730|
|forge-4|120|0.518 → 0.315|0.365 → 0.465|0.420|0.691 → 0.727|
|forge-7|300|0.561 → 0.303|0.485 → 0.547|0.591|0.704 → 0.737|
|serein-11|500|0.436 → 0.342|0.364 → 0.477|0.473|0.676 → 0.684|
|serein-4|120|0.441 → 0.310|0.364 → 0.465|0.420|0.671 → 0.681|
|serein-7|300|0.462 → 0.299|0.483 → 0.547|0.591|0.684 → 0.699|
|vesper-11|500|0.587 → 0.311|0.360 → 0.478|0.473|0.699 → 0.663|
|vesper-4|120|0.578 → 0.282|0.360 → 0.466|0.420|0.691 → 0.668|
|vesper-7|300|0.626 → 0.272|0.478 → 0.546|0.591|0.704 → 0.673|

체적 비율은 기존 정확한 개별 station 적분값이다. 전체 중심은 중복을 제거한 union 적분값이며 선수=0/선미=1. 전체 중심 모두 0.45–0.60 범위에 있다. HAMMERHEAD의 일부 상부 중심은 예시 목표 0.48보다 전방에 남는다. 기존 선수 볼륨 기준과 전방 어깨 정체성을 유지하기 위한 제한이다.

정면 occupancy는 6/12개에서 증가했다. 이를 개선이라고 주장하지 않는다. 축소된 상부 높이와 폭 대비 외곽 bounding rectangle 변화가 영향을 주며, 실제 단면의 경사와 전후 축소는 이미지에서 별도로 확인했다. frontCapToMaximumSection은 끝 단면 대비 최대 station 면적의 대리 지표이고, 가려짐을 계산한 최대 노출 평면 면적은 아직 측정하지 않는다. 실제 물리 질량 중심은 null이다.

## 검증 범위

- 신규 구조 테스트 4개: 크기/비율/실제 정면 경사 Geometry/union 중심, 접합·연결·결정성, 겹침 제거 및 해상도 오차, 다른 Architecture 대표 2개 및 frozen Macro 경로 보존.
- 신규 Production 테스트 1개: Forge/Seed7/300m 대표를 Node에서 실제 생성하고 기존 Validation, 장갑·엔진·하드포인트 계약 검사. 통제 12개 및 추가 9개의 실제 브라우저 Validation은 개별 checks.json에 별도로 기록.
- 기존 Macro 테스트 1개만 선택: 정확한 clipped rectangle 체적 적분. 기존 파일의 나머지 8개는 skip.
- **총 6개 선택 테스트 통과**, TypeScript 타입 검사 통과, Production Build 통과. 기존 500KB chunk 경고는 남아 있다.
- Chromium + SwiftShader: 모든 표본의 정면/측면/상면/사선, seed7의 완성 외장도 확인. 저장 Before 12개 JSON 왕복 후 한 시점 픽셀 일치. Console 오류 0. 이 확인은 기존 모든 역사 Blueprint 회귀를 의미하지 않는다.
- 전체 600개 이상 테스트 스위트, 전투 테스트, 전체 Production UI 테스트, 전체 Architecture 조합, 장시간 스트레스 검증은 실행하지 않았다.

## 실패한 시도와 실행 제한

첫 시도에서 HAMMERHEAD 8개가 기존 foreMassRatio 조건을 위반했다. WEDGE 일부도 정면 지표가 악화됐다(`first-attempt.json`). 두 번째 시도에서는 Vesper/Serein의 육각 cap이 퇴화 삼각형으로 거절됐다(`second-attempt.log`). strict convex chamfer 단면으로 수정했고 장갑/매크로 검증을 약화하지 않았다. 포맷 정리로 Vite 새로고침이 QA를 한 번 중단해 완료된 7개를 유지하고 나머지 5개만 재실행했다.

사전 탐색의 120m Cruiser 및 500m Battleship 주문서는 수정 전에도 REQUIRED_ROLE_CAPABILITY_UNAVAILABLE로 거절됐다. 이를 정상 출고로 바꾸거나 테스트 기준을 완화하지 않았다. 통제 비교에는 원래 출고 가능한 위 Frigate/Cruiser 주문서를 사용했다. 다른 Architecture는 공통 알고리즘을 수정하지 않았고 MONOLITHIC/BLOCK_ASSEMBLY 대표 Macro 비교만 수행했다.

브라우저 snapshot을 Node에서 그대로 검증한 첫 테스트는 기존 문자열 완전일치 검사에 실패했다. 120m 스케일의 Math.cbrt 계산에서 극미한 런타임 차이가 발생한다(기존 Before S footprint width 3.3156283487763476, Node 계산 3.315628348776348). 규격 및 priority evidence 문자열 비교에 영향을 준다. 검사를 완화하거나 Blueprint를 재작성하지 않았다. 직접 영향받은 대표 주문서를 Node에서 생성·검증하는 테스트로 변경했으며 통과했다. 전체 무장 표준/직렬화 시스템의 교차 런타임 수치 비교 개선은 이번 범위 밖의 기존 한계로 남긴다. 실패 로그: `selected-tests-first.log`.

## 성능

Chromium에서 동일 Forge 주문서의 12회 Macro 생성 측정: 기존 median **0.10ms**, 변경 후 **6.75ms**. 다섯 위치 후보의 24×16 union 적분 때문에 약 6.65ms가 추가된다. 이는 Macro 단계만의 소규모 측정이고 전체 Production 생성 시간/스트레스 결과로 일반화하지 않는다. 원시값: `macro-timing.json`.

## 이미지와 파일

- `aegis-4-comparison.jpg`, `aegis-7-comparison.jpg`: 동일 주문서 정면·측면·사선 Before/After.
- `forge-7-complete-comparison.jpg`, `serein-7-complete-comparison.jpg`: 실제 장갑·설비 포함 비교.
- `controlled-FRONT/LEFT/ISOMETRIC.jpg`, `sample-FRONT/ISOMETRIC.jpg`: 전체 제한 표본 contact sheet.
- `before/`, `after/`, `sample/`: JSON 원본, 개별 PNG, 검사 결과. `comparison.csv`: 수치 비교.
- 수정 소스: `generate.ts`, `macro/plan.ts`, 신규 `macro/stacked.ts`, `macro/stacked-measurement.ts`. 신규 테스트/QA 3개와 `docs/STACKED_BLOCKS_REFINEMENT.md`. Blueprint schema, 저장 렌더러, 무장/장갑/엔진 표준, combat-demo는 변경하지 않았다.
