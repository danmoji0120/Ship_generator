import type { ShipBlueprint, Hardpoint } from "../blueprint/types";
import {
  slotEnvironment,
  surfaceSlot,
  slotPhysicalIssues,
} from "../generation/hardpoint-system/planner";
import { slotStandard } from "../generation/hardpoint-system/compatibility";
import { boxesOverlap } from "../generation/hardpoint-system/geometry";
/** Bounded preview-only refinement. Relocates real EMPTY M pairs, never adds slots or moves
 * installed/mandatory mounts. Complete reservation volumes, surfaces and clearances still apply. */
export function refinePreviewBattery(
  b: ShipBlueprint,
  id: string | undefined,
  env: ReturnType<typeof slotEnvironment>,
) {
  const selected = b.hardpoints.find((h) => h.id === id),
    group = selected?.modular?.batteryGroupId;
  const report = {
    accepted: false,
    attempts: [] as { rows: number; reasons: string[] }[],
    movedIds: [] as string[],
    reason: "",
  };
  if (
    !selected ||
    selected.size !== "M" ||
    selected.modular?.region !== "TOP" ||
    !group
  ) {
    report.reason = "Select an existing TOP M battery";
    return { blueprint: b, report, slots: [] as Hardpoint[] };
  }
  const required = new Set(
    b.modularHardpoints?.requests
      .filter((r) => r.request.mandatory)
      .flatMap((r) => r.matchedIds),
  );
  const members = b.hardpoints.filter(
    (h) =>
      h.modular?.batteryGroupId === group &&
      h.position.x < 0 &&
      h.modular.state === "EMPTY",
  );
  if (members.length < 2) {
    report.reason = "No measured bilateral longitudinal battery";
    return { blueprint: b, report, slots: [] as Hardpoint[] };
  }
  const x = members.reduce((n, h) => n + h.position.x, 0) / members.length,
    end = Math.max(...members.map((h) => h.position.z));
  const candidates = b.hardpoints
    .filter(
      (h) =>
        h.size === "M" &&
        h.modular?.state === "EMPTY" &&
        h.modular.region === "TOP" &&
        h.parentId === selected.parentId &&
        h.position.x < 0 &&
        h.modular.pairId &&
        !required.has(h.id) &&
        Math.abs(h.position.z - end) <=
          slotStandard("M", b.order.length).envelope.length * 3,
    )
    .filter((h) =>
      b.hardpoints.some(
        (p) =>
          p.id !== h.id &&
          p.modular?.pairId === h.modular!.pairId &&
          p.modular!.state === "EMPTY" &&
          !required.has(p.id),
      ),
    )
    .sort(
      (a, c) =>
        Number(c.modular!.batteryGroupId === group) -
          Number(a.modular!.batteryGroupId === group) ||
        Math.abs(a.position.x - x) - Math.abs(c.position.x - x) ||
        a.id.localeCompare(c.id),
    );
  const spacing = slotStandard("M", b.order.length).envelope.length * 1.45;
  for (let rows = Math.min(6, candidates.length); rows >= 3; rows--) {
    const chosen = candidates.slice(0, rows),
      ids = new Set(
        chosen.flatMap((h) =>
          b.hardpoints
            .filter((p) => p.modular?.pairId === h.modular!.pairId)
            .map((p) => p.id),
        ),
      ),
      pending: Hardpoint[] = [],
      reasons: string[] = [];
    try {
      for (let i = 0; i < rows; i++)
        for (const sign of [-1, 1]) {
          const old =
            sign === -1
              ? chosen[i]
              : b.hardpoints.find(
                  (h) =>
                    h.id !== chosen[i].id &&
                    h.modular?.pairId === chosen[i].modular!.pairId,
                )!;
          const r = surfaceSlot(
            b,
            {
              x: sign * Math.abs(x),
              y: selected.position.y,
              z: end - (rows - 1 - i) * spacing,
            },
            "TOP",
            "M",
            env,
          );
          if (r.slot.internalVolumeM3 > old.modular!.internalVolumeM3 + 1e-6)
            throw Error("INTERNAL_SUPPORT_ALLOCATION_INCREASE");
          if (r.parentId !== old.parentId)
            throw Error("REFINEMENT_CHANGED_SUPPORT_PARENT");
          const h = {
            ...old,
            position: r.position,
            normal: r.slot.frame.normal,
            modular: {
              ...r.slot,
              mountTypes: old.modular!.mountTypes,
              pairId: old.modular!.pairId,
              batteryGroupId: "preview-battery/" + group,
              zoneId: old.modular!.zoneId,
              symmetryReason: "BILATERAL_VERIFIED" as const,
            },
          };
          const issues = slotPhysicalIssues(b, h.modular, env);
          if (issues.length) throw Error(issues.join("/"));
          for (const p of [
            ...b.hardpoints.filter(
              (h) => h.modular && h.modular.state === "EMPTY" && !ids.has(h.id),
            ),
            ...pending,
          ])
            if (
              boxesOverlap(h.modular.envelope, p.modular!.envelope) ||
              (h.modular.internal &&
                p.modular!.internal &&
                boxesOverlap(h.modular.internal, p.modular!.internal))
            )
              throw Error("RESERVED_SLOT_OVERLAP:" + p.id);
          pending.push(h);
        }
    } catch (e) {
      reasons.push(String(e));
    }
    report.attempts.push({ rows, reasons });
    if (reasons.length) continue;
    // Independently measured pair geometry, including both normals, must remain mirrored.
    if (
      pending.some(
        (h, i) =>
          i % 2 === 0 &&
          (Math.abs(h.position.x + pending[i + 1].position.x) > 0.05 ||
            Math.abs(h.position.y - pending[i + 1].position.y) > 0.05 ||
            Math.abs(h.normal.x + pending[i + 1].normal.x) > 0.02 ||
            Math.abs(h.normal.y - pending[i + 1].normal.y) > 0.02 ||
            Math.abs(h.normal.z - pending[i + 1].normal.z) > 0.02),
      )
    ) {
      report.attempts.at(-1)!.reasons.push("PAIR_SUPPORT_MISMATCH");
      continue;
    }
    report.accepted = true;
    report.movedIds = pending.map((h) => h.id);
    report.reason = `${rows} measured M slots per side; preview-only empty slot relocation`;
    return {
      blueprint: {
        ...b,
        hardpoints: b.hardpoints.map(
          (h) => pending.find((p) => p.id === h.id) ?? h,
        ),
      },
      report,
      slots: pending,
    };
  }
  report.reason =
    "No longer battery passed unchanged physical reservation tests";
  return { blueprint: b, report, slots: [] as Hardpoint[] };
}
