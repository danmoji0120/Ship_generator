# V1.8.1 — Omnidirectional Geometric Armor / Surface-Mounted Hardpoints

기준: `4078de2b2d1bd41f89a562e61cc504b422c35725` / `work`. 과거 `qa/v1.8/` 파일은 변경하지 않았다. `schemaVersion: 2`, `generatorVersion: "1.8.1"`.

## 구현 및 데이터 계약

- V1.8 생성 결과를 입력으로 사용한다. 220척에서 StructuralVolume, StructuralConnector, MacroDesignPlan와 실측, dimensions/구조 질량, engines, 원래 Integration/Prefab JSON의 정확한 동일성을 확인했다. 새 장갑을 위해 Macro를 변경하지 않았다.
- `layeredArmor.surfaces`: 실제 Station Ring Loft 삼각형, Fore/Aft cap 삼각형, 저장된 Integration/Bow/Stern contour 면. normal·방향·면적·분할 경계·내부 접촉 및 개구부 제외 사유를 보존한다. AABB는 broad phase만 사용한다.
- `assemblies[].segments`: 부모 Structure/Surface/상위 장갑, Layer, root/top polygon, 실제 닫힌 Solid(vertices/indices), 물리적 두께·offset·inset·chamfer·gap, 접촉점, Bounds, 예약 참조. 보호 등급은 두께와 별도 메타데이터이며 실제 피해 계산은 하지 않는다.
- `seams`: Panel/Surface ID, 실제 gap/depth와 HULL 또는 INTEGRATION Underlayer. 외피 사이의 빈 공간 자체가 홈이다. 원래 Hull이 낮은 바닥이며 검은 선이나 Plane으로 홈을 대체하지 않는다.
- `surfaceMount`: 최종 Armor ID/Surface/Socket, 접촉점과 barycentric 좌표, Surface normal/tangent, mount normal, 원래 Hull pose, 실제 8점 Foundation Solid/Bounds/높이/지지 Panel ID, Clearance. 경사진 접촉과 외향 장착 방향은 구분한다.
- 기존 외부 Hull 기반 장갑 및 Weapon/Missile/Sensor 하우징은 `supersededExteriorIds`에 명시해 중복 렌더링을 피한다. 원래 데이터는 보존하고 과거 JSON에는 이 억제를 적용하지 않는다. 기존 Hull Integration은 계속 단면 전환을 담당한다.

## 기하학적 외피

Primary는 노출된 실제 면을 longitudinal / transverse course로 Clip한다. 면 경계에 따라 직사각형·사다리꼴·절두형·육각형·각진 다각형·taper·strip·band가 생성된다. Station의 실제 삼각형이 Authority이며, 긴 판으로 굴곡을 가로지르지 않는다. LARGE/MEDIUM/SMALL 분류와 크기별 면적은 저장된 Segment에서 확인할 수 있다.

모든 판은 매립된 Root → 외부 두께 → 작은 Chamfer → 넓은 평면 Cap의 닫힌 체적이다. Root 경계를 조금 축소해 인접 판 사이에 실제 간격을 만든다. bevel은 좁고 직선 면을 유지한다. Secondary는 Primary 위의 낮고 넓은 부분 중첩이며, 같은 Root에서 Secondary/Reinforcement를 중복 생성하지 않는다. 뿔·핀·상부 거대 쐐기 장식은 생성하지 않는다.

주요 폐쇄형 Hull, Pod, Nacelle, Spine, 기존 장갑 연결 하우징, 선수·선미 contour를 모두 처리한다. 트러스 Beam은 외피 대상이 아니며, Pod 사이의 빈 공간은 유지한다.

## 피복률의 의미

TOP / BOTTOM / PORT(left) / STARBOARD(right) / FORE / AFT를 각각 독립 집계한다. `availableByDirectionM2`는 실제 노출 면에서 내부 접합 면과 기능적 개구부를 제외한 면적이다. `byDirectionM2`는 Primary Root 접촉 면적이며, 두 값의 비율이 피복률이다. Secondary 면적을 합산하지 않는다. 패널 사이의 실제 홈은 비피복 면적으로 남는다.

엔진 배기, Spinal 포구, 방열/기계 개구부, 명시적인 Carrier 측면 접근 예약은 제외 사유·실제 면적·예약 ID를 기록한다. 외부 Hardpoint/Missile/Sensor 설치 계획은 기본 장갑 생략 사유가 아니다. Cap도 동일한 판 생성 경로를 사용한다.

