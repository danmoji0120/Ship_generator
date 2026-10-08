# Seed 7 — 하부 전용 구조 보강

## 범위

이전 승인된 Aegis / Cruiser / MONOLITHIC / WEDGE_CITADEL / 300m / Seed 7 저장 Blueprint (`structural-pilot/refinement-02/pilot.blueprint.json`) 한 척만 입력으로 사용한다. 기존 로컬 초안, 상부 검토 자료, Before 이미지와 저장 JSON은 덮어쓰지 않았다. 다른 Family, Seed, Shipyard 및 220척 확장은 수행하지 않았다.

## 새 하부 구조

`buildVentralArmorReview`는 기존 `structuralArmorPilot`에 **7개의 대형 닫힌 체적**과 선택적 `ventral` 계획/실측 데이터를 추가한다. 원래 StructuralVolume/Macro/Connector/질량, 상부 22개 구조, Hardpoint/Foundation/엔진/기존 Prefab은 변경하지 않는다. Renderer는 저장된 Geometry를 재현할 뿐 새 장식을 생성하지 않는다.

- **Ventral Keel:** z=-136…130m, 실제 종방향 길이 266m. 중앙 하부를 따라 이어지고 전방에서 두꺼워졌다가 후방 Cradle로 낮아지는 무거운 중심 구조다. 가장 깊은 구간은 원래 Hull 표면에서 23m 바깥으로 내려간다.
- **전방 보호 Pan:** 넓고 낮은 경사 보호부, 대표 실측 7m.
- **복부 Casemate:** 넓은 보호 구획, 대표 실측 12m. 우현 일부만 정비 포켓의 앞/뒤 보호 블록으로 나눈다. 상부 Shoulder/함교 배열을 반전하거나 복제하지 않았다.
- **후방 Drive Cradle:** 추진 구역 아래의 넓고 두꺼운 지지/보호 Housing, 대표 실측 16m. 노즐 자체나 배기 방향을 변경하지 않는다.
- **정비 포켓:** 약 46m 폭 × 38m 길이의 국소 외장 Recess. 앞/뒤 보호 블록의 실제 하부 삼각형과 기존 Hull 안쪽 벽 사이 깊이 약 12m. 외곽의 낮은 Sill과 중심 Keel이 경계를 만든다. 내부 Hull을 Boolean으로 파내거나 실제 내부 무장 격납고를 구현한 것은 아니다. 원래 Hull을 그대로 두고 새 외장 보호 구조 사이에 공간을 확보했다.

이는 작은 패널·핀·Greeble 추가가 아니다. 전방/복부/후방 보호 구조와 중심축이 서로 다른 깊이와 큰 경사면을 가지며 SIDE 외곽선이 달라진다. 외부 돌출량은 논리적인 보호 등급이나 물리적 장갑 강도와 구분한다.

## 실제 부착 및 검증

Hull의 실제 Station Ring에서 각 X/Z의 **최저 외부 표면**을 추출한다. 대형 구조의 Root는 그 표면에 0.9m 매립된다. Root의 넓은 접촉 샘플은 실제 부모 Hull 포함 여부로 검증하며 AABB 부착 판정을 사용하지 않는다.

각 보호부는 폭 변화, 깊이 변화, 평면 Chamfer를 가진 CCW 단면으로 닫힌 Loft를 구성한다. 상부 마운트 전용 `verticalHit`가 음의 Y 법선을 거부하여 첫 하부 측정이 실패했다. 과거 장착면 규칙을 변경하지 않고 독립적인 하부 삼각형 교차 `undersideHit`로 수정했다.

검사: ID/부모 참조, 실제 Root 접촉, 닫힌 edge manifold, 정상 signed volume, nonzero Triangle, 유한 Geometry/단위 Normal, 원래 무장·센서·방열·배기 예약, 외장 Bounds, 실제 하부 높이차, 정비 포켓의 열린 공간, 원본/상부/Mount 불변, JSON/저장본 WebGL 결정성. Bounds는 새 하부까지 확장하며 Auto Fit은 실제 전체 Geometry를 포함한다.

## 렌더 증거

