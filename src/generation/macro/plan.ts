import type {
  ArchitectureGrammar,
  ShipOrder,
  StructuralVolume,
  ShapeKind,
} from "../../blueprint/types";
import type { Shipyard } from "../../shipyards/config";
import { SeededRng } from "../../random/rng";
import { COMPOSITIONS } from "../architecture/composition";
import { shapeDefinition, shapeStations } from "../shapes/definition";
import { measureMacro } from "./measurement";
import {
  type MacroFamily,
  type MacroModulePlan,
  type MacroDesignPlan,
} from "./types";
export const FAMILY_COMPATIBILITY: Record<
  ArchitectureGrammar,
  readonly MacroFamily[]
> = {
  MONOLITHIC: ["WEDGE_CITADEL", "WEAPON_DOMINANT"],
  BLOCK_ASSEMBLY: [
    "WEDGE_CITADEL",
    "HAMMERHEAD",
    "WIDE_CARRIER",
    "ENGINE_DOMINANT",
  ],
  SPINE_AND_MODULES: ["SPLIT_FRAME", "WEAPON_DOMINANT"],
  TRUSS_POD: ["SPLIT_FRAME"],
  TWIN_HULL: ["WIDE_CARRIER", "ENGINE_DOMINANT"],
  CORE_AND_NACELLES: ["ENGINE_DOMINANT"],
  STACKED_BLOCKS: ["WEDGE_CITADEL", "HAMMERHEAD"],
  HYBRID: ["SPLIT_FRAME", "WEAPON_DOMINANT", "WIDE_CARRIER"],
};
export function macroWeights(
  order: ShipOrder,
  yard: Shipyard,
  grammar: ArchitectureGrammar,
) {
  const p = order.priorities;
  return Object.fromEntries(
    FAMILY_COMPATIBILITY[grammar].map((f) => {
      let weight = yard.macroLanguage.weights[f];
      if (f === "ENGINE_DOMINANT") weight *= 0.65 + p.mobility / 65;
      if (f === "WIDE_CARRIER")
        weight *= order.length < 80 ? 0.7 : order.length >= 300 ? 1.2 : 1;
      if (
        f === "WEDGE_CITADEL" &&
        ["Heavy", "Superheavy"].includes(order.massClass)
      )
        weight *= 1.3;
      if (f === "WEDGE_CITADEL" || f === "HAMMERHEAD")
        weight *= 0.65 + p.survivability / 90;
      if (f === "WIDE_CARRIER")
        weight *= 0.65 + (p.missile + p.endurance) / 180;
      if (f === "WEAPON_DOMINANT")
        weight *= order.role === "Spinal Gun Ship" ? 8 : 0.5 + p.firepower / 85;
      if (order.role === "Battleship" && f === "WEDGE_CITADEL") weight *= 2;
      if (
        order.role === "Missile Ship" &&
        (f === "WIDE_CARRIER" || f === "HAMMERHEAD")
      )
        weight *= 1.6;
      return [f, weight];
    }),
  ) as Partial<Record<MacroFamily, number>>;
}
export function createMacroPlan(
  order: ShipOrder,
  yard: Shipyard,
  grammar: ArchitectureGrammar,
  seed: number,
  forced?: MacroFamily,
): MacroDesignPlan {
  const rng = new SeededRng((seed ^ 0x18ac73f1) >>> 0),
    weights = macroWeights(order, yard, grammar);
  if (forced && !FAMILY_COMPATIBILITY[grammar].includes(forced))
    throw new Error(`Unsupported Macro pairing ${grammar}/${forced}`);
  let cursor = rng.range(
    0,
    Object.values(weights).reduce((a, b) => a + b!, 0),
  );
  const family =
    forced ??
    FAMILY_COMPATIBILITY[grammar].find((f) => (cursor -= weights[f]!) <= 0) ??
    FAMILY_COMPATIBILITY[grammar][0];
  const composition = rng.pick(COMPOSITIONS[grammar]),
    variant = rng.int(0, 3),
    lang = yard.macroLanguage,
    p = order.priorities,
    l = order.length;
  const classScale = { Light: 0.9, Standard: 1, Heavy: 1.08, Superheavy: 1.15 }[
    order.massClass
  ];
  const roleScale =
    order.role === "Battleship"
      ? 1.14
      : order.role === "Corvette"
        ? 0.82
        : order.role === "Destroyer"
          ? 0.9
          : 1;
  const beam = Math.min(
    1.27,
    lang.beam *
      classScale *
      roleScale *
      (0.91 + p.survivability * 0.0018 - p.mobility * 0.0006) *
      rng.range(0.84, 1.16),
  );
  const depth =
    lang.depth *
    Math.sqrt(classScale) *
    (0.82 + p.survivability * 0.0017 + p.endurance * 0.0011) *
    rng.range(0.9, 1.1);
  const machinery = (0.78 + p.mobility * 0.004) * lang.machinery,
    weapon = 0.82 + p.firepower * 0.003 + p.missile * 0.0015,
    supply = 0.85 + p.endurance * 0.003,
    sensor = 0.85 + p.sensor * 0.002;
  const modules: MacroModulePlan[] = [],
    voids: MacroDesignPlan["negativeSpaceTargets"] = [];
  const shapeKind = (
    role: StructuralVolume["purpose"],
    preferred: ShapeKind,
  ): ShapeKind => {
    if (preferred === "COMPOUND_LOFT" || preferred === "WEDGE")
      return preferred;
    if (role === "propulsion")
      return rng.pick(
        yard.structure === "truss"
          ? (["HEX_PRISM", "ARMORED_CYLINDER"] as const)
          : yard.structure === "swift"
            ? (["TAPERED_PRISM", "SHORT_LOFT"] as const)
            : (["HEX_PRISM", "SHORT_LOFT"] as const),
      );
    return yard.structure === "truss"
      ? "CLIPPED_BOX"
      : yard.structure === "clean"
        ? "FLATTENED_HEX"
        : "CHAMFERED_BOX";
  };
  const add = (
    id: string,
    purpose: StructuralVolume["purpose"],
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    role: MacroModulePlan["role"],
    kind: ShapeKind = "CHAMFERED_BOX",
    scales?: number[],
  ) => {
    const dimensions = { x: w * l, y: h * l, z: d * l },
      shape = shapeDefinition(shapeKind(purpose, kind), dimensions, rng.next());
    shape.frontScale = yard.structure === "swift" ? 0.28 : 0.66;
    shape.rearScale = purpose === "propulsion" ? 0.96 : 0.78;
    shape.topSlope = yard.structure === "clean" ? 0.025 : 0.045;
    if (scales)
      shape.stationScales = scales.map((width, i) => ({
        t: i / (scales.length - 1),
        width,
        height: i === 0 ? 0.82 : 1,
      }));
    const m: MacroModulePlan = {
      id,
      purpose,
      position: { x: x * l, y: y * l, z: z * l },
      dimensions,
      shape,
      role,
    };
    modules.push(m);
    return m;
  };
  const pair = (
    id: string,
    purpose: StructuralVolume["purpose"],
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    role: MacroModulePlan["role"],
    kind?: ShapeKind,
  ) =>
    [-1, 1].map((side) =>
      add(`${id}-${side}`, purpose, side * x, y, z, w, h, d, role, kind),
    );
  // These are major-volume recipes, not a deformation pass over finished geometry.
  if (grammar === "BLOCK_ASSEMBLY") {
    let widths: number[],
      lengths: number[],
      heights: number[],
      podW: number,
      podD: number,
      podZ: number;
    const thick = 0.125 * depth;
    if (family === "HAMMERHEAD") {
      widths = [0.76 * beam, 0.18 * beam, 0.3 * beam * machinery];
      lengths = [
        0.28 + variant * 0.025,
        0.38 - variant * 0.015,
        0.34 - variant * 0.01,
      ];
      heights = [thick * 1.2, thick * 0.72, thick];
      podW = 0.085 * beam;
      podD = 0.23 * supply;
      podZ = 0.04;
    } else if (family === "WIDE_CARRIER") {
      widths = [0.19 * beam, 0.23 * beam, 0.29 * beam * machinery];
      lengths = [0.23, 0.46, 0.31];
      heights = [thick * 0.85, thick, thick * 0.85];
      podW = Math.min(0.36, 0.29 * beam * weapon);
      podD = 0.43 + variant * 0.075;
      podZ = variant % 2 ? -0.1 : 0.035;
    } else if (family === "ENGINE_DOMINANT") {
      widths = [0.2 * beam, 0.27 * beam, 0.56 * beam * machinery];
      lengths = [0.18 + variant * 0.025, 0.25, 0.57 - variant * 0.025];
      heights = [thick * 0.72, thick, thick * 1.2];
      podW = 0.075 * beam * weapon;
      podD = 0.22;
      podZ = -0.13;
    } else {
      widths = [
        (0.25 + variant * 0.09) * beam,
        (0.54 + variant * 0.045) * beam,
        0.34 * beam * machinery,
      ];
      lengths = [0.27 + variant * 0.025, 0.48 - variant * 0.025, 0.25];
      heights = [thick * 0.82, thick, thick * 0.87];
      podW = 0.12 * beam;
      podD = 0.32 * supply;
      podZ = -0.055;
    }
    // Composition remains meaningful: terraces, stepped support, or long/short machinery bays.
    if (composition === "STEPPED") {
      heights[0] *= 0.86;
      heights[1] *= 1.12;
    }
    if (composition === "SPLIT_CORE") {
      lengths[0] += 0.055;
      lengths[1] -= 0.055;
    }
    if (composition === "FORWARD_HEAVY") widths[0] *= 1.06;
    if (composition === "CENTRAL_CORE") widths[1] *= 1.06;
    if (composition === "SIDE_BATTERIES") podW *= 1.08;
    if (composition === "REAR_HEAVY") widths[2] *= 1.06;
    if (family === "ENGINE_DOMINANT")
      podZ = Math.min(podZ, -0.5 + lengths[0] + lengths[1] - 0.014 - podD / 2);
    let z = -0.5;
    const ids = ["fore-armor", "combat-core", "drive-block"];
    for (let i = 0; i < 3; i++) {
      const d = lengths[i];
      add(
        ids[i],
        i === 2 ? "propulsion" : i === 1 ? "weapon" : "armor",
        0,
        composition === "STEPPED" && i === 1 ? 0.025 * depth : 0,
        z + d / 2,
        widths[i],
        heights[i],
        d,
        (family === "HAMMERHEAD" && i === 0) ||
          (family === "ENGINE_DOMINANT" && i === 2) ||
          (family === "WEDGE_CITADEL" && i === 1)
          ? "dominant"
          : "supporting",
        family === "WEDGE_CITADEL"
          ? "WEDGE"
          : i === 0 && family !== "HAMMERHEAD"
            ? "WEDGE"
            : "CHAMFERED_BOX",
        family === "WEDGE_CITADEL"
          ? i === 0
            ? [0.16, 0.45, 0.72, 0.92, 1]
            : i === 1
              ? [0.68, 0.86, 1, 0.86, 0.64]
              : [1, 0.93, 0.86, 0.76, 0.72]
          : undefined,
      );
      z += d;
    }
    const core = modules[1],
      x = (core.dimensions.x / l + podW) / 2 + 0.004;
    pair(
      "magazine",
      "weapon",
      x,
      core.position.y / l,
      podZ,
      podW,
      thick * (family === "WIDE_CARRIER" ? 0.68 : 0.65),
      podD,
      family === "WIDE_CARRIER" ? "dominant" : "functional",
      family === "WIDE_CARRIER" ? "WEDGE" : "CHAMFERED_BOX",
    );
    if (family === "WIDE_CARRIER")
      voids.push({
        id: "fore-bay-channel",
        center: { x: (widths[0] / 2 + 0.025) * l, y: 0, z: -0.41 * l },
        size: { x: 0.025 * l, y: 0.04 * l, z: 0.06 * l },
        purpose:
          "Open approach beside central bow; bays are metadata, no carrier simulation",
      });
  } else if (grammar === "MONOLITHIC") {
    if (family === "WEDGE_CITADEL") {
      const maximum = 0.7 * beam,
        height = 0.14 * depth;
      const curve =
        variant === 0
          ? [0.12, 0.35, 0.62, 0.88, 1, 0.98, 0.89, 0.73, 0.59, 0.47, 0.42]
          : variant === 1
            ? [0.42, 0.75, 1, 0.99, 0.84, 0.75, 0.64, 0.54, 0.45, 0.36, 0.32]
            : variant === 2
              ? [0.13, 0.24, 0.44, 0.64, 0.82, 1, 0.97, 0.87, 0.71, 0.58, 0.48]
              : [0.38, 0.59, 0.85, 0.96, 1, 0.88, 0.72, 0.61, 0.53, 0.44, 0.4];
      add(
        "citadel",
        "habitat",
        0,
        0,
        0,
        maximum,
        height,
        1,
        "dominant",
        "COMPOUND_LOFT",
        curve,
      );
    } else {
      const curves = [
        [0.22, 0.24, 0.28, 0.35, 0.55, 0.82, 1, 0.9, 0.86, 0.72, 0.6],
        [0.28, 0.32, 0.39, 0.48, 0.75, 1, 0.92, 0.89, 0.85, 0.83, 0.8],
        [0.16, 0.18, 0.22, 0.28, 0.38, 0.51, 0.76, 0.98, 1, 0.87, 0.74],
        [0.35, 0.38, 0.4, 0.41, 0.51, 0.7, 0.95, 1, 0.88, 0.7, 0.65],
      ];
      add(
        "citadel",
        "axial-weapon",
        0,
        0,
        0,
        (0.34 + variant * 0.027) * beam * weapon,
        0.16 * depth * (0.9 + variant * 0.075),
        1,
        "dominant",
        "COMPOUND_LOFT",
        curves[variant],
      );
    }
  } else if (grammar === "SPINE_AND_MODULES" || grammar === "HYBRID") {
    const gun = family === "WEAPON_DOMINANT",
      carrier = family === "WIDE_CARRIER",
      spineW = (gun ? 0.115 : 0.075) * Math.sqrt(beam) * weapon;
    add(
      "axial-spine",
      "axial-weapon",
      0,
      0,
      0,
      spineW,
      0.083 * depth,
      1,
      "connection",
      "LONG_LOFT",
      gun
        ? [0.75, 0.78, 0.8, 0.83, 0.92, 1, 0.97, 0.92, 0.86]
        : [0.76, 0.87, 0.93, 1, 0.83, 0.89, 0.96, 1, 0.88],
    );
    const w = carrier ? 0.25 * beam : gun ? 0.21 * beam : 0.16 * beam * supply;
    const x =
      spineW / 2 + w / 2 + (grammar === "HYBRID" ? 0.075 : 0.022) * lang.gap;
    const z = gun
      ? 0.13
      : variant === 0
        ? -0.16
        : variant === 1
          ? 0.08
          : -0.025;
    const d = carrier ? 0.53 : gun ? 0.37 : 0.25 + variant * 0.045;
    pair(
      "breech",
      "weapon",
      x,
      0,
      z,
      w,
      0.15 * depth,
      d,
      "dominant",
      gun ? "HEX_PRISM" : "CHAMFERED_BOX",
    );
    // Drives align with their own breech support. They never cross the longitudinal gun axis.
    pair(
      "drive",
      "propulsion",
      x,
      0,
      0.37,
      0.18 * beam * machinery,
      0.115 * depth,
      0.26,
      "supporting",
      "SHORT_LOFT",
    );
    add(
      "axis-reinforcement",
      "armor",
      0,
      0,
      gun ? -0.25 : -0.33,
      spineW * 1.38,
      0.105 * depth,
      0.11,
      "functional",
    );
    voids.push({
      id: "axis-service-channel",
      center: { x: (spineW / 2 + 0.008) * l, y: 0, z: -0.12 * l },
      size: { x: 0.01 * l, y: 0.035 * l, z: 0.04 * l },
      purpose: "Open space beside structural / gun axis; no enclosing fairing",
    });
  } else if (grammar === "TRUSS_POD") {
    const coreW = 0.27 * beam,
      coreD = 0.36 + variant * 0.035;
    add(
      "pressure-core",
      "habitat",
      0,
      0,
      -0.1,
      coreW,
      0.15 * depth,
      coreD,
      "dominant",
      "SHORT_LOFT",
    );
    add(
      "sensor-forebody",
      "sensor",
      0,
      0,
      -0.405,
      0.12 * beam * sensor,
      0.09 * depth,
      0.19,
      "functional",
      "HEX_PRISM",
    );
    const podW = 0.17 * beam * weapon,
      driveW = 0.19 * beam * machinery,
      gap = (0.045 + variant * 0.025) * lang.gap;
    pair(
      "weapon-pod",
      "weapon",
      coreW / 2 + podW / 2 + gap,
      variant === 2 ? 0.055 * depth : 0,
      Math.min(-0.12 + variant * 0.055, 0.16 - (0.22 + variant * 0.065) / 2),
      podW,
      0.12 * depth,
      0.22 + variant * 0.065,
      "supporting",
      "CHAMFERED_BOX",
    );
    pair(
      "engine-pod",
      "propulsion",
      coreW / 2 + driveW / 2 + gap * 0.85,
      0,
      0.34,
      driveW,
      0.13 * depth,
      0.32,
      "supporting",
      "SHORT_LOFT",
    );
    voids.push({
      id: "outrigger-gap",
      center: { x: (coreW / 2 + gap * 0.45) * l, y: 0, z: -0.2 * l },
      size: { x: gap * 0.2 * l, y: 0.04 * l, z: 0.05 * l },
      purpose: "Truss-supported functional pod separation",
    });
    if (lang.offsetEquipment && variant === 3) {
      const sensorPod = modules.find((m) => m.id === "sensor-forebody")!;
      sensorPod.position.x = 0.025 * l;
    }
  } else if (grammar === "TWIN_HULL") {
    const carrier = family === "WIDE_CARRIER",
      hullW = (carrier ? 0.245 : 0.205) * beam,
      hullD = carrier ? 0.61 + variant * 0.065 : 0.54 + variant * 0.07;
    const x =
      (carrier ? 0.275 : 0.23) * beam + (carrier ? 0.075 : 0.035) * lang.gap;
    // Central structures occupy a short transverse station, leaving clear fore / aft channels.
    const bridgeD =
      composition === "CENTRAL_SPINAL"
        ? 0.96
        : composition === "CENTRAL_CORE"
          ? 0.3
          : 0.16;
    const bridgeZ =
      bridgeD > 0.9
        ? 0
        : composition === "FORWARD_BRIDGE"
          ? -0.21
          : composition === "ENGINE_BRIDGE"
            ? 0.25
            : -0.035;
    add(
      "central-bridge",
      composition === "CENTRAL_SPINAL" ? "axial-weapon" : "command",
      0,
      0,
      bridgeZ,
      0.18 * beam,
      0.105 * depth,
      bridgeD,
      "functional",
      composition === "CENTRAL_SPINAL" ? "LONG_LOFT" : "HEX_PRISM",
    );
    const z =
      family === "ENGINE_DOMINANT"
        ? 0.5 - hullD / 2
        : composition === "FORWARD_BRIDGE"
          ? -0.5 + hullD / 2
          : 0;
    pair(
      "independent-hull",
      "propulsion",
      x,
      0,
      z,
      hullW * (family === "ENGINE_DOMINANT" ? machinery : 1),
      0.145 * depth,
      hullD,
      "dominant",
      "COMPOUND_LOFT",
    );
    // A central bow remains inside the existing grammar and makes target length meaningful.
    // Existing longitudinal normalization is anticipated in the plan below.
    if (bridgeD < 0.9) {
      const bridge = modules[0];
      bridge.dimensions.z = Math.max(bridgeD, 0.22) * l;
      bridge.shape.length = bridge.dimensions.z;
    }
    const gap =
      x - (hullW * (family === "ENGINE_DOMINANT" ? machinery : 1)) / 2;
    voids.push({
      id: "twin-channel",
      center: {
        x: bridgeD > 0.9 ? (0.09 * beam + 0.018) * l : 0,
        y: 0,
        z: (bridgeZ < 0 ? 0.27 : -0.27) * l,
      },
      size: { x: Math.max(0.02, gap) * l, y: 0.04 * l, z: 0.055 * l },
      purpose: "Independent hulls joined only at selected cross-structure",
    });
    for (const m of modules.filter((m) => m.id.startsWith("independent-hull")))
      m.shape.stationScales = (
        family === "ENGINE_DOMINANT"
          ? [0.23, 0.38, 0.52, 0.73, 0.9, 1, 1, 0.98, 0.95]
          : [0.24, 0.64, 0.92, 1, 0.78, 0.75, 0.9, 0.8, 0.65]
      ).map((width, i) => ({
        t: i / 8,
        width,
        height: 0.85 + 0.15 * Math.sin((i / 8) * Math.PI),
      }));
  } else if (grammar === "CORE_AND_NACELLES") {
    const coreD = 0.4 + variant * 0.045,
      coreW = 0.26 * beam;
    add(
      "command-core",
      "command",
      0,
      0,
      -0.5 + coreD / 2,
      coreW,
      0.13 * depth,
      coreD,
      "supporting",
      "SHORT_LOFT",
    );
    const driveD = 0.32 + variant * 0.035,
      driveW = 0.16 * beam * machinery,
      x = coreW / 2 + driveW / 2 + (0.055 + variant * 0.012) * lang.gap;
    pair(
      "lateral-drive",
      "propulsion",
      x,
      0,
      0.5 - driveD / 2,
      driveW,
      0.145 * depth,
      driveD,
      "dominant",
      "SHORT_LOFT",
    );
    const y = 0.13 * depth + 0.035 * lang.gap;
    for (const side of [-1, 1])
      add(
        `vertical-drive-${side}`,
        "propulsion",
        0,
        side * y,
        0.5 - driveD / 2 - (composition === "SWEPT_NACELLES" ? 0.1 : 0),
        driveW * 0.83,
        0.12 * depth,
        driveD,
        "supporting",
        "SHORT_LOFT",
      );
    voids.push({
      id: "drive-service-gap",
      center: { x: 0, y: 0, z: 0.3 * l },
      size: { x: 0.025 * l, y: 0.025 * l, z: 0.06 * l },
      purpose:
        "Distributed nacelles leave central propulsion service space open",
    });
  } else if (grammar === "STACKED_BLOCKS") {
    const hammer = family === "HAMMERHEAD",
      keelW = (hammer ? 0.61 : 0.64) * beam,
      keelH = 0.13 * depth;
    add(
      "armored-keel",
      "propulsion",
      0,
      -0.035 * depth,
      0,
      keelW,
      keelH,
      1,
      "dominant",
      "COMPOUND_LOFT",
      hammer
        ? [0.65, 1, 1, 0.85, 0.6, 0.47, 0.44, 0.4, 0.39, 0.38, 0.38]
        : [0.17, 0.35, 0.59, 0.8, 0.96, 1, 0.92, 0.85, 0.69, 0.52, 0.4],
    );
    const midW = keelW * 0.62,
      midD = 0.49 + variant * 0.07,
      midY = 0.075 * depth;
    add(
      "magazine-deck",
      "weapon",
      0,
      midY,
      hammer ? -0.5 + midD / 2 : composition === "AFT_CITADEL" ? 0.12 : -0.08,
      midW,
      0.13 * depth,
      midD,
      "supporting",
      "FLATTENED_HEX",
    );
    add(
      "command-deck",
      "command",
      0,
      0.17 * depth,
      hammer ? -0.18 : composition === "AFT_CITADEL" ? 0.15 : -0.12,
      midW * 0.54,
      0.09 * depth,
      0.25 + variant * 0.025,
      "functional",
    );
  }
  // Composition refines the family recipe while preserving its dominant region and graph.
  if (grammar === "MONOLITHIC") {
    if (composition === "BROAD_CITADEL") modules[0].dimensions.x *= 1.04;
    if (composition === "LENS_BODY") modules[0].dimensions.y *= 0.84;
    if (composition === "FORWARD_SHOULDERS")
      modules[0].shape.stationScales?.forEach((p) => {
        if (p.t < 0.4) p.width = Math.min(1, p.width * 1.12);
      });
  }
  if (grammar === "SPINE_AND_MODULES" || grammar === "HYBRID") {
    for (const m of modules.filter((m) => m.id.startsWith("breech"))) {
      if (composition === "ARMORED_BREECH" || composition === "ARMORED_AXIS")
        m.dimensions.y *= 1.12;
      if (composition === "MID_SPINE_CITADEL") {
        m.position.z -= 0.035 * l;
        m.dimensions.z *= 0.94;
      }
      if (composition === "REACTOR_SADDLE" || composition === "REACTOR_FRAME") {
        m.position.y = 0.025 * depth * l;
        m.dimensions.y *= 1.08;
      }
      if (composition === "AXIAL_OUTRIGGERS") m.position.x *= 1.07;
    }
  }
  if (grammar === "TRUSS_POD") {
    for (const m of modules) {
      if (composition === "AFT_MACHINERY" && m.purpose === "propulsion")
        m.dimensions.y *= 1.1;
      if (
        composition === "OUTRIGGER_BATTERIES" &&
        m.id.startsWith("weapon-pod")
      )
        m.dimensions.x *= 1.08;
      if (composition === "STAGGERED_PODS" && m.id.startsWith("weapon-pod"))
        m.position.y += 0.022 * depth * l;
    }
  }
  if (grammar === "CORE_AND_NACELLES" && composition === "COMPACT_CORE") {
    modules[0].dimensions.x *= 0.9;
    modules[0].dimensions.y *= 0.9;
  }
  if (grammar === "CORE_AND_NACELLES" && composition === "RADIAL_DRIVES")
    for (const m of modules.filter((m) => m.purpose === "propulsion")) {
      m.position.x *= 1.05;
      m.position.y *= 1.05;
    }
  if (grammar === "STACKED_BLOCKS" && composition === "LOW_TERRACES")
    for (const m of modules) {
      m.position.y *= 0.86;
      m.dimensions.y *= 0.86;
    }
  for (const m of modules) {
    m.shape.width = m.dimensions.x;
    m.shape.height = m.dimensions.y;
    m.shape.length = m.dimensions.z;
  }
  const front = Math.min(
      ...modules.map((m) => m.position.z - m.dimensions.z / 2),
    ),
    aft = Math.max(...modules.map((m) => m.position.z + m.dimensions.z / 2));
  const stretch = l / (aft - front),
    center = (aft + front) / 2;
  for (const m of modules) {
    m.position.z = (m.position.z - center) * stretch;
    m.dimensions.z *= stretch;
    m.shape.length = m.dimensions.z;
  }
  for (const v of voids) {
    v.center.z = (v.center.z - center) * stretch;
    v.size.z *= stretch;
  }
  const volumes = modules.map((m) => ({
    id: m.id,
    position: m.position,
    dimensions: m.dimensions,
    geometry: { stations: shapeStations(m.shape) },
  })) as StructuralVolume[];
  const measurement = measureMacro(order, volumes);
  return {
    family,
    architecture: grammar,
    composition,
    dominantMassRegion:
      family === "HAMMERHEAD"
        ? "fore"
        : family === "ENGINE_DOMINANT"
          ? "aft"
          : family === "WIDE_CARRIER"
            ? "lateral"
            : family === "SPLIT_FRAME"
              ? "distributed"
              : family === "WEAPON_DOMINANT"
                ? "axis"
                : "mid",
    structuralAxis: "+Z aft; -Z bow; X lateral; Y dorsal",
    negativeSpaceTargets: voids,
    majorModuleRoles: modules,
    symmetryPolicy:
      lang.offsetEquipment && grammar === "TRUSS_POD" && variant === 3
        ? "FUNCTIONAL_OFFSET"
        : "BILATERAL",
    silhouetteParameters: {
      beam,
      depth,
      neckRatio: 0.18,
      machineryBudget: machinery,
      weaponBudget: weapon,
      supplyBudget: supply,
      sensorBudget: sensor,
    },
    selectedVariant: `${composition}/${variant}`,
    generationSeed: seed,
    source: forced ? "qa-fixed" : "order",
    ...measurement,
  };
}
