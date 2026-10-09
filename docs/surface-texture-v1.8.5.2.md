# V1.8.5.2 — Surface Texture & Decal Language

## Ownership and historical playback

Requirements-first hull → unchanged V1.8.5 exterior details → V1.8.5.1 material selector → optional V1.8.5.2 surface recipe. The final stage writes **only** `generatorVersion` and `materialAppearance`. It does not reserve space, change a solid, move a weapon, or change a release decision. The explicit `version: '1.8.5.1'` generator and its shader/cache key remain available. Saved selectors without the new version never receive textures or new paint.

Schema 2 stores recipes and paint placements, not PNGs, GPU buffers, canvas data or generated texture bitmaps. The independent `ship-surface-v1` hash uses seed, design name and yard; no existing RNG is consumed. The code `AN/VD/FU/SS-NNNN` is a deterministic design identifier, **not** a globally unique registration.

## Material surface architecture

Five existing `MeshStandardMaterial` roles keep their metalness and palette. The new version composes with the existing `onBeforeCompile` functional pattern injection; each chunk is injected once. Its program key includes version, yard and material role. Seed and per-component tone are data, not separate shader programs.

| Role | Albedo amplitude | Roughness amplitude | Tiny normal amplitude | Intended finish |
|---|---:|---:|---:|---|
| PRIMARY_ARMOR | .045 | .045 | .008 | Clean naval paint, restrained component variation |
| SECONDARY_ARMOR | .065 | .065 | .010 | Replaceable armor covers and stronger finish contrast |
| MECHANICAL_STRUCTURE | .065 | .090 | .012 | Directional machining / metal brushing |
| RECESSED_INTERIOR | .080 | .080 | .009 | Dark rough machinery spaces |
| FUNCTIONAL_SURFACE | .025 | .025 | .004 | Clean sensor/service surfaces |

Albedo and roughness amplitudes multiply the yard contrast (Aegis 1.0, Vesper .7, Forge 1.2, Serein .5); these are bounded shader modulation coefficients, not physical protection values. A shared 128² RGBA deterministic data tile supplies grain, roughness and directional brush channels. Texture channels are linear data. The period is fixed in **meters**: .24 Aegis, .16 Vesper, .31 Forge, .12 Serein. Individual grain is much smaller than a complete tile. Ship length never scales these wavelengths.

Triplanar weights use object-local normals and `position`; model/world transforms never enter the pattern coordinate. Texture therefore travels with its parent mesh. World-solid batches use their stored ship-local positions; local primitive casings use primitive-local positions. Across different material roles a deliberate finish boundary may remain, but no deep fake seam or displacement is added. Grain is mip-filtered and derivative-faded below the resolvable pixel footprint. FAR fragments skip the three texture fetches, and atlas fetches run only inside readable paint footprints. Explicit WebGL2 gradients keep mip selection valid across these visibility branches. Normal variation uses a tiny view-space derivative bump; position, index and normal buffers remain byte-identical.

Faceted production/functional part IDs with actual attribute bindings select modest deterministic tones; primitive/loft hull underlayers keep their fixed base tone with role-level grain. Unbound legacy IDs are not serialized as applied component variations. ventral/keel, belt and command semantics have separate small biases. This is not a random panel-color generator. `CLEAN` is the stored default. SERVICE/WEATHERED only darken grain on explicitly eligible access/joint/engine/belt components. This pass does not model actual edge curvature, battle damage, rust or thermal destruction. Viewer finish overrides change uniforms, not saved recipes.

## Decal language and attachment

| Marking | Source and placement | Visibility |
|---|---|---|
| IDENTIFICATION | Derived yard/seed code, broad exposed side armor; suitable dorsal/ventral mass | FAR |
| COMPARTMENT | Stable armor ID hash; citadel, keel, shoulder, command plinth | MEDIUM |
| SHIPYARD | Geometric diamond / diagonal / frame / compact lozenge and yard name, command roof | MEDIUM |
| MAINTENANCE | Existing hatch, service port, machinery cover or drone dock; small service code | NEAR |
| HAZARD | Existing missile service cover; warning word and small safety border | NEAR |
| NAVAL | Reserved paint vocabulary for later authored directional markings | FAR / MEDIUM |

