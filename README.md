# Procedural Shipyard V1.8.5.3 — Structural Visual Hierarchy & Meso Geometry

일반 주문서의 기본 생성기는 **V1.8.5.3**입니다. 무장과 기존 외장 Kit 이후에 실제 표면에 부착되는 Meso 구조를 생성하고, 최종 노출 면의 질감·마킹을 계획합니다. V1.8.4.2 Requirements-first 출고 설계를 그대로 완성한 뒤 기능 구역별 외장 디테일을 추가합니다. V1.8.4.1 Design Doctrine 위에 선체 이전 필수 요구사항 계획·공간 예약·최종 출고 계약을 적용합니다. 주문서·조선소·Seed에서 새 Hull을 만든 뒤, 대형 상부 장갑층·측면 Belt·Ventral Keel, 선택적인 함교·추진 보호·정비 설비, 실제 장갑 표면의 상하좌우 무장을 생성합니다. 저장된 Seed 7이나 검토용 Blueprint를 읽지 않습니다. 과거 저장 설계는 생성 규칙을 소급 적용하지 않고 원래 Geometry를 재생합니다.

```bash
npm install
npm run dev
npm test
npm run build
```

## V1.8.5.2 표면 질감과 함선 마킹

- 기존 5개 재질 계층에 미터 단위의 도장 입자·금속 브러싱·Albedo/Roughness/미세 Normal 변화를 추가합니다. 공유 128² 타일과 Object-local Triplanar 좌표를 사용하며 이동·회전에 따라 질감이 미끄러지지 않습니다.
- 실제 외장 삼각형에서 넓은 함번, 장갑 구획 번호, 조선소 심볼, 정비 코드와 미사일 접근 경고를 선택합니다. 9개 노출 접촉점과 최종 설비 점유 범위를 검사하며, 지원되지 않는 표식만 생략합니다. 함번은 설계 식별 코드이며 전역 등록번호의 고유성을 보장하지 않습니다.
- 문자·심볼은 결정적으로 만드는 공유 아틀라스입니다. 추가 Decal 메시·깊은 가짜 홈·새 개구부가 없으며, 기존 형상·삼각형·Draw Call은 유지합니다. 장갑의 큰 톤 변화와 작은 마킹에 Mipmap·가독성 필터를 적용합니다.
- CLEAN이 저장 기본값입니다. Viewer의 Surface finish(CLEAN/SERVICE/WEATHERED), Surface Texture/Decal Markings Debug와 기존 OFF/LOW/HIGH/AUTO는 표시만 바꾸며 Blueprint JSON을 수정하지 않습니다. 별도 Bloom·동적 광원은 추가하지 않습니다.
- `materialAppearance.version: "1.8.5.2"`에 재구축 레시피·표면 참조·채택/생략 이유를 보존합니다. 이전 저장 Blueprint는 원래 셰이더로 재생하고 `{version:'1.8.5.1'}`로 기존 생성기를 실행할 수 있습니다.
- [Material/Texture 구조·Decal 명세·조선소 Profile·캐시·LOD·한계](docs/surface-texture-v1.8.5.2.md) · [실제 렌더·과거 픽셀·회귀·성능 QA](qa/v1.8.5.2/QA.md)

## V1.8.5.1 재질과 기능성 발광

- **5개 재질 계층:** Primary/Secondary Armor, Mechanical Structure, Recessed Interior, Functional Surface. 장갑·기계·함몰부의 명도, 거칠기와 금속성을 구분합니다.
- **21종 기존 Kit:** 해치 외곽선·상태등, 정비 유도 표식, 센서 셀, 함교 창과 경고/식별 마킹을 기존 메시 표면의 셰이더로 표현합니다. 추가 삼각형·Bloom·동적 광원은 없습니다.
- **4개 조선소:** Aegis 청백색 군용, Vesper 냉색 정밀, Forge 주황 산업형, Serein 은은한 민트/백색. 색상뿐 아니라 표면 거칠기·금속성과 대비도 다릅니다.
- **정본 보존:** `schemaVersion: 2`, `generatorVersion: "1.8.5.1"`, 선택적 `materialAppearance`. 새 표시 정보와 최상위 버전을 제외하면 V1.8.5의 전체 Hull·Armor·Weapon·Exterior Detail JSON과 같습니다. UI OFF/LOW/HIGH/AUTO는 표시만 바꿉니다.
- **과거 재생:** 새 필드가 없는 저장 Blueprint는 원래 재질·배칭으로 렌더링합니다. `{version: "1.8.5"}`로 이전 생성기도 호출할 수 있습니다. Import에서 외장을 소급 생성하지 않습니다.
- [설계·Kit 태깅·표시 규칙과 한계](docs/material-emissive-v1.8.5.1.md) · [실제 비교 이미지·회귀·성능 QA](qa/v1.8.5.1/QA.md)

## V1.8.5 기능성 외장 디테일

실제 함교·기관부·무장 기단·정비 채널·센서·장갑 접합부에서 설치 구역을 찾습니다. 21개 Parametric Kit가 점검 해치, EVA 접근 구조, 기관 프레임·루버·배관, 함포 기단 정비 구조, RCS 및 센서 스트립을 선택적으로 배치합니다. 표면 법선과 실제 접촉면을 사용하며 기존 장갑·무장·예약 구획은 변경하지 않습니다. 설치에 실패한 선택 부품만 사유와 함께 생략합니다.

- **실제 크기:** 사다리·해치의 물리적 크기는 40~600m 함선 길이에 비례 확대하지 않습니다. 기능 구역과 서비스 위치 수를 제한하고 큰 장갑면 일부를 비워 둡니다.
- **조선소:** Aegis의 견고한 프레임, Vesper의 낮고 긴 커버, Forge의 노출 정비 구조, Serein의 낮은 매립형 외장이 형태·비례·노출 규칙에서 구별됩니다.
- **표시:** Preview의 `Exterior detail` 선택기로 OFF / LOW / HIGH / AUTO를 전환합니다. 표시만 바뀌며 주문서와 정본 JSON은 바뀌지 않습니다. AUTO는 화면 크기에 따라 미세 부품을 숨깁니다.
- **저장:** `schemaVersion: 2`, `generatorVersion: "1.8.5"`, 선택적 `exteriorDetailPlan`. 과거 JSON은 새 부품을 생성하지 않고 그대로 재생합니다. Macro·장갑·무장과 독립된 디테일 Seed 스트림을 사용합니다.
- **기능 범위:** RCS·센서·배관은 시각/향후 전투 참조 데이터이며 실제 전투·추력·냉각 성능을 추가하지 않습니다.
- [전체 Kit·기능 구역·부착·LOD·제한](docs/exterior-details-v1.8.5.md)
- [실제 Before/After·확대·조선소/Family/체급·회귀/성능](qa/v1.8.5/QA.md)

`generateBlueprint(order, seed, {version:'1.8.4.2'})`는 기존 Requirements-first 생성 경로를 명시적으로 실행합니다. 기본 경로의 디테일 기록을 제거하고 생성 버전을 복원하면 같은 주문/Seed의 기존 전체 Blueprint와 일치합니다. 확대 시 서비스 구조가 읽히도록 설계했으며 전체 함선 시점의 개선은 절제되어 있습니다.

## V1.8.4.2 설계 요구사항 보장

함종의 최소 기능을 Mandatory로 정의하고, 필수 무장·구조 자원을 먼저 확보한 뒤 나머지 자원을 Target과 Optional 사이에 배분합니다. Spinal Gun Ship의 변경하지 않은 XL Envelope과 후방 공급/에너지 구획은 Macro stations 이전부터 확보합니다. 핵심 기능이 없는 함선은 출고하지 않고 구체적인 코드로 거절합니다.

- [함종별 계약·공간 예약·예산 단위·보존 설명](docs/design-requirements-v1.8.4.2.md)
- [기존 XL 실패 개선 / 여러 Seed 민감도 / 성능 판정](qa/v1.8.4.2/assessment.md)
- [222개 통제 비교표](qa/v1.8.4.2/controlled-comparisons.md)
- `npm run qa:requirements`로 신규 계약과 비교를 재현합니다. 기존 `qa:doctrine`은 V1.8.4.1 경로의 입력과 기준을 유지합니다.

## V1.8.4.1 설계 교리 / 무장 구성 재계획

9개 함종의 주무장·미사일·방어무장·대형 수용·배치 정책을 적용합니다. 질량 등급과 실제 구조물 체적/장갑 표면에서 유한 예산을 계산하고, 여섯 Priority가 추진·장갑·항속·센서·무장 공간을 함께 나눕니다. 표준 규격의 그룹 대체와 6상태 Beam Search로 구성을 재계획하며, `designDoctrine`에 목표/실제 차이와 생략·대체 이유를 저장합니다. UI Inspector에서 설계 의도를 펼쳐 볼 수 있습니다.

- [설계 모델·단위·제한·보존 계약](docs/design-doctrine-v1.8.4.1.md)
- [여러 Seed 경향 판정 / 수량 정체 및 XL 목표 미달](qa/v1.8.4.1/sensitivity.md)
- [A–E 통제 비교표 / 여러 Seed](qa/v1.8.4.1/controlled-comparisons.md)
- [Seed별 입력·설비·예산·배치·생략 원자료](qa/v1.8.4.1/controlled-comparisons.json)
- `npm run qa:doctrine`으로 126개 통제 설계를 다시 생성합니다. 자원 수치는 내부 예약 모델이며 실물 외장 고체 비용은 별도로 기록합니다.

## V1.8.4 Production 통합

`generateBlueprint(order, seed)` → 정규화/Architecture·Macro → 실제 StructuralVolume·Connector → 기능 개구부 예약 → 대형 장갑/복부 구조 → 남은 노출 면의 넓은 외장 Course → 기능 외장 → 무장 구성/그룹 후보 → 최종 장갑 접촉 Foundation → 전체 검증 → 직렬화.

각 단계는 `productionDesign.stages`에 입력·출력을 기록합니다. Hull과 Macro 실측은 원래 구조 데이터이고, 추가 외장 Bounds와 방호 면적은 별도로 저장합니다. 새 경로에서는 기존 타일 장갑, 검토용 `structuralArmorPilot`, 구형 무장 Foundation을 먼저 생성하지 않습니다. `schemaVersion: 2`, `generatorVersion: "1.8.4"`를 유지합니다.

