import type { Vec3 } from "../../blueprint/types";
import type { IntegrationContext } from "./context";
import {
  sub,
  unit,
  mul,
  sectionRing,
  scaledRing,
  contactPatch,
  alignRing,
  mix,
} from "./contours";
export function addConnections(ctx: IntegrationContext) {
  const { b, yard, l, p, vs, inset, emit, socket, decisions } = ctx;
  // A. Full axial transition skins, restricted lateral shoulders, local shoes on intentionally exposed trusses.
  for (const c of b.structuralConnectors) {
    const a = vs.find((v) => v.id === c.fromStructureId)!,
      d = vs.find((v) => v.id === c.toStructureId)!,
      delta = sub(c.end, c.start);
    if (Math.hypot(delta.x, delta.y, delta.z) < l * 0.002) {
      decisions.push({
        sourceId: c.id,
        status: "fallback",
        reason:
          "Recessed volumes already overlap; retain the existing join and use flank armor",
      });
      continue;
    }
    const normal = unit(delta),
      exposed =
        c.type === "TRUSS" ||
        c.type === "BOOM" ||
        b.architecture.grammar === "CORE_AND_NACELLES";
    try {
      if (exposed) {
        for (const [v, pos, n] of [
          [a, c.start, normal],
          [d, c.end, mul(normal, -1)],
        ] as const) {
          const ring = contactPatch(
            v,
            pos,
            n,
            Math.min(c.thickness * 1.9, v.dimensions.z * 0.45),
            Math.min(c.thickness * 1.9, v.dimensions.y * 0.9),
            inset,
          );
          emit("JUNCTION_HOUSING", `${c.id}-${v.id}`, [socket(v, pos, n)], {
            phase: "integration",
            connectorId: c.id,
            rings: [ring, scaledRing(ring, 1.07, mul(n, inset * 1.4))],
            contactSamples: ring.map((position) => ({
              parentId: v.id,
              position,
            })),
            inset,
            armorClass: "JOINT",
          });
        }
      } else if (
        Math.abs(normal.z) > 0.88 &&
        Math.abs(a.position.x - d.position.x) < l * 0.035
      ) {
        const direction = Math.sign(delta.z),
          ra = sectionRing(a, c.start.z - direction * inset),
          rb = sectionRing(d, c.end.z + direction * inset);
        if (direction < 0) {
          ra.reverse();
          rb.reverse();
        }
        const rings = [
          ra,
          scaledRing(
            ra,
            yard.structure === "heavy" ? 1.06 : 1.025,
            mul({ x: 0, y: 0, z: direction }, inset),
          ),
          scaledRing(
            rb,
            yard.structure === "heavy" ? 1.06 : 1.025,
            mul({ x: 0, y: 0, z: -direction }, inset),
          ),
          rb,
        ];
        const kind =
          yard.structure === "heavy"
            ? "REINFORCED_COLLAR"
            : yard.structure === "truss"
              ? "JUNCTION_HOUSING"
              : yard.structure === "clean"
                ? "STRUCTURAL_FAIRING"
                : "TRANSITION_SHELL";
        const sockets = [
          socket(a, c.start, normal),
          socket(d, c.end, mul(normal, -1)),
        ];
        if (
          !emit(kind, c.id, sockets, {
            phase: "integration",
            connectorId: c.id,
            rings,
            contactSamples: [
              ...ra.map((position) => ({ parentId: a.id, position })),
              ...rb.map((position) => ({ parentId: d.id, position })),
            ],
            inset,
            armorClass: "JOINT",
          })
        ) {
          const width = (r: Vec3[]) =>
            Math.max(...r.map((p) => p.x)) - Math.min(...r.map((p) => p.x));
          const common = Math.min(width(ra), width(rb)) * 0.82,
            sa = scaledRing(ra, Math.min(0.82, common / width(ra))),
            sb = scaledRing(rb, Math.min(0.82, common / width(rb)));
          const fallback = [
            sa,
            scaledRing(sa, 1.025, { x: 0, y: 0, z: direction * inset }),
            scaledRing(sb, 1.025, { x: 0, y: 0, z: -direction * inset }),
            sb,
          ];
          if (
            emit("TRANSITION_SHELL", `${c.id}-restricted`, sockets, {
              phase: "integration",
              connectorId: c.id,
              rings: fallback,
              contactSamples: [
                ...sa.map((position) => ({ parentId: a.id, position })),
                ...sb.map((position) => ({ parentId: d.id, position })),
              ],
              inset,
              armorClass: "JOINT",
            })
          )
            decisions.push({
              sourceId: c.id,
              status: "fallback",
              reason:
                "Narrow station-fitted transition preserves neighbouring volumes and equipment",
            });
        }
      } else {
        const width = Math.min(a.dimensions.z, d.dimensions.z) * 0.72,
          height = Math.min(a.dimensions.y, d.dimensions.y) * 0.85;
        const ra = contactPatch(a, c.start, normal, width, height, inset),
          rb = alignRing(
            ra,
            contactPatch(
              d,
              c.end,
              mul(normal, -1),
              width,
              height,
              inset,
            ).reverse(),
          );
        // Matching contour ordering at both sockets is essential for a non-twisted skin.
        const mid = ra.map((q, i) => mix(q, rb[i], 0.5));
        emit(
          yard.structure === "heavy"
            ? "ARMORED_SHOULDER"
            : "STRUCTURAL_FAIRING",
          c.id,
          [socket(a, c.start, normal), socket(d, c.end, mul(normal, -1))],
          {
            phase: "integration",
            connectorId: c.id,
            rings: [ra, scaledRing(mid, 1.03), rb],
            contactSamples: [
              ...ra.map((position) => ({ parentId: a.id, position })),
              ...rb.map((position) => ({ parentId: d.id, position })),
            ],
            inset,
            armorClass: "JOINT",
          },
        );
      }
    } catch (e) {
      decisions.push({
        sourceId: c.id,
        status: "fallback",
        reason: `Local join retained: ${String(e)}`,
      });
    }
  }
}
