import type { ShipBlueprint, Vec3 } from "../blueprint/types";
import type { PanelSolid } from "../generation/armor/types";
import {
  solidTriangles,
  normal,
  solidFromRings,
  area,
} from "../generation/armor/panels";
import {
  add,
  sub,
  mul,
  dot,
  center,
  boundsOf,
} from "../generation/integration/contours";
import { profileRing } from "../generation/hull";
import { solidVolume } from "../generation/production/doctrine";
import { boundsIndex } from "../generation/hardpoint-system/geometry";
import {
  tetra,
  cellBounds,
  cellVolume,
  subtractCell,
  solidCell,
  planes,
  subtractPolygon,
} from "./convex";
import type { ConvexCell, ProtectionSurface } from "./types";
export interface PhysicalSource {
  id: string;
  kind: "HULL" | "ARMOR";
  sourceKind: ProtectionSurface["geometryReference"]["sourceKind"];
  parent: string;
  zone: ProtectionSurface["protectionZoneId"];
  solid: PanelSolid;
  triangles: Vec3[][];
  kernels: Vec3[];
  capacityMm: number[];
  cells: { cell: ConvexCell; bounds: ReturnType<typeof cellBounds> }[];
  areaM2: number;
  approximation?: string;
}
function oriented(s: PanelSolid) {
  let volume = solidTriangles(s).reduce(
    (v, [a, b, c]) =>
      v +
      dot(a, {
        x: b.y * c.z - b.z * c.y,
        y: b.z * c.x - b.x * c.z,
        z: b.x * c.y - b.y * c.x,
      }) /
        6,
    0,
  );
  if (volume < 0)
    return {
      ...s,
      indices: s.indices.flatMap((_, i, all) =>
        i % 3 === 0 ? [all[i], all[i + 2], all[i + 1]] : [],
      ),
    };
  return s;
}
function kernel(s: PanelSolid): Vec3 | undefined {
  const ts = solidTriangles(s).filter((t) => area(t) > 1e-10),
    ps = ts.map((t) => ({ n: normal(t), p: t[0] }));
  let k = center(s.vertices);
  for (let pass = 0; pass < 80; pass++) {
    let violation = 0;
    for (const p of ps) {
      const v = dot(p.n, sub(k, p.p));
      if (v > -1e-7) {
        k = sub(k, mul(p.n, v + 1e-6));
        violation = Math.max(violation, v);
      }
    }
    if (violation < 1e-8) break;
  }
  if (!ps.every((p) => dot(p.n, sub(k, p.p)) < -1e-9)) return;
  const sum = ts.reduce((n, [a, b, c]) => n + cellVolume(tetra(a, b, c, k)), 0),
    v = solidVolume(s);
  return Math.abs(sum - v) < Math.max(1e-5, v * 1e-7) ? k : undefined;
}
export function sourceGeometry(
  id: string,
  kind: "HULL" | "ARMOR",
  sourceKind: PhysicalSource["sourceKind"],
  parent: string,
  zone: PhysicalSource["zone"],
  solid: PanelSolid,
  rings?: Vec3[][],
): PhysicalSource {
  if (
    solid.vertices.some((p) => ![p.x, p.y, p.z].every(Number.isFinite)) ||
    solid.indices.length % 3 ||
    solid.indices.some(
      (i) => !Number.isInteger(i) || i < 0 || i >= solid.vertices.length,
    )
  )
    throw Error("INVALID_PHYSICAL_SOURCE " + id);
  const source = oriented(solid),
    triangles = solidTriangles(source),
    whole = kernel(source);
  if (!rings) {
    const n = Math.max(...source.indices.slice(0, 3));
    if (n >= 3 && source.vertices.length % n === 0)
      rings = Array.from({ length: source.vertices.length / n }, (_, j) =>
        source.vertices.slice(j * n, (j + 1) * n),
      );
  }
  let cells: { solid: PanelSolid; k: Vec3 }[], kernels: Vec3[];
  let approximation: string | undefined;
  try {
    if (whole && (!rings || rings.length === 2)) {
      cells = [{ solid: source, k: whole }];
      kernels = triangles.map(() => whole);
    } else {
      if (
        !rings ||
        JSON.stringify(rings.flat()) !== JSON.stringify(source.vertices)
      ) {
        const n = rings?.[0].length ?? Math.max(...source.indices.slice(0, 3));
        if (n >= 3 && source.vertices.length % n === 0)
          rings = Array.from({ length: source.vertices.length / n }, (_, j) =>
            source.vertices.slice(j * n, (j + 1) * n),
          );
      }
      if (
        !rings ||
        rings.length < 2 ||
        JSON.stringify(rings.flat()) !== JSON.stringify(source.vertices)
      )
        throw Error("PHYSICAL_SOURCE_KERNEL_UNAVAILABLE " + id);
      cells = rings.slice(1).map((r, j) => {
        const s = oriented(solidFromRings([rings![j], r])),
          k = kernel(s);
        if (!k)
          throw Error("PHYSICAL_SECTION_KERNEL_UNAVAILABLE " + id + "/" + j);
        return { solid: s, k };
      });
      const n = rings[0].length,
        sideCount = (rings.length - 1) * n * 2;
      kernels = triangles.map(
        (_, i) =>
          cells[
            i < sideCount
              ? Math.floor(i / (n * 2))
              : (i - sideCount) % 2 === 0
                ? 0
                : cells.length - 1
          ].k,
      );
      const sum = cells.reduce((v, c) => v + solidVolume(c.solid), 0);
      if (Math.abs(sum - solidVolume(source)) > Math.max(1e-4, sum * 1e-6))
        throw Error("PHYSICAL_SECTION_VOLUME_MISMATCH " + id);
    }
  } catch (e) {
    if (whole) {
      cells = [{ solid: source, k: whole }];
      kernels = triangles.map(() => whole);
    } else {
      // Do not register the failed legacy closed body. Its finite nondegenerate render facets
      // become separate, checked triangle skins; cap normal follows the actual station end.
      cells = [];
      kernels = triangles.map((t) => sub(center(t), mul(normal(t), 10)));
      approximation =
        String(e) +
        "; enclosing body unregistered; bounded local triangle skins only, cap-fan overlap removed by convex subtraction";
      const zs = source.vertices.map((p) => p.z),
        zmin = Math.min(...zs),
        zmax = Math.max(...zs);
      for (const t of triangles)
        if (t.every((p) => Math.abs(p.z - t[0].z) < 1e-7)) {
          if (
            (Math.abs(t[0].z - zmin) < 1e-7 && normal(t).z > 0) ||
            (Math.abs(t[0].z - zmax) < 1e-7 && normal(t).z < 0)
          )
            t.reverse();
        }
    }
  }
  const fullCells = cells.flatMap((c) => {
    const convex = solidCell(c.solid),
      vs = c.solid.vertices;
    if (planes(convex).every((p) => vs.every((v) => dot(p.n, v) <= p.d + 1e-7)))
      return [{ cell: convex, bounds: cellBounds(convex) }];
    return solidTriangles(c.solid)
      .filter((t) => area(t) > 1e-10)
      .map(([a, b, d]) => {
        const cell = tetra(a, b, d, c.k);
        return { cell, bounds: cellBounds(cell) };
      });
  });
  return {
    id,
    kind,
    sourceKind,
    parent,
    zone,
    solid: source,
    triangles,
    kernels,
    approximation,
    capacityMm: triangles.map((t, i) =>
      approximation
        ? 1000
        : Math.max(0, dot(normal(t), sub(t[0], kernels[i])) * 1000 * 0.8),
    ),
    cells: fullCells,
    areaM2: triangles.reduce((n, t) => n + area(t), 0),
  };
}
const cache = new WeakMap<
  ShipBlueprint,
  { key: string; sources: PhysicalSource[] }
