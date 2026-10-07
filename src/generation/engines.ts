import type {
  EngineMount,
  HullStation,
  SecondaryStructure,
  ShipOrder,
} from "../blueprint/types";
import type { Shipyard } from "../shipyards/config";
import type { SeededRng } from "../random/rng";
export function generateEngines(
  order: ShipOrder,
  yard: Shipyard,
  stations: HullStation[],
  modules: SecondaryStructure[],
  rng: SeededRng,
) {
  const l = order.length,
    engines: EngineMount[] = [],
    rear = stations.at(-1)!;
  const count =
    yard.structure === "truss"
      ? rng.pick([2, 4, 6])
      : order.priorities.mobility > 75
        ? yard.structure === "swift"
          ? 6
          : 4
        : rng.pick(yard.engines);
  const radius = Math.min(
    rear.width / (count > 2 ? 7 : 4),
    rear.height / (count > 2 ? 5 : 3),
    l * (0.013 + order.priorities.mobility * 0.00012),
  );
  const add = (x: number, y: number, z: number, r: number, parentId: string) =>
    engines.push({
      id: `engine-${engines.length}`,
      position: { x, y, z },
      nozzleRadius: r,
      nozzleLength: l * (0.025 + order.priorities.mobility * 0.00022),
      bellRatio: 1.23,
      parentId,
    });
  if (yard.structure === "truss") {
    const nacelles = modules.filter((m) => m.kind === "nacelle");
    for (const m of nacelles)
      for (let i = 0; i < count / 2; i++)
        add(
          m.position.x + (i - (count / 2 - 1) / 2) * m.size.x * 0.28,
          m.position.y,
          m.position.z + m.size.z / 2,
          m.size.x / (count > 2 ? 6 : 3.5),
          m.id,
        );
  } else if (count === 1) add(0, 0, rear.z, radius * 1.25, "hull");
  else if (count === 2)
    for (const x of [-1, 1])
      add(x * rear.width * 0.23, 0, rear.z, radius, "hull");
  else
    for (let i = 0; i < count; i++) {
      const cols = count / 2;
      add(
        ((i % cols) - (cols - 1) / 2) * rear.width * 0.3,
        (i < cols ? -1 : 1) * rear.height * 0.22,
        rear.z,
        radius,
        "hull",
      );
    }
  return {
    engines,
    enginePattern:
      yard.structure === "truss"
        ? "Distributed nacelle"
        : count === 1
          ? "Central"
          : count === 2
            ? "Twin"
            : `${count} cluster`,
  };
}
