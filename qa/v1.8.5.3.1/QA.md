# V1.8.5.3.1 — Engine Root & Sparse Architecture Refinement

Baseline: `a9969d2b0e6341a7800e1e1659f95b9256d983f9`. The release source is tested/rendered from a frozen staged copy; original local armor drafts and historical QA are preserved and excluded from the new commit.

## Implementation

See [the design contract](../../docs/MESO_ROOT_REFINEMENT.md). The eight Meso kinds remain. Actual engine position/axis/radius and per-engine IDs now determine root surface search. Rear cap and upstream candidates use real exposed surface normals and locally measured support intervals. Four variants are recipes within ENGINE_ROOT_TRANSITION, not new kinds. Every accepted footprint retains thirteen contacts, actual clipped station triangles and the original patch/collision/opening/firing checks. Segmented roots require two independent closed supports, with no invented connection across equipment.

The original 7/14/26 caps remain. Major L foundations are resolved first, followed by root opportunities, actual connector junctions and ordinary optional armor. Already-supported engines are distinguished from exhausted budgets. Source engine data, root variant, actual surface IDs, fit decisions and final zone status are recorded. Root geometry has no combat protection or simulated mass bonus.

Explicit V1.8.5.3 uses the frozen original planner. Legacy geometry with absent variant parameters reconstructs exactly as before. New metadata is optional within schema 2. New Root and Junction debug modes are rendering-only.

## Failure analysis

- **Wrong search location (B):** the former planner merged engines by parent, then searched world ±X at a parent-length fraction. This missed cap support immediately around actual nozzles and selected thermal equipment regions instead.
- **Excessive footprint (C):** former ship-length proportions could exclude a useful engine-local support strip. New fit sizes use nozzle radius and measured support. The visual-size minimum for this local component changes; contact, patch area tolerance, intrusion, exhaust and firing limits do not.
- **Equipment occupied (D):** cooling/thermal/detail/weapon/access blockers remain intact. Rejections retain the actual object IDs in saved plan decisions; no blocker is removed or moved.
- **Unsupported patch (E):** the exact station patch and 0.2% projected area tolerance remain unchanged. Geometry is not declared attached merely by AABB overlap.
- **Budget starvation (F):** root evaluation precedes ordinary terraces. Root-only trials still use safety and physical geometry; they isolate budget competition without forcing installation.
- **Shape constraints (G):** wide, narrow, two-support and low variants provide different fits. A missing legal fit remains an omission.
- **No actual space (A):** no candidate support/clearance is a legitimate failure, not proof that a whole parent bounding box was free. Final accepted and omitted zone counts are reported separately from candidate retries.

An initial close-up showed an accepted fairing too far from the nozzle to read as a root. Candidates were reordered by actual root distance before final QA. The resulting nearest accepted low fairings sit immediately outside the retained nozzle casing, rather than unrelated patches farther along the aft face.

## Tests and final connector correction

The final full run passed **699/699 tests in 25 files**, preserving all 689 previous checks and adding ten. The added tests cover: canonical physical invariance; exact old planner contract; root-only installation on four shipyards; all four variants on actual support; forged engine metadata rejection; oblique-axis candidate discovery; omission classification; deterministic JSON and hierarchy caps; real connector-zone discovery with unchanged negative-space/Hull data. The full run includes the additional real-connector regression test; no existing tests were removed or weakened.

The final newly executed 222-order artifact retains **200 releases / 22 rejections**, with identical per-order/Seed decisions against the preserved baseline. See [controlled results](controlled-results.json) and [automated checks](automated-tests.json).

## Limitations

These remain conservative mixed bounds, containment, edge/triangle and sampled opening/access/firing tests, not complete CSG or exhaustive continuous turret/crew-path simulation. Measured local support intervals are not exact free-surface unions; final patch/contact checks are separate. Production engine/equipment generation still chiefly uses aft engines; synthetic axis testing does not imply free-rotation support throughout every older generator. Small legal root covers can be chiefly close-up information. Some open architectures have no exposed legal junction support and are not filled to match monolithic density. Junction discovery currently probes top/bottom/flanks; cap-only interfaces can remain undetected. Hardware/mobile GPU performance remains unverified unless explicitly measured.

Compact review sheets and reports are committed. Raw PNGs, example authoritative blueprints and diagnostic prototypes remain local.

## Actual connector geometry correction

An extra probe against actual rendered Connector geometry found two Core/ Nacelle shoulder placements crossing connector housings. The original detail collision scene did not include these meshes. The new path now prepares actual renderer loft/beam solids with world transforms, disposes the temporary geometry/material, and caches immutable obstacle solids per Blueprint. Planning and safety replay both use them. They are obstacles, not new armor/attachment authority. Historical V1.8.5.3 retains the former scene. No interference exception is used: colliding candidates are rejected and other candidates are tried. The new regression checks all accepted Core/Nacelle structures against these real connector solids.

