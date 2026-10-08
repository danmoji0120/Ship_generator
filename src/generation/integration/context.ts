import type {
  ShipBlueprint,
  ExteriorKind,
  ExteriorDefinition,
  StructuralVolume,
  PrefabSocket,
  Vec3,
} from "../../blueprint/types";
import type { getShipyard } from "../../shipyards/config";
export type ExteriorFit = Omit<
  ExteriorDefinition,
  "matingSockets" | "parentIds" | "protectionGrade"
>;
export interface IntegrationContext {
  b: ShipBlueprint;
  yard: ReturnType<typeof getShipyard>;
  l: number;
  p: ShipBlueprint["order"]["priorities"];
  vs: StructuralVolume[];
  inset: number;
  decisions: NonNullable<ShipBlueprint["hullIntegration"]>["decisions"];
  socket: (v: StructuralVolume, position: Vec3, normal: Vec3) => PrefabSocket;
  emit: (
    kind: ExteriorKind,
    sourceId: string,
    sockets: PrefabSocket[],
    fit: ExteriorFit,
  ) => boolean;
}
