# Procedural Shipyard V1.8 — Macro Silhouette QA

2026-10-08 / Node 24.19 / Chromium `/usr/bin/chromium` / ANGLE SwiftShader. 기준 Commit은 `1441dc73a0d9255a9982750c1106016188d94da6`; 시작 시 로컬 HEAD와 원격 work가 일치했고 사용자 변경은 없었다. 기존 QA 폴더를 보존했다.

## 구현과 Blueprint 계약

`schemaVersion: 2`, `generatorVersion: "1.8"`. Architecture는 연결 문법, Macro Family는 큰 질량의 비례·배치다. 8 Architecture, 29 Composition, 11 Shape, 10 Join, Kitbash 및 V1.7 Integration을 유지한다. Macro는 장비 배치와 렌더링 전에 실제 StructuralVolume의 위치·치수·Station envelope를 결정하며 메시 스케일 후처리나 표면 장식이 아니다.

선택적 `macroDesign`: family, architecture, composition, dominant region, primary/fore/mid/aft ratios, spread, structural axis, negative-space targets, module roles/positions/dimensions/shapes, symmetry policy, priority budgets, variant, generationSeed, realized measurements, attempt log. `ShapeDefinition.stationScales`는 기존 loft의 선택적 종방향 envelope다. 과거 Shape는 기존 계산을 그대로 사용한다.

예산은 계획된 실제 Station Ring으로 계산하며 완성된 Volume에서 독립 측정해 일치 여부를 검증한다. 각 단면의 선형 loft 면적을 Simpson 적분하고 요청 길이의 ±1/6을 구역 경계로 사용한다. 부피 m³ / 근사 밀도 t/m³ / 추정 질량 t를 구분한다. V1.8 silhouette hierarchy에도 같은 의미의 구역 부피를 적용했다. 일정 단면 prism의 독립 해석 부피 테스트를 포함한다.

| Family | 실제 주요 구조 변화 / 지원 문법 |
| --- | --- |
| WEDGE_CITADEL | 광폭·낮은 장갑, 전체 폭 분포와 fore/mid peak; Mono/Block/Stack |
| HAMMERHEAD | 지배적인 전방 장갑, 가는 연결부와 작은 후방; Block/Stack |
| SPLIT_FRAME | 복수 질량 중심, 분리 포드·축·트러스·빈 공간; Spine/Truss/Hybrid |
| WIDE_CARRIER | 큰 측면 기능 구획·접근 채널; Block/Twin/Hybrid. 함재기 시뮬레이션 없음 |
| ENGINE_DOMINANT | 큰 후방 machinery / 독립 나셀과 실제 지지 구조; Block/Twin/Core |
| WEAPON_DOMINANT | 무장축·breech·rear support가 전체 폭과 질량을 결정; Mono/Spine/Hybrid |

Mono의 단일 외피, Block의 부분 통합 구획, Spine의 보강 축, Truss의 노출 골조, Twin의 독립 Hull/중앙 구조, Core의 4 나셀, Stack의 3단 성채, Hybrid의 Spine+Truss 연결 정체성을 보존했다. 지원하지 않는 Family 조합은 명시적으로 거부한다. 후보 실패 시 다른 기본형으로 몰래 변경하지 않고 동일 Grammar/Family에서 최대 5회 시도하며 이유를 기록한다.

Aegis는 넓고 두꺼운 전방 장갑, Vesper는 좁은 축·큰 machinery·taper, Forge는 기능 모듈·큰 서비스 간격·노출 골조·제한적 센서 오프셋, Serein은 넓고 낮은 외피를 사용한다. 모든 Priority는 설명 가능한 예산에 반영되며 센서 우선순위는 Truss forebody 등 일부 설계에서 실제 Macro 치수를 바꾼다.

## 실제 표본과 시각 검토

Forge / Cruiser / 300m / Standard / 기본 Priority / **연속 Seed 0–19**, 8 Architecture = 160척. 같은 Block 조건에서 나머지 3 조선소 ×20 = **고유 220척**. 전체 Normal ISO 220장, normalized TOP/SIDE/FRONT/ISOMETRIC 880장, fixed TOP 220장. Seed 0/7/13은 일반 TOP/SIDE/FRONT/AFT도 추가 검사했다. Family 6척, 같은 Family/Seed의 4 Yard, V1.7 과거 40척 및 UI 회귀 50척은 별도 표본이다.

