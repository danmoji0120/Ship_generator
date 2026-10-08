import type {
  StructuralVolume,
  StructuralConnector,
  SilhouetteMetrics,
  ShipOrder,
} from "../blueprint/types";
import { profileRing } from "../generation/hull";
import { volumeBounds } from "../generation/architecture/volumes";
type Point = [number, number];
function cross(o: Point, a: Point, b: Point) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}
function convex(points: Point[]) {
  const sorted = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    lower: Point[] = [],
    upper: Point[] = [];
  for (const p of sorted) {
    while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (const p of sorted.reverse()) {
    while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function inPolygon(p: Point, poly: Point[]) {
  return poly.every(
    (a, i) => cross(a, poly[(i + 1) % poly.length], p) >= -1e-8,
  );
}
export function connectedIds(
  volumes: StructuralVolume[],
  connectors: StructuralConnector[],
) {
  const found = new Set<string>([volumes[0]?.id]);
  let change = true;
  while (change) {
    change = false;
    for (const c of connectors)
      if (found.has(c.fromStructureId) || found.has(c.toStructureId))
        for (const id of [c.fromStructureId, c.toStructureId])
          if (!found.has(id)) {
            found.add(id);
            change = true;
          }
  }
  return found;
}
export function silhouetteMetrics(
  volumes: StructuralVolume[],
  connectors: StructuralConnector[],
): SilhouetteMetrics {
  const bounds = volumeBounds(volumes),
    occupancy = { front: 0, side: 0, top: 0 };
  let symmetric = 0,
    total = 0;
  for (const [name, axes] of [
    ["front", ["x", "y"]],
    ["side", ["z", "y"]],
    ["top", ["x", "z"]],
  ] as const) {
    const [u, v] = axes,
      polygons = volumes.map((vol) =>
        convex(
          vol.geometry.stations.flatMap((st) =>
            profileRing(st).map(([x, y]) => {
              const p = {
                x: x + vol.position.x,
                y: y + vol.position.y,
                z: st.z + vol.position.z,
              };
              return [p[u], p[v]] as Point;
            }),
          ),
        ),
      );
    let filled = 0;
    const resolution = 28;
    for (let i = 0; i < resolution; i++)
      for (let j = 0; j < resolution; j++) {
        const a =
            bounds.min[u] +
            ((i + 0.5) / resolution) * (bounds.max[u] - bounds.min[u]),
          b =
            bounds.min[v] +
            ((j + 0.5) / resolution) * (bounds.max[v] - bounds.min[v]);
        const hit = polygons.some((poly) => inPolygon([a, b], poly));
        if (hit) filled++;
        if (name === "top") {
          const mirror = polygons.some((poly) => inPolygon([-a, b], poly));
          if (hit === mirror) symmetric++;
          total++;
        }
      }
    occupancy[name] = filled / (resolution * resolution);
  }
  const sizes = volumes.map(
      (v) => v.dimensions.x * v.dimensions.y * v.dimensions.z,
    ),
    mass = sizes.reduce((a, b) => a + b, 0),
    length = bounds.max.z - bounds.min.z;
  const foreRatio =
    volumes.reduce((acc, v, i) => acc + (v.position.z < 0 ? sizes[i] : 0), 0) /
    mass;
  const joinDistribution: NonNullable<
    SilhouetteMetrics["massHierarchy"]
  >["joinDistribution"] = {};
  for (const c of connectors)
    if (c.join)
      joinDistribution[c.join.type] = (joinDistribution[c.join.type] ?? 0) + 1;
  return {
    massHierarchy: {
      primaryRatio: Math.max(...sizes) / mass,
      foreRatio,
      aftRatio: 1 - foreRatio,
      lateralSpread: (bounds.max.x - bounds.min.x) / length,
      verticalSpread: (bounds.max.y - bounds.min.y) / length,
      joinDistribution,
    },
    slenderness: (bounds.max.z - bounds.min.z) / (bounds.max.x - bounds.min.x),
    majorVolumeCount: volumes.length,
    occupancy,
    symmetry: symmetric / total,
    disconnectedPenalty:
      volumes.length -
      [...connectedIds(volumes, connectors)].filter((id) =>
        volumes.some((v) => v.id === id),
      ).length,
  };
}
export function validateSilhouette(
  order: ShipOrder,
  metrics: SilhouetteMetrics,
) {
  const errors: string[] = [];
  if (metrics.slenderness > 12 || metrics.slenderness < 1.05)
    errors.push("Silhouette proportions");
  if (order.role === "Battleship" && metrics.slenderness > 5.5)
    errors.push("Battleship needle silhouette");
  if (metrics.majorVolumeCount < 1 || metrics.majorVolumeCount > 12)
    errors.push("Major volume budget");
  if (metrics.occupancy.top < 0.11 || metrics.occupancy.side < 0.12)
    errors.push("Insufficient projected occupancy");
  if (
    metrics.massHierarchy &&
    metrics.majorVolumeCount >= 4 &&
    metrics.massHierarchy.primaryRatio < 0.18
  )
    errors.push("No primary mass hierarchy");
  if (metrics.disconnectedPenalty !== 0) errors.push("Disconnected silhouette");
  return errors;
}
