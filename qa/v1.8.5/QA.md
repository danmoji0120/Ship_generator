# V1.8.5 — Functional Exterior Detail QA

Baseline: `41e5d8b455e8aad1a1555ed4b2a7e6edf50ed702`, actual remote work at task start, V1.8.4.2 Requirements-first. The initial checkout was older and included local experimental armor drafts. Those drafts, their existing QA, and the preservation stash remain untouched by this commit. A frozen baseline archive and a clean staged-source verification archive were used; tests that regenerate old reports ran in the latter, never over the original QA.

## Implemented and reviewed

- Independent functional-zone/kit RNG, final-surface measured frames, closed faceted geometry, physical human/drone sizing, optional omission and recorded reasons.
- 21 kits, nine functional zones, four geometry/exposure languages. All 21 kinds occurred across the final 16 visual cases; not all are placed on each ship.
- Existing command, machinery, sensor and foundation assemblies are hosts, not replaced/duplicated equipment. Protected operating envelopes, nozzle/radiator openings, mandatory XL spaces, existing sensor aperture rays, static firing samples and intentional empty-space samples remain active.
- Optional `exteriorDetailPlan`, schema 2, generator 1.8.5, world-solid authority. Remove this record and restore the base generator version to recover the exact V1.8.4.2 Blueprint.
- OFF/LOW/HIGH/AUTO batched visibility. Mode changes leave JSON unchanged. Material batches preserve placement/part references and bounds; Fit uses the enlarged exterior bounds.

## Actual images

The Seed 7 sample is a 300m Aegis Cruiser. Eight full-ship views use the same neutral material, lighting, orthographic camera, origin and **360m** physical frame for OFF/HIGH. OFF is the unchanged baseline geometry: no detail hides/rebuilds armor, foundations, weapons or required equipment. Frozen baseline pixel regression independently checks the old render path.

- [Whole-ship Before/After](images/before-after.jpg)
- [Command access / engine frame / foundation service / RCS Before/After](images/service-before-after.jpg)
- [Channel, joint and sensor Before/After](images/channels-and-sensors.jpg)
- [Four shipyards, neutral service close-ups](images/shipyards.jpg)
- [Six Family full-ship/underbody comparison](images/families.jpg)
- [40 / 120 / 300 / 600m comparison](images/lengths.jpg)
- `verification/`: TOP, BOTTOM, LEFT, RIGHT, FRONT, AFT, ISOMETRIC, LOW-ISOMETRIC, OFF/HIGH; authoritative compressed JSON and placement/omission report.
- `verified-closeups/`, `verified-access/`: actual surface-local views with fixed physical frames. Close-up lighting uses a smaller shadow volume to show physical depth; the identical rig applies to both stages. Full-ship/historical capture lighting is unchanged.
- `verified-series/`: 16-case report, including real Spinal Gun and Missile Ship conditions. Sample counts are 18–51 kits. Only representative comparison sheets and selected close-ups are committed, not every intermediate iteration.

### Visual findings and iterations

1. Initial engine/foundation service candidates were unnecessarily rejected. Tangential distance is now used to find nearby exposed faces when the logical host hint is inside its Hull. Foundation IDs agree with the canonical stored part ID. No footprint/normal thresholds were relaxed.
2. Machinery covers were too large for actual service-pump surfaces. Their human-scale footprint was reduced to 1.35 × 2.0m, and actual pump assemblies receive explicit access zones. This does not resize the existing machinery.
3. Foundation maintenance is an angular apron saddle, 0.85 × 2.4m nominal, below/along the outer foundation face. It does not create a second weapon housing. Existing firing samples remain clear.
4. Long conduits use the actual channel span, bounded to 4–12m, with nine contact probes and unchanged tube/duct cross section. Unsupported curved/stepped routes are omitted.
5. Very wide shadow maps and near-normal close-up cameras initially hid depth. Dedicated inspection lighting and local oblique cameras reveal supported rails/frame legs; direct aperture views are retained for sensors/foundation service to avoid camera occlusion. Blank/occluded intermediate captures were not used as quality evidence.
6. Low-profile shipyards use inset access covers/local seam lips rather than exposed industrial frames. Neutral close-ups show thickness/proportion/exposure differences.
7. Existing large armor and negative-space architecture remain readable. At whole-ship scale the additions are intentionally subtle. This is a service-detail pass, not a claim that the existing Macro geometry now matches reference-image fidelity.

## Technical and browser verification

