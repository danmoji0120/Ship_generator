# Procedural Shipyard V1.7 — Render QA

기준: GitHub `work`, V1.6 commit `f2b77fa8f34f5f1351971b22d192af010b83a412`. 기준 코드를 fast-forward로 받은 뒤 변경 전 JSON·PNG·카메라를 `before/`에 보관했다. schemaVersion 2와 기존 8 Grammar / 29 Composition / 11 Shape / 10 Join을 유지한다. 검증은 Chromium / ANGLE SwiftShader, canvas 960×620에서 수행했다. 자동 테스트의 최종 결과는 **38 PASS / 0 errors**, TypeScript build PASS이다.

## 실제 렌더링 범위

Forge Cruiser, 기본 주문서, 고정 Architecture, Seed 0–19를 각각 Isometric / Top / Side / Front / Aft로 렌더링했다. Blueprint metadata만 비교한 것이 아니라 실제 WebGL canvas를 캡처하고 각 프레임의 SHA-256과 finite geometry·Draw Call·triangle·카메라 진단을 저장했다.

| Architecture | Seeds | 실제 방향 렌더 | Composition 수 | 검토 이미지 |
| --- | ---: | ---: | ---: | --- |
| MONOLITHIC | 20 | 100 | 3 | [Contact](contact-MONOLITHIC.png) / [5 views](views-MONOLITHIC.png) |
| BLOCK_ASSEMBLY | 20 | 100 | 5 | [Contact](contact-BLOCK_ASSEMBLY.png) / [5 views](views-BLOCK_ASSEMBLY.png) |
| SPINE_AND_MODULES | 20 | 100 | 3 | [Contact](contact-SPINE_AND_MODULES.png) / [5 views](views-SPINE_AND_MODULES.png) |
| TRUSS_POD | 20 | 100 | 3 | [Contact](contact-TRUSS_POD.png) / [5 views](views-TRUSS_POD.png) |
| TWIN_HULL | 20 | 100 | 5 | [Contact](contact-TWIN_HULL.png) / [5 views](views-TWIN_HULL.png) |
| CORE_AND_NACELLES | 20 | 100 | 3 | [Contact](contact-CORE_AND_NACELLES.png) / [5 views](views-CORE_AND_NACELLES.png) |
| STACKED_BLOCKS | 20 | 100 | 3 | [Contact](contact-STACKED_BLOCKS.png) / [5 views](views-STACKED_BLOCKS.png) |
| HYBRID | 20 | 100 | 3 | [Contact](contact-HYBRID.png) / [5 views](views-HYBRID.png) |

동일 BLOCK_ASSEMBLY 주문과 Seed 0–19를 Aegis / Vesper / Forge / Serein에서 비교했다. Forge는 위 20척을 재사용하고 나머지 세 조선소 60척을 추가하여 **220척 × 5 = 1,100개 방향 렌더**를 수행했다. [네 조선소 비교](shipyard-comparison.png), [색상 통일 비교](shipyard-neutral-comparison.png), [Aegis 20](contact-aegis-BLOCK_ASSEMBLY.png), [Vesper 20](contact-vesper-BLOCK_ASSEMBLY.png), [Serein 20](contact-serein-BLOCK_ASSEMBLY.png). 모든 프레임 결과와 실패/대체 사유는 [render-report.json](render-report.json)에 있다. 20 Seed의 서로 다른 Composition은 기존 선택 문법을 보존한 결과이며, V1.7에서 새 Composition이나 무작위 배치를 추가했다는 의미가 아니다.

기존 브라우저 회귀의 50개 생성물, 역할별 여러 Seed, 주문 변경, Random Seed, Same Seed, Orbit drag, wheel Zoom, Fit, JSON Export, 모바일 overflow, **10 Debug View**도 통과했다. [회귀 보고](regression/report.json). Shape 11 / Join 10 / Bow·Stern 20 / Integration·Armor 20 Gallery도 실제 페이지에서 렌더링했다. [Gallery screenshots](bow-gallery-page.png), [Armor page](integration-gallery-page.png).

## V1.6 vs V1.7

각 조선소에서 BLOCK_ASSEMBLY Seed 0, 7, 13을 같은 주문과 **동일한 카메라 position/target/near/far**로 비교했다. `before/manifest.json`에 원래 pose와 기준 commit을 보존했다. [Aegis](before-after-aegis.png) / [Vesper](before-after-vesper.png) / [Forge](before-after-forge.png) / [Serein](before-after-serein.png). 개별 PNG는 `before/`, `after/`에 있다.

V1.6 저장 JSON 12개를 새 Renderer로 읽어 원래 PNG와 정확히 같은 SHA-256임을 확인했다. 동일 브라우저에서 V1.6 versioned generator의 JSON도 원본과 정확히 일치한다. V1.7 각 비교 설계는 10회 재생성하여 **120회 JSON + WebGL pixel 일치**를 확인했다. 최종 후방 마감 수정과 phase 모듈 정리 이후 8 Grammar의 기존 Contact Sheet 이미지와 픽셀을 비교하고, 각각 10회 추가 재생성하여 모두 일치함을 확인했다. 결과는 [final-render-check.json](final-render-check.json). V0 / V1 / V1.5의 과거 실제 Export JSON도 별도로 렌더링했다.

