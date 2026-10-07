# V0 자체 QA

검증 환경: Node.js 24, 엄격한 TypeScript, Vite, Chromium headless WebGL (SwiftShader).

## 검증 결과

- `npm test`: 12개 테스트 통과. 1,296개 주문/Seed 조합의 전체 Blueprint 자동 검증.
- `npm run build`: TypeScript 오류 0, production 빌드 성공.
- `npm run qa`: 실제 20개 설계 렌더, 요청한 네 조선소/역할 조합 각 3 Seeds.
- 같은 발주서+조선소+Seed를 10회 UI 버튼으로 재생성: JSON과 캔버스 이미지 완전히 일치.
- 회전, 줌, 카메라 초기화, AFT/TOP/3D, 5개 Debug View 확인.
- Inspector, JSON 표시, 다운로드, 직접 Seed 입력, Random Seed, 새 설계 생성 확인.
- 390px 모바일 가로 넘침 0. 데스크톱 생성/Seed 조작 영역 고정.
- 브라우저 Console 오류 0, 비정상 숫자 geometry 0.

## 시각적 검토

- Heavy Battleship: 넓고 두꺼운 선체와 장갑 어깨, 비교적 큰 소수 엔진.
- Mobility Destroyer: 좁은 선수와 낮은 질량감, 6개 추진기.
- Industrial Missile Ship: 노출 연결부, 측면 미사일 압력 모듈, 분산 나셀.
- Advanced Spinal Ship: 긴 중심축, 낮은 장갑 단면, 전방 Spinal mount.
- 같은 Cruiser 주문과 Seed에서 네 조선소의 폭/높이, 단면, 어깨, 모듈 연결, 후면 엔진 배열 차이를 확인.
- A/B/C/D에서 중장갑 Cruiser와 고기동 Cruiser의 체적 차이, 넓은 Missile과 좁은 Spinal의 실루엣 차이를 확인.
- 정상 시점과 Debug 구조 시점에서 허공에 떠 있는 독립 모듈 없음. 산업 모듈은 트러스 부모 연결을 별도 검증.

## 발견 후 수정

1. Diamond 단면의 평면 상단이 좁아 일부 마운트가 공중에 뜸 → 상단 polyline과 교차하여 실제 높이와 경사 법선을 계산.
2. JSON round-trip에서 법선 `-0`이 `0`이 되는 차이 → 직렬화 전에 0을 정규화.
3. 세로로 긴 발주서가 뷰어 높이를 밀어냄 → 데스크톱 고정 작업 영역, 필드 독립 스크롤, Seed/생성 영역 고정.
4. 산업 모듈이 일반 선체와 너무 가까워 트러스가 약하게 보임 → 중심 선체 잘록한 포락선, 모듈 간격 확대와 전방 모듈 변형 추가.
5. 겹친 보조 선체가 미사일/일반 마운트를 가림 → 최상단 노출 표면을 선택하고 논리 부모를 재할당. 독립 Mesh raycast 테스트 추가.
6. Fit/새 생성 후 관찰 방향 표기가 이전 AFT로 남음 → 카메라와 방향 표기를 함께 초기화.
7. 경사진 상세 패널의 환기 슬롯이 기울기를 따르지 않음 → 같은 로컬 그룹에 배치하여 표면 법선에 함께 정렬.

## 성능과 한계

`report.json`의 설계별 triangles/drawCalls와 화면 Inspector의 생성 시간을 참고. 테스트 설계의 삼각형 범위는 약 4,300–10,900개입니다. 소프트웨어 WebGL QA의 시간은 실제 데스크톱 GPU 성능의 대표값으로 사용하지 않았습니다. 모든 검증은 한 척 표시 범위입니다.

빌드 경고는 Three.js가 포함된 단일 번들의 500KB 임계치 초과 한 건입니다. 실행 오류가 아니며 gzip 약 140KB입니다. 네트워크 API 및 외부 리소스는 사용하지 않습니다.

정밀 충돌/마운트 상호 간섭, Boolean 합집합, 물리 기반 질량 및 전투 성능은 V0 범위 밖입니다. 모든 장갑/보조 구조는 연결되어 있으나 수출용 단일 제조 메시를 보장하지 않습니다.
