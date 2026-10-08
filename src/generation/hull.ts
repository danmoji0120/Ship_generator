import type { HullStation, ShipOrder } from "../blueprint/types";
import type { Shipyard } from "../shipyards/config";
import type { SeededRng } from "../random/rng";
export const ROLE_RULES = {
  Corvette: { width: 0.14, height: 0.07, budget: 5 },
  Frigate: { width: 0.18, height: 0.09, budget: 8 },
  Destroyer: { width: 0.19, height: 0.1, budget: 11 },
  Cruiser: { width: 0.24, height: 0.12, budget: 14 },
  Battlecruiser: { width: 0.21, height: 0.13, budget: 17 },
  Battleship: { width: 0.32, height: 0.17, budget: 20 },
  "Missile Ship": { width: 0.32, height: 0.13, budget: 12 },
  "Spinal Gun Ship": { width: 0.115, height: 0.095, budget: 9 },
  "Patrol Ship": { width: 0.17, height: 0.075, budget: 4 },
};
export function generateHull(
  order: ShipOrder,
  yard: Shipyard,
  rng: SeededRng,
): HullStation[] {
  const p = order.priorities,
    rule = ROLE_RULES[order.role],
    mass = { Light: 0.8, Standard: 1, Heavy: 1.16, Superheavy: 1.32 }[
      order.massClass
    ];
  const width =
    order.length *
    rule.width *
    yard.width *
    mass *
    (0.72 + p.survivability * 0.006 + p.missile * 0.002 - p.mobility * 0.0028) *
    rng.range(0.83, 1.16);
  const height =
    order.length *
    rule.height *
    yard.height *
    Math.sqrt(mass) *
    (0.8 + p.endurance * 0.004 + p.survivability * 0.002) *
    rng.range(0.86, 1.14);
  const n = rng.int(order.length < 100 ? 5 : 7, order.length > 300 ? 12 : 10),
    profile = rng.pick(yard.profiles);
  const peak = rng.range(0.43, 0.62),
    fore = rng.range(0.78, 1.35),
    aft = rng.range(0.8, 1.15);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1),
      z = (t - 0.5) * order.length;
    let envelope =
      t < peak
        ? 0.045 + 0.955 * Math.pow(t / peak, fore)
        : 1 - (1 - aft * 0.57) * Math.pow((t - peak) / (1 - peak), 1.25);
    if (order.role === "Spinal Gun Ship")
      envelope =
        t < 0.3
          ? 0.25 + t * 1.1
          : 0.58 + Math.sin(((t - 0.3) / 0.7) * Math.PI) * 0.42;
    if (yard.structure === "swift")
      envelope *= 0.7 + 0.3 * Math.sin(t * Math.PI);
    if (yard.structure === "truss")
      envelope =
        (0.16 + 0.84 * envelope) *
        (0.62 + 0.2 * Math.pow(Math.cos(t * Math.PI * 2), 2));
    if (yard.structure === "clean" && t > peak)
      envelope = 1 - 0.78 * Math.pow((t - peak) / (1 - peak), 0.85);
    return {
      z,
      width: width * envelope,
      height: height * (0.35 + 0.65 * Math.sin(Math.PI * t * 0.85)),
      profile,
      topSlope: yard.structure === "clean" ? 0.12 : 0.05,
      sideSlope: 0.03,
      bevel:
        yard.structure === "heavy"
          ? 0.18
          : yard.structure === "clean"
            ? 0.4
            : 0.27,
    };
  });
}
/** Exact shared eight-point cross section; generation attachments and renderer use the same surface. */
export function profileRing(s: HullStation): [number, number][] {
  if (s.sectionRing) return s.sectionRing;
  const w = s.width / 2,
    h = s.height / 2;
  let b = s.bevel;
  if (s.profile === "box") b = 0.03;
  if (s.profile === "diamond") b = 0.93;
  if (s.profile === "hex" && s.roundness !== undefined) {
    // Six faces, with two collinear subdivisions on the lower diagonals to retain eight-vertex loft topology.
    const top = h * (1 - s.topSlope),
      bottom = -h * (1 - (s.bottomSlope ?? 0));
    return [
      [-0.55 * w, top],
      [0.55 * w, top],
      [w, 0],
      [0.775 * w, bottom * 0.5],
      [0.55 * w, bottom],
      [-0.55 * w, bottom],
      [-0.775 * w, bottom * 0.5],
      [-w, 0],
    ];
  }
  if (s.profile === "hex") b = 0.45;
  if (s.profile === "rounded")
    b = s.roundness === undefined ? 0.36 : 0.4 + s.roundness * 0.25;
  if (s.profile === "flattened") b = 0.48;
  return [
    [-w * (1 - b), h * (1 - s.topSlope)],
    [w * (1 - b), h * (1 - s.topSlope)],
    [w, h * (1 - b - s.sideSlope)],
    [w, -h * (1 - b)],
    [w * (1 - b), -h * (1 - (s.bottomSlope ?? 0))],
    [-w * (1 - b), -h * (1 - (s.bottomSlope ?? 0))],
    [-w, -h * (1 - b)],
    [-w, h * (1 - b - s.sideSlope)],
  ];
}
export function stationAt(stations: HullStation[], z: number): HullStation {
  const i = Math.max(
    0,
    Math.min(stations.length - 2, stations.findIndex((s) => s.z >= z) - 1),
  );
  const a = stations[i],
    b = stations[i + 1],
    t = Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
  return {
    ...a,
    sectionRing: profileRing(a).map((p, i) => {
      const q = profileRing(b)[i];
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t] as [
        number,
        number,
      ];
    }),
    z,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  };
}
export function topAt(stations: HullStation[], z: number) {
  const s = stationAt(stations, z);
  return (s.height / 2) * (1 - s.topSlope);
}
/** Intersects the upper cross-section polyline. Normals include longitudinal hull slope. */
export function hullSurfaceAt(stations: HullStation[], z: number, x: number) {
  const s = stationAt(stations, z),
    ring = profileRing(s),
    absX = Math.abs(x),
    flat = ring[1][0];
  const bevel = absX > flat,
    ratio = bevel ? (absX - flat) / (ring[2][0] - flat) : 0;
  const y = bevel ? ring[1][1] + (ring[2][1] - ring[1][1]) * ratio : ring[1][1];
  const slopeX = bevel
    ? ((ring[2][1] - ring[1][1]) / (ring[2][0] - flat)) * Math.sign(x)
    : 0;
  const segment = Math.max(
      0,
      Math.min(stations.length - 2, stations.findIndex((st) => st.z >= z) - 1),
    ),
    a = stations[segment],
    b = stations[segment + 1];
  const yAt = (st: HullStation) => {
    const r = profileRing(st);
    return bevel ? r[1][1] + (r[2][1] - r[1][1]) * ratio : r[1][1];
  };
  const slopeZ = (yAt(b) - yAt(a)) / (b.z - a.z),
    norm = Math.hypot(slopeX, 1, slopeZ);
  return {
    y,
    normal: {
      x: slopeX === 0 ? 0 : -slopeX / norm,
      y: 1 / norm,
      z: slopeZ === 0 ? 0 : -slopeZ / norm,
    },
  };
}
