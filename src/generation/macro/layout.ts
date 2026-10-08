import type { StructuralVolume, ShipOrder } from "../../blueprint/types";
import type { MacroDesignPlan } from "./types";
import { syncShape } from "../shapes/definition";
/** Consume the precomputed assembly contract before Join, propulsion, equipment, or Integration. */
export function realizeMacroLayout(
  order: ShipOrder,
  volumes: StructuralVolume[],
  plan: MacroDesignPlan,
) {
  for (const m of plan.majorModuleRoles) {
    let v = volumes.find((v) => v.id === m.id);
    if (!v) {
      v = {
        id: m.id,
        type: "ARMOR_BLOCK",
        purpose: m.purpose,
        position: m.position,
        rotation: { x: 0, y: 0, z: 0 },
        dimensions: m.dimensions,
        geometry: { primitive: "Chamfered Box", stations: [] },
        connectionIds: [],
      };
      volumes.push(v);
    }
    v.position = structuredClone(m.position);
    v.dimensions = structuredClone(m.dimensions);
    v.shape = structuredClone(m.shape);
    v.purpose = m.purpose;
    v.hierarchyTier =
      m.role === "dominant" ? 1 : m.role === "supporting" ? 2 : 3;
    syncShape(v);
  }
  if (volumes.some((v) => !plan.majorModuleRoles.some((m) => m.id === v.id)))
    throw new Error(`Unplanned Macro structure for ${plan.architecture}`);
  if (order.length <= 0) throw new Error("Invalid Macro scale");
  return plan.composition;
}
