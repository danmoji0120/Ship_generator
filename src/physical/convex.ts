import { Vector3 } from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";
import type { Vec3, BoundsData } from "../blueprint/types";
import type { PanelSolid } from "../generation/armor/types";
import type { ConvexCell } from "./types";
import {
  add,
  sub,
  mul,
  dot,
  unit,
  center,
  boundsOf,
  basis,
} from "../generation/integration/contours";
import { normal, area, cross, clipHalfSpace } from "../generation/armor/panels";
export const EPS = 1e-7;
/** Clipping may leave collinear edge vertices; the first three vertices do not define every face. */
export function faceNormal(f: Vec3[]) {
  if (f.length === 3) return normal(f);
  let best: Vec3 = { x: 0, y: 0, z: 0 },
    size = 0;
  for (let i = 1; i < f.length - 1; i++) {
    const n = cross(sub(f[i], f[0]), sub(f[i + 1], f[0])),
      s = dot(n, n);
    if (s > size) {
      size = s;
      best = n;
    }
  }
  return size > 1e-24 ? unit(best) : best;
}

export function orientCell(faces: Vec3[][]): ConvexCell {
  const c = center(faces.flat());
  return {
    faces: faces
      .filter((f) => area(f) > 1e-12)
      .map((f) =>
        dot(faceNormal(f), sub(center(f), c)) < 0 ? [...f].reverse() : f,
      ),
  };
}
const planeCache = new WeakMap<ConvexCell, { n: Vec3; d: number }[]>();
export const planes = (c: ConvexCell) => {
  let p = planeCache.get(c);
  if (!p) {
    p = [];
    for (const f of c.faces) {
      const n = faceNormal(f),
        d = dot(n, f[0]);
      if (
        !p.some(
          (q) =>
            Math.hypot(...Object.values(sub(n, q.n))) < 1e-9 &&
            Math.abs(d - q.d) < 1e-7,
        )
      )
        p.push({ n, d });
    }
    planeCache.set(c, p);
  }
  return p;
};
export const cellBounds = (c: ConvexCell) => boundsOf(c.faces.flat());
export const cellVolume = (c: ConvexCell) => {
  const p = center(c.faces.flat());
  return c.faces.reduce(
    (n, f) => n + (area(f) * Math.max(0, dot(faceNormal(f), sub(f[0], p)))) / 3,
    0,
  );
};
/** Remove redundant edge points within 0.1µm before triangulating a clipped planar face. */
export const cellSolid = (c: ConvexCell): PanelSolid => {
  const vertices: Vec3[] = [],
    indices: number[] = [];
  for (const face of c.faces) {
    const f = [...face];
    let changed = true;
    while (changed && f.length > 3) {
      changed = false;
      for (let i = 0; i < f.length; i++) {
        const p = f[(i + f.length - 1) % f.length],
          q = f[i],
          r = f[(i + 1) % f.length],
          v = sub(r, p),
          w = sub(q, p),
          len = Math.hypot(v.x, v.y, v.z);
        if (
          len > EPS &&
          Math.hypot(...Object.values(cross(v, w))) / len < EPS &&
          dot(w, v) >= -EPS &&
          dot(w, v) <= dot(v, v) + EPS
        ) {
          f.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
    if (area(f) < 1e-12) continue;
    const off = vertices.length;
    vertices.push(...f);
    for (let i = 1; i < f.length - 1; i++)
      if (area([f[0], f[i], f[i + 1]]) > 1e-12)
        indices.push(off, off + i, off + i + 1);
  }
  return { vertices, indices };
};
export const solidCell = (s: PanelSolid) =>
  orientCell(
    Array.from({ length: s.indices.length / 3 }, (_, i) =>
      s.indices.slice(i * 3, i * 3 + 3).map((k) => s.vertices[k]),
    ),
  );
function unique(ps: Vec3[], tolerance = EPS) {
  const out: Vec3[] = [];
  for (const p of ps)
    if (!out.some((q) => Math.hypot(...Object.values(sub(p, q))) < tolerance))
      out.push(p);
  return out;
}
export function clipCell(
  c: ConvexCell,
  n: Vec3,
  d: number,
  keepInside = true,
): ConvexCell | undefined {
  const nn = keepInside ? n : mul(n, -1),
    dd = keepInside ? d : -d,
    vs = c.faces.flat(),
    ds = vs.map((v) => dot(nn, v) - dd);
  if (ds.every((v) => v <= EPS)) return c;
  if (ds.every((v) => v >= -EPS)) return undefined;
  const faces: Vec3[][] = [],
    cut: Vec3[] = [];
  for (const f of c.faces) {
    const clipped = clipHalfSpace(f, nn, dd, false);
    if (clipped.length >= 3 && area(clipped) > 1e-12) faces.push(clipped);
    for (let i = 0; i < f.length; i++) {
      const a = f[i],
        b = f[(i + 1) % f.length],
        x = dot(nn, a) - dd,
        y = dot(nn, b) - dd;
      if (Math.abs(x) < EPS) cut.push(a);
      if (x * y < 0) cut.push(add(a, mul(sub(b, a), x / (x - y))));
    }
  }
  const ps = unique(cut);
  if (ps.length >= 3) {
    const ct = center(ps),
      { u, v } = basis(nn);
    ps.sort(
      (a, b) =>
        Math.atan2(dot(sub(a, ct), v), dot(sub(a, ct), u)) -
        Math.atan2(dot(sub(b, ct), v), dot(sub(b, ct), u)),
    );
    if (dot(faceNormal(ps), nn) < 0) ps.reverse();
    faces.push(ps);
  }
  if (faces.length < 4) return undefined;
  const out = orientCell(faces);
  return cellVolume(out) > 1e-10 ? out : undefined;
}
/** Exact convex partition of A minus B: every returned cell is disjoint. */
export function subtractCell(a: ConvexCell, b: ConvexCell): ConvexCell[] {
  const ps = planes(b),
    vs = a.faces.flat();
  if (ps.some((p) => vs.every((v) => dot(p.n, v) - p.d >= -EPS))) return [a];
  let intersection: ConvexCell | undefined = a;
  for (const p of ps) {
    if (!intersection) break;
    intersection = clipCell(intersection, p.n, p.d, true);
  }
  if (!intersection || cellVolume(intersection) < 1e-9) return [a];
  let remainder: ConvexCell | undefined = a;
  const out: ConvexCell[] = [];
  for (const p of ps) {
    if (!remainder) break;
    const outside = clipCell(remainder, p.n, p.d, false);
    if (outside) out.push(outside);
    remainder = clipCell(remainder, p.n, p.d, true);
  }
  return out;
}
export function tetra(a: Vec3, b: Vec3, c: Vec3, k: Vec3) {
  return orientCell([
    [a, b, c],
    [k, b, a],
    [k, c, b],
    [k, a, c],
  ]);
}
/** Finite radial inset: outer triangle is identical to the rendered surface; no infinite plates. */
export function facetLayer(
  tri: Vec3[],
  kernel: Vec3,
  startM: number,
  endM: number,
) {
  const h = dot(normal(tri), sub(tri[0], kernel));
  if (h <= EPS || startM < 0 || endM <= startM || endM >= h)
    throw Error("INVALID_FACET_THICKNESS");
  const at = (t: number) =>
      tri.map((p) => add(kernel, mul(sub(p, kernel), 1 - t / h))),
    o = at(startM),
    i = at(endM);
  return orientCell([
    o,
    [...i].reverse(),
    [o[0], i[0], i[1], o[1]],
    [o[1], i[1], i[2], o[2]],
    [o[2], i[2], i[0], o[0]],
  ]);
}
export function rayCell(
  c: ConvexCell,
  origin: Vec3,
  dir: Vec3,
  maxDistance: number,
) {
  let entry = 0,
    exit = maxDistance,
    entryNormal: Vec3 | undefined;
  for (const { n, d } of planes(c)) {
    const den = dot(n, dir),
      dist = d - dot(n, origin);
    if (Math.abs(den) < 1e-12) {
      if (dist < -EPS) return;
      continue;
    }
    const t = dist / den;
    if (den < 0) {
      if (t > entry) {
        entry = t;
        entryNormal = n;
      }
    } else exit = Math.min(exit, t);
    if (entry > exit - EPS) return;
  }
  if (exit - entry <= EPS) return;
  return { entry, exit, entryNormal };
}

/** Finite parallel triangle prism for local facets whose legacy enclosing mesh has no kernel. */
export function triangleLayer(tri: Vec3[], startM: number, endM: number) {
  if (startM < 0 || endM <= startM || !Number.isFinite(endM))
    throw Error("INVALID_TRIANGLE_THICKNESS");
  const n = normal(tri),
    at = (t: number) => tri.map((p) => sub(p, mul(n, t))),
    o = at(startM),
    i = at(endM);
  return orientCell([
    o,
    [...i].reverse(),
    [o[0], i[0], i[1], o[1]],
    [o[1], i[1], i[2], o[2]],
    [o[2], i[2], i[0], o[0]],
  ]);
}

export function polygonLayer(
  poly: Vec3[],
  kernel: Vec3,
  startM: number,
  endM: number,
  parallel = false,
) {
  const n = faceNormal(poly),
    h = dot(n, sub(poly[0], kernel));
  const at = (t: number) =>
      poly.map((p) =>
        parallel
          ? sub(p, mul(n, t))
          : add(kernel, mul(sub(p, kernel), 1 - t / h)),
      ),
    o = at(startM),
    i = at(endM);
  return orientCell([
    o,
    [...i].reverse(),
    ...o.map((_, j) => [
      o[j],
      i[j],
      i[(j + 1) % o.length],
      o[(j + 1) % o.length],
    ]),
  ]);
}
/** Planar polygon minus a convex body, without generating 3D fragments for buried faces. */
export function subtractPolygon(poly: Vec3[], body: ConvexCell) {
  const ps = planes(body);
  let intersection: Vec3[] = poly;
  const clip = (p: Vec3[], n: Vec3, d: number, inside: boolean) =>
    p.every((v) => Math.abs(dot(n, v) - d) < EPS)
      ? inside
        ? p
        : []
      : clipHalfSpace(p, n, d, !inside);
  for (const p of ps) {
    if (intersection.length < 3) break;
    intersection = clip(intersection, p.n, p.d, true);
  }
  if (intersection.length < 3 || area(intersection) < 1e-9) return [poly];
  let remainder: Vec3[] = poly;
  const out: Vec3[][] = [];
  for (const p of ps) {
    if (remainder.length < 3) break;
    const outside = clip(remainder, p.n, p.d, false);
    if (outside.length >= 3 && area(outside) > 1e-9) out.push(outside);
    remainder = clip(remainder, p.n, p.d, true);
  }
  return out;
}
export function intersectCells(a: ConvexCell, b: ConvexCell) {
  let result: ConvexCell | undefined = a;
  for (const p of planes(b)) {
    if (!result) break;
    result = clipCell(result, p.n, p.d, true);
  }
  return result;
}
/** Robust triangulation of an intended convex clipped cell. No points move; the hull removes
 * unstable nearly-collinear face fans. Hull construction retries near-coplanar points at 6.25nm / 0.1µm. Every original point
 * must remain enclosed within the existing 10µm plane tolerance. Coordinates do not
 * move and the independent validity threshold stays unchanged. Invalid hulls reject. */
export function canonicalSolid(c: ConvexCell) {
  const raw = cellSolid(c),
    check = solidCell(raw);
  if (
    planes(check).every((p) =>
      raw.vertices.every((v) => dot(p.n, v) <= p.d + 1e-5),
    )
  )
    return raw;
  let lastViolation = Infinity;
  for (const resolution of [0, EPS / 16, EPS]) {
    const hull = new ConvexHull();
    if (resolution) {
      const numericHull = hull as ConvexHull & {
          _computeExtremes: () => unknown;
        },
        extremes = numericHull._computeExtremes;
      numericHull._computeExtremes = function () {
        const result = extremes.call(this);
        this.tolerance = Math.max(this.tolerance, resolution);
        return result;
      };
    }
    const points = resolution
      ? unique(raw.vertices, 1e-10)
      : [
          ...new Map(
            raw.vertices.map((p) => [[p.x, p.y, p.z].join("/"), p]),
          ).values(),
        ];
    hull.setFromPoints(points.map((p) => new Vector3(p.x, p.y, p.z)));
    const faces = hull.faces.map((face) => {
      const ps: Vec3[] = [];
      let edge = face.edge;
      do {
        const p = edge.head().point;
        ps.push({ x: p.x, y: p.y, z: p.z });
        edge = edge.next;
      } while (edge !== face.edge);
      return ps;
    });
    const solid = cellSolid(orientCell(faces)),
      validated = solidCell(solid);
    lastViolation = Math.max(
      ...planes(validated).flatMap((p) =>
        raw.vertices.map((v) => dot(p.n, v) - p.d),
      ),
    );
    if (
      lastViolation <= 1e-5 &&
      planes(validated).every((p) =>
        solid.vertices.every((v) => dot(p.n, v) <= p.d + 1e-5),
      )
    )
      return solid;
  }
  throw Error(
    "INVALID_PHYSICAL_CONVEX_FRAGMENT volume=" +
      cellVolume(c) +
      " violation=" +
      lastViolation,
  );
}
/** Coalesce only when the vertex hull has exactly the same union volume. Real gaps stay gaps. */
export function mergeConvexCells(cells: ConvexCell[]) {
  if (cells.length < 2) return cells;
  const points = new Map<string, Vec3>();
  for (const c of cells)
    for (const p of c.faces.flat()) points.set([p.x, p.y, p.z].join("/"), p);
  const hull = new ConvexHull().setFromPoints(
      [...points.values()].map((p) => new Vector3(p.x, p.y, p.z)),
    ),
    faces = hull.faces.map((face) => {
      const ps: Vec3[] = [];
      let edge = face.edge;
      do {
        const p = edge.head().point;
        ps.push({ x: p.x, y: p.y, z: p.z });
        edge = edge.next;
      } while (edge !== face.edge);
      return ps;
    });
  const merged = orientCell(faces),
    before = cells.reduce((n, c) => n + cellVolume(c), 0);
  return Math.abs(cellVolume(merged) - before) <= Math.max(1e-9, before * 1e-10)
    ? [merged]
    : cells;
}
/** Union of actual outer-face polygons, clipped to the original rendered triangle. Summing
 * near-coplanar cell faces directly can count numerical partition boundaries twice. */
export function outerFacetArea(cells: ConvexCell[], tri: Vec3[]) {
  const n = normal(tri),
    d = dot(n, tri[0]),
    covered: Vec3[][] = [];
  for (const cell of cells)
    for (const face of cell.faces) {
      if (
        dot(faceNormal(face), n) < 0.99999 ||
        !face.every((p) => Math.abs(dot(n, p) - d) < 1e-6)
      )
        continue;
      let p = face.map((v) => sub(v, mul(n, dot(n, v) - d)));
      for (let j = 0; j < 3; j++) {
        const edge = unit(cross(sub(tri[(j + 1) % 3], tri[j]), n));
        p = clipHalfSpace(p, edge, dot(edge, tri[j]), false);
        if (p.length < 3) break;
      }
      if (p.length < 3 || area(p) < 1e-9) continue;
      let uncovered = [p];
      for (const existing of covered) {
        const body = polygonLayer(existing, { x: 0, y: 0, z: 0 }, 0, 1, true);
        uncovered = uncovered.flatMap((a) => subtractPolygon(a, body));
        if (!uncovered.length) break;
      }
      covered.push(...uncovered);
    }
  return covered.reduce((sum, p) => sum + area(p), 0);
}