- **구조:** 실제 Station 폭과 Deck 높이, 부모의 정규화된 길이 구간을 사용합니다. 전방 성채/연속 성채/후방 지휘 구획은 Seed와 Family에 따라 달라집니다. 상부 채널과 하부 보호 구획은 서로 다른 구조 언어입니다.
- **외장:** 대형 장갑을 먼저 생성하고, 보호되지 않은 실제 면에만 긴 경사 마감 Course와 기능 개구부를 피하는 Cap을 추가합니다. 방향별 면적은 실제 노출 삼각형과 내부 접합/개구부 제외 사유에서 계산합니다. 90%는 QA 목표이며 달성하지 못한 방향은 실제 잔여 면적과 사유를 기록합니다.
- **기능 설비:** 실제 Command Plinth, Engine/Nozzle, Service Channel을 찾습니다. 없는 구조에 설비를 강제 설치하지 않으며, 열린 배기 케이싱과 방열 공간이 확보되지 않으면 생략 사유를 저장합니다.
- **무장:** 역할·길이·화력/미사일 Priority·Family·조선소·장착 면적에 따른 예산을 먼저 정합니다. S/M/L/XL 규격은 V1.8.3 공통 계약을 공유하고, L 설치를 모든 함선에 강제하지 않습니다. XL은 기존 척추무장 계약과 별도 예산/개구부를 사용합니다. 좌우 쌍은 함께 설치·재탐색·생략합니다. 장갑은 삭제하지 않습니다.
- **안전/성능:** 삼각형 BVH와 불변 Surface 캐시, 충돌 Broad Phase를 사용합니다. 17점 장착 접촉, 장비 OBB/실제 체적 샘플, 양쪽 무장의 국소 정적 사격 공간 검사는 Production에서도 실행합니다. 후보는 최대 3회이며 실패와 선택 부품 생략은 Blueprint에 구분해 남습니다.

### 지원 조합

| Architecture | Macro Family |
|---|---|
| MONOLITHIC | WEDGE_CITADEL, WEAPON_DOMINANT |
| BLOCK_ASSEMBLY | WEDGE_CITADEL, HAMMERHEAD, WIDE_CARRIER, ENGINE_DOMINANT |
| SPINE_AND_MODULES | SPLIT_FRAME, WEAPON_DOMINANT |
| TRUSS_POD | SPLIT_FRAME |
| TWIN_HULL | WIDE_CARRIER, ENGINE_DOMINANT |
| CORE_AND_NACELLES | ENGINE_DOMINANT |
| STACKED_BLOCKS | WEDGE_CITADEL, HAMMERHEAD |
| HYBRID | SPLIT_FRAME, WEAPON_DOMINANT, WIDE_CARRIER |

지원 조합의 권위 데이터는 `generation/macro/plan.ts`입니다. 4개 Shipyard와 기존 40–600m 주문 범위를 지원합니다. 실제 면이 작거나 개구부가 있으면 그룹이 생략될 수 있습니다. 무장 방향별 동일 수량, 모든 함선의 L 무장, 모든 면의 100% 피복은 보장하지 않습니다.

### 사용 / 저장 / 개발 비교

주문서 Generate·Seed 변경·Regenerate가 통합 경로를 호출합니다. JSON Export / Import / Reload는 저장된 데이터 그대로 재현하며 재생성하지 않습니다. Orbit / Zoom / Fit은 실제 전체 메시 Bounds를 사용합니다. `Structural Armor Only`, `Armor Coverage`, `Functional Exterior Only`, `Hardpoint Layout Only`, `Mount Size`, `Symmetry Groups`, `Firing Arc`를 기존 Debug View에서 확인할 수 있습니다.

`/qa.html`의 Generator version으로 V1.8.4와 V1.8.1/1.8/1.7/1.6을 비교할 수 있습니다. V1.8.2/1.8.3은 원래 제한 검토용 Builder와 보존된 JSON으로 비교합니다. 아래 역사적 검토 절의 승인 범위는 당시 결과이며 **현재 기본 생성기의 제한을 의미하지 않습니다**.

```bash
npm test
npm run build
# 개발 서버 실행 후; 기존 QA 출력 폴더를 덮어쓰지 않도록 OUT을 지정
QA_URL=http://localhost:5173 OUT=qa/v1.8.4/local-phase-b node tests/production-series.mjs
QA_URL=http://localhost:5173 PHASE=c OUT=qa/v1.8.4/local-phase-c node tests/production-series.mjs
QA_URL=http://localhost:5173 OUT=qa/v1.8.4/local-regression node tests/production-regression.mjs
# Production preview 실행 후 실제 UI / JSON / 픽셀 회귀
PRODUCTION_URL=http://localhost:4173 OUT=qa/v1.8.4/local-ui node tests/unified-ui-qa.mjs
```

[실제 대표 렌더, 220척 Contact Sheet, 회귀 및 성능](qa/v1.8.4/QA.md). 과거 QA 자료와 미커밋 타일 실험은 삭제하지 않습니다. 자유 회전 Hull, Boolean CSG, 연속 조준/탄도·전투·피해·내부 구획은 구현하지 않습니다. 간섭 검증은 샘플과 Bounding Volume을 결합한 정적 검사이며 모든 Triangle 교차를 증명하지 않습니다. 모바일 화면 레이아웃 확인과 실제 모바일 GPU 성능은 구분합니다.

## V1.8.2 구조 방향 승인 / 대표 세 Family 제한 검증

네 Armor Language의 타일 기반 개선은 보류했습니다. 승인된 Seed 7 구조 방향을 다듬고 **WEDGE_CITADEL / MONOLITHIC, HAMMERHEAD / BLOCK_ASSEMBLY, ENGINE_DOMINANT / CORE_AND_NACELLES** 세 대표 설계에만 제한 적용했습니다. 모두 Aegis / Cruiser / 300m / Seed 7이며, 패널·패널라인·Hardpoint를 숨겨도 대형 장갑층, 열린 정비 채널, 측면 Belt 및 기단이 남습니다. 다른 Seed·Shipyard·Armor Language의 출시 적용이나 220척 검증을 의미하지 않습니다. [원래 승인 시안](qa/v1.8.2/STRUCTURAL_REVIEW.md)과 [연결부 보완 및 제한 Family 검증](qa/v1.8.2/LIMITED_STRUCTURAL_REFINEMENT.md)을 확인하세요.

QA 전용 `buildLimitedStructuralArmor(source)`는 위 세 조건만 허용합니다. `generateBlueprintV181`로 얻은 원본을 복사한 뒤 선택적 `structuralArmorPilot`에 실제 체적, 접촉점, 연결부, 채널 실측과 낮은 Foundation을 직렬화합니다. 일반 생성기 전체에 새 구조를 자동 적용하지 않으며 과거 JSON에도 소급 적용하지 않습니다.

후속 하부 검토에서는 먼저 Seed 7의 기존 7개 체적을 그대로 유지하며 선수 수렴, Keel–복부 보호 블록 접합, 후방 Cradle의 유입·수렴 형상을 정리했습니다. 기존 상부와 Mount는 변경하지 않았습니다. 이어서 `buildLimitedVentralReview(source)`를 **위 세 대표 저장본에만** 적용하여, Hammerhead의 전방 보호부–기계 축–후방 연결과 Engine-dominant의 독립 나셀별 국소 Cradle을 확인했습니다. [초기 하부 승인 자료](qa/v1.8.2/VENTRAL_REVIEW.md)는 보존하며, [후속 흐름 정리 / 세 Family 실제 렌더](qa/v1.8.2/VENTRAL_FLOW_REFINEMENT.md)에 현재 결과와 한계를 기록합니다. 이는 전체 V1.8.2 출시나 다른 Seed에 대한 일반화를 의미하지 않습니다.

```bash
npx vitest run tests/ventral-structure.test.ts tests/ventral-limited.test.ts
# dev 서버 실행 후 기존 증거를 덮어쓰지 않는 새 출력 폴더 사용
VENTRAL_LIMITED_OUTPUT=qa/v1.8.2/ventral-flow/local-review node tests/ventral-limited-qa.mjs
```

```bash
npx vitest run tests/structural-armor-pilot.test.ts tests/structural-armor-limited.test.ts
# npm run dev 실행 중 별도 터미널에서 승인 범위의 세 척만 캡처
LIMITED_OUTPUT=qa/v1.8.2/limited-families/local-review node tests/structural-armor-limited.mjs
# 기존 승인 시안과 동일한 360m 프레임의 Seed 7 재검토
PILOT_OUTPUT=qa/v1.8.2/structural-pilot/local-review node tests/structural-armor-pilot.mjs
```

## Blueprint / 생성 순서

### V1.8.2 Functional Exterior — WEDGE_CITADEL 한 척 검토

승인된 상부·하부 **Seed 7 및 세 Family 저장본은 기준점으로 그대로 보존**했습니다. 이번 후속 단계는 `qa/v1.8.2/ventral-flow/seed7-final/blueprint.json`의 **Aegis / Cruiser / 300m / MONOLITHIC / WEDGE_CITADEL** 한 척에만 기능 외장을 통합합니다. 29개 구조 매스, 채널·복부 포켓, 모든 Foundation, 31개 Hardpoint 좌표·법선과 엔진을 변경하지 않습니다. 타일형 Armor Language와 220척 확장은 보류 상태입니다.

`buildFunctionalExteriorReview(source)`는 기존 Prefab Registry의 선택적 `PrefabPlacement.assembly`에 닫힌 체적, 접촉점, 장비 참조, 열린 배기·정적 사격 공간을 저장합니다. 넓은 장갑 마감면, 무장 보호 하우징·미사일 해치·센서, 함교 창, 열린 환형 추진 보호부와 선택적인 정비 펌프를 추가합니다. `functionalExterior`에 검토 범위, 마감 재질, 장갑 접촉 면적, 채널 점유율과 Bounds를 기록합니다. Renderer는 저장된 메시만 최대 6개 재질 배치로 재현하며, 과거 JSON에는 이를 추가하지 않습니다. 전투·조준·실제 무기 동작은 구현하지 않습니다.

```bash
npx vitest run tests/functional-exterior.test.ts
# dev 서버 실행 후 기존 증거를 덮어쓰지 않는 출력 폴더 사용
FUNCTIONAL_OUTPUT=qa/v1.8.2/functional-exterior/local-review node tests/functional-exterior-qa.mjs
FUNCTIONAL_OUTPUT=qa/v1.8.2/functional-exterior/local-review python tests/compose-functional-exterior.py
# production preview의 기존 UI만 검증; Gallery / 대량 생성을 실행하지 않음
PRODUCTION_URL=http://localhost:4173 node tests/functional-ui-smoke.mjs
```

