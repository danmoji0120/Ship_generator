import type { ShipBlueprint } from "../blueprint/types";
import { planEquipmentPreview, type PreviewRequest } from "./fitment";
let blueprint: ShipBlueprint | undefined;
self.onmessage = (
  event: MessageEvent<{
    id: number;
    blueprint?: ShipBlueprint;
    request: PreviewRequest;
  }>,
) => {
  try {
    blueprint = event.data.blueprint ?? blueprint;
    if (!blueprint) throw Error("No preview Blueprint");
    self.postMessage({
      id: event.data.id,
      plan: planEquipmentPreview(blueprint, event.data.request),
    });
  } catch (error) {
    self.postMessage({ id: event.data.id, error: String(error) });
  }
};
