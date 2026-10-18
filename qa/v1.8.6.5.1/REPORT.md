# V1.8.6.5.1 — Armor Integrity & Combat Readiness

작성일:2026-10-18 UTC. **대표 결함과 실험실 지연은 수정했지만, 전 함선 장갑 정합성은 부분 완료다.** 다른 Architecture의 미피복·불일치 후보와 SPINE/외장부의 미정 계약이 남아 있다. 표본 피복률1을 완전 방호 판정으로 사용하지 않는다.

## 기준과 실제 변경

- 기준: `feature/v1.8.6.5` / `7efa667e6d2409e3fce147e96f36c54abd9be6ab`. 시작 시 로컬·원격 일치를 확인했다.
- 작업: `feature/v1.8.6.5.1`, 독립 Worktree. 구현 Commit: `c756bd25aec4fb7ff62acb240039776f30afec11`. 기존 work·기타 Worktree·QA·combat-demo는 수정하지 않았다.
- Blueprint schemaVersion2 유지. 신규 생성 계약만 `1.8.6.5.1`로 명시한다. 명시적 과거 생성 계약과 저장본 로드는 그대로 유지한다. Audit/프로파일/표시 품질은 Blueprint나 DamageInstance에 저장하지 않는다.
- 변경 파일 전체: [changes.txt](changes.txt). 핵심은 `src/armor-integrity/*`, `src/generation/production/armor.ts`, `src/procurement/generate.ts`, `src/rendering/{armor-integrity,warheads,damage-batch,dynamic-lines,viewer}.ts`, `src/ui/{armor-integrity,damage,warheads,lab-performance}.ts`, `src/warheads/authority.ts`다. 기존 재질·관통 계수·방호층을 축소하지 않았다.

## 감사의 의미와 한계

**Planned**는 실제 Hull 삼각형/캡과 기존 개구부·접촉 분할, 신규 발주 distribution을 사용한다. CITADEL/BALANCED의 비의뢰 선택 장갑은 누락과 구별한다. 저장된 외장부/SPINE의 방호 의도가 확인되지 않으면 UNKNOWN을 유지한다. 단순한 Hull 충돌을 Armor로 취급하지 않는다.

**Physical**은 실제 유한 물리 Cell의 Entry/Exit·재질·층·경로 길이로 판정한다. 실제 교차한 `surfaceId/piece/index`, layer ID와 Source ID를 기록한다. AABB는 탐색 후보만 줄인다. **Visual**은 저장된 Normal 장갑 삼각형의 교차를 사용하며, 첫 Hull보다 뒤에 있는 장갑을 앞의 피복으로 세지 않는다. 장비/하우징까지 포함한 전체 렌더러의 픽셀 가림을 재현하는 모델은 아니다. 따라서 일부 파란색은 추가 확인이 필요한 일관성 후보이며, 모두 생성 결함으로 확정하지 않았다.

분모는 별개다: `HULL_TARGET_FOOTPRINT`와 `ARMOR_SOURCE_SKINS`를 합산하지 않는다. 98% 선형 내부 다각형과 경계 띠를 삼각형으로 나누고 실제 면적을 가중한다. 기본20,000개 유한 Ray 한도이며, 미검사 면적은 별도 UNRESOLVED/unsampled다. 작은 구멍이 표본 사이에 남을 수 있고 유한 오차 상한을 주장하지 않는다. 기존 Production coverage의 외장 source 자동1과 `armorRetainedFraction`은 이 지표의 진실 공급원이 아니다.

Inspector는5색 상태, 실제 Source/Volume/Surface/층/Cell locator, 정책·제외 이유·예약 ID·재질·측정 두께·Ray를 보여 준다. 실제 마우스 선택·Focus·Export를 검증했다. Normal에서는 자동 감사나 Overlay Draw Call이 없다. 별도 상세 버튼은 명시적 분석 요청이다.

## 실제 결함과 국소 수정