[다섯 시점 / 전후 비교 / 확대 렌더와 한계](qa/v1.8.2/FUNCTIONAL_EXTERIOR_REVIEW.md). 이는 일반 생성기를 V1.8.2로 출시한 것이 아니라, 승인된 단일 설계의 완성형 외장 검토입니다. 기존 V1.8.1 생성 경로와 저장 JSON 계약을 유지합니다.

`schemaVersion: 2`, `generatorVersion: "1.8.1"`. 선택적 `layeredArmor`에 실제 면, 분할 패널, 계층, 접촉점, 두께, Chamfer, Gap, Seam, Bounds, 피복 면적과 예외 사유를 저장합니다. 선택적 `Hardpoint.surfaceMount`는 장갑·Surface·Socket 참조, 안정적인 면 좌표, 표면 법선과 장착 방향, 실제 Foundation Geometry 및 Clearance를 보존합니다. Renderer는 RNG를 실행하거나 새 패널을 배치하지 않습니다.

1. V1.8의 Architecture, Composition, Macro와 Structural Hull을 생성합니다. 기존 Hardpoint 위치는 설치 계획으로 사용합니다.
2. Station Ring을 연결하는 실제 Loft 삼각형과 Fore/Aft Cap을 추출합니다. 기존 Integration / Bow / Stern의 저장된 contour도 사용합니다. AABB는 접촉 판정에 사용하지 않고 broad phase만 수행합니다.
3. 내부 접합 면을 표면 샘플로 분류합니다. 엔진 배기·척추 포구·방열·Carrier 접근 영역은 유한한 원통 예약의 보수적인 다각형 경계로 분할하며 제외 사유와 면적을 기록합니다. 외부 Hardpoint는 기본 피복의 제외 사유가 아닙니다.
4. 조선소별 종·횡 패널 구획을 실제 면 위에 Clip합니다. 각 판은 매립된 Root, 실제 측면 두께, 작은 경사 Chamfer와 넓은 평면 Cap으로 이루어집니다.
5. 패널 경계를 축소하여 실제 Geometry Gap을 만듭니다. Gap 아래의 원래 Hull / Integration은 낮은 Underlayer입니다. 별도 검은 Line이나 Texture로 홈을 대체하지 않습니다.
6. 일부 면에만 낮고 넓은 Secondary / 국소 Reinforcement를 추가합니다. 분리 Pod와 트러스 사이를 외피로 연결하지 않습니다.
7. 최종 장갑 면에 Surface Socket을 결정합니다. 경사진 접촉 면과 외향 설치 방향 사이를 8점 접촉 Foundation이 보정합니다. 최종 무장/센서/미사일 설치 footprint를 순서대로 예약하고 겹치는 Mount는 가까운 빈 장갑 면으로 이동합니다. 장갑판을 삭제하지 않습니다. Spinal은 기존 축 방향 설치를 유지합니다.
8. Geometry, 방향별 피복, 참조, Bounds, 예약 Clearance와 사격 경로를 검증합니다.

TOP / BOTTOM / PORT(left) / STARBOARD(right) / FORE / AFT를 독립적으로 측정합니다. 원래 면적, 피복 대상 면적, 제외 면적, 실제 Primary 접촉 면적을 구분하고 대상의 **90% 미만이면 검증 실패**로 처리합니다. Secondary의 면적을 더해 기본 피복률을 부풀리지 않습니다.

패널은 길이·폭 분할과 면 경계에 따라 직사각형, 사다리꼴, 절두형 다각형, 육각형, 종방향 Strip으로 나타납니다. Aegis는 큰 판·두꺼운 가장자리·깊은 홈, Vesper는 긴 좁은 구획·낮은 적층, Forge는 정비용 산업 패널과 절두 경계, Serein은 낮고 넓은 정돈된 구획과 작은 Chamfer를 사용합니다.

Normal 렌더링은 장갑을 계층별 최대 **3개 Mesh**로 배칭하고 Segment ID ↔ vertex range를 보존합니다. 실제 생성량과 Polygon 비용은 QA에 기록합니다. 5,000 Segment / 200,000 Armor Triangle은 안전 상한이며 목표 생성량이 아닙니다. 동일 Material을 공유하고 장갑 Geometry는 Blueprint만으로 재현합니다.

## 호환성과 질량

`generateBlueprintV18`은 변경하지 않은 V1.8 비교 경로입니다. Structure, Connector, Macro Plan/실측, 구조 질량, 엔진, 기존 Prefab/Integration 데이터는 유지합니다. 신규 외부 Hardpoint의 위치·법선과 부모는 최종 Surface에 맞춰 바뀔 수 있으며 원래 Hull 위치·법선은 Mount 데이터에 기록합니다. 기존 Integration 예약은 건조 단계의 계획이며 최종 장착 Socket과 Clearance는 `surfaceMount`에 저장합니다.

기존 측면 Armor Envelope / Hull 기반 외부 무장 하우징은 `supersededExteriorIds`로 명시하여 새 판·Foundation과 중복 렌더링하지 않습니다. 기존 저장 V0~V1.8 Blueprint에는 새 데이터나 규칙이 소급 적용되지 않습니다. 추가 외피와 Foundation Bounds는 별도로 기록하며 Auto Fit은 실제 전체 메시를 사용합니다. 물리적 장갑 두께(미터)와 미래 전투용 보호 등급은 서로 다른 값입니다.

## QA / Debug

기존 Debug 탭에 **Hull Only / Armor Coverage / Armor Panels / Panel Seams / Secondary Armor / Hardpoint Mounts / Complete Ship**을 추가했습니다. Coverage는 방향별 면을 색으로 구분합니다. Panel Seams는 낮은 Underlayer를 강조하지만 실제 판 Geometry와 Gap은 동일합니다.

`/qa.html`에서 Armor stage, Projection, Seed start, Count, Architecture, Family를 선택합니다. TOP / BOTTOM / LEFT / RIGHT / FRONT / AFT / ISOMETRIC과 fixed / normalized 비교를 지원합니다. `NO_HARDPOINTS`와 `COMPLETE`는 정확히 동일한 장갑을 사용합니다. QA 옵션은 발주 UI와 분리되어 있으며 모델 직접 편집은 제공하지 않습니다.

```bash
npm run dev
npm run qa:armor
python3 tests/compose-armor-qa.py
QA_OUTPUT=qa/v1.8.1/regression npm run qa
```

브라우저 캡처는 Chromium (`/usr/bin/chromium` 또는 `CHROMIUM_PATH`), 이미지 합성은 Python Pillow / NumPy를 사용합니다. [V1.8.1 QA](qa/v1.8.1/QA.md)에 220척, 7방향, 실제 Seam 확대, Hardpoint 전후, 과거 JSON 회귀와 성능 결과를 기록합니다. 전체 Blueprint는 `.json.gz`로 저장하고 대표 Before/After JSON은 별도로 보존합니다. 기존 `qa/v1.8/`는 수정하지 않습니다.

V1.8.1 전체 테스트는 기존 47개와 장갑 전용 13개를 포함한 **60개**입니다. 최종 220척에서 방향별 피복률은 모두 97.95% 이상이며, Mount 겹침과 Foundation 높이 초과는 0건입니다. Foundation은 8개 지지점 중 최소 6개의 실제 장갑 접촉과 낮은 높이 제한을 만족해야 합니다. 같은 환경의 생성 중앙값은 V1.8 7.00ms에서 111.50ms로 증가했고, 평균 Triangle은 9,798.5에서 47,510.1로 증가했습니다. 장갑 Geometry의 CPU·Polygon 비용은 남은 최적화 과제입니다.

## 의도적 한계

축 정렬 Station Loft만 지원합니다. 내부 접합·부분 노출은 면 샘플을 이용하며 완전한 Triangle Boolean/CSG 또는 모든 삼각형 간 교차 판정은 수행하지 않습니다. 원통 개구부는 두께 여유를 더한 보수적인 8면체로 Clip하므로 실제 개구부보다 넓은 비장갑 가장자리가 생길 수 있습니다. Carrier 접근 구역은 외형/메타데이터이며 실제 격납고를 시뮬레이션하지 않습니다.

Foundation은 실제 패널의 표면을 샘플링하는 외향 설치 구조입니다. Clearance는 Placeholder 설치 공간과 샘플 사격 경로를 검증하며 실제 무기 모델의 전 방향 조준을 보장하지 않습니다. Combat, 내부 구획, Damage, 정밀 열역학은 구현하지 않습니다. 모바일 viewport 확인과 실제 모바일 GPU 성능 측정은 구분합니다.

Armor의 부모·계층·Surface·Socket·보호 구역을 향후 Internal Architecture와 Damage에 연결할 수 있습니다.

---

# Procedural Shipyard V1.8 — Macro Silhouette & Design Grammar

기존 V0의 주문서·Seed·Blueprint→Renderer 구조를 확장한 독립 웹 데모입니다. V1은 하나의 Primary Loft를 변형하는 대신 **구조 Volume과 Connector로 군함의 구성 방식을 선택**합니다. V1.5는 기존 8개 Architecture 안에서 **덩어리의 Shape, 접합 Join, 질량 계층과 Composition**을 분화합니다. V1.7은 실제 단면 접촉과 장비 예약 영역을 기반으로 접합부·선수·선미·장갑 및 기능 외장을 통합합니다. 메시 직접 편집, 전투, 내부 구획, 파괴는 구현하지 않습니다.

## 설치 / 실행 / 테스트

