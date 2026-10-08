# V1.8.2 — 승인된 구조 방향 보완 / 세 Family 제한 검증

## 범위와 판정

사용자가 승인한 Seed 7의 구조 방향을 보완한 후 대표 세 Family에만 적용했다. **220척, 다른 Seed, 다른 Shipyard 및 네 Armor Language의 대량 전개는 실행하지 않았다.** 기존 타일 기반 초안과 실패 분석 자료, V1.8/V1.8.1 QA 및 최초 제출 이미지는 보존했다. 이 문서는 V1.8.2 전체 출시 완료 보고서가 아니다.

모든 표본은 Aegis / Cruiser / Standard / 300m / Seed 7, 동일 DEFAULT_ORDER 우선순위다. QA로 Architecture와 Macro Family만 지정한다.

| Family / Architecture | 대형 구조 | 연결부 | 채널 최소 폭 / 깊이 | Foundation 최대 실제 높이 |
|---|---:|---:|---|---:|
| WEDGE_CITADEL / MONOLITHIC | 22 | 2 | 16.045m / 12.045m | 1.768m |
| HAMMERHEAD / BLOCK_ASSEMBLY | 13 | 2 | 21.485m / 12.000m | 2.106m |
| ENGINE_DOMINANT / CORE_AND_NACELLES | 19 | 기존 StructuralConnector 유지 | 포드별 약 7.20–8.82m / 7.46–9.00m | 1.789m |

## Seed 7의 조형 보완

- 선수 축 장갑 → 중앙 상승 장갑 → 상부 기단을 연결하는 두 개의 넓은 경사 Neck을 추가했다. 연결 대상 양쪽과 Neck 안에 실제로 포함되는 접촉점을 저장·검사한다.
- 상부 기단과 Plinth의 폭·높이가 전후로 변한다. 앞쪽 플레어, 경사진 면, 좁아지는 후단으로 단순한 상자 형태를 줄였다.
- 측면 Belt 상단의 높이를 전후로 변화시켰다. 중앙 Haunch가 상부 Shoulder와 측면 Belt 사이의 큰 연결 질량을 만든다.
- 후방은 좌우 분리된 보호 Housing으로 마감한다. 원래 엔진·방열기를 유지하며 배기 공간을 검사했다.
- 기존 StructuralVolume, Connector, Macro Plan/실측, 엔진, 기존 Prefab/Integration 데이터와 구조 질량은 그대로다. 추가 외장 Bounds는 별도로 기록한다.

## 제한적 일반화

HAMMERHEAD는 전방 중앙 성채와 양쪽 경사 Shoulder를 큰 보호 구획으로 유지하고 중앙 Saddle, 상부 Cap, 후방 Reactor Housing을 Neck으로 잇는다. 기존 측면 Magazine에는 낮고 넓은 Casemate를 적용한다. 큰 전방 평면 Cap과 둔중한 기본 Macro는 이번 단계에서 변경하지 않았다.

ENGINE_DOMINANT는 각 분리 Nacelle에 좌우 두 개의 길고 넓은 보호 Bank, 그 사이의 열린 정비 채널과 국소 Side Belt를 만든다. 이들은 각 포드의 실제 월드 좌표 Station Ring에 부착된다. 중앙 Core는 낮은 선수 보호부와 높이가 다른 Command Saddle/Cap을 가진다. 나셀 사이를 새 장갑으로 연결하지 않아 기존 Negative Space와 Connector 문법이 남는다.

공통 `armorBodyBuilder`, 실제 삼각형 `surfaceHit`, 채널 단면 `sectionEdges`, 접촉 Foundation 생성과 검증을 재사용한다. 별도 렌더링 프리셋이나 타일 수·색상 변경으로 차이를 만들지 않았다.

## Blueprint와 검증

선택적 `structuralArmorPilot`은 `schemaVersion: 2`, `generatorVersion: 1.8.2`의 QA 검토 데이터를 보존한다.

- Component: 역할, Hull/Armor 부모, 다중 접촉 부모, 실제 Ring/닫힌 Solid, 접촉 샘플, Inset, Bounds.
- Joint: 큰 장갑 두 개 및 Neck 참조, 실제 공유 체적의 접촉점.
- Channel: 부모 포드, 양쪽 Bank, 실제 원래 Hull 바닥 샘플 및 폭/깊이 실측.
- Mount: 원래 Hardpoint 위치, 장갑 부모, 8점 접촉, 닫힌 Foundation, **Geometry 최대 높이**, 재배치 사유.

