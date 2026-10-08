import type {
  ShipBlueprint,
  PrefabPlacement,
  ExteriorKind,
  ExteriorDefinition,
  StructuralVolume,
  PrefabSocket,
  Vec3,
  ArmorClass,
} from "../../blueprint/types";
import { getShipyard } from "../../shipyards/config";
import { containsVolume } from "../architecture/volumes";
import { PREFAB_LIBRARY } from "../prefabs";
import { contourSamples, boundsOf } from "./contours";
import { addConnections } from "./connections";
import { addCompletion } from "./completion";
import { addArmor } from "./armor";
import { addEquipment } from "./equipment";
import { overallEnvelope } from "./bounds";
import {
  equipmentReservations,
  inReservedZone,
  permittedOwnZone,
} from "./reservations";

/** All phases use finalized equipment reservations. Original structural layout and RNG are untouched. */
export function integrateHull(b: ShipBlueprint) {
  const yard = getShipyard(b.shipyardId),
    l = b.order.length,
    p = b.order.priorities,
    vs = b.structuralVolumes;
  // The V1.6 clustered nozzle bells can intersect; keep mount positions, bound casing radii by actual spacing.
  for (const e of b.engines) {
    const neighbours = b.engines.filter(
      (q) => q !== e && q.parentId === e.parentId,
    );
    if (neighbours.length) {
      const spacing = Math.min(
        ...neighbours.map((q) =>
          Math.hypot(q.position.x - e.position.x, q.position.y - e.position.y),
        ),
      );
      e.nozzleRadius = Math.min(e.nozzleRadius, (spacing * 0.39) / e.bellRatio);
    }
  }
  const zones = equipmentReservations(b),
    decisions: NonNullable<ShipBlueprint["hullIntegration"]>["decisions"] = [],
    parts: PrefabPlacement[] = [];
  const inset =
    l *
    (yard.structure === "heavy"
      ? 0.004
      : yard.structure === "clean"
        ? 0.002
        : 0.003);
  const socket = (
    v: StructuralVolume,
    position: Vec3,
    normal: Vec3,
  ): PrefabSocket => ({ kind: "HULL_FACE", hostId: v.id, position, normal });
  function emit(
    kind: ExteriorKind,
    sourceId: string,
    sockets: PrefabSocket[],
    fit: Omit<
      ExteriorDefinition,
      "matingSockets" | "parentIds" | "protectionGrade"
    >,
  ) {
    const points =
      fit.rings?.flat() ??
      (fit.tube
        ? Array.from({ length: 32 }, (_, i) => {
            const t = fit.tube!;
            const a = ((i % 16) * Math.PI) / 8;
            return {
              x: t.center.x + Math.cos(a) * t.outerRadius,
              y: t.center.y + Math.sin(a) * t.outerRadius,
              z: t.center.z + (i < 16 ? -0.5 : 0.5) * t.length,
            };
          })
        : []);
    if (
      !points.length ||
      points.some((q) => !Object.values(q).every(Number.isFinite))
    ) {
      decisions.push({
        sourceId,
        status: "omitted",
        reason: "Invalid exterior contour",
      });
      return false;
    }
    const bounds = boundsOf(points);
    const placement: PrefabPlacement = {
      id: `exterior-${sourceId}-${parts.length}`,
      kind,
      socket: sockets[0],
      dimensions: {
        x: Math.max(l * 0.0001, bounds.max.x - bounds.min.x),
        y: Math.max(l * 0.0001, bounds.max.y - bounds.min.y),
        z: Math.max(l * 0.0001, bounds.max.z - bounds.min.z),
      },
      variant:
        yard.structure === "heavy" ? 0 : yard.structure === "clean" ? 1 : 2,
      functionality: PREFAB_LIBRARY[kind].functionality,
      exterior: {
        ...fit,
        matingSockets: sockets,
        parentIds: [...new Set(sockets.map((s) => s.hostId))],
        protectionGrade: (p.survivability * yard.armor) / 100,
      },
    };
    const samples = fit.rings ? contourSamples(fit.rings) : points;
    const interference = zones.find(
      (z) =>
        !permittedOwnZone(placement, z) &&
        samples.some((q) => inReservedZone(q, z)),
    );
    const neighbour = vs.find(
      (v) =>
        !placement.exterior!.parentIds.includes(v.id) &&
        samples.some((q) => containsVolume(v, q, -l * 0.001)),
    );
    if (interference || neighbour) {
      decisions.push({
        sourceId,
        status: "omitted",
        reason: interference
          ? `Reserved ${interference.kind} clearance ${interference.id}`
          : `Station-surface intrusion into ${neighbour!.id}`,
      });
      return false;
    }
    if (
      fit.contactSamples.some(
        (s) =>
          !containsVolume(
            vs.find((v) => v.id === s.parentId)!,
            s.position,
            l * 0.0001,
          ),
      )
    ) {
      decisions.push({
        sourceId,
        status: "omitted",
        reason: "Contour contact escaped real parent surface",
      });
      return false;
    }
    parts.push(placement);
    decisions.push({
      sourceId,
      status: "accepted",
      reason: `${kind}: station-fitted interface`,
    });
    return true;
  }
  const context = { b, yard, l, p, vs, inset, emit, socket, decisions };
  addConnections(context);
  addCompletion(context);
  const armorHosts = addArmor(context);
  addEquipment(context, armorHosts);
  // Preserve legacy kit parts unless a larger fitted skin now owns their specific coverage.
  const coveredArmor = (q: PrefabPlacement) =>
    parts.some(
      (p) =>
        p.kind === "ARMOR_ENVELOPE" &&
        p.socket.hostId === q.socket.hostId &&
        dotSides(p.socket.normal, q.socket.normal) &&
        q.socket.position.z >=
          Math.min(...p.exterior!.rings!.flat().map((r) => r.z)) &&
        q.socket.position.z <=
          Math.max(...p.exterior!.rings!.flat().map((r) => r.z)),
    );
  const dotSides = (a: Vec3, d: Vec3) =>
    a.x * d.x + a.y * d.y + a.z * d.z > 0.5;
  const protectedConnectors = new Set(
    parts
      .filter((q) => q.exterior?.phase === "integration")
      .map((q) => q.exterior?.connectorId),
  );
  b.prefabPlacements = [
    ...(b.prefabPlacements ?? []).filter(
      (q) =>
        !(q.kind === "ARMOR_PLATE" && coveredArmor(q)) &&
        !(
          q.kind === "JOINT_HOUSING" && protectedConnectors.has(q.socket.hostId)
        ),
    ),
    ...parts,
  ];
  const vertices = parts.flatMap(
    (q) =>
      q.exterior?.rings?.flat() ??
      (q.exterior?.tube
        ? Array.from({ length: 32 }, (_, i) => {
            const t = q.exterior!.tube!,
              a = ((i % 16) * Math.PI) / 8;
            return {
              x: t.center.x + Math.cos(a) * t.outerRadius,
              y: t.center.y + Math.sin(a) * t.outerRadius,
              z: t.center.z + (i < 16 ? -0.5 : 0.5) * t.length,
            };
          })
        : []),
  );
  b.hullIntegration = {
    axisAlignedVolumes: true,
    reservedZones: zones,
    decisions,
    exteriorBounds: boundsOf(vertices),
    overallBounds: overallEnvelope(b, vertices),
  };
  return b;
}
