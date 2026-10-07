import type {
  HullStation,
  StructuralVolume,
  Vec3,
  VolumePrimitive,
  Profile,
  NoseArchitecture,
} from "../../blueprint/types";
import { profileRing, stationAt, hullSurfaceAt } from "../hull";
export function primitiveStations(
  primitive: VolumePrimitive,
  size: Vec3,
  profile: Profile,
  nose: NoseArchitecture,
): HullStation[] {
  const n = primitive === "Long Loft" ? 8 : 5;
  const noseFactor =
    nose === "pointed"
      ? 0.07
      : nose === "spinal muzzle"
        ? 0.85
        : nose === "blunt armored"
          ? 0.85
          : nose === "block nose"
            ? 1
            : nose === "sensor nose"
              ? 0.55
              : 0.32;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    let width = 1,
      height = 1;
    if (primitive === "Wedge") {
      width = 0.65 + 0.35 * t;
      height = 0.38 + 0.62 * Math.min(t * 3, 1);
    }
    if (primitive === "Tapered Box")
      width =
        t < 0.3
          ? noseFactor + ((1 - noseFactor) * t) / 0.3
          : 1 - (0.24 * (t - 0.3)) / 0.7;
    if (primitive === "Short Loft" || primitive === "Long Loft") {
      width =
        t < 0.32
          ? noseFactor + (1 - noseFactor) * Math.sin(((t / 0.32) * Math.PI) / 2)
          : 1 - 0.2 * Math.pow((t - 0.32) / 0.68, 1.4);
      height = 0.65 + 0.35 * Math.sin(t * Math.PI * 0.85);
    }
    return {
      z: (t - 0.5) * size.z,
      width: size.x * width,
      height: size.y * height,
      profile:
        primitive === "Box"
          ? "box"
          : primitive === "Hexagonal Prism"
            ? "hex"
            : primitive === "Rounded Box"
              ? "rounded"
              : profile,
      topSlope: 0.04,
      sideSlope: 0.025,
      bevel: 0.22,
    };
  });
}
export function containsVolume(
  volume: StructuralVolume,
  p: Vec3,
  tolerance = 0,
) {
  const z = p.z - volume.position.z;
  if (
    z < volume.geometry.stations[0].z - tolerance ||
    z > volume.geometry.stations.at(-1)!.z + tolerance
  )
    return false;
  const ring = profileRing(stationAt(volume.geometry.stations, z)),
    x = p.x - volume.position.x,
    y = p.y - volume.position.y;
  // Convex clockwise profile: positive cross product lies outside.
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (cross > tolerance * Math.hypot(b[0] - a[0], b[1] - a[1])) return false;
  }
  return true;
}
export function boundaryToward(volume: StructuralVolume, target: Vec3) {
  const c = volume.position,
    d = { x: target.x - c.x, y: target.y - c.y, z: target.z - c.z };
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 38; i++) {
    const t = (lo + hi) / 2,
      p = { x: c.x + d.x * t, y: c.y + d.y * t, z: c.z + d.z * t };
    if (containsVolume(volume, p)) lo = t;
    else hi = t;
  }
  return { x: c.x + d.x * lo, y: c.y + d.y * lo, z: c.z + d.z * lo };
}
export function volumeBounds(volumes: StructuralVolume[]) {
  const min = { x: Infinity, y: Infinity, z: Infinity },
    max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const v of volumes)
    for (const s of v.geometry.stations)
      for (const [x, y] of profileRing(s)) {
        min.x = Math.min(min.x, x + v.position.x);
        max.x = Math.max(max.x, x + v.position.x);
        min.y = Math.min(min.y, y + v.position.y);
        max.y = Math.max(max.y, y + v.position.y);
        min.z = Math.min(min.z, s.z + v.position.z);
        max.z = Math.max(max.z, s.z + v.position.z);
      }
  return { min, max };
}
/** Highest real body surface at a world X/Z; stacked terraces remain exposed mount platforms. */
export function exposedVolumeSurface(
  volumes: StructuralVolume[],
  x: number,
  z: number,
) {
  let best: { y: number; normal: Vec3; parentId: string } | undefined;
  for (const v of volumes) {
    const localZ = z - v.position.z,
      localX = x - v.position.x;
    if (
      localZ < v.geometry.stations[0].z ||
      localZ > v.geometry.stations.at(-1)!.z
    )
      continue;
    if (Math.abs(localX) > stationAt(v.geometry.stations, localZ).width / 2)
      continue;
    const surface = hullSurfaceAt(v.geometry.stations, localZ, localX);
    surface.y += v.position.y;
    if (!best || surface.y > best.y) best = { ...surface, parentId: v.id };
  }
  if (!best) throw new Error("No exposed volume surface");
  return best;
}
