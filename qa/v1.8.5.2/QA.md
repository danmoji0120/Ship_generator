# V1.8.5.2 — Procedural Surface Texture & Decal QA

## 검증 기준과 보존

기준은 실제 V1.8.5.1 Commit `8ead651434213b9ae707729006c711109fc5fc08`이다. 최종 source는 stage된 파일을 별도 작업 폴더에 복제해 검사했다. 기존 사용자 초안, 미커밋 장갑 실험과 이전 QA는 변경하거나 삭제하지 않았다. 이전 QA를 쓰는 자동 테스트는 이 복제본에서 실행하여 원래 자료를 보존했다.

신규 단계는 `generatorVersion`과 `materialAppearance`만 쓴다. 동일 주문·Seed의 나머지 Blueprint JSON 전체가 V1.8.5.1과 일치해야 한다. 이는 Hull, 장갑, Connector, 무장, XL, Requirements, 외장 Kit, 개구부와 예약 구역의 불변성을 함께 확인한다. 표면 마감·Debug·OFF/LOW/HIGH/AUTO는 렌더링 설정이며 JSON을 재설계하지 않는다.

## 실제 구현

- 기존 다섯 Material Role과 일곱 Emissive Role을 유지하고, 도장/금속의 Albedo·Roughness·작은 derivative Normal 변화와 구획별 Tone을 추가했다.
- 미터 기반 object-local triplanar 좌표를 사용한다. 40m와 600m에서 같은 조선소의 도장 입자 주기를 확대하지 않는다.
- 공유 128² 선형 데이터 타일과 결정적인 512폭 문자/표식 atlas를 사용한다. Bitmap과 GPU Buffer는 JSON에 저장하지 않는다.
- 함번, 구획 번호, 조선소 기하학 심볼, 기존 정비 설비의 서비스 코드와 미사일 서비스 경고를 실제 부모 면에 제한적으로 배치한다.
- 아홉 실제 부모 삼각형 접촉과 최종 Solid의 보수적인 투영 점유 검사, 무장 Bounds/기능 예약을 함께 사용한다. 정밀 QA는 전체 삼각형 장면으로 접촉을 다시 확인한다.
- 기존 표면 패턴/상태등은 그대로 유지한다. 새 메시, 홈, 광원, 해치나 중복 상태등을 만들지 않는다.
- CLEAN 기본, SERVICE/WEATHERED 선택적 표시. 매 프레임 텍스처를 만들지 않으며 동시 함선 인스턴스는 같은 자산을 공유한다.

구체적 데이터 계약, Role/Kit 매핑, 조선소별 계수와 필터링은 [설계 문서](../../docs/surface-texture-v1.8.5.2.md)에 기록했다.

## 시각 검토 자료

최종 캡처는 동일한 주문·Seed·카메라·조명·물리 화면 범위에서 비교한다. Before는 새 렌더러의 임의 이전 외관이 아니라 명시적 V1.8.5.1 계약이다. 과거 Commit 렌더러와의 실제 픽셀 대조는 별도로 수행했다.

- [동일 함선 Before/After](images/before-after.jpg), [8개 시점](images/eight-views.jpg)
- [함교/정비/기관/무장 확대](images/closeups.jpg), [함교 창](images/bridge-window.jpg)
- [측면 함번 확대](images/identification.jpg), [장갑 표면 확대](images/texture-armor.jpg)
- [4개 조선소 전체](images/shipyard-ships.jpg), [조선소별 확대](images/shipyards.jpg)
- [6개 Macro Family](images/families.jpg), [40/120/300/600m](images/lengths.jpg)
- [OFF/LOW/HIGH/AUTO](images/lod.jpg), [밝은 검사/우주/측면광](images/environment.jpg)
- [Texture/Decal Debug](images/debug.jpg), [CLEAN/SERVICE/WEATHERED](images/finish.jpg)

전체 캡처의 판정/카메라/Draw Call/Triangle 기록은 [최종 캡처 요약](rendering/summary.json)에 있다. 중간 실패 자료와 원본 PNG는 로컬에 보존하고, Git에는 대표 비교 시트와 압축된 증거를 선별한다.

## 발견한 문제와 수정

1. 초기 함번의 대비가 약했다. 밝은 장갑의 식별 잉크를 어두운 해군 도장색으로 분리했다.
2. 좌현 문자가 뒤집혀 보였다. 실제 현측 법선에서 위 방향을 유지하는 접선/bitangent를 정리했다.
3. 짧은 구획 코드가 좁게 압축됐다. 고정 glyph atlas와 물리적 문자열 비율을 맞췄다.
4. 작은 부품의 하부 Seat나 덮인 면에 문자가 들어갈 수 있었다. 기존 Inset/Core를 우선하고, 얇은 레일도 놓치지 않는 전체 footprint 점유 검사를 추가했다.
5. 초기 계획 비용 중앙값 386.6ms, 전체 생성 증가 약 42%였다. 최종 Solid 투영 구간 캐싱과 실제 부모 표면 query 재사용으로 접촉 검사를 유지하면서 반복 계산을 줄였다. 단일 Seed 7 profile은 103.1ms, 전체 장면 재검사에서 잘못된 접촉 0건이었다.
6. QA 서버가 누적 이미지 file-watch 한도에 도달했다. 원본 QA를 삭제하지 않고 검증 서버에서 QA 이미지 감시만 제외했다. 이것은 제품 소스나 기능 변경이 아니다.

