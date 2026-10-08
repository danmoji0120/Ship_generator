# Procedural Shipyard V1.6 — Parametric Kitbash (phase 1)

## Scope

- Existing eight grammars and 29 compositions remain the source of the major hull silhouette.
- Reusable prefabs: ARMOR_PLATE, RADIATOR_BANK, JOINT_HOUSING.
- Each new prefab has a typed host socket, unit outward normal, size, variant and functional classification stored in schemaVersion 2 JSON.
- Hull-side sockets sample the actual 8-point station ring; connection sockets reference connector endpoints.
- Yard doctrine and order priorities influence prefab density, thickness and deployment.
- Radiator placement refuses neighbouring hull volume intrusion at attachment and outboard tip.
- Prefabs render in Normal/Structure; Structure Graph remains uncluttered. Missing optional placements still render old V1/V1.5 blueprints.
- generatorVersion 1.6; schemaVersion remains 2.

## Validation

Added `tests/prefabs.test.ts` for multiple yards/grammars/seeds, deterministic serialization, finite Three.js geometry, socket detachment, invalid normals, duplicate IDs and old blueprint render compatibility.

GitHub Actions (`.github/workflows/verify.yml`) runs `npm ci`, `npm test`, and `npm run build` on push.

**No new browser screenshot or Contact Sheet has been verified in this phase.** Create V1.6 visual QA before claiming aesthetic improvement.

## Deliberate limitations

- These are parametric geometry components, not imported GLB meshes yet.
- Thermal and protection tags are metadata only: no heat transfer, armor penetration, socket load simulation or exact surface CSG.
- Hull-side contact is based on the station ring, not arbitrary rotated meshes.
- Collision is an inexpensive local occupancy guard, not exact mesh intersection.
- `dimensions` continues to describe the major structural envelope, not extended radiators.
- Prefab kinds and weights are an extensible first pass. Future work: GLB assets, 3D socket hierarchy, contact fitting, functional Internal Zone / Structural Graph integration.

## Commands

```bash
npm ci
npm test
npm run build
npm run dev
```
