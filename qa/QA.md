# Procedural Shipyard V1.5 QA

## 환경 / 최종 결과

Node.js 24, TypeScript strict, Vite 7, Vitest 3, headless Chromium/WebGL SwiftShader. 개발 서버의 실제 입력, 생성, WebGL 캔버스, 카메라, JSON 다운로드와 `/qa.html`을 사용했습니다.

- **27 automated tests PASS**: 기존 V0 12개, V1 9개 그대로 유지 + V1.5 6개.
- V0 1,296개 + V1/V1.5 1,296개 주문 조합 회귀.
- V1.5 고정 문법: **4 yards × 8 grammars × 20 seeds = 640**개. 모든 구조 연결, Shape cache 일치, parent/reference, 계층, Spine slenderness, support 비율 정상.
- 11 Shape × 3 scale × 3 parameter variant: 99개 geometry의 finite position/normal, 양수 체적 및 직렬화 확인.
- 10 Join의 실제 geometry/endpoint/직렬화 확인. 실제 생성에서도 11 Shape, 10 Join 모두 사용됨을 확인(BOX는 추가 low-missile supply orders에서 확인).
- **브라우저 Contact Sheet 220척** + Shape 11개/Join 10개 Gallery. Console error **0**, 각 그룹 thumbnail 픽셀 20개 모두 다름.
- **브라우저 UI 회귀 50척**: Console error **0**, geometry finite, 7 Debug View, Orbit/Zoom/Fit/TOP/AFT, Inspector, Seed input/Random/New Design, JSON 다운로드 정상.
- Same Seed 10회: **Blueprint JSON + 실제 WebGL 픽셀 완전 일치**.
- 390px 모바일 가로 넘침 없음. Normal에서는 debug arrow/marker가 없고 낮은 mount foundation만 표시됨.
- `npm run build`: TypeScript error **0**, 두 HTML entry production 빌드 성공.
- 회귀 렌더 범위 **4,224–9,860 triangles**, **108–374 draw calls**. Three.js shared bundle의 500 kB advisory 경고는 남으며 TypeScript/Console 오류가 아닙니다.

## Architecture별 20 Seeds / Contact Sheet

동일 Forge Cruiser, 문법 강제 고정 QA 경로로 8개 Architecture 각각 0–19를 렌더했습니다. 집중 요구 6개 문법도 모두 포함합니다. Shipyard 비교는 동일 Cruiser / BLOCK_ASSEMBLY / Seed 0–19를 네 Shipyard에서 렌더했습니다. Neutral silhouette 모드에서는 색·Hardpoint·surface detail을 제거하고 구조를 직접 비교했습니다.

| Yard | Grammar | Seed range | Compositions | Feature signatures | Unique thumbnails |
| --- | --- | --- | --- | --- | --- |
| forge | MONOLITHIC | 0–19 | 3 | 18 | 20 |
| forge | BLOCK_ASSEMBLY | 0–19 | 5 | 20 | 20 |
| forge | SPINE_AND_MODULES | 0–19 | 3 | 20 | 20 |
| forge | TRUSS_POD | 0–19 | 3 | 20 | 20 |
| forge | TWIN_HULL | 0–19 | 5 | 19 | 20 |
| forge | CORE_AND_NACELLES | 0–19 | 3 | 20 | 20 |
| forge | STACKED_BLOCKS | 0–19 | 3 | 20 | 20 |
| forge | HYBRID | 0–19 | 3 | 20 | 20 |
| aegis | BLOCK_ASSEMBLY | 0–19 | 5 | 20 | 20 |
| vesper | BLOCK_ASSEMBLY | 0–19 | 5 | 20 | 20 |
| serein | BLOCK_ASSEMBLY | 0–19 | 6 | 20 | 20 |

모든 그룹이 Composition 2개 / signature 12개 최소치를 넘었으며 warning 없음. Blueprint signature는 quantized 질량·전후 비율·폭/높이·점유율·Shape/Join/엔진/선수 정보입니다. 픽셀 차이나 signature 수 자체를 미적 품질로 간주하지 않았고 screenshot을 직접 검토했습니다.

- [Block / 20 Seeds](v1.5/contact-forge-BLOCK_ASSEMBLY.png): 중앙/전방/후방 질량, 측면 Battery, 서로 다른 접합과 장갑 Shape.
- [Twin / 20 Seeds](v1.5/contact-forge-TWIN_HULL.png): 중앙 장거리 무장축, 짧은 compound 측면 Hull, 전방/후방 bridge, staggered hull.
- [Stack / 20 Seeds](v1.5/contact-forge-STACKED_BLOCKS.png): 후방 성채 / 전방 성채 / 낮은 긴 terraces, 작아지는 상부 구획과 실제 매립.
- [Truss / 20 Seeds](v1.5/contact-forge-TRUSS_POD.png): 긴 Battery outriggers / 큰 후방 machinery / 높이와 전후가 다른 Pods.
- [Spine / 20 Seeds](v1.5/contact-forge-SPINE_AND_MODULES.png), [Hybrid / 20 Seeds](v1.5/contact-forge-HYBRID.png): 강화된 축 단면, 전방 collar node, breech/citadel/reactor mass 분화. Hybrid 두 문법 제한 유지.
- [Monolithic](v1.5/contact-forge-MONOLITHIC.png), [Core / Nacelles](v1.5/contact-forge-CORE_AND_NACELLES.png).
- [Shape Gallery / 11](v1.5/gallery-shapes.png), [Join Gallery / 10](v1.5/gallery-joins.png).
- [전체 수치](v1.5/gallery-report.json), [UI 회귀 수치](v1.5/regression/report.json).