The first five kinds are generated where real usable surfaces exist. NAVAL is a supported metadata class, not a claim that every ship has an additional tactical stripe. Existing emissive hatch borders, hazard stripe kits and status lights are retained; no new hatch or duplicate light geometry is created.

The planner inspects real final closed solids and triangles, groups coplanar faces, and tests **nine** actual-parent triangle contacts. Cached projection intervals of every final hull, armor, equipment and detail solid conservatively reject any other solid in the outward footprint, including thin rails between probes. This avoids rebuilding a global triangle query for each contact while preserving exposure checks. Equipment envelopes and functional reservations are also checked. Independent QA repeats the saved contacts against the complete final triangle scene. Text has a stable normal/right/up frame; port lettering is upright. The whole rectangle must fit on one coherent plane. Optional candidate offsets stay on that plane. One paint region per contiguous component face keeps major armor calm. Unsupported, obscured, narrow or crowded surfaces produce an explicit omission. Maximum 48 placements per ship.

Each placement saves ID, parent component/structure, world-solid ship-local position, normal/tangents, physical width/height, nine contacts, text, class, ink category and reason. Large identities can be omitted on small or crowded designs; armor is never removed to make a label fit.

Paint is sampled directly on **existing triangles** through additional `finishData`, `paintUV`, `paintRect`, `paintMode` attributes. It adds no mesh, no point light, no overlay plane, no physical offset and no shadow geometry. The projection is limited to matching parent/face normals and the paint rectangle, so it does not bleed to the opposite hull. Same-role batches and source-ID ranges are retained. Some components share two disjoint coplanar faces; the planner conservatively uses one label per plane.

## Asset cache, filtering and LOD

A fixed project-owned 5×7 bitmap alphabet is rasterized to a 512-wide power-of-two RGBA atlas, with 32 pixels per marking row. This avoids network assets and system-font differences. It is deliberately a block/stencil-style technical alphabet, not a full typographic/PBR asset pipeline. Aspect correction preserves legibility; very close letters reveal the bitmap design.

Both textures have mipmaps and linear mip filtering; atlas anisotropy requests 8 (hardware clamps it) and grain 4. Pixel derivatives fade sub-readable markings and fine noise. FAR identity remains visible in distant mode; smaller region/service text drops out. These policies do not claim full-ship geometry LOD. OFF hides existing optional detail-kit groups; hull material/identification survives. LOW/HIGH/AUTO continue to use the existing MESO/MICRO visibility rules.

Assets are keyed by the serialized texture recipe and decal contents, shared by simultaneous instances, reference-counted and released with the last owning ship. Camera/frame rendering does not generate an atlas. Camera captures reuse the same mesh. A reload after the last instance is disposed reconstructs its deterministic asset; the cache deliberately does not retain unbounded idle GPU textures. The recorded mip-byte count is owned-format accounting, **not driver-resident GPU memory**.

## Shipyard profiles

| Yard | Texture and paint language |
|---|---|
| Aegis | Stronger armor tone hierarchy, compact sturdy navy labels, restrained warning paint |
| Vesper | Finer grain, more directional brushing, spaced narrow inscriptions, smaller marks |
| Forge | Rougher/coarser industrial paint, stronger metal brushing, amber warnings, larger service inscriptions |
| Serein | Fine restrained grain, low tonal variation, smaller precise roof/compartment marks |

## Lighting and debug

The existing seven emissive roles remain unchanged and readable without bloom. This pass uses the existing HDR/ACES renderer and validates native emissive in dark/side-lit scenes; bloom and real emissive illumination are intentionally not added. `Surface Texture` isolates texture/tone shading; `Decal Markings` isolates paint. The small finish selector is a viewer override. Neither changes Blueprint JSON or physical collision rules.

## Validation limits

Plane fit, nine parent ray samples and conservative projected final-solid occupancy are conservative sampled checks, not a proof of arbitrary triangle intersection or curved-surface decal projection. Glyphs never cut geometry, so existing firing/nozzle/XL physics is preserved by exact physical JSON equality. Curved/unsupported surfaces are omitted. Micron-scale material values are artistic shading parameters; they are not measurements of a manufactured finish. Mobile GPU performance and driver GPU memory must not be inferred from desktop SwiftShader.