>();
const geometryCache = new Map<string, PhysicalSource[]>();
/** Existing rendered solids are the authority. No hull/armor regeneration or free-mount changes. */
export function physicalSources(b: ShipBlueprint): PhysicalSource[] {
  const key = JSON.stringify([
      b.structuralVolumes,
      b.productionDesign?.armor ?? b.structuralArmorPilot?.components,
      b.productionDesign?.finish,
    ]),
    found = cache.get(b);
  if (found?.key === key) return found.sources;
  const reused = geometryCache.get(key);
  if (reused) {
    cache.set(b, { key, sources: reused });
    return reused;
  }
  const sources: PhysicalSource[] = [];
  for (const v of b.structuralVolumes.filter((v) => v.type !== "SPINE")) {
    if (Object.values(v.rotation).some((n) => Math.abs(n) > 1e-9))
      throw Error("LOCAL_VOLUME_ROTATION_REQUIRES_EXPLICIT_GEOMETRY " + v.id);
    const rings = v.geometry.stations.map((s) =>
      profileRing(s)
        .reverse()
        .map(([x, y]) => ({
          x: x + v.position.x,
          y: y + v.position.y,
          z: s.z + v.position.z,
        })),
    );
    sources.push(
      sourceGeometry(
        v.id,
        "HULL",
        "HULL_VOLUME",
        v.id,
        "SHELL",
        solidFromRings(rings),
        rings,
      ),
    );
  }
  for (const c of b.productionDesign?.armor ??
    b.structuralArmorPilot?.components ??
    [])
    sources.push(
      sourceGeometry(
        c.id,
        "ARMOR",
        "PRODUCTION_ARMOR",
        c.parentStructureId,
        [
          "CITADEL",
          "COMMAND_PLINTH",
          "AXIAL_PROTECTION",
          "BELLY_CITADEL",
        ].includes(c.role)
          ? "CRITICAL"
          : "SECONDARY",
        c.solid,
        c.rings,
      ),
    );
  for (const c of b.productionDesign?.finish ?? [])
    sources.push(
      sourceGeometry(
        c.id,
        "ARMOR",
        "PRODUCTION_FINISH",
        c.parentStructureId,
        "SECONDARY",
        c.solid,
      ),
    );
  if (new Set(sources.map((s) => s.id)).size !== sources.length)
    throw Error("DUPLICATE_PHYSICAL_SOURCE");
  cache.set(b, { key, sources });
  if (geometryCache.size >= 4)
    geometryCache.delete(geometryCache.keys().next().value!);
  geometryCache.set(key, sources);
  return sources;
}
/** Remove buried armor and structural contacts using finite original source volumes. */
export function sourceExclusions(sources: PhysicalSource[]) {
  const facePlanes = new Map(
    sources.map((s) => [
      s.id,
      s.triangles
        .filter((t) => area(t) > 1e-10)
        .map((t) => {
          const n = normal(t);
          return { n, d: dot(n, t[0]) };
        }),
    ]),
  );
  const cells = sources.flatMap((source, order) =>
      source.cells.map((c) => ({ ...c, source, order })),
    ),
    query = boundsIndex(cells),
    order = new Map(sources.map((s, i) => [s.id, i]));
  return (candidate: ConvexCell, source: PhysicalSource, outer: Vec3[]) => {
    let pieces = [candidate];
    const coincidentCache = new Map<string, boolean>(),
      n = normal(outer),
      d = dot(n, outer[0]);
    for (const other of query(cellBounds(candidate))) {
      if (
        other.source.id === source.id ||
        source.kind !== "ARMOR" ||
        other.source.kind !== "HULL"
      )
        continue;
      // Stable ownership of coincident outward surfaces avoids removing both coatings.
      let coincident = coincidentCache.get(other.source.id);
      if (coincident === undefined) {
        coincident = facePlanes
          .get(other.source.id)!
          .some((p) => dot(p.n, n) > 0.999999 && Math.abs(p.d - d) < 1e-7);
        coincidentCache.set(other.source.id, coincident);
      }
      if (coincident && other.order > order.get(source.id)!) continue;
      pieces = pieces.flatMap((p) => subtractCell(p, other.cell));
      if (pieces.length > 256)
        throw Error("PHYSICAL_FRAGMENT_LIMIT " + source.id);
      if (!pieces.length) break;
    }
    return pieces;
  };
}