| 방향 | 최소 피복 | 평균 피복 | 최대 피복 |
| --- | ---: | ---: | ---: |
| TOP | 97.955% | 98.138% | 98.979% |
| BOTTOM | 97.954% | 98.138% | 98.979% |
| PORT | 98.010% | 98.190% | 99.003% |
| STARBOARD | 98.010% | 98.190% | 99.003% |
| FORE | 98.010% | 98.190% | 99.003% |
| AFT | 98.010% | 98.190% | 99.003% |

피복률은 면 분류·기하학적 Root 면적의 검증이다. 모든 삼각형의 완전한 가시성 Boolean 결과라고 주장하지 않는다. 부분 접촉은 중심/모서리 샘플과 depth-2 적응 분할로 분류하며, 작은 경계는 보수적으로 제외할 수 있다. 원통 개구부는 두께 여유가 있는 보수적인 8면체로 Clip하므로 실제 원형 개구부보다 넓은 비장갑 테두리가 생길 수 있다.

## Hardpoint — 장갑을 삭제하지 않는 설치

완성된 장갑 Cap을 실제 polygon/plane로 조회한다. 기존 XZ 위치에서 가장 높은 장갑 면을 선택하며, 면이 없으면 가까운 유효한 같은 부모 구역으로 이동한다. 인접 상부 구획을 선택한 경우 부모 변경도 기록한다. 센서/미사일 Placeholder의 외곽을 포함한 보수적인 XZ 설치 footprint를 순서대로 예약한다. 겹치는 후보는 종방향 이동을 먼저 시도하고 가까운 빈 면을 검색한다. 장착 가능한 면이 없으면 명시적으로 실패한다. 장갑판을 삭제하지 않는다.

Foundation의 8점 접촉 Root는 실제 최종 장갑 높이를 샘플링한다. 상부 mount plane은 외향으로 보정하고 충분한 높이로 이웃 높은 deck과 사격 방향의 충돌을 피한다. 여러 Panel 위에 걸칠 수 있으며 아래 Seam 일부만 가려진다. Spinal은 기존 내부 축·포구 계약을 유지한다. 실제 무기 모델과 전 방향 포탑 조준 시스템은 이번 범위가 아니다.

220척의 장갑을 Hardpoint 없는 Blueprint와 비교했을 때 Panel 배열과 피복 데이터가 정확히 같았다. 대표 18척에는 `NO_HARDPOINTS` / `COMPLETE` TOP·ISOMETRIC 실제 WebGL 쌍을 저장했다.

## Family / Architecture / Shipyard

| Family | 적용 결과 |
| --- | --- |
| WEDGE_CITADEL | 광폭 상·하부, 좌우 경사, 선수/선미를 실제 면별로 분할. 상부 독립 돌출 장식 없이 기존 쐐기 질량 유지. |
| HAMMERHEAD | 전방 넓은 구획의 전면·양 측면·상하부를 코팅. 머리 부분의 크기와 연결축 유지. |
| WIDE_CARRIER | 측면 Hull의 상하좌우 및 Cap을 코팅. 명시된 측면 접근 예약과 중앙 Negative Space 유지. |
| ENGINE_DOMINANT | 각각의 추진 하우징/나셀을 독립 코팅. 배기 예약 제외, 나셀 사이를 외피로 연결하지 않음. |
| WEAPON_DOMINANT | 무장축·Breech 구획의 표면을 분할. Spinal 포구와 발사축 유지. |
| SPLIT_FRAME | Pod와 연결 하우징만 코팅. 트러스와 분리 공간은 그대로 노출. |

MONOLITHIC의 연속 외피, BLOCK_ASSEMBLY의 큰 구획, STACKED_BLOCKS의 높이 변화, SPINE_AND_MODULES의 축, TWIN_HULL의 독립 Hull, CORE_AND_NACELLES의 분리 추진부, TRUSS_POD의 골조, HYBRID의 두 문법은 V1.8 구조 그대로 유지했다. 이 버전은 Macro 다양성 개선을 추가로 주장하지 않는다.

| 조선소 | 실제 패널 규칙 |
| --- | --- |
| Aegis | 큰 넓은 구획, 두꺼운 edge, 더 깊은 홈과 낮은 부분 중첩. |
| Vesper | 긴 longitudinal course, 좁은 transverse 구획, 얇은 edge/낮은 적층. |
| Forge | 짧은 산업 course, 정비 구획, 절두형 경계, 기능 개구부와 노출 골조. |
| Serein | 낮고 넓은 구획, 정돈된 분할, 작은 Chamfer/얕은 gap. |