## Final engine-control and sparse results

The same 18 Patrol/ENGINE_DOMINANT/CORE_AND_NACELLES orders used by V1.8.5.3 were replayed (Vesper, Forge, Serein; 120/300/600m; Seed 0/13). Before: 0 roots in all 18. Historical root-only also installs 0, so the problem is not only competition for budget. After: **17/18 ships, 115 root structures, 63/72 engines supported**. Every new full-path root count equals its root-only counterpart. The remaining nine unsupported engines are explicit omissions, not invalid shipments. All eighteen physical designs retain identical Hull/Armor/Weapons/Requirements/Exterior Detail authority and pass validation and same-Seed JSON replay.

| Yard / length | Seed 0 roots | Seed 13 roots |
|---|---:|---:|
| vesper / 120m | 8 | 4 |
| vesper / 300m | 7 | 8 |
| vesper / 600m | 8 | 8 |
| forge / 120m | 8 | 5 |
| forge / 300m | 8 | 8 |
| forge / 600m | 8 | 8 |
| serein / 120m | 4 | 0 |
| serein / 300m | 6 | 6 |
| serein / 600m | 5 | 6 |

| Variant | Automatic placements in 18 controls | Forced real-support QA |
|---|---:|---:|
| WIDE_ROOT_FAIRING | 22 | 2 |
| NARROW_ROOT_FAIRING | 16 | 2 |
| SEGMENTED_ROOT_SUPPORT | 0 | 2 independent supports |
| LOW_PROFILE_TRANSITION | 77 | 2 |

Segmented is implemented and physically validated in a forced diagnostic, but **not automatically selected in this 18-order release sample**. The other three variants are actually selected by production. Serein 120m Seed 13 has no accepted root in the bounded search: 70 detected zones, 752 insufficient-footprint trials, 40 invalid-patch trials, 48 no-exposed-surface trials; final zones are 66 insufficient footprint and four no exposed surface. These are candidate/zone counts, **one design omission**, not hundreds of failed ship designs. This does not prove global geometric impossibility.

| Architecture | Before Meso | After Meso | Accepted junction structures |
|---|---:|---:|---:|
| TRUSS_POD | 12 | 21 | 8 |
| HYBRID | 2 | 15 | 9 |
| SPINE_AND_MODULES | 6 | 16 | 6 |
| CORE_AND_NACELLES | 9 | 24 | 9 |
| TWIN_HULL | 12 | 17 | 3 |

The raw Connector replay covers 81 truss/beam solids in TRUSS_POD, 49 in HYBRID, 13 in SPINE_AND_MODULES, four in CORE_AND_NACELLES and two in TWIN_HULL; accepted junction structures show no sampled intrusion. Core placements were re-planned after the detected housing collision. This supplements, rather than replaces, the production edge/triangle and sampled containment tests.

## Visual review

All comparisons use the same camera/light/physical extent per before/after pair. Aft caps show actual angular root/supply covers immediately outside retained nozzle casings; Detail OFF still shows the solids. Wide/Narrow change the cover width and roof; Low-profile lowers the upper cover; Segmented uses independent supports with no hanging bridge. Aegis uses heavier width/height and straight shoulders; Vesper uses narrow tapered low covers; Forge uses clipped industrial proportions; Serein uses lower clean broad covers. They share the eight-kind parametric library, not four unrelated asset libraries.

HYBRID and Core/Module junctions gain readable local terraces. TRUSS_POD and TWIN_HULL whole-ship changes are restrained, and bottom-only changes are small. Root structures on small hosts mostly read in close-up; these are supply/root covers, not a newly rebuilt engine system. The underlying sparse ships still retain a block-like design. We do **not** claim reference-quality engine machinery or equal visual success in every architecture. Gaps, trusses and existing physical silhouette masses remain preserved.

The initial default front-facing isometric hid aft roots, and a 1.25-length whole view cropped broad ships. Final review adds rear-isometric close-ups and 1.8-length whole views. Earlier raw inspection captures remain local; compact final sheets are the review evidence.

## Compatibility and actual Production UI

Final historical comparison: **14 versions × 5 views = 70 views**, every baseline/current pixel comparison and JSON-reload pixel comparison equal. The original 13 historical versions plus the approved stored V1.8.5.3 Blueprint are covered. Renderer options and diagnostics are read-only. See [history report](history/report.json).

The final built Production bundle passed **19 actual UI checks**: default version without DEV hooks, same Seed regeneration, different Hull on new Seed, all debug views including Root/Junction, rendering-only finish and OFF/LOW/HIGH/AUTO, real export/import with pixel match, saved reload, Orbit/Zoom/Fit, Requirements and mandatory XL, explicit impossible-order rejection, historical imports, and 390px responsive layout. Console/page errors: **0**. This responsive check is not a mobile GPU benchmark. [UI report](ui/report.json). TypeScript and Production Build passed; the existing large-bundle warning remains.

