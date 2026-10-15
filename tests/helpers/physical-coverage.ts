import type { ShipBlueprint } from "../../src/blueprint/types";
import { preparePhysicalQueries } from "../../src/physical/probe";
import { physicalSources } from "../../src/physical/geometry";
import {
  add,
  mul,
  center,
  mix,
} from "../../src/generation/integration/contours";
import { classifyNormal } from "../../src/generation/armor/surfaces";
/** Explicit QA request only: no probe work is performed during Normal generation/rendering. */
export function sampledHullArmorCoverage(b: ShipBlueprint) {
  const sources = new Map(physicalSources(b).map((s) => [s.id, s])),
    directions: Record<
      string,
      { sampledAreaM2: number; armoredAreaM2: number; ratio: number }
    > = {};
  const prepared=preparePhysicalQueries(b);
  let skipped = 0,
    samples = 0;
  for (const surface of b.physicalDesign!.surfaces.filter(
    (s) => s.kind === "HULL",
  )) {
    const active = new Set(surface.pieces.map((p) => p.facetIndex));
    for (const [index, f] of surface.facets.entries())
      if (active.has(index)) {
        const tri = sources.get(surface.geometryReference.sourceId)!.triangles[
            f.sourceTriangle
          ],
          c = center(tri),
          dir = classifyNormal(f.normal),
          group = (directions[dir] ??= {
            sampledAreaM2: 0,
            armoredAreaM2: 0,
            ratio: 0,
          });
        for (const point of [c, ...tri.map((p) => mix(p, c, 0.15))]) {
          const offset = b.order.length * 2,
            r = prepared.probe(
              add(point, mul(f.normal, offset)),
              mul(f.normal, -1),
              offset + b.order.length * 0.05,
            ),
            h = r.hits.find((h) => h.isArmorLayer === false);
          if (
            !h ||
            h.surfaceId !== surface.id ||
            Math.abs(h.entryDistanceM - offset) > b.order.length * 0.005
          ) {
            skipped++;
            continue;
          }
          samples++;
          group.sampledAreaM2 += f.areaM2 / 4;
          if (h.coveredByArmor) group.armoredAreaM2 += f.areaM2 / 4;
        }
      }
  }
  for (const d of Object.values(directions))
    d.ratio = d.sampledAreaM2 ? d.armoredAreaM2 / d.sampledAreaM2 : 0;
  const area = Object.values(directions).reduce(
      (n, d) => n + d.sampledAreaM2,
      0,
    ),
    covered = Object.values(directions).reduce(
      (n, d) => n + d.armoredAreaM2,
      0,
    );
  return {
    method: "AREA_WEIGHTED_FACET_CENTER_AND_3_INSET_CORNER_RAYS_APPROXIMATE",
    ratio: area ? covered / area : 0,
    samples,
    skipped,
    directions,
  };
}