## 의도적 한계

- 전체 함선 시점에서 미세 질감 변화는 제한적이다. 주요 변화는 구획 Tone과 식별 마킹이며, 금속 입자/서비스 코드는 확대 시 읽힌다. 이를 Full PBR 텍스처 품질이라고 주장하지 않는다.
- 문자 체계는 프로젝트 내부 5×7 block/stencil glyph다. 아주 가까이에서는 격자형 획이 보인다.
- 넓은 단일 평면이 없거나 설비가 가리는 면은 선택적 마킹을 생략한다. 숫자를 넣기 위해 장갑/무장을 옮기지 않는다.
- 보수적 footprint 검사와 접촉 샘플은 완전한 곡면 투영/CSG/모든 Triangle 교차 증명이 아니다.
- SERVICE/WEATHERED는 실제 모서리 곡률 기반 마모나 전투 손상이 아니라, 지정된 접근/접합/기관 구획의 제한적인 표면 표현이다.
- Bloom과 다수 Point Light는 도입하지 않았다. 기존 ACES/HDR 및 native emissive를 우주/검사 조명에서 검토했다. Bloom ON 비교나 동적 전투 발광을 구현했다고 보고하지 않는다.
- Texture/Geometry byte 수는 소유한 배열/포맷의 산술 집계이다. 드라이버 상주 GPU 메모리나 실제 모바일 GPU 성능으로 환산하지 않는다.

## 과거 Blueprint 재생 결과

실제 기준 Commit 렌더러와 최종 렌더러에서 **12개 버전 × 5개 시점 = 60개 역사적 결과**를 대조했다. 모든 픽셀과 각 JSON 재로드 픽셀이 완전히 일치했고, 양쪽 Console 오류는 0건이었다. V0/V1/V1.5/V1.7/V1.8/V1.8.1/V1.8.2/V1.8.3/V1.8.4.1/V1.8.4.2/V1.8.5/V1.8.5.1을 포함한다. 저장된 구형 Blueprint에는 새로운 텍스처나 마킹이 소급 적용되지 않는다.

[뷰별 SHA-256 및 판정](history/report.json)

## 출고/거절 불변성

최종 V1.8.5.2 기본 생성 경로에서 실행한 222개 통제 실험은 **200개 출고 / 22개 명시적 거절**을 유지했다. 실제 V1.8.5.1 검증 기록과 입력, 필수 판정, 무장 규격/방향 예산, 원장, 조정 사유, 후보 거절 코드를 전부 대조했고 일치했다. 비교에서 제외한 값은 측정 시간 `ms`와 `timings`뿐이다. 선택적인 표면 마킹 때문에 출고 가능한 함선이 거절된 사례는 없었다.

[정본/요구사항 비교 결과](requirements-regression.json)

## 실제 Production UI

최종 Production Build(개발 QA hook 없음)에서 **20개 검증 항목 통과, Console 오류 0건**을 확인했다. 새 Seed와 Regenerate, 전체 Production Debug, Surface Texture/Decal Debug, CLEAN/SERVICE/WEATHERED, OFF/LOW/HIGH/AUTO, 실제 파일 Export/Import, 저장 재로드의 픽셀 일치, Orbit/Zoom/Fit, 필수 XL 주문의 설치/거절, 구형 Blueprint Import를 포함한다. 390px 화면 검사는 반응형 레이아웃 검사이며 모바일 GPU 성능 검사가 아니다.

[UI 항목별 결과](ui/report.json)

## 자동 검사 및 Build

최종 고정 소스의 **23개 파일 / 677개 테스트 전체 PASS**. 기존 663개 검사와 신규 표면 전용 14개 검사를 포함한다. 전체 실행 910.84초, 두 worker 사용. 1,296개 기존 V0 설계 공간 불변성 검사, 장갑/접합, 구조 파일럿, 무장/XL, Production, 교리, 외장 Kit 및 요구사항 검사를 보존했다. TypeScript 및 Production Build 모두 성공했다. Vite의 기존 500kB 초과 번들 안내는 남아 있으며 오류는 아니다(최종 viewer 836.71kB, gzip 234.93kB).

[파일별 테스트 결과](automated-tests.json), [고정 소스 SHA-256 및 초안 보존](source-provenance.json)

## 확대된 표면 부착 검사

