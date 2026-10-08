# Ventral flow refinement — Seed 7 and three representative Families

## Scope and preservation

Work started from `work` / `aefc436b5de29862f60722c6368e0faaa51767a9`. Existing local tile-language drafts, prior screenshots and exported Blueprints remain untouched. Only **Aegis / Cruiser / 300m / Seed 7** is reviewed in these three previously authorized pairs:

| Family | Architecture | New lower volumes |
|---|---|---:|
| WEDGE_CITADEL | MONOLITHIC | 7 (same count as approved belly) |
| HAMMERHEAD | BLOCK_ASSEMBLY | 8 |
| ENGINE_DOMINANT | CORE_AND_NACELLES | 6 |

No new language, other seed/yard or 220-ship generation was performed. The existing approved upper review exports are the input. Structural Hull, Macro measurements, original connectors, upper armor geometry/channels/joints, all 31 hardpoints and their foundations, engines and equipment remain byte-for-byte equal to that input. No additional panels, seams, decals or small decoration were introduced. This is a structural review update, not a complete V1.8.2 release.

## Seed 7 refinements

- **Fore convergence:** the keel and fore protective Pan now start at z=-143m with narrower terminal sections. Their width/depth profiles unfold together toward the belly; the old blunt lower Pan is replaced by a longer angular convergence.
- **Keel–protection junctions:** the inner Casemate roots reach closer to the keel and intentionally interlock. Broad sloping lower faces retain the 12m protective tier around the deeper 23m axis. Existing bodies perform the connection; no extra bridge/greeble meshes were added.
- **Rear Cradle:** begins earlier at z=58m, embraces the protective body with a wider entry, then narrows and decreases depth toward z=145m. The keel now spans 280m and tapers into this rear assembly.
- **Flow:** longitudinal width/depth knots and larger planar chamfers coordinate fore, mid and aft rhythm. Four measured Wedge tiers remain **7 / 12 / 23 / 16m**. The service pocket remains open; upper geometry and mount positions did not move.

The optional `ventral.matings` records six real shared-solid junctions. Each contact probe lies inside both stored closed solids, below the original Hull skin. `ventral.levels.parentStructureId` references the actual Station Ring for each measured depth. These samples are evidence of mating, not a full structural strength calculation or exhaustive contact-area calculation.

## Limited transfer of the philosophy

**Hammerhead:** the broad fore protection carries the dominant lower mass, with shallower shoulder protection. One machinery keel spans the original adjacent head/core/drive Hulls and records all three parent references; it mates the fore keel and rear Cradle. Magazine protection stays local. Measured representative depths: **5.03 / 12 / 23 / 18 / 15.44m**. The protected axis joins the different major masses rather than repeating the Wedge pocket layout.

**Engine-dominant:** a narrower fore/belly axis and shallow underpan protect the command core. Each of the four independent propulsion nacelles has one local lower bearing Cradle. The core axis stops before the lower vertical drive and no skin crosses nacelle gaps. Rear thermal equipment, including downward-facing port radiators, stays exposed. Representative depths: **4.08 / 16 / 7.56m** measured against the actual Hull surface (nominal local Cradle depth is 12m, not identical to every projected station depth). No maintenance pocket is forced onto this family.

`ventralBodyBuilder` reuses the existing closed Station Ring loft method, adding world-positioned lower contacts and explicitly referenced adjacent parents. Fixed axis alignment remains a constraint. Renderer only reads stored solids; it does not regenerate lower geometry for old JSON.

## Real render evidence

All sheets compose actual Chromium/SwiftShader WebGL PNGs. Neutral material suppresses procedural panel shaders; all Lines, panel layers, Hardpoints and foundations are hidden in `structure-*`. Original engines and thermal equipment remain visible. Mounted captures preserve all real mount geometry for clearance inspection.

**Seed 7 refinement comparison:** 1200px, 360m orthographic frame, same world center and underbody lighting. `before-*` renders the actual previously approved lower Blueprint, not a new approximation.

- [Current BOTTOM / LOW-ISOMETRIC / SIDE](ventral-flow/seed7-final/three-views.png)
- [Approved initial belly / refined belly, same camera and scale](ventral-flow/seed7-final/before-after.png)

**Three-family comparison:** 1000px, common 480m orthographic frame, same lighting. The wider frame accommodates Hammerhead and detached nacelles without changing physical scale between families. `before-*` here is each saved **upper review without lower geometry**, distinct from the Wedge refinement comparison above.

