# V1.8.5.4.2 — Equipment fitment preview

This is an application/runtime patch on the unchanged V1.8.5.4.1 generator. Schema 2 and canonical `generatorVersion: "1.8.5.4.1"` deliberately remain unchanged. `PreviewPlan.version` and package version are `1.8.5.4.2`. Historical exports are replayed, never retrofitted. Preview is neither an installed loadout nor a Combat Blueprint.

## Contracts and ownership

- `equipment-preview/library.ts`: independent caliber, mount class, reference envelope, footprint, internal interface, component count and operation sample grid. Dimensions are physical meters, never multiplied by ship length.
- `equipment-preview/geometry.ts`: chamfered armored turrets, separate rotating bases, mantlets, open barrel bores and multi-cell missile housings. CPU parameter-space solids/contact probes are cached; saved local mount frames transform geometry into ship coordinates.
- `equipment-preview/fitment.ts`: EMPTY-state/type/size/interface checks reuse `moduleCompatibility`. Foundation probes independently resolve 17 contacts on actual exposed parent triangles. Parent embedding is allowed only for foundation contacts; other equipment is not exempted. Scene includes armor, functional machinery, meso, connectors, exterior kits and installed weapons.
- All added equipment parts use actual solid intrusion tests after spatial broadphase; reserved openings/exhaust boxes (including a supplemental oriented volume from each actual engine direction), existing firing paths, sensor and service access remain protected. Failed equipment is not rendered. Geometric support does **not** prove structural load capacity.
- Local yaw: 30° grid, -180°…180°. Gun elevation: 0°,20°,45°,70°. Each pose checks body/barrels, neighbors and actual muzzle paths (60m initial clear segment). Missiles check each tube's outward local-normal exit and 35m initial path. Final replay includes all accepted neighbors; UI lists individual clear yaw samples by elevation, never fills blocked gaps into a false continuous arc.
- Cached results are owned by the unchanged Blueprint reference and normalized preview request. The bounded cache retains 12 plans. Worker initialization and planning happen only on Preview actions; OFF cancels pending worker work and disposes temporary meshes/materials. Reload/new generation resets the worker and preview. Idle repeated requests reuse its cache.
- Renderer batches four material roles and stores part IDs. Optional debug rays distinguish clear/blocked samples. The normal ship root and camera-fit bounds remain unchanged. Preview OFF adds no mesh/draw cost.

## Representative modules

| Module | Interface | Footprint m | Nominal envelope W/H/L m | Components |
|---|---|---|---|---|
| 105mm rapid gun | S | 3.5×4 | 4 / 4.8 / 7.8 | 1 barrel |
| 210mm twin | M | 8.5×10 | 10 / 12 / 20 | 2 barrels |
| 406mm twin | L | 21×24 | 24 / 15 / 41 | 2 barrels |
| 500mm single | L | 21×24 | 24 / 16 / 41 | 1 barrel |
| Compact missile | S | 3×4 | 3.4 / 4.2 / 4.4 | 6 tubes |
| Medium missile | M | 8×10 | 8.4 / 6.4 / 10.4 | 12 cells |
| Heavy missile | L | 19×22 | 19.4 / 10.4 / 22.4 | 24 cells |

Envelope is a reference installation contract, not a promise of a full swept sphere. Actual posed solids and muzzle origins are evaluated independently, including extension outside this reference during rotation. Caliber does not determine slot class: both 406mm twin and 500mm single use L; either can use compatible larger slots. S missile modules require a MISSILE-compatible interface, which default automatic S turret/utility slots do not provide.

## Single / Pair / Battery / Auto

Single validates one actual selected slot. Pair uses its stored pair ID, independently measures both foundations and commits both together; failure rolls back the mate. Nonzero displayed yaw is negated across right-handed bilateral frames; a common safe mirrored pose is required while each side retains its independently measured arc mask. Battery validates only actual members and preserves pair transactions. Auto considers EMPTY slots large-first and chooses the largest compatible representative module; no new slots are invented. A representative 32-module cap limits visual crowding and quadratic operating checks. Remaining groups are explicitly omitted as untested, rather than reported as physically blocked. Auto is a capacity demonstration, not a naval loadout doctrine.

The optional **Try longer M battery** action is preview-only. It evaluates up to six rows using nearby existing EMPTY M pairs, excludes mandatory slot IDs, keeps parent/support allocation and tests full external/internal reservations, all equipment clearances and mirrored measured normals. It relocates existing slots in a shallow runtime Blueprint copy; canonical JSON and installed weapons remain unchanged. Failed longer rows return to a shorter valid proposal. This is not a permanent planner migration.

## Limits

Solid tests combine actual sampled geometry and ray-triangle tests; they do not prove every concave triangle intersection or every intermediate rotating pose. Neighbor assemblies are tested at their accepted static pose, not all simultaneous combinations of two moving turrets. No mass/load, ammunition, feed, power, guidance, ballistics, combat performance, permanent fitment or aiming animation is implemented. Compatible alternative slot IDs are interface candidates only until independently checked. XL diagnosis is bounded, uses unchanged actual surface candidates and does not create capacity. No combat-demo changes.

## Mechanical interface geometry

Foundations use 17 measured support contacts and outward-wound closed solids. A support collar joins the rotation base to the armored body; barrels elevate around the front trunnion rather than the body center. Flush surface XL interfaces use a real 0.25m preview-only support shim, validated against the same actual surface. This does not alter the saved XL slot or pretend that the 470m example has an available XL slot. Missile launchers have fixed 90° elevation relative to their local tangent plane: their exits point along the outward mount normal.
