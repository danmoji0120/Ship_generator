import { pieceLayers } from "./layers";
import { cross } from "../generation/armor/panels";
import { Vector3, Quaternion } from "three";
import type { ShipBlueprint, Vec3 } from "../blueprint/types";
import type { PhysicalDesign } from "./types";
import { EPS, solidCell, cellBounds, rayCell } from "./convex";
import { boundsIndex } from "../generation/hardpoint-system/geometry";
import { add, mul, dot, boundsOf } from "../generation/integration/contours";
export interface ShipRigidTransform {
  position: Vec3;
  quaternion: { x: number; y: number; z: number; w: number };
}
export interface ProbeHit {
  surfaceId: string;
  plateId?: string;
  shellId?: string;
  materialId: string;
  constituentMaterialId: string;
  layerId: string;
  layerOrder: number;
  nominalLayerThicknessMm: number;
  localFacetLayerThicknessMm: number;
  measuredNormalThicknessMm: number;
  pathLengthM: number;
  entryPoint: Vec3;
  exitPoint: Vec3;
  entryDistanceM: number;
  exitDistanceM: number;
  incidenceDegrees: number | null;
  surfaceNormal: Vec3;
  entryBoundaryNormal: Vec3 | null;
  isArmorLayer: boolean;
  coveredByArmor: boolean;
}
const cache = new WeakMap<PhysicalDesign, ReturnType<typeof makeIndex>>();
function makeIndex(d: PhysicalDesign) {
  const parts = d.surfaces.flatMap((surface) =>
    surface.pieces.flatMap((p) =>
      pieceLayers(surface, p).map((part) => ({
        cell: part.cell,
        bounds: cellBounds(part.cell),
        surface,
        p: { ...p, layerOrder: part.layerOrder },
      })),
    ),
  );
  return boundsIndex(parts);
}
const xyz = (v: Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z });
/** The equipment index deliberately excludes touching AABBs. A ray can lie on an
 * internal partition boundary, so pad only its search box. Actual cells and exact
 * entry/exit checks stay unchanged; no armor is added to gaps. */
