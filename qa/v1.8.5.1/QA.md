# V1.8.5.1 Material & Emissive Pass QA

Baseline: `34fde4203b78cea1fd34154664a7e2262b8bae1b`, `work`. Existing uncommitted armor design experiments and historical QA were retained. Release source is staged separately from those experiments and verified in an isolated workspace.

## What changed

Five shared material layers separate primary/secondary armor, exposed machinery, dark recesses and functional surfaces. Four shipyard palettes also differ in physical roughness/metalness and contrast. All 21 existing kits have versioned material and optional emissive/marking rules. Seven functional emissive roles are supported, without bloom, point lights or animations. Surface masks create small hatch outlines, status points, guide strips, sensor lenses, bridge windows, hazard coloration and identification strokes on existing geometry.

No new physical panel, solid, opening, foundation or equipment is generated. Position/index/normal buffers and triangle counts are unchanged. Serialized `materialAppearance` is the only added design field, with top generatorVersion 1.8.5.1. The complete V1.8.5 canonical JSON is reproduced by removing this field and restoring its version. Independent Macro/armor/weapon/detail RNG streams and all mandatory requirements are untouched.

## Actual visual evidence

The captures are real Three.js WebGL screenshots at identical camera/physical scale/lighting before and after. No neutral override, bloom or image generation was used. Close-ups use the same local inspection light on both versions.

- [Whole ship and underside before/after](images/before-after.jpg)
- [Hatch, maintenance channel, propulsion and weapon service close-ups](images/closeups.jpg)
- [Command windows](images/bridge-window.jpg)
- [Four shipyard close-ups](images/shipyards.jpg), [whole ships](images/shipyard-ships.jpg)
- [Six compatible Family/Architecture examples](images/families.jpg)
- [OFF / LOW / HIGH / AUTO](images/lod.jpg)
- [40 / 120 / 300 / 600 m](images/lengths.jpg)
- [Final capture matrix and exact JSON/reload-pixel assertions](final/report.json)

Aegis has pale blue-white restrained indicators and dark steel rails; Vesper cooler smooth finishes and slim details; Forge warm rough paint and amber maintenance points; Serein lower-contrast clean gray-green surfaces and soft mint-white indicators. Large armor areas remain deliberately blank. Tiny human-scale details stay subtle at whole-ship distance and become readable in close-up. SIDE/FRONT/AFT/BOTTOM maintain the same geometry and new surface hierarchy. Indicators never grow with ship length: status masks are physically capped to 0.24×0.36 m, guide marks to 1.10×0.14 m; windows follow actual command housing dimensions.

Two visual issues were corrected during review: status marks on large existing machinery initially scaled too far, so physical caps were added; command optics could be hidden by the existing command housing, so actual housing faces receive a narrow segmented window band while separate optics retain sensor-lens shading. The final window band is only 9% of housing height and has no halo. No hull/armor or reserved opening was moved to make a mark visible.

## Verification

Final staged source was frozen for the full run: **22 files / 663 tests PASS**, 668.74s. An additional **10/10 preserved local draft tests** passed separately and are not part of the release commit. TypeScript and Production Build PASS. See [validation-summary.json](validation-summary.json). An initial run mixed a newly updated bridge assertion with cached earlier renderer code because the verification tree was refreshed during the run; the final immutable-source full rerun passed all 663. Physical geometry/clearance thresholds were never relaxed. Historical comparisons use an unmodified `git archive` of the V1.8.5 baseline and staged release source, same Chromium/SwiftShader and camera.

- [Historical pixel report](history/report.json): 11 saved versions (V0, V1, V1.5, V1.7, V1.8, V1.8.1, V1.8.2, V1.8.3, V1.8.4.1, V1.8.4.2, V1.8.5) × 5 views = 55 exact baseline matches and 55 exact JSON-reload matches; console errors 0.
- [Actual Production UI report](ui-final/report.json): 19 checks, including new orders/seeds, debug rendering, all four detail modes, export/import/reload WebGL pixels, orbit/zoom/fit, required XL installation, explicit impossible-XL rejection retaining prior valid Blueprint, historical import, and 390px responsive layout; console errors 0.
- [Requirements control comparison](requirements-regression.json): original release/rejection, layouts, reservations, usage and explanations compared after excluding timing fields only.
- [CPU and main-pass draw/triangle counters](performance/report.json): same machine/browser, paired runs, two warm-ups excluded. Counters exclude shadow passes, as in prior QA.

## Performance (same environment)

300m Aegis Cruiser Seed 7, same browser/machine, 10 paired samples after two warm-ups. These timings include the complete unchanged V1.8.5 detail placement/validation pipeline, not just material setup.

| Measurement | V1.8.5 | V1.8.5.1 |
|---|---:|---:|
| Generation median | 964.7 ms | 1002.8 ms |
| Generation p95 | 1016.0 ms | 1069.1 ms |
| Mesh construction median | 9.6 ms | 27.4 ms |
| Mesh construction p95 | 18.7 ms | 62.4 ms |
| OFF main-pass calls / triangles | 15 / 11,386 | 14 / 11,386 |
| LOW main-pass calls / triangles | 19 / 16,694 | 18 / 16,694 |
| HIGH main-pass calls / triangles | 23 / 18,034 | 22 / 18,034 |
| AUTO (500px projection) calls / triangles | 19 / 16,694 | 18 / 16,694 |

Measured generation median delta +3.95%; appearance-selector assignment itself rounded to 0.0 ms median / 0.1 ms p95. The small full-generation difference includes normal runtime variance. Semantic batching reduces one main-pass material draw in this representative. Additional local surface attributes increase **one-time** mesh construction by 17.8 ms median; they are not recomputed per camera frame. GPU fragment time, total shadow-pass draws and real mobile GPU performance were not benchmarked. Triangle equality therefore is not a claim of zero rendering cost. No geometry or device simulation was added.

## Intentional limits

No textures, wear, physically cut windows, active device simulation, moving status indicators, light casting or bloom were added. Markings are analytic surface shading, not new physical openings or armor thickness. Large blank armor remains intentionally simple. The shader uses additional per-vertex attributes and fragment work; triangle equality does not imply zero GPU cost. Material bucketing may add a few draw calls. AUTO is visibility LOD with unchanged 90/650px thresholds; at this gallery's 800px/360m frame the representative's AUTO shows both groups, while the 600px performance frame shows MESO only. OFF removes optional lights with their kits but retains the base paint and essential command-window expression.

Historical source rendering is frozen by absence of materialAppearance; importing an old Blueprint never opts into the new theme. Pixel equality is a same-browser/GPU-environment guarantee, not cross-driver certification. Mobile screenshots validate responsive UI only; real mobile GPU performance was not tested. All original sampled collision, firing arc, negative-space and simulation limitations remain. Preexisting user drafts are intentionally left in the worktree and are excluded from the release commit.
