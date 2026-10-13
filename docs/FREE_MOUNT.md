# Free-Mount Equipment & Adaptive Platforms — 1.8.5.5

The default Requirements-first generator retains the same Hull, armor, automatically installed weapons, engines, Meso and exterior kits. It stops before the legacy EMPTY-slot reservation stage. New Blueprint version is 1.8.5.5, schema 2. Explicit `version:'1.8.5.4.1'` preserves reservation behavior and the old inspector/Preview. Orders with any legacy slot requests are rejected with `LEGACY_SLOT_ORDER_REQUIRES_LEGACY_MODE`, rather than marked fulfilled; the Production UI offers the explicit Legacy generation mode.

## Ownership

- Generation owns baseline geometry and automatically installed equipment; the Editor cannot move/delete them.
- `freeMountPlan` owns newly installed assemblies, their real mount records, independent support recipes, pair/battery IDs and sampled operating masks. It is optional on historical files.
- Pointer picking uses exact Hull/Armor triangle proxies. Equipment, ghosts and Debug markers are excluded. World hits are converted to ship-local coordinates using the rendered ship matrix. X is the existing ship-local port/starboard axis and X=0 is its existing mirror plane; no world-axis mirroring.
- Ghost requests are immutable and evaluated in a dedicated Worker. Only successful full validation commits entries. The Worker does not run the old Auto Fit or planner.
- A transaction contains both equipment and its owned platform. Immutable history supports up to 40 Undo states. Removing an entry removes its entire generated assembly; there are no shared platforms in this version.

## External-only validation

The new path reuses the actual equipment Geometry and sampled collision/firing inspector, but explicitly bypasses legacy slot size/type/rating/internal-capacity compatibility. S/M/L/XL are module scale labels. All seven previous weapon definitions retain physical dimensions and caliber; an additional non-combat Utility Test Pod tests Pylon supports. No ammunition/feed/power/internal-space or load/recoil solver runs during free fitment. Original generator Requirements and installed spinal weapon remain intact.

Continuous actual support probes (eight ring corners, center and four midpoints) form the roots. Direct placement requires a coherent full footprint and <=5cm relief; a thin 8cm mating interface seats the assembly. Adaptive candidates use bounded, measured support footprints: full, 80%, 75%, 55%, 38% or 28% depending on support kind. Missing support is rejected, never inferred from AABBs. Each smaller root remains a polygon with thirteen actual contact samples; this is geometric support evidence, not a load-bearing certification.

Platform parts are checked against actual scene solids, existing user assemblies, openings, canonical sampled firing paths, sensors, service access, actual directional engine exhaust and intentional negative-space samples. Legitimate root embedding is limited to the measured parent inset (8cm nominal, 16cm sample rejection boundary). Parent identity never excuses arbitrary platform intrusion. Internal reservation boxes are excluded. The original integrated spinal gun's external muzzle axis stays protected.

## Support library

| Type | Geometry / use |
|---|---|
| DIRECT | Thin mating solid across the full footprint; no adaptive platform |
| FLUSH_BASE | Low, chamfered leveling base |
| RAISED_BARBETTE | Polygonal tapered root, visible intermediate tier, chamfered upper plate |
| SIDE_SPONSON | Outward side-plane cantilever fairing on a measured root |
| BOX_PLATFORM | Low polygonal launcher/service plate |
| PYLON_BRACE | Two separately seated longitudinal supports and a thin cap; visible open space between them |

Candidate order is Direct → Flush → Raised → side/box/pylon. Side supports are restricted to actual side-facing surfaces. Utility Pod prefers Pylon. Height is bounded by module footprint with lower Vesper/Serein and taller Forge proportions. Existing Architecture exposes the legal source surfaces and connectors; the Editor preserves those surfaces and never fills trusses or cuts a new hull opening. No distinct fixed template is forced on all architectures.

## Operating envelope and groups

Final guns sample 13 yaw positions (30° increments including endpoints) and four elevations; missile exits follow the local outward normal by default. A separate ±30° launcher-tilt control transforms the actual rack, tubes and launch origins/directions together; a connecting tilt yoke supports the raised rotating rack. Initial straight launch segments are sampled. A limited arc is allowed only with a valid sampled display pose. UI ghost checks fewer poses; the ghost is not a final certificate. Final installation replays actual geometry against every neighbor, retains a common mirrored pose for pairs, and updates all installed user arc masks. It does not prove continuous sweep clearance or simultaneous independent turret motion.

Battery arrays allow 1–8 rows, specified spacing and optional mirror. Drag direction is projected into the source surface tangent plane; individual positions are reprojected to actual nearby surfaces within a bounded distance, and normals follow those surfaces. All members must validate before commit; no silent partial battery. Mirror counterpart surfaces must exist, have near-matching positions/normals and use matched support classes. Inconsistent sides are rejected.

## Editor

Enable Equipment Editor; select module, Single/Mirror/Battery, platforms, snap and heading. Hover gives a green/blue ghost and `DIRECT_VALID`/`PLATFORM_VALID`; invalid placements show the first concise reason. A left click installs; Battery uses left drag and release. Right drag rotates the camera, wheel zooms, existing Fit remains available. UI input lies outside the canvas event target and cannot place equipment. Alt+click or the installed list selects only free equipment. Move, Rotate, Clone, Mirror, group deletion and Undo/Redo operate on these entries. Clone waits for another surface; changing the canonical ship resets transient worker/ghost state.

Save/Load uses existing Blueprint Export/Import. Import validates exact saved anchors, root contacts, platform recipe and operating mask; unsupported anchors are errors, not silently shifted. Regeneration attempts to retain the exact saved anchors and operating mask. Same-geometry regeneration preserves the loadout; a changed invalid anchor rejects the replacement and retains the current design. Export or explicitly remove player equipment to start another design; no anchor is guessed or silently shifted. Editor OFF hides the ghost but retains installed equipment.

## Render resources / future work

Assemblies are batched into four existing preview material roles. Stored recipes reconstruct CPU solids; JSON contains no GPU buffers or materials. Editor-only picking proxies and ghost geometry/materials are disposed on ship change/off as appropriate. Meso/material/decals on baseline ship are unchanged. Platform recipes have stable geometry IDs and owned support relations for future damage systems. No combat performance is invented.

Limits: sampled geometric inspection is not complete CSG; no mechanical stress certification; no shared connected battery platform; no aiming animation; no free spinal installation; generated base weapons are read-only. Performance and actual supported/failed designs are reported in the QA document, not inferred from model count.

The Editor is available on schema-2 Production exterior Blueprints, including historical reserved-slot releases. Pre-production historical ships remain playback-only because their surface/collision contracts differ; they are never silently regenerated. Whole-ship rigid transforms are handled in picking and the ghost transform. Local rotated StructuralVolumes remain outside the existing axis-aligned Production contract.

Legacy reserved-slot Preview is available on unedited Production releases. After free equipment is installed, use Equipment Editor: its exterior scene includes those real assemblies, whereas the legacy reservation inspector remains an archival snapshot. Removing all player equipment is explicit and Undoable; baseline automatic weapons are never removed.
