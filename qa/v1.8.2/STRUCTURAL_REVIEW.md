# V1.8.2 — 한 척의 구조적 깊이 검토 (승인 전)

> 후속 상태: 사용자가 이 문서의 구조 방향을 승인했다. 아래 내용은 최초 제출 시점의 기록으로 보존한다. 연결부·기단·측면·후방 보완과 대표 세 Family 제한 검증의 최신 결과는 [LIMITED_STRUCTURAL_REFINEMENT.md](LIMITED_STRUCTURAL_REFINEMENT.md)에 기록했다. 기존 `review/` 이미지는 변경하지 않았다.

## 작업 범위

사용자의 최신 지시에 따라 네 Armor Language의 타일·색·배열 개선과 220척 확대를 중단했다. 이전 타일 기반 초안과 캡처는 실패 분석 자료로 보존한다. 이 문서는 출시 완료 보고서가 아니라 **대표 한 척의 구조 시안**이다. 다른 Language / Seed로 확대하지 않았으며 Git Commit / Push도 하지 않았다.

대표 조건: Aegis / Cruiser / MONOLITHIC / WEDGE_CITADEL / 300m / Seed 7. 원본은 `generateBlueprintV181` 결과다. StructuralVolume, Connector, Macro Plan/실측, 엔진, Integration 및 Prefab 원본은 그대로 보존한다.

## 패널이 없는 실제 대형 Geometry

선택적 `structuralArmorPilot`에 16개의 닫힌 faceted loft를 저장한다. Renderer는 저장된 정점/인덱스를 재현하며 RNG를 사용하지 않는다. QA 생성 함수는 위 대표 조건 외에는 거부한다.

- 선수 축 장갑: 원래 Deck 위 9m.
- 중앙 Citadel: 20m. 선수 장갑과 11m 높이차.
- 좌우 어깨: 구역별 11m / 16m / 9m. 큰 평면과 경사 벽을 가진 구조 체적이다.
- 상부 구조물 기단: Deck 위 28m, 그 위 별도 12m Plinth를 실제 접촉 면에 매립한다.
- 측면 Belt: 좌우 각각 3개의 큰 장갑 체적, 수직 높이 32m, 중앙 구역 최대 9m 측방 돌출.
- 정비 채널: 중앙 Citadel과 좌우 Shoulder 사이를 비워 원래 Hull을 낮은 바닥으로 사용한다. 원래 Hull을 Boolean으로 파냈다고 주장하지 않는다. **새 대형 장갑 Deck 사이의 열린 구조적 채널**이며 경사 벽/낮은 바닥/공간적 깊이를 실제 Geometry로 만든다. 중앙 검증 구간 z=-40…10m에서 폭 최소 16.045m, 바닥↔낮은 장갑 벽 상단 깊이 최소 12.045m. 선수/후방 끝은 장갑 높이가 낮아지는 전환부다.

타일 장갑(`layeredArmor`), surfaceFeatures, 모든 Line 객체 및 Hull의 procedural panel shader를 숨긴 중립 단색 렌더다. `structure-*` 이미지에서는 Hardpoint / Foundation도 숨겨 대형 구조 자체를 검토한다. 기존 엔진과 방열기는 남겨 공간 관계를 확인한다.

## Hardpoint / 접촉 / 개구부

기존 Hardpoint 31개를 모두 유지한다. 두 장착열을 중앙 대형 장갑 안쪽으로 옮기고 실제 삼각형 표면을 ray/plane 교차하여 8점 접촉 Foundation을 만든다. X는 조정되며 Z, 종류, 반경, 발사 법선은 보존한다. 원래 위치와 새 부모 장갑 ID는 Blueprint에 기록한다. 기존 작은 무장/기계 하우징은 ID로 supersede하여 중복 렌더링하지 않는다.

검사: 실제 Station Root 접촉, 장갑 Plinth 부모 접촉, 닫힌 edge manifold, nonzero triangles, positive signed volume, 유한 정점/단위 법선, Bounds, 장갑/장착점 참조, Reciprocal Cylinder Probes로 무장·센서·배기·방열 예약을 검사한다. 첨부 무장 사진의 실제 포/전투 기능은 구현하지 않았다.

