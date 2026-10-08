import type {
  HullStation,
  ShapeDefinition,
  ShapeKind,
  StructuralVolume,
  Profile,
  ArchitectureGrammar,
} from "../../blueprint/types";
import type { Shipyard } from "../../shipyards/config";
import type { SeededRng } from "../../random/rng";

export const SHAPE_CONTEXT: Record<string, readonly ShapeKind[]> = {
  nose: ["WEDGE", "TAPERED_PRISM", "CLIPPED_BOX", "LONG_LOFT"],
  core: ["CHAMFERED_BOX", "FLATTENED_HEX", "COMPOUND_LOFT", "HEX_PRISM"],
  missile: ["CHAMFERED_BOX", "CLIPPED_BOX", "FLATTENED_HEX"],
  engine: ["TAPERED_PRISM", "HEX_PRISM", "ARMORED_CYLINDER", "SHORT_LOFT"],
  spine: ["TAPERED_PRISM", "LONG_LOFT", "CLIPPED_BOX"],
  sensor: ["ARMORED_CYLINDER", "HEX_PRISM", "SHORT_LOFT"],
  supply: ["BOX", "CLIPPED_BOX", "HEX_PRISM", "CHAMFERED_BOX"],
};
export function shapeContext(v: StructuralVolume) {
  if (v.id === "armored-keel") return "core";
  if (v.type === "SPINE") return "spine";
  if (v.type === "NACELLE" || v.purpose === "propulsion") return "engine";
  if (v.purpose === "sensor") return "sensor";
  if (v.id.includes("fore")) return "nose";
  if (v.purpose === "weapon") return "missile";
  if (v.purpose === "supply") return "supply";
  return "core";
}
export function shapeDefinition(
  kind: ShapeKind,
  size: { x: number; y: number; z: number },
  variant = 0.5,
): ShapeDefinition {
  const profiles: Partial<Record<ShapeKind, Profile>> = {
    BOX: "box",
    HEX_PRISM: "hex",
    FLATTENED_HEX: "flattened",
    ARMORED_CYLINDER: "rounded",
  };
  return {
    kind,
    length: size.z,
    width: size.x,
    height: size.y,
    frontScale: 0.26 + variant * 0.4,
    rearScale: 0.65 + variant * 0.25,
    topSlope: 0.025 + variant * 0.065,
    bottomSlope: 0.02,
    sideSlope: 0.02,
    chamfer: 0.16 + variant * 0.2,
    roundness: kind === "ARMORED_CYLINDER" ? 0.75 : 0.15,
    frontProfile: profiles[kind] ?? "chamfer",
    rearProfile: profiles[kind] ?? "chamfer",
    taper: 0.15 + variant * 0.3,
    waist: 0.6 + variant * 0.25,
    shoulder: 0.24 + variant * 0.2,
  };
}
export const ARCHITECTURE_SHAPES: Record<
  ArchitectureGrammar,
  readonly ShapeKind[]