`structural-pilot/ventral/final-review/`에는 Before / 구조만 / Mount 포함 × **BOTTOM / LOW-ISOMETRIC / SIDE**, 총 9개 실제 Chromium/SwiftShader WebGL 캡처와 `blueprint.json`, `report.json`이 있다.

Before/After는 같은 1200px 해상도, 360m Orthographic Frame, 월드 중심, Neutral Material 및 하부 확인용 조명을 사용한다. 구조 비교에서는 장갑 패널, 모든 Line, procedural panel shader, Hardpoint와 Foundation을 숨긴다. 기존 엔진·방열기는 남긴다. 조명이나 카메라를 한쪽에만 바꿔 개선을 표현하지 않는다.

- [하부 3방향](structural-pilot/ventral/final-review/three-views.png)
- [Before / After 3방향](structural-pilot/ventral/final-review/before-after.png)
- [BOTTOM 원본](structural-pilot/ventral/final-review/structure-BOTTOM.png)
- [LOW-ISOMETRIC 원본](structural-pilot/ventral/final-review/structure-LOW-ISOMETRIC.png)
- [SIDE 원본](structural-pilot/ventral/final-review/structure-SIDE.png)

육안 확인: BOTTOM에서는 종방향 중심축, 큰 보호 구획, 우현의 국소 포켓이 구분된다. LOW-ISOMETRIC에서 복부 블록과 Keel의 서로 다른 깊이 및 넓은 경사면이 보인다. SIDE의 기존 평평한 하단 외곽선이 전방 보호부 → 깊은 중심 Keel → 후방 Cradle로 바뀐다. 일부 바깥쪽 하부 Hull 면은 여전히 단순하며 전체 하부를 작은 장식으로 덮지 않았다.

## 결과

- 하부 전용 테스트 **7/7 PASS**: 원본 불변, 한 척 범위/중복 적용 거부, 실제 깊이, 열린 포켓, 손상 데이터와 장비 차폐 검출, JSON/Geometry/Bounds, 과거 저장본 소급 미적용.
- 기존 Seed 7 구조 회귀 **10/10 PASS**. 합계 관련 **17개 테스트 PASS**이며 전체 회귀 실행을 의미하지 않는다.
- `npm run build`: TypeScript 및 Production Build 성공. 기존 Three.js chunk 크기 경고는 남는다.
- 최종 9개 캡처: Console error **0**, source/upper/mount 데이터 불변, JSON 결정성, 저장 JSON 재렌더 픽셀 동일.
- 이번 커밋 대상 파일만 별도 경로로 Export해 Build와 하부 7개 테스트를 다시 확인했다. 별도 dev 포트의 실제 렌더에서 작업본과 Blueprint JSON 및 9개 PNG가 byte-for-byte 동일했다 (`final-review/commit-verification.json`). 이전 타일 초안에 의존하지 않는 제한 시안이다.
- 동일 SIDE 구조 비교: Calls **58 → 65**, Triangles **2,788 → 3,468**. 대형 체적 7개에 대한 증가다. Mount 포함은 205 Calls / 9,180 Triangles. 일반 생성 성능이나 모바일 GPU 성능으로 일반화하지 않는다.

```bash
npx vitest run tests/ventral-structure.test.ts tests/structural-armor-pilot.test.ts
npm run build
# dev 서버 실행 후, 기존 증거를 보호하는 새 폴더로 캡처
VENTRAL_OUTPUT=qa/v1.8.2/structural-pilot/ventral/local-review node tests/ventral-structure-qa.mjs
```

## 한계

고정된 한 척의 축 정렬 구조 시안이다. 추가 외장 체적에 대한 물리적 강도·질량·방호 계산은 하지 않는다. 정비 포켓은 기존 Hull 바깥의 열린 보호 공간이며 내부 구획이 아니다. 기존 삼각형 접촉/상호 원통 샘플 충돌 검사는 완전한 모든 Triangle 교차나 CSG 검사가 아니다. 자유 회전 Hull, 실제 무기 Bay, 다른 체급·조선소로의 일반화는 검증하지 않았다.


후속 승인 범위의 흐름 정리와 세 Family 제한 검증은 [VENTRAL_FLOW_REFINEMENT.md](VENTRAL_FLOW_REFINEMENT.md)를 참조합니다. 이 문서와 기존 이미지/JSON은 초기 하부 승인 상태를 보존합니다.