결정성 범위는 같은 실행 엔진·GPU·viewport·카메라다. Node와 Chromium의 일부 `Math.pow` 결과는 마지막 부동소수점 비트가 달라 V1.6 저장 browser JSON의 Node unit 비교만 소수점 10자리로 정규화한다. 같은 실행 환경의 Seed JSON 검사는 정규화 없이 문자열 그대로 비교하며, 브라우저 V1.6 호환 검사는 원본 그대로 비교한다. 서로 다른 GPU의 픽셀 일치를 주장하지 않는다.

## 육안 확인한 변화

- BLOCK_ASSEMBLY: 블록 단차에 Station-fitted collar/transition/shoulder가 추가되고 작은 측면 판의 반복을 연속 flank armor로 대체했다. 특히 Aegis Seed 0/7/13에서 선수와 측면 덩어리가 연결된 장갑 질량처럼 보인다.
- MONOLITHIC: 연속 측면 외피와 역할별 bow cap으로 일체형 정체성을 유지했다. Forge의 둔한 선수는 평평하지만 장갑 테두리가 있는 마감으로 남겼다.
- STACKED_BLOCKS: tier별 외피와 전방 마감으로 상부 구조 단차를 정리한다. 깊게 매립된 연결은 무리한 덮개를 만들지 않고 기존 Join + flank armor를 유지한다.
- SPINE_AND_MODULES: 척추축과 주변 모듈의 구분을 보존하고 연결 노드를 보호한다. 실제 Spinal Gun 역할에서는 열린 muzzle collar가 기존 설치 공간을 보존한다. [대표 역할](regression/spinal-advanced-42.png).
- TRUSS_POD: 연결점만 국소 하우징으로 보호하여 노출 트러스와 의도된 빈 공간을 유지했다. 거대한 외피로 포드를 합치지 않는다.
- TWIN_HULL: 독립 Hull과 bridge의 개방성을 유지하면서 각 선체 전후방을 마감했다.
- CORE_AND_NACELLES: 떨어진 나셀과 지지 프레임을 보존하고 케이싱/접합 보호를 추가했다.
- HYBRID: spine + 외부 모듈의 기존 두 문법을 보존한다. 연결 공간은 노출된 상태이며 임의로 합치지 않는다.

Aegis의 두꺼운 어깨/중첩 장갑, Vesper의 긴 전환/추진부, Forge의 국소 접합과 노출 기계 구조, Serein의 낮고 연속적인 fairing이 동일 Architecture/Seed에서도 구분된다. [선수/선미](bow-stern-gallery.png), [Integration/Armor/Equipment](integration-armor-gallery.png).

검토한 Contact Sheet와 대표 5방향 Gallery에서 독립된 외피, 노즐 출구를 가리는 덮개, 구조 전체를 무의미하게 감싼 외피는 발견하지 않았다. 기존 장비·인접 구획이 방해하는 일부 면에서는 기존 단면 마감을 유지한다. 단면 검사와 장비 예약에 맞지 않는 큰 sleeve는 기록된 사유와 함께 생략하거나 제한된 transition으로 대체되므로 모든 Connector에 full shell이 존재하지는 않는다.

## 발견한 문제와 수정

1. V1.6 일부 클러스터의 nozzle bell이 서로 겹쳐 추가 casing이 이웃 exhaust 예약 영역을 침범했다. Mount 위치/방향/개수는 보존하고 실제 간격에 맞춰 반경만 제한했다. 새 casing은 중심을 막는 cap이 없는 annular wall이다. [동일 Aft 카메라의 오류/수정](errors-and-fixes.png).
2. 큰 axial collar가 side battery 또는 기존 radiator 영역을 침범하는 후보가 있었다. 실제 Station-ring 기반 검사에서 거부한 뒤 좁은 transition 또는 기존 Join으로 fallback했다. 전체 측면 장갑도 thermal reservation을 침범하면 안전한 전방 구간으로 제한했다.
3. 반대 방향 socket의 contact ring 시작점 차이가 외피를 비틀 수 있어 winding을 유지한 cyclic perimeter 정렬을 추가했다. 생성 mesh의 유한 좌표·normal 및 양의 signed volume을 회귀 검사한다.
4. 보수적 전체 bounds가 engine outlet torus의 반경을 누락했다. torus 돌출을 포함하여 수정했고 8 Grammar × 4 yard × 3 seed에서 실제 Three.js 전체 Box3를 포함하는지 검사한다. Auto Fit은 실제 렌더 mesh 기준을 유지한다.
5. Shape/Join fixture에 새 외장 데이터가 남지 않도록 synthetic fixture에서 Prefab/Integration을 명시적으로 비웠다. 과거 Gallery 구조를 새 hull과 섞지 않는다.
6. 마지막 Aft Gallery에서 추진기 없는 Spine/Core의 큰 후방 단면이 별도 보호 마감 없이 남은 것을 발견했다. 엔진 부모 이외의 노출된 rear face에도 실제 Station Ring을 매립한 짧은 장갑 테두리와 cap을 추가했다. 전체 220척/1,100 방향을 같은 조건으로 다시 렌더링했고, 후방 마감·exhaust 보존 회귀 테스트도 추가했다. 수정 전 Overview는 `first-pass/overview-before-unpowered-stern.png`, 수정 후는 [최종 5방향 Overview](overview-five-views.png)에 보존한다.
7. 동시 software WebGL QA와 전체 테스트에서 일괄 회귀 테스트가 시간 제한/RPC 통신 제한을 넘었다. 기능 assertions는 유지하고 worker 수를 2로 제한하며 수천 설계 batch의 예산을 60초로 조정했다. 브라우저 QA 완료 후 최종 전체 테스트를 실행하여 38 PASS, unhandled errors 0을 확인했다.

