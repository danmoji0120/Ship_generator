# V1.8.5.5 — Free-Mount Equipment & Adaptive Platforms

Baseline `619725b18e58deda87bec069303c9d4f13dcc211` was verified locally and on `origin/patch/v1.8.5.4.2`. Work is isolated in `feature/v1.8.5.5` at `/workspace/Ship_generator-v1855`. Original `work` has nine tracked user drafts plus older untracked QA; none were reset or edited. No combat-demo changes, force operations or remote Push.

## Delivered behavior

Default generation preserves the Requirements-first Hull / armor / automatically installed weapons / engines / Meso / exterior kits, but omits EMPTY reservation planning. The 470m case has **20 original installed mount records, zero empty slots**. User installations live separately in `freeMountPlan`; existing hardpoint records are unchanged. Explicit Legacy 1.8.5.4.1 generation and its original inspector/Preview remain available. Orders containing old slot requests require that mode; Free mode reports a migration error rather than fulfilling nonexistent slots.

Equipment Editor uses exact Hull/Armor triangle picking, stable ship-local anchors/frames, immutable Worker ghosts and final full validation. Single, Mirror and Battery (1–8 rows) are supported. Platforms, 1m tangent-plane snap and heading are configurable. Launcher tilt is separately adjustable within ±30°; actual tubes, yoke and initial exit vectors transform together. Right drag / wheel / Fit retain camera control. Alt+click or the installed list selects new free equipment. Move, Rotate, Clone, Mirror, group/individual deletion, Undo/Redo and existing Save/Load are wired. Baseline automatic weapons are read-only. Regeneration retains exact valid player anchors; an invalid replacement is rejected while the current ship remains. Remove-all is an explicit Undoable player-equipment action.

The interface supports DIRECT_VALID / PLATFORM_VALID / INVALID. Ghosts are explicitly lightweight; a click performs full sampled inspection. Groups commit atomically. When individual editing breaks a pair, obsolete pair metadata is removed; Undo restores the original group. A matching recipe is attempted when one side needs a different support class. Near-mirror correspondence and common supported heights remain required; arbitrary asymmetric counterpart synthesis is not implemented.

See [ownership, recipes and validation contract](../../docs/FREE_MOUNT.md). No internal volume, feed, power, stress or recoil condition rejects free fitment. Legacy reserved-slot Preview is limited to unedited ships so it cannot ignore newly installed free assemblies. Physical scene solids, actual support contact, external openings, engine exhaust, sensor/service access, canonical firing paths and intentional negative-space samples remain protected.

## Representative actual ships

Freshly generated from Order / Seed, not coordinate-shifted stored models. All use Seed 7. The 470m Aegis / SPARSE order is the prior replacement fixture, **not the unidentified original user's observed Seed**. Density is retained as legacy order metadata and has no free-mode reservation effect.

| Design | Actual free assemblies | Results |
|---|---:|---|
| 470m Aegis MONOLITHIC / WEDGE_CITADEL | 12 | Four 210mm guns per side, central 500mm on Raised Barbette, paired side missile modules on Pylons, Utility Pod on Pylon |
| 300m STACKED_BLOCKS | 9 | Three 210mm guns per side (four use Flush bases), paired side missiles and Utility Pod on Pylons; central 500mm candidate search rejected |
| 300m SPINE_AND_MODULES | 4 | Direct 500mm, paired direct side missiles, Utility Pylon; retained original spinal installation; tested three-row battery rejected |
| 300m TRUSS_POD | 4 | 500mm Raised Barbette, paired direct side missiles and Utility Pylon; tested three-row battery rejected; open trusses retained |

All four baseline Hull / production armor / weapons / engines / Meso / exterior kit JSON sections are unchanged by editing. TOP / FRONT / SIDE / ISOMETRIC are captured with the same camera and lighting before/after; actual close-ups show support attachment and open pylon structure.

- [470m four-view comparison](470-free-mount-before-after.jpg)
- [Platform / main gun / side missile close-ups](platform-closeups.jpg)
- [Other architectures](architecture-comparison.jpg)
- [Actual Editor](editor.jpg)
- [Actual 20° launcher tilt](launcher-tilt.jpg)

Human review: mirrored rows read as a planned battery. M guns remain visually modest against the very broad 470m hull; existing larger automatic guns dominate. Platforms are attached and the two Pylon supports show a real gap. Prototype models remain simple validation assets; this is not a full exterior-art polishing pass. The central 500mm uses the actual local sloped mount frame rather than a world-up correction.

DIRECT, FLUSH_BASE, RAISED_BARBETTE and PYLON_BRACE occur automatically in these four designs. All five adaptive kinds, including SIDE_SPONSON and BOX_PLATFORM, were physically built/validated on a clear actual-triangle test hull. **SIDE_SPONSON / BOX_PLATFORM did not win the automatic candidate search in the four representative ships**; code/unit coverage is not claimed as an automatic production visual success for those kinds.

## Failure evidence and fixes

STACKED_BLOCKS central 500mm search conflicts with command-deck caps / fore-guard Meso / magazine deck / existing cannon firing paths, or cannot supply a coherent root. SPINE_AND_MODULES battery candidates hit absent nearby surfaces, a root/connector or insufficient continuous support. TRUSS_POD tested array starts lack usable nearby source surfaces. These are bounded candidate-search results, not proofs that no possible custom player layout exists. No partial group was silently installed.

A saved valid restricted-arc assembly was initially incorrectly rejected by a quick ghost replan during import certification. Fixed: stored anchors/recipes are replayed exactly, followed by full operation samples. A regression fixture has an INVALID forward-only ghost but a valid restricted full arc; save/reload now passes. Final STACKED_BLOCKS battery succeeds after that fix. No collision/clearance tolerance was relaxed.

