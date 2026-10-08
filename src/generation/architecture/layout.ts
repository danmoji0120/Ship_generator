import type { MacroDesignPlan } from "../macro/types";
import type {
  ArchitectureGrammar,
  StructuralVolume,
  StructuralConnector,
  ShipOrder,
  VolumeType,
  VolumePrimitive,
  NoseArchitecture,
} from "../../blueprint/types";
import type { Shipyard } from "../../shipyards/config";
import type { SeededRng } from "../../random/rng";
import { generateHull } from "../hull";
import { primitiveStations, boundaryToward, volumeBounds } from "./volumes";
import { composeLayout } from "./composition";
import { refineConnections } from "./joins";
import { syncShape } from "../shapes/definition";
export function architectureLayout(
  order: ShipOrder,
  yard: Shipyard,
  grammar: ArchitectureGrammar,
  rng: SeededRng,
  macro?: MacroDesignPlan,
) {
  const l = order.length,
    p = order.priorities,
    volumes: StructuralVolume[] = [],
    connectors: StructuralConnector[] = [];
  const mass = { Light: 0.83, Standard: 1, Heavy: 1.13, Superheavy: 1.25 }[
    order.massClass
  ];
  const heavy = order.role === "Battleship" || order.role === "Battlecruiser";
  const beam =
    (heavy
      ? 0.37
      : order.role === "Missile Ship"
        ? 0.32
        : order.role === "Spinal Gun Ship"
          ? 0.18
          : 0.25) *
    yard.width *
    mass *
    (0.83 + p.survivability * 0.003 - p.mobility * 0.0015) *
    rng.range(0.9, 1.1);
  const armor =
    (heavy ? 0.15 : 0.105) *
    yard.height *
    Math.sqrt(mass) *
    (0.8 + p.survivability * 0.002 + p.endurance * 0.002);
  const variant = rng.int(0, 2),
    spread = rng.range(0.92, 1.1);
  let nose: NoseArchitecture =
    order.role === "Spinal Gun Ship"
      ? "spinal muzzle"
      : grammar === "TWIN_HULL"
        ? "split nose"
        : grammar === "BLOCK_ASSEMBLY" || grammar === "STACKED_BLOCKS"
          ? "block nose"
          : heavy
            ? "blunt armored"
            : yard.structure === "truss"
              ? "tapered industrial"
              : order.role === "Patrol Ship"
                ? "sensor nose"
                : rng.pick(["pointed", "wedge"] as const);
  const add = (
    id: string,
    type: VolumeType,
    purpose: StructuralVolume["purpose"],
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    primitive: VolumePrimitive = "Chamfered Box",
  ) => {
    const dimensions = { x: w * l, y: h * l, z: d * l };
    const profile =
      yard.structure === "clean"
        ? "flattened"
        : primitive === "Long Loft"
          ? rng.pick(yard.profiles)
          : yard.structure === "swift"
            ? "hex"
            : "chamfer";
    const v: StructuralVolume = {
      id,
      type,
      purpose,
      position: { x: x * l, y: y * l, z: z * l },
      rotation: { x: 0, y: 0, z: 0 },
      dimensions,
      geometry: {
        primitive,
        stations: primitiveStations(primitive, dimensions, profile, nose),
      },
      connectionIds: [],
    };
    volumes.push(v);
    return v;
  };
  const link = (
    a: StructuralVolume,
    b: StructuralVolume,
    type: StructuralConnector["type"] = "DIRECT",
    style?: StructuralConnector["style"],
  ) => {
    const start = boundaryToward(a, b.position),
      end = boundaryToward(b, a.position),
      small = Math.min(
        a.dimensions.x,
        a.dimensions.y,
        b.dimensions.x,
        b.dimensions.y,
      );
    const thickness =
      type === "DIRECT" || type === "BRIDGE"
        ? small * 0.66
        : Math.max(l * 0.012, small * 0.25);
    const c: StructuralConnector = {
      id: `link-${connectors.length}`,
      fromStructureId: a.id,
      toStructureId: b.id,
      type,
      start,
      end,
      thickness,
      style:
        style ??
        (type === "TRUSS"
          ? rng.pick(["double beam", "triangular truss", "box truss"] as const)
          : type === "DIRECT"
            ? "armored collar"
            : "straight beam"),
    };
    connectors.push(c);
    a.connectionIds.push(c.id);
    b.connectionIds.push(c.id);
    return c;
  };
  const components: ArchitectureGrammar[] =
    grammar === "HYBRID" ? ["SPINE_AND_MODULES", "TRUSS_POD"] : [grammar];
  const base = grammar === "HYBRID" ? "SPINE_AND_MODULES" : grammar;
  if (base === "MONOLITHIC") {
    const hull = add(
      "citadel",
      "PRIMARY_HULL",
      order.role === "Spinal Gun Ship" ? "axial-weapon" : "habitat",
      0,
      0,
      0,
      beam,
      armor,
      1,
      "Long Loft",
    );
    hull.geometry.stations = generateHull(order, yard, rng);
    hull.dimensions.x = Math.max(...hull.geometry.stations.map((s) => s.width));
    hull.dimensions.y = Math.max(
      ...hull.geometry.stations.map((s) => s.height),
    );
    if (nose !== "pointed")
      for (let i = 0; i < 3; i++) {
        const station = hull.geometry.stations[i];
        station.width = Math.max(
          station.width,
          hull.dimensions.x *
            ((nose === "spinal muzzle" ? 0.35 : 0.25) + i * 0.11),
        );
        station.height = Math.max(
          station.height,
          hull.dimensions.y * (0.58 + i * 0.09),
        );
      }
  } else if (base === "BLOCK_ASSEMBLY") {
    const fore = add(
      "fore-armor",
      "ARMOR_BLOCK",
      "armor",
      0,
      0,
      -0.34,
      beam * 0.68,
      armor * 0.9,
      0.3,
      "Wedge",
    );
    const core = add(
      "combat-core",
      "HULL_BLOCK",
      "weapon",
      0,
      0,
      -0.04,
      beam,
      armor * 1.15,
      0.27,
    );
    const drive = add(
      "drive-block",
      "HULL_BLOCK",
      "propulsion",
      0,
      -armor * 0.02,
      0.305,
      beam * 0.88,
      armor,
      0.35,
      "Tapered Box",
    );
    link(fore, core);
    link(core, drive);
    for (const side of [-1, 1]) {
      const pod = add(
        `magazine-${side}`,
        "ARMOR_BLOCK",
        p.missile > 40 ? "weapon" : "supply",
        side * (beam * 0.5 + beam * 0.2 + 0.022),
        0,
        -0.02,
        beam * 0.4,
        armor * 0.85,
        0.23 + variant * 0.035,
        "Hexagonal Prism",
      );
      link(core, pod, "DIRECT");
    }
  } else if (base === "SPINE_AND_MODULES") {
    const spine = add(
      "axial-spine",
      "SPINE",
      "axial-weapon",
      0,
      0,
      0,
      order.role === "Spinal Gun Ship" ? 0.075 : 0.045,
      order.role === "Spinal Gun Ship" ? 0.075 : 0.045,
      1,
      "Long Loft",
    );
    for (const side of [-1, 1]) {
      const gap = grammar === "HYBRID" ? 0.1 : 0.025;
      const x =
        side * ((spine.dimensions.x / l) * 0.5 + beam * 0.24 + gap) * spread;
      const breech = add(
        `breech-${side}`,
        "POD",
        p.missile > 70 ? "weapon" : "habitat",
        x,
        0,
        0.035,
        beam * 0.44,
        armor,
        0.28 + variant * 0.025,
        "Tapered Box",
      );
      const drive = add(
        `drive-${side}`,
        "NACELLE",
        "propulsion",
        x,
        0,
        0.36,
        beam * 0.4,
        armor * 0.95,
        0.26,
        "Rounded Box",
      );
      link(
        spine,
        breech,
        grammar === "HYBRID" ? "TRUSS" : "BOOM",
        grammar === "HYBRID" ? "box truss" : "double beam",
      );
      link(breech, drive, "DIRECT");
    }
  } else if (base === "TRUSS_POD") {
    const core = add(
      "pressure-core",
      "HULL_BLOCK",
      "habitat",
      0,
      0,
      -0.1,
      beam * 0.7,
      armor * 1.1,
      0.33,
      "Short Loft",
    );
    const fore = add(
      "sensor-forebody",
      "POD",
      "sensor",
      0,
      0,
      -0.405,
      beam * 0.33,
      armor * 0.65,
      0.18,
      "Tapered Box",
    );
    link(core, fore, "BOOM", variant === 2 ? "straight beam" : "double beam");
    for (const side of [-1, 1]) {
      const pod = add(
        `weapon-pod-${side}`,
        "POD",
        p.missile > 40 ? "weapon" : "supply",
        side * (beam * 0.58 + 0.14) * spread,
        0,
        -0.035,
        beam * 0.46,
        armor,
        0.32 + variant * 0.025,
        "Hexagonal Prism",
      );
      const drive = add(
        `engine-pod-${side}`,
        "NACELLE",
        "propulsion",
        side * (beam * 0.4 + 0.12),
        0,
        0.345,
        beam * 0.4,
        armor * 0.94,
        0.27,
        "Rounded Box",
      );
      link(
        core,
        pod,
        "TRUSS",
        variant === 0
          ? "triangular truss"
          : variant === 1
            ? "box truss"
            : "double beam",
      );
      link(core, drive, "TRUSS", "box truss");
    }
  } else if (base === "TWIN_HULL") {
    const separation = (beam * 0.43 + 0.1) * spread;
    const central = add(
      "central-bridge",
      order.role === "Spinal Gun Ship" ? "SPINE" : "HULL_BLOCK",
      order.role === "Spinal Gun Ship" ? "axial-weapon" : "command",
      0,
      0,
      -0.03,
      beam * 0.36,
      armor * 0.68,
      order.role === "Spinal Gun Ship" ? 1 : 0.24,
      "Tapered Box",
    );
    for (const side of [-1, 1]) {
      const hull = add(
        `independent-hull-${side}`,
        "PRIMARY_HULL",
        "propulsion",
        side * separation,
        0,
        variant === 1 ? 0.015 : 0,
        beam * 0.56,
        armor,
        0.94,
        "Long Loft",
      );
      link(
        central,
        hull,
        yard.structure === "truss" ? "TRUSS" : "BRIDGE",
        yard.structure === "truss" ? "box truss" : "armored collar",
      );
    }
  } else if (base === "CORE_AND_NACELLES") {
    const core = add(
      "command-core",
      "HULL_BLOCK",
      "command",
      0,
      0,
      -0.205,
      beam * 0.82,
      armor * 1.1,
      0.59,
      "Short Loft",
    );
    for (const side of [-1, 1]) {
      const drive = add(
        `lateral-drive-${side}`,
        "NACELLE",
        "propulsion",
        side * (beam * 0.45 + 0.135) * spread,
        0,
        0.325,
        beam * 0.34,
        armor * 0.78,
        0.33,
        "Long Loft",
      );
      link(
        core,
        drive,
        yard.structure === "truss" ? "TRUSS" : "NACELLE_MOUNT",
        "double beam",
      );
      const dorsal = add(
        `vertical-drive-${side}`,
        "NACELLE",
        "propulsion",
        0,
        side * (armor * 0.5 + 0.09),
        0.325,
        beam * 0.32,
        armor * 0.72,
        0.33,
        "Long Loft",
      );
      link(core, dorsal, "NACELLE_MOUNT", "box truss");
    }
  } else if (base === "STACKED_BLOCKS") {
    const keel = add(
      "armored-keel",
      "ARMOR_BLOCK",
      "propulsion",
      0,
      -armor * 0.9,
      0,
      beam,
      armor,
      0.96,
      "Tapered Box",
    );
    const middle = add(
      "magazine-deck",
      "HULL_BLOCK",
      p.missile > 40 ? "weapon" : "habitat",
      0,
      armor * 0.25,
      -0.08,
      beam * 0.8,
      armor * 0.9,
      0.64,
      "Wedge",
    );
    const upper = add(
      "command-deck",
      "ARMOR_BLOCK",
      "command",
      0,
      armor * 1.36,
      0.025,
      beam * 0.57,
      armor * 0.75,
      0.38,
      "Chamfered Box",
    );
    link(keel, middle, "BRIDGE");
    link(middle, upper, "DIRECT");
  }
  const composition = composeLayout(order, yard, grammar, volumes, rng, macro);
  if (
    order.role !== "Spinal Gun Ship" &&
    ["BLOCK_ASSEMBLY", "STACKED_BLOCKS"].includes(grammar)
  )
    nose =
      yard.structure === "truss"
        ? rng.pick(["block nose", "tapered industrial"] as const)
        : rng.pick(["wedge", "blunt armored", "block nose"] as const);
  if (composition === "CENTRAL_SPINAL") nose = "spinal muzzle";
  const front = Math.min(
    ...volumes.map((v) => v.position.z - v.dimensions.z / 2),
  );
  for (const v of volumes.filter(
    (v) => v.position.z - v.dimensions.z / 2 < front + l * 0.025,
  )) {
    if (!v.shape || macro) continue;
    if (nose === "pointed") v.shape.frontScale = 0.08;
    if (nose === "spinal muzzle") {
      v.shape.frontScale = 0.82;
      v.shape.rearScale = 0.95;
    }
    if (nose === "blunt armored" || nose === "block nose")
      v.shape.frontScale = 0.78;
    if (nose === "sensor nose") {
      v.shape.frontScale = 0.6;
      v.shape.frontProfile = "rounded";
    }
    if (nose === "wedge") v.shape.frontScale = 0.18;
    if (nose === "tapered industrial") v.shape.frontScale = 0.43;
    syncShape(v);
  }
  // Normalize only longitudinal extent: requested length remains meaningful for every grammar.
  const min = Math.min(
      ...volumes.map((v) => v.position.z + v.geometry.stations[0].z),
    ),
    max = Math.max(
      ...volumes.map((v) => v.position.z + v.geometry.stations.at(-1)!.z),
    ),
    stretch = macro ? 1 : l / (max - min),
    center = macro ? 0 : (max + min) / 2;
  for (const v of volumes) {
    v.position.z = (v.position.z - center) * stretch;
    v.dimensions.z *= stretch;
    for (const s of v.geometry.stations) s.z *= stretch;
  }
  for (const c of connectors) {
    c.start.z = (c.start.z - center) * stretch;
    c.end.z = (c.end.z - center) * stretch;
  }
  const bounds = volumeBounds(volumes),
    width = bounds.max.x - bounds.min.x,
    beamFit = macro ? 1 : Math.min(1, (l * 0.87) / width);
  for (const v of volumes) {
    v.position.x *= beamFit;
    v.dimensions.x *= beamFit;
    for (const s of v.geometry.stations) s.width *= beamFit;
  }
  for (const c of connectors) {
    c.start.x *= beamFit;
    c.end.x *= beamFit;
  }
  for (const v of volumes) syncShape(v);
  refineConnections(
    order,
    yard,
    grammar,
    volumes,
    connectors,
    rng,
    Boolean(macro),
  );
  return {
    composition,
    volumes,
    connectors,
    nose,
    components,
    beam: beam * beamFit,
    armor,
  };
}
