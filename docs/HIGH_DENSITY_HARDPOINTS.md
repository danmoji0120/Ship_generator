# V1.8.5.4 — High-density modular hardpoints

New Production orders default to `hardpointDensity: "STANDARD"`. `SPARSE` and `DENSE` change the capacity target and candidate spacing, never the physical acceptance rules. Historical schemaVersion 1/2 Blueprints remain renderable without regeneration or migration. Explicit historical generator versions retain their old paths.

## Installation contract

`Hardpoint.modular` extends the existing ID, world position, normal, parent and size; it does not replace installed weapon authority. `EMPTY` means reserved capacity, not an installed weapon. `OCCUPIED` references the existing `plannedMountId` or validated integrated spinal reservation. `ShipBlueprint.modularHardpoints` contains density, soft target, support suballocation, diagnostics, request outcomes and summaries.

The six compatibility tags are `TURRET`, `FIXED`, `MISSILE`, `SPINAL`, `UTILITY`, `DEFENSIVE`. Tags can overlap; their totals must not be summed as the number of slots. Size is maximum installation scale, independent of damage and number of module components. A composite module with eight barrels still consumes one slot.

`moduleCompatibility(slot, module)` checks occupancy, size rank, mount type, actual footprint and operating envelope, internal volume, abstract interface index, outward access and optional required world direction. Smaller size is necessary but insufficient: the legacy M envelope can be taller than L, so some M modules do not fit an L installation. Physical dimensions always take precedence over the size label. This API checks the prepared contract; future actual equipment assembly must also run the existing attachment, collision and firing checks.

All S/M/L/XL dimensions and length scaling come from `generation/weapons/standards.ts`. At 300m, XL still has a 45×75m installation footprint and 45×30×105m envelope. A surface XL interface is distinct from the existing HULL_INTEGRATED spinal weapon. A surface slot does not create an axial structure, breech or muzzle opening. Existing integrated spinal installations are preserved and reported as occupied slots.

## Placement

Planning happens after the existing hull, armor, weapons, meso and exterior generation. It reserves installation capacity on the chosen ship without changing its geometry or increasing its armament.

Candidate hints use actual structural stations on six faces, rotating deterministically with the seed and distributing across supported Hull volumes, modules, pods and nacelles. Acceptance uses the actual hull/armor triangle authority and seventeen footprint contacts on one parent. Bounding boxes are only broad-phase filters. Coherent normals, foundation relief, an internally contained support pocket, oriented envelope separation, actual solids, installed weapon clearance, protected openings, propulsion, sensor apertures and service access must all pass. Unsupported meso/trusses remain obstacles, not mounting parents.

Empty envelopes and internal pockets use a spatial cell index and exact fifteen-axis OBB SAT. Scene broad-phase queries use a small immutable BVH. Planning is bounded at 512 slots, 18,000 examined candidates and 6,000 candidates per placement pass. Diagnostics distinguish target completion from surface/resource/candidate limits; individual unmet preferences remain recorded even when the general count target is reached.

Support pockets are suballocations inside the existing structure volume reservation (8% after the energy reservation), distributed over supported parent volumes. They add no new ship budget and represent installation interfaces, not a complete internal machinery layout. Power is `RESERVED_INTERFACE_NOT_SIMULATED`; `ratingIndex` is an abstract compatibility index, not MW. No ammunition or power network is simulated.

## Orders

```ts
hardpointDensity: "DENSE",
hardpointRequests: [
  { id: "tracking", type: "UTILITY", size: "S", count: 4,
    mandatory: true, priority: 90, region: "TOP", direction: { x: 0, y: 1, z: 0 } },
  { id: "launchers", type: "MISSILE", size: "M", count: 12,
    mandatory: false, priority: 70 }
]
```

Optional `parentId` constrains the supporting volume. Directions must be finite unit xyz vectors. Counts are positive integers; invalid inputs are rejected rather than clamped. Up to 32 requests / 512 total requested slots are accepted.

Mandatory requests precede preferences; priority and size rank order each group. Distinct matching uses augmenting paths so a broad request cannot consume the only suitable specialized slot. Requests mean installation capacity, not new equipment. Existing occupied slots can satisfy the corresponding capacity request. Unavailable integrated spinal capacity is never invented.

Preferred shortages return `LIMITED` with matched IDs and missing count. Mandatory shortages reuse `DesignRejection` and `REQUIRED_HARDPOINT_CAPACITY_UNAVAILABLE`, including requested/matched/missing values. The selected hull is not redesigned or carved to satisfy a slot order; the existing last valid UI Blueprint remains on screen after rejection.

## UI and rendering

The existing order form adds density and collapsible required/preferred request rows. Inspector summary separates total, empty and occupied; details expose size/type/face distributions, suballocated volume, selected slot, contacts/normal/parent contract and request outcomes. Debug markers batch by primary type in at most six InstancedMeshes plus one direction-line batch. Marker clicks and the inspector dropdown select slots. Colors indicate size; shape indicates primary type. All compatible tags appear in selected details. Markers deliberately use an x-ray debug overlay, including the far side.

Empty slots create no Normal/Production meshes or repeated pads. Existing installed equipment, armor and silhouette are unchanged. Instanced GPU buffers, geometries and materials are disposed when replacing the ship.

## Focused verification

```sh
npm install
npm run dev
npx vitest run tests/modular-hardpoints.test.ts
npm run build
node tests/modular-hardpoints-qa.mjs
node tests/modular-hardpoints-controls.mjs
node tests/modular-hardpoints-seeds.mjs
npm run preview -- --port 4200
node tests/modular-hardpoints-ui.mjs
```

Browser scripts require local Chromium and use software WebGL in this workspace. The default QA phase is `after`; retained `before` files were captured before integration using generator 1.8.5.3.1. Do not overwrite them when replaying current verification. No full test suite, Architecture×Yard×Seed matrix, combat tests or historical pixel collection is required. See `qa/v1.8.5.4/REPORT.md` for actual results, timings and limits.
