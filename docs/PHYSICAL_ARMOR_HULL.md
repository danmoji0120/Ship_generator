# V1.8.6.0 — Physical Armor & Hull

V1.8.5.5 (`3e7ec34a997182246046005746f813d56b797dd2`) is the preserved generation and Free-Mount baseline. The current default generator runs that pipeline unchanged, then adds `physicalDesign`. Explicit historical versions remain callable. The original work folder and combat-demo are untouched.

## Materials and units

`src/physical/materials.ts` defines five armor and three hull materials. Densities are initial game engineering specifications in kg/m³, not calibrated penetration data. Manufacturing cost is a relative index, not currency. No damage multiplier, armor HP or penetration energy formula is implemented.

| Armor ID           | Density kg/m³ | Cost index | Tech |
| ------------------ | ------------: | ---------: | ---: |
| ARMORED_STEEL      |          7850 |          1 |    1 |
| TITANIUM_ARMOR     |          4500 |        3.2 |    2 |
| CERAMIC_COMPOSITE  |          4300 |        2.4 |    3 |
| TUNGSTEN_COMPOSITE |         10500 |          5 |    3 |
| NANO_LAMINATE      |          5200 |          8 |    5 |

Composite thickness fractions, outside to inside:

- Ceramic: 50% ceramic strike face (3200), 30% steel support (7850), 20% fiber backing (1725 kg/m³).
- Tungsten: 50% tungsten-rich alloy (18000), 25% titanium support (4500), 25% light spall backing (1500 kg/m³). The composite mean is not pure tungsten density.
- Nano laminate: 40% SF hard laminate (7000), 35% tough laminate (5000), 25% spall laminate (2600 kg/m³).

Fractions sum to one. A 300mm composite is 300mm total, never 300mm per constituent. Normal-thickness-weighted means match the official densities exactly. Geometry can give inner/outer layers different volumes at edges and intersections, so `integratedMeanDensityKgM3 = mass / actual volume` is also explicitly stored and displayed. No second hidden density is used for mass: each constituent always uses its declared density.

Hull skins use LIGHT_STRUCTURAL_ALLOY (2800), TITANIUM_STRUCTURAL_ALLOY (4500) or HIGH_STRENGTH_STRUCTURAL_STEEL (7850 kg/m³). Hull shell material, thin shell role and armor are distinct even when densities coincide. Shell thickness does not imply frame strength.

## Shared policy and finite mass

The existing six lower-case priorities remain authoritative. ARMOR maps to `survivability`, MISSILES to `missile`, SENSORS to `sensor`; no parallel order enum replaces saved orders.

`physicalDesign.policy` records the interpreted weights, optional `order.targetDryMassKg`, sector allocations, material preferences, thickness, coverage target, critical protection, cost/tech, tradeoffs and future frame/compartment/system policies. Future preferences are explicitly `POLICY_ONLY_NOT_GENERATED`; no reactor rooms, frames, bulkheads or functional internal systems are generated.

The target defaults to the historical volume-based estimate, converted from tonnes to kg. Existing hull minimum, retained core equipment estimate, structural/support estimates and minimum armor skins are reserved before the remaining target is split among competing sectors. All-high priorities share the same finite remainder. Armor thickness is funded from the exposed finite area and material density bound; it is not independently multiplied without budget accounting.

AEGIS prefers steel hulls and ceramic armor, with concentrated tungsten protection at high armor priority. VESPER prefers light hulls/titanium armor. FORGE favors economical structural/armor steel, with dense critical protection when requested. SEREIN can manufacture nano laminate. Mobility can favor lightweight alloys; endurance favors support reserve, redundancy/subdivision and titanium hulls. Technology gates selection; a material's intrinsic properties never change by yard.

Mass accounting separates measured shell/armor mass from estimates:

- Hull Shell Mass / Armor Mass: finite stored coating geometry and constituent densities.
- Structural Mass Estimate: 18% of historical target, a provisional frame/support proxy.
- Core Equipment Mass Estimate: actually present assembly solid volumes × 160kg/m³ representation density.
- Player Equipment Estimate: actual saved exterior geometry × 160kg/m³; its owned platform is counted once at 2800kg/m³.
- Unresolved Estimate: 10% of historical target for unresolved propulsion/support structure.
- Total Estimated Dry Mass: these components, not the target value. Operational propellant/ammunition are excluded.

The original total is recorded as replaced, never added to the new total. Historical Doctrine resource reservations remain preserved as a legacy planning model and are not additional physical mass. Future allowances are not installed equipment. Actual frame/equipment engineering masses remain unverified estimates.

Insufficient mandatory minimums or armor budgets use `DesignRejection` with a specific reason. Free-Mount installation remains external geometry only: accounting can report an over-target player loadout but does not add internal/feed/power/load/mass installation gates. Transactions refresh the mass extension without mutating the earlier undo snapshot. Worker payloads omit unrelated physical data.

