# STACKED_BLOCKS Structural Form Refinement

현재 Production 경로의 STACKED_BLOCKS Macro만 변경한다. 기존 세 Structural Volume 역할(`armored-keel`, `magazine-deck`, `command-deck`), 연결 그래프와 장갑/엔진/하드포인트 생성 시스템은 유지한다. 저장 Blueprint는 재생성하지 않는다. 명시적인 frozen V1.8 생성에서는 기존 recipe를 사용한다.

## 원인과 생성 규칙

기존 중층의 높이는 주 선체와 같고, 길이는 최대 주 선체의 70%였다. HAMMERHEAD의 중층 위치가 선수에 고정되고 좁은 후방 주 선체에는 볼륨이 부족했다. CHAMFERED_BOX의 기본 station은 작은 frontScale이 실제 전면 축소로 이어지지 않아 큰 평면 끝판을 만들었다. 장식이나 조명으로 이 문제를 가리지 않는다.

새 Macro refinement는 다음을 수행한다.

- 중층 폭 약 61–74%, 높이 70–78%, 길이 48–60%로 제한한다. 상층도 중층보다 폭·높이·길이가 모두 작아진다. LOW_TERRACES의 기존 공통 높이 변환은 유지한다.
- 실제 station의 폭과 높이를 앞에서 뒤까지 변화시킨다. 큰 경사 모서리와 축소된 끝 단면은 렌더링·접촉·충돌에 같은 Geometry로 전달된다.
- HAMMERHEAD의 전방 어깨와 기존 선수 볼륨 최소 기준을 보존하면서 후방을 보강한다. WEDGE_CITADEL은 연속적인 길이 방향 폭 분포를 유지한다.
- 다섯 위치 후보를 평가한다. 실제 부모 폭, 겹침을 제거한 전체 볼륨 중심, composition의 위치 의도, HAMMERHEAD의 기존 `foreMassRatio` 기준을 함께 사용한다.
- 실제 부모 표면에 17% 높이 겹침을 두고 층을 앉힌다. 기존 연결·장갑·엔진·장착 생성 단계가 수정된 구조로 다시 계산된다.
- 조선소별 폭·높이·경사 크기, seed variant, composition, 주문서 endurance의 위치 차이를 유지한다. 추가 난수를 소비하지 않는다.

`stacked-measurement.ts`는 실제 station 다각형의 수평 구간을 합쳐 중복 겹침을 제거한 기하학적 union 체적과 전후 중심을 적분한다. 후보 탐색은 24×16, QA는 64×32 샘플을 사용한다. 이는 정확한 CSG 또는 물리 질량 모델이 아니다. 기존 Macro의 개별 체적·밀도 추정 계약은 변경하지 않는다. 좌표 표시는 선수 0, 선미 1로 정규화한다.

## 실패와 한계

초기 시도는 HAMMERHEAD의 기존 선수 볼륨 기준을 위반했고, 낮고 넓은 정면 때문에 일부 occupancy 지표도 악화됐다. 두 번째 시도의 육각 단면은 collinear subdivision 때문에 기존 장갑 cap triangulation의 퇴화 삼각형 검사에 실패했다. 검사를 완화하지 않고 엄격한 볼록 8점 경사 단면으로 수정했다. 초기 결과는 QA 폴더에 보존한다.

HAMMERHEAD의 상부 위치를 모든 경우에 중앙/후방으로 강제하지 않는다. 전방 어깨 정체성과 기존 볼륨 조건 때문에 작은 함선에서는 상부 중심이 약 0.42까지 남는다. 전체 union 중심은 기존보다 중앙으로 이동한다. 정면 occupancy는 비율/격자 지표이며 미적 완성도나 노출된 최대 평면 면적의 정확한 측정이 아니다. 끝단 면적/최대 station 단면 지표도 실제 가려짐을 반영한 최대 노출 평면 면적을 대체하지 않는다. 모든 지표의 개선을 주장하지 않는다.

실제 물리 질량 중심은 장갑·엔진·무장별 질량 데이터가 없어 계산하지 않는다. 현재 estimatedMass는 기존 추정값이다. Reference A/B/C 이미지와 실제 문제 주문서/seed가 제공되지 않아, 로컬 고정 주문서 비교를 대신 사용한다.

## 선택적 재현

개발 서버를 켜고 다음만 실행한다. 전체 테스트 스위트는 실행하지 않는다.

```sh
npm run dev
npx vitest run tests/stacked-form.test.ts tests/stacked-attachments.test.ts tests/macro.test.ts -t 'STACKED_BLOCKS|integrates a constant clipped rectangle'
npx tsc --noEmit
npm run build
STAGE=after node tests/stacked-form-qa.mjs
STAGE=sample node tests/stacked-form-qa.mjs
```

Before Blueprint와 이미지는 수정 전 로컬 HEAD에서 확보했다. 현재 소스로 `STAGE=before`를 실행하면 새로운 Before를 만들어 버리므로 사용하지 않는다. 저장 Before 재렌더링은 `STAGE=before CAPTURE_ONLY=1`을 사용한다. 필요 시 `CASE_IDS=aegis-4,forge-7`로 비교 범위를 제한한다.

QA 결과, 통제 주문서, 이미지와 세부 수치는 `qa/stacked-refinement/REPORT.md`에서 확인한다.
