# V1.8.5.1 Material & Emissive Pass

This is an appearance revision, not a geometry or equipment-generation revision. The production generator still runs the exact V1.8.5 requirements, armor, weapons and isolated detail stream. It then adds `materialAppearance: { version: "1.8.5.1", language: shipyardId }` and updates the top-level generatorVersion. Removing that field and restoring the version produces the complete original V1.8.5 JSON, including all detail world solids, reservations and release decisions. Schema version remains 2. `exteriorDetailPlan.version` remains 1.8.5 because its physical contract did not change.

`generateBlueprint(order, seed, {version: "1.8.5"})` preserves the previous generator. A saved Blueprint without materialAppearance uses the original materials and batching. Import/reload never attaches the new selector or regenerates details. `applyMaterialAppearance` is an explicit authoring operation, used by QA to compare exactly the same stored geometry. It is never called by the renderer or import path.

## Five finishes

| Role | Surface responsibility |
|---|---|
| PRIMARY_ARMOR | Dominant armored compartments; moderately rough paint |
| SECONDARY_ARMOR | Belts, shoulders, keel and equipment protection; lighter adjacent finish |
| MECHANICAL_STRUCTURE | Rails, brackets, shrouds, mantlets, casing and service machinery; darker metal |
| RECESSED_INTERIOR | Hatch insets, nozzle interiors, louvers and conduit troughs; very dark, rough finish |
| FUNCTIONAL_SURFACE | Optical cells, controls, mounting and sensing surfaces; restrained polished finish |

Structural hull underlayers retain the primary paint language at 72% linear intensity. No region is invented, no geometry is replaced, and no collision clearance is altered to obtain contrast.

Aegis uses blue-gray armored paint, thick pale protective edges, dark steel and restrained blue-white status lights. Vesper uses cooler slate paint with lower roughness, narrow existing hardware and cool guide lights. Forge uses rough warm gray industrial paint, dark exposed steel, amber maintenance/status markings and subdued green sensors. Serein uses clean pale gray-green armor, polished low-profile secondary surfaces and gentle white/mint indicators. These languages differ in roughness, metalness and contrast as well as color; preexisting kit shape/placement differences are retained.

## Existing 21-kit appearance registry

All existing kit types are tagged by KIT_APPEARANCE; part rules distinguish the physical seat from machinery, inset, lens, nozzle and rail. No kit is added and no assembly solid is rewritten.

| Kit | Main role | Functional indicator/marking | Display |
|---|---|---|---|
| ACCESS_HATCH | Secondary | Hatch rim and status point | LOW / HIGH / AUTO |
| PANEL_SEAM | Mechanical | None; existing depth remains visible | HIGH / AUTO near |
| ARMOR_CLAMP | Mechanical | None | HIGH / AUTO near |
| REINFORCEMENT_BRACKET | Mechanical | Small identification stroke | LOW / HIGH / AUTO |
| RECESSED_SERVICE_PANEL | Functional | Inset rim and status point | LOW / HIGH / AUTO |
| EVA_LADDER | Mechanical | Rail approach guide; rungs stay unlit | HIGH / AUTO near |
| EVA_HANDRAIL | Mechanical | Short guide markers | HIGH / AUTO near |
| SERVICE_CATWALK | Mechanical | Access guide markers | LOW / HIGH / AUTO |
| SERVICE_PORT | Functional | Connection status point | HIGH / AUTO near |
| DRONE_DOCK | Functional | Dock navigation indicator | LOW / HIGH / AUTO |
| CONDUIT_BUNDLE | Mechanical | Clamp status; runs remain dark | LOW / HIGH / AUTO |
| COOLANT_PIPE | Mechanical | Local propulsion/service status | LOW / HIGH / AUTO |
| VENT_LOUVER | Recessed | Local seat status; blades remain unlit | LOW / HIGH / AUTO |
| MACHINE_ACCESS_COVER | Secondary | Machinery hatch rim and status | LOW / HIGH / AUTO |
| ENGINE_SERVICE_FRAME | Mechanical | Short maintenance lights | LOW / HIGH / AUTO |
| RCS_CLUSTER | Mechanical | Housing status; nozzle openings unlit | LOW / HIGH / AUTO |
| OPTICAL_SENSOR | Functional | Optical cell emissive | HIGH / AUTO near |
| SENSOR_STRIP | Functional | Existing four sensor cells | HIGH / AUTO near |
| WEAPON_SERVICE_RING | Mechanical | Weapon service status | LOW / HIGH / AUTO |
| MISSILE_CELL_DETAIL | Functional | Cell/service status | HIGH / AUTO near |
| HAZARD_MARKING | Functional | Existing warning stripes, non-emissive | HIGH / AUTO near |

Seven supported emissive roles: BRIDGE_LIGHT, STATUS_LIGHT, MAINTENANCE_GUIDE, SENSOR_EMISSIVE, PROPULSION_EMISSIVE, WEAPON_STATUS and NAV_LIGHT. Existing command housings receive segmented bridge-window shading on their existing forward/backward faces; protected sensor optics receive a lens mask rather than being mislabeled as bridge windows. Service pump housings receive small status points. No fictitious lights are placed on empty hull regions. Indicators do not imply operational sensors, armed state, navigation lights, RCS thrust or new combat performance.

## Surface expression and batching

Renderer-only `surfacePoint`, `surfaceScale` and `surfaceMark` vertex attributes describe each saved part in its actual attachment frame. Parametric shader masks add hatch outlines, identification strokes, warning coloration, lenses, windows and short status/guide patches on existing surfaces. Position, index and normal attributes are untouched. All parts retain their Blueprint IDs and vertex ranges after batching by five shared finish materials.

Status points are capped to 0.24 × 0.36 m and guide patches to 1.10 × 0.14 m on large parts. Lens/window masks deliberately follow the dimensions of their actual sensing aperture. Emissive intensity is restrained (0.9–1.35); no bloom, point lights, animation, extra geometry, overlay z-fighting or texture/PBR asset pipeline is introduced. Standard Three.js lighting, tone mapping and antialiasing remain active.

## Display modes

OFF hides both optional detail groups, retains base theme and essential command optics. LOW shows MESO kits. HIGH shows both MESO and MICRO. AUTO keeps the original thresholds: MESO at 90px projected ship size, MICRO at 650px. Markings and lights belong to their existing kit/LOD group; visibility never rewrites the Blueprint. Geometry remains allocated in OFF/LOW, as in V1.8.5. Camera QA now evaluates AUTO from physical frame size rather than always showing both groups.

## Limits

This is flat-color procedural material shading with physically different finishes, not a complete PBR texture pipeline. Markings are visual-only, not cut seams, added armor depth or a new physical window opening. Lighting is static; emission does not illuminate neighboring surfaces. Tiny markers are intentionally invisible at whole-ship distance. Shader fragment cost and additional vertex attributes remain even when a visible part's mark is small; material batching can add a few draw calls. AUTO is visibility LOD, not geometric decimation. SwiftShader/responsive desktop testing is not mobile GPU certification. All continuous collision, firing, heat, RCS and battle-simulation limitations of the original system remain unchanged.