## 조선소 차이 / 대표 결과

- Aegis: 큰 둔한 장갑 질량, chamfer/flattened blocks, 두꺼운 collar/overlap.
- Vesper: 좁은 profile, taper와 긴 추진 전환부, structural neck/nacelle mount.
- Forge: clipped/hex/casing, 노출 support와 기능 모듈의 구분.
- Serein: 낮은 flattened/compound 표면과 recessed/transition으로 경계를 정돈.

중립색 Block 비교: [Aegis](v1.5/contact-aegis-BLOCK_ASSEMBLY.png), [Vesper](v1.5/contact-vesper-BLOCK_ASSEMBLY.png), [Forge](v1.5/contact-forge-BLOCK_ASSEMBLY.png), [Serein](v1.5/contact-serein-BLOCK_ASSEMBLY.png).

대표 실제 Normal View: Heavy Naval Battleship, High Mobility Destroyer, Industrial Missile Ship, Advanced Spinal Gun Ship 각각 42/2718/742091. [4개 대표 비교](v1.5/representatives.png). 기존 V1 screenshot과 함께 검토했으며 Volume의 waist/shoulder/terminal shape와 mass distribution, 접합이 달라졌습니다.

## 발견 → 수정 → 재검증

1. 첫 Twin sheet가 여전히 평행한 두 긴 bar처럼 보임 → composition별 상대 길이/폭/offset 확대, 중앙 무장축 주변 짧은 compound Hull, 전방·후방 bridge와 staggered layout으로 재분화.
2. 첫 Stack sheet의 층 경계가 Lego처럼 강함 → upper mass를 축소하고 30–43% 실제 매립, 전방/후방/낮은 terrace의 높이·길이 비율을 크게 분화. 아래 keel은 compound armored envelope로 통합.
3. Truss의 seed 변화가 동일 pod 위치의 미세 변화에 머묾 → 외부 Battery / aft machinery / 높은 staggered pod로 주요 질량 자체를 이동. volume×distance load와 최소 단면 비율을 적용.
4. 강화 Spine의 collar가 breech module을 침범하는 후보 발생 → 가장 전방 breech의 실제 bounds 앞에 reinforcement를 배치. 고정 문법 640개 + 기존 회귀 재검증.
5. 측면 battery recess가 이웃한 fore block을 침범 → core의 longitudinal envelope 안에 완전히 들어가는 battery만 inset 허용. 연결 없는 overlap은 계속 거부.
6. 서로 다른 단면 Profile 사이에서 표면 조회가 loft mesh와 달라질 가능성 → query Station ring을 양쪽 실제 ring에서 선형 보간. 기존 독립 Three.js raycast 회귀 통과.
7. Gallery favicon 404 → 기존 favicon 재사용. 최종 Gallery와 UI regression Console 모두 0.
8. Hardpoint debug legend가 너무 길어질 수 있음 → 높이 제한/스크롤과 타입·크기·부모 정보를 표시. Normal에는 marker/arrow를 숨기고 barbette 높이 축소.

## 결정성과 이전 기록

schemaVersion 2 유지, generatorVersion 1.5. V1의 8개 grammar Seed fixture와 문법별 3개 Seed가 그대로 통과했습니다. Architecture 선택 RNG와 V0 생성기는 보존했습니다. Shape/Join 추가로 **V1과 V1.5의 전체 Blueprint/geometry는 의도적으로 다릅니다**. 같은 V1.5 Order/Yard/Seed는 모든 Shape/Join/Composition/JSON이 동일합니다. 이전 V1 JSON은 optional Shape/Join fallback 경로로 계속 렌더링됩니다.

[V0 기록](v0/QA.md), [V1 기록](v1/QA.md), 기존 screenshot/report를 삭제하거나 덮어쓰지 않았습니다. 이번 출력은 `qa/v1.5/`에 분리했습니다.

## 남은 한계

- 축 정렬, 낮은 폴리곤 수, 근사 체적/convex projected occupancy, AABB overlap 휴리스틱입니다. 정확한 CSG, arbitrary collision, 실제 load/armor/damage 계산은 없습니다.
- 같은 Composition 안 일부 seed는 닮을 수 있습니다. 변화는 29개 제한적 패턴의 설계 파라미터에 기반하며 무한한 자유 모델링을 제공하지 않습니다.
- Hybrid는 V1의 Spine + Truss Pod 조합을 유지합니다. 임의의 두 문법 조합은 추가하지 않았습니다.
- Gallery는 한 WebGL context를 재사용하지만 software WebGL에서 20개의 thumbnail은 순차 렌더됩니다. 실사용 한 척 생성과 다른 성능 작업입니다.
- 전체 그림자/Boolean union 없이 접합 여유와 매립을 사용하며, 모든 rail의 exact contact/모든 mount foundation의 footprint collision을 증명하는 solver는 없습니다.

## 재실행

```bash
npm install
npm run dev
# 별도 터미널
npm test
npm run build
npm run qa
npm run qa:gallery
```

`CHROMIUM_PATH`, `QA_URL`, `QA_OUTPUT`, `GALLERY_OUTPUT`로 브라우저/서버/출력 위치를 지정할 수 있습니다. 앱 `/qa.html`에서 Seed start와 Count로 Contact Sheet를 재현합니다. V1.5 screenshot은 렌더 결과이며 권위 설계 데이터는 JSON/Shape/Join입니다.
