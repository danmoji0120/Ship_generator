# Functional Exterior Integration — one approved Wedge

## Scope / immutable baseline

2026-10-09 (Asia/Seoul). Baseline commit `ad547fd669d59c5cc40348432639623a89d44c2c` on `work`. Input: [approved Seed 7 export](ventral-flow/seed7-final/blueprint.json), SHA-256 `d47ca7bd81b9652eb6d29737bdecb60dd892ad115cb8c3f2f47d766d37d53964`.

Aegis / Cruiser / 300m / Seed 7 / MONOLITHIC / WEDGE_CITADEL only. The approved Seed 7 and [three-family structural review](ventral-flow/three-family-review/report.json) remain untouched. No other Family, Armor Language or 220-ship expansion. Existing rejected tile-language drafts remain local and are excluded from this commit.

All StructuralVolume, StructuralConnector, Macro plan and measurements, source dimensions, 29 approved upper/ventral masses, channel floors, pocket, joint contacts, source Foundation geometry, 31 Hardpoint positions/normals, original nozzle, Hull Integration, original Prefab prefix and MaterialTheme are identical to the input. This is verified directly in JSON, not inferred from screenshots. Source packet has no tile-panel layer to regenerate: armor coverage preservation here means retention of the complete approved structural armor solids and contact data. No new global 90% coverage claim is made.

## Implementation

Existing Prefab Registry, not a duplicate equipment generator:

- `ARMOR_ENVELOPE`: 23 long finishing lands on actual stored upper/bottom crest and lateral belt Station faces. Physical thickness 0.28 / 0.34m, 0.12m root embed and narrow edge bevel. Broad quiet faces, no fine panel lattice.
- `WEAPON_FOUNDATION`: source foundation remains the attachment authority. Low faceted housings, collar bases and open outboard apertures replace Normal-view marker visuals. Five large mounts have larger protected short shrouds; medium and point-defense mounts remain compact. Static equipment shape / installation envelope only.
- `MISSILE_BAY_HOUSING`, `SENSOR_HOUSING`: protected launch lids and low sensor apertures. Command cabin follows the approved plinth roof with a clipped, sloping front facet and seated glazing.
- `ENGINE_HOUSING`: the source nozzle remains inside an open annular casing and rear protection collar. Two actual structural supports meet the existing stern housings. No disk is added across the exhaust.
- `MACHINERY_HOUSING`: four selective upper service islands and one ventral pocket installation. Low support beds, exposed pump casings, collars/conduits and partial covers. Machinery does not fill the channels.

61 existing-kind Prefab assemblies, 207 closed component solids. `PrefabPlacement.assembly` stores world-space solid geometry, role/material, real parent attachments, equipment IDs and clearance cylinders. Optional `functionalExterior` stores the one-ship scope, coherent finish palette, armor contact area/direction, service occupancy, validation and overall Bounds. Schema 2 / generatorVersion 1.8.2 retained. Source MaterialTheme is not rewritten. Source hull panel shader is disabled only for this saved functional finish; no new random panel system is introduced.

`src/generation/functional/{types,geometry,build,validate}.ts`; `src/rendering/functional.ts`; extensions to Blueprint, existing Prefab renderer, Normal/Debug routes, materials, validation and QA camera Bounds. Shared-material batching retains each prefab/part ID and vertex range. Rendering does not run RNG or regenerate equipment.

## Actual render evidence

All images are Chromium/SwiftShader WebGL captures, 1200×1200. Orthographic **360m fixed frame**, center `(0,0,0)`, identical source/after cameras and illumination. BOTTOM / LOW-ISOMETRIC use the same lower lighting rig for both states. Neutral source/after uses identical clay material: geometric changes are not proved by palette differences. Composite sheets only resize square captures and add labels.

- [Five requested completed views](functional-exterior/final-review/five-views.png): TOP / SIDE / ISOMETRIC / BOTTOM / LOW-ISOMETRIC.
- [Upper before / after](functional-exterior/final-review/before-after.png).
- [Underbody before / after](functional-exterior/final-review/underbody-before-after.png).
- [Neutral before / after](functional-exterior/final-review/neutral-before-after.png).
- [Weapon, command, maintenance, drive and ventral closeups](functional-exterior/final-review/functional-closeups.png).
- [Installations hidden / mounted, identical armor](functional-exterior/final-review/hardpoint-comparison.png).
- [Saved complete Blueprint](functional-exterior/final-review/blueprint.json) and [capture/validation report](functional-exterior/final-review/report.json).

Visual inspection: upper citadel, shoulder hierarchy, side belts and ventral keel remain readable. Large smooth protection surfaces contrast with localized maintenance machinery. Weapon housings sit on their original foundations; the command aperture meets a broad front facet. The rear collar surrounds the original nozzle with a visible open center. The ventral service island remains recessed within the approved pocket.