모든 설계에서 Hardpoint 31개, 종류·반경·발사 법선과 원래 ID를 유지했다. 장갑을 삭제하지 않고 안정적인 면으로 X/Z 위치를 조정한다. Mount 높이 상한은 `max(length × 0.006, mountRadius × 0.6)`이며 실제 전체 Foundation Geometry 높이로 검사한다. 착좌 footprint보다 넓은 실제 무장·미사일·센서 예약도 배치 후보마다 검사한다.

검사 항목: 부모 참조/순환, 실제 Station Root 및 부모 장갑 접촉, Joint 체적 접촉, 닫힌 manifold edge, 0면적 Triangle/역방향 부피, 유한 정점/단위 Normal, 정확한 새 외장 Bounds, 열린 채널, 낮은 Foundation/인접 간격, 배기·방열·무장·센서 예약. 기존 소켓과 Integration 원본은 변경하지 않는다.

## 발견한 문제와 수정

1. 길이·폭을 적용한 새 포드에서 기존 채널 위치 상수가 실제 Bank 밖으로 벗어났다. 저장된 삼각형을 Z 단면과 교차하여 실제 두 Bank 가장자리와 바닥으로 폭/깊이를 측정한다.
2. Magazine 전방 끝의 Mount footprint가 Casemate 경계를 넘었다. 해당 보호 구획의 전방 연결 범위만 조정했다.
3. 부동소수점 계산으로 동일한 Z 단면이 아주 작은 간격으로 두 번 생성되어 0면적 Triangle을 만들었다. 함선 길이에 비례한 수치 정밀도로 중복 Station을 합친다.
4. 경사면과 단차를 가로지르는 Foundation은 높이 메타데이터가 낮아도 실제로 3–9m에 달했다. 명령 기단에 기능적인 넓은 착좌 구역을 마련하고, 주변 장갑을 삭제하지 않는 결정적 X/Z 후보 탐색으로 낮은 장착면을 찾는다. 높이를 실제 Geometry로 기록하고 허위 높이도 검출한다.
5. Mount footprint가 닿지 않아도 더 넓은 발사 예약이 높은 Command Cap과 충돌했다. 후보 선택 단계에 실제 장비 Envelope의 상호 샘플 검사를 추가했다. 최종 세 표본의 해당 간섭은 0이다.
6. 첫 Family 공통 ISO 프레임에서 넓은 선체가 잘렸다. 모든 Family와 Before/After를 같은 480m Orthographic Frame으로 다시 캡처했다. Seed 7 승인 시안 비교는 원래 360m 프레임을 그대로 유지한다.

수정 중 캡처 폴더는 덮어쓰지 않고 iteration별로 보존했다. 완성 증거는 아래 `final-review/` 및 `refinement-02/`다.

## 이미지 / 실제 렌더링

모든 이미지는 Chromium / SwiftShader의 실제 Three.js Geometry 렌더다. 같은 중립 재질, 조명, 투영, 스케일을 양쪽에 적용한다. 모든 Line과 procedural panel shader를 숨겼으며 얇은 패널 Geometry와 surface detail은 없다. 구조 비교에서는 Hardpoint와 Foundation도 숨긴다. 기존 엔진·방열기는 공간 관계 확인을 위해 남긴다.

- [Seed 7 승인 시안 → 보완본 / TOP, SIDE, ISOMETRIC](structural-pilot/refinement-02/approved-vs-refined.png): 같은 360m 프레임. 위가 승인된 기존 구조, 아래가 보완 구조.
- [Seed 7 보완본 3방향](structural-pilot/refinement-02/three-views.png).
- [세 Family / TOP, SIDE, ISOMETRIC](limited-families/final-review/family-three-views.png): 모두 같은 480m 프레임.
- [같은 구조의 Hardpoint 전후](limited-families/final-review/mount-comparison.png): 외피 Geometry를 삭제하거나 변경하지 않고 Mount만 표시한다.
- Family별 `before-after.png`, `baseline/structure/mounted-TOP/SIDE/ISOMETRIC.png`, `blueprint.json`, `report.json`은 `limited-families/final-review/<FAMILY>/`에 있다.

## 테스트 결과

