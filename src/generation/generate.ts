import { applyMaterialAppearance } from '../rendering/appearance';
import {addExteriorDetails} from './details/build';
import {planRequirements,requirementCandidates,bindRequirementSpaces,DesignRejection,type RequirementPlan} from './production/requirements';
import { buildProduction } from "./production/build";
import { buildLayeredArmor } from "./integration/armor";
import { createMacroPlan } from "./macro/plan";
import { measureMacro } from "./macro/measurement";
import type { MacroFamily, MacroDesignPlan } from "./macro/types";
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
    version?: "1.6" | "1.7" | "1.8" | "1.8.1" | "1.8.4" | "1.8.4.1" | "1.8.4.2" | "1.8.5" | "1.8.5.1";
    productionBase?: boolean;
    requirementPlan?: RequirementPlan;
    minimumMacroCandidate?: number;
    onTimings?: (timings:import("./production/types").ProductionTimings)=>void;
    family?: MacroFamily;
    architecture?: import("../blueprint/types").ArchitectureGrammar;
  },
): ShipBlueprint {
  if((!qaOptions?.version)||qaOptions?.version==='1.8.4.2'||qaOptions?.version==='1.8.5'||qaOptions?.version==='1.8.5.1'){
    // Normalize/validate before planning; historical generation remains separately callable.
    const order=structuredClone(input),normalizedSeed=normalizeSeed(seed);
    if(!ROLES.includes(order.role)||!['Light','Standard','Heavy','Superheavy'].includes(order.massClass)||!Number.isFinite(order.length)||order.length<40||order.length>600||PRIORITIES.some(k=>!Number.isFinite(order.priorities[k])||order.priorities[k]<0||order.priorities[k]>100))throw Error('Invalid Ship Order');
    const plan=planRequirements(order),candidates=requirementCandidates(order,normalizedSeed,plan,qaOptions);
    if(!candidates.length)throw new DesignRejection(plan.spinal?['REQUIRED_XL_STRUCTURE_UNSUPPORTED']:['REQUIRED_ARCHITECTURE_FAMILY_UNSUPPORTED'],plan.rejectedCandidates,'No compatible requirements-first Architecture/Family candidate');
    for(const [index,c] of candidates.entries())try{
      const hullStart=performance.now(),candidatePlan=structuredClone(plan),base=generateBlueprint(order,normalizedSeed,{...qaOptions,version:'1.8',productionBase:true,requirementPlan:candidatePlan,architecture:c.architecture,family:c.family,minimumMacroCandidate:c.minimumMacroCandidate});
      base.architecture.source=qaOptions?.architecture?'qa-fixed':'order';base.macroDesign!.source=qaOptions?.family?'qa-fixed':'order';
      if(!qaOptions?.architecture)base.architecture.requestedGrammar=selectArchitecture(order,getShipyard(order.shipyardId),new SeededRng(normalizedSeed)).grammar;
      if(index>0)base.architecture.fallbackReason='Requirements-first fallback after recorded candidate rejection';
      candidatePlan.chosen={architecture:base.architecture.grammar,family:base.macroDesign!.family,candidate:base.candidate};
      const released=buildProduction(base,index,plan.rejectedCandidates.filter(a=>a.candidate>=0).map(a=>({candidate:a.candidate,reasons:a.reasons})),performance.now()-hullStart,qaOptions?.onTimings);
      if(qaOptions?.version==='1.8.4.2')return released;
      const detailed=addExteriorDetails(released);
      return qaOptions?.version==='1.8.5'?detailed:applyMaterialAppearance(detailed);
    }catch(e){const reason=(e as Error).message;plan.rejectedCandidates.push({candidate:index,architecture:c.architecture,family:c.family,stage:'physical-candidate',codes:[...new Set(reason.match(/REQUIRED_[A-Z_]+/g)??['REQUIRED_PHYSICAL_DESIGN_INVALID'])],reasons:[reason]});}
    throw new DesignRejection(plan.rejectedCandidates.flatMap(a=>a.codes),plan.rejectedCandidates,'No requirements-compliant physical candidate: '+JSON.stringify(plan.rejectedCandidates));
  }
  if(qaOptions?.version==='1.8.4'||qaOptions?.version==='1.8.4.1'){
    const failures:{candidate:number;reasons:string[]}[]=[];
    for(let candidate=0;candidate<3;candidate++)try{
      const hullStart=performance.now(),base=generateBlueprint(input,seed,{...qaOptions,version:"1.8",productionBase:true,minimumMacroCandidate:candidate});
      return buildProduction(base,candidate,failures,performance.now()-hullStart,qaOptions?.onTimings);
    }catch(e){failures.push({candidate,reasons:[(e as Error).message]});}
    throw Error(`Integrated design rejected after 3 candidates: ${JSON.stringify(failures)}`);
  }
  if (!qaOptions?.version || qaOptions.version === "1.8.1") {
    const b = generateBlueprint(input, seed, { ...qaOptions, version: "1.8" });
    buildLayeredArmor(b);
    b.generatorVersion = "1.8.1";
    const errors = validateBlueprint(b);
    if (errors.length) throw new Error(`Invalid layered armor: ${errors.join("; ")}`);
    return b;
  }
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
  const initialPlan = (!qaOptions?.version || qaOptions.version === "1.8")
    ? createMacroPlan(order, yard, selection.grammar, seed, qaOptions?.family,qaOptions?.requirementPlan)
    : undefined;
  const selectedFamily = initialPlan?.family;
  let lastErrors: string[] = [];
  const attempts: NonNullable<MacroDesignPlan["attempts"]> = [];
  for (let candidate = 0; candidate < 5; candidate++) {
    if(candidate<(qaOptions?.minimumMacroCandidate??0))continue;
    const priorErrors = lastErrors;
    const rng = new SeededRng(
        (seed + Math.imul(candidate + 1, 0x9e3779b9)) >>> 0,
      ),
      grammar =
        qaOptions?.version !== "1.8" && selection.grammar === "HYBRID" && candidate >= 3
          ? "SPINE_AND_MODULES"
          : selection.grammar;
    const macro = (!qaOptions?.version || qaOptions.version === "1.8")
      ? candidate === 0
        ? initialPlan
        : createMacroPlan(
            order,
            yard,
            grammar,
            seed + candidate,
            selectedFamily,qaOptions?.requirementPlan,
          )
      : undefined;
    if (macro) macro.source = qaOptions?.family ? "qa-fixed" : "order";
    const layout = architectureLayout(order, yard, grammar, rng, macro),
      { volumes, connectors, nose, components, beam, armor } = layout;
    const realized = macro ? measureMacro(order, volumes) : undefined;
    const silhouette = silhouetteMetrics(volumes, connectors);
    if (realized && silhouette.massHierarchy) {
      Object.assign(silhouette.massHierarchy, {
        primaryRatio: realized.primaryMassRatio,
        foreRatio: realized.foreMassRatio,
        midRatio: realized.midMassRatio,
        aftRatio: realized.aftMassRatio,
        lateralSpread: realized.lateralSpread,
        verticalSpread: realized.verticalSpread,
      });
    }
    lastErrors = validateSilhouette(order, silhouette, macro?.family);
    if (lastErrors.length) {
      if (macro)
        attempts.push({
          candidate,
          family: macro.family,
          architecture: grammar,
          reasons: lastErrors,
          structures: volumes
            .filter((v) => lastErrors.some((e) => e.includes(v.id)))
            .map((v) => v.id),
          replacement: false,
        });
      continue;
    }
    const { engines, engineArchitecture } = architectureEngines(
        order,
        yard,
        grammar,
        volumes,
        rng,
        Boolean(macro),
      ),
      { hardpoints, surfaceFeatures } = architectureEquipment(order, volumes,qaOptions?.productionBase,qaOptions?.requirementPlan);
    const prefabPlacements = qaOptions?.productionBase ? [] : generatePrefabPlacements(
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
      generatorVersion: qaOptions?.version ?? "1.8",
      ...(macro ? { macroDesign: { ...macro, realized, attempts } } : {}),
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
          beamRatio: realized?.lateralSpread ?? beam,
          armorRatio: realized?.verticalSpread ?? armor,
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
        estimatedMass: Math.round(
          realized
            ? realized.estimatedMassTonnes
            : mass * (0.16 + p.survivability * 0.0022),
        ),
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
    if(qaOptions?.requirementPlan){b.designRequirements=qaOptions.requirementPlan;bindRequirementSpaces(b);}
    if (b.generatorVersion === "1.7" || b.generatorVersion === "1.8")
      integrateHull(b,qaOptions?.productionBase);
    lastErrors = validateBlueprint(b).filter(e=>!(qaOptions?.productionBase&&e==="Hardpoint count"));
    if (!lastErrors.length) return b;
    if (macro)
      attempts.push({
        candidate,
        family: macro.family,
        architecture: grammar,
        reasons: lastErrors,
        structures: volumes
          .filter((v) => lastErrors.some((e) => e.includes(v.id)))
          .map((v) => v.id),
        replacement: false,
      });
  }
  throw new Error(
    `No valid V${qaOptions?.version ?? "1.8"} ${selection.grammar}/${selectedFamily ?? "legacy"} design after 5 candidates: ${lastErrors.join("; ")}; attempts=${JSON.stringify(attempts)}`,
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

/** Immutable V1.7 generation path for archived comparisons; no Macro rules applied. */
export function generateBlueprintV17(
  input: ShipOrder,
  seed: number,
  options?: { architecture?: import("../blueprint/types").ArchitectureGrammar },
) {
  return generateBlueprint(input, seed, { ...options, version: "1.7" });
}

/** Frozen V1.8 reference path: no layered armor is added to legacy exports. */
export function generateBlueprintV18(input: ShipOrder, seed: number, options?: { architecture?: import("../blueprint/types").ArchitectureGrammar; family?: MacroFamily }) {
  return generateBlueprint(input, seed, { ...options, version: "1.8" });
}

/** Frozen omnidirectional V1.8.1 generation path for saved/rendered comparisons. */
export function generateBlueprintV181(input: ShipOrder, seed: number, options?: {architecture?: import("../blueprint/types").ArchitectureGrammar; family?: MacroFamily}) {
 return generateBlueprint(input,seed,{...options,version:"1.8.1"});
}
