import type { ShipBlueprint, Vec3, BoundsData } from "../../blueprint/types";
import { add, mul, dot, boundsOf } from "./contours";
import { volumeBounds } from "../architecture/volumes";
function orientedCorners(
  position: Vec3,
  normal: Vec3,
  half: Vec3,
  minY: number,
  maxY: number,
) {
  const k = { x: normal.z, y: 0, z: -normal.x },
    c = normal.y;
  const rotate = (q: Vec3): Vec3 => {
    if (c < -0.99999) return { x: q.x, y: -q.y, z: -q.z };
    const cross = {
      x: k.y * q.z - k.z * q.y,
      y: k.z * q.x - k.x * q.z,
      z: k.x * q.y - k.y * q.x,
    };
    return add(add(mul(q, c), cross), mul(k, dot(k, q) / (1 + c)));
  };
  return [-1, 1].flatMap((x) =>
    [minY, maxY].flatMap((y) =>
      [-1, 1].map((z) =>
        add(position, rotate({ x: x * half.x, y, z: z * half.z })),
      ),
    ),
  );
}
/** Conservative component bounds, separate from fitting (which always uses actual station contours). */
export function overallEnvelope(
  b: ShipBlueprint,
  newPoints: Vec3[],
): BoundsData {
  const structure = volumeBounds(b.structuralVolumes),
    points = [...newPoints, structure.min, structure.max];
  for (const e of b.engines) {
    const r = e.nozzleRadius * (e.bellRatio + 0.14);
    points.push(
      { x: e.position.x - r, y: e.position.y - r, z: e.position.z },
      {
        x: e.position.x + r,
        y: e.position.y + r,
        z: e.position.z + e.nozzleLength + e.nozzleRadius * 0.12,
      },
    );
  }
  for (const h of b.hardpoints)
    points.push(
      ...orientedCorners(
        h.position,
        h.normal,
        { x: h.radius * 1.6, y: 0, z: h.radius * 1.6 },
        -h.radius,
        h.type === "Spinal"
          ? b.order.length * 0.05
          : h.type === "Sensor"
            ? h.radius * 0.7
            : b.order.length * 0.01,
      ),
    );
  for (const p of b.prefabPlacements ?? [])
    if (!p.exterior) {
      const d = p.dimensions,
        r = p.kind === "JOINT_HOUSING" ? Math.max(d.x, d.z) * 0.55 : 0;
      points.push(
        ...orientedCorners(
          p.socket.position,
          p.socket.normal,
          { x: Math.max(d.x * 0.55, r), y: 0, z: Math.max(d.z * 0.55, r) },
          -Math.max(d.y * 0.65, r * 0.2),
          Math.max(d.y * 1.2, r * 0.2),
        ),
      );
    }
  for (const f of b.surfaceFeatures)
    points.push(
      ...orientedCorners(
        f.position,
        f.normal ?? { x: 0, y: 1, z: 0 },
        { x: f.size.x * 0.55, y: 0, z: f.size.z * 0.55 },
        -f.size.y,
        f.size.y * 2,
      ),
    );
  return boundsOf(points);
}
