import type {
  SecondaryStructure,
  ShipOrder,
  HullStation,
  Truss,
} from "../blueprint/types";
import type { Shipyard } from "../shipyards/config";
import type { SeededRng } from "../random/rng";
import { stationAt, topAt } from "./hull";
export function generateStructures(
  order: ShipOrder,
  yard: Shipyard,
  stations: HullStation[],
  rng: SeededRng,
) {
  const l = order.length,
    p = order.priorities,
    result: SecondaryStructure[] = [],
    trusses: Truss[] = [];
  const add = (
    kind: SecondaryStructure["kind"],
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => {
    const m: SecondaryStructure = {
      id: `module-${result.length}`,
      kind,
      position: { x, y, z },
      size: { x: w, y: h, z: d },
      profile:
        yard.structure === "clean"
          ? "flattened"
          : yard.structure === "swift"
            ? "diamond"
            : "chamfer",
      parentId: "hull",
    };
    result.push(m);
    return m;
  };
  const broad = order.role === "Missile Ship" || p.missile > 65,
    bulk = yard.structure === "heavy",
    speed = yard.structure === "swift";
  const variant = rng.int(0, 2);
  const z = l * (variant === 0 ? -0.09 : variant === 1 ? 0.05 : 0.17),
    s = stationAt(stations, z);
  if (yard.structure === "truss") {
    // Separate pressure hull modules connected by four visible girder beams.
    for (const side of [-1, 1]) {
      const x = side * (s.width * 0.5 + l * 0.1),
        w = l * (broad ? 0.125 : 0.095),
        h = l * 0.1;
      const module = add(
        broad ? "missile" : "supply",
        x,
        0,
        z,
        w,
        h,
        l * (0.21 + variant * 0.035 + p.endurance * 0.001),
      );
      for (const dz of [-l * 0.085, l * 0.085])
        for (const dy of [-h * 0.26, h * 0.26])
          trusses.push({
            id: `truss-${trusses.length}`,
            start: { x: side * s.width * 0.3, y: dy, z: z + dz },
            end: { x: x - side * w * 0.18, y: dy, z: z + dz },
            radius: l * 0.005,
            parentIds: ["hull", module.id],
          });
      if (variant > 0) {
        const fz = -l * 0.24,
          fs = stationAt(stations, fz),
          fx = side * (fs.width * 0.48 + l * 0.07),
          fh = l * 0.075;
        const front = add("supply", fx, 0, fz, l * 0.08, fh, l * 0.19);
        for (const dz of [-l * 0.04, l * 0.04])
          trusses.push({
            id: `truss-${trusses.length}`,
            start: { x: side * fs.width * 0.25, y: 0, z: fz + dz },
            end: { x: fx, y: 0, z: fz + dz },
            radius: l * 0.005,
            parentIds: ["hull", front.id],
          });
      }
      const nacelle = add(
        "nacelle",
        side * (s.width * 0.43 + l * 0.045),
        -l * 0.025,
        l * 0.37,
        l * 0.085,
        l * 0.085,
        l * 0.22,
      );
      for (const dz of [-l * 0.04, l * 0.04])
        trusses.push({
          id: `truss-${trusses.length}`,
          start: {
            x: side * stationAt(stations, nacelle.position.z).width * 0.25,
            y: 0,
            z: nacelle.position.z + dz,
          },
          end: { x: nacelle.position.x, y: 0, z: nacelle.position.z + dz },
          radius: l * 0.006,
          parentIds: ["hull", nacelle.id],
        });
    }
  } else {
    const wings = speed
      ? l * rng.range(0.12, 0.23)
      : l *
        (0.06 +
          variant * 0.02 +
          p.survivability * 0.0005 +
          (broad ? 0.05 : 0) +
          (yard.structure === "clean" ? 0.07 : 0));
    for (const side of [-1, 1]) {
      add(
        broad ? "missile" : bulk ? "armor" : "shoulder",
        side * s.width * 0.37,
        -s.height * 0.04,
        z,
        wings,
        s.height * (bulk ? 0.85 : speed ? 0.46 : 0.55),
        l *
          (speed
            ? 0.22 + variant * 0.065
            : bulk
              ? 0.25 + variant * 0.075
              : 0.25 + variant * 0.105),
      );
      if (broad) {
        const pod = result.at(-1)!;
        const highest = Math.max(
          ...[-0.32, 0, 0.32].map((t) => topAt(stations, z + t * pod.size.z)),
        );
        pod.position.y = highest - pod.size.y * 0.475 + l * 0.009;
      }
      if (speed)
        add(
          "nacelle",
          side * s.width * 0.43,
          0,
          l * 0.35,
          l * 0.06,
          l * 0.065,
          l * 0.26,
        );
      if (bulk && p.survivability > 50)
        add(
          "armor",
          side * stationAt(stations, -l * 0.2).width * 0.32,
          0,
          -l * 0.2,
          l * 0.065,
          l * 0.075,
          l * 0.21,
        );
    }
  }
  const dz = l * (yard.structure === "clean" ? 0.13 : 0.19),
    dorsal = stationAt(stations, dz);
  add(
    "dorsal",
    0,
    topAt(stations, dz) + l * 0.014,
    dz,
    dorsal.width * 0.32,
    l * (0.035 + p.sensor * 0.00035),
    l * 0.14,
  );
  if (p.endurance > 55)
    add(
      "supply",
      0,
      -stationAt(stations, l * 0.2).height * 0.37,
      l * 0.2,
      stationAt(stations, l * 0.2).width * 0.66,
      l * (0.03 + p.endurance * 0.0004),
      l * 0.24,
    );
  if (order.role === "Spinal Gun Ship")
    add("ventral", 0, 0, -l * 0.24, l * 0.033, l * 0.043, l * 0.5);
  return { secondaryStructures: result, trusses };
}
