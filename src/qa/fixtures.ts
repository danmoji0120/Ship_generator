import type {
  JoinType,
  ShapeKind,
  ShipBlueprint,
  StructuralVolume,
} from "../blueprint/types";
import { DEFAULT_ORDER, generateBlueprint } from "../generation/generate";
import { shapeDefinition, syncShape } from "../generation/shapes/definition";
import { boundaryToward } from "../generation/architecture/volumes";
function volume(
  id: string,
  kind: ShapeKind,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  length: number,
): StructuralVolume {
  const v: StructuralVolume = {
    id,
    type: "HULL_BLOCK",
    purpose: "habitat",
    position: { x, y, z },
    rotation: { x: 0, y: 0, z: 0 },
    dimensions: { x: width, y: height, z: length },
    geometry: { primitive: "Chamfered Box", stations: [] },
    connectionIds: [],
    hierarchyTier: 1,
  };
  v.shape = shapeDefinition(kind, v.dimensions, 0.6);
  syncShape(v);
  return v;
}
function fixture(volumes: StructuralVolume[]): ShipBlueprint {
  const b = generateBlueprint(DEFAULT_ORDER, 7, { architecture: "MONOLITHIC" });
  b.structuralVolumes = volumes;
  b.structuralConnectors = [];
  b.hardpoints = [];
  b.engines = [];
  b.surfaceFeatures = [];
  b.trusses = [];
  b.architecture.rootVolumeId = volumes[0].id;
  return b;
}
export function shapeFixture(kind: ShapeKind) {
  return fixture([
    volume(
      kind,
      kind,
      0,
      0,
      0,
      80,
      50,
      kind === "LONG_LOFT" || kind === "COMPOUND_LOFT" ? 220 : 110,
    ),
  ]);
}
export function joinFixture(type: JoinType) {
  const gap =
    type === "OVERLAP"
      ? -12
      : type === "RECESSED"
        ? -18
        : type === "FLUSH"
          ? 0
          : 40;
  const a = volume(
      "wide-hull",
      "CHAMFERED_BOX",
      0,
      0,
      -50 - gap / 2,
      80,
      50,
      100,
    ),
    b = volume("aft-module", "HEX_PRISM", 0, 0, 50 + gap / 2, 50, 35, 100);
  const blueprint = fixture([a, b]);
  const start = boundaryToward(a, b.position),
    end = boundaryToward(b, a.position),
    length = Math.abs(end.z - start.z);
  blueprint.structuralConnectors = [
    {
      id: "test-join",
      fromStructureId: a.id,
      toStructureId: b.id,
      type:
        type === "TRUSS"
          ? "TRUSS"
          : type === "BOOM"
            ? "BOOM"
            : type === "BRIDGE"
              ? "BRIDGE"
              : type === "NACELLE_MOUNT"
                ? "NACELLE_MOUNT"
                : "DIRECT",
      start,
      end,
      thickness: type === "BOOM" ? 10 : 24,
      style:
        type === "TRUSS"
          ? "box truss"
          : type === "BOOM"
            ? "straight beam"
            : "armored collar",
      join: {
        type,
        length: Math.max(2, length),
        width: type === "BRIDGE" ? 55 : type === "STRUCTURAL_NECK" ? 22 : 35,
        height: type === "STRUCTURAL_NECK" ? 20 : 30,
        overlap: type === "OVERLAP" ? 0.24 : 0,
        inset: type === "RECESSED" ? 10 : 3,
        transitionRatio: 1.6,
        armorScale: 1,
        supportScale: 0.7,
        styleVariant: 0,
        supportLoad: 50000,
      },
    },
  ];
  a.connectionIds = b.connectionIds = ["test-join"];
  return blueprint;
}