const exposedCache = new WeakMap<PhysicalSource, Map<number, Vec3[][]>>();
export function exposedFacetPolygons(sources: PhysicalSource[]) {
  const cells = sources.flatMap((source, order) =>
      source.cells.map((c) => ({ ...c, source, order })),
    ),
    query = boundsIndex(cells),
    orders = new Map(sources.map((s, i) => [s.id, i])),
    facePlanes = new Map(
      sources.map((s) => [
        s.id,
        s.triangles
          .filter((t) => area(t) > 1e-10)
          .map((t) => {
            const n = normal(t);
            return { n, d: dot(n, t[0]) };
          }),
      ]),
    );
  return (source: PhysicalSource, index: number) => {
    let cache = exposedCache.get(source);
    if (!cache) {
      cache = new Map();
      exposedCache.set(source, cache);
    }
    const found = cache.get(index);
    if (found) return found;
    const tri = source.triangles[index],
      n = normal(tri),
      d = dot(n, tri[0]);
    let polys = [tri];
    const coincidentCache = new Map<string, boolean>();
    for (const other of query(boundsOf(tri))) {
      if (
        other.source.id === source.id ||
        (source.kind === "HULL" && other.source.kind === "ARMOR")
      )
        continue;
      let coincident = coincidentCache.get(other.source.id);
      if (coincident === undefined) {
        coincident = facePlanes
          .get(other.source.id)!
          .some((p) => dot(p.n, n) > 0.999999 && Math.abs(p.d - d) < 1e-7);
        coincidentCache.set(other.source.id, coincident);
      }
      if (coincident && other.order > orders.get(source.id)!) continue;
      polys = polys.flatMap((p) => subtractPolygon(p, other.cell));
      if (polys.length > 128)
        throw Error("PHYSICAL_FACE_FRAGMENT_LIMIT " + source.id);
      if (!polys.length) break;
    }
    cache.set(index, polys);
    return polys;
  };
}
const localPlaneCache = new WeakMap<
  PhysicalSource,
  { n: Vec3; d: number }[][]
