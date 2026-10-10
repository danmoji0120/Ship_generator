import type { ShipOrder, StructuralVolume } from "../../blueprint/types";
import type { Shipyard } from "../../shipyards/config";
import type { MacroModulePlan } from "./types";
import { shapeStations } from "../shapes/definition";
import { hullSurfaceAt, stationAt } from "../hull";
import { measureMacro } from "./measurement";
import { measureStackedUnion } from "./stacked-measurement";

/** Refine the three existing Macro roles before joins, armor, engines and equipment.
 * Dimensions remain substantial terraces; no new structural role or render-only geometry.
 */
export function refineStackedModules(
  order: ShipOrder,
  yard: Shipyard,
  modules: MacroModulePlan[],
  composition: string,
  variant: number,
  hammer: boolean,
) {
  const [keel, middle, upper] = [
    "armored-keel",
    "magazine-deck",
    "command-deck",
  ].map((id) => modules.find((m) => m.id === id)!);
  const l = order.length,
    low = composition === "LOW_TERRACES",
    heavy = yard.structure === "heavy",
    swift = yard.structure === "swift";
  const widthRatio =
    (heavy ? 0.7 : swift ? 0.61 : yard.structure === "clean" ? 0.66 : 0.67) +
    variant * 0.012;
  middle.dimensions = {
    x: keel.dimensions.x * widthRatio,
    y: keel.dimensions.y * (low ? 0.7 : heavy ? 0.78 : 0.74),
    z: l * (low ? 0.6 : 0.48 + variant * 0.035),
  };
  upper.dimensions = {
    x: middle.dimensions.x * (0.54 + variant * 0.025),
    y: middle.dimensions.y * (heavy ? 0.65 : 0.57),
    z: middle.dimensions.z * (0.44 + variant * 0.025),
  };
  const bevel = heavy
    ? 0.56
    : swift
      ? 0.58
      : yard.structure === "clean"
        ? 0.54
        : 0.46;
  for (const [i, m] of [keel, middle, upper].entries()) {
    // A strictly convex clipped section avoids collinear hex subdivisions in armor cap fans.
    const profile = "chamfer" as const;
    m.shape.frontProfile = m.shape.rearProfile = profile;
    m.shape.chamfer = bevel + (i === 2 ? 0.025 : 0);
    m.shape.topSlope = swift ? 0.09 : heavy ? 0.055 : 0.035;
    m.shape.bottomSlope = 0.025;
    m.shape.sideSlope = 0.035;
    const widths =
      i === 0
        ? hammer
          ? [0.64, 1, 1, 1, 0.65, 0.48, 0.55, 0.62, 0.72, 0.8, 0.76]
          : [0.32, 0.56, 0.78, 0.93, 1, 1, 0.98, 0.95, 0.9, 0.81, 0.7]
        : i === 1
          ? [swift ? 0.48 : 0.64, 0.91, 1, 0.97, 0.77]
          : [0.53, 0.9, 1, 0.93, 0.69];
    m.shape.stationScales = widths.map((width, k) => ({
      t: k / (widths.length - 1),
      width,
      height:
        k === 0
          ? i === 0
            ? 0.6
            : 0.65
          : k === widths.length - 1
            ? 0.83
            : i === 0 && hammer && k >= 4 && k <= 6
              ? 0.82
              : 1,
    }));
    m.shape.width = m.dimensions.x;
    m.shape.height = m.dimensions.y;
    m.shape.length = m.dimensions.z;
  }
  const baseStations = shapeStations(keel.shape);
  const wanted =
    (composition === "AFT_CITADEL"
      ? hammer
        ? 0.065
        : 0.115
      : composition === "FORWARD_CITADEL"
        ? -0.015
        : 0.04) +
    (variant - 1.5) * 0.009 +
    (order.priorities.endurance - 50) * 0.00016;
  // Search local alternatives against the actual parent width and union centroid.
  // This keeps front/aft variants, and avoids a constant rearward translation.
  let best = Infinity,
    bestZ = wanted * l;
  for (const offset of [0, -0.035, 0.035, -0.065, 0.065]) {
    const z = Math.max(-0.08, Math.min(0.16, wanted + offset)) * l;
    middle.position.z = z;
    upper.position.z = z + (0.015 + variant * 0.006) * l;
    seat(middle, keel);
    seat(upper, middle);
    const volumes = asVolumes(modules),
      union = measureStackedUnion(volumes, l, 24, 16);
    const supportZs = [
      z - middle.dimensions.z * 0.32,
      z,
      z + middle.dimensions.z * 0.32,
    ];
    const supportPenalty = supportZs.reduce(
      (sum, p) =>
        sum +
        Math.max(
          0,
          middle.dimensions.x /
            stationAt(baseStations, p - keel.position.z).width -
            0.92,
        ),
      0,
    );
    const fore = measureMacro(order, volumes).foreMassRatio;
    const score =
      Math.abs(
        union.centroid -
          (hammer ? 0.49 : composition === "FORWARD_CITADEL" ? 0.515 : 0.55),
      ) *
        3 +
      supportPenalty * 2 +
      Math.abs(z / l - wanted) * 0.35 +
      (hammer ? Math.max(0, 0.345 - fore) * 100 : 0);
    if (score < best) {
      best = score;
      bestZ = z;
    }
  }
  middle.position.z = bestZ;
  upper.position.z = Math.min(
    0.38 * l - upper.dimensions.z / 2,
    bestZ + (0.015 + variant * 0.006) * l,
  );
  seat(middle, keel);
  seat(upper, middle);
  function seat(child: MacroModulePlan, parent: MacroModulePlan) {
    const top =
      hullSurfaceAt(
        shapeStations(parent.shape),
        child.position.z - parent.position.z,
        0,
      ).y + parent.position.y;
    // Real deck contact, with a material overlap rather than floating envelope boxes.
    child.position.y = top + child.dimensions.y * (0.5 - 0.17);
  }
}
function asVolumes(modules: MacroModulePlan[]) {
  return modules.map((m) => ({
    id: m.id,
    position: m.position,
    dimensions: m.dimensions,
    geometry: { stations: shapeStations(m.shape) },
  })) as StructuralVolume[];
}
