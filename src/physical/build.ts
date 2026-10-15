import {minimumProcurementThickness,nominalProcurementThickness} from '../procurement/policy';
import {activePhysicalDiagnostics,timedPhysical,recordPhysicalStage} from './diagnostics';
import { integratedLayerVolumes } from "./integration";
import type { ShipBlueprint } from "../blueprint/types";
import { normal, area } from "../generation/armor/panels";
import { boundsOf, dot, sub } from "../generation/integration/contours";
import { DesignRejection } from "../generation/production/requirements";
import {
  physicalSources,
  sourceExclusions,
  exposedFacetPolygons,
  facetSupportPlanes,
} from "./geometry";
import { MATERIALS, materialLayers } from "./materials";
import { createDesignPolicy, finishPhysicalMass } from "./policy";
import {
  polygonLayer,
  canonicalSolid,
  outerFacetArea,
  mergeConvexCells,
  solidCell,
  cellVolume,
  clipCell,
  subtractCell,
  cellBounds,
} from "./convex";
import type { ConvexCell, PhysicalDesign, ProtectionSurface } from "./types";
import { boundsIndex } from "../generation/hardpoint-system/geometry";
const designCache = new Map<string, PhysicalDesign>();
export function addPhysicalDesign(
  b: ShipBlueprint,
  provenance: PhysicalDesign["provenance"] = "GENERATED",
  onProgress?: (sourceId: string, pieces: number) => void,
) {
  try {
    const keyStart=activePhysicalDiagnostics()?performance.now():0;
    const cacheKey = JSON.stringify([
      1, b.schemaVersion, b.architecture.grammar, b.macroDesign?.family,
      provenance,
      b.procurement?.order,
      b.seed,
      b.role,
      b.shipyardId,
      b.order,
      b.dimensions,
      b.designDoctrine?.profile.protection,
      b.structuralVolumes,
      b.productionDesign?.armor ?? b.structuralArmorPilot?.components,
      b.productionDesign?.finish,
      b.prefabPlacements,
      b.freeMountPlan,
    ]);
    if(keyStart)recordPhysicalStage("Cache key",performance.now()-keyStart);
    const cached = designCache.get(cacheKey),diagnostics=activePhysicalDiagnostics();
    if(diagnostics)diagnostics.cache[cached?"hits":"misses"]++;
    if (cached) {
      b.physicalDesign = timedPhysical("Cache clone",()=>structuredClone(cached));
      return b;
    }
    const sources = timedPhysical("Source geometry",()=>physicalSources(b)),
      preliminary = timedPhysical("Design policy",()=>createDesignPolicy(b, sources)),
      warnings: string[] = [],
      exclude = sourceExclusions(sources),
      exposed = exposedFacetPolygons(sources),
      role = b.designDoctrine?.profile.protection ?? 1;
    const minimumArmor = sources
      .filter((s) => s.kind === "ARMOR")
      .reduce(
        (n, s) =>
          n +
          ((s.triangles.reduce(
            (a, t, i) =>
              a +
              (area(t) > 1e-10
                ? exposed(s, i).reduce((n, p) => n + area(p), 0)
                : 0),
            0,
          ) *
             (b.procurement?minimumProcurementThickness(b,s,preliminary.hullThicknessMm):Math.max(35, preliminary.hullThicknessMm * 1.25))) /
            1000) *
            MATERIALS[
              s.zone === "CRITICAL"
                ? preliminary.criticalArmorMaterialPreference
                : preliminary.armorMaterialPreference
            ].densityKgM3,
        0,
      );
    const policy = timedPhysical("Design policy",()=>createDesignPolicy(b, sources, minimumArmor));
    const nominal = new Map(
      sources.map((s) => [
        s.id,
        s.kind === "HULL"
          ? policy.hullThicknessMm
          : b.procurement?nominalProcurementThickness(b,s):Math.max(
              55,
              (90 + b.order.length * 0.45) *
                (0.65 + b.order.priorities.survivability / 140) *
                role *
                (s.zone === "CRITICAL"
                  ? 1.45
                  : s.sourceKind === "PRODUCTION_FINISH"
                    ? 0.48
                    : 0.8),
            ),
      ]),
    );
    const material = (s: (typeof sources)[number]) =>
      s.kind === "HULL"
        ? policy.hullMaterialPreference
        : s.zone === "CRITICAL"
          ? policy.criticalArmorMaterialPreference
          : policy.armorMaterialPreference;
    const nativeArmorBounds = b.procurement?sources.filter(s=>s.kind==='ARMOR').map(s=>({
      coefficient:s.triangles.reduce((a,t,i)=>a+(area(t)>1e-10?exposed(s,i).reduce((n,p)=>n+area(p),0):0),0)/1000*MATERIALS[material(s)].densityKgM3,
      minimum:minimumProcurementThickness(b,s,policy.hullThicknessMm),nominal:nominal.get(s.id)!
    })):undefined;
    const armorUpper = sources
      .filter((s) => s.kind === "ARMOR")
      .reduce(
        (n, s) =>
          n +
          ((s.triangles.reduce(
            (a, t, i) =>
              a +
              (area(t) > 1e-10
                ? exposed(s, i).reduce((n, p) => n + area(p), 0)
                : 0),
            0,
          ) *
            nominal.get(s.id)!) /
            1000) *
            MATERIALS[material(s)].densityKgM3,
        0,
      );
    let scale = Math.min(
      1,
      policy.allocationsKg.armor / Math.max(1, armorUpper),
    );
    if(nativeArmorBounds){
      // A uniform ratio alone overspends once individual minimum depths clamp.
      // Solve the actual bounded sum, preserving all minimum/REQUIRE depths.
      const bound=(ratio:number)=>nativeArmorBounds.reduce((n,s)=>n+s.coefficient*Math.max(s.minimum,s.nominal*ratio),0);
      if(bound(scale)>policy.allocationsKg.armor){let lo=0,hi=scale;for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(bound(mid)<=policy.allocationsKg.armor)lo=mid;else hi=mid;}scale=lo;}
    }
    if (scale < 1)
      policy.tradeoffs.push(
        `Armor mass competition: nominal thickness scaled by ${scale.toFixed(6)} against conservative exposed-area/density upper bound; no budget value overwritten.`,
      );
    const surfaces: ProtectionSurface[] = [];
    let totalPieces = 0;
    type StoredCell = {
      cell: ConvexCell;
      bounds: ReturnType<typeof cellBounds>;
    };
    const batches: ReturnType<typeof boundsIndex<StoredCell>>[] = [],
      tail: StoredCell[] = [];
    const remember = (cell: ConvexCell) => {
      tail.push({ cell, bounds: cellBounds(cell) });
      if (tail.length === 64) {
        batches.push(boundsIndex(tail.splice(0)));
      }
    };
    const overlaps = (cell: ConvexCell) => {
      const b = cellBounds(cell);
      return [
        ...batches.flatMap((q) => q(b)),
        ...tail.filter(
          (c) =>
            c.bounds.min.x <= b.max.x &&
            c.bounds.max.x >= b.min.x &&
            c.bounds.min.y <= b.max.y &&
            c.bounds.max.y >= b.min.y &&
            c.bounds.min.z <= b.max.z &&
            c.bounds.max.z >= b.min.z,
        ),
      ];
    };
    for (const source of [
      ...sources.filter((s) => s.kind === "ARMOR"),
      ...sources.filter((s) => s.kind === "HULL"),
    ]) {
      if (source.approximation)
        warnings.push(source.id + ": " + source.approximation);
      const minimum = b.procurement?minimumProcurementThickness(b,source,policy.hullThicknessMm):
          source.kind === "HULL"
            ? 8
            : Math.max(35, policy.hullThicknessMm * 1.25),
        wanted =
          nominal.get(source.id)! * (source.kind === "ARMOR" ? scale : 1);
      const thicknessMm = Math.max(minimum, wanted);
      if (!Number.isFinite(thicknessMm) || thicknessMm <= 0)
        throw Error("INVALID_PHYSICAL_SKIN_THICKNESS " + source.id);
      const stack = materialLayers(material(source), thicknessMm).map((l) => ({
          ...l,
          volumeM3: 0,
          massKg: 0,
        })),
        surface: ProtectionSurface = {
          id: (source.kind === "ARMOR" ? "plate/" : "shell/") + source.id,
          minimumFacetThicknessMm: Infinity,
          maximumFacetThicknessMm: 0,
          kind: source.kind,
          materialId: material(source),
          thicknessMm,
          geometryReference: {
            sourceId: source.id,
            parentStructureId: source.parent,
            sourceKind: source.sourceKind,
          },
          protectionZoneId: source.zone,
          layerStack: stack,
          facets: [],
          pieces: [],
          surfaceAreaM2: source.areaM2,
          physicalOuterAreaM2: 0,
          volumeM3: 0,
          massKg: 0,
          normalEquivalentDensityKgM3: MATERIALS[material(source)].densityKgM3,
          integratedMeanDensityKgM3: 0,
          bounds: boundsOf(source.solid.vertices),
          coverage: "FINITE_MESH",
        };
      const sourceStart=diagnostics?performance.now():0;
      for (const [index, tri] of source.triangles.entries()) {
        if (area(tri) < 1e-10) continue;
        const facetIndex = surface.facets.length,
          n = normal(tri),
          actualThicknessMm = thicknessMm;
        if (actualThicknessMm <= 1e-6)
          throw Error("INVALID_ZERO_DEPTH_FACET " + source.id);
        surface.minimumFacetThicknessMm = Math.min(
          surface.minimumFacetThicknessMm,
          actualThicknessMm,
        );
        surface.maximumFacetThicknessMm = Math.max(
          surface.maximumFacetThicknessMm,
          actualThicknessMm,
        );
        surface.facets.push({
          sourceTriangle: index,
          normal: n,
          planeOffsetM: dot(n, tri[0]),
          areaM2: area(tri),
          maximumThicknessMm: thicknessMm,
          thicknessMm: actualThicknessMm,
        });
        const facetCells: ConvexCell[] = [];
        for (const polygon of exposed(source, index)) {
          const candidate = polygonLayer(
            polygon,
            source.kernels[index],
            0,
            actualThicknessMm / 1000,
            true,
          );
          let supported: ConvexCell | undefined = candidate;
          for (const plane of facetSupportPlanes(source, index)) {
            if (!supported) break;
            supported = clipCell(supported, plane.n, plane.d, true);
          }
          let pieces = supported ? exclude(supported, source, tri) : [];
          for (const other of overlaps(candidate)) {
            pieces = pieces.flatMap((c) => subtractCell(c, other.cell));
            if (pieces.length > 256)
              throw Error("PHYSICAL_FRAGMENT_LIMIT " + source.id);
          }
          for (const previous of facetCells)
            pieces = pieces.flatMap((c) => subtractCell(c, previous));
          facetCells.push(...pieces);
        }
        const finalCells = mergeConvexCells(facetCells);
        surface.physicalOuterAreaM2 += timedPhysical("Outer area union",()=>outerFacetArea(finalCells, tri));
        for (const cell of finalCells) {
          if (cellVolume(cell) < 1e-9) continue;
          remember(cell);

          const solid = canonicalSolid(cell),
            volumeM3 = cellVolume(solidCell(solid)),
            piece = { facetIndex, layerOrder: -1, solid, volumeM3 };
          surface.pieces.push(piece);
          for (const part of timedPhysical("Layer integration",()=>integratedLayerVolumes(surface, piece))) {
            const layer = stack[part.layerOrder];
            layer.volumeM3 += part.volumeM3;
            layer.massKg += part.volumeM3 * layer.densityKgM3;
          }
        }
      }
      if(sourceStart)recordPhysicalStage(source.kind+" physical construction",performance.now()-sourceStart);
      const active = new Set(surface.pieces.map((p) => p.facetIndex)),
        used = surface.facets.filter((_, i) => active.has(i));
      surface.minimumFacetThicknessMm = used.length
        ? Math.min(...used.map((f) => f.thicknessMm))
        : 0;
      surface.maximumFacetThicknessMm = used.length
        ? Math.max(...used.map((f) => f.thicknessMm))
        : 0;
      if (used.length && surface.minimumFacetThicknessMm < thicknessMm - 1e-6)
        warnings.push(
          source.id +
            `: facet depth saturation; nominal ${thicknessMm.toFixed(3)}mm, actual ${surface.minimumFacetThicknessMm.toFixed(3)}–${surface.maximumFacetThicknessMm.toFixed(3)}mm`,
        );
      surface.volumeM3 = stack.reduce((v, l) => v + l.volumeM3, 0);
      surface.massKg = stack.reduce((m, l) => m + l.massKg, 0);
      surface.integratedMeanDensityKgM3 = surface.volumeM3
        ? surface.massKg / surface.volumeM3
        : 0;
      onProgress?.(source.id, surface.pieces.length);
      totalPieces += surface.pieces.length;
      if (totalPieces > 40000) throw Error("PHYSICAL_SHIP_PIECE_LIMIT");
      if (surface.pieces.length) surfaces.push(surface);
      else
        warnings.push(
          source.id +
            ": entirely buried / duplicate skin; no physical coating registered",
        );
    }
    const hullOuterAreaM2 = surfaces
        .filter((s) => s.kind === "HULL")
        .reduce((n, s) => n + s.physicalOuterAreaM2, 0),
      armorOuterAreaM2 = surfaces
        .filter((s) => s.kind === "ARMOR")
        .reduce((n, s) => n + s.physicalOuterAreaM2, 0),
      eligibleArmorAreaM2 = sources
        .filter((s) => s.kind === "ARMOR")
        .reduce((n, s) => n + s.areaM2, 0),
      critical = sources
        .filter((s) => s.zone === "CRITICAL")
        .reduce((n, s) => n + s.areaM2, 0);
    b.physicalDesign = {
      version: "1.8.6.0",
      materialRegistryVersion: 1,
      provenance,
      geometryModel: "BOUNDED_NORMAL_FACET_SKINS",
      approximation:
        "Exact entry/exit and integrated layer mass for stored finite convex cells. Normal-directed finite facet skins clipped to local supporting planes, Hull contact volumes and prior physical skins. Nonconvex enclosing interiors are a faceted-shell approximation, not a complete structural solid. Unverified enclosing bodies are not registered; their valid finite facets use a separately verified local skin approximation with explicit warnings. Collinear clip edges are simplified within 1e-7m. Geometry follows retained faceted render geometry, not a uniform normal-offset smooth shell. Curves are faceted; corners taper. Source contacts/buried regions are removed by convex subtraction. No penetration coefficients calibrated.",
      policy,
      surfaces,
      mass: null as any,
      warnings,
      coverage: {
        method: "AREA_OF_SURVIVING_OUTER_FACET_POLYGONS",
        armorOuterAreaM2,
        hullOuterAreaM2,
        eligibleArmorAreaM2,
        armorRetainedFraction: eligibleArmorAreaM2
          ? armorOuterAreaM2 / eligibleArmorAreaM2
          : 0,
        criticalRetainedFraction: critical
          ? surfaces
              .filter((s) => s.protectionZoneId === "CRITICAL")
              .reduce((n, s) => n + s.physicalOuterAreaM2, 0) / critical
          : 0,
      },
    };
    b.physicalDesign.mass = timedPhysical("Mass ledger",()=>finishPhysicalMass(b));
    if (
      b.physicalDesign.mass.armorBudgetRemainingKg < -1e-3 ||
      b.physicalDesign.mass.ledger!.baseBudgetViolation
    )
      throw Error(
        b.procurement?"REQUIRED_MAXIMUM_BASE_MASS_EXCEEDED: finite skin / estimated base exceeds hard limit":"REQUIRED_PHYSICAL_MASS_BUDGET_EXCEEDED: minimum valid skin / retained equipment exceeds target",
      );
    if (!b.procurement && b.physicalDesign.mass.remainingMassKg < 0)
      policy.tradeoffs.push(
        "Player exterior equipment exceeds dry-mass target; reported, not an internal/load/mass installation gate.",
      );
    policy.tradeoffs.push(
      "Actual coverage is fixed by surviving finite surfaces; policy target is recorded as saturated by retained geometry. Physical coverage ratios are exposed-skin area retention, not an omnidirectional ship protection percentage.",
    );
    if (designCache.size >= 1)
      designCache.delete(designCache.keys().next().value!);
    designCache.set(cacheKey, timedPhysical("Cache store",()=>structuredClone(b.physicalDesign!)));
    return b;
  } catch (e) {
    delete b.physicalDesign;
    if (e instanceof DesignRejection) throw e;
    const reason = String(e),
      code =
        reason.match(/(?:REQUIRED_|INVALID_)[A-Z_]+/)?.[0] ??
        "REQUIRED_PHYSICAL_DESIGN_INVALID";
    throw new DesignRejection([code], [], reason);
  }
}
/** Explicit opt-in migration only. Loading never invents an allegedly historical material plan. */
export function migratePhysicalDesign(b: ShipBlueprint) {
  if (b.physicalDesign) return structuredClone(b);
  return addPhysicalDesign(structuredClone(b), "MIGRATED_DEFAULT_ESTIMATE");
}
