import type { IntegrationContext } from "./context";
import type { ExteriorKind, StructuralVolume } from "../../blueprint/types";
import { exposedVolumeSurface } from "../architecture/volumes";
import { contactPatch, scaledRing, mul } from "./contours";
export function addEquipment(
  ctx: IntegrationContext,
  armorHosts: StructuralVolume[],
) {
  const { b, yard, l, p, vs, inset, emit, socket, decisions } = ctx;
  // D. Functional foundations reuse registry sockets and equipment reservations, never random decoration.
  const priorityMounts = [...b.hardpoints]
    .sort((a, d) => d.radius - a.radius)
    .filter((h) =>
      ["Missile", "Sensor", "Large Turret", "Medium Turret"].includes(h.type),
    )
    .slice(0, 10);
  for (const h of priorityMounts) {
    const v = vs.find((v) => v.id === h.parentId)!,
      kind: ExteriorKind =
        h.type === "Missile"
          ? "MISSILE_BAY_HOUSING"
          : h.type === "Sensor"
            ? "SENSOR_HOUSING"
            : "WEAPON_FOUNDATION";
    try {
      const extent =
        h.radius *
        (h.type === "Missile" ? 3.25 : 2.8) *
        (1 + (h.type === "Missile" ? p.missile : p.firepower) * 0.0015);
      const ring = contactPatch(
        v,
        h.position,
        h.normal,
        extent,
        extent,
        inset * 0.35,
      );
      const height =
        h.type === "Sensor"
          ? h.radius * (0.12 + p.sensor * 0.003)
          : h.radius * 0.09;
      emit(kind, `mount-${h.id}`, [socket(v, h.position, h.normal)], {
        phase: "equipment",
        rings: [
          ring,
          scaledRing(
            ring,
            h.type === "Sensor" ? 0.72 : 1.05,
            mul(h.normal, inset * 0.35 + height),
          ),
        ],
        equipmentZoneId: `zone-${h.id}`,
        contactSamples: ring.map((position) => ({ parentId: v.id, position })),
        inset,
        armorClass: "JOINT",
      });
    } catch (e) {
      decisions.push({
        sourceId: h.id,
        status: "omitted",
        reason: `Foundation surface fit: ${String(e)}`,
      });
    }
  }
  for (const radiator of (b.prefabPlacements ?? []).filter(
    (q) => q.kind === "RADIATOR_BANK",
  )) {
    const v = vs.find((v) => v.id === radiator.socket.hostId)!;
    try {
      const ring = contactPatch(
        v,
        radiator.socket.position,
        radiator.socket.normal,
        radiator.dimensions.z * 1.04,
        radiator.dimensions.x * 1.08,
        inset * 0.3,
      );
      emit(
        "RADIATOR_MOUNT",
        `thermal-${radiator.id}`,
        [socket(v, radiator.socket.position, radiator.socket.normal)],
        {
          phase: "equipment",
          rings: [
            ring,
            scaledRing(
              ring,
              1.02,
              mul(
                radiator.socket.normal,
                inset * 0.3 +
                  radiator.dimensions.y * (0.07 + p.endurance * 0.0004),
              ),
            ),
          ],
          equipmentZoneId: `zone-${radiator.id}`,
          contactSamples: ring.map((position) => ({
            parentId: v.id,
            position,
          })),
          inset,
          armorClass: "MACHINERY",
        },
      );
    } catch (e) {
      decisions.push({
        sourceId: radiator.id,
        status: "omitted",
        reason: `Thermal mounting fit: ${String(e)}`,
      });
    }
  }
  if (p.endurance >= 35) {
    const host =
      vs.find((v) => v.purpose === "propulsion" && v.type !== "NACELLE") ??
      armorHosts[0];
    if (host)
      for (const fraction of [0.67, 0.81])
        try {
          const z =
              host.position.z +
              host.geometry.stations[0].z +
              host.dimensions.z * fraction,
            surface = exposedVolumeSurface(vs, host.position.x, z),
            v = vs.find((v) => v.id === surface.parentId)!,
            pos = { x: host.position.x, y: surface.y, z };
          const ring = contactPatch(
            v,
            pos,
            surface.normal,
            l * 0.05,
            l * 0.065,
            inset * 0.4,
          );
          emit(
            "MACHINERY_HOUSING",
            `service-${host.id}-${fraction}`,
            [socket(v, pos, surface.normal)],
            {
              phase: "equipment",
              rings: [
                ring,
                scaledRing(
                  ring,
                  0.76,
                  mul(surface.normal, l * (0.005 + p.endurance * 0.00005)),
                ),
              ],
              contactSamples: ring.map((position) => ({
                parentId: v.id,
                position,
              })),
              inset,
              armorClass: "MACHINERY",
            },
          );
        } catch (e) {
          decisions.push({
            sourceId: host.id,
            status: "omitted",
            reason: `Machinery clearance fit: ${String(e)}`,
          });
        }
  }
}
