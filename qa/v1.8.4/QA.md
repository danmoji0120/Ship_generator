# V1.8.4 — Unified Procedural Ship Generator QA

## Scope and authority

Started from local `work` / `d52d504abc4e29aa5c00438f3deac1b790304940` (V1.8.3). Six approved commits were ahead of origin; no remote divergence. Existing dirty tile-language drafts and old QA images were retained, with a task-start copy outside the repository. Only the intended production change is staged. No stored Seed 7 file, review builder or prefab-coordinate template is imported by `generation/production/`.

Schema remains 2; new default is generatorVersion 1.8.4. `productionDesign` owns major armor, large finishing courses, channels, protected reservations, measured coverage, functional assembly IDs, exterior bounds, stage contracts, candidate failures and omissions. `weaponLayout.status = production` owns order-derived budgets, shared physical standards, atomic groups, final armor contacts and static local firing arcs. No new `layeredArmor`, `structuralArmorPilot` or one-ship `functionalExterior` is generated. Historical optional fields are rendered only when stored.

## Pipeline and design decisions

1. Normalize Order/Seed; existing yard/role Architecture and compatible Macro Family.
2. Existing station-based Hull/Connector, Macro measurements and functional openings.
3. Actual station width/deck/root queries → primary/shoulder/plinth/belt and independent keel/belly/cradle. Three bounded longitudinal protection variants, family intervals and yard-dependent tiers/bevels. No shipLength/300 template transform.
4. Major armor first; long surface-conforming finishing courses only on uncovered exposed faces. Internal contacts, nozzle/spinal apertures, hangar access and intentional exposed axes have explicit area exclusions. A local opening splits its own nearby finishing course rather than deleting the whole flank.
5. Existing registry assemblies: actual command plinth, open engine casing, channel machinery, thermally unobstructed support. Optional unsupported equipment is recorded as omitted.
6. Role/priority/yard/size/available surface budget, integrated XL reservation, centerline / bilateral / longitudinal / PD groups. Bounds and all 17 actual final-surface contacts precede acceptance. Whole groups shift on a bounded longitudinal lattice or are omitted; armor is never deleted to install a mount.
7. One full production validation pass. Mandatory failure rejects the candidate; up to three production candidates within the same Architecture/Family. Timing observers are outside authoritative JSON.

The 8 Architecture / 6 Macro Family compatibility table is unchanged from V1.8 and is listed in README. All 29 compositions remain. Yard armor factors and structure doctrine change mass tiers/bevels/finishing thickness; existing macro doctrine changes actual Hull proportions. Yard weapon doctrine changes protected batteries; role/firepower/missile/size determine counts. XL preserves the integrated spinal contract, not a scaled surface turret.

## Actual browser evidence

- Phase A: regenerated Aegis Cruiser 300m / Seed 7 / MONOLITHIC / WEDGE_CITADEL; source Order, StructuralVolume, MacroDesign and Engines match the approved source. New armor is generated independently, with different adaptive proportions; no claim that the prototype's exact 29 hand-refined masses were copied.
- Phase B: WEDGE seeds 7/11/23/41: different real Hull/armor shapes and retained upper/lower hierarchy. [Four seeds](contacts/wedge-seeds.jpg).
- Phases C/D: six explicit families; upper/lower independent design, pods/negative space/trusses retained. [Family gallery](contacts/families.jpg).
- Phase E: four yards and 40/120/300/600m review captures; 108 automated role/yard/length orders plus 16 priority/mass extremes. [Same Hammerhead Seed/Order, four yards](contacts/shipyards.jpg).
- Phase F: **220 unique designs**, 8 Architectures × consecutive seeds 0–19 in Aegis, plus BLOCK_ASSEMBLY × other 3 yards × seeds 0–19. **220/220 valid, no browser errors, no production candidate retries** in this range. Each has ISO and LOW-ISO (440 actual WebGL renders), plus representative eight-direction and debug captures. Raw bulk thumbnails stay outside Git; compact labelled sheets preserve the reviewed range.
- [Approved V1.8.3 / new V1.8.4](contacts/before-after.jpg): identical Order/Seed and 360m orthographic frame; only pixel resolution is resampled in the sheet. This compares a hand-reviewed prototype with an order-generated ship, not a claimed visual replacement of its saved JSON.
- [Hull / structural armor / no hardpoints](contacts/structure-progression.jpg): major tiers, channels, side belt and ventral keel remain without weapon/panel overlays.
- Representative Wedge uses fixed 360m frames. Other families have separately labelled Auto Fit views; their very wide geometry can exceed a 360m fixed frame. No camera-size difference is used to claim before/after improvement.

