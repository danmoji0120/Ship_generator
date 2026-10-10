import type {
  Hardpoint,
  ShipBlueprint,
  ShipOrder,
  Vec3,
} from "../../blueprint/types";
import type { MountSize, MountFrame } from "../weapons/types";
import {
  MOUNT_TYPES,
  SLOT_REGIONS,
  type HardpointRequest,
  type ModularHardpointPlan,
  type ModularSlot,
  type SlotRegion,
  type SlotBox,
  type ModularMountType,
} from "./types";
import { slotStandard, matchesRequest, SIZE_RANK } from "./compatibility";
import {
  armorSurfaces,
  resolveFoundation,
  surfaceRay,
  worldPoint,
  REGION_NORMAL,
} from "../weapons/surfaces";
import { detailFrame } from "../details/geometry";
import { detailScene } from "../details/placement";
import { mesoConnectorScene } from "../meso/connector-scene";
import { boundsOf, sub, add, mul, dot } from "../integration/contours";
import { area } from "../armor/panels";
import { solidsIntrude, rayBlocked } from "../weapons/collision";
import { reservationBounds, overlappingBounds } from "../armor/geometry";
import { containsProductionVolume } from "../production/surface-contact";
import { DesignRejection } from "../production/requirements";
import { stationAt } from "../hull";
import {
  boxCorners,
  boxSolid,
  boxBounds,
  boxesOverlap,
  rayBox,
  boundsIndex,
  slotIndex,
} from "./geometry";
export const SLOT_LIMIT = 512;
export const DIRECTIONS: Record<SlotRegion, Vec3> = {
  ...REGION_NORMAL,
  FORE: { x: 0, y: 0, z: -1 },
  AFT: { x: 0, y: 0, z: 1 },
};
const roleTargets: Record<ShipOrder["role"], [number, number]> = {
  Corvette: [20, 90],
  Frigate: [32, 150],
  Destroyer: [52, 220],
  Cruiser: [90, 300],
  Battlecruiser: [110, 380],
  Battleship: [150, 450],
  "Missile Ship": [100, 300],
  "Spinal Gun Ship": [80, 300],
  "Patrol Ship": [12, 60],
};
export function normalizeHardpointOrder(order: ShipOrder) {
  order.hardpointDensity ??= "STANDARD";
  order.hardpointRequests ??= [];
  if (
    !["SPARSE", "STANDARD", "DENSE"].includes(order.hardpointDensity) ||
    !Array.isArray(order.hardpointRequests) ||
    order.hardpointRequests.length > 32
  )
    throw new DesignRejection(
      ["INVALID_HARDPOINT_ORDER"],
      [],
      "Invalid density / maximum 32 requests",
    );
  const ids = new Set<string>();
  for (const r of order.hardpointRequests) {
    if (
      !r ||
      typeof r.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(r.id) ||
      ids.has(r.id) ||
      !MOUNT_TYPES.includes(r.type) ||
      !Object.hasOwn(SIZE_RANK, r.size) ||
      !Number.isInteger(r.count) ||
      r.count < 1 ||
      r.count > SLOT_LIMIT ||
      typeof r.mandatory !== "boolean" ||
      !Number.isFinite(r.priority) ||
      r.priority < 0 ||
      r.priority > 100 ||
      (r.region && !SLOT_REGIONS.includes(r.region)) ||
      (r.parentId && typeof r.parentId !== "string") ||
      (r.direction &&
        (!(["x", "y", "z"] as const).every((k) =>
          Number.isFinite(r.direction![k]),
        ) ||
          Object.keys(r.direction).length !== 3 ||
          Math.abs(
            Math.hypot(r.direction.x, r.direction.y, r.direction.z) - 1,
          ) > 1e-5))
    )
      throw new DesignRejection(
        ["INVALID_HARDPOINT_ORDER"],
        [],
        `Invalid hardpoint requirement ${r?.id ?? "?"}; counts and physical directions are never silently clamped`,
      );
    ids.add(r.id);
  }
  if (order.hardpointRequests.reduce((n, r) => n + r.count, 0) > SLOT_LIMIT)
    throw new DesignRejection(
      ["INVALID_HARDPOINT_ORDER"],
      [],
      `Combined request count exceeds bounded ${SLOT_LIMIT}-slot planning limit`,
    );
}
export function slotBudget(b: ShipBlueprint) {
  const availableM3 =
      Math.max(
        0,
        b.designDoctrine!.allocations.structure.volumeM3 -
          (b.designRequirements?.energy.volumeM3 ?? 0),
      ) * 0.08,
    hosts = b.designDoctrine!.hosts,
    total = hosts.reduce((n, h) => n + h.usableVolumeM3, 0);
  return {
    sector: "structure" as const,
    method:
      "Interface support pockets suballocated inside existing structure reservation (8% after energy space); not new capacity or installed equipment power/ammunition",
    availableM3,
    reservedM3: 0,
    byHost: Object.fromEntries(
      hosts.map((h) => [
        h.id,
        {
          availableM3: (availableM3 * h.usableVolumeM3) / total,
          reservedM3: 0,
        },
      ]),
    ),
  };
}
export function slotEnvironment(b: ShipBlueprint) {
  const surfaces = armorSurfaces(b),
    hulls = surfaces.filter((s) =>
      b.structuralVolumes.some((v) => v.id === s.id),
    );
  const scene = [
    ...detailScene(b, surfaces),
    ...mesoConnectorScene(b),
    ...(b.mesoStructurePlan?.placements ?? []).flatMap((p) =>
      p.parts.map((q) => ({ id: q.id, solid: q.solid, bounds: q.bounds })),
    ),
    ...(b.exteriorDetailPlan?.kitPlacements ?? []).flatMap((p) =>
      p.assembly.parts.map((q) => ({
        id: q.id,
        solid: q.solid,
        bounds: q.bounds,
      })),
    ),
  ];
  const sceneQuery = boundsIndex(scene),
    protectedBoxes = [
      ...(b.productionDesign?.zones ?? []).map((z) => ({
        bounds: reservationBounds(z),
        id: z.id,
      })),
      ...(b.designRequirements?.spaces ?? []).map((s) => ({
        bounds: s.bounds,
        id: s.id,
      })),
      ...b.engines.map((e) => ({
        id: e.id + "/nozzle-and-plume",
        bounds: {
          min: {
            x: e.position.x - e.nozzleRadius * (e.bellRatio + 0.2),
            y: e.position.y - e.nozzleRadius * (e.bellRatio + 0.2),
            z: e.position.z - 0.1,
          },
          max: {
            x: e.position.x + e.nozzleRadius * (e.bellRatio + 0.2),
            y: e.position.y + e.nozzleRadius * (e.bellRatio + 0.2),
            z: e.position.z + e.nozzleLength + b.order.length * 0.04,
          },
        },
      })),
    ];
  const sensorRays = (b.prefabPlacements ?? []).flatMap((p) =>
    (p.assembly?.parts ?? [])
      .filter((a) => a.role === "PROTECTED_SENSOR")
      .flatMap((a) => {
        const direction =
            p.id === "command-house" ? { x: 0, y: 0, z: -1 } : p.socket.normal,
          frame = detailFrame(direction),
          center = mul(add(a.bounds.min, a.bounds.max), 0.5),
          radius = Math.max(
            ...a.solid.vertices.map((v) => dot(sub(v, center), direction)),
          ),
          origin = add(center, mul(direction, radius + 0.04));
        return [-0.15, 0, 0.15].map((offset) => ({
          origin: add(origin, mul(frame.right, offset)),
          direction,
          range: 6,
        }));
      }),
  );
  const exclusions = boundsIndex(protectedBoxes);
  return { surfaces, hulls, scene, sceneQuery, exclusions, sensorRays };
}
export function surfaceSlot(
  b: ShipBlueprint,
  hint: Vec3,
  region: SlotRegion,
  size: MountSize,
  env: ReturnType<typeof slotEnvironment>,
): { position: Vec3; slot: ModularSlot; parentId: string } {
  const s = slotStandard(size, b.order.length),
    d = DIRECTIONS[region],
    center = surfaceRay(env.surfaces, hint, d);
  if (!center || dot(center.normal, d) < 0.65)
    throw Error("NO_EXPOSED_SURFACE");
  let frame: MountFrame, contacts: ModularSlot["contacts"], position: Vec3;
  if (region in REGION_NORMAL) {
    const r = resolveFoundation(
      env.surfaces,
      hint,
      region as keyof typeof REGION_NORMAL,
      s,
    );
    ({ frame, contacts, position } = r);
  } else {
    frame = detailFrame(center.normal);
    const w = s.footprint.width / 2,
      l = s.footprint.length / 2,
      probes = [
        [-w, -l],
        [w, -l],
        [w, l],
        [-w, l],
        [-w, 0],
        [w, 0],
        [0, -l],
        [0, l],
        [0, 0],
        [-w * 0.5, 0],
        [w * 0.5, 0],
        [0, -l * 0.5],
        [0, l * 0.5],
        [-w * 0.5, -l * 0.5],
        [w * 0.5, -l * 0.5],
        [-w * 0.5, l * 0.5],
        [w * 0.5, l * 0.5],
      ];
    contacts = probes.map(([x, z]) => {
      const hit = surfaceRay(
        env.surfaces,
        worldPoint(center.position, frame, { x, y: 0, z }),
        frame.normal,
      );
      if (
        !hit ||
        dot(hit.normal, frame.normal) < 0.85 ||
        Math.abs(dot(sub(hit.position, center.position), frame.normal)) > 2.5
      )
        throw Error("INCOHERENT_FOOTPRINT");
      return hit;
    });
    position = add(
      center.position,
      mul(
        frame.normal,
        Math.max(
          ...contacts.map((c) =>
            dot(sub(c.position, center.position), frame.normal),
          ),
        ) + s.foundationHeight,
      ),
    );
  }
  if (contacts.some((c) => c.structureId !== center.structureId))
    throw Error("MIXED_PARENT_SUPPORT");
  const host = b.structuralVolumes.find((v) => v.id === center.structureId)!;
  const base = surfaceRay(env.hulls, center.position, frame.normal);
  if (!base || base.structureId !== host.id)
    throw Error("NO_PARENT_INTERNAL_SUPPORT");
  const depth =
    ({ S: 0.35, M: 0.7, L: 1.5, XL: 2.5 }[size] * s.envelope.width) /
    { S: 5, M: 13, L: 27, XL: 45 }[size];
  const internal: SlotBox = {
    position: base.position,
    frame,
    localBounds: {
      min: {
        x: -s.footprint.width * 0.45,
        y: -depth,
        z: -s.footprint.length * 0.45,
      },
      max: {
        x: s.footprint.width * 0.45,
        y: -0.01,
        z: s.footprint.length * 0.45,
      },
    },
  };
  if (
    boxCorners(internal).some(
      (p) => !containsProductionVolume(host, p, b.order.length * 0.00001),
    )
  )
    throw Error("INSUFFICIENT_INTERNAL_POCKET");
  const envelope: SlotBox = {
    position,
    frame,
    localBounds: {
      min: { x: -s.envelope.width / 2, y: 0, z: -s.envelope.length / 2 },
      max: {
        x: s.envelope.width / 2,
        y: s.envelope.height,
        z: s.envelope.length / 2,
      },
    },
  };
  const slot: ModularSlot = {
    state: "EMPTY",
    mountTypes: [],
    region,
    localPosition: sub(position, host.position),
    frame,
    contacts,
    footprint: s.footprint,
    envelope,
    internal,
    internalVolumeM3:
      s.footprint.width * 0.9 * s.footprint.length * 0.9 * (depth - 0.01),
    interface: {
      power: "RESERVED_INTERFACE_NOT_SIMULATED",
      ratingIndex: [1, 3, 8, 18][SIZE_RANK[size]],
    },
    clearanceMeters: Math.max(2, s.envelope.height * 0.5),
  };
  return { position, slot, parentId: host.id };
}
export function slotPhysicalIssues(
  b: ShipBlueprint,
  m: ModularSlot,
  env: ReturnType<typeof slotEnvironment>,
) {
  const errors: string[] = [],
    box = boxBounds(m.envelope),
    solid = boxSolid(m.envelope);
  for (const s of env.sceneQuery(box)) {
    if (solidsIntrude(solid, box, s.solid, s.bounds)) {
      errors.push("OPERATING_ENVELOPE_INTERFERENCE");
      break;
    }
  }
  if (
    env.exclusions(box).length ||
    (m.internal && env.exclusions(boxBounds(m.internal)).length)
  )
    errors.push("PROTECTED_OPENING_OR_PROPULSION");
  for (const mount of b.weaponLayout?.mounts ?? []) {
    const occupied: SlotBox = {
      position: mount.position,
      frame: mount.frame,
      localBounds: mount.equipment.localBounds,
    };
    if (boxesOverlap(m.envelope, occupied)) {
      errors.push("INSTALLED_WEAPON_ENVELOPE");
      break;
    }
    if (
      mount.firingArc.samples.some((s) =>
        rayBox(s.origin, s.direction, mount.firingArc.rangeMeters, m.envelope),
      )
    ) {
      errors.push("EXISTING_FIRING_PATH");
      break;
    }
  }
  const origin = worldPoint(m.envelope.position, m.frame, {
      x: 0,
      y: m.envelope.localBounds.max.y + 0.04,
      z: 0,
    }),
    end = add(origin, mul(m.frame.normal, m.clearanceMeters)),
    targets = env.sceneQuery(boundsOf([origin, end]));
  if (rayBlocked(origin, m.frame.normal, m.clearanceMeters, targets))
    errors.push("OUTWARD_ACCESS_BLOCKED");
  if (
    env.sensorRays.some((ray) =>
      rayBox(ray.origin, ray.direction, ray.range, m.envelope),
    )
  )
    errors.push("EXISTING_SENSOR_APERTURE");
  // Retain actual service access columns as well as their current geometry.
  for (const p of b.exteriorDetailPlan?.kitPlacements ?? []) {
    if (
      p.access.depth > 0 &&
      rayBox(p.access.origin, p.access.direction, p.access.depth, m.envelope)
    ) {
      errors.push("EXISTING_SERVICE_ACCESS");
      break;
    }
  }
  return errors;
}
function* legacyCandidates(
  b: ShipBlueprint,
  size: MountSize,
  density: ModularHardpointPlan["density"],
) {
  const s = slotStandard(size, b.order.length),
    gap = { SPARSE: 1.7, STANDARD: 1.25, DENSE: 1.08 }[density],
    stepZ = Math.max(s.footprint.length, s.envelope.length) * gap,
    stepX = Math.max(s.footprint.width, s.envelope.width) * gap,
    hosts = b.structuralVolumes.filter((v) => v.type !== "SPINE");
  const lists = hosts.map((v) => {
    const out: { hint: Vec3; region: SlotRegion }[] = [],
      z0 = v.position.z + v.geometry.stations[0].z,
      z1 = v.position.z + v.geometry.stations.at(-1)!.z,
      rows = Math.max(1, Math.floor((z1 - z0) / stepZ)),
      shift = (b.seed % 7) / 7;
    for (let i = 0; i < rows; i++) {
      const z = z0 + (i + 0.5) * ((z1 - z0) / rows),
        st = stationAt(v.geometry.stations, z - v.position.z);
      for (const region of ["TOP", "BOTTOM", "PORT", "STARBOARD"] as const) {
        const width =
            region === "TOP" || region === "BOTTOM" ? st.width : st.height,
          cols = Math.max(1, Math.floor(width / stepX));
        for (let j = 0; j < cols; j++) {
          const offset = ((j - (cols - 1) / 2) * width) / cols;
          out.push({
            region,
            hint: {
              x:
                v.position.x +
                (region === "TOP" || region === "BOTTOM" ? offset : 0),
              y:
                v.position.y +
                (region === "PORT" || region === "STARBOARD" ? offset : 0),
              z,
            },
          });
        }
      }
    }
    for (const region of ["FORE", "AFT"] as const) {
      const st =
          region === "FORE"
            ? v.geometry.stations[0]
            : v.geometry.stations.at(-1)!,
        nx = Math.max(1, Math.floor(st.width / stepX)),
        ny = Math.max(1, Math.floor(st.height / stepZ));
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < ny; j++)
          out.push({
            region,
            hint: {
              x: v.position.x + ((i - (nx - 1) / 2) * st.width) / nx,
              y: v.position.y + ((j - (ny - 1) / 2) * st.height) / ny,
              z: v.position.z + st.z,
            },
          });
    }
    // Rotate whole deterministic candidate order, never perturb physical contacts.
    const at = Math.floor(shift * out.length);
    return [...out.slice(at), ...out.slice(0, at)];
  });
  for (let i = 0; lists.some((xs) => i < xs.length); i++)
    for (const xs of lists) if (xs[i]) yield xs[i];
}
/** Ship-local bilateral X axis and longitudinal -Z are the existing Hull/mountFrame contract.
 * Rows derive from each real armor solid; bounds propose hints, never prove support. */