조선소 비교에서는 기존 V1.8 조선소별 Hull 비례도 다르다. Neutral 이미지로 재질 차이를 제거했지만, 모든 차이를 새 장갑만의 효과로 주장하지 않는다.

## 실제 WebGL QA 범위와 자료

- **220개 고유 설계**: Forge의 8 Architecture × 연속 Seed 0–19 =160척, BLOCK_ASSEMBLY의 Aegis/Vesper/Serein ×0–19 =60척. `*-contact.png` 11개에서 모두 육안 검토했다. 전체 표본의 Geometry/참조/피복/예약/결정성 검증과 7방향 Primary 캡처를 수행했다.
- 별도 **18개 강제 Family 대표**: 6 Family의 대응 Architecture × Seed 0,7,13. 같은 Order·Seed·카메라의 V1.8 Before/After, A/B/C/D 7방향, 고정 물리 스케일/Auto Fit, 분리된 3 Layer, Seam 확대 및 Hardpoint 쌍을 저장했다. 대표 표본은 전체 연속 Seed 결과를 대신하지 않는다.
- 220척의 HULL_ONLY / PRIMARY / SECONDARY TOP·SIDE·FRONT 단색 마스크 **1,980개**에서 실제 렌더 Geometry의 IoU를 계산했다. 작은 판 두께에 따른 Macro 보존과 SIDE/FRONT의 추가 입체감을 함께 확인했다. IoU를 미술적 합격 점수로 사용하지 않았다.
- 4 Shipyard, 동일 HAMMERHEAD / BLOCK_ASSEMBLY / Seed 7의 7방향 Neutral 이미지 및 Normal 비교.
- 원래 `qa/v1.8/after/`의 **15개 PNG SHA256**와 저장 JSON을 기존 렌더 경로로 비교했다. 추가로 실제 저장된 V0(schema 1), V1.0, V1.5, V1.6, V1.7 JSON을 렌더링하고 데이터 불변·새 장갑 소급 생성 없음·유한 Geometry를 확인했다. 자동 테스트에는 V0 생성·기존 Architecture/Shape/Join/Integration/Macro 계약을 유지했다.
- 같은 환경에서 8 Architecture × 같은 Seed 10회 = **80회 JSON·Normal WebGL·단색 픽셀 일치**. 이는 Linux Chromium/SwiftShader의 같은 환경 결과이며 다른 GPU의 픽셀 동일성을 보장하지 않는다.
- 최종 전체 메시 Box3 대 저장 Bounds 비교 **220척**. Foundation과 기존 무장 마운트까지 포함한다.

| Family | 표본 수 | Hull→Primary TOP IoU | SIDE IoU | FRONT IoU |
| --- | ---: | ---: | ---: | ---: |
| ENGINE_DOMINANT | 46 | 0.981 | 0.965 | 0.973 |
| HAMMERHEAD | 31 | 0.980 | 0.960 | 0.973 |
| SPLIT_FRAME | 43 | 0.974 | 0.968 | 0.971 |
| WEAPON_DOMINANT | 17 | 0.976 | 0.967 | 0.963 |
| WEDGE_CITADEL | 44 | 0.985 | 0.957 | 0.962 |
| WIDE_CARRIER | 39 | 0.975 | 0.956 | 0.952 |

높은 TOP IoU는 Macro 외곽을 유지하는 이번 버전의 의도와 맞는다. SIDE/FRONT에서 두께·Chamfer가 외곽을 조금 바꾸며, Secondary는 큰 외곽 변화보다 국소적인 실제 단차를 만든다.

자료 경로:

- [7방향 피복](armor-coverage/HAMMERHEAD-7-coverage.png)
- [장갑 진행 — Wedge](armor-progression/WEDGE_CITADEL-7-progression.png)
- [Before/After](before-after/WEDGE_CITADEL-7-comparison.png)
- [실제 Seam 확대](seam-closeups/WEDGE_CITADEL-7-closeup.png)
- [Hardpoint 전후](hardpoint-comparison/WEDGE_CITADEL-7-comparison.png)
- [Neutral 조선소](neutral/comparison-ISOMETRIC.png)
- [Family별 결과](family-comparison/)
- [수치/표본 Manifest](report.json), [실루엣 측정](metrics.json), [성능](performance.json)

