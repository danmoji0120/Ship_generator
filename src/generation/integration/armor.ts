import type { IntegrationContext } from "./context";
import type { Vec3, ExteriorDefinition } from "../../blueprint/types";
import { profileRing, stationAt } from "../hull";
import { sideSocket } from "../prefabs";
import { unit, center } from "./contours";
export function addArmor(ctx: IntegrationContext) {
  const { b, yard, l, p, vs, inset, emit, socket, decisions } = ctx;
  // C. Continuous station-following flank armor replaces little decorative plates in covered intervals.
  const armorHosts = [...vs]
    .filter((v) => v.type !== "SPINE")
    .sort(
      (a, d) =>
        d.dimensions.x * d.dimensions.y * d.dimensions.z -
        a.dimensions.x * a.dimensions.y * a.dimensions.z,
    )
    .slice(
      0,
      yard.structure === "heavy" ? 3 : yard.structure === "clean" ? 2 : 1,
    );
  for (const v of armorHosts)
    for (const side of [-1, 1] as const) {
      const rings: Vec3[][] = [],
        contacts: ExteriorDefinition["contactSamples"] = [];
      const thickness = l * (0.0015 + p.survivability * 0.000045) * yard.armor;
      for (const fraction of [0.16, 0.33, 0.5, 0.67, 0.84]) {
        const z =
            v.position.z + v.geometry.stations[0].z + v.dimensions.z * fraction,
          ring = profileRing(stationAt(v.geometry.stations, z - v.position.z));
        const [a, d] = side === 1 ? [ring[2], ring[3]] : [ring[6], ring[7]],
          normal = unit({ x: -(d[1] - a[1]), y: d[0] - a[0], z: 0 });
        const point = (q: number[], offset: number): Vec3 => ({
          x: v.position.x + q[0] + normal.x * offset,
          y: v.position.y + q[1] + normal.y * offset,
          z,
        });
        const ra = [
          point(a, -inset * 0.3),
          point(a, thickness),
          point(d, thickness),
          point(d, -inset * 0.3),
        ];
        rings.push(ra);
        contacts.push({
          parentId: v.id,
          position: point(
            [(a[0] + d[0]) * 0.5, (a[1] + d[1]) * 0.5],
            -inset * 0.3,
          ),
        });
      }
      const s = sideSocket(v, side, 0.5);
      s.kind = "HULL_FACE";
      if (
        !emit("ARMOR_ENVELOPE", `armor-${v.id}-${side}`, [s], {
          phase: "armor",
          rings,
          contactSamples: contacts,
          inset,
          armorClass: v.hierarchyTier === 1 ? "PRIMARY" : "SECONDARY",
        })
      ) {
        const front = rings.slice(0, 3),
          pos = center(front[1]);
        emit(
          "ARMOR_ENVELOPE",
          `armor-${v.id}-${side}-forward`,
          [socket(v, contacts[1].position, s.normal)],
          {
            phase: "armor",
            rings: front,
            contactSamples: contacts.slice(0, 3),
            inset,
            armorClass: "MACHINERY",
          },
        );
      }
    }

  return armorHosts;
}
