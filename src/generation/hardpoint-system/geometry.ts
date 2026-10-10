import type { BoundsData, Vec3 } from "../../blueprint/types";
import type { SlotBox } from "./types";
import { worldPoint, localPoint } from "../weapons/surfaces";
import { add, mul, dot, sub, boundsOf, unit } from "../integration/contours";
import { cross, solidFromRings } from "../armor/panels";
import { overlappingBounds } from "../armor/geometry";
export const boxCorners = (b: SlotBox) =>
  [b.localBounds.min.x, b.localBounds.max.x].flatMap((x) =>
    [b.localBounds.min.y, b.localBounds.max.y].flatMap((y) =>
      [b.localBounds.min.z, b.localBounds.max.z].map((z) =>
        worldPoint(b.position, b.frame, { x, y, z }),
      ),
    ),
  );
export const boxBounds = (b: SlotBox) => boundsOf(boxCorners(b));
export function boxSolid(b: SlotBox) {
  const { min: a, max: c } = b.localBounds;
  return solidFromRings(
    [a.y, c.y].map((y) =>
      [
        [a.x, a.z],
        [c.x, a.z],
        [c.x, c.z],
        [a.x, c.z],
      ].map(([x, z]) => worldPoint(b.position, b.frame, { x, y, z })),
    ),
  );
}
/** 15-axis OBB SAT: centers or world AABBs never establish a collision. */
export function boxesOverlap(a: SlotBox, b: SlotBox) {
  if (!overlappingBounds(boxBounds(a), boxBounds(b))) return false;
  const aa = [a.frame.right, a.frame.normal, a.frame.forward],
    bb = [b.frame.right, b.frame.normal, b.frame.forward],
    axes = [...aa, ...bb];
  for (const x of aa)
    for (const y of bb) {
      const z = cross(x, y);
      if (dot(z, z) > 1e-12) axes.push(unit(z));
    }
  const ap = boxCorners(a),
    bp = boxCorners(b);
  return axes.every((n) => {
    const x = ap.map((p) => dot(p, n)),
      y = bp.map((p) => dot(p, n));
    return (
      Math.min(Math.max(...x), Math.max(...y)) -
        Math.max(Math.min(...x), Math.min(...y)) >
      1e-6
    );
  });
}
export function rayBox(
  origin: Vec3,
  direction: Vec3,
  range: number,
  b: SlotBox,
) {
  const p = localPoint(b.position, b.frame, origin),
    d = {
      x: dot(direction, b.frame.right),
      y: dot(direction, b.frame.normal),
      z: -dot(direction, b.frame.forward),
    };
  let lo = 0,
    hi = range;
  for (const k of ["x", "y", "z"] as const) {
    if (Math.abs(d[k]) < 1e-10) {
      if (p[k] < b.localBounds.min[k] || p[k] > b.localBounds.max[k])
        return false;
    } else {
      const a = (b.localBounds.min[k] - p[k]) / d[k],
        c = (b.localBounds.max[k] - p[k]) / d[k];
      lo = Math.max(lo, Math.min(a, c));
      hi = Math.min(hi, Math.max(a, c));
      if (lo >= hi) return false;
    }
  }
  return hi > 0.03 && lo < range;
}
/** Immutable scene BVH, exact tests follow bounds queries; rebuilt once per planning pass. */
export function boundsIndex<T extends { bounds: BoundsData }>(items: T[]) {
  type Node = { bounds: BoundsData; items?: T[]; children?: Node[] };
  function build(xs: T[]): Node {
    const bounds = boundsOf(xs.flatMap((x) => [x.bounds.min, x.bounds.max]));
    if (xs.length <= 10) return { bounds, items: xs };
    const axis = (["x", "y", "z"] as const).reduce(
      (a, c) =>
        bounds.max[c] - bounds.min[c] > bounds.max[a] - bounds.min[a] ? c : a,
      "x",
    );
    const sorted = [...xs].sort(
      (a, b) =>
        a.bounds.min[axis] +
        a.bounds.max[axis] -
        b.bounds.min[axis] -
        b.bounds.max[axis],
    );
    return {
      bounds,
      children: [
        build(sorted.slice(0, sorted.length >> 1)),
        build(sorted.slice(sorted.length >> 1)),
      ],
    };
  }
  const root = build(items);
  return (box: BoundsData) => {
    const found: T[] = [];
    function visit(n: Node) {
      if (!overlappingBounds(box, n.bounds)) return;
      if (n.items)
        found.push(...n.items.filter((a) => overlappingBounds(box, a.bounds)));
      else n.children!.forEach(visit);
    }
    visit(root);
    return found;
  };
}
/** Mutable cell index for adopted slots only; large boxes are registered in every touched cell. */
export function slotIndex(cell: number) {
  const cells = new Map<string, Set<SlotBox>>();
  function keys(box: BoundsData) {
    const out: string[] = [];
    for (
      let x = Math.floor(box.min.x / cell);
      x <= Math.floor(box.max.x / cell);
      x++
    )
      for (
        let y = Math.floor(box.min.y / cell);
        y <= Math.floor(box.max.y / cell);
        y++
      )
        for (
          let z = Math.floor(box.min.z / cell);
          z <= Math.floor(box.max.z / cell);
          z++
        )
          out.push(`${x}/${y}/${z}`);
    return out;
  }
  return {
    add: (b: SlotBox) => {
      for (const k of keys(boxBounds(b))) {
        let set = cells.get(k);
        if (!set) cells.set(k, (set = new Set()));
        set.add(b);
      }
    },
    query: (b: SlotBox) => [
      ...new Set(keys(boxBounds(b)).flatMap((k) => [...(cells.get(k) ?? [])])),
    ],
  };
}