A는 Hull 및 필수 연결 구조만, B는 Primary, C는 **B와 동일한 실제 Gap Geometry에서 Underlayer 대비를 강조**한 Seam 검토, D는 전체 장비/Secondary/Foundation을 보여준다. Seam은 Base 생성 시 이미 존재한다. 별도 거짓 선을 추가하는 C 단계가 아니다. Secondary 자체의 단차는 `armor-gallery/*-layers.png`의 Layer 2 및 별도 SECONDARY 실루엣으로 확인한다.

fixed orthographic는 300m 함선에 동일한 450m frame/해상도를 사용한다. fitted progression도 각 단계마다 재조정하지 않고 **동일한 Complete Bounds**를 공유한다. Before/After의 Normal 렌더는 동일한 기존 ShipViewer pose와 물리 스케일을 사용한다.

## 발견한 문제 / 수정

1. 이전 상부 독립 쐐기/좁은 돌출 중심의 접근을 폐기하고 실제 Loft/Cap 전체의 저프로파일 Panel 외피로 전환했다. 기존 V1.8 Geometry는 변경하지 않았다. 초기 잘못된 외형은 `failures/initial-flat-armor.png`에 남겼다.
2. Integration의 비축방향 contour를 단순 Z 범위로 분류하던 노출 판정은 실제 면 plane / 결정적 triangle-ray 방식으로 교체했다. 개구부와 접촉 면을 명시적으로 분리했다.
3. 부분 개구부가 없는 면에서도 불필요하게 subdivide하던 경로를 제거했다. Panel Geometry는 계층별 최대 3개 Mesh로 배칭한다.
4. 경사면 normal만으로 장착 방향을 정했을 때 이웃 높은 deck으로 향할 수 있던 Hardpoint를 최고 장갑 cap 기반의 leveled Foundation으로 수정했다. 장갑은 그대로 유지했다.
5. 하부 QA 조명이 너무 어두워 피복 판단이 어려워 ventral fill을 추가했다. 실제 패널 Geometry와 재질별 차이를 Neutral 7방향으로 확인했다.
6. 확대 시 shadow acne 줄무늬를 발견하여 새 장갑 경로의 bias/normalBias를 함선 스케일에 맞춰 조정했다. `failures/shadow-bias-0.png`와 후속 비교를 남겼다. 과거 Blueprint는 shadow 경로에 참여하지 않아 원래 픽셀을 유지한다.
7. 실제 전체 메시 Bounds 검사에서 4척의 작은 VLS mount가 저장된 높이를 최대 약 0.25m 초과했다. 무장/장갑 Geometry를 변경하지 않고 기존 Placeholder의 고정 높이 계약을 Bounds에 포함시켰다. 전후 기록은 `failures/mount-bounds-before.json` / `regression/render-bounds.json`에 남겼다.
8. QA와 대량 단위 테스트를 동시에 실행하면 한정된 CPU에서 기존 대량 테스트도 timeout이 발생했다. 최종 단위 테스트/성능 측정은 브라우저 대량 작업과 분리했다. Playwright 전달도 거대한 객체 대신 정확한 JSON 문자열로 바꾸었으며 검증 조건은 보존했다.

9. 최종 footprint 검사에서 59쌍 / 33척의 재장착 Mount 겹침을 발견했다. 실제 설치 크기를 예약하는 deterministic packing과 neighbor 검증을 추가하고, 장갑/구조 Geometry는 그대로 보존했다. `failures/mount-footprints-before.json`과 최종 `regression/mount-footprints.json`을 비교한다.

10. STACKED_BLOCKS 10척의 20개 Foundation이 높은 이웃 구획을 가로지르며 과도하게 커지는 사례를 찾았다. 지지점 8개 중 최소 6개의 실제 장갑 접촉과 `max(Length×0.006, Mount radius×0.6)`의 낮은 높이 제한을 적용했다. 조건을 만족하는 다른 면으로 이동하며 기본 장갑을 삭제하지 않는다. `failures/foundation-height-before.json`과 최종 높이 검사를 비교한다.

## 테스트 / 성능

**최종 결과: 자동 테스트 60/60 PASS, TypeScript/Production Build 성공, UI 50개 렌더 설계와 17개 Debug View PASS, Production main/gallery/export PASS, Console 오류 0, 실제 메시 Bounds 220/220 PASS, 설치 footprint 겹침 0, 과도한 Foundation 높이 0.** 98개 설계의 장착점이 추가적인 낮은 설치·접촉 제약으로 재배치됐으며 220개 장갑/매크로 해시는 변경되지 않았다.