## 발견 및 수정

1. 후방 측면 Belt가 기존 Radiator 예약 원통에 닿았다. 후방 Belt의 끝을 z=64→43m로 줄여 실제 방열 영역을 보존했다.
2. Loft의 비평면 측면을 단면 선형 보간으로 포함 판정하면 실제 삼각형 Surface Hit과 달라 Foundation 접촉을 잘못 판정했다. 실제 저장 삼각형의 ray parity로 검사를 변경했다.
3. 첫 Clay 렌더는 과다 조명으로 깊이가 잘 읽히지 않았다. 원본과 수정본에 **동일한** 중립 재질·조명을 적용했다. 조명으로 만든 가짜 단차는 없다.
4. 채널 깊이의 초기 상수를 실제 벽/바닥 삼각형 실측으로 교체했다.
5. 패널 없는 검토 데이터는 일반 장갑 완료 조건과 구분되는 `status: one-ship-review`를 가진다. 검증 예외는 해당 고정 한 척에만 허용한다.

## 검증 결과

- `npx vitest run tests/structural-armor-pilot.test.ts`: **10/10 PASS**. 원본 불변, 범위 제한, 큰 높이차, 열린 채널, Belt, Foundation, 손상 데이터 거부, 차폐 오류 검출, JSON/Geometry/Bounds, 과거 데이터 미적용을 검증했다.
- `npm run build`: TypeScript / Production Build PASS. 기존 Three.js 번들 크기 경고는 남는다.
- `node tests/structural-armor-pilot.mjs`: 같은 한 척 9개 캡처 (Before / 구조만 / Hardpoint 포함 × TOP / SIDE / ISOMETRIC), Console error 0, 동일 생성 JSON, 저장 JSON 재로딩 후 WebGL PNG 동일.
- 이 단계에서 전체 회귀/220척 QA를 재실행하지 않았다. 기존 보고서의 성공 수치를 새 구조 시안의 검증 결과로 사용하지 않는다.
- `qa/v1.8/`와 `qa/v1.8.1/`은 변경하지 않았다.

## 이미지

`structural-pilot/review/`:

- `panel-free-three-views.png`: TOP / SIDE / ISOMETRIC, 패널/패널라인/Hardpoint 없이 대형 구조만.
- `before-after-three-views.png`: 같은 기준 선체, 같은 360m Orthographic Frame / 같은 조명. Before도 패널을 숨겼다.
- `structure-TOP.png`, `structure-SIDE.png`, `structure-ISOMETRIC.png`: 개별 1000×1000 원본.
- `mounted-*.png`: 모든 기존 Hardpoint가 새 구조 면에 올라간 상태.
- `pilot.blueprint.json`, `report.json`: 재현 데이터 및 검사 결과.

`iteration-01/`, `iteration-02/`는 수정 전후 증거로 보존한다.

## 알려진 한계 / 승인 기준

광폭·둔중한 기존 Macro를 의도적으로 유지했으므로 레퍼런스의 길고 날카로운 선수를 그대로 재현한 결과는 아니다. 대형 장갑의 가장자리·연결부는 아직 단순하며, 공업적 채널 내부 설비나 실제 함교 에셋은 추가하지 않았다. 채널 바닥은 원래 Hull이며 내부 구획을 파낸 것은 아니다. 충돌 검사는 보수적인 샘플/원통 검사이며 모든 Triangle-Triangle 교차를 완전히 증명하지 않는다. 질량·방호·전투 계산은 하지 않는다. 다른 체급/Architecture/Language로 일반화하지 않았고 모바일 성능도 측정하지 않았다.

승인받기 전에는 다른 Armor Language나 220척으로 확장하지 않는다. 이 시안의 높이차·열린 채널·측면 Belt·기단이 충분한지 TOP / SIDE / ISOMETRIC 이미지를 먼저 검토받는다.
