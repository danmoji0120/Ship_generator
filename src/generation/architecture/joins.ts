import type {
  ArchitectureGrammar,
  StructuralVolume,
  StructuralConnector,
  ShipOrder,
  JoinType,
} from "../../blueprint/types";
import type { Shipyard } from "../../shipyards/config";
import type { SeededRng } from "../../random/rng";
import { boundaryToward } from "./volumes";
export const JOIN_PREFERENCES: Record<
  ArchitectureGrammar,
  readonly JoinType[]
> = {
  MONOLITHIC: ["FLUSH", "TRANSITION", "OVERLAP"],
  BLOCK_ASSEMBLY: [
    "OVERLAP",
    "ARMORED_COLLAR",
    "RECESSED",
    "TRANSITION",
    "FLUSH",
  ],
  SPINE_AND_MODULES: ["STRUCTURAL_NECK", "ARMORED_COLLAR", "RECESSED"],
  TRUSS_POD: ["TRUSS", "BOOM", "NACELLE_MOUNT"],
  TWIN_HULL: ["BRIDGE", "TRUSS", "ARMORED_COLLAR", "TRANSITION"],
  CORE_AND_NACELLES: ["NACELLE_MOUNT", "STRUCTURAL_NECK", "TRUSS"],
  STACKED_BLOCKS: ["OVERLAP", "RECESSED", "ARMORED_COLLAR", "TRANSITION"],
  HYBRID: ["TRUSS", "STRUCTURAL_NECK", "ARMORED_COLLAR", "NACELLE_MOUNT"],
};
/** Endpoints always come from mating body surfaces, including deliberate recessed interfaces. */
export function refineConnections(
  order: ShipOrder,
  yard: Shipyard,
  grammar: ArchitectureGrammar,
  volumes: StructuralVolume[],
  connectors: StructuralConnector[],
  rng: SeededRng,
) {
  const l = order.length;
  const node = volumes.find((v) => v.id === "axis-reinforcement");
  if (node) {
    const a = volumes.find((v) => v.type === "SPINE")!;
    const c: StructuralConnector = {
      id: `link-${connectors.length}`,
      fromStructureId: a.id,
      toStructureId: node.id,
      type: "DIRECT",
      start: a.position,
      end: node.position,
      thickness: l * 0.04,
      style: "armored collar",
    };
    connectors.push(c);
    a.connectionIds.push(c.id);
    node.connectionIds.push(c.id);
  }
  for (const c of connectors) {
    const a = volumes.find((v) => v.id === c.fromStructureId)!,
      b = volumes.find((v) => v.id === c.toStructureId)!;
    c.start = boundaryToward(a, b.position);
    c.end = boundaryToward(b, a.position);
    let distance = Math.hypot(
      c.end.x - c.start.x,
      c.end.y - c.start.y,
      c.end.z - c.start.z,
    );
    const small = Math.min(
      a.dimensions.x,
      a.dimensions.y,
      b.dimensions.x,
      b.dimensions.y,
    );
    const volume = b.dimensions.x * b.dimensions.y * b.dimensions.z;
    let supportLoad = volume * distance * yard.structuralMultiplier;
    const preferences = JOIN_PREFERENCES[grammar];
    const preferred = preferences.filter((t) =>
      yard.joinPreferences.includes(t),
    );
    let type: JoinType = rng.pick([...preferences, ...preferred, ...preferred]);
    if (grammar === "STACKED_BLOCKS")
      type = rng.pick(["OVERLAP", "RECESSED"] as const);
    if (grammar === "TWIN_HULL")
      type = yard.structure === "truss" ? "TRUSS" : "BRIDGE";
    if (c.type === "TRUSS" && grammar !== "TWIN_HULL") type = "TRUSS";
    if (c.type === "BOOM" && b.purpose === "sensor") type = "BOOM";
    if (b.id === "axis-reinforcement") type = "ARMORED_COLLAR";
    if (b.type === "NACELLE" && type === "BOOM") type = "NACELLE_MOUNT";
    // Lateral battery interfaces use real inset, rather than a label on a visible gap.
    if (
      grammar === "BLOCK_ASSEMBLY" &&
      b.id.startsWith("magazine") &&
      Math.abs(b.position.z - a.position.z) + b.dimensions.z / 2 <
        a.dimensions.z * 0.49 &&
      (type === "OVERLAP" || type === "RECESSED")
    ) {
      const inset =
        Math.min(a.dimensions.x, b.dimensions.x) *
        (type === "RECESSED" ? 0.24 : 0.18);
      b.position.x -= Math.sign(b.position.x) * (inset + l * 0.006);
      c.start = boundaryToward(a, b.position);
      c.end = boundaryToward(b, a.position);
      distance = Math.hypot(
        c.end.x - c.start.x,
        c.end.y - c.start.y,
        c.end.z - c.start.z,
      );
      supportLoad = volume * distance * yard.structuralMultiplier;
    }
    c.thickness = Math.max(
      l * 0.012,
      small * (type === "BOOM" ? 0.22 : type === "TRUSS" ? 0.44 : 0.72),
      Math.pow(supportLoad, 0.25) * 0.17,
    );
    if (type === "TRUSS") {
      c.style =
        b.type === "NACELLE" || volume > l ** 3 * 0.003
          ? "box truss"
          : rng.pick(["double beam", "triangular truss"] as const);
      c.type = "TRUSS";
    } else if (type === "BOOM") {
      c.type = "BOOM";
      c.style = "straight beam";
    } else {
      c.style = "armored collar";
      c.type =
        type === "BRIDGE"
          ? "BRIDGE"
          : type === "NACELLE_MOUNT"
            ? "NACELLE_MOUNT"
            : "DIRECT";
    }
    c.join = {
      type,
      length: Math.max(distance, l * 0.006),
      width:
        c.thickness *
        (type === "BRIDGE" ? 1.6 : type === "ARMORED_COLLAR" ? 1.3 : 1),
      height: c.thickness,
      overlap: type === "OVERLAP" ? 0.24 : type === "RECESSED" ? 0.3 : 0,
      inset: type === "RECESSED" ? small * 0.18 : small * 0.05,
      transitionRatio: Math.max(
        0.45,
        Math.min(1.65, a.dimensions.x / b.dimensions.x),
      ),
      armorScale: yard.armor,
      supportScale: c.thickness / small,
      styleVariant: rng.int(0, 2),
      supportLoad,
    };
  }
}
