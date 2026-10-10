import type { StructuralVolume } from "../../blueprint/types";
import { profileRing, stationAt } from "../hull";
import { volumeBounds } from "../architecture/volumes";

/** Geometric union, not physical mass: midpoint Z slabs + horizontal polygon intervals.
 * Overlapping terraces contribute once. No equipment/armor density is assumed.
 * Convex station rings are the authoritative collision/rendering cross sections.
 */
export function measureStackedUnion(
  volumes: StructuralVolume[],
  length: number,
  zSamples = 64,
  ySamples = 32,
) {
  const bounds = volumeBounds(volumes),
    dz = (bounds.max.z - bounds.min.z) / zSamples,
    dy = (bounds.max.y - bounds.min.y) / ySamples;
  let volume = 0,
    moment = 0;
  const regions = [0, 0, 0];
  for (let zi = 0; zi < zSamples; zi++) {
    const z = bounds.min.z + (zi + 0.5) * dz;
    const polygons = volumes
      .filter(
        (v) =>
          z >= v.position.z + v.geometry.stations[0].z &&
          z <= v.position.z + v.geometry.stations.at(-1)!.z,
      )
      .map((v) =>
        profileRing(stationAt(v.geometry.stations, z - v.position.z)).map(
          ([x, y]) => [x + v.position.x, y + v.position.y] as [number, number],
        ),
      );
    let area = 0;
    for (let yi = 0; yi < ySamples; yi++) {
      const y = bounds.min.y + (yi + 0.5) * dy,
        intervals: [number, number][] = [];
      for (const polygon of polygons) {
        const xs: number[] = [];
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i],
            b = polygon[(i + 1) % polygon.length];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
            xs.push(a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]));
        }
        if (xs.length >= 2) intervals.push([Math.min(...xs), Math.max(...xs)]);
      }
      intervals.sort((a, b) => a[0] - b[0]);
      let width = 0,
        lo = 0,
        hi = 0,
        first = true;
      for (const range of intervals) {
        if (first) {
          [lo, hi] = range;
          first = false;
        } else if (range[0] <= hi) hi = Math.max(hi, range[1]);
        else {
          width += hi - lo;
          [lo, hi] = range;
        }
      }
      if (!first) width += hi - lo;
      area += width * dy;
    }
    const dv = area * dz;
    volume += dv;
    moment += z * dv;
    regions[z < -length / 6 ? 0 : z > length / 6 ? 2 : 1] += dv;
  }
  return {
    method: `station union midpoint ${zSamples}×${ySamples}`,
    volume,
    centroid: moment / volume / length + 0.5,
    fore: regions[0] / volume,
    mid: regions[1] / volume,
    aft: regions[2] / volume,
  };
}
