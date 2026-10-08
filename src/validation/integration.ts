import type { ShipBlueprint } from "../blueprint/types";
import { containsVolume } from "../generation/architecture/volumes";
import { contourSamples } from "../generation/integration/contours";
import {
  inReservedZone,
  permittedOwnZone,
} from "../generation/integration/reservations";
export function validateIntegration(b: ShipBlueprint) {
  const errors: string[] = [],
    data = b.hullIntegration,
    l = b.order.length;
  if (!data || !data.axisAlignedVolumes)
    return ["Missing hull integration data"];
  const volumes = new Map(b.structuralVolumes.map((v) => [v.id, v]));
  if (
    new Set(data.reservedZones.map((z) => z.id)).size !==
    data.reservedZones.length
  )
    errors.push("Duplicate equipment zone");
  for (const z of data.reservedZones)
    if (
      ![
        ...b.hardpoints.map((h) => h.id),
        ...b.engines.map((e) => e.id),
        ...(b.prefabPlacements ?? []).map((p) => p.id),
      ].includes(z.equipmentId) ||
      !volumes.has(z.parentId) ||
      Math.min(z.radius, z.depth) <= 0 ||
      Math.abs(Math.hypot(z.normal.x, z.normal.y, z.normal.z) - 1) > 0.001
    )
      errors.push(`Invalid equipment zone ${z.id}`);
  for (const p of b.prefabPlacements ?? [])
    if (p.exterior) {
      const e = p.exterior;
      if (
        e.parentIds.some((id) => !volumes.has(id)) ||
        e.matingSockets.some(
          (s) =>
            !volumes.has(s.hostId) ||
            !containsVolume(volumes.get(s.hostId)!, s.position, l * 0.003),
        )
      )
        errors.push(`Detached exterior socket ${p.id}`);
      if (
        e.connectorId &&
        !b.structuralConnectors.some((c) => c.id === e.connectorId)
      )
        errors.push(`Invalid integration connector ${p.id}`);
      if (
        e.equipmentZoneId &&
        !data.reservedZones.some((z) => z.id === e.equipmentZoneId)
      )
        errors.push(`Invalid equipment reference ${p.id}`);
      if (
        !e.contactSamples.length ||
        e.contactSamples.some(
          (s) =>
            !volumes.has(s.parentId) ||
            !e.parentIds.includes(s.parentId) ||
            !containsVolume(volumes.get(s.parentId)!, s.position, l * 0.0001),
        )
      )
        errors.push(`Detached exterior contour ${p.id}`);
      if (e.inset <= 0 || e.inset > l * 0.015)
        errors.push(`Exterior embed depth ${p.id}`);
      let samples = e.rings ? contourSamples(e.rings) : [];
      if (
        e.rings &&
        (e.rings.length < 2 ||
          e.rings.some((r) => r.length < 3 || r.length !== e.rings![0].length))
      )
        errors.push(`Invalid exterior topology ${p.id}`);
      if (e.tube) {
        const t = e.tube;
        if (!(
          t.outerRadius > t.innerRadius &&
          t.innerRadius > 0 &&
          t.length > 0
        ))
          errors.push(`Invalid casing ${p.id}`);
        const zone = data.reservedZones.find((z) => z.id === e.equipmentZoneId);
        if (zone?.kind === "exhaust" && t.innerRadius < zone.radius)
          errors.push(`Blocked exhaust ${p.id}`);
        samples = Array.from({ length: 32 }, (_, i) => ({
          x: t.center.x + t.outerRadius * Math.cos(((i % 16) * Math.PI) / 8),
          y: t.center.y + t.outerRadius * Math.sin(((i % 16) * Math.PI) / 8),
          z: t.center.z + (i < 16 ? -0.5 : 0.5) * t.length,
        }));
      }
      if (!e.rings && !e.tube) errors.push(`Missing exterior geometry ${p.id}`);
      for (const z of data.reservedZones)
        if (
          !permittedOwnZone(p, z) &&
          samples.some((q) => inReservedZone(q, z))
        )
          errors.push(`Equipment occluded ${p.id}/${z.id}`);
      for (const v of volumes.values())
        if (
          !e.parentIds.includes(v.id) &&
          samples.some((q) => containsVolume(v, q, -l * 0.001))
        )
          errors.push(`Exterior intrusion ${p.id}/${v.id}`);
      if (
        samples.some((q) =>
          Object.keys(q).some((k) => {
            const axis = k as "x" | "y" | "z";
            return (
              q[axis] < data.exteriorBounds.min[axis] - 0.001 ||
              q[axis] > data.exteriorBounds.max[axis] + 0.001
            );
          }),
        )
      )
        errors.push(`Exterior bounds ${p.id}`);
    }
  return errors;
}
