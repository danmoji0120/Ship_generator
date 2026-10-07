import type {
  LegacyShipBlueprint as ShipBlueprint,
  Vec3,
} from "../blueprint/types";
import { HARDPOINT_TYPES } from "../blueprint/types";
import { exposedSurface } from "../generation/attachment";
import { stationAt } from "../generation/hull";
function finite(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finite);
  if (value && typeof value === "object")
    return Object.values(value).every(finite);
  return true;
}
export function validateBlueprint(b: ShipBlueprint): string[] {
  const errors: string[] = [],
    l = b.order.length;
  if (!finite(b)) errors.push("Invalid numeric value");
  if (
    b.stations.length < 5 ||
    b.stations.length > 12 ||
    b.hullSections.length !== b.stations.length - 1
  )
    errors.push("Hull section count");
  if (
    b.stations.some(
      (s, i) =>
        s.width < l * 0.001 ||
        s.height < l * 0.002 ||
        (i > 0 && s.z <= b.stations[i - 1].z),
    )
  )
    errors.push("Hull dimensions or station order");
  if (
    b.dimensions.width < l * 0.02 ||
    b.dimensions.width > l * 1.3 ||
    b.dimensions.height < l * 0.015 ||
    b.dimensions.height > l * 0.65 ||
    b.dimensions.length < l ||
    b.dimensions.length > l * 1.25 ||
    b.dimensions.estimatedMass <= 0
  )
    errors.push("Overall dimensions");
  const modules = new Map(b.secondaryStructures.map((m) => [m.id, m]));
  const insideHull = (v: Vec3, tol = 0) => {
    if (v.z < -l / 2 - tol || v.z > l / 2 + tol) return false;
    const s = stationAt(b.stations, v.z);
    return (
      Math.abs(v.x) <= s.width / 2 + tol && Math.abs(v.y) <= s.height / 2 + tol
    );
  };
  for (const m of b.secondaryStructures) {
    if (m.size.x <= 0 || m.size.y <= 0 || m.size.z <= 0)
      errors.push(`Invalid module ${m.id}`);
    const s = stationAt(b.stations, m.position.z);
    const overlap =
      Math.abs(m.position.x) - m.size.x / 2 < s.width / 2 &&
      Math.abs(m.position.y) - m.size.y / 2 < s.height / 2;
    const connected = b.trusses.some(
      (t) => t.parentIds.includes(m.id) && insideHull(t.start, l * 0.005),
    );
    if (!overlap && !connected) errors.push(`Detached module ${m.id}`);
  }
  for (const e of b.engines) {
    const m = modules.get(e.parentId);
    if (e.nozzleRadius <= 0 || e.nozzleLength <= 0)
      errors.push(`Invalid engine ${e.id}`);
    if (m) {
      if (
        Math.abs(e.position.z - (m.position.z + m.size.z / 2)) > l * 0.001 ||
        Math.abs(e.position.x - m.position.x) + e.nozzleRadius > m.size.x / 2
      )
        errors.push(`Detached engine ${e.id}`);
    } else if (
      !insideHull(e.position, l * 0.001) ||
      Math.abs(e.position.z - l / 2) > l * 0.001
    )
      errors.push(`Detached engine ${e.id}`);
  }
  if (![1, 2, 4, 6].includes(b.engines.length)) errors.push("Engine count");
  for (const h of b.hardpoints) {
    if (
      !HARDPOINT_TYPES.includes(h.type) ||
      h.allowedCategories.length === 0 ||
      Math.abs(Math.hypot(h.normal.x, h.normal.y, h.normal.z) - 1) > 0.001
    )
      errors.push(`Invalid hardpoint ${h.id}`);
    if (h.type === "Spinal") {
      if (h.position.x !== 0 || h.position.y !== 0 || h.normal.z !== -1)
        errors.push("Spinal alignment");
    } else {
      try {
        const surface = exposedSurface(
          b.stations,
          b.secondaryStructures,
          h.position.x,
          h.position.z,
        );
        if (
          surface.parentId !== h.parentId ||
          Math.abs(h.position.y - surface.y) > l * 0.002
        )
          errors.push(`Detached hardpoint ${h.id}`);
      } catch {
        errors.push(`Detached hardpoint ${h.id}`);
      }
    }
  }
  if (b.hardpoints.length < 3 || b.hardpoints.length > 100)
    errors.push("Hardpoint count");
  for (const t of b.trusses)
    if (
      t.radius <= 0 ||
      !t.parentIds.every((id) => id === "hull" || modules.has(id))
    )
      errors.push("Truss parent");
  return errors;
}