- 기존 한 척 구조 테스트: **10/10 PASS**.
- 새 제한 Family 테스트: **7/7 PASS**. 원본 불변/결정성, 범위 거부, Neck/분리 Pod, 낮은 실제 Foundation, 잘못된 높이·부모 순환·접촉 손상 검출, 패널 없는 실제 Geometry/Bounds, 저장 V1.8.1 세 JSON 불변/소급 미적용.
- 필요한 과거 회귀 한 항목: **1/1 PASS**. 저장 V0/V1/V1.5 렌더링. 같은 파일의 다른 7항목은 이번 제한 검증에서 실행하지 않았다. 합계 **18개 관련 테스트 PASS**이며 전체 테스트 실행을 의미하지 않는다.
- `npm run build`: TypeScript와 Production Build PASS. 기존 500kB Three.js chunk 경고는 남는다.
- 세 대표 설계 **27개 최종 렌더**: V1.8.1 패널 없는 원본 / 대형 구조만 / Mount 포함 × TOP/SIDE/ISO. Console error **0**, 생성 JSON 결정성 **3/3**, 저장 JSON 새 객체 재렌더 WebGL PNG 동일 **3/3**.
- 승인된 Seed 7의 별도 360m 비교: **9개 렌더**, Console error 0, JSON/저장본 픽셀 동일.
- 전방위 신규 피복, 다른 체급·조선소·Seed, 전체 220척 및 전체 회귀의 성공을 이 결과로 주장하지 않는다.
- Commit에 포함할 파일만 별도 경로로 Export하여 Build와 관련 테스트를 확인했다. 이 분리본을 다른 dev 포트에서 실제 렌더링했으며 세 Blueprint JSON과 27개 PNG가 작업본의 최종 증거와 byte-for-byte 일치했다 (`final-review/commit-verification.json`). 따라서 기존 타일 초안을 Commit에 포함하지 않아도 결과를 재현한다.

```bash
npx vitest run tests/structural-armor-pilot.test.ts tests/structural-armor-limited.test.ts
npx vitest run tests/integration.test.ts -t 'renders archived V0'
npm run build
# dev 서버 실행 중, 세 표본만 다시 캡처 (기존 증거 보호용 새 폴더)
LIMITED_OUTPUT=qa/v1.8.2/limited-families/local-review node tests/structural-armor-limited.mjs
```

## 성능과 남은 한계

공통 480m ISO / Neutral / Shadow rig에서 최종 Mount 포함 호출/삼각형: WEDGE **198 / 8,500**, HAMMERHEAD **201 / 8,916**, ENGINE **230 / 10,692**. 이 값에는 그림자 패스가 포함되어 다른 버전의 일반 렌더 평균과 직접 비교하지 않는다.

동일 브라우저에서 원본 생성 이후 새 구조 Builder+Validation만 3회 반복한 중앙값은 각각 약 **499ms / 347ms / 313ms**다 (`cpu-samples.json`). 세 고정 표본의 개발용 측정이며 p95나 일반적인 게임 성능은 아니다. 삼각형 기반 후보/예약 검사가 느려, 일반 생성기 배포 전에 spatial index 또는 재사용으로 검증 비용을 낮춰야 한다. 실제 모바일 GPU는 측정하지 않았다.

채널 바닥은 보존한 기존 Hull이며 Boolean으로 내부를 파낸 결과가 아니다. 충돌은 실제 삼각형 부착 검사와 상호 원통 샘플 검사이며 모든 Triangle 교차를 증명하지 않는다. 원래 광폭 선수 Cap 및 일부 긴 하부 측면은 아직 단순하다. 실제 함교/무기/정비 기계 에셋, 내부 공간, 강도·방호·질량 재계산은 구현하지 않았다. 고정된 축 정렬 제약을 유지한다.

새 Geometry는 **세 고정 QA 조건에서만** 검증되었다. 일반 생성 경로의 이전 타일 초안과 보존된 대량 QA는 이 구조 방향의 배포 증거로 사용하지 않는다. 기존 로컬 초안 변경은 보존하고, 검증된 제한 구조 시안만 별도 진행 Commit으로 분리한다. 전체 변경을 묶은 V1.8.2 출시 Commit은 아니다. 공유 생성 파일도 동결 V1.8.1 참조 함수만 포함하며 거부된 타일 초안의 자동 전개를 포함하지 않는다.
