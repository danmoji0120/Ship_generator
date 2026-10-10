# V1.8.5.4.2 — Equipment Fitment & Battery Refinement

Base: local `38ed9758169c3800a9797e4efd2a61ce4741e2dd`, clean `patch/v1.8.5.4.1`. Work is isolated in `patch/v1.8.5.4.2`. The original `work` folder's nine tracked drafts and previous untracked QA are preserved. No combat-demo changes; no push.

## Implementation

Seven procedural modules: 105mm single, 210mm twin, 406mm twin, 500mm single, compact 6-tube / medium 12-cell / heavy 24-cell missile modules. See [contracts and dimensions](../../docs/EQUIPMENT_FITMENT_PREVIEW.md). Shared caliber does not dictate slot class. Foundation contact, module compatibility, actual solids, local-frame operation samples and launch paths are separate contracts.

Single / Pair / Battery / Auto are runtime-only, including the optional longer paired M battery trial. Worker planning runs on demand; the generator is unchanged. OFF disposes temporary geometry/materials and restores the original render. Normal views never show empty-slot markers. Canonical Blueprint version remains **1.8.5.4.1**, schema 2; app and PreviewPlan use **1.8.5.4.2**. No saved Blueprint migration.

## Representative visual QA

Actual Chromium + WebGL SwiftShader captures, same Blueprint/camera/light before and after. The primary 470m Aegis Battleship / SPARSE / Seed 7 is the previous replacement fixture, **not the unknown original user's observed Seed**.

| Case | Preview | Outcome |
|---|---|---|
| 470m Aegis MONOLITHIC / WEDGE_CITADEL / Seed 7 | TOP M pair | Both seated; limited firing arc |
| Same | Original battery | Four slots: two M turrets per side |
| Same | Refined battery | Six existing EMPTY M slots: three per side, equal longitudinal spacing |
| Same | 406mm L pair | Both seated; independently restricted sampled arcs |
| Same | Medium missile pair | Both valid, 12 tube exits per launcher clear for initial path |
| Same | Representative AUTO | 32 accepted: 6 L guns + 26 M guns; one tested L rejected, 67 untouched slots explicitly untested |
| 300m STACKED_BLOCKS / Seed 7 | M battery | Four valid installations, partial arcs |
| 300m SPINE_AND_MODULES / spinal design / Seed 7 | M battery | Twelve valid installations: six per side, partial arcs; original XL preserved |
| 300m TRUSS_POD / Seed 7 | M pair | Both valid installations, partial arcs; open structure preserved |

TOP / FRONT / SIDE / ISOMETRIC captures for all four representatives remain locally as original PNGs. Compact committed review sheets:

- [470m paired battery before/after](470-battery-before-after.jpg)
- [Large gun, missile and arc gallery](equipment-gallery.jpg)
- [Other architectures](representative-ships.jpg)
- [Production Inspector](ui-preview.jpg)

### Human visual review

Viewed the real TOP, ISOMETRIC, SIDE comparison sheets and the 406mm close-up. The refined rear M mounts form deliberate mirrored three-station rows. The spinal design demonstrates six-station rows without filling gaps between independent modules. Gun barrels, rotating bases, cheeks and missile tube apertures are distinguishable. Foundations contact measured armor; no fixture openings or original installed weapon geometry were edited.

The 470m hull is very broad: M turrets remain modest at full-ship scale, and existing main guns dominate the scene. These are fitment-check models, not final art assets. The unrestricted 100-slot prototype looked crowded and cost 72.3s in a later isolated Node run; it is **not the shipping AUTO policy**. The representative cap prevents that display and reports omitted slots honestly.

## Battery trial

Existing nearby EMPTY M pairs are temporarily moved, never cloned into new slots. Mandatory request IDs, installed weapons and L reservations are protected. Six slot positions are independently resolved and all 17-contact foundations, OBB external/internal reservations, protected functions and mirrored normals pass. Final preview uses slots `54/55`, `60/61`, `71/72`; original JSON does not change. Five- and four-row attempts collide with preserved L `slot-22`; three rows pass. This is a reversible preview proposal, not a permanent generator change.

## XL diagnosis

169 existing bounded XL candidates were replayed, with actual support surface and collider IDs retained in [XL summary](xl-summary.json):

| Primary rejection | Candidates |
|---|---:|
| Insufficient coherent 17-point support footprint | 144 |
| No exposed surface | 20 |
| Incoherent cap footprint | 3 |
| Insufficient internal pocket | 1 |
| Operating envelope interference | 1 |

Four empty-slot overlaps accompany the last operating-envelope failure; they are **not four independent primary failures**. No candidate passed all physical conditions before considering existing empty slots. Therefore the tested candidate set does not demonstrate a missed usable XL location. This is bounded evidence, not a mathematical proof that no possible XL installation exists anywhere. No surface tolerance, collision exception or XL forcing was introduced.

## Targeted tests and UI