8개 Architecture 후보, 9개 Role, 4개 Shipyard, 40/120/300/600m 및 여러 Seed를 포함한 **25개 추가 조건**을 검사했다. 최종 장갑/설비/Kit 전체 Triangle 장면에서 저장된 **2,394개 접촉**을 독립적으로 재확인했다. 숨겨진 면/떠 있는 마킹 0건, Geometry·Requirements 검사 오류 0건, 구조 JSON 변화 0건이며, 각각의 Seed 재생이 결정적이었다.

[조건별 표면/생략/부착 결과](matrix/report.json)

## 텍스처 고정 및 리소스

함선과 카메라를 함께 0.63rad 회전하고 `(17,-9,27)m` 이동시킨 실제 WebGL 검사에서 **모든 픽셀이 정확히 일치**했다(평균/최대 채널 차이 0). 회전에 불변인 Ambient 검사 조명을 사용하여 그림자 재투영 차이를 분리했다. 이는 object-local 패턴이 선체를 따라 이동함을 확인하는 제한된 정적 렌더 검증이다.

[이동·회전 결과](transform/report.json)

대표 13개 조건에서 신규 HAZARD 문자 채택은 0건이었다. 미사일 서비스 덮개의 읽을 수 있는 면이 셀/장비 예약에 가려져 후보를 생략했다. 기존 위험 경고선과 발광은 유지했다. HAZARD 분류·문자 atlas 지원은 구현했지만, 이 자료로 새 미사일 경고 문자의 시각적 효과를 입증했다고 주장하지 않는다.

## 성능 — 최종 측정

동일 Chromium/SwiftShader, 600px WebGL rig에서 보존 V1.8.5.1 경로와 최종 기본 생성기를 번갈아 실행했다. 두 번 warm-up 후 10개 CPU 표본을 집계했다. 실제 모바일/물리 GPU 보장 수치가 아니다.

| 항목 | V1.8.5.1 | V1.8.5.2 |
|---|---:|---:|
| 생성 중앙값 / p95 | 1,106.4 / 1,212.2ms | 1,135.9 / 1,249.9ms |
| Mesh 구성 중앙값 / p95 | 28.1 / 38.8ms | 43.9 / 53.7ms |
| 표면 계획 중앙값 / p95 | 없음 | 78.4 / 117.7ms |
| HIGH 검사 Draw Calls / Triangles | 22 / 18,034 | 동일 |
| Main pass(line 포함) | 23 calls / 18,034 triangles | 동일 |
| 최초 Shadow pass | 13 calls / 17,078 triangles | 동일 |
| Geometry 속성/index 소유 배열 | 3,158,432 bytes | 5,234,672 bytes |
| 새 grain/atlas 포맷+Mip 집계 | 없음 | 1,485,483 bytes |
| 캐시 shadow의 프레임+readback 중앙값 | 95.5ms | 172.8ms (반복 context 159.6ms) |
| compileAsync wall | 20.0ms | 25.3ms (반복 18.6ms) |
| 최초 프레임+readback wall | 525.0ms | 2,510.5ms (반복 3,337.9ms) |

최종 CPU 생성 중앙값 증가는 약 **2.7%**였으며 다른 실행에서는 0.8~9.5% 범위였다. 모든 표시 모드의 Draw Call/Triangle은 그대로다: OFF 14/11,386; LOW 18/16,694; HIGH 22/18,034; AUTO 18/16,694.

GPU query extension은 노출됐지만 유효한 timer 결과를 얻지 못했다. `frameSubmitWallMs`는 명령 제출 시간이며 GPU Frame Time이 아니다. 프레임+readback은 CPU/드라이버/복사/소프트웨어 렌더링을 함께 포함한다. 최초 프레임 값에는 앞선 context/command queue 지연도 섞이므로 순수 GPU 비용으로 해석하지 않는다. 다른 실행에서 콜드 compile wall 약 1.95초도 관측했다.

초기 무조건 샘플링 셰이더의 프레임+readback 중앙값은 308.6ms였다. sub-pixel grain/가독성 없는 atlas 조회를 건너뛰고 명시적 gradient, varying packing과 불필요한 bump 연산 생략을 적용해 최종 172.8ms로 줄였다. **소프트웨어 렌더링 비용은 여전히 기준보다 높다.** 하드웨어 GPU fragment 비용과 모바일 성능은 실기 검증이 필요하다.

반복 다섯 번 Mesh 재로드에서 geometry/texture 객체 수는 일정했다. 검사 함선 해제 후 해당 geometry는 0, 새 텍스처는 해제됐고 소유 캐시는 초기 참조 수준으로 돌아왔다. 남은 1개 texture는 rig shadow map이며 renderer dispose 때 해제한다. 소유 배열/포맷 byte 집계는 드라이버 상주 GPU 메모리 측정이 아니다.

[전체 표본 및 객체/캐시 수](performance/report.json), [수정 전후 비용](performance/optimization.json)