> = {
  MONOLITHIC: ["COMPOUND_LOFT", "LONG_LOFT", "FLATTENED_HEX"],
  BLOCK_ASSEMBLY: ["CHAMFERED_BOX", "CLIPPED_BOX", "FLATTENED_HEX", "WEDGE"],
  SPINE_AND_MODULES: [
    "LONG_LOFT",
    "TAPERED_PRISM",
    "ARMORED_CYLINDER",
    "HEX_PRISM",
  ],
  TRUSS_POD: ["CLIPPED_BOX", "HEX_PRISM", "ARMORED_CYLINDER", "BOX"],
  TWIN_HULL: ["COMPOUND_LOFT", "LONG_LOFT", "WEDGE", "FLATTENED_HEX"],
  CORE_AND_NACELLES: ["SHORT_LOFT", "TAPERED_PRISM", "ARMORED_CYLINDER"],
  STACKED_BLOCKS: [
    "FLATTENED_HEX",
    "CHAMFERED_BOX",
    "COMPOUND_LOFT",
    "CLIPPED_BOX",
  ],
  HYBRID: ["LONG_LOFT", "TAPERED_PRISM", "HEX_PRISM", "ARMORED_CYLINDER"],
};
export function chooseShape(
  v: StructuralVolume,
  yard: Shipyard,
  rng: SeededRng,
  grammar: ArchitectureGrammar,
): ShapeDefinition {
  const context = shapeContext(v),
    candidates = SHAPE_CONTEXT[context];
  const preferred = candidates.filter((k) => yard.shapePreferences.includes(k));
  const architectural = candidates.filter((k) =>
    ARCHITECTURE_SHAPES[grammar].includes(k),
  );
  const kind = rng.pick([
    ...candidates,
    ...preferred,
    ...preferred,
    ...architectural,
  ]);
  const shape = shapeDefinition(kind, v.dimensions, rng.range(0, 1));
  if (yard.structure === "swift") shape.frontScale *= 0.65;
  if (yard.structure === "heavy") {
    shape.frontScale = Math.max(0.55, shape.frontScale);
    shape.chamfer = 0.3;
  }
  if (yard.structure === "clean") {
    shape.topSlope = 0.035;
    shape.sideSlope = 0.01;
  }
  if (v.type === "SPINE") {
    shape.frontScale = 0.72;
    shape.rearScale = 0.88;
  }
  return shape;
}
/** Eight vertices per section keep topology bounded and attachment queries identical to rendering. */
export function shapeStations(s: ShapeDefinition): HullStation[] {
  const count =
    s.kind === "COMPOUND_LOFT"
      ? 11
      : s.kind === "ARMORED_CYLINDER"
        ? 10
        : s.kind === "LONG_LOFT"
          ? 9
          : 5;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    let w = 1,
      h = 1;
    switch (s.kind) {
      case "WEDGE":
        w = s.frontScale + (1 - s.frontScale) * Math.min(t / s.shoulder, 1);
        h = 0.25 + 0.75 * Math.min(t / 0.7, 1);
        break;
      case "TAPERED_PRISM":
        w = s.frontScale + (s.rearScale - s.frontScale) * t;
        h = 0.65 + 0.35 * t;
        break;
      case "CLIPPED_BOX":
        w = t < 0.25 ? 0.62 + 1.52 * t : t > 0.75 ? 1 - (t - 0.75) * 1.1 : 1;
        h = t < 0.25 ? 0.78 + 0.88 * t : 1;
        break;
      case "ARMORED_CYLINDER":
        w = h = i === 1 || i === count - 2 ? 1 : 0.84;
        break;
      case "SHORT_LOFT":
      case "LONG_LOFT":
        w =
          t < s.shoulder
            ? s.frontScale +
              (1 - s.frontScale) * Math.sin(((t / s.shoulder) * Math.PI) / 2)
            : 1 -
              (1 - s.rearScale) *
                Math.pow((t - s.shoulder) / (1 - s.shoulder), 1.3);
        h = 0.68 + 0.32 * Math.sin(t * Math.PI * 0.85);
        break;
      case "COMPOUND_LOFT": {
        const anchors = [
          s.frontScale,
          0.55,
          0.83,
          1,
          0.98,
          s.waist,
          0.86,
          1,
          0.92,
          s.rearScale,
          s.rearScale * 0.95,
        ];
        w = anchors[i];
        h = 0.64 + 0.36 * Math.sin(t * Math.PI * 0.9);
        break;
      }
      case "FLATTENED_HEX":
        h = 0.82;
        break;
    }
    if (s.stationScales) {
      const scales = s.stationScales;
      const a = [...scales].reverse().find((p) => p.t <= t) ?? scales[0];
      const b = scales.find((p) => p.t > t) ?? scales.at(-1)!;
      const f = a.t === b.t ? 0 : (t - a.t) / (b.t - a.t);
      w = a.width + (b.width - a.width) * f;
      h = a.height + (b.height - a.height) * f;
    }
    return {
      z: (t - 0.5) * s.length,
      width: s.width * w,
      height: s.height * h,
      profile: t < 0.5 ? s.frontProfile : s.rearProfile,
      bevel: s.chamfer,
      topSlope: s.topSlope,
      sideSlope: s.sideSlope,
      bottomSlope: s.bottomSlope,
      roundness: s.roundness,
    };
  });
}
export function syncShape(v: StructuralVolume) {
  if (!v.shape) return;
  v.shape.width = v.dimensions.x;
  v.shape.height = v.dimensions.y;
  v.shape.length = v.dimensions.z;
  v.geometry.stations = shapeStations(v.shape);
}
