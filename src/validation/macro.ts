import type { ShipBlueprint } from "../blueprint/types";
import { measureMacro } from "../generation/macro/measurement";
import { FAMILY_COMPATIBILITY } from "../generation/macro/plan";
import { containsVolume } from "../generation/architecture/volumes";
export function validateMacro(b: ShipBlueprint) {
  const p = b.macroDesign;
  if (!p)
    return b.generatorVersion === "1.8" ? ["Missing Macro Design Plan"] : [];
  const errors: string[] = [],
    l = b.order.length;
  if (
    !FAMILY_COMPATIBILITY[b.architecture.grammar].includes(p.family) ||
    p.architecture !== b.architecture.grammar ||
    p.composition !== b.architecture.composition
  )
    errors.push("Macro / architecture mismatch");
  const actual = measureMacro(b.order, b.structuralVolumes);
  for (const key of [
    "primaryMassRatio",
    "foreMassRatio",
    "midMassRatio",
    "aftMassRatio",
    "lateralSpread",
    "verticalSpread",
    "approximateVolumeM3",
  ] as const) {
    if (
      Math.abs(actual[key] - p[key]) >
      Math.max(1, Math.abs(actual[key])) * 1e-8
    )
      errors.push(`Macro target mismatch ${key}`);
    if (
      !p.realized ||
      Math.abs(actual[key] - p.realized[key]) >
        Math.max(1, Math.abs(actual[key])) * 1e-8
    )
      errors.push(`Macro realized mismatch ${key}`);
  }
  if (Math.abs(p.foreMassRatio + p.midMassRatio + p.aftMassRatio - 1) > 1e-8)
    errors.push("Macro regional budget");
  if (
    Math.abs(
      b.dimensions.estimatedMass - Math.round(actual.estimatedMassTonnes),
    ) > 1
  )
    errors.push("Macro mass units / estimate mismatch");
  if (
    new Set(p.majorModuleRoles.map((m) => m.id)).size !==
    b.structuralVolumes.length
  )
    errors.push("Macro module budget / IDs");
  for (const m of p.majorModuleRoles) {
    const v = b.structuralVolumes.find((v) => v.id === m.id);
    if (!v) {
      errors.push(`Macro missing module ${m.id}`);
      continue;
    }
    for (const axis of ["x", "y", "z"] as const)
      if (
        Math.abs(v.position[axis] - m.position[axis]) > l * 1e-8 ||
        Math.abs(v.dimensions[axis] - m.dimensions[axis]) > l * 1e-8
      )
        errors.push(`Macro layout drift ${m.id}`);
    if (JSON.stringify(v.shape) !== JSON.stringify(m.shape))
      errors.push(`Macro shape drift ${m.id}`);
    if (actual.moduleVolumesM3[m.id] <= 0) errors.push(`Macro volume ${m.id}`);
  }
  if (
    Math.abs(
      (b.silhouette.massHierarchy?.foreRatio ?? -1) - actual.foreMassRatio,
    ) > 1e-8 ||
    Math.abs(
      (b.silhouette.massHierarchy?.aftRatio ?? -1) - actual.aftMassRatio,
    ) > 1e-8
  )
    errors.push("Macro / silhouette mass mismatch");
  // Explicit physical corridors; not a CSG / dynamic ballistic simulation.
  for (const h of b.hardpoints.filter((h) => h.type === "Spinal"))
    for (let i = 1; i <= 12; i++) {
      const point = { ...h.position, z: h.position.z - i * l * 0.01 };
      if (
        b.structuralVolumes.some(
          (v) =>
            v.id !== h.parentId && containsVolume(v, point, h.radius * 0.1),
        )
      ) {
        errors.push(`Blocked spinal path ${h.id}`);
        break;
      }
    }
  for (const e of b.engines)
    for (let i = 1; i <= 8; i++) {
      const point = { ...e.position, z: e.position.z + i * l * 0.01 };
      if (
        b.structuralVolumes.some(
          (v) =>
            v.id !== e.parentId &&
            containsVolume(v, point, e.nozzleRadius * 0.1),
        )
      ) {
        errors.push(`Blocked exhaust path ${e.id}`);
        break;
      }
    }
  for (const gap of p.negativeSpaceTargets)
    if (b.structuralVolumes.some((v) => containsVolume(v, gap.center)))
      errors.push(`Lost negative space ${gap.id}`);
  if (p.family === "HAMMERHEAD" && actual.foreMassRatio < 0.34)
    errors.push("Hammerhead fore mass budget");
  if (p.family === "ENGINE_DOMINANT" && actual.aftMassRatio < 0.3)
    errors.push("Engine aft mass budget");
  if (p.family === "WEDGE_CITADEL" && actual.lateralSpread < 0.32)
    errors.push("Wedge insufficient broad envelope");
  if (p.family === "WIDE_CARRIER" && actual.lateralSpread < 0.6)
    errors.push("Carrier lateral budget");
  return errors;
}
