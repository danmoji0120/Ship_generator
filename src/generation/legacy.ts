import {
  ROLES,
  PRIORITIES,
  type LegacyShipBlueprint as ShipBlueprint,
  type ShipOrder,
} from "../blueprint/types";
import { getShipyard } from "../shipyards/config";
import { SeededRng, normalizeSeed } from "../random/rng";
import { generateHull } from "./hull";
import { generateStructures } from "./structures";
import { generateEngines } from "./engines";
import { generateHardpoints } from "./hardpoints";
import { validateBlueprint } from "../validation/legacy";
export const DEFAULT_ORDER: ShipOrder = {
  role: "Cruiser",
  shipyardId: "aegis",
  length: 300,
  massClass: "Standard",
  priorities: {
    firepower: 80,
    survivability: 80,
    mobility: 30,
    endurance: 65,
    missile: 60,
    sensor: 45,
  },
};
export function generateBlueprintV0(
  input: ShipOrder,
  seed: number,
): ShipBlueprint {
  const order = structuredClone(input),
    yard = getShipyard(order.shipyardId);
  seed = normalizeSeed(seed);
  if (
    !ROLES.includes(order.role) ||
    !["Light", "Standard", "Heavy", "Superheavy"].includes(order.massClass) ||
    !Number.isFinite(order.length) ||
    order.length < 40 ||
    order.length > 600 ||
    PRIORITIES.some(
      (k) =>
        !Number.isFinite(order.priorities[k]) ||
        order.priorities[k] < 0 ||
        order.priorities[k] > 100,
    )
  )
    throw new Error("Invalid Ship Order");
  let lastErrors: string[] = [];
  for (let candidate = 0; candidate < 5; candidate++) {
    const rng = new SeededRng((seed + Math.imul(candidate, 0x9e3779b9)) >>> 0),
      stations = generateHull(order, yard, rng);
    const { secondaryStructures, trusses } = generateStructures(
      order,
      yard,
      stations,
      rng,
    );
    const { engines, enginePattern } = generateEngines(
      order,
      yard,
      stations,
      secondaryStructures,
      rng,
    );
    const { hardpoints, surfaceFeatures } = generateHardpoints(
      order,
      yard,
      stations,
      secondaryStructures,
      rng,
    );
    const l = order.length;
    const width = Math.max(
      ...stations.map((s) => s.width),
      ...secondaryStructures.map((m) => 2 * Math.abs(m.position.x) + m.size.x),
    );
    const yTop = Math.max(
      ...stations.map((s) => s.height / 2),
      ...secondaryStructures.map((m) => m.position.y + m.size.y / 2),
    );
    const yBottom = Math.min(
      ...stations.map((s) => -s.height / 2),
      ...secondaryStructures.map((m) => m.position.y - m.size.y / 2),
    );
    const volume =
      stations
        .slice(1)
        .reduce(
          (v, s, i) =>
            v +
            (((s.z - stations[i].z) *
              (s.width * s.height + stations[i].width * stations[i].height)) /
              2) *
              0.7,
          0,
        ) +
      secondaryStructures.reduce(
        (v, m) => v + m.size.x * m.size.y * m.size.z * 0.65,
        0,
      );
    const p = order.priorities;
    const blueprint: ShipBlueprint = {
      schemaVersion: 1,
      seed,
      candidate,
      shipyardId: yard.id,
      role: order.role,
      order,
      designName: `${rng.pick(["Resolute", "Peregrine", "Citadel", "Vanguard", "Meridian", "Halcyon", "Ardent", "Nomad"])} ${String(seed % 10000).padStart(4, "0")}`,
      dimensions: {
        length:
          l +
          Math.max(
            ...engines.map((e) => e.position.z + e.nozzleLength - l / 2),
            0,
          ),
        width,
        height: yTop - yBottom,
        estimatedMass: Math.round(volume * (0.16 + p.survivability * 0.0022)),
      },
      stations,
      hullSections: stations
        .slice(1)
        .map((end, i) => ({ id: `section-${i}`, start: stations[i], end })),
      secondaryStructures,
      engines,
      hardpoints,
      trusses,
      surfaceFeatures,
      materialTheme: {
        hull: yard.colors[0],
        secondary: yard.colors[1],
        accent: yard.colors[2],
        engine: "#71dfff",
        roughness: yard.roughness,
        panelScale: l * 0.065,
      },
      generationStats: {
        firepowerScore: p.firepower,
        survivabilityScore: p.survivability,
        mobilityScore: p.mobility,
        enduranceScore: p.endurance,
        missileScore: p.missile,
        sensorScore: p.sensor,
        enginePattern,
      },
    };
    lastErrors = validateBlueprint(blueprint);
    if (lastErrors.length === 0) return blueprint;
  }
  throw new Error(
    `No valid design after 5 deterministic candidates: ${lastErrors.join("; ")}`,
  );
}
