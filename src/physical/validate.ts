import {procurementWeights} from '../procurement/order';
import { integratedLayerVolumes } from "./integration";
import type { ShipBlueprint } from "../blueprint/types";
import { MATERIALS, ARMOR_MATERIALS, HULL_MATERIALS } from "./materials";
import { physicalSources } from "./geometry";
import {
  solidCell,
  cellVolume,
  planes,
  cellBounds,
  triangleLayer,
  subtractCell,
} from "./convex";
import { boundsIndex } from "../generation/hardpoint-system/geometry";
import { dot } from "../generation/integration/contours";
import { normal, area } from "../generation/armor/panels";
import { finishPhysicalMass } from "./policy";
const close = (a: number, b: number) =>
  Number.isFinite(a) &&
  Number.isFinite(b) &&
  Math.abs(a - b) <= Math.max(1e-5, Math.abs(b) * 1e-7);
// Cache only the last successful ordinary validation. Content signatures include every
// referenced geometry/accounting input, so mutations and imported JSON still revalidate.
// Explicit overlap QA always runs the full independent intersection check.
let lastValidationKey: string | undefined;
export function validatePhysicalDesign(
  b: ShipBlueprint,
  checkOverlaps = false,
) {
  const d = b.physicalDesign;
  if (!d) return [];
  const issues: string[] = [];
  let cacheKey: string | undefined;
  try {
    if (!checkOverlaps) {
      cacheKey = JSON.stringify([
        d,
        b.order,
        b.procurement?.order,
        b.dimensions,
        b.role,
        b.structuralVolumes,
        b.productionDesign?.armor ?? b.structuralArmorPilot?.components,
        b.productionDesign?.finish,
        b.prefabPlacements,
        b.freeMountPlan,
      ]);
      if (cacheKey === lastValidationKey) return [];
    }
    if (
      d.version !== "1.8.6.0" ||
      d.materialRegistryVersion !== 1 ||
      !["GENERATED", "MIGRATED_DEFAULT_ESTIMATE"].includes(d.provenance)
    )
      issues.push("Invalid physical design contract");
    if (
      !close(
        d.policy.targetMassBudgetKg,
        b.procurement?.order.targetMassKg ?? b.order.targetDryMassKg ?? b.dimensions.estimatedMass * 1000,
      )
    )
      issues.push("Physical target differs from order/legacy target");
    if (
      JSON.stringify(d.policy.priorityWeights) !==
      JSON.stringify(b.procurement?procurementWeights(b.procurement.order):b.order.priorities)
    )
      issues.push("Physical policy differs from order priorities");
    if (
      !close(
        Object.values(d.policy.allocationsKg).reduce((n, v) => n + v, 0),
        d.policy.planningMassBudgetKg??d.policy.targetMassBudgetKg,
      ) ||
      Object.values(d.policy.allocationsKg).some(
        (v) => !Number.isFinite(v) || v < 0,
      )
    )
      issues.push("Physical sector budget invalid");
    const sources = new Map(physicalSources(b).map((s) => [s.id, s])),
      ids = new Set<string>(),
      all: {
        cell: ReturnType<typeof solidCell>;
        bounds: ReturnType<typeof cellBounds>;
        id: string;
        index: number;
      }[] = [];
    let totalPieces = 0;
    for (const s of d.surfaces) {
      if (ids.has(s.id)) issues.push("Duplicate physical surface " + s.id);
      ids.add(s.id);
      const source = sources.get(s.geometryReference.sourceId),
        material = MATERIALS[s.materialId];
      if (
        !source ||
        !material ||
        source.parent !== s.geometryReference.parentStructureId ||
        source.kind !== s.kind ||
        !Number.isFinite(s.thicknessMm) ||
        s.thicknessMm <= 0
      ) {
        issues.push("Invalid physical material/thickness/geometry " + s.id);
        continue;
      }
      if (
        !(s.kind === "HULL"
          ? Object.hasOwn(HULL_MATERIALS, s.materialId)
          : Object.hasOwn(ARMOR_MATERIALS, s.materialId)) ||
        s.protectionZoneId !== source.zone ||
        material.requiredTechLevel > d.policy.manufacturingTechPreference
      )
        issues.push(
          "Physical layer classification / manufacturing policy mismatch " +
            s.id,
        );
      if (
        !close(s.surfaceAreaM2, source.areaM2) ||
        s.physicalOuterAreaM2 > s.surfaceAreaM2 + 1e-4
      )
        issues.push(
          "Physical surface area mismatch " +
            s.id +
            " source=" +
            source.areaM2 +
            " stored=" +
            s.surfaceAreaM2 +
            " outer=" +
            s.physicalOuterAreaM2,
        );
      if (
        s.layerStack.length !== material.layerDefinition.length ||
        !close(
          s.layerStack.reduce((n, l) => n + l.thicknessMm, 0),
          s.thicknessMm,
        )
      )
        issues.push("Invalid layer thickness sum " + s.id);
      const volumes = s.layerStack.map(() => 0);
      for (const f of s.facets) {
        const tri = source.triangles[f.sourceTriangle];
        if (
          !tri ||
          !close(area(tri), f.areaM2) ||
          !Number.isFinite(f.thicknessMm) ||
          f.thicknessMm <= 0 ||
          f.thicknessMm > s.thicknessMm + 1e-5 ||
          !close(f.planeOffsetM, dot(f.normal, tri[0])) ||
          Math.hypot(
            f.normal.x - normal(tri).x,
            f.normal.y - normal(tri).y,
            f.normal.z - normal(tri).z,
          ) > 1e-6
        )
          issues.push("Invalid finite physical facet " + s.id);
      }
      for (const p of s.pieces) {
        if (++totalPieces > 40000) throw Error("Physical piece limit exceeded");
        const f = s.facets[p.facetIndex],
          l = s.layerStack[Math.max(0, p.layerOrder)];
        if (
          !f ||
          !l ||
          p.layerOrder < -1 ||
          p.solid.vertices.some(
            (v) => ![v.x, v.y, v.z].every(Number.isFinite),
          ) ||
          p.solid.indices.some(
            (i) =>
              !Number.isInteger(i) || i < 0 || i >= p.solid.vertices.length,
          )
        ) {
          issues.push("Invalid physical piece " + s.id);
          continue;
        }
        const cell = solidCell(p.solid),
          v = cellVolume(cell);
        if (
          !close(v, p.volumeM3) ||
          v <= 0 ||
          planes(cell).some((pl) =>
            p.solid.vertices.some((v) => dot(pl.n, v) > pl.d + 1e-5),
          )
        )
          issues.push("Invalid physical convex volume " + s.id);
        const tri = source.triangles[f.sourceTriangle],
          start =
            p.layerOrder < 0
              ? 0
              : ((s.layerStack
                  .slice(0, p.layerOrder)
                  .reduce((n, l) => n + l.thicknessMm, 0) /
                  1000) *
                  f.thicknessMm) /
                s.thicknessMm,
          end =
            p.layerOrder < 0
              ? f.thicknessMm / 1000
              : start +
                ((l.thicknessMm / 1000) * f.thicknessMm) / s.thicknessMm;
        const authority = triangleLayer(tri, start, end);
        if (
          planes(authority).some((pl) =>
            p.solid.vertices.some((v) => dot(pl.n, v) > pl.d + 1e-5),
          )
        )
          issues.push("Detached / expanded physical layer " + s.id);
        for (const part of integratedLayerVolumes(s, p))
          volumes[part.layerOrder] += part.volumeM3;
        if (checkOverlaps)
          all.push({
            cell,
            bounds: cellBounds(cell),
            id: s.id,
            index: all.length,
          });
      }
      for (const [i, l] of s.layerStack.entries()) {
        const def = material.layerDefinition[i];
        if (
          !def ||
          l.layerOrder !== i ||
          l.futureFailureModelId !== def.futureFailureModelId ||
          l.constituentMaterialId !== def.constituentMaterialId ||
          !close(l.thicknessMm, s.thicknessMm * def.fraction) ||
          l.densityKgM3 !== def.densityKgM3 ||
          !close(l.volumeM3, volumes[i]) ||
          !close(l.massKg, l.volumeM3 * l.densityKgM3)
        )
          issues.push("Layer composition/density/mass mismatch " + s.id);
      }
      if (
        !close(
          s.volumeM3,
          volumes.reduce((n, v) => n + v, 0),
        ) ||
        !close(
          s.massKg,
          s.layerStack.reduce((n, l) => n + l.massKg, 0),
        ) ||
        !close(s.normalEquivalentDensityKgM3, material.densityKgM3) ||
        !close(s.integratedMeanDensityKgM3, s.massKg / s.volumeM3)
      )
        issues.push("Integrated mass/density mismatch " + s.id);
    }
    if (checkOverlaps) {
      const query = boundsIndex(all);
      for (const a of all)
        for (const c of query(a.bounds)) {
          if (c.index <= a.index) continue;
          const v = cellVolume(a.cell),
            remaining = subtractCell(a.cell, c.cell).reduce(
              (n, p) => n + cellVolume(p),
              0,
            );
          if (v - remaining > Math.max(1e-5, v * 1e-6))
            issues.push("Overlapping physical material " + a.id + "/" + c.id);
        }
    }
    const expected = finishPhysicalMass(b);
    for (const [k, v] of Object.entries(expected))
      if (
        typeof v === "number" &&
        !close(d.mass[k as keyof typeof d.mass] as number, v)
      )
        issues.push("Mass accounting mismatch " + k);
    if(d.mass.ledger&&JSON.stringify(d.mass.ledger)!==JSON.stringify(expected.ledger))issues.push('Mass ledger/source/budget mismatch');
    if (d.mass.armorBudgetRemainingKg < -1e-3)
      issues.push("Armor mass budget exceeded");
    // Free mounts never acquire a new internal/mass installation gate: an over-target loadout is a reported warning.
    if (expected.ledger!.baseBudgetViolation)
      issues.push("Physical ship mass target exceeded");
    if (!d.surfaces.length) issues.push("No physical shells/armor registered");
  } catch (e) {
    issues.push("Physical validation error: " + String(e));
  }
  if (
    !checkOverlaps &&
    !issues.length &&
    cacheKey &&
    cacheKey.length <= 64 * 1024 * 1024
  )
    lastValidationKey = cacheKey;
  return [...new Set(issues)];
}
