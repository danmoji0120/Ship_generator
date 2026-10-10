import { detailFrame } from "../generation/details/geometry";
import { refinePreviewBattery } from "./battery";
import type { ShipBlueprint, Hardpoint } from "../blueprint/types";
import type { SurfaceContact } from "../generation/weapons/types";
import { moduleCompatibility } from "../generation/hardpoint-system/compatibility";
import { slotEnvironment } from "../generation/hardpoint-system/planner";
import {
  boxSolid,
  boxBounds,
  rayBox,
  boundsIndex,
} from "../generation/hardpoint-system/geometry";
import { surfaceRay, worldPoint } from "../generation/weapons/surfaces";
import { solidFromRings } from "../generation/armor/panels";
import {
  add,
  sub,
  mul,
  dot,
  boundsOf,
} from "../generation/integration/contours";
import { solidsIntrude, rayBlocked } from "../generation/weapons/collision";
import { PREVIEW_EQUIPMENT, type PreviewEquipment } from "./library";
import { equipmentOrigin, equipmentGeometry, type PreviewPart, type Shot } from "./geometry";
export type FitStatus =
  | "VALID"
  | "PARTIAL_ARC"
  | "BLOCKED"
  | "INCOMPATIBLE"
  | "NO_CLEARANCE"
  | "INSUFFICIENT_SUPPORT";
export interface ArcSample {
  yaw: number;
  elevation: number;
  clear: boolean;
  blockers: string[];
}
export interface FitResult {
  slotId: string;
  equipmentId: string;
  status: FitStatus;
  reasons: string[];
  parts: PreviewPart[];
  shots: Shot[];
  contacts: SurfaceContact[];
  samples: ArcSample[];
  interfaceOffsetMeters?:number;
  pose?: { yaw: number; elevation: number };
  pairId?: string;
  batteryId?: string;
  compatibleAlternatives?: string[];
}
export interface PreviewRequest {
  scope: "SINGLE" | "PAIR" | "BATTERY" | "AUTO";
  slotId?: string;
  equipmentId: string;
  refineBattery?: boolean;
}
export const AUTO_PREVIEW_LIMIT = 32;
export interface PreviewPlan {
  version: "1.8.5.4.2";
  omissions?: { slotId: string; reason: string }[];
  request: PreviewRequest;
  results: FitResult[];
  elapsedMs: number;
  cached: boolean;
  limitations: string[];
  slotOverrides?: Hardpoint[];
  batteryRefinement?: ReturnType<typeof refinePreviewBattery>["report"];
}
const environments = new WeakMap<
  ShipBlueprint,
  ReturnType<typeof slotEnvironment>
