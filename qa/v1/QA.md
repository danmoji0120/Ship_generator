# Procedural Shipyard V1 QA

## 환경 / 실행

Node.js 24, Vite 7, TypeScript strict, Vitest, Chromium headless WebGL SwiftShader. dev 서버 `http://localhost:5173`에서 실제 입력·생성·카메라·Debug·JSON UI를 확인했습니다.

## 결과

- `npm test`: **21 tests PASS**, 기존 V0 12개 유지 + V1 9개 추가.
- V0 1,296개 회귀 주문 조합 + V1 1,296개 구조 주문 조합 검증.
- `npm run build`: TypeScript 오류 0, production 빌드 성공.
- `npm run qa`: **50개 설계 실제 렌더**, Console 오류 0.
- 8개 Grammar 각각 다른 Seed 3개 확인 (Hybrid 포함).
- 동일 Order/Shipyard/Seed 10회: Blueprint JSON과 실제 WebGL 캔버스 픽셀 일치.
- 고정 Seed에서 Architecture, Volume/Connector, Engine/Hardpoint/Material 직렬화 동일.
- Orbit drag, 휠 Zoom, Fit, TOP/AFT/3D 정상.
- 기존 5개 + Architecture/Structural Graph Debug 정상.
- Inspector의 문법·구조 수·연결 수·추진 구조·breakdown 정상.
- 직접 Seed, Random Seed, 새 Seed 생성, JSON 보기/다운로드 정상.
- 390px 모바일 가로 넘침 없음.

## 역할 / 조선소 검토

- Heavy Naval Battleship: 여러 장갑 구획을 넓은 칼라로 결합한 조밀한 전투함.
- High Mobility Destroyer: 작은 중심 구획과 수평/수직 분산 추진 나셀.
- Industrial Missile Ship: 분리된 미사일 carrying pod와 엔진 포드를 실제 트러스로 연결.
- Advanced Spinal Gun Ship: 긴 축 하우징과 전방 muzzle, 좌우 breech/reactor-like 구획, 분리 후방 추진부.
- Corvette/Destroyer/Cruiser/Battleship/Missile/Spinal을 각각 여러 Seeds로 확인.
- 동일 Cruiser/Seed의 4개 Shipyard에서 구조 문법·단면·비율·연결·추진 배열 차이를 확인.
- `architecture-comparison.png`: Monolithic / Block / Spine / Truss / Twin / Core+Nacelles / Stack / Hybrid를 나란히 검토. 전역 Primary Hull 없이도 정상적인 결과가 렌더링됨.

## 다양성 Guard

`v1/diversity.json`: 4 Shipyards × 9 Roles × 20 Seeds = 720개. 36개 그룹 모두 최소 3개 Grammar, 최소 14개 투영/치수 signature. 동일 문법 20/20 편중 없음. 군함 역할·조선소별 가중치 편향은 유지합니다.

## 발견 후 수정

1. 초대형 Heavy Block Assembly가 길이에 비해 너무 넓어 큐브처럼 됨 → 문법 전체의 최대 beam envelope 적용 후 연결 좌표 함께 변환.
2. Stacked Blocks의 하부 마운트가 상부 구획 안으로 가려짐 → 노출 테라스를 우선하고 최상단 실제 표면/부모를 선택. 독립 Three.js raycast 확인.
3. 손상된 Blueprint의 노출 면 조회가 예외를 던짐 → invalid blueprint를 오류 목록으로 반환하도록 복구.
4. 둔한 Monolithic 선수 첫 Station만 넓혀 망치형 목이 생김 → 첫 3개 Station에 일관된 선수 포락선을 적용.
5. 접합 구조의 자유 endpoint / graph 참조 → 생성 시 실제 단면 boundary 교차점 계산, 전체 reachability와 참조 자동 검증.
6. Hybrid 제한적 fallback → 3개 거부 후보 이후 단일 Spine으로 전환, 원 요청 문법과 거부 이유 보존. 자동 테스트로 분기 확인.

## 한계

엄격한 축 정렬 Volume과 저해상도 Geometry 범위입니다. 겹침은 bounding-volume 휴리스틱, 투영은 convex footprint의 28×28 샘플입니다. 실제 구조 강도나 내부 관통 계산은 없습니다. 연결 슈의 작은 접합 여유는 허용하되 주요 Volume의 깊은 관통은 거부합니다. 임의 회전이나 모든 부품의 exact collision을 보장하지 않습니다.

한 척씩 표시하며 검사 설계 약 4,100–11,200 triangles, 100–460 draw calls. 소프트웨어 WebGL의 처리 시간을 GPU 성능으로 일반화하지 않았습니다.

빌드 경고는 Three.js 포함 번들 크기 임계치 한 건입니다. TS/런타임 오류가 아니며 외부 서버/텍스처/API 의존성은 없습니다.

V0 결과는 `v0/QA.md`, V1 실제 실행 수치는 `v1/report.json`, 대표 이미지와 문법별 3개 Seeds는 `v1/`에 있습니다.