- Final release suite: **654/654 PASS, 21/21 files**, 775.07s. The preserved local experimental armor draft also passes its separate **10/10** tests (excluded from this commit). Initial complete run: 652/653 passed; one old architecture diversity test exceeded its 30s budget during concurrent captures. It passed unchanged in 10.4s on a standalone run. The passing final execution uses a 120s runtime budget, unchanged geometry/requirement thresholds, two workers. The eight final detail tests include transformed prototype-sample equivalence to the original boundary probes.
- Requirements control experiment: 222 cases; **200 released / 22 explicitly rejected**, mandatory conditions preserved. All numeric/status/structure/resource results agree with the original report. In 126 rows, two explanatory strings additionally state the nozzle-spacing limitation already present in frozen baseline source. This is recorded in [requirements-regression.json](requirements-regression.json); original reports were not overwritten. No claim of byte-identical explanation text is made.
- Final technical matrix: **25/25 released**, eight actual Architecture outputs, nine Roles, Light/Standard/Heavy/Superheavy, Seeds 0/7/11/23/41. Exact base JSON invariance, detail JSON determinism and detail validation pass: [matrix-final/report.json](matrix-final/report.json).
- Historical pixels: **10 stored/generated historical versions × 5 views = 50**, identical to frozen V1.8.4.2 renderer and identical after JSON reload. Includes V0, V1, V1.5, V1.7, V1.8, V1.8.1, V1.8.2, V1.8.3, V1.8.4.1 and the Requirements-first baseline: [history/report.json](history/report.json).
- Final actual Production bundle: **19 UI checks**, Console errors **0**, same-Seed generation, changed-Seed actual Hull, all debug modes, mode/JSON invariance, actual Export/Import WebGL pixels, reload pixels, Orbit/Zoom/Fit, required XL generation, impossible XL rejection and archived imports: [ui-final/report.json](ui-final/report.json).
- 16 final visual cases: Console errors **0**, attachment/interference checks **0 issues**. All six Families, four shipyards, four lengths and explicit spinal/missile designs.
- TypeScript + Production Build: **PASS** in clean staged-source archive and working tree with preserved drafts. Vite retains the existing large-chunk advisory; no compilation error.
- 390px UI layout tested. No actual mobile GPU measurement.

## Performance, measured in the same environment

Chromium/SwiftShader, Seed 7, 300m Aegis, ten paired old/new measured CPU samples after two warm-up iterations. CPU timing includes baseline generation/release checks; detail validation is separately reported. Draw/triangle counters are the **main render pass** (`Three.js info.autoReset` excludes shadow passes), identical measurement convention for each mode. These are not whole-GPU-frame costs or averages over 220 designs.

| Metric | Baseline / OFF | V1.8.5 LOW | V1.8.5 HIGH |
|---|---:|---:|---:|
| Generation median | 541.5ms | same canonical generation | 939.4ms |
| Generation p95 | 628.5ms | same canonical generation | 1,038.2ms |
| Main-pass Draw Calls | 15 | 19 | 23 |
| Main-pass Triangles | 11,386 | 16,694 | 18,034 |

Detail generation alone: median **446.0ms**, p95 **477.4ms**. Additional detail validation: median **104.5ms**, p95 **114.2ms**. 40 placements / 213 solid parts are batched into at most eight additional main-pass draws. Geometry authority/IDs remain individual in JSON.

The first measurement under test/capture contention reported 1,103.2ms detail generation and 27,346 HIGH triangles. Removing exactly coplanar intermediate rings preserves the closed boundary while reducing polygons. Bounded local prototypes/lazy transformed boundary samples reduce reconstruction cost. A conservative extra separating-axis test and supporting-plane proof prune only provably disjoint containment queries; non-supporting/concave faces retain the original sample checks. Surface records are deduplicated by canonical IDs.

**The initial ≤25% generation-increase goal is not met:** measured total increase is **73.5%**. No safety/clearance threshold was weakened to meet it. Further CPU optimization is needed before assuming high-frequency generation or mobile suitability. LOW reduces visible geometry but does not eliminate canonical generation or buffer allocation. [Measured samples](performance/report.json), [initial measurement](performance/pre-optimization.json).

## Omissions and remaining limits

- Common reasons: insufficient coherent footprint/armor step; protected weapon operating envelope; blocked service access; reserved opening/mandatory XL space; body collision; intentional empty-space protection; per-zone or global polygon budget. Only the optional kit is omitted; accepted mandatory designs are not rejected by a missing decoration.
- Safety uses measured contact rays, conservative bounds/separation and reciprocal geometry samples. It does not prove every triangle intersection, continuous articulated weapon motion, all exhaust flow or full sensor FOV. Existing aperture checks sample a 6m sensor corridor.
- Rectangular/faceted service runs describe protected ducts/pipes; arbitrary bent surface-following plumbing is not implemented. Maintenance saddle is segmented, not a fully articulated turret service mechanism.
- RCS geometry records four openings, a thrust-direction candidate, frame and future axis tags. All detail is VISUAL_ONLY; RCS metadata is RESERVED_FOR_COMBAT. No thrust/torque/fuel/cooling/sensor performance or six-axis control allocation is simulated.
- Deep channels can remain difficult to read in default distant lighting. Human-sized ladders/handles require zoom; the overall silhouette deliberately retains large quiet armor surfaces.
- AUTO is screen-size visibility, not a polygon-decimation LOD. No GLB/texture pipeline or mobile GPU validation is claimed.

## Reproduction

Use a dev server and `QA_URL` for `tests/exterior-details-qa.mjs`, `exterior-details-series.mjs`, `exterior-details-closeups.mjs`, `exterior-details-matrix.mjs` and `exterior-details-performance.mjs`. Use `OUT` for a new evidence directory to preserve old captures. `CASES=yard-` limits the series; `YARD=aegis` limits close-ups. Historical pixel comparison uses `BASELINE_URL` / `TARGET_URL` pointing to frozen baseline/current dev servers. Actual Production UI checks use `PRODUCTION_URL` pointing to a built preview, never DEV hooks.

Run `npm run qa:details`, `npm test -- --maxWorkers=2 --testTimeout=120000`, `npm run build`. Runtime budget changes do not alter geometric acceptance tests. Compare archived baseline reports without rewriting them.
