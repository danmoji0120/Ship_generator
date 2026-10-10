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
import {SLOT_LIMIT,slotEnvironment,slotBudget,surfaceSlot,slotPhysicalIssues,fulfillRequests,summarizeSlots} from "./planner";
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
function* candidates(
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
    version: "1.8.5.4",
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
  const pools = new Map<MountSize, ReturnType<typeof candidates>>(),
    examined = new Set<string>();
  function place(size: MountSize, wanted: number, request?: HardpointRequest) {
    if (wanted <= 0) return 0;
    let adopted = 0,
      pool = request ? candidates(b, size, density) : pools.get(size);
    if (!pool) {
      pool = candidates(b, size, density);
      pools.set(size, pool);
    }
    let attempts = 0;
    for (const c of pool) {
      if (
        adopted >= wanted ||
        b.hardpoints.length >= SLOT_LIMIT ||
        plan.diagnostics.candidates >= 18000 ||
        attempts++ >= 6000
      )
        break;
      if (request && request.region && request.region !== c.region) continue;
      const key = [
        size,
        c.region,
        c.hint.x,
        c.hint.y,
        c.hint.z,
        request?.type ?? "auto",
      ].join("/");
      if (examined.has(key)) continue;
      examined.add(key);
      plan.diagnostics.candidates++;
      try {
        const r = surfaceSlot(b, c.hint, c.region, size, env),
          m = r.slot;
        const autoTypes: ModularMountType[] =
          size === "XL" || size === "L"
            ? ["TURRET", "FIXED", "MISSILE", "DEFENSIVE"]
            : b.hardpoints.length % 4 === 0
              ? ["UTILITY"]
              : b.hardpoints.length % 3 === 0 || b.role === "Missile Ship"
                ? ["MISSILE", "FIXED"]
                : ["TURRET", "DEFENSIVE"];
        m.mountTypes = request ? [request.type] : autoTypes;
        const h: Hardpoint = {
          id: `slot-${b.hardpoints.length}`,
          type: m.mountTypes.includes("UTILITY")
            ? "Utility"
            : m.mountTypes.includes("MISSILE") &&
                !m.mountTypes.includes("TURRET")
              ? "Missile"
              : size === "S"
                ? "Small Turret"
                : size === "M"
                  ? "Medium Turret"
                  : "Large Turret",
          size,
          position: r.position,
          normal: m.frame.normal,
          parentId: r.parentId,
          radius: m.footprint.width / 2,
          allowedCategories: [...m.mountTypes],
          modular: m,
        };
        if (request && !matchesRequest(h, request)) {
          bad("REQUEST_REGION_PARENT_DIRECTION");
          continue;
        }
        const host = budget.byHost[h.parentId];
        if (
          !host ||
          host.reservedM3 + m.internalVolumeM3 > host.availableM3 + 1e-6 ||
          budget.reservedM3 + m.internalVolumeM3 > budget.availableM3 + 1e-6
        ) {
          bad("SUPPORT_ALLOCATION_EXHAUSTED");
          continue;
        }
        if (
          external.query(m.envelope).some((a) => boxesOverlap(a, m.envelope)) ||
          internal.query(m.internal!).some((a) => boxesOverlap(a, m.internal!))
        ) {
          bad("SLOT_ORIENTED_ENVELOPE_OVERLAP");
          continue;
        }
        const issues = slotPhysicalIssues(b, m, env);
        if (issues.length) {
          issues.forEach(bad);
          continue;
        }
        b.hardpoints.push(h);
        external.add(m.envelope);
        internal.add(m.internal!);
        host.reservedM3 += m.internalVolumeM3;
        budget.reservedM3 += m.internalVolumeM3;
        adopted++;
      } catch (e) {
        bad((e as Error).message);
      }
    }
    return adopted;
  }
  const requests = [...(b.order.hardpointRequests ?? [])].sort(
    (a, c) =>
      Number(c.mandatory) - Number(a.mandatory) ||
      c.priority - a.priority ||
      SIZE_RANK[c.size] - SIZE_RANK[a.size],
  );
  for (const r of requests) {
    const results = fulfillRequests(b),
      need = results.find((a) => a.request.id === r.id)!.missing;
    if (r.type !== "SPINAL") place(r.size, need, r);
  }
  const remaining = () => Math.max(0, target - b.hardpoints.length);
  if (b.order.length >= 250)
    place(
      "L",
      Math.min(
        remaining(),
        Math.floor(target * 0.06 * (0.5 + b.order.priorities.firepower / 100)),
      ),
    );
  if (b.order.length >= 100)
    place(
      "M",
      Math.min(
        remaining(),
        Math.floor(target * 0.22 * (0.75 + b.order.priorities.missile / 200)),
      ),
    );
  place("S", remaining());
  plan.requests = fulfillRequests(b);
  plan.summary = summarizeSlots(b);
  plan.diagnostics.stopReason =
    b.hardpoints.length >= target
      ? "TARGET_REACHED"
      : plan.diagnostics.candidates >= 18000
        ? "BOUNDED_SEARCH_LIMIT"
        : "AVAILABLE_COHERENT_SURFACE_OR_RESOURCE_LIMIT";
  b.modularHardpoints = plan;
  b.generatorVersion = "1.8.5.4";
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