AEGIS / Battleship /470m / MONOLITHIC / Seed7 / BALANCED의 실제 저장본·명시적 구형 생성에서 두 원인을 재현했다. 사용자 고유 구멍 좌표가 제공된 것은 아니므로 그 특정 위치를 재현했다고 주장하지 않는다.

1. 마감 ribbon의 양쪽0.8% 여백이 의뢰된 면 경계에 실제 빈 띠를 만들었다. 원래 ribbon/root를 유지하고 같은 면의0–0.009 및0.991–1 구간에만 유한 외측 보완을 추가한다.
2. 개구부로 잘린 작은 캡이 전체 캡 면적의0.2% 미만이라는 이유로 생략됐다. 그 실제 노출 다각형만 유지하고, 기존 개구부 충돌 검사에 통과한 경우만 생성한다.

대표 함선의 추가 source는16개(경계 띠4, 작은 캡12)다. 주 장갑11개는 그대로이고 finish38→54, 물리 surface50→66, 유한 piece9,575→11,044다. 통째 Hull shell이나 큰 box를 덧씌우지 않았다. CITADEL/BALANCED 비의뢰 면과 기능 개구부는 그대로다. 모든 추가 물질은 기존 유한 체적·복합층 질량/비용 계산을 통과한다.

| 동일 분모/동일 Ray | Before | After |
|---|---:|---:|
| Hull source 분모 m² | 425,834.471 | 425,834.471 |
| 계획 eligible m² | 220,724.009 | 220,724.009 |
| 의도적 제외 m² | 150,868.590 | 150,868.590 |
| 방호 의도/외장 미정 m² | 54,241.872 | 54,241.872 |
| 미피복 면적 표본 추정 m² | 857.491 | 0.000 |
| MISSING 표본 |208|0|
| 같은 기존208 Ray에서 실제 Armor 교차 |0|208|
| 장갑 질량 t | 293,041.272 | 294,895.158 |
| 기본 추정 질량 t | 628,128.485 | 629,982.371 |
| 상대 건조 비용 | 807,769,439.934 | 812,288,329.643 |
| UNKNOWN_LEGACY 서비스 kg | 245,822,300 | 245,822,300 |

장갑·기본 질량 증가량은 1,853.886t다. 서비스10%를 장갑으로 재분류하지 않았다. 질량은 층별 실제 산출값과 Ledger를 독립 합산 검증했다. 강제1kg 상한은 `REQUIRED_MAXIMUM_BASE_MASS_UNAVAILABLE`로 거절됐다. 동일 신규 주문 전체 JSON 결정성을 확인했다. 실제 결함 Ray에서 탄도 첫 접촉은 Hull→Armor로 변경된다. 별도의 기본 중앙선105mm 관통은 구형/신형/Production에서 통과 계층·결과가 같고 잔여 에너지 오차<0.001J다.

[유한 Ray 증거](local-repair-evidence.json.gz) · [전후 수치](armor-before-after.json) · [결함·실패 실험](armor-defects.json) · [실제 동일 시점 사진](gallery.html)

## 8종 제한 표본

각1개 기존 저장본과 각1개 최종 신규 생성 결과다. 새 표본은4개 조선소·4개 우선순위·3개 distribution에 분산했다. 이 표는 동일 입력 우선순위 민감도의 통계 증명이 아니며 전체 조합 실험도 아니다. counts는 면적이나 장갑판 개수가 아니라 감사 tile 수다. UNRESOLVED에는 미정 의도·SPINE 교차·미검사 표본이 포함된다.

| Architecture | 기존 Missing / Mismatch | 신규 Missing / Mismatch | 신규 Yard / Priority / Distribution |
|---|---:|---:|---|
|MONOLITHIC|208 / 0|0 / 0|aegis / BALANCED / BALANCED|
|BLOCK_ASSEMBLY|307 / 100|15 / 526|vesper / MOBILITY / BALANCED|
|SPINE_AND_MODULES|304 / 35|0 / 0|forge / ENDURANCE / CITADEL|
|TRUSS_POD|353 / 11|2 / 25|serein / ECONOMY / BROAD_COVERAGE|
|TWIN_HULL|1232 / 0|808 / 4|forge / BALANCED / BALANCED|
|CORE_AND_NACELLES|690 / 0|1023 / 17|vesper / MOBILITY / BALANCED|
|STACKED_BLOCKS|114 / 35|0 / 8|forge / ENDURANCE / CITADEL|
|HYBRID|190 / 36|10 / 70|serein / ECONOMY / BROAD_COVERAGE|

