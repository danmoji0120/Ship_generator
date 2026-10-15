# Physical geometry and mass integrity — V1.8.6.0.1

This patch keeps the schema-2 physical design contract, material registry, priorities, finite coating cells, outer render meshes and external equipment installation rules. New generated Blueprints identify generator `1.8.6.0.1`; existing `1.8.6.0` documents load without being rewritten. The optional mass ledger is required only on new patch-version exports.

## Integration without layer meshes

The stored coating cell remains authoritative. Each closed convex mesh is decomposed into tetrahedra about an interior vertex average. Determinants integrate volume below each original facet-depth plane. Differences of cumulative volumes give constituent volumes. This replaces repeated mesh clipping in generation and validation; density, nominal depth, source facets, clipping and overlap checks are unchanged. `pieceLayers` remains available as an independent clipping reference and for consumers that explicitly need a constituent mesh.

Floating-point results need not be bit-identical to the old cap triangulation. QA records volume and mass differences; the material and geometry choices remain exact. Cells below the original represented-volume threshold retain that threshold.

## Prepared physical queries

`preparePhysicalQueries(blueprint)` creates a runtime-only immutable query snapshot. It indexes complete finite cells and intersects their original supporting planes plus constituent-depth planes. It does not build layer meshes. Constituent intervals retain the original minimum represented-volume cutoff, evaluated by the same finite-volume integrator. Call `.probe(...)` on the handle for repeated runtime shots. Calling the preparer again checks an exact content signature, including geometry, material identifiers, layer depths and unresolved SPINE geometry. Editing a Blueprint invalidates the next preparation; a previously returned handle deliberately keeps its original snapshot. `armorRayProbe` is the convenient content-checked one-shot API.

Preparation can run explicitly before departure; Normal rendering and debug-off generation do not prepare query structures. Cache keys, BVHs, timings and handles never enter Blueprint JSON. The per-design WeakMap releases query snapshots with their keys. Existing source geometry cache remains bounded to four entries, physical design cache to one, successful ordinary validation cache to one; explicit overlap QA never uses the validation shortcut.

## SPINE boundaries

Existing SPINE volumes include axial weapon supports and central structural bridges. The renderer draws finite lofts, but the data do not specify their shell material, wall thickness or solid-metal occupancy. This patch traces those actual finite boundaries on demand and reports `unresolvedCrossings`. A ray crossing one returns `complete: false` with an explicit reason. Known armor/hull intervals remain available. An unresolved crossing is not armor, not a material interval, and not an inferred full metal block. Frame material/thickness generation remains future work; the missing physical material specification is not claimed solved.

## Mass ledger and budgets

The optional version-1 ledger separates geometry-derived Hull/Armor from estimated structure, core equipment, mounted equipment, owned platform and other unresolved components. Owned platforms are excluded from mounted equipment and counted once in their own entry. Existing 18% structure and 10% unresolved reference proxies remain estimates; the complete legacy mass reference is replaced rather than added again. Equipment representation densities are estimates, not validated hardware masses. Consumables are excluded.

The existing order target already acts as a base-design generation limit. It is not silently redefined as a new maximum operating mass: `maximumAllowedMassKg` is null. Base design and mounted loadout have separate balances. Exterior equipment over target is reported without adding a mass or internal-space installation gate. A mounted item cannot excuse a base design that already violates the target. Validation recomputes the ledger from actual design data.

## Diagnostics

The existing physical Inspector exposes the ledger, physical cell/layer counts, explicit query preparation and an opt-in next-generation profile. Timings are runtime-only WeakMap data. Nested stage timings overlap and must not be added together. Debug-off generation performs no query preparation or extra visualization analysis.

The reproducible measurements, failures, numerical differences and screenshots are recorded in `qa/v1.8.6.0.1/REPORT.md`. Only directly related tests are run.
