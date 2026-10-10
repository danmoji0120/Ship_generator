import type { Vec3, BoundsData, Hardpoint } from "../blueprint/types";
import type { PanelSolid } from "../generation/armor/types";
import type { PreviewEquipment } from "./library";
import { facetedBox, annularHousing } from "../generation/functional/geometry";
import { solidFromRings } from "../generation/armor/panels";
import { worldPoint, worldDirection } from "../generation/weapons/surfaces";
import {
  provideGeometrySamples,
  geometrySamples,
} from "../generation/weapons/collision";
import {add,mul,sub,dot} from "../generation/integration/contours";
import { boundsOf } from "../generation/integration/contours";
export interface PreviewPart {
  id: string;
  role: "ARMOR" | "MECHANICAL" | "BORE" | "FOUNDATION";
  solid: PanelSolid;
  bounds: BoundsData;
}
export interface Shot {
  origin: Vec3;
  direction: Vec3;
}
export function posePoint(
  p: Vec3,
  yaw: number,
  elevation = 0,
  pivot?: Vec3,
): Vec3 {
  const a = (yaw * Math.PI) / 180,
    t = (elevation * Math.PI) / 180;
  let { x, y, z } = p;
  if (pivot) {
    y -= pivot.y;
    z -= pivot.z;
    const yy = y * Math.cos(t) - z * Math.sin(t),
      zz = y * Math.sin(t) + z * Math.cos(t);
    y = yy + pivot.y;
    z = zz + pivot.z;
  }
  return {
    x: x * Math.cos(a) + z * Math.sin(a),
    y,
    z: z * Math.cos(a) - x * Math.sin(a),
  };
}
function cylinder(radius: number, height: number, y: number): PanelSolid {
  return solidFromRings(
    [y, y + height].map((h) =>
      Array.from({ length: 16 }, (_, i) => ({
        x: radius * Math.cos((i * Math.PI) / 8),
        y: h,
        z: -radius * Math.sin((i * Math.PI) / 8),
      })),
    ),
  );
}
/** Front trunnion stays seated in the turret for every elevation. */
export const gunPivot = (e: PreviewEquipment): Vec3 => ({
  x: 0,
  y: e.pivotHeight,
  z: e.body.z - e.body.length * 0.45 + 0.4,
});
function generateEquipmentGeometry(
  h: Hardpoint,
  e: PreviewEquipment,
  yaw = 0,
  elevation = 20,
) {
  const frame = h.modular!.frame,
    parts: PreviewPart[] = [],
    shots: Shot[] = [];
  const append = (
    name: string,
    role: PreviewPart["role"],
    solid: PanelSolid,
    turn = false,
    tilt = false,
  ) => {
    const transformed = {
      indices: solid.indices,
      vertices: solid.vertices.map((p) =>
        worldPoint(
          h.position,
          frame,
          turn
            ? posePoint(
                p,
                yaw,
                tilt ? elevation : 0,
                tilt ? gunPivot(e) : undefined,
              )
            : p,
        ),
      ),
    };
    parts.push({
      id: h.id + "/" + name,
      role,
      solid: transformed,
      bounds: boundsOf(transformed.vertices),
    });
  };
  append(
    "rotation-base",
    "MECHANICAL",
    cylinder(e.footprint.width * 0.43, 0.85, 0),
  );
  append(
    "support-collar",
    "MECHANICAL",
    cylinder(e.footprint.width * 0.25, 0.3, 0.8),
  );
  if (e.kind === "GUN") {
    append(
      "armored-turret",
      "ARMOR",
      facetedBox(
        { x: 0, y: 1 + e.body.height / 2, z: e.body.z },
        { x: e.body.width, y: e.body.height, z: e.body.length },
      ),
      true,
    );
    for (const sign of [-1, 1])
      append(
        "cheek-" + sign,
        "ARMOR",
        facetedBox(
          {
            x: sign * e.body.width * 0.43,
            y: e.pivotHeight,
            z: e.body.z - e.body.length * 0.2,
          },
          {
            x: e.body.width * 0.14,
            y: e.body.height * 0.65,
            z: e.body.length * 0.75,
          },
        ),
        true,
      );
    for (let i = 0; i < e.tubes; i++) {
      const x = (i - (e.tubes - 1) / 2) * e.body.width * 0.3,
        start = e.body.z - e.body.length * 0.45,
        end = start - e.barrel.length;
      append(
        "barrel-" + i,
        "MECHANICAL",
        annularHousing(
          { x, y: e.pivotHeight, z: (start + end) / 2 },
          { x: 0, y: 0, z: 1 },
          e.barrel.radius,
          e.caliberMm! / 2000,
          e.barrel.length,
          10,
        ),
        true,
        true,
      );
      append(
        "mantlet-" + i,
        "ARMOR",
        facetedBox(
          { x, y: e.pivotHeight, z: start + 0.4 },
          { x: e.barrel.radius * 3, y: e.barrel.radius * 3, z: 1.1 },
        ),
        true,
        true,
      );
      const local = posePoint(
        { x, y: e.pivotHeight, z: end - 0.04 },
        yaw,
        elevation,
        gunPivot(e),
      );
      const a = (yaw * Math.PI) / 180,
        t = (elevation * Math.PI) / 180;
      shots.push({
        origin: worldPoint(h.position, frame, local),
        direction: worldDirection(frame, {
          x: -Math.sin(a) * Math.cos(t),
          y: Math.sin(t),
          z: -Math.cos(a) * Math.cos(t),
        }),
      });
    }
  } else {
    append(
      "launcher-cradle",
      "ARMOR",
      facetedBox(
        { x: 0, y: 1 + e.body.height * 0.3, z: 0 },
        { x: e.body.width, y: e.body.height * 0.6, z: e.body.length },
      ),
      true,
    );
    const cols = e.tubes <= 6 ? 2 : 4,
      rows = Math.ceil(e.tubes / cols),
      r = Math.min(e.body.width / (cols * 2.6), e.body.length / (rows * 2.6)),
      height = e.body.height * 0.7;
    for (let i = 0; i < e.tubes; i++) {
      const x = (((i % cols) - (cols - 1) / 2) * e.body.width) / cols,
        z = ((Math.floor(i / cols) - (rows - 1) / 2) * e.body.length) / rows;
      append(
        "launch-tube-" + i,
        "MECHANICAL",
        annularHousing(
          { x, y: 1 + e.body.height * 0.65, z },
          { x: 0, y: 1, z: 0 },
          r,
          r * 0.68,
          height,
          8,
        ),
        true,
      );
      append(
        "tube-interior-" + i,
        "BORE",
        cylinder(r * 0.66, 0.05, 1 + e.body.height * 0.65 - height * 0.4),
        true,
      );
      shots.push({
        origin: worldPoint(
          h.position,
          frame,
          posePoint(
            { x, y: 1 + e.body.height * 0.65 + height / 2 + 0.05, z },
            yaw,
          ),
        ),
        direction: frame.normal,
      });
    }
  }
  return { parts, shots };
}

