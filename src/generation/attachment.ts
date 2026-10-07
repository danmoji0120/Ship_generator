import type { HullStation, SecondaryStructure } from "../blueprint/types";
import { hullSurfaceAt, stationAt } from "./hull";
/** Shared module loft contract used by placement, validation and geometry construction. */
export function moduleStations(m: SecondaryStructure): HullStation[] {
  return [-0.5, -0.32, 0.32, 0.5].map((t, i) => ({
    z: t * m.size.z,
    width: m.size.x * (i === 0 || i === 3 ? 0.66 : 1),
    height: m.size.y * (i === 0 || i === 3 ? 0.73 : 1),
    profile: m.profile,
    topSlope: 0.05,
    sideSlope: 0.03,
    bevel: 0.22,
  }));
}
export function exposedSurface(
  stations: HullStation[],
  modules: SecondaryStructure[],
  x: number,
  z: number,
) {
  const s = stationAt(stations, z);
  let best =
    Math.abs(x) <= s.width / 2
      ? { ...hullSurfaceAt(stations, z, x), parentId: "hull" }
      : undefined;
  for (const m of modules) {
    const localX = x - m.position.x,
      localZ = z - m.position.z;
    if (Math.abs(localZ) > m.size.z / 2) continue;
    const section = moduleStations(m);
    if (Math.abs(localX) > stationAt(section, localZ).width / 2) continue;
    const surface = hullSurfaceAt(section, localZ, localX);
    surface.y += m.position.y;
    if (!best || surface.y > best.y) best = { ...surface, parentId: m.id };
  }
  if (!best) throw new Error("No supporting surface for mount");
  return best;
}
