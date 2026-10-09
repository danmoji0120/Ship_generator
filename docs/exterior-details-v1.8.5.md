# V1.8.5 Functional Exterior Detail Language

The default generator finishes the unchanged V1.8.4.2 Requirements-first design, then adds an optional `exteriorDetailPlan`. Detail placement never adjusts the Hull, armor, mandatory requirements, existing machinery or weapons. Explicit `{version:'1.8.4.2'}` retains the previous generator. Historical JSON without the optional plan renders without additional detail.

## Ownership and pipeline

1. Requirements, Hull, armor, functional equipment and weapons finish and pass their original release checks.
2. `details/zones.ts` resolves functional hosts from actual production channels, command/sensor assemblies, engine hosts, armor joints and weapon foundations.
3. Existing `armorSurfaces` and triangle-ray queries are extended with final machinery/foundation surfaces. A right-handed detail frame projects a longitudinal tangent onto the measured surface normal; axial caps have a stable fallback.
4. Independent per-zone/per-kit seed streams choose traversal order on coherent service sites. They do not consume Macro/armor/weapon RNG. Final surface contacts determine all coordinates.
5. Kit geometry reuses `ParametricPrefabAssembly`, Station profiles and closed faceted solids. Five footprint probes, or nine for a long channel route, reject unsupported edges and steps.
6. Actual geometry, reserved spaces, weapon envelopes/static firing samples, equipment apertures, other details and service access are checked. Only the optional kit is omitted on failure; the original ship and reservations are never relaxed.
7. Accepted world solids, contacts, references, decisions and enlarged exterior bounds are serialized. The renderer batches their saved geometry by material and LOD. No rendering RNG exists.

The optional plan owns only detail placements and its additional bounding volume. It does not append to the original `prefabPlacements`, alter doctrine resource accounting or claim new equipment performance. `schemaVersion:2`, top-level `generatorVersion:'1.8.5'`; `productionDesign.pipelineVersion` and Requirements-first version keep their original meanings.

## Kit library and functional rules

| Zone | Permitted recipe / purpose |
|---|---|
| COMMAND | ACCESS_HATCH, EVA_HANDRAIL, EVA_LADDER, SENSOR_STRIP on actual command housing |
| SENSOR | SENSOR_STRIP, OPTICAL_SENSOR beside the existing instrument housing |
| WEAPON_PRIMARY | WEAPON_SERVICE_RING and ACCESS_HATCH on the outer foundation apron, outside weapon bodies and sampled firing paths |
| MISSILE_BAY | MISSILE_CELL_DETAIL, HAZARD_MARKING on the installation foundation; no lid over a missile exit |
| PROPULSION | ENGINE_SERVICE_FRAME, VENT_LOUVER, COOLANT_PIPE, MACHINE_ACCESS_COVER, HAZARD_MARKING on engine-host flanks, clear of exhaust/radiator reservations |
| SERVICE_CHANNEL | MACHINE_ACCESS_COVER, CONDUIT_BUNDLE, SERVICE_CATWALK, EVA_LADDER, SERVICE_PORT, COOLANT_PIPE, DRONE_DOCK in a real channel/pump access area |
| ARMOR_JOINT | REINFORCEMENT_BRACKET, ARMOR_CLAMP, PANEL_SEAM at existing belt/citadel/keel joints |
| MANEUVERING | RCS_CLUSTER on suitable fore/aft, flank or belly service surfaces |
| GENERAL_HULL | Sparse ACCESS_HATCH, RECESSED_SERVICE_PANEL for inspection; intentionally untouched large armor surfaces |

All **21 kits** have parameterized solids and four geometric style variants. Recipes are selective: a kit supported by the registry is not guaranteed to appear on every ship. Missing equipment means no corresponding fictional zone. Density and collision omissions are recorded.

`WEAPON_SERVICE_RING` is a segmented angular maintenance saddle on the foundation apron, not a duplicate turret. `PANEL_SEAM` adds local joint lips; it does not introduce a full-Hull tile grid. `RECESSED_SERVICE_PANEL` is an inset insert within its shallow cover, not Boolean removal of the Structural Hull. Existing apertures remain the authority for actual openings.

## Scale and hierarchy

Human/drone parts keep physical meter dimensions. Nominal ladder: 0.65m wide, 2.4m long. Access hatch: 1.25m by 1.65m. Shipyard styling changes proportion/thickness within that physical class. A 600m ship does not get a 15-times larger ladder than a 40m ship.

Channel conduits/coolant routes use actual channel span, bounded to 4–12m, with unchanged physical cross section. Larger structural pockets and machinery housings remain the existing Macro-detail hosts. Meso kits explain these hosts; micro rungs/handles/cells stay subordinate. The overall placement cap is 12–72, with per-zone limits and footprint/access checks. Area, host availability and protected reservations constrain actual acceptance.

## Shipyard shape language

| Shipyard | Geometry and placement |
|---|---|
| Aegis | Wider/thicker covers, strong hinges, protected exposed frames and reinforced service access |
| Vesper | Narrower tapered covers, lower profile, fewer exposed frames/conduits, fine chamfers |
| Forge | Almost parallel clipped industrial covers, exposed catwalks/conduits and service frames |
| Serein | Broad low inserts, precise chamfered boundaries, concealed services and reduced protrusion |

These differences are shape/proportion and functional exposure rules, not just colors. Neutral close-ups are included in QA.

## Rendering and identity

- OFF: unchanged ship and required equipment; optional details invisible.
- LOW: meso kits only.
- HIGH: meso and micro.
- AUTO: meso above 90 projected ship pixels, micro above 650. This is screen-size visibility, not geometric simplification.

The UI selector changes existing batched visibility only. It never regenerates or changes the canonical Blueprint. Material/LOD batches retain part vertex ranges and placement/parent/zone IDs. Camera Fit includes the plan's extra bounds. Structural/layout debug projections omit details; Functional Exterior includes them.

## Future combat contract and limits

All kits are `VISUAL_ONLY`. RCS also records `RESERVED_FOR_COMBAT`, four nozzle openings, outward mounting frame, exhaust/thrust direction candidate and axis tags. No thrust, torque, fuel, sensor bonus, cooling performance or combat capability is simulated. A complete six-axis torque allocation is not claimed.

Safety combines exact surface-ray contact, bounds broad phase, reciprocal solid samples, reserved-zone checks and static firing-ray samples. This is not complete triangle-intersection proof, animated turret traversal, continuous sensor FOV or exhaust fluid simulation. Protected sensor checks sample a 6m aperture corridor. Pipes/rails use coherent supported local strips; curved runs that cannot satisfy contact probes are omitted. Human EVA ladders are exterior foot/hand access structures; internal crew circulation is not modeled.

At whole-ship scale most human-sized detail is deliberately subtle. This pass improves service legibility at zoom; it does not claim reference-image asset fidelity, textures, full articulating machinery or mobile GPU certification.