Node.js 22.12 이상 권장. 외부 서버와 API 키는 필요 없습니다.

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # 기존 38개 + V1.8 Macro 9개 = 47 tests
npm run build          # 엄격한 TypeScript 검사 + production 빌드
npm run preview        # production 미리보기
```

dev 서버가 실행된 상태에서:

```bash
npm run qa             # 50개 실제 브라우저 생성물, 10개 Debug View, UI 회귀 검증
npm run qa:gallery     # 220개 Contact Sheet 렌더 + 11 Shape / 10 Join Gallery
npm run qa:integration # 과거 V1.7 pipeline 회귀; 새 qa/v1.8/legacy-integration에 출력
INTEGRATION_OUTPUT=qa/v1.8/legacy-integration INTEGRATION_RAW=/tmp/shipyard-v17-regression-images python3 tests/compose-integration-qa.py # 역사 회귀 이미지 합성
# 별도 Chromium 설치 경로 또는 서버:
CHROMIUM_PATH=/path/to/chromium QA_URL=http://localhost:5173 npm run qa
```

브라우저 QA는 `playwright-core`와 설치된 Chromium을 사용합니다. 일반 앱 실행에는 별도 브라우저 설치 스크립트나 외부 리소스가 필요하지 않습니다. 기존 발주서, 직접 Seed 입력, Random Seed, Same Seed 재생성, 새 설계, Orbit/Zoom/Fit, JSON Export를 유지합니다. Architecture 선택 UI는 추가하지 않았으며 선택은 주문서와 Seed에 의해 이루어집니다.


## V1.8 Macro Design

Architecture는 **연결 문법**, Macro Family는 **주요 질량의 비례와 배치**를 결정합니다. 8 Architecture, 29 Composition, 11 Shape, 10 Join, 기존 Kitbash와 V1.7 Integration을 보존합니다. `schemaVersion: 2`, `generatorVersion: "1.8"`이며 저장된 V0–V1.7 Blueprint에는 Macro 규칙을 소급 적용하지 않습니다. V1.6/V1.7 기준 생성기는 각각 `generateBlueprintV16` / `generateBlueprintV17`로 재현할 수 있습니다.

| Macro Family | 실제 구조 변화 | 지원 Architecture |
| --- | --- | --- |
| WEDGE_CITADEL | 광폭·낮은 장갑 질량, 전체 단면의 비대칭적인 전후 폭 분포 | MONOLITHIC, BLOCK_ASSEMBLY, STACKED_BLOCKS |
| HAMMERHEAD | 넓고 지배적인 전방 장갑, 가는 전투 연결부와 작은 후방 | BLOCK_ASSEMBLY, STACKED_BLOCKS |
| SPLIT_FRAME | 복수의 질량 중심, 기능 포드 사이의 트러스/축과 열린 공간 | SPINE_AND_MODULES, TRUSS_POD, HYBRID |
| WIDE_CARRIER | 큰 측면 구획·쌍동선, 짧은 중앙 연결부와 접근 채널 | BLOCK_ASSEMBLY, TWIN_HULL, HYBRID |
| ENGINE_DOMINANT | 대형 후방 기계 구획 또는 독립 나셀 질량 | BLOCK_ASSEMBLY, TWIN_HULL, CORE_AND_NACELLES |
| WEAPON_DOMINANT | 무장축과 후방 breech/추진 지지 질량이 전체 폭 분포 결정 | MONOLITHIC, SPINE_AND_MODULES, HYBRID |

파이프라인: Order / Shipyard·Role Doctrine → Architecture → **Macro Family / Composition / major-mass recipe** → 계획된 Station envelope와 구역별 부피 예산 → 기존 StructuralVolume/Connector 문법 → Shape/Join → Engine/Hardpoint와 Kitbash 예약 → V1.7 Integration / Armor / Equipment → 계획 일치·간섭·그래프·실루엣 검증 → Blueprint → Renderer. Macro는 렌더 후 스케일 변경이나 장식이 아니며, 장비 배치 전에 실제 주요 구조물의 위치·크기·단면을 결정합니다.

선택적 `macroDesign`은 Family, Architecture, Composition, dominant region, fore/mid/aft 및 primary mass 비율, lateral/vertical spread, +Z 후방 축 규칙, negative-space targets, 구조물별 role/position/dimensions/Shape, symmetry policy, priority별 silhouette budget, variant와 생성 Seed를 보존합니다. `realized`는 최종 구조의 독립 측정이고 `attempts`는 후보 실패 이유와 구조 ID를 기록합니다. V1.8은 실패 후 몰래 기존 바늘형이나 다른 Grammar로 변경하지 않습니다. 동일 Family/Architecture에서 최대 5개 후보를 시도하고 실패를 명시합니다.

`ShapeDefinition.stationScales`는 기존 Station Ring 메시 경로의 선택적 종방향 envelope입니다. 새로운 Shape 종류나 별도 Renderer 생성기는 아닙니다. 구형 Shape에는 이 필드가 없고 기존 계산을 그대로 사용합니다. 부피는 실제 8점 Station Ring의 선형 loft 단면을 Simpson 적분하며 전방/중앙/후방 경계는 요청 길이의 ±1/6입니다. 단위는 m³, 밀도 근사는 t/m³, 추정 질량은 t입니다. 서로 매립된 구조물의 부피 합이므로 정확한 CSG 합집합 질량은 아닙니다. X/Y 질량 중심은 구조물 중심 근사이고 종방향 중심은 단면 적분입니다.

Aegis는 넓고 두꺼운 장갑 질량, Vesper는 좁고 큰 후방 추진 구획, Forge는 분리 모듈·큰 서비스 간격·제한적인 센서 오프셋, Serein은 넓고 낮은 연속 외곽선을 선택합니다. Firepower/Missile은 주요 기능 구획, Survivability는 폭·두께, Mobility는 기계 구획, Endurance는 보급 모듈, Sensor는 센서 forebody 공간에 반영합니다. 모든 수치 변경이 Family를 바꾸지는 않습니다.

### 실제 실루엣 QA

`/qa.html`의 **Macro Family**는 개발용 강제 선택이며 일반 Ship Order에는 없습니다. 지원하지 않는 조합은 명시적인 오류를 표시합니다. **Projection**에서 Normal / TOP / SIDE / FRONT / ISOMETRIC / MASS를 선택하고 **Scale**에서 normalized / fixed를 비교합니다. 동일한 Architecture, Role, Shipyard, 연속 Seed 20척을 Contact Sheet로 확인할 수 있습니다. Shape/Join/Bow/Integration Gallery도 유지합니다.

실루엣은 실제 함선 Geometry와 의미 있는 외피/추진부를 검정색 unlit material로 렌더링합니다. mount marker, surface detail, 장비 greeble과 line overlay는 제거합니다. 모든 비교는 흰 배경의 정사영과 동일 해상도를 사용합니다. normalized는 종횡비를 유지하며 가장 긴 투영축을 맞추고, fixed는 300m 함선에 495m 정사각형 frame을 적용합니다. MASS는 dominant / supporting / functional / connection을 구분합니다. 실루엣 IoU·contour IoU·aspect ratio·pixel centroid·convex-envelope 빈 공간은 **반복 디자인 경고**이며 예술적 합격 점수가 아닙니다. Gallery의 Blueprint feature signature 역시 실제 이미지 다양성을 증명하는 지표로 사용하지 않습니다.

```bash
npm run qa:macro                 # 220척, 정사영 4방향 + fixed TOP, 15개 V1.7 비교, WebGL 재현성
python3 tests/compose-macro-qa.py # Pillow + NumPy: 실제 PNG 분석 및 Contact Sheet 합성
npm run qa                      # 주문서 / Seed / Orbit / Zoom / Fit / Debug / Export 회귀
```

Chromium 경로는 `CHROMIUM_PATH`, 서버는 `QA_URL`, Macro 출력은 `MACRO_OUTPUT`, raw 이미지 임시 경로는 `MACRO_RAW`로 지정합니다. 기존 QA 자료를 덮어쓰지 않습니다. 이미지 합성의 기본 경로는 `qa/v1.8`와 `/tmp/shipyard-v18-images`입니다. 일반 앱은 Python을 요구하지 않습니다. `qa:integration`은 버전 고정 V1.7 회귀를 새 `qa/v1.8/legacy-integration` 경로에, `qa:gallery`는 최신 Gallery를 새 `qa/v1.8/gallery` 경로에 기록합니다. 최신 Macro 검증은 위 명령을 사용합니다.

의도적 한계: 축 정렬·자유 회전 제한, 실제 Boolean 없이 중첩 부피 합, 기존 샘플 기반 외피 간섭 검사, 정적 주포/추진 경로 검사, 정밀 내부 질량·장갑·피해·함재기 시뮬레이션 제외. 모바일 레이아웃 검증과 실제 모바일 GPU 성능 검증은 다릅니다. 동일 환경의 WebGL 픽셀 재현성을 확인해도 서로 다른 GPU의 픽셀 일치를 보장하지 않습니다. 이후 V1.9 Art-directed Prefab은 Macro module role·Shape envelope·Connector/Socket 계약을 소비하도록 확장할 수 있습니다.

최신 결과: [qa/v1.8/QA.md](qa/v1.8/QA.md). 아래 V1.7과 이전 버전의 구조 설명 및 QA는 역사 자료로 보존합니다.

## V1.7 외형 통합

기존 8 Architecture, 29 Composition, Shape 11종, Join 10종과 V1.6 Prefab Registry를 유지합니다. `schemaVersion: 2`, `generatorVersion: "1.7"`입니다. Layout의 중심 축·엔진 장착점·무장 위치를 보존하며, 완성된 구획과 장비 데이터를 이용해 외피를 생성합니다. 기존 V0/schema 1 및 V1–V1.6/schema 2 JSON에 새 필드가 없어도 이전 렌더 경로로 처리합니다.

파이프라인: 주문/Doctrine → Architecture/Composition → Volume/Connector → 기존 Engine/Hardpoint 및 Kitbash 예약 → 실제 단면 기반 Integration → 선수/선미 → Armor Envelope → Functional Superstructure → 간섭 검증 → Blueprint → Renderer. 장비 예약을 먼저 확정하는 것은 외피가 무장과 분사 경로를 가리지 않도록 하기 위한 순서입니다.

- **Integration:** Transition Shell, Armored Shoulder, Junction Housing, Structural Fairing, Reinforced Collar. 길이 방향 연결은 두 실제 Station Ring을 이으며 측면 연결은 실제 단면 폴리곤 내부에 접촉 패치를 맞춥니다. 큰 연결 외피가 인접 구조나 장비와 충돌하면 제한된 전환부 또는 기존 Join으로 fallback하고 실패 사유를 기록합니다.
- **Bow/Stern:** Armored, Wedge, Sensor, Spinal Muzzle, Industrial Bow; 열린 Engine Housing과 Thruster Frame, rear transition 및 비추진 구획의 노출 후방 마감. 평평한 선수도 장갑 테두리와 단차 마감을 갖습니다. 엔진 케이싱에는 노즐을 막는 디스크를 만들지 않습니다. V1.6의 일부 클러스터에서 겹치던 노즐은 장착점을 이동하지 않고 반경만 간격에 맞춥니다.
- **Armor:** Station을 따라가는 Primary/Secondary/Edge/Joint/Machinery 보호 외피. 실제로 덮은 측면 구간의 기존 작은 장갑판만 대체합니다. 보호 등급은 시각적 메타데이터이며 관통 시뮬레이션이 아닙니다.
- **Functional:** Sensor Housing, Missile Bay Housing, Radiator Mount, Weapon Foundation, Engine/Machinery Housing. Firepower/Missile은 foundation 크기, Survivability는 외피 두께와 보호 등급, Mobility는 추진 케이싱 길이, Endurance는 thermal/service mount, Sensor는 센서 하우징에 반영합니다.

새 데이터는 별도 중복 Connector 시스템이 아닌 기존 `PrefabPlacement.exterior`와 `hullIntegration`에 저장됩니다. Exterior에는 phase, parent IDs, Connector/EquipmentZone 참조, mating Socket, 접촉 샘플, world-space contour rings 또는 열린 annular casing, inset, armor class/protection grade가 있습니다. `hullIntegration`에는 장비 예약 영역, 승인/거부/fallback 기록, 별도 외장 bounds와 전체 보수적 bounds가 있습니다. 이후 Internal Zone/Damage는 이 부모와 Socket 참조를 이용할 수 있지만 현재는 구현하지 않습니다.

Aegis는 두꺼운 collar와 flank armor, Vesper는 긴 taper와 추진 외장, Forge는 국소 연결 보호와 노출 트러스, Serein은 낮고 연속적인 fairing을 사용합니다. TRUSS_POD와 CORE_AND_NACELLES의 빈 공간은 통째로 외피로 덮지 않습니다.

일반 Viewer에 Integration/Armor/Equipment Debug View를 추가했습니다. `/qa.html`에서 동일 Architecture와 Seed 범위의 20척 Contact Sheet, 기존 Shape/Join Gallery 및 Bow/Stern, Integration/Armor Gallery를 볼 수 있습니다. QA 전용 Viewer는 iso/top/side/front/rear를 지원합니다. 대표 비교와 측정 결과는 [qa/v1.7/QA.md](qa/v1.7/QA.md)에 기록합니다. 이전 QA 자료는 보존합니다.

의도적 제약: StructuralVolume은 회전 없는 기존 축 정렬 규칙을 유지합니다. AABB는 bounds 용도이며 접합 판정에는 실제 Station Ring과 단면 내부 검사를 사용합니다. 간섭 검사는 유한한 정점/모서리/면 샘플과 예약 원기둥 휴리스틱으로, 완전 CSG·정확한 삼각형 교차·물리 구조 해석을 보장하지 않습니다. 연결 불가 후보는 사유와 함께 생략하거나 기존 Join을 유지합니다. WebGL pixel 결정성은 같은 브라우저/GPU/viewport/카메라 조건에서 검증하며 서로 다른 GPU의 픽셀 동등성을 의미하지 않습니다. 일반 앱 실행에는 Python이 필요 없고 QA 이미지 합성만 Pillow를 사용합니다.

## Architecture Grammar

| Grammar | 구성 방식 | 읽히는 실루엣 |
| --- | --- | --- |
| MONOLITHIC | 1개의 연속 장갑 Volume | 일체형 장갑 선체, 둔한 군용 선수 |
| BLOCK_ASSEMBLY | 선수·전투 코어·후방 엔진 구획 + 양쪽 무장 블록 | 큰 장갑 덩어리와 접합 칼라 |
| SPINE_AND_MODULES | 1개의 긴 실체 Spine + 기능 포드·독립 추진 구획 | 축 구조에 나머지 함선을 결합 |
| TRUSS_POD | 짧은 압력 코어 + 떨어진 센서/무장/엔진 포드 | 큰 빈 공간을 가로지르는 실제 트러스 |
| TWIN_HULL | 좌우 독립 장거리 Hull + 중앙 Bridge | 쌍동선, 각 Hull의 독립 추진기 |
| CORE_AND_NACELLES | 작은 전방 Core + 수평·수직 분산 4개 Nacelle | 코어 뒤에 펼쳐진 추진 프레임 |
| STACKED_BLOCKS | 넓은 Keel·중간 Magazine·상부 Command Deck | 층별 장갑 Volume과 계단형 테라스 |
| HYBRID | Spine + Truss Pod, 두 문법만 조합 | 축 중심 구조와 떨어진 포드의 조합 |

주요 Volume은 보통 1–6개이며 최대 12개를 검증 한계로 둡니다. 비일체형 문법의 `stations`는 비어 있고, 각 Volume에 자체 local Station geometry가 있습니다. 따라서 전역 Primary Hull 없이도 생성·렌더링·검증이 가능합니다.

V1의 8개 Primitive 인터페이스와 이전 JSON 렌더 경로는 보존합니다. V1.5 생성은 아래 ShapeDefinition을 권위 데이터로 사용하며 같은 저해상도 Loft geometry 경로를 확장합니다. 선수는 pointed, blunt armored, wedge, split nose, spinal muzzle, sensor nose, block nose, tapered industrial로 역할/문법과 연결됩니다. Rounded Box는 낮은 폴리곤 수의 모따기 단면이며 subdivision 곡면은 아닙니다.

## Shape Vocabulary / Join System

11개 Shape가 실제 생성에 사용됩니다: `BOX`, `CHAMFERED_BOX`, `WEDGE`, `TAPERED_PRISM`, `HEX_PRISM`, `FLATTENED_HEX`, `ARMORED_CYLINDER`, `CLIPPED_BOX`, `SHORT_LOFT`, `LONG_LOFT`, `COMPOUND_LOFT`.

`src/generation/shapes/definition.ts`는 구조 목적(NOSE/CORE/MISSILE/ENGINE/SPINE/SENSOR/SUPPLY)에서 허용된 Shape 후보만 선택하며 Architecture와 Shipyard 선호를 가중합니다. Box는 보급/산업 모듈로 제한합니다. Compound는 반복적인 단면 변화, Cylinder는 팔각 장갑 케이싱과 끝단 collar, Clipped는 절단된 끝/모서리, Hex는 실제 6면 단면을 사용합니다. HullStation의 8개 정점은 유지하며 육각형의 하단 두 면에는 공선 분할점을 둡니다.

기존 StructuralConnector의 `join`에 10개 접합을 추가했습니다: `FLUSH`, `OVERLAP`, `ARMORED_COLLAR`, `STRUCTURAL_NECK`, `TRANSITION`, `RECESSED`, `TRUSS`, `BOOM`, `BRIDGE`, `NACELLE_MOUNT`. 별도 중복 연결 그래프를 만들지 않았습니다. 각 Join에는 길이/폭/높이, overlap/inset, transitionRatio, armor/support scale, style variant, supportLoad를 기록합니다. Transition/Nacelle Mount는 테이퍼, Collar는 두꺼운 접합 밴드, Bridge는 넓은 횡구조, Truss는 2~4개 rail과 제한된 bay를 렌더링합니다.

Stack과 제한된 측면 Battery의 Overlap/Recess는 실제 Volume 매립을 사용합니다. 완전 CSG union은 하지 않습니다. 센서 Boom과 엔진 Truss를 구분하며 `supportLoad = volume × distance × doctrine`의 4제곱근과 최소 단면 비율로 지지 두께를 결정합니다. 이 값은 시각적 구조 휴리스틱이며 물리 강도/질량 시뮬레이션이 아닙니다.

## Composition / 질량 계층

새 Architecture를 추가하지 않았습니다. 기존 문법 내부 Pattern은 다음과 같습니다.

| Architecture | Composition patterns |
| --- | --- |
| MONOLITHIC | BROAD_CITADEL, FORWARD_SHOULDERS, LENS_BODY |
| BLOCK_ASSEMBLY | FORWARD_HEAVY, CENTRAL_CORE, SIDE_BATTERIES, STEPPED, REAR_HEAVY, SPLIT_CORE |
| SPINE_AND_MODULES | ARMORED_BREECH, MID_SPINE_CITADEL, REACTOR_SADDLE |
| TRUSS_POD | OUTRIGGER_BATTERIES, AFT_MACHINERY, STAGGERED_PODS |
| TWIN_HULL | CENTRAL_CORE, CENTRAL_SPINAL, FORWARD_BRIDGE, ENGINE_BRIDGE, STAGGERED_HULLS |
| CORE_AND_NACELLES | RADIAL_DRIVES, SWEPT_NACELLES, COMPACT_CORE |
| STACKED_BLOCKS | FORWARD_CITADEL, LOW_TERRACES, AFT_CITADEL |
| HYBRID | AXIAL_OUTRIGGERS, ARMORED_AXIS, REACTOR_FRAME |

Block의 전방/중앙/측면/후방 체적 관계를 크게 바꾸고, Twin은 상대 길이·폭·전후 offset·중앙 무장축/bridge 위치를 바꿉니다. Stack은 상부가 작아지는 30~43% 매립 성채와 낮은 테라스이며, Truss는 장거리 무장 포드·후방 대형 추진부·높이와 전후가 다른 포드를 구분합니다. Spine/Hybrid는 최소 축 단면과 보강 node를 사용하며 축 slenderness ≤17을 검증합니다. HYBRID는 Spine + Truss Pod의 두 문법 조합을 유지합니다.

각 Volume의 `hierarchyTier`는 주 질량(1), 큰 보조 질량(2), 기능 구획(3)을 나타냅니다. Twin의 두 대형 Hull 같은 목적상 유사한 구획은 허용하며 전체 Primary 질량 비율과 장갑화된 접합을 확인합니다. Surface Detail 시스템은 확장하지 않았고 Normal View에는 낮은 mount foundation만 남깁니다. Debug arrow는 Hardpoints View에서만 표시하며 legend에는 타입·크기·부모가 나옵니다.

## Contact Sheet / Debug Gallery

앱 하단 **QA / Contact Sheets & Galleries** 또는 `/qa.html`을 여세요. Shipyard, Role, Architecture, Seed start, Count(1–40)를 선택하고 Build contact sheet를 누릅니다. 기본 20척은 4×5 grid입니다. 이 Architecture 강제 선택은 개발용 도구에만 있으며 일반 Ship Order에는 추가하지 않았습니다. `architecture.source: "qa-fixed"`로 일반 생성과 구분합니다.

- **Neutral silhouette**: 동일한 회색 Material, Hardpoint/Surface Detail 제거로 구조만 비교합니다. 새 함선을 편집하는 기능이 아니라 QA 렌더 옵션입니다.
- **Shape gallery / 11**, **Join gallery / 10**: 실제 앱 렌더러로 primitive와 접합부를 확인합니다.
- **QA JSON**: Composition 수, quantized feature signature, 질량 비율·전후 질량·폭/높이 spread·Join/Shape 분포를 저장합니다.
- 20개 중 Composition 2개 미만 또는 signature 12개 미만이면 QA warning을 표시합니다. Signature와 픽셀 차이는 예술적 품질의 증명이 아니므로 Contact Sheet 직접 검토를 함께 수행합니다.
- 하나의 WebGL context를 순차 재사용해 thumbnail을 만듭니다. Gallery 생성은 20개의 live scene을 유지하지 않습니다.

## 조선소와 역할의 선택 경향

명시적인 기반 가중치는 `src/shipyards/config.ts`, 주문 조건의 가중치 변경은 `src/generation/architecture/selection.ts`에 있습니다. 완전 균등 랜덤이나 Seed 순환 프리셋이 아닙니다.

| 조선소 | 선호 문법 | 형상 언어 |
| --- | --- | --- |
| Aegis / Heavy Naval | Monolithic, Block Assembly, Stacked Blocks | 두꺼운 장갑, 조밀한 큰 구획, 넓은 접합부 |
| Vesper / High Mobility | Spine, Core and Nacelles, Twin Hull | 좁은 기능 구획, 길게 분리된 추진부, 다중 엔진 |
| Forge / Industrial | Truss Pod, Block Assembly, Spine | 압력 모듈, 노출 트러스, 외부 엔진/무장 포드 |
| Serein / Advanced | Monolithic, Spine, Twin Hull | 낮은 단면, 정돈된 연속 표면, 적은 색 분할 |

- Battleship/Battlecruiser: Monolithic·Block·Stack를 강하게 선호하고, 큰 체적과 장갑 구획을 사용합니다. Battleship slenderness에 별도 상한이 있습니다.
- Destroyer/Corvette/Patrol: Nacelle·Spine 비중이 커지고, 추진 비율과 낮은 구획 체적을 강조합니다.
- Missile Ship: Block·Truss Pod·Stack 가중치를 높이고, 무장 Volume에 최소 10개의 미사일 기반을 할당합니다.
- Spinal Gun Ship: Spine 가중치를 크게 높입니다. 긴 무장 하우징, 선수 muzzle mount, 좌우 breech/reactor-like 구획과 별도 후방 추진 구획이 축 주변에 배치됩니다.
- Cruiser/Frigate: 다양한 구조를 허용하고 주문 우선순위·조선소가 선택을 좌우합니다.

6개 우선순위는 여전히 비율·장갑·추진·무장 예산·보급 공간·센서에 영향을 주며, 길이와 질량 등급도 선택 확률에 반영합니다. 문법에 맞는 최대 폭 포락선으로 비정상적인 가로 큐브 형태를 방지합니다.

## V1.5 Blueprint 계약

`src/blueprint/types.ts`:

- `schemaVersion: 2`, `generatorVersion: "1.5"`. 추가 필드는 이전 V1 JSON 렌더를 위해 optional이며, V1.5 생성/검증에서는 필수입니다.
- `architecture`: 실제/요청 문법, 최대 2개 components, rootVolumeId, nose, engineArchitecture, 선택 가중치, 주요 비율/예산, 선택적 fallbackReason, composition, source.
- `structuralVolumes`: 기존 필드 + 권위 `shape: ShapeDefinition`, `hierarchyTier`. `geometry.stations`는 attachment/구버전 호환을 위한 파생 cache이며 검증 시 Shape에서 재생성한 값과 일치해야 합니다. 렌더러는 Shape를 직접 해석합니다.
- `structuralConnectors`: id, from/to structure IDs, 실제 접합 표면의 world-space start/end, type, thickness, style, 상세 join.
- `silhouette`: slenderness, 주요 Volume 수, front/side/top 점유율, 대칭도, disconnected penalty, 질량 계층·전후 질량·가로/세로 spread·Join 분포.
- 기존 Engines, Hardpoints, SurfaceFeatures, MaterialTheme, Dimensions, Order와 generationStats 유지. V1 Engine에는 후방 방향 `direction`이 기록됩니다.
- Hardpoint/Engine/SurfaceFeature의 parentId는 실제 StructuralVolume ID를 참조합니다.
- `hullSections`는 모든 Volume의 단면 구간을 요약하며, 렌더러는 Shape에서 local Stations를 파생하고 Volume transform을 사용합니다. 이전 V1 JSON에는 cached Stations를 사용하는 fallback이 있습니다. `secondaryStructures`는 V1에서 비어 있는 이전 호환 필드입니다.

구조 유형: PRIMARY_HULL, HULL_BLOCK, POD, NACELLE, SPINE, ARMOR_BLOCK, DORSAL_STRUCTURE, VENTRAL_STRUCTURE. 연결 유형: DIRECT, TRUSS, BOOM, BRIDGE, NACELLE_MOUNT. 현재 생성 pose는 모두 전후 축에 정렬되어 있고 rotation은 0입니다. 임의 회전 Volume은 검증에서 거부하므로 잘못된 연결 계산을 조용히 허용하지 않습니다.

V0의 데이터 계약은 `LegacyShipBlueprint`로 유지합니다. `generateBlueprintV0(order, seed)`는 V0 알고리즘과 Seed 결과를 보존하고 공용 Renderer/Validator가 schemaVersion 1도 처리합니다. 일반 UI는 V1.5를 생성하므로 V0 Seed로 V1.5를 생성한 결과는 의도적으로 다릅니다. V1 Architecture 선택 Seed fixture는 그대로 유지하지만 Shape/Join 변경으로 V1과 V1.5의 전체 JSON·형상은 의도적으로 다릅니다. 같은 **버전 + Order + Shipyard + Seed**는 Architecture부터 JSON과 geometry까지 완전히 동일합니다.

## Silhouette-first 파이프라인

```text
Order 검증
→ Doctrine + Role + Priorities + Length/Mass 가중치
→ Seed 기반 Architecture 선택
→ Composition Pattern / Primary mass / Secondary mass 계층
→ 목적·Architecture·Shipyard별 Shape 선택
→ Join 선택 / 실제 접합 표면 및 매립 / 하중 기반 Connector + Truss 배치
→ Silhouette 휴리스틱 검증
→ 부모 Volume의 후면 추진기 배치
→ 문법별 무장 면과 노출 테라스에 Hardpoint 할당
→ 적은 수의 구획별 패널/벤트/해치
→ 기존 MaterialTheme 적용
→ 최종 그래프·부착·겹침·숫자 검증
→ Blueprint → 기존 Renderer 확장 경로
```

후보는 최대 5회입니다. 동일 선택 문법에서 처음 3개 후보가 거부된 Hybrid는 단일 Spine으로 fallback하고 이유를 기록합니다. 무한 재시도나 다른 Seed로 몰래 교체하지 않습니다.

## 연결과 실루엣 검증

- 전체 주요 Volume의 그래프 연결, 고유 IDs, root와 양방향 참조.
- Connector 끝점이 실제 단면 표면에 닿는지, 두께/틈이 함선 스케일에 맞는지.
- 대형 Volume bounding overlap이 작은 Volume의 12%를 넘으면 거부. 생성 문법은 구획끼리 관통시키지 않고 짧은 접합부로 연결합니다.
- 엔진 부모/후면/방향, 마운트 부모/표면/단위 법선/Spinal 축 정렬.
- NaN, 부적절한 단면, 너무 얇은 구조, 치수와 수량 검증.
- 28×28 투영 샘플을 이용한 전면/측면/상면 점유율, 대칭도, slenderness, 연결 손실. 투영은 각 Volume의 convex footprint를 사용하므로 상세한 픽셀 분석은 아닙니다.

지지 구조는 straight beam, double beam, triangular truss, box truss를 지원합니다. 길이에 맞춰 2–4 bays로 제한하고 실제 두 Volume 사이에만 생성합니다. 직접 접합은 넓은 armored collar를 사용합니다. 렌더링 접합 슈의 아주 작은 삽입 여유는 구조 부착을 위한 것이며 주요 Volume의 깊은 관통을 허용하지 않습니다.

## Viewer / Inspector

기존 5개 Debug View를 유지합니다. Hull Sections는 이제 Volume별 local 구간을 보여줍니다.

- **Architecture**: Hull/Block, Pod, Nacelle, Spine, Armor를 논리 유형 색상으로 표시.
- **Structural Graph**: 주요 구조 노드, Direct/Truss/Bridge/Mount 연결과 실제 연결 geometry 표시.
- Inspector: 문법, 주요 Volume 수, Connector/Truss 수, Hull/Pod/Nacelle/Spine breakdown, Engine Architecture.

실제 무기는 없습니다. 마운트 표시는 armored barbette와 circular well, rectangular VLS cell strip, 낮은 sensor blister로 개선했습니다. 기존 금속·부품별 마감·object-space panel material을 재사용합니다.

## QA 결과와 재현 Seed

V0 12개 회귀 테스트를 삭제하지 않고 이전 생성기 경로에 적용합니다. V1 9개 추가 테스트는 1,296개 주문 조합, 8개 문법 고정 Seed, 각 조선소/역할 20 Seeds의 다양성, 독립 raycast, 그래프 손상, Hybrid fallback, 8개 Primitive, Debug geometry 결정성을 검증합니다.

브라우저 QA: 6개 주요 Role 여러 Seeds, 같은 Cruiser의 4개 Shipyard, 8개 문법 각 3 Seeds를 포함한 **50개 실제 렌더**. UI Seed 10회 JSON/캔버스 픽셀 동일성, 7개 Debug Views, Orbit/Zoom/Fit/TOP/AFT, Inspector/다운로드, 모바일 가로 넘침과 Console를 검사합니다.

동일 Forge Cruiser 주문의 고정 Seed:

| 문법 | Seed |
| --- | --- |
| Monolithic | 7, 35, 79 |
| Block Assembly | 0, 8, 9 |
| Spine and Modules | 12, 24, 32 |
| Truss Pod | 1, 5, 6 |
| Twin Hull | 2, 3, 20 |
| Core and Nacelles | 41, 44, 48 |
| Stacked Blocks | 4, 30, 89 |
| Hybrid | 36, 43, 67 |

기존 V1의 720개 Architecture diversity guard를 유지합니다. V1.5 추가 테스트는 4개 Shipyard × 8개 고정 Architecture × 20 Seeds = 640개에서 Composition·Shape/Join 결정성, 그래프, 계층, 지지 비율을 확인합니다. 실제 Gallery는 11개 그룹 × 20 Seeds = 220개이며, 그룹당 3–6개 Composition, 18–20개 feature signatures, 20개 고유 thumbnail을 확인했습니다. 시각적 품질은 Contact Sheet를 직접 검토했습니다.

- `qa/QA.md`: 현재 V1.5 검증 요약.
- `qa/v1.5/gallery-report.json`, `contact-*.png`: 220개 구조 비교.
- `qa/v1.5/regression/report.json`: 50개 렌더와 UI/픽셀 회귀.
- `qa/v1/QA.md`: 이전 V1 검증 기록.
- `qa/v1/report.json`: 50개 렌더의 문법·구조 수·치수·삼각형·draw calls.
- `qa/v1/diversity.json`: 20 Seeds 다양성 분포.
- `qa/v1/architecture-comparison.png`, `representatives.png`: 문법/역할 대표 비교.
- `qa/v1/grammar-*.png`: 각 문법의 서로 다른 3 Seeds.
- `qa/v0/`: V0 문서·실행 기록·화면을 그대로 보존.

## 주요 확장 파일

- `generation/shapes/definition.ts`: ShapeDefinition → Station 파생, 목적/문법 후보.
- `generation/architecture/composition.ts`: Pattern별 질량 배치와 hierarchy.
- `generation/architecture/joins.ts`: 접합 선호, 매립, supportLoad, 실제 endpoint.
- `qa/gallery.ts`, `qa/fixtures.ts`, `qa/diversity.ts`: Gallery, primitive fixtures, 다양성 경고.

- `generation/architecture/selection.ts`: 선언적 가중치와 결정적 선택.
- `generation/architecture/layout.ts`: 목적별 큰 구획과 문법별 연결 배치.
- `generation/architecture/volumes.ts`: Primitive 계약, 표면 접합점, 노출 면, bounds.
- `generation/architecture/equipment.ts`: 부모 기반 추진·무장·표면 할당.
- `validation/silhouette.ts`: 투영 휴리스틱과 graph reachability.
- `validation/validate.ts`: schema별 검증 진입점 및 V1 구조 검증.
- `rendering/architecture.ts`: 기존 Loft/Material 기반 Volume·Connector·Graph 렌더.
- `generation/legacy.ts`, `validation/legacy.ts`: V0 Seed/검증 보존.

## 알려진 한계 / 다음 단계

V1은 외부 구조 컨셉 생성기이며 제조 가능한 CSG 합집합, 실제 연결 강도, 내부 공간, 전투 성능, 물리 질량을 계산하지 않습니다. 현재는 축 정렬 Volume만 생성합니다. AABB 겹침과 convex 투영은 보수적인 휴리스틱이며 모든 Connector와 장착 기반의 완전한 collision solver는 아닙니다. 장갑/구획 사이의 연결 슈는 작은 접합 여유를 사용합니다. 양쪽 동일 Hull은 목적과 전후 형상이 있지만 내부 배치는 없습니다. 링/아크 추진 배열은 이번 버전에서 구현하지 않았습니다.

V1.5 회귀 설계에서 4,224–9,860 triangles, 108–374 draw calls 범위의 저해상도 생성물을 검증했습니다. draw call 최적화는 남아 있습니다. GPU가 바뀌면 픽셀 안티앨리어싱 결과는 다를 수 있고, 동일 세션의 이미지 재현성만 비교합니다. Three.js 포함 번들 크기 경고는 실행 오류가 아닙니다.

다음 단계는 최대 3개:

1. Connector 접합 패치와 마운트 점유면의 정확한 교차/간격 검증.
2. 문법 내부의 기능 구획 배치 변형과 제한된 회전 Volume 확장.
3. 버전별 Blueprint Import/저장과 Structural Graph 기반 논리 Zone 계약.

---

아래는 보존한 V0 구현 기록입니다. 생성 파이프라인 설명 중 Primary Hull 전제는 schemaVersion 1 / `generateBlueprintV0`에만 해당합니다.

# V0 구현 기록

주문서와 조선소의 설계 규칙만으로 우주 전투함을 만드는 독립 웹 데모입니다. 사용자가 메시를 편집하는 모델러가 아니라, **설계 규칙에서 생기는 실루엣 다양성과 완전 재현 가능한 설계 데이터**를 검증하는 실험입니다.

## 설치와 실행

Node.js 22.12 이상 권장. 외부 서버, 계정, API 키는 필요하지 않습니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 엽니다. WebGL과 하드웨어 가속을 지원하는 최신 Chrome/Edge/Firefox를 권장합니다. 의존성 설치 이후에는 네트워크 없이 동작합니다.

```bash
npm run build         # 엄격한 TypeScript 검사 + dist/에 정적 빌드
npm run preview       # 빌드 미리보기
npm test              # Blueprint 및 geometry 자동 테스트
```

실제 브라우저 QA는 별도 터미널에 dev 서버를 실행한 상태에서:

```bash
npm run qa
# Chromium 경로가 다르면:
CHROMIUM_PATH=/path/to/chromium npm run qa
# 다른 주소를 사용할 경우:
QA_URL=http://localhost:5173 npm run qa
```

`playwright-core`는 브라우저 자체를 다운로드하지 않습니다. 브라우저 QA에만 설치된 Chromium이 필요하고, 일반 실행과 단위 테스트에는 필요하지 않습니다. QA는 headless WebGL/SwiftShader를 사용합니다. 산출물은 `qa/`에 저장합니다.

## 사용법

1. 네 조선소 중 하나를 선택합니다.
2. 9개 Role, 40–600m 주선체 길이, 4개 질량 등급, 6개 설계 우선순위를 지정합니다.
3. **Generate new design**은 새 32비트 Seed를 선택하고 현재 발주서로 생성합니다.
4. 특정 Seed를 직접 입력한 뒤 **Regenerate same seed**로 생성합니다. 주문서가 변경되었으면 변경된 조건을 사용합니다.
5. **Random Seed**(Seed 옆 아이콘)는 Seed만 바꿉니다. 같은 Seed 재생성 버튼으로 적용합니다.
6. 드래그로 궤도 회전, 휠/핀치로 줌, 오른쪽 드래그로 이동합니다. Fit은 카메라와 중앙점을 초기화합니다. TOP/AFT/3D는 관찰 방향을 바꿉니다.
7. Normal / Hull Sections / Hardpoints / Engines / Structure로 논리 요소를 확인합니다.
8. Blueprint 요약, View JSON, Export blueprint 또는 Copy JSON으로 데이터를 확인합니다.

발주서 변경은 명시적인 생성 버튼을 누를 때 적용합니다. 현재 함선과 미적용 주문서를 상태 문구로 구별합니다. 데스크톱에서는 주문 필드가 독립적으로 스크롤되며 Seed와 생성 버튼은 고정됩니다. 작은 화면에서는 3D 화면과 주문서를 세로로 배치합니다.

## 조선소와 실제 규칙

| 조선소 | 단면/비율 | 구조와 추진 |
| --- | --- | --- |
| Aegis Naval | 두껍고 넓은 box/chamfer 단면 | 좌우 장갑 블록, 1/2/4 대형 엔진 |
| Vesper Dynamics | 좁고 날렵한 diamond/hex 단면 | 화살촉 중심축, 어깨와 나셀, 4/6 엔진 |
| Forge Union | 잘록한 rounded/box 중심 선체 | 떨어진 압력 모듈과 트러스, 나셀 분산 2/4/6 엔진 |
| Serein Systems | 낮은 flattened/hex 단면, 좁아지는 후미 | 얇은 넓은 어깨, 낮은 마운트, 1/2/4 엔진 |

색상 외에 폭/높이, 선체 포락선, 단면, 구조 연결, 어깨 비율, 엔진 배열, 표면 마감이 다릅니다. 설정은 `src/shipyards/config.ts`에 명시적으로 모여 있습니다.

Role은 폭/높이 비율과 마운트 예산을 바꿉니다. Missile Ship은 넓은 중앙부와 별도 미사일 모듈, 최소 10개 Missile 마운트를 사용합니다. Spinal Gun Ship은 좁은 직선 중심축, 길게 이어진 내부 축 구조와 정렬된 전방 Spinal 마운트를 갖습니다. Battleship은 가장 큰 체적과 장갑을 갖습니다.

- Firepower: 무장 마운트 예산·크기, 최상위 요구 시 Spinal 마운트.
- Survivability: 선체 폭·높이·추정 밀도, 장갑 블록, 방어 마운트 수.
- Mobility: 좁은 선체, 엔진 수·노즐 크기·길이.
- Endurance: 주선체 높이, 중앙/후방 보급 구조와 압력 모듈 길이.
- Missile capacity: 폭과 전용 미사일 어깨, 미사일 마운트·VLS 표면.
- Sensor/EW: 센서 플랫폼의 높이, 센서 마운트 수와 센서 표시판.

## ShipBlueprint

`src/blueprint/types.ts`는 Three.js에 의존하지 않는 JSON 데이터 계약입니다.

- `schemaVersion`, `seed`, `candidate`, `shipyardId`, `role`, 전체 `order`
- `dimensions`: 선체와 엔진을 포함한 길이, 구조 포락선 폭/높이, 체적 기반 추정 질량(t)
- `stations`: 중심축의 5–12개 단면, 위치·폭·높이·profile·경사·bevel
- `hullSections`: 연속 Station 쌍, 논리 구획 ID
- `secondaryStructures`: 장갑/나셀/미사일/센서 플랫폼/보급 구조, 위치·크기·profile·부모
- `engines`: 개별 엔진 위치, nozzle radius/length, bell ratio, 부모
- `hardpoints`: 8개 종류, S/M/L/XL 크기, 위치·법선·허용 무장 카테고리·부모
- `trusses`: 두 연결점·반경·양쪽 부모 ID
- `surfaceFeatures`: 패널/벤트/해치/VLS, 위치·크기·법선·부모
- `materialTheme`: 금속 색상, 보조색, 강조색, 추진기색, roughness, 패널 주기
- `generationStats`: 주문 우선순위와 엔진 패턴

소형 마운트와 센서 표시판의 돌출은 포락선 치수에 포함하지 않습니다. `order.length`는 주선체 목표 길이이므로 실제 표시 길이는 추진기 돌출만큼 더 깁니다. 질량은 충실한 물리 계산이 아닌 역할/장갑 차이를 반영하는 상대적 추정치입니다. 점수도 전투 성능이 아니라 입력된 설계 우선순위입니다.

같은 버전의 알고리즘에서 같은 발주서·조선소·Seed는 완전히 같은 Blueprint를 생성합니다. 외부 시간이나 Math.random을 사용하지 않습니다. UI의 새 Seed 선택만 `crypto.getRandomValues`를 사용합니다. 알고리즘 버전 변경 후의 이전 Seed 호환성은 보장하지 않으므로 보존할 함선은 JSON을 Export하세요.

## 생성 파이프라인

```text
Ship Order 검증
→ Role 비율 + 우선순위 + 질량 등급 해석
→ Shipyard doctrine 적용
→ Seed 기반 일관된 선체 archetype/비율 선택
→ 5–12개 Station 포락선 생성 및 Loft 구획 정의
→ 좌우 대칭 Secondary Hull과 필요한 Truss 생성
→ 부모 선체/나셀의 후면에 추진기 할당
→ 무장 예산·종류 결정
→ 가장 위에 노출된 주선체/모듈 표면에 Hardpoint 부착, 법선 계산
→ 논리 구획과 모듈에 맞춘 패널/벤트/VLS 생성
→ 재질 테마와 추정 질량 생성
→ Blueprint Validation (최대 5회 결정적 후보 시도)
→ 독립 Three.js renderer로 geometry 조립
```

실루엣의 변화는 개별 정점 노이즈가 아니라 선체 최대폭 위치, 선수/후미 포락선, 어깨 폭·길이, 산업 모듈 구성, 추진 배열에서 나옵니다. 앞뒤 Station 값은 하나의 부드러운 포락선에 따라 변합니다. 재질은 object-space 함체 축 패널 패턴과 독립적인 금속 마감이며, 수동 UV와 외부 텍스처가 없습니다.

검증은 유한 숫자, Station 수·순서·치수, 전체 비율, 모듈-선체 중첩 또는 트러스 연결, 엔진 후면 부착, 마운트 표면 부착·단위 법선·축 정렬, 개수·종류·참조를 검사합니다. 실패하면 원 Seed와 후보 인덱스로 결정한 다음 후보를 선택하고 5회 이후 오류를 표시합니다. 카메라는 실제 조립 geometry 정점 범위에 맞춰 수직/수평 시야각을 고려해 fit합니다.

## 파일 구성

```text
src/
  blueprint/types.ts       # 직렬화 가능한 논리 데이터 계약
  random/rng.ts            # Mulberry32, Seed 정규화
  shipyards/config.ts      # 네 조선소의 선언적 설계 규칙
  generation/
    generate.ts            # 파이프라인·유한 재시도·추정 질량
    hull.ts                # Role 비율, Station, Profile, 표면 교차
    structures.ts          # 보조 선체와 Truss
    engines.ts             # 추진 배열과 부모 부착
    hardpoints.ts          # 무장 예산과 표면 상세
    attachment.ts          # 겹친 선체의 노출 표면·공유 모듈 Loft 계약
  validation/validate.ts   # 데이터·부착·치수 자동 검증
  rendering/
    geometry.ts            # Loft·모듈·Beam geometry
    materials.ts           # object-space procedural 패널 마감
    ship.ts                # Blueprint → Mesh / Debug / 폐기
    viewer.ts              # OrbitControls·조명·fit·리사이즈
  ui/layout.ts             # 주문서·Inspector·접근성 마크업
  main.ts                  # UI 상태와 생성/Export 연결
  style.css                # 반응형 작업 화면
 tests/generation.test.ts  # 데이터·결정성·실루엣·geometry 테스트
 tests/browser-qa.mjs      # 실제 브라우저 렌더·UI·픽셀 동일성 QA