최종 자동 테스트, Browser regression, Production smoke 결과는 `test-report.json`, `regression/report.json`, `regression/production-smoke.json`, `regression/final-webgl.json`에 기록한다. 기존 47개 계약 테스트와 새 장갑 13개를 포함한다. UI에서는 Order/Seed/Random/Same Seed/Orbit/Zoom/Fit/Export와 기존·신규 Debug View, 390px viewport를 검사한다. **실제 모바일 GPU는 측정하지 않았다.**

중단된 작업 재개 후 기존 220척 캡처를 보존하여 최종 Coverage, Hardpoint 전후, Before/After 및 Seam 확대 이미지를 다시 검토했다. 전체 60개 테스트와 TypeScript/Production Build를 다시 실행해 통과했고, 새 Production 빌드의 main/gallery/export/debug 검사도 Console 오류 없이 통과했다. 빌드의 500KB 초과 번들 경고는 남아 있다. 기존 `qa/v1.8/` 변경은 없다.

| 측정 | V1.8 동일 환경 | V1.8.1 |
| --- | ---: | ---: |
| 생성 중앙값 | 7.00ms | 111.50ms |
| 생성 p95 | 11.00ms | 166.90ms |
| 평균 Draw Calls | 289.9 | 311.6 |
| 최대 Draw Calls | 590 | 612 |
| 평균 Triangles | 9,798.5 | 47,510.1 |
| 최대 Triangles | 14,348 | 73,754 |

같은 환경/브라우저에서 V1.8와 V1.8.1을 번갈아 80회씩 생성했다. Draw Call/Triangle은 동일한 220개 실제 Normal 렌더를 비교했다. 새로운 장갑은 실제 닫힌 측면/Chamfer를 포함하므로 Polygon과 CPU 비용 증가가 크다. 평균 Draw Call 증가는 Foundation과 최대 3개의 장갑 batch가 주원인이다. 실측 결과를 기존 V1.8 기록과 동일하다고 주장하지 않는다. 5,000 Segment / 200,000 Armor Triangle은 안전 상한이며 목표 생성량이 아니다.

## 재현 명령

```bash
npm install
npm test
npm run build
npm run dev
npm run qa:armor
python3 tests/compose-armor-qa.py
QA_OUTPUT=qa/v1.8.1/regression npm run qa
QA_VERSION=1.8.1 QA_OUTPUT=qa/v1.8.1/regression node tests/production-smoke.mjs
npx vite-node tests/check-armor-bounds.ts
```

Chromium은 `CHROMIUM_PATH` 또는 `/usr/bin/chromium`; 이미지 합성에는 Pillow/NumPy가 필요하다. 대표 및 전체 Blueprint는 `.json.gz`로도 보존한다. `gzip -dc file.json.gz > restored.json`으로 일반 JSON을 복원할 수 있다. exhaustive omission은 각 Blueprint에 있고 요약 Manifest는 사유별 건수만 담는다. `tests/compact-armor-qa.py`는 이번 버전의 큰 JSON만 압축하고 과거 자료를 변경하지 않는다.

## 남은 한계

- 축 정렬 Loft와 저장된 Integration contour만 지원한다. 자유 회전 Hull / 완전 Boolean CSG / 모든 삼각형 쌍의 교차 판정은 하지 않는다. 접촉·예약 간섭의 일부는 샘플 기반이며 아주 작은 경계의 정확한 면적은 근사다.
- 남은 홈·작은 모서리 틈과 보수적인 개구부 테두리는 의도적으로 원래 Underlayer를 보여준다. 모든 surface를 단일 watertight Boolean 외피로 합치지 않는다.
- 기본 패널의 facet 삼각 경계가 일부 큰 측면의 대각선 seam으로 읽힌다. 향후 더 적은 대형 다각형으로 묶을 수 있지만 이번 버전은 부모면 부착의 정확성을 우선했다.
- Foundation은 실제 장갑 cap의 수직 조회를 사용하며 외향 장착을 상부 방향으로 보정한다. 하드포인트를 전방위로 새로 배분하지 않는다. 실제 무기 mesh, 전 방향 조준, 교전 시뮬레이션은 없다.
- 실측 CPU/Polygon/JSON 크기 증가가 있다. 개별 Segment 식별성은 유지하지만 현재는 저장된 Solid가 크다. 향후 deterministic compact polygon 계약·worker 생성·LOD를 우선 검토할 수 있다.
- 실제 모바일 GPU 및 다른 브라우저/GPU 성능·픽셀 결정성은 미검증이다.