## Finite geometry and probe

`physicalDesign.surfaces` refers to existing Hull/Production armor/finishing IDs. No original hull, armor, weapon, engine or platform is removed or moved. Existing SPINE volumes remain in the structural mass estimate rather than Hull-shell registration; their exact frame material contract remains for V1.8.6.1. Armor structural housings are interpreted as thin protective skins on their retained exterior; their entire visual volume is not declared solid metal.

The shell model is `BOUNDED_NORMAL_FACET_SKINS`: normal-directed finite polygon skins, bounded by the original face footprint and local supporting planes. Buried faces are clipped against existing source geometry; Hull contacts and earlier physical skins are subtracted. It is a faceted shell approximation, not a structural stress model or a certified smooth offset surface. Nonconvex enclosing interiors are not represented as complete structural solids. Unsupported legacy closed bodies are not registered as bulk armor: their separately verified finite facet skins carry explicit warnings. Failed physical fragments are rejected, never relabelled valid.

Each stored coating is a finite convex cell. `PhysicalPiece.layerOrder = -1` means that the complete coating cell is partitioned by `facet.normal`, `facet.planeOffsetM` and the material depth fractions. Constituent geometry is derived only when requested. This avoids duplicating all vertices for every composite layer. Per-layer integrated volumes and masses remain stored and independently recomputed during validation.

Convex clipping removes actual material overlap; vertex hulls coalesce cells only when their union volume is unchanged. Nearly collinear clip edges are simplified within 1e-7m. Stable convex triangulation retries nearly coplanar construction at 6.25e-9m / 1e-7m and verifies every original point remains enclosed within the existing 1e-5m plane tolerance; the geometric validator uses a 1e-5m plane tolerance. Renderer Float32 precision and faceted curvature impose additional display approximation. There is no infinite plane fallback.

`armorRayProbe(blueprint, origin, direction, maxDistance, optionalRigidPose)` returns finite entry/exit intervals, plate/shell/material/constituent IDs, planned layer depth, measured normal thickness at entry, path length, incidence and surface/boundary normals. Paths come from convex intersections; t/cos(theta) is a planar verification case, not the general solver. Edge escape, nonparallel surfaces and gaps are respected. Rigid translation/quaternion rotation preserves world normals and distances. Nonuniform scale and rotated local StructuralVolumes are outside this contract.

Same-layer adjacent cell intervals are merged so mathematical partition boundaries do not create extra armor. `isArmorLayer` identifies the layer; `coveredByArmor` on a Hull hit records earlier armor on that ray. A ray starting inside material reports undefined incidence instead of inventing an entry face.

Normal rendering never invokes a probe or additional debug mesh generation. Probe acceleration is built lazily on request. Geometry source caches and the most recent immutable physical result are bounded; repeated identical designs avoid unnecessary physical replanning. The last successful ordinary validation is cached by all referenced geometry/accounting contents (maximum 64Mi characters); changed/imported contents revalidate and explicit overlap QA always runs independently.

## Blueprint, instances and UI

Schema version remains 2 because this is an optional additive extension, with its own physical/material registry version. Old Blueprints load and render unchanged. Schema 1 lacks the StructuralVolume contract and remains rendering-only, with no invented physical history; explicit estimated migration is supported for schema 2. `migratePhysicalDesign()` is explicit, preserves geometry/weapon/platform data, and marks `MIGRATED_DEFAULT_ESTIMATE`. Historical materials are never claimed to be known. New generator 1.8.6.0 requires its physical extension.

Fixed design data contain no combat damage. `ShipPhysicalInstanceState` has separate localized damage/perforation maps per instance; the factory initializes independent state. Future material failure IDs and seven interaction categories are contracts pending V1.8.6.4, not working combat mechanics.

Production adds Armor Thickness, Physical Materials, Physical Coverage and Armor Ray Probe views plus a collapsible inspector. Thickness colors show assigned bounded facet depths; the probe reports actual normal/path lengths at a point, including edge reduction. Coverage colors show finite armor versus bare structural skins. Surface-area retention is distinct from directional Hull protection; QA's directional coverage uses explicitly requested area-weighted ray samples and is labelled approximate.

## Focused execution

```sh
npm install
npm run dev
npx vitest run tests/physical-foundation.test.ts
npx vitest run tests/free-mount.test.ts -t 'direct fit|raises a supported platform|history includes platform|external validation ignores|missile outward paths|regeneration keeps'
npm run build
```

Browser QA uses local Chromium with SwiftShader. `tests/physical-qa.mjs`, `physical-controls.mjs`, `physical-performance.mjs` and `physical-ui.mjs` cover only this change. Retained Before artifacts must not be overwritten when replaying. Full test suites, full Architecture×Yard×Seed matrices, combat tests and historical pixel collections are intentionally excluded. See `qa/v1.8.6.0/REPORT.md` for measured results and unresolved limits, including cold-generation cost.