```

개발 서버에만 read-only 조회 및 QA 재생성용 `window.shipyardQA`가 제공됩니다. production 빌드에는 활성화되지 않습니다.

## 의도적으로 제외한 것

정점/면 편집, Sculpt, Boolean 모델링, UV 편집, 무기 모델 제작, 실제 내부 구획, 승무원, 전투, 피격, 관통, 파괴, 구조 붕괴, 레이더/미사일 유도, 조종, 경제/생산, 멀티플레이를 구현하지 않습니다. Hardpoint는 무기가 아니라 부착 기반입니다.

## QA

자동 테스트는 결정성 10회, JSON round-trip, 주문서 불변성, Seed 변화, 잘못된 입력, 네 조선소 설정과 6개 단면, **1,296개** Role/조선소/길이/질량/우선순위 조합, 독립적인 6개 우선순위 반영, A/B/C/D 비율 차이, 연결 검증, 외향 삼각형, 실제 Mesh raycast를 통한 마운트 표면 검증 및 동일 geometry를 검사합니다.

브라우저 QA는 Battleship/Heavy Naval, Destroyer/High Mobility, Missile Ship/Industrial, Spinal Gun Ship/Advanced를 각각 3 Seeds로 렌더링하고 A/B/C/D와 동일 주문서의 네 조선소를 추가해 **20개 설계**를 확인합니다. Seed 10회 재생성의 JSON과 캔버스 픽셀, 실제 마우스 회전과 휠 줌, 5개 Debug View, AFT/Fit, JSON 보기/파일 다운로드, Seed UI, 모바일 가로 넘침, Console 오류를 검사합니다.

실행 기록은 `qa/v0/report.json`, 검토 내용은 `qa/QA.md`, 화면은 `qa/v0/*.png`에 있습니다. GPU/운영체제가 다르면 조명/안티앨리어싱 픽셀은 달라질 수 있습니다. 픽셀 동일성은 같은 브라우저 세션에서 검증하며 Blueprint 데이터 결정성은 플랫폼과 분리됩니다.

## 알려진 한계와 V1 확장

이 V0는 규칙 기반 저해상도 컨셉 생성기입니다. 복잡한 곡면, 실제 전투 밸런스, 정밀 질량, 완전한 collision solver는 제공하지 않습니다. 개별 부품 geometry는 닫혀 있어도 최종 선체가 하나의 제조 가능한 watertight 합집합 메시인 것은 아닙니다. 다수의 높은 우선순위에서는 마운트가 서로 가까워질 수 있습니다. 카메라 피트는 조립된 정점의 투영 범위에 안전 여백을 적용합니다. 한 척당 대략 수천~1만 삼각형이며, 기하 요소 수에 따른 draw call 최적화는 여지가 있습니다.

가장 먼저 확장할 세 가지:

1. **마운트 면적 예산과 간격 solver**: 표면 점유율, 충돌, 보호/노출 조건을 Blueprint 규칙으로 계산.
2. **조선소별 추가 선체 archetype**: 쌍동선·환형 추진부·비대칭 산업형 등 일관된 실루엣 문법 추가.
3. **버전별 Blueprint 저장/Import**: 생성기 버전 고정과 이전 설계 재로딩을 지원하고, 논리 구획 ID에 전투 시스템 데이터를 연결할 준비.

## V1.5 한계 / 다음 확장

축 정렬과 8-정점 단면, approximate volume/overlap 및 convex projection 휴리스틱을 사용합니다. 20척 Gallery는 설계 도구가 아니라 QA 도구입니다. 구조적 연결과 endpoint 접촉을 확인하지만 arbitrary collision / exact CSG / 실제 구조 강도를 보장하지 않습니다. 유사한 패턴 내 일부 설계는 여전히 닮을 수 있습니다. 같은 Seed의 재현성은 generatorVersion 범위에서 보장합니다. 이전 V1 Blueprint도 그대로 렌더링됩니다.

이후에는 (1) Shape + purpose에서 Internal Zone envelope 생성, (2) 기존 Volume/Connector ID를 사용하는 Structural Graph 및 국부 하중 모델, (3) endpoint·면 법선과 연결된 명시적 interface socket을 우선할 수 있습니다. 내부 구획·장갑·피해 기능은 이번 버전에 구현하지 않았습니다.

V1.5 기록: `qa/QA.md`, `qa/v1.5/gallery-report.json`, `qa/v1.5/regression/report.json`. V0/V1 증거와 screenshot은 `qa/v0/`, `qa/v1/`에 보존합니다.

### V1.8.3 — Seed 7 무장 배치 검토본

`buildWeaponLayoutReview`는 승인된 Aegis / Cruiser / 300m / Seed 7 / MONOLITHIC / WEDGE_CITADEL의 V1.8.2 저장 Blueprint만 입력받는 실험 경로입니다. 일반 주문서 생성기의 기본값을 바꾸지 않습니다. `schemaVersion: 2`, `generatorVersion: "1.8.3"`, 선택적 `weaponLayout`과 `Hardpoint.plannedMountId`를 사용하며, 과거 저장 설계에는 새 규칙을 적용하지 않습니다.

공통 규격은 설치 footprint, 장비 envelope, foundation 높이, 예산 비용을 분리합니다. 300m 기준 S=4.5×5.5m, M=11.5×13m, L=26×30m, XL=45×75m입니다. XL은 기존 선체 통합 척추무장 계약이며 표면 포탑으로 확대하지 않습니다. 규격과 무장 종류는 독립적입니다.

전체 무장 구성 → 중앙선/대칭 그룹/종방향 포대 계획 → 최종 장갑 삼각형 탐색 → 17점 실제 설치 접촉 → 법선 기반 기단 → 정적 사격 여유 검증 순서로 생성합니다. 실패한 대칭 후보는 그룹 전체를 이동하거나 거부합니다. 승인된 29개 장갑 매스, 복부 keel, 채널, 엔진은 그대로 보존합니다. 기존 31개 기단은 원본 데이터를 보존하되 새 검토본에서만 비활성 archive로 처리합니다.

검토용 렌더 생성 (별도 터미널에서 `npm run dev` 실행):

```bash
node tests/weapon-layout-qa.mjs
# 결과를 final-review에 별도로 저장하려면:
WEAPON_OUTPUT=qa/v1.8.3/final-review node tests/weapon-layout-qa.mjs
python3 tests/compose-weapon-layout.py
npx vitest run tests/weapon-layout.test.ts
```

저장된 검토 Blueprint와 전체 시점·규격·대칭·법선 이미지는 `qa/v1.8.3/final-review/`에 있습니다. `qa/v1.8.3/QA.md`에 이전 렌더와의 동일 조건 비교, 성능, 충돌 검사 한계를 기록했습니다. 실제 발사, 조준 애니메이션, 전투 AI, 다른 설계로의 확장은 포함하지 않습니다.

### V1.8.5.3 — Structural Visual Hierarchy & Meso Geometry

The default Requirements-first generator now adds a deterministic, optional Meso structure plan after weapons and existing exterior kits. Eight functional structures provide broad armor terraces, cannon support haunches, open machinery frames, local flank/keel reinforcement and engine-root transitions. Actual station-surface patches form closed attached solids; candidates protect existing weapons, openings, XL spaces and service access. Physical Hull, armor coverage, weapons and requirements remain unchanged.

`version: '1.8.5.2'` retains the prior generator. Historical JSON receives no new structures. Exterior detail OFF keeps major Meso geometry; **Meso Structures** and **Without Meso** debug views compare the new layer without changing the Blueprint. Parts reuse material batching and surface/decal recipes. New geometry is visual structure only, with no simulated armor strength or mass bonus.

- [Meso architecture and safety contract](docs/MESO_STRUCTURE.md)
- [V1.8.5.3 QA evidence and limitations](qa/v1.8.5.3/QA.md)