신구 입력이 다른 행의 차이를 개선율로 해석하지 않는다. 대표 MONOLITHIC만 같은 주문·Seed·Ray로 비교했다. 신규8건은 기존 구조/물리/예산 검증에 PASS했지만 이 감사의 모든 후보가 해소됐다는 뜻은 아니다.

별도 초기 TWIN_HULL / ARMOR / BROAD_COVERAGE 주문은 `INVALID_PHYSICAL_CONVEX_FRAGMENT`로 거절됐다. 이를 정상 처리하거나 삭제하지 않았다. 저장된 원래 주문의 TWIN_HULL은 구형·신형 모두 생성되고, 최종8종 표본에는 그 명시적 주문을 사용했다. [실패 주문 원본](generation-survey-intermediate.json.gz), [거절/재검증](generation-rejections.json), [최종 신규 표본](new-generation-final.json)에 구별해 기록한다.

## 실험실 성능과 물리 결과

동일 archived target / 동일 HIGH256 입력을 실제 Production UI로 실행했다. 총 결과 표시 시간은 클릭→완료 표시이며 Export/Reset/명시적 GC는 구간 밖이다. Cold target query preparation을 이미 수행한 뒤의 첫 burst와 완전한 실험실 열기 비용을 구별한다. 비교 세션마다 첫1회+warm1회여서 통계 p95나 cold 중앙값을 주장하지 않는다. Software WebGL 환경이다.

| 측정 세션 | 첫 burst ms | warm ms | 비고 |
|performance-before|6480|6417|동일 물리 HIGH / CDP CPU profile|
|performance-before-verification|5588|6408|동일 물리 HIGH / CDP CPU profile|
|performance-after|1920|1441|동일 물리 HIGH / CDP CPU profile|
|performance-after-final|1819|1407|동일 물리 HIGH / CDP CPU profile|
|performance-after-unprofiled|1481|1531|동일 물리 HIGH / CDP CPU profile|

최종 profiled 세션의 lab 열기는1,438ms, target query 자체784.5ms였다. 이 값은 burst1,819ms에 포함되지 않는다. 열기부터 첫 결과까지는 따라서2초를 넘으며, 해당 전체 흐름의2초 달성을 주장하지 않는다. 최종 unprofiled burst는1,481/1,531ms다. 추가 실제6회 burst/reset은1,528–2,105ms로, 매번2초 이내를 보장하지 못했다.

기준 warm CPU self sample: `getProgramInfoLog`약2,677ms + `getShaderInfoLog`약2,076ms, GC약136ms. Dispose/recreate로 마지막 재질 소유자가 반복 사라지는 경로를 제거했다. 셰이더 오류 검사를 끄지 않았다. 최종 profiled 첫 burst는 query785.7ms, material0.6ms, local damage0.6ms, capability10.2ms, 총 engine work876.4ms였다. UI summary/DOM9.5ms, 두 overlay update 합계4.6ms, render submission85.7ms로 기록됐다. 일부 단계는 포함 관계이므로 합쳐 총시간으로 취급하지 않는다.

초기 기준 최대 long task는 첫374/warm496ms였다. 최종 profiled 세션에는50ms 이상 task가 기록되지 않았고, 최종 unprofiled 세션에는121/50ms가 기록됐다. 첫 shader/GPU 준비·GC·계측 노이즈는 여전히 존재한다. GPU 완료 대기와 shader/driver 시간을 모두 독립 분리 측정했다고 주장하지 않는다. raw CPU profile와 Performance.metrics를 보존했다.

