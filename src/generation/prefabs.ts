import type {
  PrefabKind,
  PrefabPlacement,
  PrefabSocket,
  ShipOrder,
  StructuralConnector,
  StructuralVolume,
  Vec3,
} from "../blueprint/types";
import type { Shipyard } from "../shipyards/config";
import { profileRing, stationAt } from "./hull";
import { containsVolume } from "./architecture/volumes";
import { SeededRng } from "../random/rng";

/** A small reusable library; geometry is parametric, while each socket and variant is stored in the blueprint. */
export const PREFAB_LIBRARY: Record<PrefabKind, {
  functionality: PrefabPlacement["functionality"];
  socketKind: PrefabSocket["kind"];
}> = {
  ARMOR_PLATE: { functionality: "protection", socketKind: "HULL_SIDE" },
  RADIATOR_BANK: { functionality: "thermal", socketKind: "HULL_SIDE" },
  JOINT_HOUSING: { functionality: "structural", socketKind: "CONNECTOR_END" },
};

function sideSocket(v: StructuralVolume, side: -1 | 1, fraction: number): PrefabSocket {
  const z = v.geometry.stations[0].z +
    (v.geometry.stations.at(-1)!.z - v.geometry.stations[0].z) * fraction;
  const ring = profileRing(stationAt(v.geometry.stations, z));
  // Midpoint of the actual flank edge, including chamfered and six-sided hulls.
  const edge = side === 1
    ? [ring[2], ring[3]]
    : [ring[6], ring[7]];
  const x = (edge[0][0] + edge[1][0]) * 0.5;
  const y = (edge[0][1] + edge[1][1]) * 0.5;
  const dx = edge[1][0] - edge[0][0];
  const dy = edge[1][1] - edge[0][1];
  const norm = Math.hypot(dx, dy);
  // Profile ring is clockwise, so the outside normal is the left-hand normal.
  const normal = { x: -dy / norm, y: dx / norm, z: 0 };
  return {
    kind: "HULL_SIDE",
    hostId: v.id,
    position: {
      x: v.position.x + x,
      y: v.position.y + y,
      z: v.position.z + z,
    },
    normal,
  };
}

function connectedSocket(c: StructuralConnector, atEnd: boolean): PrefabSocket {
  const delta = {
    x: c.end.x - c.start.x,
    y: c.end.y - c.start.y,
    z: c.end.z - c.start.z,
  };
  const dist = Math.hypot(delta.x, delta.y, delta.z);
  const direction = {
    x: delta.x / dist,
    y: delta.y / dist,
    z: delta.z / dist,
  };
  return {
    kind: "CONNECTOR_END",
    hostId: c.id,
    position: atEnd ? { ...c.end } : { ...c.start },
    normal: atEnd
      ? direction
      : { x: -direction.x, y: -direction.y, z: -direction.z },
  };
}

export function generatePrefabPlacements(
  order: ShipOrder,
  yard: Shipyard,
  volumes: StructuralVolume[],
  connectors: StructuralConnector[],
  seed: number,
): PrefabPlacement[] {
  const rng = new SeededRng((seed ^ 0x4b17ba5e) >>> 0);
  const result: PrefabPlacement[] = [];
  const l = order.length;
  const eligible = volumes
    .filter((v) =>
      v.type !== "SPINE" &&
      v.dimensions.z > l * 0.13 &&
      v.dimensions.y > l * 0.017 &&
      v.dimensions.x > l * 0.042)
    .sort((a, b) =>
      b.dimensions.x * b.dimensions.y * b.dimensions.z -
      a.dimensions.x * a.dimensions.y * a.dimensions.z);
  // Limit density; these attachments should clarify the silhouette, not bury it.
  const hulls = eligible.slice(0, yard.structure === "heavy" ? 2 : 1);
  const armorRows = order.priorities.survivability < 20
    ? 0
    : yard.structure === "heavy"
      ? 2
      : 1;
  for (const v of hulls) {
    for (const side of [-1, 1] as const) {
      for (let row = 0; row < armorRows; row++) {
        const socket = sideSocket(v, side, 0.30 + row * 0.20);
        const size: Vec3 = {
          x: Math.min(v.dimensions.y * 0.48, l * 0.061),
          y: l * (0.003 + yard.armor * 0.003),
          z: Math.min(v.dimensions.z * 0.16, l * 0.09),
        };
        // No panel may be embedded in a neighbouring structural body.
        if (volumes.some((other) => other.id !== v.id &&
          containsVolume(other, socket.position, l * 0.001))) continue;
        result.push({
          id: "kit-armor-" + result.length,
          kind: "ARMOR_PLATE",
          socket,
          dimensions: size,
          variant: rng.int(0, 2),
          functionality: "protection",
        });
      }
    }
  }
  if (order.priorities.endurance >= 15 || order.priorities.mobility >= 65) {
    const radiatorHost = eligible.find((v) =>
      v.purpose === "propulsion" || v.purpose === "supply") ?? eligible[0];
    if (radiatorHost) {
      for (const side of [-1, 1] as const) {
        const socket = sideSocket(radiatorHost, side, 0.77);
        const size: Vec3 = {
          x: Math.min(radiatorHost.dimensions.y * 0.70, l * 0.07),
          y: l * (yard.structure === "swift" ? 0.035 : 0.02),
          z: Math.min(radiatorHost.dimensions.z * 0.26, l * 0.145),
        };
        const tip = {
          x: socket.position.x + socket.normal.x * size.y,
          y: socket.position.y + socket.normal.y * size.y,
          z: socket.position.z,
        };
        if (volumes.some((other) => other.id !== radiatorHost.id &&
          (containsVolume(other, socket.position, l * 0.001) ||
            containsVolume(other, tip, l * 0.001)))) continue;
        result.push({
          id: "kit-radiator-" + result.length,
          kind: "RADIATOR_BANK",
          socket,
          dimensions: size,
          variant: yard.structure === "swift" ? 2 : rng.int(0, 2),
          functionality: "thermal",
        });
      }
    }
  }
  for (const c of connectors) {
    const length = Math.hypot(
      c.end.x - c.start.x,
      c.end.y - c.start.y,
      c.end.z - c.start.z,
    );
    if (
      length <= l * 0.014 ||
      !["TRUSS", "BOOM", "BRIDGE", "NACELLE_MOUNT"].includes(c.type)
    ) continue;
    for (const atEnd of [false, true]) {
      result.push({
        id: "kit-joint-" + result.length,
        kind: "JOINT_HOUSING",
        socket: connectedSocket(c, atEnd),
        dimensions: {
          x: c.thickness * (1.3 + yard.structuralMultiplier * 0.15),
          y: Math.min(length * 0.15, c.thickness * 0.65),
          z: c.thickness * (1.3 + yard.structuralMultiplier * 0.15),
        },
        variant: rng.int(0, 2),
        functionality: "structural",
      });
    }
  }
  return result;
}
