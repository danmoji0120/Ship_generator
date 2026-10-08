import type {
  ArchitectureGrammar,
  StructuralVolume,
  ShipOrder,
} from "../../blueprint/types";
import type { Shipyard } from "../../shipyards/config";
import type { SeededRng } from "../../random/rng";
import { chooseShape, shapeDefinition, syncShape } from "../shapes/definition";

export const COMPOSITIONS: Record<ArchitectureGrammar, readonly string[]> = {
  MONOLITHIC: ["BROAD_CITADEL", "FORWARD_SHOULDERS", "LENS_BODY"],
  BLOCK_ASSEMBLY: [
    "FORWARD_HEAVY",
    "CENTRAL_CORE",
    "SIDE_BATTERIES",
    "STEPPED",
    "REAR_HEAVY",
    "SPLIT_CORE",
  ],
  SPINE_AND_MODULES: ["ARMORED_BREECH", "MID_SPINE_CITADEL", "REACTOR_SADDLE"],
  TRUSS_POD: ["OUTRIGGER_BATTERIES", "AFT_MACHINERY", "STAGGERED_PODS"],
  TWIN_HULL: [
    "CENTRAL_CORE",
    "CENTRAL_SPINAL",
    "FORWARD_BRIDGE",
    "ENGINE_BRIDGE",
    "STAGGERED_HULLS",
  ],
  CORE_AND_NACELLES: ["RADIAL_DRIVES", "SWEPT_NACELLES", "COMPACT_CORE"],
  STACKED_BLOCKS: ["FORWARD_CITADEL", "LOW_TERRACES", "AFT_CITADEL"],
  HYBRID: ["AXIAL_OUTRIGGERS", "ARMORED_AXIS", "REACTOR_FRAME"],
};
const size = (
  v: StructuralVolume,
  x: number,
  y: number,
  z: number,
  l: number,
) => (v.dimensions = { x: x * l, y: y * l, z: z * l });
/** Large masses are composed before shapes and connections; no detail can change this silhouette. */
export function composeLayout(
  order: ShipOrder,
  yard: Shipyard,
  grammar: ArchitectureGrammar,
  volumes: StructuralVolume[],
  rng: SeededRng,
) {
  const l = order.length,
    pattern = rng.pick(COMPOSITIONS[grammar]),
    variation = rng.range(0.85, 1.15);
  const by = (id: string) => volumes.find((v) => v.id === id)!;
  if (grammar === "BLOCK_ASSEMBLY") {
    const fore = by("fore-armor"),
      core = by("combat-core"),
      drive = by("drive-block"),
      beam = core.dimensions.x / l,
      armor = core.dimensions.y / l;
    const widths: Record<string, number[]> = {
      FORWARD_HEAVY: [1.35, 0.8, 0.65],
      CENTRAL_CORE: [0.55, 1.3, 0.6],
      SIDE_BATTERIES: [0.6, 0.75, 0.7],
      STEPPED: [0.72, 1.12, 0.88],
      REAR_HEAVY: [0.6, 0.8, 1.35],
      SPLIT_CORE: [1, 0.78, 1.06],
    };
    const lengths: Record<string, number[]> = {
      FORWARD_HEAVY: [0.44, 0.29, 0.25],
      CENTRAL_CORE: [0.23, 0.5, 0.25],
      SIDE_BATTERIES: [0.24, 0.43, 0.31],
      STEPPED: [0.29, 0.39, 0.3],
      REAR_HEAVY: [0.22, 0.3, 0.46],
      SPLIT_CORE: [0.36, 0.26, 0.36],
    };
    const ws = widths[pattern],
      ds = lengths[pattern];
    let cursor = -0.5;
    [fore, core, drive].forEach((v, i) => {
      size(v, beam * ws[i], armor * (i === 1 ? 1.08 : 0.8), ds[i], l);
      v.position.z = (cursor + ds[i] / 2) * l;
      cursor += ds[i] + 0.01;
      v.position.y = pattern === "STEPPED" ? (i - 1) * armor * 0.16 * l : 0;
    });
    for (const side of [-1, 1]) {
      const pod = by(`magazine-${side}`),
        battery = pattern === "SIDE_BATTERIES";
      size(
        pod,
        beam * (battery ? 0.68 : 0.27),
        armor * (battery ? 0.9 : 0.68),
        (battery ? 0.43 : 0.21) * variation,
        l,
      );
      pod.position.x =
        side * (core.dimensions.x / 2 + pod.dimensions.x / 2 + l * 0.006);
      pod.position.z =
        core.position.z +
        (pattern === "SPLIT_CORE"
          ? 0.07
          : pattern === "FORWARD_HEAVY"
            ? -0.1
            : 0) *
          l;
      pod.position.y = core.position.y;
    }
  } else if (grammar === "STACKED_BLOCKS") {
    const keel = by("armored-keel"),
      middle = by("magazine-deck"),
      upper = by("command-deck");
    const kw = keel.dimensions.x,
      kh = keel.dimensions.y;
    keel.position.y = 0;
    const low = pattern === "LOW_TERRACES",
      aft = pattern === "AFT_CITADEL";
    middle.dimensions = {
      x: kw * (low ? 0.86 : 0.87) * rng.range(0.94, 1.06),
      y: kh * (low ? 0.62 : aft ? 1.2 : 1.04),
      z: l * (low ? 0.78 : aft ? 0.46 : 0.52) * variation,
    };
    upper.dimensions = {
      x: middle.dimensions.x * 0.59,
      y: middle.dimensions.y * (low ? 0.48 : 0.6),
      z: middle.dimensions.z * (low ? 0.62 : 0.44),
    };
    const overlap = rng.range(0.3, 0.43);
    middle.position.y = kh / 2 + middle.dimensions.y * (0.5 - overlap);
    upper.position.y =
      middle.position.y +
      middle.dimensions.y / 2 +
      upper.dimensions.y * (0.5 - overlap);
    middle.position.z = (low ? 0.025 : aft ? 0.17 : -0.15) * l;
    upper.position.z =
      middle.position.z + (low ? 0.035 : aft ? 0.035 : -0.05) * l;
  } else if (grammar === "TWIN_HULL") {
    const bridge = by("central-bridge");
    const bridgeZ =
      pattern === "FORWARD_BRIDGE"
        ? -0.22
        : pattern === "ENGINE_BRIDGE"
          ? 0.24
          : 0;
    bridge.position.z = bridgeZ * l;
    bridge.dimensions.z =
      (pattern === "CENTRAL_CORE"
        ? 0.45
        : pattern === "ENGINE_BRIDGE"
          ? 0.29
          : 0.24) * l;
    bridge.dimensions.x *= rng.range(1.1, 1.6);
    bridge.dimensions.y *= rng.range(1.15, 1.5);
    if (pattern === "CENTRAL_SPINAL" || order.role === "Spinal Gun Ship") {
      bridge.type = "SPINE";
      bridge.purpose = "axial-weapon";
      bridge.dimensions.z = 0.98 * l;
      bridge.dimensions.x = Math.max(0.07 * l, bridge.dimensions.x);
      bridge.dimensions.y = Math.max(0.065 * l, bridge.dimensions.y);
      bridge.position.z = 0;
    }
    for (const side of [-1, 1]) {
      const hull = by(`independent-hull-${side}`);
      hull.dimensions.z = rng.range(0.64, 0.85) * l;
      hull.dimensions.x *= rng.range(1.05, 1.5);
      hull.position.x *= rng.range(0.95, 1.12);
      if (pattern === "CENTRAL_SPINAL") {
        hull.dimensions.z *= 0.79;
        hull.position.z = 0.14 * l;
      }
      if (pattern === "CENTRAL_CORE") {
        hull.dimensions.z *= 0.84;
        hull.dimensions.x *= 1.2;
      }
      hull.position.z =
        pattern === "STAGGERED_HULLS"
          ? side * 0.105 * l
          : pattern === "CENTRAL_SPINAL"
            ? 0.14 * l
            : (pattern === "FORWARD_BRIDGE" ? -0.06 : 0.04) * l;
      if (pattern === "STAGGERED_HULLS") {
        hull.dimensions.z *= side === -1 ? 1.05 : 0.82;
        hull.dimensions.x *= side === -1 ? 0.93 : 1.08;
      }
      if (pattern === "ENGINE_BRIDGE") hull.dimensions.z *= 0.84;
    }
  } else if (grammar === "SPINE_AND_MODULES" || grammar === "HYBRID") {
    const spine = by("axial-spine");
    spine.dimensions.x = Math.max(
      spine.dimensions.x,
      (order.role === "Spinal Gun Ship" ? 0.085 : 0.068) * l,
    );
    spine.dimensions.y = Math.max(spine.dimensions.y, 0.065 * l);
    for (const v of volumes.filter((v) => v.type !== "SPINE")) {
      v.dimensions.z *= rng.range(0.84, 1.16);
      v.position.z +=
        (pattern.includes("REACTOR") || pattern === "MID_SPINE_CITADEL"
          ? -0.08
          : 0.015) * l;
      if (v.id.includes("breech")) {
        v.dimensions.x *= pattern === "REACTOR_SADDLE" ? 1.55 : 1.2;
        v.dimensions.z *=
          pattern === "MID_SPINE_CITADEL"
            ? 1.4
            : pattern === "ARMORED_BREECH"
              ? 0.82
              : 1;
        v.position.z =
          pattern === "MID_SPINE_CITADEL"
            ? -0.05 * l
            : pattern === "ARMORED_BREECH"
              ? 0.16 * l
              : 0.015 * l;
        v.position.x =
          Math.sign(v.position.x) *
          (spine.dimensions.x / 2 +
            v.dimensions.x / 2 +
            (grammar === "HYBRID" ? 0.065 : 0.005) * l);
      }
    }
    const node: StructuralVolume = {
      id: "axis-reinforcement",
      type: "ARMOR_BLOCK",
      purpose: "armor",
      position: {
        x: 0,
        y: 0,
        z: Math.max(
          -0.4 * l,
          Math.min(
            ...volumes
              .filter((v) => v.id.includes("breech"))
              .map((v) => v.position.z - v.dimensions.z / 2),
          ) -
            0.065 * l,
        ),
      },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions: {
        x: spine.dimensions.x * 1.6,
        y: spine.dimensions.y * 1.55,
        z: l * 0.12,
      },
      geometry: { primitive: "Chamfered Box", stations: [] },
      connectionIds: [],
    };
    volumes.push(node);
  } else if (grammar === "TRUSS_POD") {
    const core = by("pressure-core");
    core.dimensions.x *= rng.range(1.2, 1.55);
    core.dimensions.z *= rng.range(1.1, 1.4);
    for (const side of [-1, 1]) {
      const pod = by(`weapon-pod-${side}`),
        drive = by(`engine-pod-${side}`);
      if (pattern === "AFT_MACHINERY") {
        drive.dimensions.x *= 1.55;
        drive.dimensions.y *= 1.35;
        drive.dimensions.z = 0.39 * l;
        drive.position.z = 0.29 * l;
        drive.position.x =
          side * (core.dimensions.x / 2 + drive.dimensions.x / 2 + 0.04 * l);
        pod.dimensions.z = 0.18 * l;
        pod.dimensions.x *= 0.8;
        pod.position.z = -0.28 * l;
        pod.position.x =
          side * (core.dimensions.x / 2 + pod.dimensions.x / 2 + 0.075 * l);
      } else if (pattern === "OUTRIGGER_BATTERIES") {
        pod.dimensions.z = 0.44 * l;
        pod.dimensions.x *= 1.2;
        pod.position.z = -0.17 * l;
        pod.position.x =
          side * (core.dimensions.x / 2 + pod.dimensions.x / 2 + 0.075 * l);
        drive.position.x =
          side * (core.dimensions.x / 2 + drive.dimensions.x / 2 + 0.025 * l);
        drive.position.z = 0.34 * l;
      } else {
        pod.dimensions.z = 0.25 * l;
        pod.position.z = side * 0.13 * l - 0.07 * l;
        pod.position.y = 0.065 * l;
        pod.position.x =
          side * (core.dimensions.x / 2 + pod.dimensions.x / 2 + 0.08 * l);
        drive.position.x =
          side * (core.dimensions.x / 2 + drive.dimensions.x / 2 + 0.07 * l);
        drive.position.z = 0.3 * l;
      }
    }
  } else if (grammar === "CORE_AND_NACELLES") {
    const core = by("command-core");
    core.dimensions.z *= pattern === "COMPACT_CORE" ? 0.75 : 1.05;
    core.dimensions.x *= rng.range(1, 1.3);
    for (const v of volumes.filter((v) => v.type === "NACELLE")) {
      v.dimensions.z *= rng.range(0.8, 1.2);
      v.position.x *= variation;
      v.position.y *= variation;
      if (pattern === "SWEPT_NACELLES" && v.position.y)
        v.position.z -= 0.13 * l;
    }
  }
  for (const v of volumes) {
    v.shape = chooseShape(v, yard, rng, grammar);
    if (v.type === "PRIMARY_HULL") {
      v.shape = shapeDefinition(
        grammar === "TWIN_HULL" && pattern !== "ENGINE_BRIDGE"
          ? "COMPOUND_LOFT"
          : yard.structure === "clean"
            ? "COMPOUND_LOFT"
            : "LONG_LOFT",
        v.dimensions,
        rng.range(0, 1),
      );
      v.shape.frontScale =
        pattern === "FORWARD_BRIDGE"
          ? 0.11
          : pattern === "CENTRAL_CORE"
            ? 0.4
            : 0.18;
      v.shape.waist = pattern === "CENTRAL_SPINAL" ? 0.52 : 0.72;
      v.shape.rearScale = yard.structure === "swift" ? 0.55 : 0.78;
    }
    if (grammar === "STACKED_BLOCKS") {
      const kind =
        v.id === "armored-keel"
          ? "COMPOUND_LOFT"
          : v.id === "magazine-deck"
            ? yard.structure === "truss"
              ? "CLIPPED_BOX"
              : "FLATTENED_HEX"
            : "CHAMFERED_BOX";
      v.shape = shapeDefinition(kind, v.dimensions, rng.range(0, 1));
      v.shape.frontScale = 0.35;
      v.shape.waist = 0.9;
    }
    if (grammar === "MONOLITHIC") {
      v.shape = shapeDefinition("COMPOUND_LOFT", v.dimensions, rng.range(0, 1));
      v.shape.frontScale =
        pattern === "FORWARD_SHOULDERS"
          ? 0.65
          : order.role === "Battleship"
            ? 0.55
            : 0.12;
      v.shape.shoulder = rng.range(0.22, 0.42);
      v.shape.waist = pattern === "LENS_BODY" ? 0.94 : 0.78;
    }
    syncShape(v);
  }
  const ranked = [...volumes].sort(
    (a, b) =>
      b.dimensions.x * b.dimensions.y * b.dimensions.z -
      a.dimensions.x * a.dimensions.y * a.dimensions.z,
  );
  const max =
    ranked[0].dimensions.x * ranked[0].dimensions.y * ranked[0].dimensions.z;
  for (const v of volumes)
    v.hierarchyTier =
      v === ranked[0]
        ? 1
        : (v.dimensions.x * v.dimensions.y * v.dimensions.z) / max > 0.16
          ? 2
          : 3;
  return pattern;
}
