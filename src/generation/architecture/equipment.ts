import type {
  ShipOrder,
  StructuralVolume,
  EngineMount,
  Hardpoint,
  HardpointType,
  SurfaceFeature,
  ArchitectureGrammar,
} from "../../blueprint/types";
import type { Shipyard } from "../../shipyards/config";
import type { SeededRng } from "../../random/rng";
import { exposedVolumeSurface } from "./volumes";
import { ROLE_RULES, hullSurfaceAt, stationAt } from "../hull";
export function architectureEngines(
  order: ShipOrder,
  yard: Shipyard,
  grammar: ArchitectureGrammar,
  volumes: StructuralVolume[],
  rng: SeededRng,
) {
  let parents = volumes.filter((v) => v.purpose === "propulsion");
  if (!parents.length) parents = [volumes[0]];
  const count =
    parents.length === 4
      ? 4
      : parents.length === 2
        ? order.priorities.mobility > 75 || grammar === "TWIN_HULL"
          ? 4
          : 2
        : order.priorities.mobility > 75
          ? 4
          : rng.pick(yard.engines);
  const engines: EngineMount[] = [];
  for (const parent of parents) {
    const stations = parent.geometry.stations,
      rear = stations.at(-1)!,
      per = count / parents.length;
    const r =
      Math.min(
        rear.width / (per > 2 ? 10 : per === 2 ? 6 : 4.5),
        rear.height / (per > 2 ? 8 : 4.5),
      ) *
      (0.82 + order.priorities.mobility * 0.003);
    for (let i = 0; i < per; i++) {
      const cols = per > 2 ? per / 2 : per;
      const x =
        per === 1 ? 0 : ((i % cols) - (cols - 1) / 2) * rear.width * 0.28;
      const y = per > 2 ? (i < cols ? -1 : 1) * rear.height * 0.16 : 0;
      engines.push({
        id: `engine-${engines.length}`,
        parentId: parent.id,
        position: {
          x: parent.position.x + x,
          y: parent.position.y + y,
          z: parent.position.z + rear.z,
        },
        direction: { x: 0, y: 0, z: 1 },
        nozzleRadius: r,
        nozzleLength:
          order.length * (0.028 + order.priorities.mobility * 0.00018),
        bellRatio: 1.22,
      });
    }
  }
  const engineArchitecture =
    grammar === "TWIN_HULL"
      ? "Twin Hull Independent Engines"
      : grammar === "TRUSS_POD" || grammar === "HYBRID"
        ? "Truss-mounted Engines"
        : grammar === "CORE_AND_NACELLES"
          ? "Detached Nacelles"
          : grammar === "SPINE_AND_MODULES"
            ? "Distributed Rear"
            : count === 1
              ? "Central Engine Block"
              : count === 2
                ? "Twin Integrated"
                : count === 4
                  ? "Quad Cluster"
                  : "Distributed Rear";
  return { engines, engineArchitecture };
}
export function architectureEquipment(
  order: ShipOrder,
  volumes: StructuralVolume[],
) {
  const l = order.length,
    p = order.priorities,
    hardpoints: Hardpoint[] = [],
    surfaceFeatures: SurfaceFeature[] = [];
  const eligible = volumes.filter(
    (v) => v.type !== "SPINE" && v.type !== "NACELLE",
  );
  const hulls = eligible.length ? eligible : [volumes[0]];
  const weapons = hulls.filter((v) => v.purpose === "weapon");
  const weaponsOrHull = weapons.length ? weapons : hulls;
  const commands = hulls.filter(
    (v) => v.purpose === "command" || v.purpose === "sensor",
  );
  const plan: { type: HardpointType; volume: StructuralVolume }[] = [];
  const budget = Math.round(
    ROLE_RULES[order.role].budget * (0.35 + p.firepower * 0.012),
  );
  for (let i = 0; i < budget; i++)
    plan.push({
      type:
        p.firepower > 70 && i % 4 === 0
          ? "Large Turret"
          : i % 3 === 0
            ? "Small Turret"
            : "Medium Turret",
      volume: hulls[i % hulls.length],
    });
  for (
    let i = 0;
    i < Math.round(p.missile / 12) + (order.role === "Missile Ship" ? 10 : 0);
    i++
  )
    plan.push({
      type: "Missile",
      volume: weaponsOrHull[i % weaponsOrHull.length],
    });
  for (let i = 0; i < 2 + Math.floor(p.survivability / 25); i++)
    plan.push({ type: "Point Defense", volume: hulls[i % hulls.length] });
  for (let i = 0; i < 1 + Math.floor(p.sensor / 25); i++)
    plan.push({
      type: "Sensor",
      volume: (commands.length ? commands : hulls)[
        i % (commands.length || hulls.length)
      ],
    });
  plan.push({ type: "Utility", volume: hulls[0] });
  const counts = new Map<string, number>();
  for (const item of plan)
    counts.set(item.volume.id, (counts.get(item.volume.id) ?? 0) + 1);
  const occupied = new Map<string, number>();
  for (const { type, volume: v } of plan) {
    const index = occupied.get(v.id) ?? 0;
    occupied.set(v.id, index + 1);
    const rows = Math.ceil(counts.get(v.id)! / 2),
      z =
        (-0.28 +
          (rows === 1 ? 0.28 : (Math.floor(index / 2) / (rows - 1)) * 0.56)) *
        v.dimensions.z,
      s = stationAt(v.geometry.stations, z),
      x =
        (index % 2 ? -1 : 1) *
        s.width *
        (volumes.some((v) => v.id === "armored-keel") && v.id !== "command-deck"
          ? 0.44
          : 0.15);
    const surface = exposedVolumeSurface(
      volumes,
      v.position.x + x,
      v.position.z + z,
    );
    const size =
      type === "Large Turret" ? "L" : type === "Medium Turret" ? "M" : "S";
    const radius = Math.min(
      l * (size === "L" ? 0.017 : size === "M" ? 0.012 : 0.008),
      v.dimensions.x * 0.12,
      (v.dimensions.z * 0.115) / rows,
    );
    hardpoints.push({
      id: `mount-${hardpoints.length}`,
      type,
      size,
      parentId: surface.parentId,
      position: { x: v.position.x + x, y: surface.y, z: v.position.z + z },
      normal: surface.normal,
      radius,
      allowedCategories:
        type === "Missile"
          ? ["missile"]
          : type === "Sensor"
            ? ["sensor", "electronic-warfare"]
            : type === "Utility"
              ? ["utility"]
              : ["turret"],
    });
  }
  const axis =
    volumes.find((v) => v.type === "SPINE") ??
    volumes.find((v) => v.purpose === "axial-weapon");
  if (axis && (order.role === "Spinal Gun Ship" || p.firepower > 92))
    hardpoints.push({
      id: `mount-${hardpoints.length}`,
      type: "Spinal",
      size: "XL",
      parentId: axis.id,
      position: {
        x: axis.position.x,
        y: axis.position.y,
        z: axis.position.z + axis.geometry.stations[0].z,
      },
      normal: { x: 0, y: 0, z: -1 },
      radius: Math.min(
        l * 0.034,
        axis.geometry.stations[0].width * 0.34,
        axis.geometry.stations[0].height * 0.34,
      ),
      allowedCategories: ["spinal-energy", "spinal-kinetic"],
    });
  for (const v of volumes) {
    const stations = v.geometry.stations;
    for (let i = 1; i < stations.length - 1; i++) {
      const z = stations[i].z;
      for (const side of [-1, 1]) {
        const x = side * stations[i].width * 0.3,
          s = hullSurfaceAt(stations, z, x);
        surfaceFeatures.push({
          id: `detail-${surfaceFeatures.length}`,
          kind: v.type === "NACELLE" ? "vent" : i % 3 === 0 ? "hatch" : "panel",
          parentId: v.id,
          position: {
            x: v.position.x + x,
            y: v.position.y + s.y + l * 0.0008,
            z: v.position.z + z,
          },
          normal: s.normal,
          size: {
            x: stations[i].width * 0.16,
            y: l * 0.0008,
            z: v.dimensions.z * 0.025,
          },
        });
      }
    }
  }
  return { hardpoints, surfaceFeatures };
}
