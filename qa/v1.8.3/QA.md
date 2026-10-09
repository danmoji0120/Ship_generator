# V1.8.3 — Hardpoint Standardization & 3D Weapon Layout

## Scope and preserved baseline

- Baseline: `62c34a8f0dc9477f9fc2857a84f2d091b45ea015`, branch `work`.
- One ship only: Aegis Cruiser, 300m, Seed 7, MONOLITHIC / WEDGE_CITADEL.
- Input: `qa/v1.8.2/functional-exterior/final-review/blueprint.json`.
- New output: `final-review/blueprint.json`, schema 2 / generator 1.8.3.
- No global generator change, no other Family/shipyard/220-ship rollout. The package/default generator stays 1.8.1, while saved approved prototype and new review packets are independently versioned.
- Existing local rejected tile-language drafts and historical QA are preserved and excluded from this commit.

## Physical standards (meters at 300m)

| Size | Installation W×L | Maximum equipment W×H×L | Minimum foundation height | Budget |
|---|---|---|---|---|
| S | 4.5×5.5 | 5×6×8 | 0.65 | 1 |
| M | 11.5×13 | 13×19×22 | 1.4 | 3 |
| L | 26×30 | 27×16×43 | 2.4 | 8 |
| XL | 45×75 | 45×30×105 | hull integrated | 18 |

Footprint is not the same as equipment envelope. The actual L assembly is approximately 26.2m wide and 40.8m long: armored traverse seat, faceted breech, protected side cheeks, rear mechanism, two long open shrouds and mantlets. XL surface installation is explicitly rejected; existing spinal weapons retain their separate contract. Scale rules exist, but this review only validates 300m.

## Whole-ship layout

18 mounts, 52/58 budget; old experiment had 31. Counts: TOP 8, BOTTOM 4, PORT 3, STARBOARD 3. Size composition: L 2, M 10, S 6. No arbitrary multiplication of the old count.

| Group | Pattern | Configuration |
|---|---|---|
| G1 primary-bow | CENTERLINE_SINGLE | L dorsal main gun |
| G2 primary-citadel | CENTERLINE_SINGLE | L dorsal main gun |
| G3 dorsal-secondary | BILATERAL_PAIR | paired M dorsal guns |
| G4 protected-vls | BILATERAL_PAIR | paired M protected launch housings |
| G5 ventral-casemates | BILATERAL_PAIR | paired M outward lower guns |
| G6 broadside-battery | LONGITUDINAL_BATTERY | two M per side, ordered longitudinally |
| G7 dorsal-pd | POINT_DEFENSE_GROUP | paired S upper defense |
| G8 ventral-pd | POINT_DEFENSE_GROUP | paired S lower defense |
| G9 lateral-pd | POINT_DEFENSE_GROUP | paired S side defense |

Two centerline groups plus seven bilateral groups (eight paired positions). ASYMMETRIC_FUNCTIONAL is supported only with an explicit reason and valid referenced equipment/channel/pocket; it is not used on this ship.

Candidate rejections and shared longitudinal shifts are stored in `weaponLayout.attempts`. G3 moves −8m, G6 +16m, G8 −8m; other groups adopt their initial candidates. No single member independently jitters, changes size, or survives a failed pair. No final group omissions.

## Surface mounting and collision contracts

The source hull uses axis-aligned station rings. Final source armor components and quiet exterior skins are also actual closed solids. Their triangles supply measured exposed hit position/normal. Bounds accelerate searches but do not authorize mounting. Each footprint uses 17 actual triangle contacts; roots embed 0.18m, a clipped faceted foundation bridges bounded surface relief to a coherent outer mounting plane.

Source left/right quiet skins have small geometric differences. Bilateral installation frames use BOTH measured normals (one reflected) and a common exterior plane; independent roots contact the two real skins. The cap retains at least the standard foundation height; support depth is limited to standard+2.5m. No forced world-up, resized footprint, or removed armor.

Blueprint authority contains mount/group/category, surface contacts, measured frame, footprint, closed foundation, equipment world/local bounds, prefab/socket reference, separate static firing clearance bounds and local yaw/pitch arc. All parts are stored; rendering uses no RNG. Weapon category is independent of old type labels.

Validation combines bounds, 15-axis oriented envelope SAT, reciprocal solid vertex/edge/centroid probes, actual foundation triangle contact, exhaust/thermal reservations, channel footprint tests and continuous triangle-ray intersections along sampled static arc directions. Later groups must also preserve earlier firing samples. Angular arcs are relative to each local mount frame, not world angles.

All 29 approved armor masses, macro plan, source hull/connectors/dimensions, engine, integration, material and protection finish prefabs are unchanged. The archived 31 old foundations remain byte-identical in the source packet but are not rendered in this new path. Retired old hardpoint IDs retain historical construction reservation references; active new firing clearances live in weaponLayout. Old saved Blueprint rendering has no new layout data and follows its unchanged path.

## Actual visual review

`final-review/` contains 32 raw 1200px WebGL captures and three contact sheets. Main views use the same 360m orthographic physical frame and lighting for before/after. Neutral six-view captures are supplied separately. Debug labels: S/M/L = size; T/B/P/ST = region; G1–G9 = group.