- Existing `modular-hardpoints.test.ts`: 8 PASS.
- Existing `large-first-layout.test.ts`: 4 PASS.
- New `equipment-preview.test.ts`: 13 PASS. Covers compatibility / occupied slots, 17 measured contacts, limited sample arcs, bottom/side frames, actual body/barrel obstruction, blocked missile exit, pair rollback and missing counterpart, real batteries / caching / JSON invariance, safe nearby empty-slot refinement, single-preview immutability and non-axial engine exhaust protection.
- 25 distinct targeted cases PASS (13 fitment + 8 modular hardpoints + 4 large-first). Additional geometry checks cover closed outward-wound foundations, connected base/body collars and a genuinely supported flush XL interface with a physical preview shim.
- TypeScript and Production Build PASS. Existing large-bundle warning remains.
- Production UI: 12 focused checks PASS (no DEV helpers, worker/refined battery, cache/debug, incompatibility, OFF, JSON invariance, reload/export). Console errors 0. AUTO OFF / Reload / Export use forced Playwright pointer clicks to bypass software-render frame-stability waits after AUTO; real DOM pointer/change events are used, not direct handler calls. Hardware UI responsiveness is not inferred from this software-render run. Actual browser captures also report errors 0.
- Same-input canonical JSON hashes matched baseline in all three alternating generation pairs.
- OFF restoration: exact pixels at TOP / FRONT / SIDE / ISOMETRIC plus large-gun close-up. Export has no preview equipment, temporary slot moves or fitment records.
- Eight ON/OFF cycles: renderer geometry count 30 → 34 → 30, textures 3 → 3 → 3. This is bounded resource-lifecycle evidence, not exhaustive browser memory proof.

**Not run:** full 600+ suite, historical all-version pixels, every architecture/shipyard/seed combination, combat-demo tests or large random experiments. No claims of those checks.

## Performance

See [same-environment CPU measurements](performance.json), [browser fitment summary](render-summary.json) and [representative/lifecycle measurements](representatives-summary.json). Performance timing and rendering timing are separated; final isolated CPU figures are recorded below.

A two-L-gun preview adds four batched mesh draws (five with optional debug lines). Measured close-up renderer counters without debug: draws **29 → 33**, triangles **26,270 → 27,646**. These are `renderer.info` frame counters, not separately measured main/shadow-pass GPU timings. Preview OFF has no additional mesh draws or live geometry. CPU parameter-space models/contact probes and Blueprint-scene queries are cached; no per-frame fitment work.

Hardware GPU frame time, real GPU memory bytes and hardware fleet performance are **not measured**; browser rendering used software SwiftShader.

## Remaining limitations

- 30° yaw and four elevation samples do not prove continuous sweep clearance. Neighbors use accepted static poses, not exhaustive simultaneous turret motions.
- Existing sampled solids plus ray-triangle queries do not prove every concave intersection.
- Geometric support / internal interface reservation is implemented; real mass/loading, feed, ammunition and power calculations are NOT SIMULATED.
- Missile paths cover initial straight outward segments, not guidance or complete flight.
- Only selected representative fitments were visually checked. No validation claim for every one of the seven modules on every architecture; small default turret/utility slots may correctly reject missile interfaces.
- Compatible alternate IDs are suggestions awaiting geometric validation.
- AUTO intentionally evaluates a representative maximum 32 accepted modules; omitted slots are not physically certified.

### Final isolated CPU figures

Three alternating generation pairs, Node 24.19.0 in the same container:

| Measurement | Result |
|---|---:|
| Baseline generation median | 5,959.6ms |
| Current generation median | 6,088.5ms |
| Refined six-slot battery, first request | 234.9ms |
| Repeated cached request | 0.017ms |
| Representative AUTO: 32 accepted / 33 tested | 21,688.1ms |

The +2.2% generation timing difference is a small-sample environment measurement, not a claimed pipeline optimization or an attribution to Preview: all three canonical JSON hashes match and Preview work is absent from generation. Browser representative AUTO measured about 5.60s in its capture environment; Node and browser times are not compared as equivalent benchmarks. Heavy auto checks remain on-demand and run in a cancellable UI Worker.

## Reproduction

Run from this worktree with installed dependencies:

```sh
npx vite-node tests/equipment-fixtures.ts
node tests/equipment-server.mjs
# In a second terminal:
QA_URL=http://localhost:5183 node tests/equipment-render.mjs
QA_URL=http://localhost:5183 node tests/equipment-representatives.mjs
python3 tests/compose-equipment.py
npx vitest run tests/equipment-preview.test.ts tests/modular-hardpoints.test.ts tests/large-first-layout.test.ts
npm run build
npm run preview -- --port 4282
# In another terminal:
node tests/equipment-ui.mjs
```

The optional CPU comparison helper `tests/equipment-performance.ts` expects the read-only baseline sibling worktree `../Ship_generator-v18541` at `38ed975`. Raw PNGs, generated Blueprint fixtures and detailed per-sample reports remain local and ignored; compact sheets and summaries are committed. No large binary Blueprint payloads or full logs are printed or committed.
