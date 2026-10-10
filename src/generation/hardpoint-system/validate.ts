import type { ShipBlueprint } from "../../blueprint/types";
import { SLOT_REGIONS, MOUNT_TYPES } from "./types";
import {
  normalizeHardpointOrder,
  slotBudget,
  slotEnvironment,
  slotPhysicalIssues,
  surfaceSlot,
  fulfillRequests,
  summarizeSlots,
  SLOT_LIMIT,
} from "./planner";
import { slotIndex, boxesOverlap, boxCorners } from "./geometry";
import { containsProductionVolume } from "../production/surface-contact";
import { dot, sub } from "../integration/contours";
import { SIZE_RANK, slotStandard } from "./compatibility";
const finiteVec = (v: { x: number; y: number; z: number } | undefined) =>
  !!v && [v.x, v.y, v.z].every(Number.isFinite);
const finiteBox = (box: import("./types").SlotBox | undefined) =>
  !!box && finiteVec(box.position) && finiteVec(box.localBounds.min) &&
  finiteVec(box.localBounds.max) && Object.values(box.frame).every(finiteVec);
export function validateModularHardpoints(b: ShipBlueprint) {
  const p = b.modularHardpoints;
  if (!p)
    return b.hardpoints.some((h) => h.modular)
      ? ["Modular slots without planning authority"]
      : [];
  const issues: string[] = [],
    fail = (reason: string) => issues.push(reason),
    env = slotEnvironment(b),
    budget = slotBudget(b),
    ids = new Set<string>(),
    index = slotIndex(16),
    internal = slotIndex(16);
  try {
    const order = structuredClone(b.order);
    normalizeHardpointOrder(order);
  } catch (e) {
    fail(String(e));
  }
  if (
    p.version !== "1.8.5.4" ||
    p.limit !== SLOT_LIMIT ||
    p.density !== (b.order.hardpointDensity ?? "STANDARD") ||
    p.target > SLOT_LIMIT ||
    p.target < 1 ||
    b.hardpoints.length > SLOT_LIMIT
  )
    fail("Invalid modular hardpoint version / density / bounds");
  for (const h of b.hardpoints) {
    const m = h.modular,
      host = b.structuralVolumes.find((v) => v.id === h.parentId);
    if (!m || !host || ids.has(h.id)) {
      fail("Missing/duplicate modular slot or parent " + h.id);
      continue;
    }
    ids.add(h.id);
    if (!finiteVec(h.position) || !finiteVec(h.normal) ||
      !finiteVec(m.localPosition) || !finiteBox(m.envelope) ||
      (m.internal && !finiteBox(m.internal)) ||
      !m.contacts.every(c => finiteVec(c.position) && finiteVec(c.normal)) ||
      !Number.isFinite(m.clearanceMeters) || !Number.isFinite(m.internalVolumeM3)) {
      fail("Non-finite modular slot geometry " + h.id);
      continue;
    }
    if (
      !["EMPTY", "OCCUPIED"].includes(m.state) ||
      !SLOT_REGIONS.includes(m.region) ||
      !m.mountTypes.length ||
      m.mountTypes.some((t) => !MOUNT_TYPES.includes(t)) ||
      Object.values(m.frame).some(
        (v) =>
          Object.values(v).some((n) => !Number.isFinite(n)) ||
          Math.abs(dot(v, v) - 1) > 1e-5,
      ) ||
      Math.abs(dot(m.frame.right, m.frame.normal)) > 1e-5 ||
      Math.abs(dot(m.frame.forward, m.frame.normal)) > 1e-5 ||
      Math.abs(dot(m.frame.right, m.frame.forward)) > 1e-5 ||
      Math.hypot(...Object.values(sub(m.frame.normal, h.normal))) > 1e-5 ||
      Math.hypot(
        ...Object.values(sub(m.localPosition, sub(h.position, host.position))),
      ) > 1e-5
    )
      fail("Invalid slot frame/type/position " + h.id);
    if (m.state === "OCCUPIED") {
      const mount = b.weaponLayout?.mounts.find(
        (w) => w.id === h.plannedMountId,
      );
      if (
        mount &&
        (JSON.stringify(m.mountTypes) !==
          JSON.stringify([
            mount.category === "MISSILE"
              ? "MISSILE"
              : mount.category === "POINT_DEFENSE"
                ? "DEFENSIVE"
                : "TURRET",
          ]) ||
          JSON.stringify(m.envelope) !==
            JSON.stringify({
              position: mount.position,
              frame: mount.frame,
              localBounds: mount.equipment.localBounds,
            }) ||
          JSON.stringify(m.contacts) !== JSON.stringify(mount.contacts))
      )
        fail("Occupied slot metadata differs from installed authority " + h.id);
      if (
        (!h.plannedMountId && h.type !== "Spinal") ||
        (h.type === "Spinal" &&
          !b.weaponLayout?.integrated?.some(
            (i) =>
              i.hardpointId === h.id &&
              i.reservationId === m.interface.spinalReservationId,
          ))
      )
        fail("Missing installed slot authority " + h.id);
      continue;
    }
    if (
      h.plannedMountId ||
      h.type === "Spinal" ||
      m.mountTypes.includes("SPINAL")
    )
      fail("Empty surface slot masquerades as integrated / installed " + h.id);
    const standard = slotStandard(h.size, b.order.length),
      limit = m.envelope.localBounds;
    if (
      h.radius !== standard.footprint.width / 2 ||
      JSON.stringify(h.allowedCategories) !== JSON.stringify(m.mountTypes) ||
      m.contacts.length !== 17 ||
      m.contacts.some((c) => c.structureId !== h.parentId) ||
      m.footprint.width !== standard.footprint.width ||
      m.footprint.length !== standard.footprint.length ||
      Math.abs(limit.min.x + standard.envelope.width / 2) > 1e-6 ||
      Math.abs(limit.max.x - standard.envelope.width / 2) > 1e-6 ||
      limit.min.y !== 0 ||
      Math.abs(limit.max.y - standard.envelope.height) > 1e-6 ||
      Math.abs(limit.min.z + standard.envelope.length / 2) > 1e-6 ||
      Math.abs(limit.max.z - standard.envelope.length / 2) > 1e-6 ||
      m.interface.ratingIndex !== [1, 3, 8, 18][SIZE_RANK[h.size]] ||
      m.interface.power !== "RESERVED_INTERFACE_NOT_SIMULATED" ||
      Math.hypot(...Object.values(sub(m.envelope.position, h.position))) >
        1e-6 ||
      JSON.stringify(m.envelope.frame) !== JSON.stringify(m.frame)
    )
      fail("Slot specification / support contract mismatch " + h.id);
    try {
      const resolved = surfaceSlot(
        b,
        m.contacts[8].position,
        m.region,
        h.size,
        env,
      );
      if (
        resolved.parentId !== h.parentId ||
        Object.keys(m.frame).some(
          (k) =>
            Math.hypot(
              ...Object.values(
                sub(
                  m.frame[k as keyof typeof m.frame],
                  resolved.slot.frame[k as keyof typeof m.frame],
                ),
              ),
            ) > 1e-5,
        ) ||
        Math.hypot(...Object.values(sub(resolved.position, h.position))) >
          1e-5 ||
        resolved.slot.contacts.some(
          (c, i) =>
            c.surfaceId !== m.contacts[i].surfaceId ||
            c.structureId !== m.contacts[i].structureId ||
            Math.hypot(
              ...Object.values(sub(c.position, m.contacts[i].position)),
            ) > 1e-5 ||
            Math.hypot(...Object.values(sub(c.normal, m.contacts[i].normal))) >
              1e-5,
        ) ||
        Math.abs(resolved.slot.internalVolumeM3 - m.internalVolumeM3) > 1e-5 ||
        Math.abs(resolved.slot.clearanceMeters - m.clearanceMeters) > 1e-5 ||
        !m.internal ||
        Math.hypot(
          ...Object.values(
            sub(resolved.slot.internal!.position, m.internal.position),
          ),
        ) > 1e-5 ||
        JSON.stringify(resolved.slot.internal!.localBounds) !==
          JSON.stringify(m.internal.localBounds)
      )
        fail("Detached or rewritten slot support " + h.id);
    } catch (e) {
      fail("Detached modular slot " + h.id + ": " + String(e));
    }
    if (
      !m.internal ||
      boxCorners(m.internal).some(
        (v) => !containsProductionVolume(host, v, b.order.length * 0.00001),
      )
    )
      fail("No physically contained internal pocket " + h.id);
    if (index.query(m.envelope).some((a) => boxesOverlap(a, m.envelope)))
      fail("Overlapping reserved slot envelopes " + h.id);
    index.add(m.envelope);
    if (m.internal) {
      if (internal.query(m.internal).some((a) => boxesOverlap(a, m.internal!)))
        fail("Overlapping support pocket " + h.id);
      internal.add(m.internal);
    }
    for (const reason of slotPhysicalIssues(b, m, env))
      fail(`${reason}: ${h.id}`);
    const r = budget.byHost[h.parentId];
    if (!Number.isFinite(m.internalVolumeM3) || m.internalVolumeM3 <= 0 || !r)
      fail("Invalid slot support resource " + h.id);
    else {
      r.reservedM3 += m.internalVolumeM3;
      budget.reservedM3 += m.internalVolumeM3;
    }
  }
  for (const [id, h] of Object.entries(budget.byHost))
    if (h.reservedM3 > h.availableM3 + 1e-6)
      fail("Host support budget exceeded " + id);
  if (
    budget.reservedM3 > budget.availableM3 + 1e-6 ||
    JSON.stringify(p.budget) !== JSON.stringify(budget)
  )
    fail("Support suballocation accounting mismatch");
  const actual = fulfillRequests(b);
  if (
    JSON.stringify(actual) !== JSON.stringify(p.requests) ||
    actual.some((r) => r.status === "FAILED")
  )
    fail("Hardpoint requirements unsatisfied or rewritten");
  if (JSON.stringify(summarizeSlots(b)) !== JSON.stringify(p.summary))
    fail("Slot summary mismatch");
  return [...new Set(issues)];
}