최종 **220/220 첫 후보 통과**, invalid design 0, graph disconnected 0, silent fallback 0. 일반 Contact Sheet 11개와 단색 시점을 검토했다. Block의 전방 해머·후방 machinery·측면 bay·넓은 citadel이 구별된다. Mono는 기존 좁은 반복 Hull에서 광폭 및 rear support 중심의 연속 외곽선으로 분화했다. Truss/Core의 빈 공간을 큰 외피로 덮지 않았고 국소 접합·선수 마감·열린 엔진 출구·mount 기반이 유지됐다.

| Forge Architecture / 20척 | Family 분포 | 평균 TOP pair IoU |
| --- | --- | ---: |
| MONOLITHIC | Wedge 11 / Weapon 9 | .658 |
| BLOCK_ASSEMBLY | Wedge 3 / Hammer 7 / Carrier 4 / Engine 6 | .572 |
| SPINE_AND_MODULES | Split 14 / Weapon 6 | .681 |
| TRUSS_POD | Split 20, 단일 허용 Family | .629 |
| TWIN_HULL | Carrier 13 / Engine 7 | .443 |
| CORE_AND_NACELLES | Engine 20, 단일 허용 Family | .676 |
| STACKED_BLOCKS | Wedge 9 / Hammer 11 | .716 |
| HYBRID | Split 9 / Weapon 2 / Carrier 9 | .654 |

4 Yard의 같은 Block 범위에서 평균 TOP IoU는 Aegis .616 / Vesper .564 / Forge .572 / Serein .655. 같은 HAMMERHEAD/Block/Seed 7의 중립 재질과 검은 Geometry에서도 두꺼운 전방, tapered machinery, clipped industrial head, 낮은 얇은 구조 차이를 확인했다.

## 실루엣 방법 및 V1.7 비교

실제 Three.js Geometry를 unlit black / 흰 배경 / 정사영 / 320×320으로 렌더했다. marker·surface detail·장비 greeble·line overlay를 제거하고 건조된 Hull/Join/armor/propulsion envelope를 유지했다. normalized는 가장 긴 투영축을 맞추며 aspect ratio를 보존한다. fixed는 원점 기준 300m Hull / 495m frame이다. 96px binary mask에서 동일 cutoff로 IoU/contour, aspect, centroid와 convex-envelope 빈 공간을 측정했다. 후자는 개방 채널·concavity를 포함하며 정밀 내부 공간이 아니다.

| 동일 Forge / 20 연속 Seed / 실제 WebGL | V1.7 | V1.8 |
| --- | ---: | ---: |
| MONOLITHIC 평균 TOP IoU | .876 | .658 |
| MONOLITHIC 평균 4방향 IoU | .895 | .753 |
| BLOCK_ASSEMBLY 평균 TOP IoU | .700 | .572 |
| BLOCK_ASSEMBLY 평균 4방향 IoU | .766 | .666 |

IoU 감소는 반복 외곽선이 줄었다는 근거이며 낮을수록 무조건 좋은 설계라는 뜻은 아니다. JSON 수치 차이를 이미지 다양성의 증명으로 사용하지 않았다. 실제 검토 후 **평균 4방향 IoU > .94 AND TOP > .96**을 반복 경고로 사용했다. 테스트 gate가 아닌 advisory다. 잔여 경고는 Mono **15/16**, Stack **9/11**, 총 2쌍(4방향 약 .979). 모든 Seed가 고유한 예술적 설계라고 주장하지 않는다. 일부 Family의 SIDE/FRONT 유사성도 남는다.

## 기술·브라우저 검증

