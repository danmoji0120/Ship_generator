# Armor integrity contract (1.8.6.5.1)

The audit is runtime-only and never modifies a loaded Blueprint. New procurement
uses an explicit generator contract; old explicit versions retain their builders.
Normal rendering does not call the audit, prepare its queries, or draw its overlay.

Two domains must stay separate:

- `HULL_TARGET_FOOTPRINT`: actual loft/cap triangle polygons split by functional
  reservations and integration contacts. Native CITADEL/BALANCED can decline
  optional skin. Unknown exterior/SPINE/legacy intent is unresolved, never a free
  protection bonus. Existing raised armor can commission a selected target.
- `ARMOR_SOURCE_SKINS`: exposed finite surfaces of stored armor solids. This
  measures the source coating, not protected whole-ship Hull area.

Each polygon is partitioned into a 98%-linear inner polygon and finite perimeter
bands. Each triangle contributes its actual area and one centroid ray, not an
unweighted vote. Ray intersections use stored finite material cells. AABB is
broad phase only. Visual checks intersect stored Normal armor triangles and
reject intersections behind the first Hull triangle. This visibility model does
not simulate full renderer occlusion by equipment, exhaust housings or decals.
It is a source consistency query, not a rendered pixel coverage percentage.

Default budget is 20,000 rays, in deterministic Hull-first order. The untested
remainder is explicitly unsampled/unresolved. Stratification can miss sub-tile
holes and has no claimed finite error bound. A coverage estimate of 1 does NOT
certify a fully armored ship. A complete query through an unknown SPINE boundary
stays unresolved. Material IDs/thickness must also be valid.

Patch IDs refer to real source surfaces; layer IDs come from the finite probe.
`surfaceId/piece/index` references are runtime locators into the immutable stored
surface array and are included only when that actual convex piece intersects the
ray. They are not new serialized geometry identities. Warnings and source
references remain inspectable and exportable.

New generation closes only commissioned finishing-ribbon edge strips and the
small exposed cap patches previously discarded by a whole-cap area threshold.
Existing roots, functional reservations, policy exclusions and finite material
mass integration remain authoritative. There is no whole-Hull repair shell.
The legacy 10% UNKNOWN_LEGACY service estimate is unchanged.

Unresolved/mismatch candidates in the limited survey are reported, not globally
repaired. Ballistic truth is the physical query, not the overlay color.
