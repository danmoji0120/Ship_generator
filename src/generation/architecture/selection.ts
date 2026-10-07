import {
  ARCHITECTURES,
  type ArchitectureGrammar,
  type ShipOrder,
} from "../../blueprint/types";
import type { Shipyard } from "../../shipyards/config";
import type { SeededRng } from "../../random/rng";
export function architectureWeights(order: ShipOrder, yard: Shipyard) {
  const w = { ...yard.architectureWeights },
    p = order.priorities;
  const multiply = (values: Partial<Record<ArchitectureGrammar, number>>) => {
    for (const [key, value] of Object.entries(values))
      w[key as ArchitectureGrammar] *= value!;
  };
  if (order.role === "Spinal Gun Ship")
    multiply({
      SPINE_AND_MODULES: 12,
      MONOLITHIC: 1.8,
      BLOCK_ASSEMBLY: 0.35,
      TRUSS_POD: 0.3,
      STACKED_BLOCKS: 0.2,
      CORE_AND_NACELLES: 0.4,
      TWIN_HULL: 0.9,
      HYBRID: 2,
    });
  if (order.role === "Missile Ship")
    multiply({
      BLOCK_ASSEMBLY: 3.5,
      TRUSS_POD: 4,
      STACKED_BLOCKS: 2.5,
      MONOLITHIC: 0.8,
      SPINE_AND_MODULES: 0.7,
    });
  if (order.role === "Battleship" || order.role === "Battlecruiser")
    multiply({
      MONOLITHIC: 3.5,
      BLOCK_ASSEMBLY: 3,
      STACKED_BLOCKS: 3,
      SPINE_AND_MODULES: 0.3,
      TRUSS_POD: 0.3,
      CORE_AND_NACELLES: 0.25,
      TWIN_HULL: 0.7,
      HYBRID: 0.5,
    });
  if (
    order.role === "Destroyer" ||
    order.role === "Corvette" ||
    order.role === "Patrol Ship"
  )
    multiply({
      CORE_AND_NACELLES: 2,
      SPINE_AND_MODULES: 1.7,
      STACKED_BLOCKS: 0.3,
      MONOLITHIC: 0.65,
    });
  multiply({
    MONOLITHIC: 1 + p.survivability / 100,
    BLOCK_ASSEMBLY: 1 + (p.missile + p.survivability) / 150,
    CORE_AND_NACELLES: 0.6 + p.mobility / 50,
    SPINE_AND_MODULES: 0.7 + p.mobility / 100,
    TRUSS_POD: 0.7 + (p.missile + p.endurance) / 150,
  });
  if (order.length < 100 || order.massClass === "Light")
    multiply({
      STACKED_BLOCKS: 0.5,
      BLOCK_ASSEMBLY: 0.7,
      HYBRID: 0.5,
      CORE_AND_NACELLES: 1.4,
    });
  if (order.length > 400 || order.massClass === "Superheavy")
    multiply({ MONOLITHIC: 1.5, STACKED_BLOCKS: 1.5, BLOCK_ASSEMBLY: 1.3 });
  return w;
}
export function selectArchitecture(
  order: ShipOrder,
  yard: Shipyard,
  rng: SeededRng,
) {
  const weights = architectureWeights(order, yard);
  let ticket = rng.next() * Object.values(weights).reduce((a, b) => a + b, 0);
  for (const grammar of ARCHITECTURES) {
    ticket -= weights[grammar];
    if (ticket <= 0) return { grammar, weights };
  }
  return { grammar: "MONOLITHIC" as ArchitectureGrammar, weights };
}