>();
const plans = new WeakMap<ShipBlueprint, Map<string, PreviewPlan>>();
function environment(b: ShipBlueprint) {
  let e = environments.get(b);
  if (!e) {
    e = slotEnvironment(b);
    environments.set(b, e);
  }
  return e;
}
export function previewFoundation(
  h: Hardpoint,
  e: PreviewEquipment,
  env: ReturnType<typeof slotEnvironment>,
) {
  const origin=equipmentOrigin(h),offset=dot(sub(origin,h.position),h.modular!.frame.normal);
  const m = h.modular!,
    w = e.footprint.width / 2,
    l = e.footprint.length / 2,
    c = 0.16;
  const uv = [
    [-w * (1 - c), -l],
    [w * (1 - c), -l],
    [w, -l * (1 - c)],
    [w, l * (1 - c)],
    [w * (1 - c), l],
    [-w * (1 - c), l],
    [-w, l * (1 - c)],
    [-w, -l * (1 - c)],
  ];
  const probes = [
    ...uv,
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
  const contacts = probes.map(([x, z]) => {
    const hit = surfaceRay(
      env.surfaces,
      worldPoint(origin, m.frame, { x, y: 0, z }),
      m.frame.normal,
    );
    if (
      !hit ||
      hit.structureId !== h.parentId ||
      dot(hit.normal, m.frame.normal) < 0.85
    )
      throw Error("SUPPORT_SURFACE_MISSING");
    const depth = dot(sub(origin, hit.position), m.frame.normal);
    if (
      depth < 0.01 ||
      depth >
        Math.max(
          ...m.contacts.map((p) =>
            dot(sub(h.position, p.position), m.frame.normal),
          ),
        ) + offset +
          0.05
    )
      throw Error("SUPPORT_RELIEF_EXCEEDS_SLOT");
    return hit;
  });
  const root = contacts
      .slice(0, 8)
      .map((p) => sub(p.position, mul(m.frame.normal, 0.18))),
    cap = uv.map(([x, z]) =>
      worldPoint(origin, m.frame, { x: x * 0.94, y: 0, z: z * 0.94 }),
    );
  const solid = solidFromRings([[...root].reverse(), [...cap].reverse()]);
  return {
    contacts,
    part: {
      id: h.id + "/preview-foundation",
      role: "FOUNDATION" as const,
      solid,
      bounds: boundsOf(solid.vertices),
    },
  };
}
function directionalExhaust(b: ShipBlueprint) {
  return b.engines.map((e) => {
    const radius = e.nozzleRadius * (e.bellRatio + 0.2),
      box = {
        position: e.position,
        frame: detailFrame(e.direction ?? { x: 0, y: 0, z: 1 }),
        localBounds: {
          min: { x: -radius, y: 0, z: -radius },
          max: {
            x: radius,
            y: e.nozzleLength + b.order.length * 0.04,
            z: radius,
          },
        },
      };
    return {
      id: e.id + "/directional-exhaust",
      solid: boxSolid(box),
      bounds: boxBounds(box),
    };
  });
}
const successful = (r: FitResult) =>
  r.status === "VALID" || r.status === "PARTIAL_ARC";
export function fitEquipment(
  b: ShipBlueprint,
  h: Hardpoint,
  e: PreviewEquipment,
  placed: FitResult[] = [],
  env = environment(b),
): FitResult {
  const result: FitResult = {
    slotId: h.id,
    equipmentId: e.id,
    status: "INCOMPATIBLE",
    reasons: [],
    parts: [],
    shots: [],
    contacts: [],
    samples: [],
    pairId: h.modular?.pairId,
    batteryId: h.modular?.batteryGroupId,
  };
  const compatibility = moduleCompatibility(h, e);
  if (!compatibility.allowed) {
    result.reasons = compatibility.reasons;
    return result;
  }
  result.interfaceOffsetMeters=dot(sub(equipmentOrigin(h),h.position),h.modular!.frame.normal);
  let foundation: ReturnType<typeof previewFoundation>;
  try {
    foundation = previewFoundation(h, e, env);
  } catch (err) {
    result.status = "INSUFFICIENT_SUPPORT";
    result.reasons = [String(err)];
    return result;
  }
  result.contacts = foundation.contacts;
  // Supplement the legacy slot environment's axial bounds with actual engine direction.
  const engineExhaust = directionalExhaust(b);
  const scene = [
      ...env.scene,
      ...engineExhaust,
      ...placed.flatMap((r) => r.parts),
    ],
    query = boundsIndex(scene);
  const guards = [
    ...(b.weaponLayout?.mounts ?? []).flatMap((m) =>
      m.firingArc.samples.map((s) => ({
        origin: s.origin,
        direction: s.direction,
        range: m.firingArc.rangeMeters,
        id: "EXISTING_ARC:" + m.id,
      })),
    ),
    ...env.sensorRays.map((s) => ({ ...s, id: "SENSOR_ACCESS" })),
    ...(b.exteriorDetailPlan?.kitPlacements ?? []).map((k) => ({
      origin: add(k.access.origin, mul(k.access.direction, 0.05)),
      direction: k.access.direction,
      range: k.access.depth,
      id: "SERVICE_ACCESS:" + k.id,
    })),
    ...placed.flatMap((r) =>
      r.shots.map((shot) => ({
        ...shot,
        range: 60,
        id: "PREVIEW_FIRE:" + r.slotId,
      })),
    ),
  ].map((s) => ({
    ...s,
    bounds: boundsOf([s.origin, add(s.origin, mul(s.direction, s.range))]),
  }));
  const guardQuery = boundsIndex(guards);
  const supportIds = new Set(result.contacts.map((c) => c.surfaceId));
  supportIds.add(h.parentId);
  // Foundation embeds only in measured parent surfaces; other equipment contact is never exempted.
  const foundationHits = query(foundation.part.bounds)
    .filter(
      (s) =>
        !supportIds.has(s.id) &&
        solidsIntrude(
          foundation.part.solid,
          foundation.part.bounds,
          s.solid,
          s.bounds,
        ),
    )
    .map((s) => s.id);
  if (foundationHits.length) {
    result.status = "BLOCKED";
    result.reasons = foundationHits;
    return result;
  }
  const problems = (parts: PreviewPart[], shots: Shot[]) => {
    const errors: string[] = [];
    for (const p of parts) {
      for (const s of query(p.bounds))
        if (solidsIntrude(p.solid, p.bounds, s.solid, s.bounds))
          errors.push(s.id);
      for (const x of env.exclusions(p.bounds)) {
        const box = {
          position: { x: 0, y: 0, z: 0 },
          frame: {
            right: { x: 1, y: 0, z: 0 },
            normal: { x: 0, y: 1, z: 0 },
            forward: { x: 0, y: 0, z: -1 },
          },
          localBounds: x.bounds,
        };
        if (solidsIntrude(p.solid, p.bounds, boxSolid(box), x.bounds))
          errors.push("RESERVED:" + x.id);
      }
      const piece = {
        position: { x: 0, y: 0, z: 0 },
        frame: {
          right: { x: 1, y: 0, z: 0 },
          normal: { x: 0, y: 1, z: 0 },
          forward: { x: 0, y: 0, z: -1 },
        },
        localBounds: p.bounds,
      };
      // Existing canonical firing directions, optical access and maintenance access stay protected.
      for (const s of guardQuery(p.bounds))
        if (rayBox(s.origin, s.direction, s.range, piece)) errors.push(s.id);
    }

    for (const shot of shots) {
      const endpoint = add(shot.origin, mul(shot.direction, e.launchRange)),
        hit = rayBlocked(shot.origin, shot.direction, e.launchRange, [
          ...query(boundsOf([shot.origin, endpoint])),
          ...parts,
        ]);
      if (hit) errors.push("FIRING_PATH:" + hit);
    }
    return [...new Set(errors)];
  };
  const poses: {
    yaw: number;
    elevation: number;
    parts: PreviewPart[];
    shots: Shot[];
  }[] = [];
  for (const yaw of e.yaw)
    for (const elevation of e.elevation) {
      const geo = equipmentGeometry(h, e, yaw, elevation),
        blockers = problems(geo.parts, geo.shots);
      result.samples.push({
        yaw,
        elevation,
        clear: blockers.length === 0,
        blockers,
      });
      if (!blockers.length) poses.push({ yaw, elevation, ...geo });
    }
  if (!poses.length) {
    result.status = result.samples.some((s) =>
      s.blockers.some((x) => !x.startsWith("FIRING_PATH")),
    )
      ? "BLOCKED"
      : "NO_CLEARANCE";
    result.reasons = [...new Set(result.samples.flatMap((s) => s.blockers))];
    return result;
  }
  poses.sort(
    (a, c) =>
      Math.abs(a.yaw) - Math.abs(c.yaw) ||
      Math.abs(a.elevation - 20) - Math.abs(c.elevation - 20),
  );
  const chosen = poses[0];
  result.pose = { yaw: chosen.yaw, elevation: chosen.elevation };
  result.parts = [foundation.part, ...chosen.parts];
  result.shots = chosen.shots;
  result.status =
    poses.length === result.samples.length ? "VALID" : "PARTIAL_ARC";
  result.reasons =
    result.status === "PARTIAL_ARC"
      ? [
          "Sampled operating arc limited by " +
            [...new Set(result.samples.flatMap((s) => s.blockers))]
              .slice(0, 6)
              .join(", "),
        ]
      : [];
  return result;
}
/** Runtime preview only. No calls from generation; canonical JSON is never mutated. */
export function planEquipmentPreview(
  b: ShipBlueprint,
  request: PreviewRequest,
): PreviewPlan {
  const key = JSON.stringify(request),
    cache = plans.get(b) ?? new Map<string, PreviewPlan>();
  plans.set(b, cache);
  const old = cache.get(key);
  if (old) return { ...old, cached: true };
  const start = performance.now(),
    env = environment(b),
    refined =
      request.refineBattery && request.scope === "BATTERY"
        ? refinePreviewBattery(b, request.slotId, env)
        : undefined;
  if (refined) b = refined.blueprint;
  const selected = b.hardpoints.find((h) => h.id === request.slotId),
    equipment = PREVIEW_EQUIPMENT.find((e) => e.id === request.equipmentId);
  if (!equipment) throw Error("Unknown preview equipment");
  const empty = b.hardpoints.filter((h) => h.modular?.state === "EMPTY");
  let groups: Hardpoint[][] = [];
  if (request.scope === "AUTO") {
    const seen = new Set<string>();
    for (const h of [...empty].sort(
      (a, c) =>
        ({ XL: 3, L: 2, M: 1, S: 0 })[c.size] -
        { XL: 3, L: 2, M: 1, S: 0 }[a.size],
    )) {
      if (seen.has(h.id)) continue;
      const group = h.modular?.pairId
        ? empty.filter((x) => x.modular?.pairId === h.modular!.pairId)
        : [h];
      group.forEach((x) => seen.add(x.id));
      groups.push(group);
    }
  } else if (!selected) throw Error("Select a hardpoint");
  else if (request.scope === "PAIR") {
    groups = [
      selected.modular?.pairId
        ? b.hardpoints.filter(
            (h) => h.modular?.pairId === selected.modular!.pairId,
          )
        : [selected],
    ];
  } else if (request.scope === "BATTERY") {
    groups = selected.modular?.batteryGroupId
      ? [
          b.hardpoints.filter(
            (h) =>
              h.modular?.batteryGroupId === selected.modular!.batteryGroupId,
          ),
        ]
      : [[selected]];
  } else groups = [[selected]];
  const results: FitResult[] = [];
  const omissions: { slotId: string; reason: string }[] = [];
  for (const group of groups) {
    if (
      request.scope === "AUTO" &&
      results.filter(successful).length + group.length > AUTO_PREVIEW_LIMIT
    ) {
      omissions.push(
        ...group.map((h) => ({
          slotId: h.id,
          reason: "REPRESENTATIVE_PREVIEW_LIMIT_32 — not geometrically tested",
        })),
      );
      continue;
    }
    const chosen =
      request.scope === "AUTO"
        ? (PREVIEW_EQUIPMENT.filter(
            (e) => moduleCompatibility(group[0], e).allowed,
          ).sort(
            (a, c) =>
              ({ XL: 3, L: 2, M: 1, S: 0 })[c.size] -
              { XL: 3, L: 2, M: 1, S: 0 }[a.size],
          )[0] ?? equipment)
        : equipment;
    const tentative: FitResult[] = [];
    for (const h of group)
      tentative.push(
        fitEquipment(
          b,
          h,
          chosen,
          [...results.filter(successful), ...tentative.filter(successful)],
          env,
        ),
      );
    if (
      request.scope === "PAIR" &&
      (!selected?.modular?.pairId || group.length !== 2)
    )
      tentative.forEach((r) => {
        r.status = "INCOMPATIBLE";
        r.reasons = ["No complete actual symmetric pair"];
        r.parts = [];
        r.shots = [];
      });
    if (request.scope === "BATTERY" && !selected?.modular?.batteryGroupId)
      tentative.forEach((r) => {
        r.status = "INCOMPATIBLE";
        r.reasons = ["No actual battery group"];
        r.parts = [];
        r.shots = [];
      });
    // Paired transaction: never display one-sided success. Battery reports each real slot independently.
    for (const pair of new Set(
      tentative.flatMap((r) => (r.pairId ? [r.pairId] : [])),
    )) {
      const members = tentative.filter((r) => r.pairId === pair);
      if (members.length === 2 && members.some((r) => !successful(r)))
        members.filter(successful).forEach((r) => {
          r.status = "NO_CLEARANCE";
          r.reasons = [
            "PAIR_ROLLBACK: " +
              members
                .filter((x) => !successful(x))
                .map((x) => x.slotId + ":" + x.reasons.join("/"))
                .join(";"),
          ];
          r.parts = [];
          r.shots = [];
        });
    }
    // Bilateral local frames are right-handed: mirrored world yaw is NEGATED locally.
    // Keep independent arc masks, but find a mutually safe mirrored displayed pose.
    for (const pair of new Set(
      tentative.flatMap((r) => (r.pairId ? [r.pairId] : [])),
    )) {
      const members = tentative.filter((r) => r.pairId === pair);
      if (members.length !== 2 || !members.every(successful)) continue;
      const [a, c] = members;
      if (
        a.pose!.yaw === -c.pose!.yaw &&
        a.pose!.elevation === c.pose!.elevation
      )
        continue;
      const ah = b.hardpoints.find((h) => h.id === a.slotId)!,
        ch = b.hardpoints.find((h) => h.id === c.slotId)!;
      const candidates = a.samples
        .filter(
          (s) =>
            s.clear &&
            c.samples.some(
              (t) => t.clear && t.yaw === -s.yaw && t.elevation === s.elevation,
            ),
        )
        .sort(
          (x, y) =>
            Math.abs(x.yaw) - Math.abs(y.yaw) ||
            Math.abs(x.elevation - 20) - Math.abs(y.elevation - 20),
        );
      let adopted = false;
      for (const sample of candidates) {
        const ga = equipmentGeometry(ah, chosen, sample.yaw, sample.elevation),
          gc = equipmentGeometry(ch, chosen, -sample.yaw, sample.elevation);
        if (
          ga.parts.some((p) =>
            gc.parts.some((q) =>
              solidsIntrude(p.solid, p.bounds, q.solid, q.bounds),
            ),
          ) ||
          ga.shots.some((s) =>
            rayBlocked(s.origin, s.direction, chosen.launchRange, gc.parts),
          ) ||
          gc.shots.some((s) =>
            rayBlocked(s.origin, s.direction, chosen.launchRange, ga.parts),
          )
        )
          continue;
        a.pose = { yaw: sample.yaw, elevation: sample.elevation };
        c.pose = { yaw: -sample.yaw, elevation: sample.elevation };
        a.parts = [a.parts[0], ...ga.parts];
        c.parts = [c.parts[0], ...gc.parts];
        a.shots = ga.shots;
        c.shots = gc.shots;
        adopted = true;
        break;
      }
      if (!adopted)
        for (const r of members) {
          r.status = "NO_CLEARANCE";
          r.reasons = ["NO_MUTUALLY_CLEAR_MIRRORED_POSE"];
          r.parts = [];
          r.shots = [];
        }
    }
    results.push(...tentative);
  }
  // Final sampled arcs include EVERY accepted preview neighbor; selected pose cannot be obstructed
  // by later adoptions (protected above). Store sample grid, never claim continuous 360° proof.
  const finalScene = [
    ...env.scene,
    ...directionalExhaust(b),
    ...results.filter(successful).flatMap((r) => r.parts),
  ];
  const q = boundsIndex(finalScene);
  for (const r of results.filter(successful)) {
    const h = b.hardpoints.find((h) => h.id === r.slotId)!,
      e = PREVIEW_EQUIPMENT.find((e) => e.id === r.equipmentId)!;
    for (const sample of r.samples.filter((s) => s.clear)) {
      const geo = equipmentGeometry(h, e, sample.yaw, sample.elevation);
      for (const p of geo.parts)
        for (const s of q(p.bounds))
          if (
            !s.id.startsWith(h.id + "/") &&
            solidsIntrude(p.solid, p.bounds, s.solid, s.bounds)
          )
            sample.blockers.push(s.id);
      for (const shot of geo.shots) {
        const hit = rayBlocked(
          shot.origin,
          shot.direction,
          e.launchRange,
          q(
            boundsOf([
              shot.origin,
              add(shot.origin, mul(shot.direction, e.launchRange)),
            ]),
          ).filter((s) => !s.id.startsWith(h.id + "/")),
        );
        if (hit) sample.blockers.push("FIRING_PATH:" + hit);
      }
      sample.clear = !sample.blockers.length;
    }
    if (r.samples.some((s) => !s.clear)) r.status = "PARTIAL_ARC";
    if (
      !r.samples.some(
        (s) =>
          s.clear && s.yaw === r.pose?.yaw && s.elevation === r.pose?.elevation,
      )
    ) {
      r.status = "NO_CLEARANCE";
      r.reasons = ["FINAL_REPLAY_CURRENT_POSE_BLOCKED"];
      r.parts = [];
      r.shots = [];
    }
  }
  for (const pair of new Set(
    results.flatMap((r) => (r.pairId ? [r.pairId] : [])),
  )) {
    const members = results.filter((r) => r.pairId === pair);
    if (members.length === 2 && members.some((r) => !successful(r)))
      for (const r of members.filter(successful)) {
        r.status = "NO_CLEARANCE";
        r.reasons = ["PAIR_ROLLBACK_FINAL_REPLAY"];
        r.parts = [];
        r.shots = [];
      }
  }
  for (const r of results.filter((r) => !successful(r))) {
    const e = PREVIEW_EQUIPMENT.find((e) => e.id === r.equipmentId)!;
    r.compatibleAlternatives = empty
      .filter(
        (h) =>
          h.id !== r.slotId &&
          h.modular?.pairId !== r.pairId &&
          moduleCompatibility(h, e).allowed,
      )
      .slice(0, 4)
      .map((h) => h.id);
  }
  const plan: PreviewPlan = {
    omissions,
    slotOverrides: refined?.slots,
    batteryRefinement: refined?.report,
    version: "1.8.5.4.2",
    request: { ...request },
    results,
    elapsedMs: performance.now() - start,
    cached: false,
    limitations: [
      "30° yaw / discrete elevation samples; not continuous sweep proof",
      "Geometric support contacts only: strength, mass loading, power and feed NOT SIMULATED",
      "Static initial missile path; no guidance, ballistics or combat performance",
    ],
  };
  if (cache.size >= 12) cache.delete(cache.keys().next().value!);
  cache.set(key, plan);
  return plan;
}