## Targeted verification

- Free-mount tests: **18 PASS** (no empty default slots, migration, deterministic default JSON, real contacts, narrow/sloped/side/fore attachment, all five support recipes, collisions, missile paths/tilt, atomic pairs/arrays, removal, movement, history, saved recipe tampering, whole-ship transformed picking and full-arc import certification).
- Existing Equipment Preview tests: **13 PASS**, explicitly using historical 1.8.5.4.1 generation. Legacy compatibility / foundations / body/barrel interference / missile exits / pair rollback / local frames / JSON/cache preservation remain checked.
- **31 distinct targeted tests**, TypeScript and Production Build PASS. Existing large viewer-bundle warning remains.
- Actual mouse/UI: **14 focused checks PASS** — hover ghost leaves JSON unchanged; drag commits eight mirrored mounts; individual rotation preserves ID; Undo restores the original symmetry; group deletion, Redo, OFF, Export and Reload preserve data.
- Production build: **8 focused checks PASS**, no QA hooks, default empty slots absent, exact import, deletion/Undo, OFF, Reload and Export. Console errors **0** in these checks and all representative captures.
- Four newly equipped files reproduce exact pixels after JSON serialization/reload at the captured pose. All rendering option/ghost operations leave the stored Blueprint unchanged.
- One saved historical 1.8.5.4.1 fixture matches its preserved TOP / FRONT / SIDE / ISOMETRIC source pixels **exactly**. No full historical matrix was run.
- Same-environment three alternating legacy/new generation pairs match ten canonical geometry/design sections and installed hardpoint records (after stripping only old modular annotations); zero blank reservations in every new run.

**Not run:** the separate modular-hardpoints / large-first suites (their historical generation is explicit), full 600+ suite, all historical versions, hundreds of UI cases, all architecture/shipyard/seed combinations, large random generation or combat-demo tests.

## Performance (actual measurements, bounded scope)

[CPU measurements](performance.json) use Node 24.19.0 in the same container, three alternating pairs and an isolated benchmark. Software Chromium / SwiftShader provides actual WebGL images; hardware GPU timings and memory bytes are not measured.

| Measurement | Value |
|---|---:|
| Legacy 1.8.5.4.1 generation median | 5,631ms |
| New free-default generation median | 4,410ms (−21.7%, three pairs) |
| Exterior query setup | 21.9ms |
| Cold valid single ghost CPU inspection | 8.5ms |
| Twenty valid moving single ghosts: median / p95 | 5.0ms / 17.1ms |
| Full single inspection | 34.0ms |
| Eight-member mirrored battery inspection | 330.4ms |
| Challenging INVALID single candidate | 112.6ms |

These are CPU validation times, not complete input-to-visible latency. The first eight-member battery ghost took about **1.0s end-to-end** in the software-render UI run. The <100ms general development-PC response goal is **not hardware-certified**, and the challenging rejection exceeds it even on CPU. Worker execution keeps the query separate from the main UI; Shader/GPU performance and a hardware fleet scene remain unmeasured.

| Captured scene | Frame draw counters before → after | Triangles before → after |
|---|---:|---:|
| 470m | 30 → 34 | 26,314 → 36,306 |
| STACKED_BLOCKS | 31 → 35 | 21,748 → 29,768 |
| SPINE_AND_MODULES | 66 → 70 | 27,024 → 31,352 |
| TRUSS_POD | 135 → 139 | 31,126 → 35,470 |

Four merged material buckets add four mesh draws. `renderer.info` frame counters do not separately establish main/shadow-pass GPU timings. JSON stores recipes/contacts/masks, not GPU buffers. Picking proxies are CPU-only; ghost geometry/materials are disposed on replacement/cancel/OFF; actual installed assemblies persist. No exhaustive memory-leak or fleet-performance claim.

## Limits

- Discrete yaw/elevation tests and sampled solid intrusion do not prove continuous sweeps, all concave intersections or simultaneous independently moving turrets.
- Conservative support / correspondence / bounded platform searches may reject physically possible configurations; complex asymmetric height matching is not solved.
- Independent platforms only; no shared continuous battery platform. Maximum 128 owned assemblies, 8 rows per request, 40 Undo states.
- Pre-production historical Blueprints remain playback-only in this Editor; reserved-slot Production releases are editable without their EMPTY slots constraining placement.
- No internal systems, loading/feed/power, recoil/stress, damage, ballistics, guidance, thrust or combat performance simulation. Utility Pod is visual-only.
- All seven weapon definitions are reusable; actual image QA does not certify every definition on every shipyard/architecture/scale.

## Files / reproduction

Source: `src/free-mount/` planner, support recipes, stable frames/picking, module variants, transactional history/validator and Worker; `src/ui/free-equipment.ts`; `src/rendering/free-mount.ts`. Narrow integrations: generator, Blueprint types/validator, shared fitment/geometry, viewer/render batching, main UI/layout/styles and package version. Existing combat-demo and Hull/armor/weapons generators were not rewritten.

Run only targeted commands:

```sh
npx vitest run tests/free-mount.test.ts tests/equipment-preview.test.ts
npm run build
npx vite-node tests/free-fixtures.ts
npx vite-node tests/free-probe.ts
npx vite-node tests/free-scenarios.ts
node tests/free-server.mjs
# Separate terminal:
QA_URL=http://localhost:5195 node tests/free-render.mjs
python3 tests/compose-free.py
node tests/free-ui.mjs
# Production preview on 4295:
node tests/free-production-ui.mjs
```

Optional `tests/free-history.mjs` reads the preserved read-only baseline worktree through `SHIPYARD_BASELINE_DIR`. Raw PNGs / full generated JSON / detailed sample diagnostics remain local and ignored. Compact image sheets and summaries are committed. Push is intentionally not performed.