재사용 overlay는 동일 재질과 BufferGeometry를 유지하고 capacity 부족 시에만 확장한다. DrawRange로 오래된 데이터를 숨기며, 성장 시 이전 GPU attribute 저장소를 해제한다. 실제 손상은 Instance에 전부 남고 표시만 마지막128 local/64 contact와 품질별 stride를 사용한다. 닫힌 trace JSON은 생성하지 않고, 열린 trace만 실제 기록을 포맷한다. 접촉 선택 DOM은 revision 변화에만 교체하고, 장비/구획 상태가 같으면 전체 X-Ray scene 재생성을 피한다. 물리 work는 독립 timeout의128 boundary/6ms 예산으로 진행하며 UI 요약은140ms 간격 또는 완료 시 갱신한다. 개별 고비용 교차는 시간 예산을 넘길 수 있다.

`beginAuthoritativeDetonation`은 표시 품질 입력 없이 HIGH256 policy를 강제한다. 기존 LOW/MEDIUM 물리는 명시적 Diagnostic mode에 남겼다. Visual LOW/MEDIUM/HIGH 및 OFF는 실제 피해·탄도·예산을 바꾸지 않는다. 전후6쌍에서 **전체 DamageInstance, 전체 WarheadRecord, 정렬된 모든 접촉**이 일치했고, Production UI의 표시 변경도 상태 hash를 보존했다. 추가 진단 시간만 결정성 비교에서 분리했다.

## 메모리·생성 비용

6회 실제 burst/reset/GC의 retained JS heap는228.11→228.45MB였다. 별도6회 GPU overlay on/품질12회/clear/off 검사에서 geometry29→35→29, program8→12→8, texture3 유지, DrawCalls29→36→29였다. 같은 overlay의 재질/geometry 참조가 유지되고 이후 추가 buffer allocation은 없었다. 최종 viewer disposal은 geometry0/texture0/scene children0이었다. 함선 교체6회 검사에서도 같은 함선의 post-GC heap가 거의 같은 범위로 복귀했다. JS heap·WebGL 객체 수는 VRAM 측정이 아니며, 짧은6회가 모든 누수를 증명하지는 않는다.

별도 새 Node 프로세스/계약별 cold1회+warm2회 생성 시간:

| 계약 | 첫 생성 ms | warm2회 ms | 관측 RSS 최대 MB |
|1.8.6.3.1|8840.7|2428.5, 2538.3|893.0|
|1.8.6.5.1|10029.8|2604.7, 2524.9|893.5|

신규 첫 생성은 약13.4% 느려졌고 warm 평균은 약3.3% 증가했다. 추가 실제 Cell의 비용이다. 최초5–7초 또는 반복3초 이내 중 최초 목표는 달성하지 못했다. Node 모듈 import/bootstrap은 생성 구간 밖이며, RSS는 관측 시점 값으로 진짜 peak 측정은 아니다. 앞선 공유 프로세스 실험은 캐시 두 계약을 함께 보유하므로 별도 원본으로 남겼다. TRUSS/복잡 연결체의 큰 생성 비용과 Query 메모리 문제는 미해결이다.

## QA 및 재현

- 관련 자동 테스트 **68개/5파일 통과**: `armor-integrity`6, `physical-foundation`16, `free-mount`18, `warhead`14, `damage`14. **전체600개 이상 스위트와 combat-demo 테스트는 실행하지 않았다.**
- `npm run build`의 TypeScript와 Vite Production Build 통과. 기존 chunk>500kB 경고는 남는다.
- Production 기본 검증58항목, Free-Mount9항목, 동일 patch pair2항목, 상세 Inspector/kinetic8항목 통과. 각 원본 JSON과 실패 로그 보존. Console/page error0.
- 저장8종 Normal canvas PNG와 DrawCalls가 기준 버전과 정확히 일치했다. UI version label을 픽셀 비교에 포함하지 않았다.
- 실제 함포/미사일 canvas+worker 설치, 질량 분리, 삭제·Undo/Redo·저장/복원, 구형 armed Blueprint 전체 JSON 보존, 신규 unarmed/engine 보존 확인. 외장 척추포 모델/급탄/새 내부 공간 검사는 추가하지 않았다.
- A–G 독립 유한 판/개구부/누락/시각-only/물리-only/미정 재질/경계 fixture, H 실제 질량, I Blueprint 불변, J 실제 결함 위치 탄도 접촉을 검증했다. 같은 seed 전체 신규 JSON 비교도 통과했다.

