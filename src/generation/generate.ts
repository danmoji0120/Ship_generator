import {
  ROLES,
  PRIORITIES,
  type ShipBlueprint,
  type ShipOrder,
} from "../blueprint/types";
import { getShipyard } from "../shipyards/config";
import { SeededRng, normalizeSeed } from "../random/rng";
import { selectArchitecture } from "./architecture/selection";
import { architectureLayout } from "./architecture/layout";
import {
  architectureEngines,
  architectureEquipment,
} from "./architecture/equipment";
import { volumeBounds } from "./architecture/volumes";
import {
  silhouetteMetrics,
  validateSilhouette,
} from "../validation/silhouette";
import { validateBlueprint } from "../validation/validate";
import { integrateHull } from "./integration/build";
import { generatePrefabPlacements } from "./prefabs";
export { DEFAULT_ORDER, generateBlueprintV0 } from "./legacy";
export function generateBlueprint(
  input: ShipOrder,
  seed: number,
  qaOptions?: {
    version?: "1.6";
    architecture?: import("../blueprint/types").ArchitectureGrammar;
  },
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
  const selection = selectArchitecture(order, yard, new SeededRng(seed));
  if (qaOptions?.architecture) selection.grammar = qaOptions.architecture;
  let lastErrors: string[] = [];
  for (let candidate = 0; candidate < 5; candidate++) {
    const priorErrors = lastErrors;
    const rng = new SeededRng(
        (seed + Math.imul(candidate + 1, 0x9e3779b9)) >>> 0,
      ),
      grammar =
        selection.grammar === "HYBRID" && candidate >= 3
          ? "SPINE_AND_MODULES"
          : selection.grammar;
    const layout = architectureLayout(order, yard, grammar, rng),
      { volumes, connectors, nose, components, beam, armor } = layout;
    const silhouette = silhouetteMetrics(volumes, connectors);
    lastErrors = validateSilhouette(order, silhouette);
    if (lastErrors.length) continue;
    const { engines, engineArchitecture } = architectureEngines(
        order,
        yard,
        grammar,
        volumes,
        rng,
      ),
      { hardpoints, surfaceFeatures } = architectureEquipment(order, volumes);
    const prefabPlacements = generatePrefabPlacements(
      order,
      yard,
      volumes,
      connectors,
      seed + candidate,
    );
    const bounds = volumeBounds(volumes),
      l = order.length,
      p = order.priorities;
    const mass = volumes.reduce(
      (sum, v) =>
        sum +
        v.geometry.stations
          .slice(1)
          .reduce(
            (acc, s, i) =>
              acc +
              (s.z - v.geometry.stations[i].z) *
                (s.width * s.height +
                  v.geometry.stations[i].width *
                    v.geometry.stations[i].height) *
                0.35,
            0,
          ),
      0,
    );
    const primary = volumes.find((v) => v.id === "citadel");
    const b: ShipBlueprint = {
      schemaVersion: 2,
      generatorVersion: qaOptions?.version === "1.6" ? "1.6" : "1.7",
      seed,
      candidate,
      shipyardId: yard.id,
      role: order.role,
      order,
      designName: `${rng.pick(["Resolute", "Peregrine", "Citadel", "Vanguard", "Meridian", "Halcyon", "Ardent", "Nomad"])} ${String(seed % 10000).padStart(4, "0")}`,
      architecture: {
        composition: layout.composition,
        source: qaOptions?.architecture ? "qa-fixed" : "order",
        grammar,
        requestedGrammar: selection.grammar,
        components,
        rootVolumeId: volumes[0].id,
        nose,
        engineArchitecture,
        selectionWeights: selection.weights,
        parameters: {
          volumeBudget: volumes.length,
          beamRatio: beam,
          armorRatio: armor,
        },
        ...(grammar !== selection.grammar
          ? {
              fallbackReason:
                priorErrors.join("; ") || "Hybrid candidate validation failed",
            }
          : {}),
      },
      structuralVolumes: volumes,
      structuralConnectors: connectors,
      prefabPlacements,
      silhouette,
      dimensions: {
        length:
          Math.max(
            bounds.max.z,
            ...engines.map((e) => e.position.z + e.nozzleLength),
          ) - bounds.min.z,
        width: bounds.max.x - bounds.min.x,
        height: bounds.max.y - bounds.min.y,
        estimatedMass: Math.round(mass * (0.16 + p.survivability * 0.0022)),
      },
      stations: primary?.geometry.stations ?? [],
      hullSections: volumes.flatMap((v) =>
        v.geometry.stations.slice(1).map((end, i) => ({
          id: `${v.id}/section-${i}`,
          start: v.geometry.stations[i],
          end,
        })),
      ),
      secondaryStructures: [],
      engines,
      hardpoints,
      trusses: connectors
        .filter((c) => c.type === "TRUSS" || c.style.includes("truss"))
        .map((c) => ({
          id: c.id,
          start: c.start,
          end: c.end,
          radius: c.thickness / 2,
          parentIds: [c.fromStructureId, c.toStructureId],
        })),
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
        enginePattern: engineArchitecture,
      },
    };
    if (b.generatorVersion === "1.7") integrateHull(b);
    lastErrors = validateBlueprint(b);
    if (!lastErrors.length) return b;
  }
  throw new Error(
    `No valid V1 ${selection.grammar} design after 5 candidates: ${lastErrors.join("; ")}`,
  );
}

/** Versioned reference path for regression QA; shares the original V1.6 pipeline and RNG. */
export function generateBlueprintV16(
  input: ShipOrder,
  seed: number,
  options?: { architecture?: import("../blueprint/types").ArchitectureGrammar },
) {
  return generateBlueprint(input, seed, { ...options, version: "1.6" });
}
