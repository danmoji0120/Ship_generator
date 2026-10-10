# V1.8.5.3.1 — actual propulsion roots and sparse junctions

## Scope and historical authority

The eight Meso kinds are retained. `ENGINE_ROOT_TRANSITION` now has four optional parametric variants. Schema 2 and the original physical production pipeline are unchanged. New generation uses `mesoStructurePlan.version: 1.8.5.3.1`; explicit `version: '1.8.5.3'` executes the frozen former planner in `legacy-build.ts`. Historical solids with no `rootVariant` use the identical former geometry recipe. Renderer placement is never regenerated from a Seed.

## Why the earlier planner missed support

It collapsed engines by parent ID and searched world ±X at 82% of the parent's length. That often selected thermal/armor/detail regions instead of the actual nozzle root. It required a long parent-wide footprint and evaluated propulsion after ordinary armor. The engine-only experiment separates this from budget competition: a failure with only engine kinds enabled cannot be blamed on the general hierarchy budget.

## Real source and candidate ownership

For each engine independently, the new planner records engine ID, actual position, normalized axis, radius, nozzle length and bell ratio. Candidate rings around the actual root use an axis-derived frame. Rear-cap hints sit outside the nozzle radius; upstream hints follow the actual engine axis. The global ray finds the final exposed surface, including occluding equipment. A candidate must belong to the actual engine parent and remain in its root neighborhood. Nearby candidates are preferred before distant fairings.

A local interval search measures support width/length with rays in both directions of the measured tangent axes. It stops at a different parent, normal discontinuity or substantial relief. These measured intervals guide candidate sizes; they are not a complete free-area union or a collision waiver. Every footprint still requires thirteen original support contacts and the same clipped actual station patch with 99.8–100.2% projected-area agreement. Patch tolerance and the existing collision/firing/access tests are not loosened.

The footprint is scaled to engine radius and measured support, not to the width of the whole parent hull. Minimum dimensions for an engine-local component are 0.8m width, 2m length and 0.25m height. This changes the former ship-length-based visual-size policy for small engine roots; it does not reduce contact, collision, exhaust or firing requirements. A low-profile component must still have nonzero closed volume and visible tier/cover geometry.

## Four variants of one kind

| Variant | Geometry and use |
|---|---|
| WIDE_ROOT_FAIRING | Broad angular haunch and supply cover, when actual support permits it |
| NARROW_ROOT_FAIRING | Narrow longer body, less contracted roof, suited to gaps between existing equipment |
| SEGMENTED_ROOT_SUPPORT | At least two disconnected supports for the same engine, each with its own thirteen contacts and root patch; no suspended bridge |
| LOW_PROFILE_TRANSITION | Low angular haunch with a smaller raised supply cover; retains a real height tier |

Variant/fit retries record actual failure reasons and variant names. Candidates are never accepted by suppressing equipment or carving armor. Segmented installation with only one support is omitted. Replayed geometry uses stored parameters, contacts and station triangles.

## Budget and sparse architecture

The original 7/14/26 placement caps remain. Major L cannon integration is evaluated first, then actual propulsion roots, connector junctions and ordinary armor. Engines can receive at most two accepted root supports; unused opportunity naturally returns to later candidates. Exhausted budget is logged once per zone, separately from an engine that already has its supports. Candidate omissions and final zone omissions are different counts.

For SPINE_AND_MODULES, TRUSS_POD, CORE_AND_NACELLES, TWIN_HULL and HYBRID, real structural connector endpoints form functional junction candidates. The search moves a short distance into the actual closed parent before measuring its exposed top/bottom/flank surface. It uses existing shoulder/ventral kinds. No gallery is invented without an existing channel, no truss is filled and no new hull mass is generated. Missing/hidden/occupied support is an omission rather than forced placement. Junction discovery currently probes top/bottom/flank directions; cap-only or deeply occluded interfaces may remain undetected.

## Safety, metadata and diagnostics

The previous broad-phase, containment, edge/triangle, opening, engine exhaust, weapon envelope/firing, XL, sensor, kit access and negative-space checks remain in force. The independent validator recontacts the same thirteen support samples, reconstructs closed solids and checks actual source engine/junction associations and neighborhoods. There is no exception for engine equipment. The new planner and validator also include the exact renderer Connector loft/beam solids as obstacles; temporary geometry is disposed and immutable solids are cached per Blueprint. Historical planning retains its original collision scene.

Zones store source engine data, actual parent surface, measured intervals, cluster association or connector ID, final status and omission class. Placements retain authoritative geometry, bounds and contacts. Root group IDs associate independent supports without replacing individual engine IDs. Shared parts use the existing material batches; no new material/shader program per component is introduced.

`Engine Root Zones` and `Structural Junctions` are read-only diagnostic views. They show measured candidate footprints, surface normals, actual engine axes, stored exhaust reservations and accepted contact markers. Line metadata includes saved source IDs, decisions, bounds and validation. The UI does not change the Blueprint. These views aid geometry diagnosis; they do not simulate propulsion, damage or crew access.

## Limits

Support intervals are sampled; final patches are geometrically clipped, but occlusion and collision coverage remain mixed conservative/sampled checks rather than complete CSG or all coplanar triangle intersections. The former production generator primarily creates aft-facing engines: arbitrary-axis support can be tested synthetically but is not a claim that all upstream equipment generators support every free-rotation layout. Some valid closed hosts have no legal root footprint. Sparse layouts need fewer structures and can legitimately omit every junction candidate in an occupied case. Visual structures do not confer mass, strength or simulated armor protection.
