import {validateExteriorDetails} from '../generation/details/validate';
import{validateProduction}from'../generation/production/validate';
import { validateStructuralArmorPilot } from "../generation/armor/structural-pilot/validate";
import { validateLayeredArmor } from "./armor";
import { validateMacro } from "./macro";
import { validateIntegration } from "./integration";
import type { AnyShipBlueprint, ShipBlueprint } from "../blueprint/types";
import { ARCHITECTURES, HARDPOINT_TYPES } from "../blueprint/types";
import { validateBlueprint as validateV0 } from "./legacy";
import {
  containsVolume,
  volumeBounds,
  exposedVolumeSurface,
} from "../generation/architecture/volumes";
import {validateWeaponLayout} from "../generation/weapons/validate";
import {validateFunctionalExterior} from "../generation/functional/validate";
import {stationCacheEqual} from "./station-cache";
import { shapeStations } from "../generation/shapes/definition";
import { SHAPE_KINDS, JOIN_TYPES } from "../blueprint/types";
import { hullSurfaceAt } from "../generation/hull";
import { connectedIds, validateSilhouette } from "./silhouette";
import { PREFAB_LIBRARY } from "../generation/prefabs";
import { PREFAB_KINDS } from "../blueprint/types";
function finite(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(finite);
  if (v && typeof v === "object") return Object.values(v).every(finite);
  return true;
}
export interface ValidationDetails {weapon?:ReturnType<typeof validateWeaponLayout>;production?:ReturnType<typeof validateProduction>}
export function validateArchitecture(b: ShipBlueprint,details?:ValidationDetails) {
  const errors: string[] = [],
    l = b.order.length,
    volumes = new Map(b.structuralVolumes.map((v) => [v.id, v]));
  if (!finite(b)) return ["Invalid numeric value"];
  errors.push(...validateExteriorDetails(b));
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
    if (
      b.generatorVersion === "1.5" ||
      b.generatorVersion === "1.6" ||
      b.generatorVersion === "1.7" ||
      (b.generatorVersion === "1.8" || (b.generatorVersion === "1.8.1" || (b.generatorVersion === "1.8.2" || (b.generatorVersion === "1.8.3" || (b.generatorVersion === "1.8.4" || b.generatorVersion === "1.8.5")))))
    ) {
      if (
        !v.shape ||
        !SHAPE_KINDS.includes(v.shape.kind) ||
        Math.min(v.shape.width, v.shape.height, v.shape.length) <= 0
      )
        errors.push(`Invalid shape ${v.id}`);
      else if (
        !stationCacheEqual(shapeStations(v.shape),v.geometry.stations)
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
      (b.generatorVersion === "1.5" ||
        b.generatorVersion === "1.6" ||
        b.generatorVersion === "1.7" ||
        (b.generatorVersion === "1.8" || (b.generatorVersion === "1.8.1" || (b.generatorVersion === "1.8.2" || (b.generatorVersion === "1.8.3" || (b.generatorVersion === "1.8.4" || b.generatorVersion === "1.8.5")))))) &&
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
    } else if (!h.plannedMountId && !h.surfaceMount && !b.structuralArmorPilot?.mounts.some(m => m.hardpointId === h.id)) {
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
  if (b.hardpoints.length < (b.productionDesign ? 1 : 3) || b.hardpoints.length > 100)
    errors.push("Hardpoint count");
  if (b.surfaceFeatures.some((f) => !volumes.has(f.parentId)))
    errors.push("Surface parent");
  if (b.generatorVersion === "1.6" && !Array.isArray(b.prefabPlacements))
    errors.push("Missing kitbash placements");
  const prefabs = b.prefabPlacements ?? [];
  if (
    prefabs.length > 128 ||
    new Set(prefabs.map((p) => p.id)).size !== prefabs.length
  )
    errors.push("Invalid prefab count or duplicate ID");
  for (const p of prefabs) {
    if (
      !PREFAB_KINDS.includes(p.kind) ||
      !PREFAB_LIBRARY[p.kind] ||
      p.socket.kind !== PREFAB_LIBRARY[p.kind].socketKind ||
      p.functionality !== PREFAB_LIBRARY[p.kind].functionality ||
      !Number.isInteger(p.variant) ||
      p.variant < 0 ||
      p.variant > 2 ||
      Math.min(p.dimensions.x, p.dimensions.y, p.dimensions.z) <= 0 ||
      Math.abs(
        Math.hypot(p.socket.normal.x, p.socket.normal.y, p.socket.normal.z) - 1,
      ) > 0.001
    ) {
      errors.push("Invalid prefab " + p.id);
      continue;
    }
    if(p.assembly){
      if(!b.functionalExterior?.prefabIds.includes(p.id)&&!b.weaponLayout?.prefabIds.includes(p.id)&&!b.productionDesign?.functionalPrefabIds.includes(p.id))errors.push("Unreferenced functional assembly " + p.id);
      continue;
    }
    if (p.socket.kind === "HULL_SIDE" || p.socket.kind === "HULL_FACE") {
      const v = volumes.get(p.socket.hostId);
      if (!v || !containsVolume(v, p.socket.position, l * 0.003)) {
        errors.push("Detached prefab " + p.id);
      }
    } else {
      const c = b.structuralConnectors.find((c) => c.id === p.socket.hostId);
      if (
        !c ||
        Math.min(
          Math.hypot(
            p.socket.position.x - c.start.x,
            p.socket.position.y - c.start.y,
            p.socket.position.z - c.start.z,
          ),
          Math.hypot(
            p.socket.position.x - c.end.x,
            p.socket.position.y - c.end.y,
            p.socket.position.z - c.end.z,
          ),
        ) >
          l * 0.003
      )
        errors.push("Detached prefab " + p.id);
    }
  }
  if (b.generatorVersion === "1.7" || (b.generatorVersion === "1.8" || (b.generatorVersion === "1.8.1" || (b.generatorVersion === "1.8.2" || (b.generatorVersion === "1.8.3" || (b.generatorVersion === "1.8.4" || b.generatorVersion === "1.8.5"))))))
    errors.push(...validateIntegration(b));
  if(b.weaponLayout){const result=validateWeaponLayout(b);if(details)details.weapon=result;errors.push(...result.issues);}
  if(b.functionalExterior)errors.push(...validateFunctionalExterior(b).issues);
  if (b.structuralArmorPilot) errors.push(...validateStructuralArmorPilot(b).issues);
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
  errors.push(
    ...validateSilhouette(b.order, b.silhouette, b.macroDesign?.family),
  );
  if ((b.generatorVersion === "1.8" || (b.generatorVersion === "1.8.1" || (b.generatorVersion === "1.8.2" || (b.generatorVersion === "1.8.3" || (b.generatorVersion === "1.8.4" || b.generatorVersion === "1.8.5")))))) errors.push(...validateMacro(b));
  errors.push(...validateLayeredArmor(b));
  if(b.productionDesign){const result=validateProduction(b);if(details)details.production=result;errors.push(...result.issues);}
  return errors;
}
export function validateBlueprint(b: AnyShipBlueprint,details?:ValidationDetails) {
  return b.schemaVersion === 1 ? validateV0(b) : validateArchitecture(b,details);
}
