# Ballistic foundation / V1.8.6.4

This module operates on an existing `ShipBlueprint`. It neither generates new hulls nor edits a design. `DamageInstance` is a separate schema-1 runtime contract; each built ship gets its own system, opening, structure, and localized material state. Existing schema-2 Blueprints remain generator-contract 1.8.6.3.1. Loading an old design does not insert new armor or devices.

## Running a shot

Prepare `prepareDamageQueries(blueprint)` once. Supply a `DamageTarget` with initial world translation, normalized quaternion and constant linear velocity. Launch an explicit `ProjectileSpec` at an arbitrary origin/direction, then call `advanceProjectile` on a fixed timestep. `resolveProjectile` is a developer helper for a complete shot. No target selection guarantees a hit. The future `KineticEmitterBinding` requires an explicit ammunition specification; visual equipment caliber does not determine penetration.

Queries reuse the existing finite armor/hull cells, exclusive frame stock, bulkhead/closure geometry, and actual equipment OBBs. They are merged into distance order, with same-owner/layer stock unioned. Different overlapping owners at entry are unresolved. A later intersecting owner clips the current interval and forces a new query at its interface. Physical joints reference actual member stock, and do not introduce another metal sphere. Unspecified exterior housings/platform solids and unresolved SPINE boundaries produce `UNRESOLVED`, not invented resistance. Open rooms and open apertures are empty space. A blocked opening has a separately specified actual leaf position.

## Development calibration, not certified ballistics

The four ammunition presets and `DEVELOPMENT_CALIBRATION_V1` are invented test values. No coefficients are empirical penetration certifications or final combat balance. Constituent materials have separate strength, density, drag, brittleness, crater response and grazing behavior. Composite layers are processed individually using their existing actual constituent thicknesses.

Incident energy is `0.5 * remainingMass * relativeSpeed²`. Finite path work is penetrator projected area times effective path times a strength/tip/aspect/obliquity term plus a density/velocity drag term. Erosion removes projectile mass and associated remaining energy. Integrity depends on layer work, brittleness and projectile fracture resistance. Grazing normal energy can produce reflection; residual direction is queried again. Surviving penetrations receive a small calibrated exit-boundary deflection. Stops advance only to the computed stop depth; unresolved contacts create no material damage. No outcome is selected by caliber alone or by an armor HP counter.

## Explicit geometric approximations

- Flight CCD sweeps the **centerline** through finite volumes. Rod radius affects work and local damage/channel size, but does not broaden lateral collision. It is not full rigid-cylinder shape CCD. Near-edge finite-radius-only contacts can be missed.
- The target may have a fixed initial rotation and constant linear motion. Continuously rotating-target collision is explicitly unresolved at contact.
- Motion inside one material interval uses a straight chord and an average-speed dwell. Deflection applies at exit, not through an integrated in-material trajectory.
- Equipment is its specified finite OBB and specified equipment mass smeared through the OBB, with fill fraction capped at one. It is not a fully solid steel envelope or detailed machinery model.
- Holes are actual finite capped cylinders along each traversed material chord. A differently angled repeat can encounter residual stock at a cap or a different downstream face. Overlapping holes subtract the union of intervals. Stops create localized resistance loss only near that impact, bounded to at least 35% of initial path resistance; no global armor depletion.
- Frame/joint failure uses conservative 16×16 section tiles in a projected bounding rectangle of the actual owned stock (independent of assumed beam roll); a tile disappears only if all corners lie in one real channel. This never double-counts overlapping holes, but underestimates removed section on irregular/hex/loft sections. It is a game structural connectivity criterion, not FEM or measured joint strength. Only real member/edge/joint references are disabled.
- Local device coupling and integrity thresholds are calibrated approximations. Actual hit positions must intersect the device before any state changes; the existing power/control network evaluator then computes capabilities. Pure evaluation never consumes backup energy.

## State, limits and lifetime

Design mass, material registry and physical geometry never change on firing. Debris mass removal is not implemented; the existing 10% UNKNOWN_LEGACY service estimate is retained. Geometry caches are immutable and existing lazy queries are reused. Material density is read from the existing material registry; only the game response coefficients live here. Profiling is opt-in WeakMap data, outside deterministic JSON. The normal renderer has no damage overlay unless the laboratory is enabled.

Events retain the latest 256 records; local physical damage retains up to 4096 regions. Further damage then fails explicitly as `UNRESOLVED`, rather than silently forgetting old holes. Each shot has a 128-contact safety limit, six-ricochet limit and finite flight horizon. The lab owns two instances, one current projectile, a 256-point trajectory and at most 128 rendered damage regions / 64 markers. Reset replaces only the selected instance; closing drops the active projectile/query handle and overlay and restores the camera/normal pose and prior Inspector analysis state. Existing power/control/equipment and aperture debug views use the active damage instance while enabled. Overlay geometry is explicitly disposed. Simulation remains fixed at 60Hz, while free-flight overlay redraw is capped near 20Hz; a new actual impact and explicit Step update immediately. Capability/graph summaries are reused until the instance revision changes. The contact selector inspects and focuses an actual ordered event. The runtime instance can be JSON serialized independently; the UI exports it and traces, but does not provide a runtime savegame importer or resumable projectile import.

No explosion, fragment cloud, decompression, fire, ship separation, realtime mesh cutting or combat game is implemented. No free-mount internal-space/support requirement is added.
