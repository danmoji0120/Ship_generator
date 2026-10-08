import type { AnyShipBlueprint, ShipBlueprint } from "../blueprint/types";
import { ARCHITECTURES, HARDPOINT_TYPES } from "../blueprint/types";
import { validateBlueprint as validateV0 } from "./legacy";
import {
  containsVolume,
  volumeBounds,
  exposedVolumeSurface,
} from "../generation/architecture/volumes";
import { shapeStations } from "../generation/shapes/definition";
import { SHAPE_KINDS, JOIN_TYPES } from "../blueprint/types";
import { hullSurfaceAt } from "../generation/hull";
import { connectedIds, validateSilhouette } from "./silhouette";
function finite(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(finite);
  if (v && typeof v === "object") return Object.values(v).every(finite);
  return true;
}
export function validateArchitecture(b: ShipBlueprint) {
  const errors: string[] = [],
    l = b.order.length,
    volumes = new Map(b.structuralVolumes.map((v) => [v.id, v]));
  if (!finite(b)) return ["Invalid numeric value"];
  if (
    !ARCHITECTURES.includes(b.architecture.grammar) ||
    b.architecture.components.length > 2
  )
    errors.push("Architecture grammar");
  if (
    volumes.size !== b.structuralVolumes.length ||
    new Set(b.structuralConnectors.map((c) => c.id)).size !==
      b.structuralConnectors.length
  )
    errors.push("Duplicate structural ID");
  if (!volumes.has(b.architecture.rootVolumeId))
    errors.push("Invalid graph root");
  if (
    connectedIds(b.structuralVolumes, b.structuralConnectors).size !==
    volumes.size
  )
    errors.push("Unconnected major structure");
  for (const v of volumes.values()) {
    if (b.generatorVersion === "1.5") {
      if (
        !v.shape ||
        !SHAPE_KINDS.includes(v.shape.kind) ||
        Math.min(v.shape.width, v.shape.height, v.shape.length) <= 0
      )
        errors.push(`Invalid shape ${v.id}`);
      else if (
        JSON.stringify(shapeStations(v.shape)) !==
        JSON.stringify(v.geometry.stations)
      )
        errors.push(`Shape cache mismatch ${v.id}`);
      if (!v.hierarchyTier || v.hierarchyTier < 1 || v.hierarchyTier > 3)
        errors.push(`Invalid hierarchy ${v.id}`);
      if (
        v.type === "SPINE" &&
        v.dimensions.z / Math.min(v.dimensions.x, v.dimensions.y) > 17
      )
        errors.push(`Spine slenderness ${v.id}`);
    }
    if (
      Math.min(v.dimensions.x, v.dimensions.y) < l * 0.015 ||
      v.dimensions.z < l * 0.04
    )
      errors.push(`Too thin structure ${v.id}`);
    if (
      v.geometry.stations.length < 5 ||
      v.geometry.stations.length > 12 ||
      v.geometry.stations.some(
        (s, i) =>
          s.width <= 0 ||
          s.height <= 0 ||
          (i > 0 && s.z <= v.geometry.stations[i - 1].z),
      )
    )
      errors.push(`Volume geometry ${v.id}`);
    if (Object.values(v.rotation).some((r) => r !== 0))
      errors.push("Unsupported volume rotation");
    if (
      v.connectionIds.some(
        (id) =>
          !b.structuralConnectors.some(
            (c) =>
              c.id === id &&
              (c.fromStructureId === v.id || c.toStructureId === v.id),
          ),
      )
    )
      errors.push("Volume connection references");
  }
  for (const c of b.structuralConnectors) {
    if (
      b.generatorVersion === "1.5" &&
      (!c.join ||
        !JOIN_TYPES.includes(c.join.type) ||
        Math.min(c.join.width, c.join.height, c.join.length) <= 0)
    )
      errors.push(`Invalid join ${c.id}`);
    const a = volumes.get(c.fromStructureId),
      d = volumes.get(c.toStructureId);
    if (!a || !d || a === d) {
      errors.push(`Invalid connector references ${c.id}`);
      continue;
    }
    if (
      !containsVolume(a, c.start, l * 0.001) ||
      !containsVolume(d, c.end, l * 0.001)
    )
      errors.push(`Connector endpoint detached ${c.id}`);
    if (
      c.thickness < l * 0.008 ||
      !a.connectionIds.includes(c.id) ||
      !d.connectionIds.includes(c.id)
    )
      errors.push(`Invalid connector ${c.id}`);
    if (
      c.join?.type === "TRUSS" &&
      c.thickness <
        Math.min(
          a.dimensions.x,
          a.dimensions.y,
          d.dimensions.x,
          d.dimensions.y,
        ) *
          0.35
    )
      errors.push(`Undersized truss ${c.id}`);
    const gap = Math.hypot(
      c.end.x - c.start.x,
      c.end.y - c.start.y,
      c.end.z - c.start.z,
    );
    if ((!c.join && gap < l * 0.002) || gap > l * 0.9)
      errors.push(`Invalid structural gap ${c.id}`);
  }
  const list = [...volumes.values()];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = volumeBounds([list[i]]),
        d = volumeBounds([list[j]]);
      const overlap = ["x", "y", "z"].reduce((v, k) => {
        const axis = k as "x" | "y" | "z";
        return (
          v *
          Math.max(
            0,
            Math.min(a.max[axis], d.max[axis]) -
              Math.max(a.min[axis], d.min[axis]),
          )
        );
      }, 1);
      const smaller = Math.min(
        ...[list[i], list[j]].map(
          (v) => v.dimensions.x * v.dimensions.y * v.dimensions.z,
        ),
      );
      const intentional = b.structuralConnectors.some(
        (c) =>
          ((c.fromStructureId === list[i].id &&
            c.toStructureId === list[j].id) ||
            (c.fromStructureId === list[j].id &&
              c.toStructureId === list[i].id)) &&
          c.join &&
          c.join.type !== "TRUSS" &&
          c.join.type !== "BOOM",
      );
      if (overlap / smaller > (intentional ? 0.55 : 0.12))
        errors.push(`Overlapping major volumes ${list[i].id}/${list[j].id}`);
    }
  for (const e of b.engines) {
    const v = volumes.get(e.parentId);
    if (
      !v ||
      e.nozzleRadius <= 0 ||
      e.nozzleLength <= 0 ||
      !containsVolume(v, e.position, l * 0.001) ||
      Math.abs(e.position.z - v.position.z - v.geometry.stations.at(-1)!.z) >
        l * 0.001
    )
      errors.push(`Detached engine ${e.id}`);
    if (e.direction?.x !== 0 || e.direction.y !== 0 || e.direction.z !== 1)
      errors.push("Engine rear direction");
  }
  if (![1, 2, 4, 6].includes(b.engines.length)) errors.push("Engine count");
  for (const h of b.hardpoints) {
    const v = volumes.get(h.parentId);
    if (!v) {
      errors.push(`Hardpoint parent ${h.id}`);
      continue;
    }
    if (
      !HARDPOINT_TYPES.includes(h.type) ||
      h.radius <= 0 ||
      Math.abs(Math.hypot(h.normal.x, h.normal.y, h.normal.z) - 1) > 0.001
    )
      errors.push(`Invalid hardpoint ${h.id}`);
    if (h.type === "Spinal") {
      if (
        Math.abs(h.position.x) > l * 0.001 ||
        h.normal.z !== -1 ||
        Math.abs(h.position.z - v.position.z - v.geometry.stations[0].z) >
          l * 0.001
      )
        errors.push("Spinal alignment");
    } else {
      const localZ = h.position.z - v.position.z,
        localX = h.position.x - v.position.x,
        s = hullSurfaceAt(v.geometry.stations, localZ, localX);
      try {
        const exposed = exposedVolumeSurface(
          b.structuralVolumes,
          h.position.x,
          h.position.z,
        );
        if (
          !containsVolume(v, h.position, l * 0.002) ||
          Math.abs(h.position.y - v.position.y - s.y) > l * 0.002 ||
          exposed.parentId !== h.parentId
        )
          errors.push(`Detached hardpoint ${h.id}`);
      } catch {
        errors.push(`Detached hardpoint ${h.id}`);
      }
    }
  }
  if (b.hardpoints.length < 3 || b.hardpoints.length > 100)
    errors.push("Hardpoint count");
  if (b.surfaceFeatures.some((f) => !volumes.has(f.parentId)))
    errors.push("Surface parent");
  const d = b.dimensions;
  if (
    d.length < l * 0.99 ||
    d.length > l * 1.25 ||
    d.width < l * 0.06 ||
    d.width > l * 1.3 ||
    d.height < l * 0.015 ||
    d.height > l * 0.7 ||
    d.estimatedMass <= 0
  )
    errors.push("Overall dimensions");
  errors.push(...validateSilhouette(b.order, b.silhouette));
  return errors;
}
export function validateBlueprint(b: AnyShipBlueprint) {
  return b.schemaVersion === 1 ? validateV0(b) : validateArchitecture(b);
}
