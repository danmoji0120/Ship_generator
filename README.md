# Procedural Shipyard V1 — Silhouette & Naval Architecture

기존 V0의 주문서·Seed·Blueprint→Renderer 구조를 확장한 독립 웹 데모입니다. V1은 하나의 Primary Loft를 변형하는 대신 **구조 Volume과 Connector로 군함의 구성 방식을 선택**합니다. 메시 직접 편집, 전투, 내부 구획, 파괴는 구현하지 않습니다.

## 설치 / 실행 / 테스트

Node.js 22.12 이상 권장. 외부 서버와 API 키는 필요 없습니다.

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # V0 회귀 12개 + V1 구조 테스트 9개
npm run build          # 엄격한 TypeScript 검사 + production 빌드
npm run preview        # production 미리보기
```

dev 서버가 실행된 상태에서:

```bash
npm run qa             # 50개 실제 브라우저 생성물, 7개 Debug View, UI 회귀 검증
# 별도 Chromium 설치 경로 또는 서버:
CHROMIUM_PATH=/path/to/chromium QA_URL=http://localhost:5173 npm run qa
```

브라우저 QA는 `playwright-core`와 설치된 Chromium을 사용합니다. 일반 앱 실행에는 별도 브라우저 설치 스크립트나 외부 리소스가 필요하지 않습니다. 기존 발주서, 직접 Seed 입력, Random Seed, Same Seed 재생성, 새 설계, Orbit/Zoom/Fit, JSON Export를 유지합니다. Architecture 선택 UI는 추가하지 않았으며 선택은 주문서와 Seed에 의해 이루어집니다.

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

8개 Primitive(Box, Chamfered Box, Wedge, Hexagonal Prism, Tapered Box, Rounded Box, Short Loft, Long Loft)는 기존 Loft geometry를 재사용합니다. 선수는 pointed, blunt armored, wedge, split nose, spinal muzzle, sensor nose, block nose, tapered industrial로 역할/문법과 연결됩니다. Rounded Box는 낮은 폴리곤 수의 모따기 단면이며 subdivision 곡면은 아닙니다.

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

## V1 Blueprint 계약

`src/blueprint/types.ts`:

- `schemaVersion: 2`, `generatorVersion: "1.0"`.
- `architecture`: 실제/요청 문법, 최대 2개 components, rootVolumeId, nose, engineArchitecture, 선택 가중치, 주요 비율/예산, 선택적 fallbackReason.
- `structuralVolumes`: id, type, purpose, position, rotation, dimensions, primitive + local Stations, connectionIds.
- `structuralConnectors`: id, from/to structure IDs, 실제 접합 표면의 world-space start/end, type, thickness, style.
- `silhouette`: slenderness, 주요 Volume 수, front/side/top 점유율, 대칭도, disconnected penalty.
- 기존 Engines, Hardpoints, SurfaceFeatures, MaterialTheme, Dimensions, Order와 generationStats 유지. V1 Engine에는 후방 방향 `direction`이 기록됩니다.
- Hardpoint/Engine/SurfaceFeature의 parentId는 실제 StructuralVolume ID를 참조합니다.
- `hullSections`는 모든 Volume의 단면 구간을 요약하며, 렌더러는 Volume의 local Stations와 transform을 사용합니다. `secondaryStructures`는 V1에서 비어 있는 이전 호환 필드입니다.

구조 유형: PRIMARY_HULL, HULL_BLOCK, POD, NACELLE, SPINE, ARMOR_BLOCK, DORSAL_STRUCTURE, VENTRAL_STRUCTURE. 연결 유형: DIRECT, TRUSS, BOOM, BRIDGE, NACELLE_MOUNT. 현재 생성 pose는 모두 전후 축에 정렬되어 있고 rotation은 0입니다. 임의 회전 Volume은 검증에서 거부하므로 잘못된 연결 계산을 조용히 허용하지 않습니다.

V0의 데이터 계약은 `LegacyShipBlueprint`로 유지합니다. `generateBlueprintV0(order, seed)`는 V0 알고리즘과 Seed 결과를 보존하고 공용 Renderer/Validator가 schemaVersion 1도 처리합니다. 일반 UI는 V1을 생성하므로 V0 Seed로 V1을 생성한 결과는 의도적으로 다릅니다. 같은 **버전 + Order + Shipyard + Seed**는 Architecture부터 JSON과 geometry까지 완전히 동일합니다.

## Silhouette-first 파이프라인

```text
Order 검증
→ Doctrine + Role + Priorities + Length/Mass 가중치
→ Seed 기반 Architecture 선택
→ Major Volume budget / 기능 구획 배치
→ 실제 접합 표면 Connector + Truss 배치
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

다양성 기록은 4개 Shipyard × 9개 Role × 20 Seeds = 720개입니다. 모든 36개 그룹에서 3개 이상 문법이 선택되었고, 투영/치수 기반 실루엣 signature는 그룹당 최소 14개였습니다. signature는 시각적 품질을 대신하지 않으므로 실제 비교 화면도 함께 검토했습니다.

- `qa/QA.md`: 현재 V1 검증 요약.
- `qa/v1/report.json`: 50개 렌더의 문법·구조 수·치수·삼각형·draw calls.
- `qa/v1/diversity.json`: 20 Seeds 다양성 분포.
- `qa/v1/architecture-comparison.png`, `representatives.png`: 문법/역할 대표 비교.
- `qa/v1/grammar-*.png`: 각 문법의 서로 다른 3 Seeds.
- `qa/v0/`: V0 문서·실행 기록·화면을 그대로 보존.

## 주요 확장 파일

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

약 4,100–11,200 triangles, 100–460 draw calls 범위의 저해상도 생성물을 검증했습니다. draw call 최적화는 남아 있습니다. GPU가 바뀌면 픽셀 안티앨리어싱 결과는 다를 수 있고, 동일 세션의 이미지 재현성만 비교합니다. Three.js 포함 번들 크기 경고는 실행 오류가 아닙니다.

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