/** Surface XL interfaces may be flush (standard foundation height zero). A real 25cm
 * support shim lifts this preview assembly; it never changes the slot or hull geometry. */
export function equipmentOrigin(h:Hardpoint){
 if(h.size!=='XL')return h.position;
 const m=h.modular!,depth=Math.max(...m.contacts.map(c=>dot(sub(h.position,c.position),m.frame.normal)));
 return depth<.02?add(h.position,mul(m.frame.normal,.25)):h.position;
}
const prototypes = new WeakMap<
  PreviewEquipment,
  Map<string, ReturnType<typeof generateEquipmentGeometry>>
>();
/** Parameter-space meshes and collision probes are shared across mounts; only the saved
 * local frame transforms their coordinates. No per-frame generation or GPU resource cache. */
export function equipmentGeometry(
  h: Hardpoint,
  e: PreviewEquipment,
  yaw = 0,
  elevation = 20,
) {
  const map =
    prototypes.get(e) ??
    new Map<string, ReturnType<typeof generateEquipmentGeometry>>();
  prototypes.set(e, map);
  const key = yaw + "/" + elevation;
  let prototype = map.get(key);
  if (!prototype) {
    const local = {
      id: "prototype",
      position: { x: 0, y: 0, z: 0 },
      modular: {
        frame: {
          right: { x: 1, y: 0, z: 0 },
          normal: { x: 0, y: 1, z: 0 },
          forward: { x: 0, y: 0, z: -1 },
        },
      },
    } as Hardpoint;
    prototype = generateEquipmentGeometry(local, e, yaw, elevation);
    map.set(key, prototype);
  }
  const frame = h.modular!.frame,origin=equipmentOrigin(h);
  return {
    parts: prototype.parts.map((p) => {
      const solid = {
        vertices: p.solid.vertices.map((v) => worldPoint(origin, frame, v)),
        indices: p.solid.indices,
      };
      provideGeometrySamples(solid, () =>
        geometrySamples(p.solid).map((v) => worldPoint(origin, frame, v)),
      );
      return {
        ...p,
        id: h.id + "/" + p.id.slice("prototype/".length),
        solid,
        bounds: boundsOf(solid.vertices),
      };
    }),
    shots: prototype.shots.map((s) => ({
      origin: worldPoint(origin, frame, s.origin),
      direction: worldDirection(frame, s.direction),
    })),
  };
}
