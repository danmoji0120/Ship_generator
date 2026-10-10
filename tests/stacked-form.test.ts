import { describe, it, expect } from "vitest";
import { DEFAULT_ORDER } from "../src/generation/generate";
import { createMacroPlan } from "../src/generation/macro/plan";
import { profileRing } from "../src/generation/hull";
import { shapeStations } from "../src/generation/shapes/definition";
import { measureStackedUnion } from "../src/generation/macro/stacked-measurement";
import { measureMacro } from "../src/generation/macro/measurement";
import { SHIPYARDS, getShipyard } from "../src/shipyards/config";
import { architectureLayout } from "../src/generation/architecture/layout";
import { containsVolume } from "../src/generation/architecture/volumes";
import { connectedIds } from "../src/validation/silhouette";
import { SeededRng } from "../src/random/rng";
import { loftGeometry } from "../src/rendering/geometry";
import type { StructuralVolume } from "../src/blueprint/types";
const fixtures = SHIPYARDS.flatMap((yard) =>
  [4, 7, 11].map((seed) => ({
    yard,
    seed,
    order: { ...structuredClone(DEFAULT_ORDER), shipyardId: yard.id },
  })),
);
const volumes = (plan: ReturnType<typeof createMacroPlan>) =>
  plan.majorModuleRoles.map((m) => ({
    id: m.id,
    position: m.position,
    dimensions: m.dimensions,
    geometry: { stations: shapeStations(m.shape) },
  })) as StructuralVolume[];
describe("STACKED_BLOCKS structural form (bounded 12 Macro fixtures)", () => {
  it("keeps three substantial shrinking tiers with clipped real front sections and central union volume", () => {
    for (const f of fixtures) {
      const p = createMacroPlan(
          f.order,
          f.yard,
          "STACKED_BLOCKS",
          f.seed,
          f.seed === 7 ? "WEDGE_CITADEL" : "HAMMERHEAD",
        ),
        vs = volumes(p),
        [keel, middle, upper] = vs;
      const measured = measureMacro(f.order, vs),
        actual = measured.moduleVolumesM3;
      if (p.family === "HAMMERHEAD")
        expect(measured.foreMassRatio).toBeGreaterThanOrEqual(0.34);
      expect(middle.dimensions.x / keel.dimensions.x).toBeGreaterThan(0.58);
      expect(middle.dimensions.x / keel.dimensions.x).toBeLessThan(0.76);
      expect(middle.dimensions.y).toBeLessThan(keel.dimensions.y * 0.81);
      expect(middle.dimensions.z / keel.dimensions.z).toBeLessThanOrEqual(0.65);
      expect(actual[middle.id] / actual[keel.id]).toBeLessThan(0.43);
      expect(actual[middle.id] / actual[keel.id]).toBeGreaterThan(0.17);
      expect(actual[upper.id]).toBeLessThan(actual[middle.id] * 0.3);
      const union = measureStackedUnion(vs, f.order.length);
      expect(union.centroid).toBeGreaterThan(0.45);
      expect(union.centroid).toBeLessThan(0.6);
      for (const v of vs) {
        const first = v.geometry.stations[0],
          wide = Math.max(...v.geometry.stations.map((s) => s.width));
        expect(first.width / wide).toBeLessThan(0.68);
        expect(Math.abs(profileRing(first)[0][0]) / (first.width / 2)).toBeLessThan(0.56);
        const g = loftGeometry(v.geometry.stations);
        expect(
          Array.from(g.getAttribute("normal").array).every(Number.isFinite),
        ).toBe(true);
        g.dispose();
      }
    }
  });
  it("seats terraces on actual hull surfaces and rebuilds connected connector endpoints deterministically", () => {
    for (const f of fixtures) {
      const p = createMacroPlan(f.order, f.yard, "STACKED_BLOCKS", f.seed),
        repeat = createMacroPlan(f.order, f.yard, "STACKED_BLOCKS", f.seed);
      expect(JSON.stringify(repeat)).toBe(JSON.stringify(p));
      const layout = architectureLayout(
        f.order,
        f.yard,
        "STACKED_BLOCKS",
        new SeededRng(f.seed),
        p,
      );
      expect(connectedIds(layout.volumes, layout.connectors).size).toBe(
        layout.volumes.length,
      );
      for (const c of layout.connectors) {
        expect(
          containsVolume(
            layout.volumes.find((v) => v.id === c.fromStructureId)!,
            c.start,
            0.0001,
          ),
        ).toBe(true);
        expect(
          containsVolume(
            layout.volumes.find((v) => v.id === c.toStructureId)!,
            c.end,
            0.0001,
          ),
        ).toBe(true);
      }
      for (const [child, parent] of [
        [layout.volumes[1], layout.volumes[0]],
        [layout.volumes[2], layout.volumes[1]],
      ]) {
        const z = child.position.z,
          foot = {
            x: child.position.x,
            y: child.position.y - child.dimensions.y * 0.43,
            z,
          };
        expect(containsVolume(parent, foot, 0.01)).toBe(true);
      }
    }
  });
  it("counts overlapping volume once with bounded resolution error instead of inventing physical mass", () => {
    const p = createMacroPlan(
        DEFAULT_ORDER,
        getShipyard("forge"),
        "STACKED_BLOCKS",
        7,
      ),
      v = volumes(p)[0],
      one = measureStackedUnion([v], 300),
      twice = measureStackedUnion([v, structuredClone(v)], 300),
      fine = measureStackedUnion([v], 300, 128, 64);
    expect(twice.volume).toBeCloseTo(one.volume, 6);
    expect(Math.abs(fine.volume - one.volume) / fine.volume).toBeLessThan(
      0.012,
    );
    expect(Math.abs(fine.centroid - one.centroid)).toBeLessThan(0.003);
  });
  it("leaves other Macro recipes and explicit frozen STACKED_BLOCKS generation unchanged", () => {
    const yard = getShipyard("forge");
    for (const grammar of ["MONOLITHIC", "BLOCK_ASSEMBLY"] as const)
      expect(createMacroPlan(DEFAULT_ORDER, yard, grammar, 7)).toEqual(
        createMacroPlan(
          DEFAULT_ORDER,
          yard,
          grammar,
          7,
          undefined,
          undefined,
          false,
        ),
      );
    const old = createMacroPlan(
      DEFAULT_ORDER,
      yard,
      "STACKED_BLOCKS",
      7,
      "WEDGE_CITADEL",
      undefined,
      false,
    );
    expect(old.majorModuleRoles[1].dimensions.y).toBe(
      old.majorModuleRoles[0].dimensions.y,
    );
    expect(
      createMacroPlan(
        DEFAULT_ORDER,
        yard,
        "STACKED_BLOCKS",
        7,
        "WEDGE_CITADEL",
      ),
    ).not.toEqual(old);
  });
});