## Coverage and weapons

Area denominator: actual exposed station triangles, excluding measured internal contacts and clipped functional openings. Coverage is sampled against the stored closed solids and recomputed on import; metadata percentages are not trusted. Integration housings count their own protective surface, without adding it again as a hull layer.

| Direction | Minimum, 220 designs | Mean |
|---|---:|---:|
| TOP | 86.86% | 97.95% |
| BOTTOM | 91.41% | 98.01% |
| PORT | 95.93% | 98.87% |
| STARBOARD | 95.93% | 98.89% |
| FORE | 97.69% | 99.78% |
| AFT | 97.57% | 99.55% |

**Two explicit protection warnings:** Aegis MONOLITHIC / WEAPON_DOMINANT seeds 9 and 18 have TOP coverage 86.86% and 89.77%. Existing spinal/adjacent-structure protection leaves some eligible upper area exposed. The 90% QA target is not falsely declared passed for these cases; residual area and omission reasons remain in the blueprint/report. Other five directions meet the target for every design. 218/220 meet it in all six directions.

Seed 7 Wedge: **TOP 5 / BOTTOM 4 / PORT 2 / STARBOARD 2**, 13 external mounts. S footprint 4.5×5.5m, M 11.5×13m, L 26×30m; L equipment envelope 27×16×43m at 300m ship scale. XL is hull integrated with 45×75m envelope contract and separate cost. These physical contracts are unchanged; smaller ships use the shared bounded cube-root scaling. There is one large centerline cannon on this order, not a forced duplicate pair. Across 220, TOP and BOTTOM mounts occur on 187 designs each; PORT/STARBOARD on 206 each. Accepted bilateral groups always install together; physically unavailable groups record coherent omission. Not every order is forced to use every direction.

## Compatibility, UI and determinism

Same Chromium/SwiftShader, fixed camera/light/material, unmodified HEAD baseline renderer versus final optional-field renderer: **8 historical version samples × 5 views = 40 byte-identical historical WebGL captures**, also identical after JSON round trip. V0 is frozen using the unmodified baseline generator; V1/V1.5/V1.7/V1.8/V1.8.1/V1.8.2/V1.8.3 use saved artifacts. [Pixel hashes / sources](history/report.json). Historical generator fixtures and assertions remain.

Actual compiled Production UI: default V1.8.4 without DEV hooks, new Seed changes Hull, same Seed exact JSON, all debug tabs, real Export/Import and Reload with identical canvas pixels, Orbit/Zoom/Fit, V0/1.8.1/1.8.2/1.8.3 import, 390px no-overflow layout; **12 checks, Console/page errors 0**. [UI report](production-ui/report.json). Mobile GPU performance was not measured.

## Failures found and corrected

- Initial broad finishing plates were too fragmented around facets. Replaced uniform patches with actual long facet courses; clipped patches are used only near real functional openings.
- Hexagonal pod belts originally connected top/bottom by a chord that missed the real mid-flank. Production belts now include the actual mid-section root and safe concave-cap triangulation. Historical geometry stays on its original path.
- Radiator outlet could face adjacent armor relief. Test the actual thermal reservation before emitting equipment; omit unsupported outlets without removing armor.
- Armor could fill an actually empty sampled negative-space target. Check the target against original Hull occupancy and new closed armor solids; omit that mass with a reason.
- HYBRID Seed 6 exposed reciprocal hangar intersection missed by an old contour winding shortcut. Use the same stored-solid containment rule in candidate generation and final validation.
- Vesper BLOCK_ASSEMBLY Seed 12 hit floating-point Z just beyond the aft station. Production contact lookup now clamps to the real aft ring. Historical lookup is untouched, preserving V1.7 exact generation fixtures.
- Wide Carrier finishing skin was wholly discarded for a small opening. Bounded local station sections/clipped opening perimeter preserve the long flank; worst sampled side coverage improved from approximately 46% to 98% without blocking access.
- Duplicate final weapon validation was removed: one complete pass still performs every mandatory check. Triangle BVH, cached immutable surfaces/solid probes, broad phase and reciprocal collision tests reduce repeated work.
- A monolithic historical 220-case test exceeded its scheduling time budget while browser QA competed for CPU. All cases/assertions are retained in 11 bounded 20-case batches; no geometry/contact/clearance threshold was loosened.

