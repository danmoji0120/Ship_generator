import type { Vec3, StructuralVolume, BoundsData } from "../../blueprint/types";
import { containsVolume } from "../architecture/volumes";
import { profileRing, stationAt } from "../hull";
export const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});
export const sub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
export const mul = (v: Vec3, s: number): Vec3 => ({
  x: v.x * s || 0,
  y: v.y * s || 0,
  z: v.z * s || 0,
});
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const unit = (v: Vec3) => mul(v, 1 / Math.hypot(v.x, v.y, v.z));
export const mix = (a: Vec3, b: Vec3, t: number) =>
  add(mul(a, 1 - t), mul(b, t));
export function basis(n: Vec3) {
  const up = Math.abs(n.y) > 0.9 ? { x: 0, y: 0, z: -1 } : { x: 0, y: 1, z: 0 };
  const cross = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const u = unit(cross(up, n)),
    v = unit(cross(n, u));
  return { u, v };
}
export function sectionRing(v: StructuralVolume, z: number): Vec3[] {
  return profileRing(stationAt(v.geometry.stations, z - v.position.z)).map(
    ([x, y]) => ({ x: x + v.position.x, y: y + v.position.y, z }),
  );
}
export function center(ring: Vec3[]): Vec3 {
  return mul(ring.reduce(add, { x: 0, y: 0, z: 0 }), 1 / ring.length);
}
export function scaledRing(
  ring: Vec3[],
  scale: number,
  offset: Vec3 = { x: 0, y: 0, z: 0 },
) {
  const c = center(ring);
  return ring.map((p) => add(add(c, mul(sub(p, c), scale)), offset));
}
/** First-exit rays intersect real convex station polygons, not the external AABB. Patch planes may be oblique. */
export function contactPatch(
  v: StructuralVolume,
  anchor: Vec3,
  normal: Vec3,
  width: number,
  height: number,
  inset: number,
) {
  const c = sub(anchor, mul(normal, inset)),
    { u, v: up } = basis(normal);
  if (!containsVolume(v, c, v.dimensions.z * 1e-7))
    throw new Error("Inward socket plane misses parent station surface");
  return Array.from({ length: 8 }, (_, i) => {
    const angle = (3 * Math.PI) / 4 - (i * Math.PI) / 4,
      d = add(
        mul(u, (Math.cos(angle) * width) / 2),
        mul(up, (Math.sin(angle) * height) / 2),
      );
    let lo = 0,
      hi = 1;
    for (let step = 1; step <= 16; step++) {
      const t = step / 16;
      if (!containsVolume(v, add(c, mul(d, t)))) {
        hi = t;
        lo = (step - 1) / 16;
        break;
      }
      lo = t;
    }
    if (lo < 1)
      for (let j = 0; j < 12; j++) {
        const t = (lo + hi) / 2;
        if (containsVolume(v, add(c, mul(d, t)))) lo = t;
        else hi = t;
      }
    return add(c, mul(d, Math.max(0, lo - 0.00001)));
  });
}
export function boundsOf(points: Vec3[]): BoundsData {
  if (!points.length)
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  return {
    min: {
      x: Math.min(...points.map((p) => p.x)),
      y: Math.min(...points.map((p) => p.y)),
      z: Math.min(...points.map((p) => p.z)),
    },
    max: {
      x: Math.max(...points.map((p) => p.x)),
      y: Math.max(...points.map((p) => p.y)),
      z: Math.max(...points.map((p) => p.z)),
    },
  };
}
/** Vertices, edge midpoints and face centers reveal intrusion between contour stations as well. */
export function contourSamples(rings: Vec3[][]) {
  const result = rings.flat();
  for (let j = 0; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const a = rings[j][i],
        b = rings[j][(i + 1) % rings[j].length];
      result.push(mix(a, b, 0.5));
      if (j + 1 < rings.length) {
        const c = rings[j + 1][i],
          d = rings[j + 1][(i + 1) % rings[j].length];
        result.push(mix(a, c, 0.5), mul(add(add(a, b), add(c, d)), 0.25));
      }
    }
  return result;
}

/** Preserve winding while matching corresponding perimeter corners in the socket tangent plane. */
export function alignRing(reference: Vec3[], candidate: Vec3[]) {
  const a = center(reference),
    b = center(candidate);
  let best = candidate,
    score = Infinity;
  for (let shift = 0; shift < candidate.length; shift++) {
    const r = candidate.map(
      (_, i) => candidate[(i + shift) % candidate.length],
    );
    const cost = r.reduce((sum, p, i) => {
      const d = sub(sub(p, b), sub(reference[i], a));
      return sum + dot(d, d);
    }, 0);
    if (cost < score) {
      score = cost;
      best = r;
    }
  }
  return best;
}
