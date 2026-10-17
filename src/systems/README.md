# Functional internal systems (1.8.6.3)

Only new 1.8.6.3 procurement creates an optional schema-1 `functionalSystems`.
Explicit older generator contracts and loaded Blueprints are not upgraded.
Compartments retain their 1.8.6.2.1 contract and geometry.

- Registry: eight immutable game specifications. MW is power; MJ is energy;
  MW × seconds = MJ. Specified dry kg includes unmodelled machinery, not
  homogeneous envelope volume × casing density. These are not engineering data.
- Placement: confirmed finite CSG compartments, actual OBB query, .2m clearance,
  bounded deterministic anchors and offsets, mutual equipment exclusion. No
  unresolved SPINE, solid connector, deleted wall or invented room is used.
- Primary procurement priority selects the package. Secondary still affects
  existing Hull/Frame/room policy and available placement; no separate secondary
  equipment-package blend is claimed. Six actual finite armor ray samples guide
  Armor placement; they are not full solid-angle coverage or survival probability.
- Power: deterministic residual flow, distribution vertex and edge capacities,
  generator limits, essential-consumer priority. Generation precedes reserve.
  Finite storage output and MJ/interval limits constrain dispatch. Charging uses
  a real path and never occurs with simultaneous storage dispatch. No losses,
  voltage transients, fuel consumption or cooling simulation.
- Control reachability is independent of power. A powered controller with no
  surviving command path has zero command authority. Existing engine/RCS IDs are
  reused. Dimensionless authority is not simulated thrust, acceleration, torque,
  radar range or actual combat flight. Absent discrete RCS is explicitly labelled
  as an existing-engine control-interface fallback.
- `evaluateShipCapabilities`: binds actual installed free-entry IDs. Missing
  authoritative external MW is LEGACY_UNSPECIFIED, not zero known consumption.
  One channel per mount is a declared accounting convention. An optional explicit
  operatingSpecification is caller-authored, never retroactively inferred.
  Sensor loads use labelled fixtures: no combat sensor model exists in Free-Mount.
- `createSystemInstanceState`, `advanceSystemState`: independent instance state;
  advance returns a new state. Virtual failure/reset never changes design geometry.
  Capability/failure evaluation needs no Hull triangles or regeneration.
- Redundancy analysis evaluates actual equipment removal and separately whole
  compartment loss at a 1s quasi-steady horizon. It does not certify indefinite
  endurance, repair or calibrated combat survivability.
- `prepareFunctionalQueries`: owned finite plane snapshot; ship-local point/ray
  results describe OBB envelopes and stable IDs, not internal machine components
  or penetration/damage. `equipmentSpaceClear` composes actual equipment exclusion
  with the immutable architectural interior `fits`; the Interior Ray UI adds
  equipment intervals as a separate physical layer. No structural/access/power/control graphs are conflated.

## Accounting and constraints

Functional dry mass is counted once as EQUIPMENT_DEFINED. Existing housing/core
and engine estimates are separate. The old 10% service proxy has no itemized scope;
it remains a conservative unallocated estimate with potential overlap, rather
than arbitrarily subtracting equipment mass. This is not a certified exact total.
Hard base mass/cost constraints still apply. Mounted external equipment is
separate and is never refused for internal space, power or control shortage.

No functional-generation cache is introduced. The bounded one-entry exact
validation key includes equipment, compartment, source and installed operating
specifications. Query snapshots are released on validation and cache-hit exits.
System debug meshes exist only in the five system views; Normal is unchanged.

See `qa/v1.8.6.3/REPORT.md` for actual QA, timings and limitations. Do not run the
full historical suite for this feature; use the recorded targeted commands.

### V1.8.6.3.1 stability contract

New procurement uses generator contract `1.8.6.3.1`; the functional plan remains schema 1 / version `1.8.6.3`. Historical generation and loaded files keep their original accounting. The optional mass-ledger `reconciliation.policyVersion` distinguishes the new provenance report. It does not rescale density, thickness, or mass to a target.

The legacy service allowance is `dimensions.estimatedMass * 1000 * 0.10`. That rounded tonne reference comes from the legacy macro volume/density model, not the procurement target or a percentage of the new ledger total. No service inventory identifies its constituent equipment. It remains **UNKNOWN_LEGACY** with no invented physical owners. No deduction is justified in current production data. `reconcileOwnedMass` retires an estimate only when all its explicitly itemized owners are realized; duplicate actual owners, negative masses and ambiguous partial overlaps are rejected. Model-derived material and equipment-specification mass are separated from representation-density / unresolved estimates. Aggregate ownership labels for remaining legacy categories are not itemized engine engineering models.

Functional placement has one immutable JSON plan template, keyed by exact source content (including finite interior, armor normals/layers/piece mapping, engines, RCS and order). Caller instances receive independent parsed plans. The plan cache and successful functional validation cache each have a 64 MiB UTF-16 key-size bound. They share the source string when it fits. These are estimates of string storage, not measured process memory, and must not be added as if the shared key existed twice. Oversized inputs are fully generated and validated without retaining these entries; no geometry checks are skipped. Explicit clear methods support diagnostics. Other pre-existing caches keep their own policies.

Evaluation remains pure. `advanceSystemState` increments only the returned instance clock and energy. `advanceSystemInterval(plan, state, from, to, loads)` rejects an already applied or out-of-order interval relative to that clock. Repeating a call with the same original input deterministically yields the same output; callers must adopt the returned state. UI Reset deliberately creates a fresh instance, including full initial backup energy, rather than simulating a repair/recharge process. OFFLINE and DESTROYED units retain design mass.

Production UI keeps a reference to its immutable current design for Reload rather than a permanent second full JSON string. Export uses compact JSON; View JSON/Copy still support formatted output, and closing the dialog releases its formatted DOM text. Ship replacement disposes owned renderer objects and releases obsolete interior/physical prepared queries. Network failures still update only small runtime state and debug meshes. No internal fitment, power, feed or structural-load gate was added to Free-Mount.