## Tests / build / performance

**Final staged-source automated run: 209/209 PASS, 15/15 files, no unhandled errors (314.80s).** This includes every historical assertion/case, 20 production contract tests, 36 role/yard batches (108 orders), and 16 priority/mass extremes. The historical 220 cases are split into 11 bounded batches with unchanged assertions. TypeScript noEmit and the Vite Production Build both PASS on the same intended source tree. The isolated CPU comparison is recorded below. The Three.js/viewer chunk remains approximately 727kB minified / 201kB gzip and emits Vite's size advisory; this is not a TypeScript or runtime error.

220-design render sample, same lit orthographic rig: mean **53.95 draw calls / 14,719 triangles**, maxima **126 calls / 19,410 triangles**. Materials and armor/functional parts are batched while per-part Blueprint IDs and vertex ranges remain available. This camera rig includes its stored shadow settings; these numbers are not substituted for a mobile GPU benchmark. Bulk CPU measurement overlapped tests, so it is labelled contended; use the isolated report for the direct V1.8.3 comparison.

## Known limits / explicit failed order

- Aegis Cruiser / **40m / Light / all priorities 0 / Seed 41** cannot fit even one complete standardized weapon group. All three candidates are rejected with `Required weapon budget has no physically installable complete group`. It is reported as a physical design failure, not rendered as a valid weaponless warship. Other 15 tested mass/priority extremes generate successfully.
- Two TOP coverage warnings above remain. Unsupported sockets/equipment or whole weapon groups are explicitly omitted. Some slender/low-profile yard designs have no valid side or bottom group for a particular order.
- Static local sampled arcs, 17-point foundation contacts, OBB broad phase and reciprocal solid samples do not prove every triangle intersection or continuous aiming angle. No CSG union, arbitrary rotated Hull, battle/damage/interior system.
- Large geometric masses are readable, but some broad fore caps and command housings still have simple faceted forms. This is an integrated procedural baseline, not a claim of reference-level art parity for every order.
- A command plinth or casing may be omitted where physical dimensions/openings do not permit it. Existing Engines/spinal openings remain functional contracts; no simulated heat/weapon operation is added.
- Existing uncommitted experimental files are intentionally preserved outside the commit. A completely clean original workspace would require removing those user-owned drafts and is not claimed.


## Final isolated CPU profile

Browser capture, test and build workers were stopped during these measurements. All times include mandatory production safety validation; timing data is not serialized into authoritative Blueprint JSON.

| Path / sample | Median | p95 |
|---|---:|---:|
| Frozen V1.8.3 layout, same source Blueprint | 461.3ms | 523.2ms |
| Optimized layout, same source Blueprint | 184.1ms | 265.4ms |
| Complete Seed 7 production generation | 161.6ms | 184.2ms |
| Complete 220-design production range | 343.3ms | 487.2ms |

220-design phase medians: Hull 4.1ms, armor 46.2ms, coverage 41.6ms, functional exterior 67.2ms, installation 105.6ms, final validation 74.8ms. Phase medians are independent statistics and need not sum to the total median. Maximum total time was 557.3ms. This remains heavier than V1.8's geometry-only generation; no claim of interactive-frame or mobile-GPU performance is made.

[Isolated same-source comparison](performance-isolated/report.json), [220-design CPU profile](cpu-profile/report.json). The earlier 662ms V1.8.3 record used a different session and is not substituted for this controlled baseline. All 11 continuous-range contact sheets have now been visually reviewed, including the three additional Shipyards.