검증은 moved contact, dangling equipment reference, blocked exhaust, weapon reservation intrusion을 주입하여 반드시 거부하는지도 검사한다. 오류를 느슨한 tolerance로 숨기지 않는다.

## 성능

동일 BLOCK_ASSEMBLY 주문의 각 조선소에서 5회 warm-up 후 Seed 5–24를 V1.6/V1.7 번갈아 생성했다. CPU generation만 측정하며 RAF·PNG 캡처 시간을 포함하지 않는다. GPU는 software renderer이며 실제 모바일 hardware FPS 측정은 아니다.

| 측정 | V1.6 | V1.7 | 변화 |
| --- | ---: | ---: | --- |
| 생성 중앙값 | 1.0 ms | 6.4 ms | 실제 단면 접촉/간섭 검사 추가 |
| 생성 p95 | 2.8 ms | 13.5 ms | 여전히 짧은 응답 |
| 대표 12척 평균 draw call | 216.50 | 238.08 | +10.0% |
| 대표 12척 평균 triangles | 7688.00 | 9194.33 | +19.6% |
| viewer bundle / gzip | 570.22 / 148.84 kB | 591.68 / 155.58 kB | 기존 Three.js 포함 |

220척 전체 Normal 렌더의 최대치는 532 draw calls / 13,572 triangles였다. 연결/armor contour는 4~8점 단면, casing은 16면이며 각각 하나의 Mesh다. 같은 MaterialTheme의 material을 공유하고 texture 또는 고해상도 외부 asset을 추가하지 않았다. draw call은 버전에 따라 -2~+28개 증가했고, 다수 truss 원래 구조의 draw call 비용이 남는다. panel/greeble 시스템은 확장하지 않았다. `stationAt`의 반복 ring 계산을 캐시해 수치 연산 순서는 유지하면서 비용을 줄였다. Vite의 500kB chunk advisory는 V1.6에도 존재하며 build/TypeScript 오류가 아니다.

## 논리 구조와 한계

`PrefabPlacement.exterior`의 부모 IDs, mating Socket, connector/equipment 참조, contour/tube definition, inset, armor class/grade가 권위 데이터다. `hullIntegration`은 reserved zones, acceptance/fallback/omission 사유, 외장 별도 bounds와 전체 bounds를 가진다. Renderer는 저장된 world contour만 메시로 변환하며 설계 판단을 다시 하지 않는다. 장갑 두께/등급은 시각 메타데이터이고 실제 관통/피해 기능은 없다.

- Volume은 기존 축 정렬/무회전 제약을 유지한다. contactPatch는 실제 convex Station polygon을 검사하지만 자유 회전 Hull 또는 concave CSG를 지원하지 않는다.
- 간섭은 정점·모서리·면 샘플과 예약 원기둥 기반이다. 모든 triangle 교차나 완전 watertight boolean union을 보장하지 않는다. 부모에 의도적으로 매립한 연결부·장갑은 overlap을 허용한다.
- 각 볼륨의 기능 표현은 저해상도 housing과 foundation이다. 실제 무장/방열 물리/내부 구조/손상은 없다.
- 동일 문법 내부의 질량 배치와 29 Composition은 그대로다. 이번 변화는 외형 통합에 집중하며, 극적인 신규 실루엣 문법을 추가하지 않았다.
- software WebGL만 측정했으므로 모바일 GPU에서의 지속 FPS/열/메모리 QA는 다음 단계다.

## 재현

```bash
npm install
npm run dev
npm test
npm run build
npm run qa
npm run qa:integration
python3 tests/compose-integration-qa.py # Pillow 설치 필요
node tests/final-render-check.mjs
npm run preview -- --port 4173
node tests/production-smoke.mjs
```

QA shell은 설치된 Chromium을 사용한다. `CHROMIUM_PATH`, `QA_URL`, `INTEGRATION_OUTPUT`, `INTEGRATION_RAW`, `PRODUCTION_URL`로 경로를 바꿀 수 있다. baseline capture는 기존 `before/manifest.json`이 있으면 실행을 거부하여 기준 자료를 덮어쓰지 않는다. 기존 `qa/v0`, `qa/v1`, `qa/v1.5`는 변경하지 않았다.
