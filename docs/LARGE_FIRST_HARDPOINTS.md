# V1.8.5.4.1 — Large-first symmetric capacity planning

Scope: empty modular interfaces only. Structural Hull, armor, Meso, exterior kits, installed weapons and their poses are not regenerated. Empty slots have no Normal-view geometry and remain distinct from equipped weapons. No combat capability or hull opening is created.

## Actual baseline behavior

V1.8.5.4 used required/preferred request passes, then a length-gated L quota (approximately 6%), M quota (22%), and S residual fill. Automatic surface XL was never searched. Station-grid points were rotated by Seed and adopted individually. Symmetric geometry sometimes produced mirrored coordinates incidentally, but the planner did not reserve a pair atomically and did not record a battery.

## New order and ownership

1. Reserve existing validated installed equipment, envelope and firing paths.
2. Fulfill mandatory requests, ordered by size, then priority and stable request ID.
3. For each automatic size XL → L → M → S, evaluate preferred requests of that size and then automatic capacity on the remaining budget.
4. Record actual contiguous battery groups and run the unchanged physical replay checks plus bilateral metadata checks.

No fixed S/M/L/XL percentages remain. XL surface interfaces use the existing modular slot standard, not the integrated spinal weapon contract. An empty surface XL never satisfies a SPINAL request without the existing axial reservation. Physical space, per-host internal support allocation and existing density target still limit adoption. Mandatory odd counts can reserve a valid pair, assigning only the required distinct member; the extra empty interface is explicitly counted, never equipped.

## Surface rows and bounded search

Candidates derive from actual Hull/armor/protective surface solids. Bounds propose regular physical-scale longitudinal row hints; they never certify support. `surfaceRay`, measured-normal `resolveFoundation`, 17-contact footprint, same structural parent, actual parent internal pocket, OBB overlap, scene solid intersections, installed firing samples, sensor rays, service access and protected openings are mandatory for each accepted member.

The existing station/grid generator remains a residual search fallback for narrow and end-cap areas. Three-station row blocks give multiple surface/region rows opportunities before one host exhausts the count target. Duplicate candidate keys, shared scene/surface spatial indexes, OBB indexes and the existing 18,000-attempt / 512-slot limits bound work. This is bounded greedy allocation with row ordering, not an optimal packing solver; there is no combinatorial backtracking or global utilization proof.

The existing Ship-local contract is X bilateral, Y dorsal and -Z forward (`Hull profileRing`, `REGION_NORMAL`, `mountFrame`). Source Hull rotations unsupported by the existing surface system remain unsupported; no invented world-axis mirror is applied to rotated arbitrary Hulls.

## Atomic symmetry

Resolve an actual counterpart surface at reflected Ship-local hint and paired region. Verify both support frames, footprint/internal allocation, operating envelope and protected functions before mutating either index or budget. Failure discards the pending transaction. Successful pairs share size and compatible mount types. Centerline singles, explicit parent/region/direction constraints and genuinely missing/asymmetric counterpart support have stored exception reasons. A valid corresponding surface with an invalid mate is not silently replaced by a singleton.

Support/firing/clearance tolerances are unchanged. New pair consistency limits (5 cm pose / 1e-4 normal components) govern symmetry metadata only; they do not waive physical checks.

## Batteries and metadata

Optional `zoneId`, `pairId`, `batteryGroupId`, `symmetryReason` fields extend `ModularSlot`. Planning records size/phase/candidate/adoption counts without wall-clock times in canonical JSON. A battery requires at least two distinct longitudinal stations; mirrored members at one station alone are not a battery. Widely separated successful stations are split, and isolated/residual successes are not labeled as a row. Curved-side normals remain individually measured.

Debug markers retain size colors and type shapes. Muted transverse lines denote verified pairs, longitudinal lines denote actual battery segments. These are debug relationships, not physical beams. Selection uses the existing marker picking/inspector path and reveals Zone/Pair/Battery/support information without per-slot floating text. Normal view never shows empty markers.

## Historical contract

`schemaVersion: 2` remains. New default generator/plan version is `1.8.5.4.1`; `generateBlueprint(...,{version:'1.8.5.4'})` executes the frozen historical ordering/adoption code. Unchanged physical contracts are shared. Import does not regenerate either version. Historical plans have no mandatory new metadata.

## Reproducible focused QA

- `npx vitest run tests/modular-hardpoints.test.ts tests/large-first-layout.test.ts tests/large-first-samples.test.ts`
- `npm run build`
- `node_modules/.bin/vite-node tests/large-first-fixtures.ts` (local full Blueprint fixtures)
- dev server + `QA_URL=... node tests/large-first-render.mjs`
- `python tests/compose-large-first.py`
- `node_modules/.bin/vite-node tests/large-first-performance.ts` (no other jobs active)
- built preview + `UI_QA_URL=... node tests/large-first-ui.mjs`

No full suite, broad historical pixel matrix, combat runtime tests, or hundreds of UI cases are needed for this patch.