>();
/** Local convex supporting planes retain the finite rendered boundary without tetrahedralizing
 * the entire skin. Nonconvex interiors remain an explicitly declared faceted-shell approximation. */
export function facetSupportPlanes(source: PhysicalSource, index: number) {
  let cached = localPlaneCache.get(source);
  if (!cached) {
    const adjacency = new Map<Vec3, number[]>();
    source.triangles.forEach((t, i) =>
      t.forEach((p) => {
        const ids = adjacency.get(p) ?? [];
        ids.push(i);
        adjacency.set(p, ids);
      }),
    );
    const global = source.triangles
      .filter((t) => area(t) > 1e-10)
      .map((t) => ({ n: normal(t), d: dot(normal(t), t[0]) }))
      .filter((p) =>
        source.solid.vertices.every((v) => dot(p.n, v) <= p.d + 1e-7),
      );
    cached = source.triangles.map((tri, i) => {
      const neighbors = new Set(tri.flatMap((p) => adjacency.get(p) ?? [])),
        ps = [...global];
      for (const j of neighbors) {
        const t = source.triangles[j];
        if (
          j === i ||
          area(t) < 1e-10 ||
          t.filter((p) => tri.includes(p)).length < 2
        )
          continue;
        const n = normal(t),
          d = dot(n, t[0]);
        if (tri.every((p) => dot(n, p) <= d + 1e-7)) ps.push({ n, d });
      }
      return ps.filter(
        (p, i) =>
          !ps
            .slice(0, i)
            .some(
              (q) =>
                Math.hypot(...Object.values(sub(p.n, q.n))) < 1e-9 &&
                Math.abs(p.d - q.d) < 1e-7,
            ),
      );
    });
    localPlaneCache.set(source, cached);
  }
  return cached[index];
}