- **자동 테스트 47/47 PASS**: 기존 38개 + Macro 9개. 기존 Order matrix 1296개, 지원 pairing/4 Yard/대표 Seed, 그래프·Shape/Join·캐시·finite normals, 계획 drift, 해석 부피, Priority, 결정성/직렬화 및 bounded failure log 검사.
- TypeScript / production build PASS. 기존 Three.js 때문에 500kB chunk advisory는 있지만 build error는 없다.
- 8 Architecture × 같은 Seed 7 ×10회 = **80회** JSON / Normal PNG / TOP black PNG exact 일치. 같은 브라우저/GPU/viewport/camera 조건이며 다른 GPU의 픽셀 동일성 보장이 아니다.
- V1.7 12 Block + 3 Mono **15개** 기존 JSON을 browser 재생성해 exact 일치, 기존 PNG hash도 exact 일치. Before/After는 동일 주문·Seed·Yard·Architecture와 원래 perspective camera/target/near/far/viewport를 사용했다. Auto Fit 차이로 개선을 가장하지 않았다.
- V0/V1/V1.5/V1.6/V1.7 저장 JSON을 새 Renderer에서 렌더했다. 새 Macro 규칙을 소급 적용하지 않았다. Node/Chromium의 Math.pow 마지막 비트 차이는 단위 baseline 비교에서 소수점 10자리로 비교하고, browser JSON/pixel 검사는 exact다.
- UI 회귀 **50척 PASS**: 주문서, 수동/Random/New/Same Seed, Orbit/Zoom/Fit, 10 Debug View, Inspector/Export. 390×844 모바일 레이아웃 overflow 없음.
- Gallery: 6 Projection **120 thumbnails**, Shape 11, Join 10, Bow/Integration 40. Seed ordering 및 unsupported pairing 오류 표시 PASS.
- Production 앱/Gallery/Export/Debug PASS; 개발 Order hook 노출 없음. 최종 모든 Browser QA에서 **console/page errors 0**.
- 실제 모바일 GPU는 테스트하지 않았다.

## 성능

4 Yard × warm-up 제외 20 Seed, 버전을 번갈아 측정: **각 80 CPU samples**. RAF/PNG 비용은 제외. 대표 draw/triangle 비교는 같은 12 Block 표본이다.

| 측정 | V1.7 (현재 동일 환경) | V1.8 |
| --- | ---: | ---: |
| CPU 중앙값 | 6.80ms | 6.65ms |
| CPU p95 | 15.60ms | 8.10ms |
| 대표 평균 Draw Calls | 238.1 | 235.5 |
| 대표 평균 Triangles | 9,194.3 | 9,263.3 |
| 전체 220척 평균 Draw Calls | 284.0 (기존 archive) | 289.9 |
| 전체 220척 평균 Triangles | 9,586.9 (기존 archive) | 9,798.5 |
| 전체 최대 Draw Calls | 532 (기존 archive) | 590 |

V1.7 최초 기록 6.4/13.5ms와 run-to-run 차이가 있어 보장 수치로 해석하지 않는다. 전체 matrix의 Draw Calls 약 2.1%, Triangles 약 2.2% 증가는 큰 support/외피 분포 변화에 따른 것이다. 최대는 Forge Core/Nacelles **seed 12 / SWEPT_NACELLES**, 590 calls / 14,348 triangles. 대표만 보고 전체 성능이 같다고 주장하지 않는다. 재질 공유·작은 Station 수·최대 4 truss bays를 유지한다. 반복 beam batching이 다음 최적화 대상이다. SwiftShader로 실제 GPU FPS/모바일 속도를 검증했다고 주장하지 않는다.

viewer chunk: V1.7 591.68kB / gzip 155.58kB → V1.8 609.61kB / gzip 161.86kB. 외부 모델/texture 증가 없이 Macro 및 QA 공용 경로가 추가됐다.

## 발견·수정한 문제

1. 전체 폭 ≤ .87×L 제한이 광폭 설계를 막았다. 과거 경로에 보존하고 Macro minimum slenderness는 Carrier .72 / 기타 .8로 정의했다. 실제 광폭·낮은 Hull을 위한 제약이며 기존 폭 상한 1.3×L, 두께·Battleship needle·graph·overlap 제한은 유지한다.
2. 초기 Mono Weapon envelope가 반복적이었다. width expansion 위치·rear support 폭/높이 변형을 추가하고 같은 20 Seed를 재렌더했다. `failures/initial-monolithic-TOP.png`가 초기 증거다.
3. 경량 Truss Corvette의 weapon pod가 engine pod를 침범했다. pod end를 rear module 시작 전에 제한했다. Block Engine도 drive block과 lateral magazine 예약 길이를 분리했다.
4. Hybrid breech/drive의 매립 인터페이스에 Truss가 선택됐다. 직접 machinery interface는 armored collar로 고정하고 외부 Pod는 Truss를 유지했다.
5. 선미 몇 ulp 밖의 query가 전방 interval로 해석돼 엔진이 거부됐다. V1.8 socket을 실제 aft ring 안쪽 **1e-6×L**에 매립했다. 위치/방향은 실질적으로 유지하며 과거 경로를 바꾸지 않았다.
6. Twin central spine이 있는 centerline은 빈 공간이 아니다. 목표 채널을 spine과 독립 Hull 사이로 옮겼다.
7. 계획 길이를 legacy normalization으로 재변형하며 ulp cache drift가 생겼다. 계획에서 extent를 확정하고 V1.8 실현 경로는 재변형하지 않는다.