A separate common-order yard check (Cruiser 300m, Seed 7, MONOLITHIC/WEDGE_CITADEL) installs Aegis **2**, Vesper **4**, Forge **8**, Serein **3** root structures; all physical validation results are empty. Engine arrangements differ by original yard doctrine; counts are not a material-only comparison. [Controlled yard data](diagnostics/shipyards.json).

## Review images

- [Rear-isometric engine before/after, Detail OFF](review/engine-root-rear.jpg)
- [Four actual variants, close inspection](review/engine-root-variants-close.jpg)
- [Same 300m order in four shipyards](review/shipyards-controlled.jpg)
- [Five sparse architectures before/after](review/sparse-architectures.jpg)
- [Sparse underbody comparison](review/sparse-bottom.jpg)
- [Uncropped whole-ship before/after](review/engine-root-whole-final.jpg)

Complete candidate geometry/contacts and raw PNGs remain local; compact JSON summaries and selected JPEG review sheets are committed. Root/Junction debug line metadata carries saved IDs/decisions/contacts, but this release does not add a full interactive 3D picking Inspector. Actual arbitrary-axis placement throughout every upstream equipment generator, exhaustive intersection/crew-access proof, physical GPU/mobile performance and sophisticated exposed industrial engine frames remain outside the verified result.

## Same-environment performance

Chromium/SwiftShader, two-CPU workspace, 600px captures. No other test/browser job ran during profiling. Generation uses ten alternating pairs after two warm-ups. Meso-only stages use six alternating pairs after two warm-ups on the same actual physical source. These are representative Aegis Cruiser 300m Seed 7 values, not a worst-case bound for all engines/orders.

| Metric | V1.8.5.3 | V1.8.5.3.1 |
|---|---:|---:|
| Generation median (ms) | 1705.2 | 1881.0 |
| Standalone Meso planning median (ms) | 447.4 | 615.2 |
| Standalone safety replay median (ms) | 134.4 | 132.4 |
| Mesh construction median (ms) | 45.6 | 45.1 |
| HIGH QA mesh-pass calls | 25 | 25 |
| HIGH triangles | 20,620 | 20,812 |
| Raw scene main-pass calls, including lines | 26 | 26 |
| Shadow-pass calls | 16 | 16 |
| Attribute/index buffer bytes | 6,010,472 | 6,068,072 |
| Accounted texture bytes, including mipmaps | 1,485,483 | 1,485,483 |
| Three-ship main-pass calls | 77 | 77 |
| Three-ship visible triangles | 61,636 | 62,212 |

Actual root candidate discovery median: **162.9ms** (p95 182.8ms). Generation increases about **10.3%**. HIGH adds 192 triangles and no QA mesh-pass call. GPU programs remain eight in the measured three-ship scene. Five reload cycles retain stable geometry/texture counts; disposed ships leave zero geometries, the context's shadow texture and the pre-existing asset-cache reference count. Buffer/texture bytes are accounted asset footprints, not driver-private VRAM.

Cold-context caveat: `compileAsync` wall time is 24.4/24.7ms, but first frame **with readback** is 718ms before and 2,960ms after; a second new-context run is 3,162ms. This cold first-draw cost is **not resolved** and its driver/compiler/upload causes were not isolated. Steady readback medians are 181/168ms (159.6ms in the repeat); these are wall times, not isolated GPU frame time. Extension timer queries returned 124/159ms and 336ms in the repeat on **software SwiftShader**. Their variability does not establish hardware GPU performance. Actual desktop/mobile GPU performance is unverified.

The full [performance report](performance/report.json) retains measured samples, shader/frame timings, main/shadow passes, multi-ship counts and reload/cache evidence. Larger engines can require more candidate evaluation than this representative profile; redundant undersized variant trials remain an optimization opportunity.

## Changes and delivery

- Generation/version dispatch and optional schema-2 fields; preserved `legacy-build.ts`.
- `meso/root-planner.ts`: per-engine root surfaces and actual connector junctions.
- `meso/connector-scene.ts`: real renderer connector obstacle solids and immutable cache.
- Meso build/geometry/types/validation: four variants, functional ordering, exact support and final omissions.
- Rendering/Debug/UI and version-aware production/global validation.
- Ten new regression tests, explicit historical tests, reproducible browser diagnostics/UI/history/performance helpers and these compact review assets.

Original nine tracked local armor drafts and earlier untracked QA remain outside this release commit. The shared workspace is intentionally not cleaned by reset/removal. A separate delivery worktree can verify a clean committed source without touching these preserved materials.