const rayBounds = (points: Vec3[]) => {
  const bounds = boundsOf(points);
  for (const axis of ["x", "y", "z"] as const) {
    bounds.min[axis] -= EPS;
    bounds.max[axis] += EPS;
  }
  return bounds;
};
export function armorRayProbe(
  b: ShipBlueprint,
  rayOrigin: Vec3,
  rayDirection: Vec3,
  maxDistance: number,
  transform?: ShipRigidTransform,
) {
  const invalid = (reason: string) => ({
    valid: false,
    exactForStoredCells: false,
    approximation: "",
    warnings: [reason],
    hits: [] as ProbeHit[],
  });
  if (!b.physicalDesign)
    return invalid(
      "PHYSICAL_DATA_ABSENT: explicit migration or regeneration required",
    );
  if (
    ![
      rayOrigin.x,
      rayOrigin.y,
      rayOrigin.z,
      rayDirection.x,
      rayDirection.y,
      rayDirection.z,
      maxDistance,
    ].every(Number.isFinite) ||
    maxDistance <= 0 ||
    Math.hypot(rayDirection.x, rayDirection.y, rayDirection.z) < 1e-12
  )
    return invalid("INVALID_PROBE_RAY");
  const rotation = new Quaternion(),
    translation = new Vector3();
  if (transform) {
    const q = transform.quaternion,
      p = transform.position;
    if (
      ![q.x, q.y, q.z, q.w, p.x, p.y, p.z].every(Number.isFinite) ||
      Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) > 1e-6
    )
      return invalid("INVALID_RIGID_SHIP_TRANSFORM");
    rotation.set(q.x, q.y, q.z, q.w);
    translation.set(p.x, p.y, p.z);
  }
  const inverse = rotation.clone().invert(),
    o = xyz(
      new Vector3(rayOrigin.x, rayOrigin.y, rayOrigin.z)
        .sub(translation)
        .applyQuaternion(inverse),
    ),
    dir = xyz(
      new Vector3(rayDirection.x, rayDirection.y, rayDirection.z)
        .normalize()
        .applyQuaternion(inverse),
    );
  const d = b.physicalDesign;
  let query = cache.get(d);
  if (!query) {
    query = makeIndex(d);
    cache.set(d, query);
  }
  const toWorld = (p: Vec3) =>
    xyz(new Vector3(p.x, p.y, p.z).applyQuaternion(rotation).add(translation));
  const toNormal = (p: Vec3) =>
    xyz(new Vector3(p.x, p.y, p.z).applyQuaternion(rotation));
  const hits: ProbeHit[] = [];
  for (const { cell, surface, p } of query(
    rayBounds([o, add(o, mul(dir, maxDistance))]),
  )) {
    const r = rayCell(cell, o, dir, maxDistance);
    if (!r) continue;
    const l = surface.layerStack[p.layerOrder],
      f = surface.facets[p.facetIndex];
    const localEntry = add(o, mul(dir, r.entry)),
      span = surface.thicknessMm / 1000 + 0.01,
      normalOrigin = add(localEntry, mul(f.normal, span)),
      normalDirection = mul(f.normal, -1),
      normalIntervals: { entry: number; exit: number }[] = [];
    for (const candidate of query(
      rayBounds([
        normalOrigin,
        add(normalOrigin, mul(normalDirection, span * 2)),
      ]),
    ))
      if (
        candidate.surface.id === surface.id &&
        candidate.p.layerOrder === p.layerOrder &&
        candidate.p.facetIndex === p.facetIndex
      ) {
        const interval = rayCell(
          candidate.cell,
          normalOrigin,
          normalDirection,
          span * 2,
        );
        if (interval) normalIntervals.push(interval);
      }
    normalIntervals.sort((a, b) => a.entry - b.entry);
    let normalLength = 0,
      lastExit = -Infinity;
    for (const interval of normalIntervals) {
      normalLength += Math.max(
        0,
        interval.exit - Math.max(interval.entry, lastExit),
      );
      lastExit = Math.max(lastExit, interval.exit);
    }
    hits.push({
      surfaceId: surface.id,
      ...(surface.kind === "ARMOR"
        ? { plateId: surface.id }
        : { shellId: surface.id }),
      materialId: surface.materialId,
      constituentMaterialId: l.constituentMaterialId,
      layerId: surface.id + "/" + l.layerId,
      layerOrder: l.layerOrder,
      nominalLayerThicknessMm: l.thicknessMm,
      measuredNormalThicknessMm: normalLength * 1000,
      localFacetLayerThicknessMm:
        (l.thicknessMm * f.thicknessMm) / surface.thicknessMm,
      pathLengthM: r.exit - r.entry,
      entryPoint: toWorld(add(o, mul(dir, r.entry))),
      exitPoint: toWorld(add(o, mul(dir, r.exit))),
      entryDistanceM: r.entry,
      exitDistanceM: r.exit,
      incidenceDegrees: r.entryNormal
        ? (Math.atan2(
            Math.hypot(...Object.values(cross(r.entryNormal, dir))),
            Math.abs(dot(r.entryNormal, dir)),
          ) *
            180) /
          Math.PI
        : null,
      surfaceNormal: toNormal(f.normal),
      entryBoundaryNormal: r.entryNormal ? toNormal(r.entryNormal) : null,
      isArmorLayer: surface.kind === "ARMOR",
      coveredByArmor: surface.kind === "ARMOR",
    });
  }
  // Same-layer internal cell boundaries are not additional material. Keep disconnected intervals separate.
  const groups = new Map<string, ProbeHit[]>();
  for (const hit of hits) {
    const g = groups.get(hit.layerId) ?? [];
    g.push(hit);
    groups.set(hit.layerId, g);
  }
  const merged: ProbeHit[] = [];
  for (const hs of groups.values()) {
    hs.sort((a, b) => a.entryDistanceM - b.entryDistanceM);
    let current: ProbeHit | undefined;
    for (const h of hs) {
      if (current && h.entryDistanceM <= current.exitDistanceM + 1e-7) {
        if (h.exitDistanceM > current.exitDistanceM) {
          current.exitDistanceM = h.exitDistanceM;
          current.exitPoint = h.exitPoint;
          current.pathLengthM = current.exitDistanceM - current.entryDistanceM;
        }
      } else {
        current = { ...h };
        merged.push(current);
      }
    }
  }
  merged.sort(
    (a, b) =>
      a.entryDistanceM - b.entryDistanceM || a.layerOrder - b.layerOrder,
  );
  for (const h of merged)
    if (!h.isArmorLayer)
      h.coveredByArmor = merged.some(
        (a) => a.isArmorLayer && a.exitDistanceM <= h.entryDistanceM + 1e-7,
      );
  const warnings = [d.approximation, ...d.warnings];
  if (merged.some((h) => h.incidenceDegrees === null))
    warnings.push(
      "START_INSIDE_LAYER: entry face and incidence angle undefined",
    );
  return {
    valid: true,
    exactForStoredCells: true,
    approximation: d.geometryModel,
    warnings,
    hits: merged,
  };
}