### Issues found and corrected

First capture: full maintenance covers read as blank boxes; exposed machinery was poorly visible. Replaced tall boxes with low support beds, actual pump bodies/collars and short partial covers. Kept occupation and residual depth budgets.

First command glazing crossed the point of an octagonal nose, leaving its outer width visually unsupported. Changed the **new cabin**, not the approved command plinth, to a broad clipped front facet; narrowed and embedded the glazing frame. Later closeup confirms it is seated across the facet.

First aft protection collar read as a dark silhouette. Applied the shared armor material to its face while preserving the hollow geometry. Large weapon openings received short protected shrouds, without modifying source hardpoint locations or adding combat behavior.

## Validation / regression

- **40 relevant tests PASS**: 9 functional tests plus the preserved 31 upper/ventral structural tests (five suites). New tests cover input immutability, JSON determinism, exact source contracts, real attachments, open nozzle, deliberately obstructed exhaust/firing paths, occupancy limits, finite unit normals, Bounds, batching/IDs, Normal marker suppression and retained Hardpoints debug markers.
- Archived V0, V1, V1.5, V1.7, V1.8 and V1.8.1 JSON renders without added functional parts or input mutation. Existing structural suite additionally checks three V1.8.1 fixtures against unchanged generation.
- TypeScript and production build PASS. Existing large-chunk build warning remains.
- 26 final browser captures; console/page errors **0**. Repeated build JSON identical; exported JSON rendered in the same session produces identical ISOMETRIC pixels. Source JSON and original prefab prefix remain unchanged.
- Hiding functional hardpoint installations leaves every source armor component and every protection-prefab assembly unchanged. No foundation or hardpoint position is reseated in this pass.
- Upper channels: machinery footprint fraction **24.83%**, residual depth **7.545m**. Ventral pocket: **8.36%**, residual depth **7.5m**. These are conservative rectangular footprint budgets; they are not an exact free-volume solver.
- Stored face contact points are tested against actual approved triangle solids / Hull, with bounds used only for broad phase. Exhaust/thermal cylinders are never exempted for the owning engine. Static outboard apertures are tested against Hull, armor and neighboring/self installation parts.

No unapproved bulk QA is rerun. Commit-tree-only reproduction and production UI smoke evidence are recorded in the final verification appendix below.

## Performance / limits

Same capture rig, fixed 360m full views: **205 → 101 Draw Calls**, **9,228 → 18,864 triangles**. Functional parts merge into six shared-material meshes; replaced marker geometry is not rendered twice. Draw Calls decrease while geometry increases. These are total rendered-scene diagnostics for this one approved ship, not a 220-ship average or mobile GPU result.

Initial functional build 135.7ms; seven subsequent samples, median **45.2ms**, sample p95 **87.6ms**. This measures clone + assemblies + functional validation from an existing Blueprint. It is not whole Ship Order generation and cannot be directly compared with V1.8's 6.65ms generator number. Exact-solid attachment/collision validation is a remaining CPU cost; seven warm samples are indicative rather than a broad benchmark.

Remaining limitations: still a parameter-based low-poly review ship, not production reference art. Broad bow face and the existing dense hardpoint layout are retained; no unsupported claim of final art approval. Hull, armor and equipment are intentionally intersecting closed solids, not a watertight CSG union. Reservation checks use triangle/edge samples and reciprocal cylinder samples, not exhaustive triangle intersection or a dynamic aiming solver. Source foundations and compact footprints constrain equipment size. No actual weapons, damage, thermal behavior or crew systems. No mobile GPU test. Other Families are intentionally not adapted pending this exterior review.

Workspace cleanliness must not be falsely claimed: previous rejected draft files are preserved unstaged. Only the single-ship implementation, tests, documentation and final evidence belong in this commit.

## Final commit-tree verification

The staged source was exported independently, excluding all previous unstaged drafts. **Five test files / 40 tests PASS**, TypeScript and production build PASS. The same one-ship capture was rerun from that source: **complete JSON + all 26 original PNGs match byte-for-byte**; repeated same-session export/render pixels match; console/page errors 0. [Compact verification](functional-exterior/verification/commit-tree.json).

The production build keeps the original V1.8.1 default generator; the new one-ship review is not implicitly applied. Existing Seed 7 same-seed regeneration, JSON inspector/download equality, 16 Debug modes, TOP/AFT/ISO/Fit and orbit/zoom input smoke all PASS, console errors 0. No gallery/bulk generation was used. [Production UI evidence](functional-exterior/verification/production-ui.json).

The verification capture overlapped other test/software-render work: its seven warm assembly samples measured median **116.1ms**, sample p95 **252.9ms**, initial **285.6ms**. Both runs are reported rather than selecting only the faster number. This host-load-sensitive QA timing is not an isolated production benchmark or a mobile result. Render geometry and Draw Calls are identical between runs.