- [Three Families: BOTTOM / LOW-ISOMETRIC / SIDE](ventral-flow/three-family-review/family-three-views.png)
- [TOP / ISOMETRIC: upper/lower whole design](ventral-flow/three-family-review/upper-lower-overview.png)
- Per-family `before-after.png`, 11 original captures and exported `blueprint.json` under `ventral-flow/three-family-review/<FAMILY>/`.

Manual inspection: Wedge fore convergence and the rear casing taper are visible in BOTTOM; LOW-ISOMETRIC shows the interlocking belly masses and open local pocket; SIDE retains a deep central axis and a smoother rear run. Hammerhead carries the wide fore mass into the narrower machinery keel; propulsion geometry remains local and separated in Engine-dominant. Upper channels and foundations remain the previously reviewed geometry. Large original end-cap faces, especially on Hammerhead, are still plain and are not claimed to be final art quality.

## Validation, fixes and result

Tests cover source/upper/mount preservation, scope rejection, deterministic JSON, actual depth tiers and parent station measurements, mating contacts, disconnected roots, open recesses, preserved propulsion gaps, geometry/normal/bounds, exhaust interference and historical saved exports. New non-parent Hull penetration samples complement existing reciprocal cylinder reservation tests.

A Node regression initially rejected the browser-saved `vertical-drive-1` shape cache: maximum coordinate difference was **7.105427357601002e-15m**. The old validator compared recomputed floating-point stations as exact JSON strings. Cache validation now permits only machine-relative roundoff (`32 × Number.EPSILON × coordinate scale`); station counts, keys and nonnumeric fields remain exact. Tests reject a 0.000001m shape edit, altered profile/key and NaN. **Stored geometry is never changed**. This is not a relaxation of collision, silhouette or support thresholds.

- Worktree relevant suites: **31/31 PASS** (7 dedicated ventral + 7 new limited ventral + 10 original structural pilot + 7 limited upper regression). This is not a full 220-design regression.
- TypeScript and Production Build: **PASS**. Existing Three.js bundle size warning remains.
- Exact selected commit tree exported independently, with existing rejected local drafts excluded: Build **PASS**, relevant limited/source regression **21/21 PASS**.
- Actual browser captures: Seed 7 **9** + three Families **33** = **42** render captures; Console errors **0**. Same-seed JSON and saved-export LOW-ISOMETRIC WebGL pixel determinism **PASS** in each case.
- Independent selected-tree browser rerender matches **4 Blueprint JSONs and 42 raw PNGs byte-for-byte**, recorded in both `commit-verification.json` files. Composed sheets are simple arrangements of those source PNGs.
- Source Macro/Hull/Connector/upper/mount preservation **PASS**; sampled non-parent Hull intrusion and equipment corridor checks report **0 issues**.

## Rendering cost

Same SIDE structure-only renderer, per-design before/after adding lower bodies:

| Family | Calls | Triangles |
|---|---:|---:|
| Wedge (upper → refined lower) | 58 → 65 | 2,788 → 3,516 |
| Hammerhead | 61 → 69 | 3,204 → 4,000 |
| Engine-dominant | 90 → 96 | 4,980 → 5,508 |

The already approved Wedge belly → refined Wedge belly remains **65 calls**, triangles **3,468 → 3,516** (+48). Mounted results are respectively 205 / 209 / 236 calls. No extra mesh count was added to the existing seven-volume Wedge assembly. This limited QA does not benchmark normal generator CPU throughput or mobile GPU performance.

## Limits and reproduction

These are three fixed examples; other seeds, mass classes, yards and families remain unverified. Junction and collision tests sample actual triangles/station profiles and reciprocal equipment cylinders, not exhaustive triangle-triangle CSG. Intentional root embed/armor overlap does not produce a single watertight union asset. The Wedge pocket is an exterior recess around the original Hull, not an internal compartment. No damage, thermal physics or physical armor simulation is implemented. Existing unrelated drafts are preserved unstaged; the workspace is deliberately not declared clean or release-ready.

```bash
npx vitest run tests/ventral-structure.test.ts tests/ventral-limited.test.ts tests/structural-armor-pilot.test.ts tests/structural-armor-limited.test.ts
npm run build
# Serve the app first, then choose a NEW evidence folder:
VENTRAL_LIMITED_OUTPUT=qa/v1.8.2/ventral-flow/local-review node tests/ventral-limited-qa.mjs
VENTRAL_BEFORE=qa/v1.8.2/structural-pilot/ventral/final-review/blueprint.json VENTRAL_OUTPUT=qa/v1.8.2/ventral-flow/local-seed7 node tests/ventral-structure-qa.mjs
```
