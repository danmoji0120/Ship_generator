import type { StructuralVolume, ShipOrder } from "../../blueprint/types";
import type { MacroMeasurement } from "./types";
import { profileRing } from "../hull";
import { volumeBounds } from "../architecture/volumes";
/** Piecewise-linear ring interpolation matches the loft triangles. Simpson integrates its quadratic area exactly. */
function area(ring: [number, number][]) {
  return (
    Math.abs(
      ring.reduce((s, a, i) => {
        const b = ring[(i + 1) % ring.length];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0),
    ) / 2
  );
}
export function measureMacro(
  order: ShipOrder,
  volumes: StructuralVolume[],
): MacroMeasurement {
  let total = 0;
  const regions = [0, 0, 0],
    moduleVolumesM3: Record<string, number> = {},
    moment = { x: 0, y: 0, z: 0 };
  const cut = order.length / 6;
  for (const v of volumes) {
    let volume = 0;
    const stations = v.geometry.stations;
    for (let i = 1; i < stations.length; i++) {
      const a = stations[i - 1],
        b = stations[i],
        ra = profileRing(a),
        rb = profileRing(b),
        z0 = a.z + v.position.z,
        z1 = b.z + v.position.z;
      const section = (z: number) =>
        area(
          ra.map((p, k) => [
            p[0] + ((rb[k][0] - p[0]) * (z - z0)) / (z1 - z0),
            p[1] + ((rb[k][1] - p[1]) * (z - z0)) / (z1 - z0),
          ]),
        );
      const cuts = [z0, ...[-cut, cut].filter((z) => z > z0 && z < z1), z1];
      for (let k = 1; k < cuts.length; k++) {
        const lo = cuts[k - 1],
          hi = cuts[k],
          mid = (lo + hi) / 2;
        const dv =
          ((hi - lo) / 6) * (section(lo) + 4 * section(mid) + section(hi));
        regions[mid < -cut ? 0 : mid > cut ? 2 : 1] += dv;
        volume += dv;
        // z*area(z) is cubic: Simpson also gives an exact longitudinal first moment.
        moment.z +=
          ((hi - lo) / 6) *
          (lo * section(lo) + 4 * mid * section(mid) + hi * section(hi));
      }
    }
    moduleVolumesM3[v.id] = volume;
    total += volume;
    // Cross-section slopes may displace their centroid slightly. X/Y use module centers by convention.
    moment.x += v.position.x * volume;
    moment.y += v.position.y * volume;
  }
  const bounds = volumeBounds(volumes),
    density = 0.16 + order.priorities.survivability * 0.0022;
  return {
    approximateVolumeM3: total,
    densityTonnesPerM3: density,
    estimatedMassTonnes: total * density,
    primaryMassRatio: Math.max(...Object.values(moduleVolumesM3)) / total,
    foreMassRatio: regions[0] / total,
    midMassRatio: regions[1] / total,
    aftMassRatio: regions[2] / total,
    lateralSpread: (bounds.max.x - bounds.min.x) / order.length,
    verticalSpread: (bounds.max.y - bounds.min.y) / order.length,
    centerOfVolume: {
      x: moment.x / total,
      y: moment.y / total,
      z: moment.z / total,
    },
    moduleVolumesM3,
  };
}