- `six-views.jpg`: TOP / BOTTOM / LEFT / RIGHT / ISOMETRIC / LOW-ISOMETRIC.
- `before-after.jpg`: same camera/scale comparison with V1.8.2.
- `layout-debug.jpg`: transparent hull context, size colors, group colors, same-scale specimens and mount closeup.
- `sizes-TOP.png`, `sizes-ISOMETRIC.png`: actual stored S/M/L equipment reposed without scaling; common 140m frame.
- `symmetry-TOP.png`, `symmetry-ISOMETRIC.png`: group IDs/colors.
- `arcs-*.png`: all mount normal/right/forward axes; sampled 80m arcs for one L dorsal, one M lower and one M port representative; 520m frame intentionally accommodates rays. Green=normal, blue=forward, red=right; yellow=arc samples.
- `mount-PORT.png`, `mount-BOTTOM.png`: actual armor contact and outward equipment orientation, 65m closeups.
- `L-closeup.png`: faceted heavy gun, 85m closeup.
- `armor-no-weapons.png`: retained armor without active installations; armor JSON unchanged.

Manual review: two L guns read clearly in full ISOMETRIC without zoom; M/S hierarchy is distinct in the same-scale gallery. Lower guns are outward-facing, side batteries ordered and mirrored. Source keel, lower recess, central service space, command plinth and rear nozzle remain visible. The layout is deliberately sparse relative to the old 31 fixtures. No observed floating foundations or blocked openings in these views. This is an approval-review prototype, not a claim of universal design quality.

The captured V1.8.3 `before` TOP/BOTTOM/ISOMETRIC/LOW-ISOMETRIC PNGs are byte-identical to the committed V1.8.2 `complete` images. This verifies the previous saved approved rendering was preserved under the same renderer/camera settings. JSON repeat and same-environment export/re-render pixel repeat pass. Older V0–V1.8.1 compatibility remains covered by existing regression suites and default production UI smoke.

## Performance

Dedicated `performance.json` measurement after all test/capture workers completed: same Chromium/SwiftShader environment, seven warm runs (small sample; p95 is the observed maximum):

| Path | Median | Observed p95 |
|---|---:|---:|
| Existing V1.8.2 functional assembly + validation | 43.2ms | 72.4ms |
| New review layout + own collision/geometry validation | 661.6ms | 726.4ms |
| Standalone complete Blueprint validation | 750.9ms | 761.6ms |

These are review builder timings, not the baseline default order generation time. First measured phases: plan/surface collection 59.0ms, group resolution 317.4ms, own validation 281.6ms. Broad-phase line/bounds rejection accelerates surface search; continuous ray tests and reciprocal geometry probes dominate cost. The heavier validation is suitable for this explicit review path; interactive production rollout needs acceleration/caching profiling first.

Same whole-ship captures: V1.8.2 **101 calls / 18,864 triangles**, V1.8.3 **70 calls / 18,036 triangles**. The 31 inactive legacy foundation meshes disappear only from new review rendering; actual functional and weapon parts batch by six existing materials while preserving individual part IDs/ranges. Debug labels/rays have separate overhead and are not included in the normal comparison. No real mobile GPU measurement.

## Fixes and limitations

- Initial independent pair seating yielded unequal heights/directions: fixed with measured paired planes and independent adaptive contact roots.
- Incoherent footprint and collisions reject the whole group, not the failing member. Candidate history makes relocations inspectable.
- Removed duplicate archived foundations/placeholder rendering only for new planned mounts.
- Floating-point minimum-height comparison uses 1e−6 tolerance; geometric support thresholds were not relaxed to manufacture acceptance.
- Validation is pure: it recomputes clearance without changing stored sample flags/JSON.
- Exact CSG and exhaustive triangle/triangle collision are not implemented. Solid probes can miss unsampled intersections; static angular samples do not prove clearance of every continuously traversed aiming angle. No moving turrets, actual firing, ballistics or combat AI.
- Source is axis-aligned; free-rotation hulls are rejected by the review mounting path.
- Foundation solves bounded relief, not arbitrary curved/split surfaces. Difficult whole groups fail explicitly.
- Only one approved design is implemented and rendered. No unapproved family/yard expansion.

## Verification

Final staged-source verification: **13 suites / 127 tests PASS**, including **27 new weapon-layout tests**; TypeScript and Production Build PASS. Existing regressions generated historical multi-design fixtures only; no new V1.8.3 design beyond Seed 7. Browser Console errors **0**; same-seed JSON and same-environment WebGL pixel repeat **PASS**. Final staged tree reproduced the authoritative Blueprint JSON and all **32 raw PNGs byte-for-byte**. Production UI smoke passed Seed regeneration, JSON/export, 16 existing debug modes, orbit/zoom and fit; the new review is not silently applied to the default path. Vite retains its existing large-chunk advisory, with no build error. Existing local draft files remain outside the commit; consequently the user's working folder intentionally retains those modifications.

Verification evidence: `verification/selected-tree.json`, `verification/production-ui.json`, `verification/report.json`, `verification/tests-build.json`. Profiling is reproducible with `node tests/weapon-layout-performance.mjs` after other workers stop.