## Existing 21-kit material / emissive / LOD mapping

All existing tags are inherited; V1.8.5.2 changes their surface finish and adds sparse lettering only where exposed.

| Role | Surface responsibility |
|---|---|
| PRIMARY_ARMOR | Dominant armored compartments; moderately rough paint |
| SECONDARY_ARMOR | Belts, shoulders, keel and equipment protection; lighter adjacent finish |
| MECHANICAL_STRUCTURE | Rails, brackets, shrouds, mantlets, casing and service machinery; darker metal |
| RECESSED_INTERIOR | Hatch insets, nozzle interiors, louvers and conduit troughs; very dark, rough finish |
| FUNCTIONAL_SURFACE | Optical cells, controls, mounting and sensing surfaces; restrained polished finish |

| Kit | Main role | Functional indicator/marking | Display |
|---|---|---|---|
| ACCESS_HATCH | Secondary | Hatch rim and status point | LOW / HIGH / AUTO |
| PANEL_SEAM | Mechanical | None; existing depth remains visible | HIGH / AUTO near |
| ARMOR_CLAMP | Mechanical | None | HIGH / AUTO near |
| REINFORCEMENT_BRACKET | Mechanical | Small identification stroke | LOW / HIGH / AUTO |
| RECESSED_SERVICE_PANEL | Functional | Inset rim and status point | LOW / HIGH / AUTO |
| EVA_LADDER | Mechanical | Rail approach guide; rungs stay unlit | HIGH / AUTO near |
| EVA_HANDRAIL | Mechanical | Short guide markers | HIGH / AUTO near |
| SERVICE_CATWALK | Mechanical | Access guide markers | LOW / HIGH / AUTO |
| SERVICE_PORT | Functional | Connection status point | HIGH / AUTO near |
| DRONE_DOCK | Functional | Dock navigation indicator | LOW / HIGH / AUTO |
| CONDUIT_BUNDLE | Mechanical | Clamp status; runs remain dark | LOW / HIGH / AUTO |
| COOLANT_PIPE | Mechanical | Local propulsion/service status | LOW / HIGH / AUTO |
| VENT_LOUVER | Recessed | Local seat status; blades remain unlit | LOW / HIGH / AUTO |
| MACHINE_ACCESS_COVER | Secondary | Machinery hatch rim and status | LOW / HIGH / AUTO |
| ENGINE_SERVICE_FRAME | Mechanical | Short maintenance lights | LOW / HIGH / AUTO |
| RCS_CLUSTER | Mechanical | Housing status; nozzle openings unlit | LOW / HIGH / AUTO |
| OPTICAL_SENSOR | Functional | Optical cell emissive | HIGH / AUTO near |
| SENSOR_STRIP | Functional | Existing four sensor cells | HIGH / AUTO near |
| WEAPON_SERVICE_RING | Mechanical | Weapon service status | LOW / HIGH / AUTO |
| MISSILE_CELL_DETAIL | Functional | Cell/service status | HIGH / AUTO near |
| HAZARD_MARKING | Functional | Existing warning stripes, non-emissive | HIGH / AUTO near |

## Reproducing QA

Run the normal `npm run dev` server and supply its URL as `QA_URL` for the browser scripts. `surface-texture-qa.mjs` captures the paired views; `compose-surface-qa.py` makes the compact sheets. `surface-texture-matrix.mjs` checks all eight architecture candidates plus roles, yards and physical size boundaries. `surface-texture-transform.mjs` checks a rigid ship/camera transform. `surface-texture-performance.mjs` compares explicit preserved V1.8.5.1 with the new default in alternating pairs.

For historical pixels, `surface-texture-history.mjs` needs `BASELINE_URL` pointing at an isolated actual `8ead651` checkout and `TARGET_URL` at the current dev server. For the real built UI, run `npm run build` and `npm run preview`, then give `PRODUCTION_URL` to `surface-texture-ui.mjs`. All browsers use local Chromium/SwiftShader. Do not infer physical/mobile GPU performance from this environment.

Run tests that write historical QA reports in an isolated copy: the test suite regenerates its own control-report files. Existing source QA and user drafts should be preserved.