function* batteryCandidates(b:ShipBlueprint,size:MountSize,density:ModularHardpointPlan["density"],env:ReturnType<typeof slotEnvironment>){
 const s=slotStandard(size,b.order.length), gap={SPARSE:1.7,STANDARD:1.25,DENSE:1.08}[density];
 const dx=s.envelope.width*gap,dz=s.envelope.length*gap;
 const seen=new Set<string>();
 const surfaces=[...env.surfaces].sort((a,c)=>((c.box.max.x-c.box.min.x)*(c.box.max.z-c.box.min.z))-((a.box.max.x-a.box.min.x)*(a.box.max.z-a.box.min.z)) || a.id.localeCompare(c.id));
 const lists=surfaces.map(surface=>{
  const out:{hint:Vec3;region:SlotRegion;zoneId:string;batteryId:string}[]=[];
  const box=surface.box;
  const rows=Math.max(1,Math.floor((box.max.z-box.min.z)/dz));
  for(const region of ["TOP","BOTTOM","PORT","STARBOARD"] as const){
   if(region==="STARBOARD")continue; // pairs are resolved atomically from port
   const dorsal=region==="TOP"||region==="BOTTOM";
   const lo=dorsal?box.min.x:box.min.y,hi=dorsal?box.max.x:box.max.y;
   const cols=Math.max(1,Math.floor((hi-lo)/dx));
   for(let j=0;j<cols;j++){
    const lateral=cols===1?(lo+hi)/2:lo+(j+.5)*(hi-lo)/cols;
    if(dorsal&&lateral>1e-5)continue;
    const zoneId=`${surface.structureId}/${region}/${Math.abs(lateral)<1e-5?"CENTERLINE":"BATTERY"}`;
    for(let i=0;i<rows;i++){
     const z=box.min.z+(i+.5)*(box.max.z-box.min.z)/rows;
     const hint={x:dorsal?lateral:(box.min.x+box.max.x)/2,y:dorsal?(box.min.y+box.max.y)/2:lateral,z};
     out.push({hint,region,zoneId,batteryId:`${surface.id}/${region}/${size}/row-${j}`});
    }
   }
  }
  const rowGroups=new Map<string,typeof out>();
  for(const c of out)rowGroups.set(c.batteryId,[...(rowGroups.get(c.batteryId)??[]),c]);
  return [...rowGroups.values()];
 }).flat();
 // Bounded three-station row blocks preserve battery continuity, then give other
 // surface/region rows their turn instead of exhausting one host.
 for(let i=0;lists.some(xs=>i<xs.length);i+=3)for(const xs of lists)for(const c of xs.slice(i,i+3)){const k=[c.region,c.hint.x,c.hint.y,c.hint.z].join('/');if(!seen.has(k)){seen.add(k);yield c;}}
 for(const c of legacyCandidates(b,size,density))yield {...c,zoneId:`${c.region}/RESIDUAL`,batteryId:`${c.region}/${size}/RESIDUAL`};
}
export function fulfillRequests(b: ShipBlueprint) {
  const slots = b.hardpoints.filter((h) => h.modular),
    requests = [...(b.order.hardpointRequests ?? [])].sort(
      (a, c) =>
        Number(c.mandatory) - Number(a.mandatory) ||
        c.priority - a.priority ||
        SIZE_RANK[c.size] - SIZE_RANK[a.size] ||
        a.id.localeCompare(c.id),
    ),
    owner = new Map<string, string>(),
    assign = new Map<string, string[]>();
  // Augmenting paths keep a broad earlier request from consuming the only specialized slot.
  const units = requests.flatMap((r) =>
      Array.from({ length: r.count }, (_, i) => ({ key: r.id + "/" + i, r })),
    ),
    unitByKey = new Map(units.map((u) => [u.key, u]));
  function adopt(key: string, seen: Set<string>): boolean {
    const r = unitByKey.get(key)!.r;
    for (const h of [...slots]
      .filter((h) => matchesRequest(h, r))
      .sort(
        (a, c) =>
          SIZE_RANK[a.size] - SIZE_RANK[c.size] || a.id.localeCompare(c.id),
      )) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      const prior = owner.get(h.id);
      if (!prior || adopt(prior, seen)) {
        owner.set(h.id, key);
        return true;
      }
    }
    return false;
  }
  for (const unit of units) adopt(unit.key, new Set());
  for (const [id, key] of owner) {
    const request = unitByKey.get(key)!.r.id;
    assign.set(request, [...(assign.get(request) ?? []), id]);
  }
  return requests.map((request) => {
    const matchedIds = (assign.get(request.id) ?? []).sort(),
      missing = request.count - matchedIds.length;
    return {
      request: structuredClone(request),
      matchedIds,
      missing,
      status: !missing
        ? ("SATISFIED" as const)
        : request.mandatory
          ? ("FAILED" as const)
          : ("LIMITED" as const),
      reason: !missing
        ? "Distinct physically verified compatible slots; installed equipment and slot count are separate"
        : request.type === "SPINAL"
          ? "Only existing validated integrated axial contracts are usable; no hull/breech/opening changes or surface XL substitution"
          : "Coherent surface footprint / envelope / protected access / finite support reservation prevents remaining placements",
    };
  });
}
export function summarizeSlots(
  b: ShipBlueprint,
): ModularHardpointPlan["summary"] {
  const hs = b.hardpoints;
  return {
    total: hs.length,
    empty: hs.filter((h) => h.modular?.state === "EMPTY").length,
    occupied: hs.filter((h) => h.modular?.state === "OCCUPIED").length,
    bySize: Object.fromEntries(
      ["S", "M", "L", "XL"].map((size) => [
        size,
        hs.filter((h) => h.size === size).length,
      ]),
    ) as any,
    byType: Object.fromEntries(
      MOUNT_TYPES.map((type) => [
        type,
        hs.filter((h) => h.modular?.mountTypes.includes(type)).length,
      ]),
    ) as any,
    byRegion: Object.fromEntries(
      SLOT_REGIONS.map((region) => [
        region,
        hs.filter((h) => h.modular?.region === region).length,
      ]),
    ) as any,
  };
}
export function addModularHardpoints(b: ShipBlueprint) {
  if (b.modularHardpoints) return b;
  const env = slotEnvironment(b),
    budget = slotBudget(b),
    density = b.order.hardpointDensity ?? "STANDARD",
    [base, ref] = roleTargets[b.role],
    s = slotStandard("S", b.order.length);
  const surfaceAreaM2 = Object.values(
      b.productionDesign!.coverage.directions,
    ).reduce((n, d) => n + d.eligibleM2, 0),
    mass = { Light: 0.85, Standard: 1, Heavy: 1.15, Superheavy: 1.3 }[
      b.order.massClass
    ],
    mult = { SPARSE: 0.6, STANDARD: 1, DENSE: 1.5 }[density];
  const requested = (b.order.hardpointRequests ?? []).reduce(
      (n, r) => n + r.count,
      0,
    ),
    scale = Math.sqrt(
      Math.max(0.4, Math.min(1.6, b.dimensions.width / b.order.length / 0.22)),
    );
  const target = Math.min(
    SLOT_LIMIT,
    Math.max(
      requested,
      b.hardpoints.length + 4,
      Math.min(
        Math.round(base * (b.order.length / ref) ** 1.2 * mass * mult * scale),
        Math.floor(
          surfaceAreaM2 / (s.envelope.width * s.envelope.length * 1.4),
        ),
      ),
    ),
  );
  const plan: ModularHardpointPlan = {
    version: "1.8.5.4.1",
    density,
    target,
    limit: SLOT_LIMIT,
    budget,
    requests: [],
    diagnostics: {
      candidates: 0,
      rejections: {},
      surfaceAreaM2,
      stopReason: "",
    },
    summary: null as any,
  };
  const external = slotIndex(Math.max(8, s.envelope.length * 2)),
    internal = slotIndex(Math.max(8, s.envelope.length * 2));
  for (const h of b.hardpoints) {
    const m = b.weaponLayout!.mounts.find((m) => m.id === h.plannedMountId);
    if (m) {
      h.modular = {
        state: "OCCUPIED",
        mountTypes: [
          m.category === "MISSILE"
            ? "MISSILE"
            : m.category === "POINT_DEFENSE"
              ? "DEFENSIVE"
              : "TURRET",
        ],
        region: m.region,
        localPosition: sub(
          h.position,
          b.structuralVolumes.find((v) => v.id === h.parentId)!.position,
        ),
        frame: m.frame,
        contacts: m.contacts,
        footprint: m.standard.footprint,
        envelope: {
          position: m.position,
          frame: m.frame,
          localBounds: m.equipment.localBounds,
        },
        internalVolumeM3: 0,
        interface: {
          power: "RESERVED_INTERFACE_NOT_SIMULATED",
          ratingIndex: m.standard.cost,
        },
        clearanceMeters: 0,
      };
      external.add(h.modular.envelope);
    } else if (h.type === "Spinal") {
      const integrated = b.weaponLayout!.integrated!.find(
        (m) => m.hardpointId === h.id,
      )!;
      h.modular = {
        state: "OCCUPIED",
        mountTypes: ["SPINAL"],
        region: "FORE",
        localPosition: sub(
          h.position,
          b.structuralVolumes.find((v) => v.id === h.parentId)!.position,
        ),
        frame: detailFrame(h.normal),
        contacts: [],
        footprint: integrated.standard.footprint,
        envelope: {
          position: h.position,
          frame: detailFrame(h.normal),
          localBounds: {
            min: {
              x: -integrated.standard.envelope.width / 2,
              y: -integrated.standard.envelope.length,
              z: -integrated.standard.envelope.height / 2,
            },
            max: {
              x: integrated.standard.envelope.width / 2,
              y: 0,
              z: integrated.standard.envelope.height / 2,
            },
          },
        },
        internalVolumeM3: 0,
        interface: {
          power: "RESERVED_INTERFACE_NOT_SIMULATED",
          ratingIndex: 18,
          spinalReservationId: integrated.reservationId,
        },
        clearanceMeters: 0,
      };
    }
  }
  const bad = (reason: string) => {
    plan.diagnostics.rejections[reason] =
      (plan.diagnostics.rejections[reason] ?? 0) + 1;
  };
  const examined = new Set<string>();
  function place(size: MountSize, wanted: number, request?: HardpointRequest) {
    if (wanted <= 0) return 0;
    const passStart=plan.diagnostics.candidates;
    let adopted = 0;
    for (const c of batteryCandidates(b, size, density, env)) {
      if (adopted >= wanted || b.hardpoints.length >= SLOT_LIMIT || plan.diagnostics.candidates >= 18000) break;
      if (request?.region && request.region !== c.region) continue;
      const key = [size,c.region,c.hint.x,c.hint.y,c.hint.z,request?.id ?? "auto"].join("/");
      if (examined.has(key)) continue;
      examined.add(key);
      plan.diagnostics.candidates++;
      try {
        const first = surfaceSlot(b,c.hint,c.region,size,env);
        const reflected = {...c.hint,x:-c.hint.x};
        const opposite = c.region === "PORT" ? "STARBOARD" : c.region === "STARBOARD" ? "PORT" : c.region;
        const centered = Math.abs(first.position.x) < 1e-5;
        const mirrorHit = centered ? undefined : surfaceRay(env.surfaces,reflected,DIRECTIONS[opposite]);
        const symmetric = !centered && mirrorHit && Math.abs(mirrorHit.position.y-first.slot.contacts[8].position.y)<0.05 && Math.abs(mirrorHit.position.z-first.slot.contacts[8].position.z)<0.05;
        const resolved = [first];
        if (symmetric && !request?.parentId && (!request?.direction || Math.abs(request.direction.x)<1e-5) && (!request?.region || request.region===opposite)) {
          if ((!request && wanted-adopted < 2) || b.hardpoints.length+2>SLOT_LIMIT) continue;
          const mate = surfaceSlot(b,reflected,opposite,size,env);
          if (Math.abs(mate.position.x+first.position.x)>0.05 || Math.abs(mate.position.y-first.position.y)>0.05 || Math.abs(mate.position.z-first.position.z)>0.05 || Math.abs(mate.slot.frame.normal.x+first.slot.frame.normal.x)>1e-4 || Math.abs(mate.slot.frame.normal.y-first.slot.frame.normal.y)>1e-4 || Math.abs(mate.slot.frame.normal.z-first.slot.frame.normal.z)>1e-4) throw Error("ASYMMETRIC_SUPPORT_FRAME");
          resolved.push(mate);
        } else if (!centered && symmetric && !request) continue;
        const pending: Hardpoint[] = [];
        const hostAdds = new Map<string,number>();
        for (const r of resolved) {
          const m=r.slot;
          m.mountTypes=request ? [request.type] : size === "S" ? ["TURRET","DEFENSIVE","UTILITY"] : ["TURRET","FIXED","MISSILE","DEFENSIVE"];
          m.zoneId=`${r.parentId}/${m.region}/${c.zoneId.endsWith("RESIDUAL")?"RESIDUAL":Math.abs(r.position.x)<1e-5?"CENTERLINE":"BATTERY"}`;
          m.batteryGroupId=c.zoneId.endsWith("RESIDUAL") ? undefined : c.batteryId;
          m.pairId=resolved.length===2 ? `pair-${b.hardpoints.length}` : undefined;
          m.symmetryReason=centered ? "CENTERLINE" : resolved.length===2 ? "BILATERAL_VERIFIED" : request ? "EXPLICIT_REQUEST_CONSTRAINT" : "NO_CORRESPONDING_EXPOSED_SURFACE";
          const h:Hardpoint={id:`slot-${b.hardpoints.length+pending.length}`,type:request?.type==="UTILITY" ? "Utility" : size==="S" ? "Small Turret" : size==="M" ? "Medium Turret" : "Large Turret",size,position:r.position,normal:m.frame.normal,parentId:r.parentId,radius:m.footprint.width/2,allowedCategories:[...m.mountTypes],modular:m};
          if(request && !matchesRequest(h,request)) throw Error("REQUEST_REGION_PARENT_DIRECTION");
          const total= (hostAdds.get(h.parentId)??0)+m.internalVolumeM3;
          hostAdds.set(h.parentId,total);
          if(!budget.byHost[h.parentId] || budget.byHost[h.parentId].reservedM3+total>budget.byHost[h.parentId].availableM3+1e-6) throw Error("SUPPORT_ALLOCATION_EXHAUSTED");
          if(external.query(m.envelope).some(a=>boxesOverlap(a,m.envelope)) || internal.query(m.internal!).some(a=>boxesOverlap(a,m.internal!)) || pending.some(a=>boxesOverlap(a.modular!.envelope,m.envelope)||boxesOverlap(a.modular!.internal!,m.internal!))) throw Error("SLOT_ORIENTED_ENVELOPE_OVERLAP");
          const issues=slotPhysicalIssues(b,m,env);
          if(issues.length) throw Error(issues[0]);
          pending.push(h);
        }
        const volume=pending.reduce((n,h)=>n+h.modular!.internalVolumeM3,0);
        if(budget.reservedM3+volume>budget.availableM3+1e-6) throw Error("SUPPORT_ALLOCATION_EXHAUSTED");
        // Atomic pair: no reservations are mutated until every member is valid.
        for(const h of pending){b.hardpoints.push(h);external.add(h.modular!.envelope);internal.add(h.modular!.internal!);budget.byHost[h.parentId].reservedM3+=h.modular!.internalVolumeM3;budget.reservedM3+=h.modular!.internalVolumeM3;}
        adopted+=pending.length;
      } catch(e){bad((e as Error).message);}
    }
    (plan.diagnostics.passes??=[]).push({size,phase:request?(request.mandatory?"REQUIRED":"PREFERRED"):"AUTOMATIC",candidates:plan.diagnostics.candidates-passStart,accepted:adopted});
    return adopted;
  }
  const requests = [...(b.order.hardpointRequests ?? [])].sort((a,c)=>Number(c.mandatory)-Number(a.mandatory)||SIZE_RANK[c.size]-SIZE_RANK[a.size]||c.priority-a.priority||a.id.localeCompare(c.id));
  const fulfill = (r:HardpointRequest)=>{
    const need=fulfillRequests(b).find(a=>a.request.id===r.id)!.missing;
    if(r.type!=="SPINAL")place(r.size,need,r);
  };
  for(const r of requests.filter(r=>r.mandatory))fulfill(r);
  const remaining = () => Math.max(0, target - b.hardpoints.length);
  // Optional requests share their size pass; preferred S never precedes automatic XL/L.
  for(const size of ["XL","L","M","S"] as const){
    for(const r of requests.filter(r=>!r.mandatory&&r.size===size))fulfill(r);
    place(size,remaining());
  }
  const batteries=new Map<string,typeof b.hardpoints>();
  for(const h of b.hardpoints){const id=h.modular?.batteryGroupId;if(id)batteries.set(id,[...(batteries.get(id)??[]),h]);}
  for(const [id,hs] of batteries){
    const stations=[...new Set(hs.map(h=>Math.round(h.position.z*1e4)/1e4))].sort((a,c)=>a-c);
    const maxGap=slotStandard(hs[0].size,b.order.length).envelope.length*{SPARSE:1.7,STANDARD:1.25,DENSE:1.08}[density]*1.6;
    let part=0;const groups=new Map<number,typeof hs>();let prev=-Infinity;
    for(const z of stations){if(z-prev>maxGap)part++;groups.set(part,[...(groups.get(part)??[]),...hs.filter(h=>Math.abs(h.position.z-z)<.0001)]);prev=z;}
    for(const [segment,row] of groups){const distinct=new Set(row.map(h=>Math.round(h.position.z*1e4)/1e4));for(const h of row)h.modular!.batteryGroupId=distinct.size>=2?`${id}/segment-${segment}`:undefined;}
  }
  plan.requests = fulfillRequests(b);
  plan.summary = summarizeSlots(b);
  plan.diagnostics.stopReason =
    b.hardpoints.length >= target
      ? "TARGET_REACHED"
      : plan.diagnostics.candidates >= 18000
        ? "BOUNDED_SEARCH_LIMIT"
        : "AVAILABLE_COHERENT_SURFACE_OR_RESOURCE_LIMIT";
  b.modularHardpoints = plan;
  b.generatorVersion = "1.8.5.4.1";
  const failed = plan.requests.filter((r) => r.status === "FAILED");
  if (failed.length)
    throw new DesignRejection(
      ["REQUIRED_HARDPOINT_CAPACITY_UNAVAILABLE"],
      [],
      failed
        .map(
          (r) =>
            `${r.request.id}: ${r.request.type}/${r.request.size} requested ${r.request.count}, matched ${r.matchedIds.length}, missing ${r.missing}; ${r.reason}`,
        )
        .join("; "),
    );
  return b;
}
