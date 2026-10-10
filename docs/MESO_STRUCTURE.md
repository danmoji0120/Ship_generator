# V1.8.5.3 Meso structure contract

The physical authority remains Production Design V1.8.4.2. The new optional `mesoStructurePlan` is a visual structural layer, not an armor coverage, mass, or combat-performance authority. Historical blueprints are rendered as stored; only a new default/V1.8.5.3 generation invokes the planner. `version: '1.8.5.2'` retains the former complete generation path.

## Pipeline and ownership

Requirements → Macro/Hull → Production armor/coverage → functional equipment → weapons/requirements → existing exterior kits → **Meso zones, closed solids, safety replay** → material appearance → final exposed-surface textures/decals. Earlier stages and their RNG streams are unchanged. Meso selection uses its own `meso-structure-v1` hash namespace. All accepted world solids, bounds, parent references, contacts and recipe parameters are serialized; the renderer chooses no placements.

## Library

| Structure | Actual support / purpose | Shape |
|---|---|---|
| ARMOR_STEP | Primary armor, command apron | Broad faceted terrace and narrower raised crest |
| ARMOR_SHOULDER_EXTENSION | Existing shoulder/joint | Tapered two-tier cover |
| WEAPON_BARBETTE_INTEGRATION | Beside M/L cannon footprint | Sloped apron and mechanical supply haunch |
| MACHINERY_GALLERY | Bank of an existing open channel | Low support sill, two separated longitudinal rails, service header |
| ENGINE_ROOT_TRANSITION | Actual engine host upstream of outlet | Faceted haunch and shorter supply cover |
| FLANK_ARMOR_BELT | Lower portion of an existing side belt | Partial overlapping cover and shorter junction |
| VENTRAL_KEEL_SUPPORT | Existing keel or lower housing | Broad haunch and narrow ventral web |
| SERVICE_RECESS_FRAME | Bank of an existing service channel | Open rail frame with entry/header protection |

The shoulder and step share the clipped terrace primitive; gallery and recess share an open frame primitive. They are functional variants, not eight unrelated mesh templates. Missing functional support produces omissions, not invented channels or new holes in a closed hull.

## Measured support

Each candidate starts from a real triangle ray hit. Its local right/normal/forward basis supports top, bottom, sides and sloping surfaces. Thirteen perimeter/interior samples must find legitimate exposed armor/finish/hull support of the same structural parent, outside equipment. The normal cone is limited to 28 degrees (`dot >= .88`). Surface relief is bounded relative to the proposed cover height. These permit a faceted station transition; they do not substitute AABB contact for actual surface contact.

The footprint clips the actual exposed station triangles. Projected patch area must match the footprint within 0.2%; occluded faces are excluded. A single closed boundary is required. Reversed patch triangles become the solid's embedded bottom. Its stepped walls and chamfered roof close the volume. Roof clearance uses the maximum of all patch vertices. This avoids a planar bottom chord cutting through a tapered hull. Higher tiers intentionally overlap the lower tier by 35mm.

## Safety and failure policy

Broad-phase bounds, solid-containment samples, explicit edge/triangle intersections and thirteen surface contacts are combined. Existing equipment envelopes, firing-ray samples, protected openings, XL spaces, sensor sight samples, kit service-access rays and negative-space targets are retained. Parent embedding is allowed only to the recorded small inset. Existing weapon placement, physical size and safety criteria are never relaxed.

Candidates try five coherent longitudinal positions at three bounded footprint scales. Weapon-clearance failures can re-plan a lower cover at the same footprint; every resulting solid is checked again. A 7/14/26-structure hierarchy budget limits density across small/medium/large ships. Optional candidates can be omitted; final safety replay retains valid placements individually. Omission decisions include parent, kind, candidate index and actual reason. An optional structure never changes a released physical design into a requirements rejection.

These checks are conservative, not complete CSG, continuous turret-motion collision, exhaustive coplanar triangle intersection, or a proof of every possible firing direction. Existing access validation samples an access ray, not a simulated crew path.

## Style and rendering

Aegis uses taller, broad faceted tiers; Vesper lower narrower tapered covers; Forge clipped modular covers and stronger exposed mechanics; Serein low broad precise tiers. They differ through actual width/height/clip/taper, not only color. Functional zones are obtained from existing armor roles, channels and engine/weapon references; no Seed 7 coordinates, saved pilot blueprint or fixed Hull IDs are imported.

Parts reuse the existing five material-role batch renderer and shared surface shader. Blueprint IDs remain in merged batch metadata. Normal rendering, including detail OFF, retains Meso. `Meso Structures` and `Without Meso` are rendering-only QA views. `Functional Exterior Only` and weapon debug modes exclude Meso; `Structural Armor Only` includes the new major visual structures. Final camera fit includes Meso bounds; physical production coverage/bounds remain their original authority.

LOD classes are metadata (`SILHOUETTE_RELEVANT`, `STRUCTURAL_READABLE`, `CLOSE_DETAIL`), not a completed full-ship geometry LOD compiler. No extra defensive strength, physical mass, simulated machinery or weapon performance is assigned.

Major L cannon integration zones are resolved before optional armor terraces. Their longitudinal search uses the actual mount's local forward axis and footprint length; integration cannot migrate along the entire hull. Channel-bank structures search only the usable length of their actual service channel. Propulsion candidates remain in a short upstream region. Saved source associations and weapon/channel neighborhoods are independently replay-validated.

`availableAreaM2` in a detected zone is a facing-triangle candidate area estimate before equipment occlusion, not exact remaining exposed area or an armor coverage measure. Accepted support is separately measured by the serialized clipped root patch and thirteen contact samples. Complete surface-area subtraction/union is not implemented.