```
npx vitest run tests/armor-integrity.test.ts tests/physical-foundation.test.ts tests/free-mount.test.ts tests/warhead.test.ts tests/damage.test.ts --maxWorkers=1
npm run build
node tests/integrity-harness.mjs
node --expose-gc tests/integrity-audit-actual.mjs
node tests/integrity-browser.mjs
```

브라우저 스크립트는 Chromium(`/usr/bin/chromium`), Production preview4190, 일부 pixel/resource 스크립트는 독립 DEV5189/5190을 사용한다. 2CPU/8GiB, Node24.19, Chromium151/SwiftShader 환경이다. 실패한 숨김 버튼 대기·중복 gzip·잘못된 STOPPED 가정·잘린 trajectory를 원점으로 사용한 QA 실험은 삭제하지 않았고 제품 실패와 구분했다. 원래 테스트의 물리 실패 기준을 약화하지 않았다.

대형 재생성 가능한 전체 audit와 일부 신규 Blueprint는 로컬에 보존하되 task `.gitignore`로 Git에서 제외했다. 재현에 필요한 대표 전후 Blueprint와208개 Ray 증거, 소형 결과·압축 profile·실제 이미지·로그만 추적한다.

## 남은 한계와 완료 판정

1. 대표 결함208개는 같은 Ray에서 복원됐지만 다른 함선의 Missing/Mismatch 후보가 남아 있다. 접촉 경계·진짜 계획 의도·가시성 근사를 분리 조사해야 한다. 보편적인 Combat-ready 판정은 미완료다.
2. SPINE/일부 외장 하우징은 재질·방호 의도가 미정이다. 두꺼운 Armor나 얇은 Hull로 임의 분류하지 않았다.
3. 표본 감사는 미검사 영역과 sub-tile 틈을 완전 검증하지 않는다. Normal 소스 가시성은 전체 장비 occlusion/픽셀 coverage와 다르다.
4. 첫 query 준비와 전체 UI 열기까지2초는 미달이며, burst도 일부 lifecycle 회차가2초를 넘는다. 최초 생성은 약10초로 느려졌다.
5. Physics는 기존 중심선 CCD/선형 운동/게임 재질 보정이다. 회전 CCD, 정밀 실재료 성능, 서버 권위 네트워크, 실제 combat runtime을 추가하지 않았다. 그래픽 품질과 물리 policy를 분리하는 API 경계까지만 준비했다. 잘린 표시 trajectory는 발사 입력 재현의 진실 공급원이 될 수 없다.

다음 Game Foundation V0.0 전에 남은 구역의 방호 의도 계약·유한 교차 후보 검토와 초기 준비 비용을 우선 해결하는 것이 적절하다. 이번 작업에서 새 전투 엔진을 만들지는 않았다.

## 요청 보고 항목43–45 / Git

43. 구현 Commit: `c756bd25aec4fb7ff62acb240039776f30afec11`. QA 보정과 이 보고서는 후속 Commit으로 기록한다. 최종 QA Commit ID는 최종 응답 및 `git log -1`에서 확인할 수 있다.
44. 원격 기준 branch HEAD는7efa667…로 재확인했고 새 branch는 push 전 존재하지 않았다. 최종 QA Commit을 정상 push한 뒤 원격 HEAD와 일치 여부를 별도로 검증한다. 실제 검증 결과는 최종 응답과 로컬 `push-verification.json`에 기록한다(자기 SHA를 포함하는 보고서를 다시 커밋하는 순환은 만들지 않는다).
45. Force push/history rewrite/main merge는 수행하지 않는다. 최종 정상 Push 결과는 위 검증 후에만 완료로 보고한다.