초기 실패 입력/이유/retry는 `failures/initial-candidates.json`, 최종은 `failures/final-candidates.json`. 최종 220척은 첫 후보 통과지만 bounded-retry 테스트는 첫 3개 후보를 강제로 거부해 동일 Family/Grammar 보존과 로그를 검사한다.

## 자료 / 재실행

- `before/`, `after/`: 15개 실제 JSON/PNG/pose. `comparison-{yard}.png`, `comparison-MONOLITHIC.png`: 동일 물리 카메라 비교.
- `forge-{Architecture}-normal.png`: 8×20 Contact Sheet. `{yard}-BLOCK_ASSEMBLY-normal.png`: 추가 3×20.
- `*-TOP/SIDE/FRONT/ISOMETRIC.png`, `silhouettes/`: 단색 4방향; `*-fixed-TOP.png`: 고정 스케일. `v17-silhouettes/`: 이전 40척.
- `family-*.png`, `families/*.json`: 6 Family Normal/black/MASS. `shipyard-forced-neutral.png`/`shipyard-forced-TOP.png`: 동일 Family/Seed 비교.
- `phase-b/`: 나머지 문법을 확장하기 전에 확인한 초기 Block 4 Family ×3 Seed. 최종 설계와 수치는 위의 220척 Contact Sheet/보고서를 기준으로 한다.
- `bow-stern-gallery.png`, `integration-armor-gallery.png`, `gallery-*.png`: completion·외피·장비·primitive 및 실제 QA UI.
- `render-report.json`, `silhouette-metrics.json`, `pixel-features.json`, `v17-v18-diversity.json`, `performance.json`, `test-report.json`, `gallery-report.json`, `regression/report.json`, `production-smoke.json`: 상세 결과.

```bash
npm install
npm run dev
npm test
npm run build
npm run qa:macro
node tests/macro-legacy-silhouettes.mjs
python3 tests/compose-macro-qa.py # Pillow + NumPy
npm run qa
node tests/macro-gallery-qa.mjs
npm run preview
node tests/production-smoke.mjs
```

Before archive가 존재하면 capture script가 덮어쓰기를 거부한다. 원시 Normal/inspection은 `/tmp/shipyard-v18-images`; Contact Sheet·대표 JSON·실루엣 PNG·보고서는 저장소에 포함한다. 앱 실행에는 Python이나 외부 서버가 필요 없다.

## 남은 한계 / 다음 단계

- 실제 CSG union이 아니며 중첩 부피를 중복 계산한다. AABB overlap은 보수적인 major-volume 검사다. 외피는 기존 Station/face 샘플·예약 cylinder 검사로 모든 triangle 교차를 보장하지 않는다.
- negative-space target은 주요 Volume의 대표 중심점 비침범과 실제 이미지를 검토한다. Target Box 전체에 beam/armor가 들어가지 않음을 증명하는 솔버는 아니다.
- 축 정렬, 근사 질량/지지 조건이며 내부·장갑·피해·함재기 시뮬레이션은 없다. 주요 배치는 좌우 대칭을 우선하지만 단면 bevel/casing variant는 부품별로 다를 수 있다.
- 근접 설계 2쌍과 일부 SIDE/FRONT 유사성, primitive의 예술적 한계가 남는다. panel detail/무장 시스템을 확장해 실루엣 문제를 숨기지 않았다.
- 다음 후보(3개): Macro role/socket을 소비하는 art-directed 주요 prefab; 장비/외피까지 포함한 negative-space corridor 검사; support beam batching과 실제 모바일 GPU profile.
