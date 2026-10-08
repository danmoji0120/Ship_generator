import * as silhouetteValidation from "../src/validation/silhouette";
import { describe, it, expect, vi } from "vitest";
import {
  generateBlueprintV18 as generateBlueprint,
  generateBlueprintV17,
  DEFAULT_ORDER,
} from "../src/generation/generate";
import {
  ARCHITECTURES,
  type ShipOrder,
  type StructuralVolume,
} from "../src/blueprint/types";
import { SHIPYARDS } from "../src/shipyards/config";
import {
  FAMILY_COMPATIBILITY,
  createMacroPlan,
} from "../src/generation/macro/plan";
import { validateBlueprint } from "../src/validation/validate";
import { validateMacro } from "../src/validation/macro";
import { measureMacro } from "../src/generation/macro/measurement";
import { shapeStations } from "../src/generation/shapes/definition";
import { loftGeometry } from "../src/rendering/geometry";
import { readFileSync } from "node:fs";
const order = (yard = "forge"): ShipOrder => ({
  ...structuredClone(DEFAULT_ORDER),
  shipyardId: yard,
});
describe("V1.8 Macro Design contracts", () => {
  it("integrates a constant clipped rectangle against an independent analytic volume and three equal regions", () => {
    const o = order(),
      l = o.length;
    const v = {
      id: "analytic-prism",
      position: { x: 0, y: 0, z: 0 },
      dimensions: { x: 10, y: 20, z: l },
      geometry: {
        stations: [-0.5, -0.25, 0, 0.25, 0.5].map((t) => ({
          z: t * l,
          width: 10,
          height: 20,
          profile: "box",
          topSlope: 0,
          sideSlope: 0,
          bottomSlope: 0,
          bevel: 0,
        })),
      },
    } as StructuralVolume;
    const m = measureMacro(o, [v]);
    // profileRing's BOX clips four corner triangles of legs .03*w/2 and .03*h/2.
    const expected = 10 * 20 * l * (1 - 0.03 ** 2 / 2);
    expect(m.approximateVolumeM3).toBeCloseTo(expected, 8);
    for (const ratio of [m.foreMassRatio, m.midMassRatio, m.aftMassRatio])
      expect(ratio).toBeCloseTo(1 / 3, 12);
    expect(m.estimatedMassTonnes).toBeCloseTo(
      expected * (0.16 + o.priorities.survivability * 0.0022),
      8,
    );
    expect(Math.abs(m.centerOfVolume.z)).toBeLessThan(1e-10);
  });
  it("realizes all supported pairings, positive mass budgets, geometry and connected graphs across yards", () => {
    for (const yard of SHIPYARDS)
      for (const architecture of ARCHITECTURES)
        for (const family of FAMILY_COMPATIBILITY[architecture])
          for (const seed of [0, 7, 13]) {
            let b;
            try {
              b = generateBlueprint(order(yard.id), seed, {
                architecture,
                family,
              });
            } catch (e) {
              throw Error(`${yard.id}/${architecture}/${family}/${seed}: ${e}`);
            }
            expect(validateBlueprint(b)).toEqual([]);
            expect(b.generatorVersion).toBe("1.8");
            expect(b.macroDesign!.family).toBe(family);
            expect(b.architecture.grammar).toBe(architecture);
            expect(
              b.macroDesign!.foreMassRatio +
                b.macroDesign!.midMassRatio +
                b.macroDesign!.aftMassRatio,
            ).toBeCloseTo(1, 12);
            expect(b.macroDesign!.realized).toEqual(
              measureMacro(b.order, b.structuralVolumes),
            );
            for (const v of b.structuralVolumes) {
              const g = loftGeometry(shapeStations(v.shape!));
              expect(
                Array.from(g.getAttribute("normal").array).every(
                  Number.isFinite,
                ),
              ).toBe(true);
              g.dispose();
            }
          }
  }, 60000);
  it("records bounded candidate failures without silently changing Family or Architecture", () => {
    const spy = vi
      .spyOn(silhouetteValidation, "validateSilhouette")
      .mockReturnValueOnce(["Rejected axial-spine silhouette"])
      .mockReturnValueOnce(["Rejected axial-spine silhouette"])
      .mockReturnValueOnce(["Rejected axial-spine silhouette"]);
    try {
      const b = generateBlueprint(order(), 36, { architecture: "HYBRID" });
      expect(b.architecture.grammar).toBe("HYBRID");
      expect(b.macroDesign!.attempts).toHaveLength(3);
      expect(
        b.macroDesign!.attempts!.every(
          (a) => a.family === b.macroDesign!.family && a.replacement === false,
        ),
      ).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
  it("preserves immutable V1.7 baselines and optional-field JSON compatibility", () => {
    for (const yard of SHIPYARDS) {
      const saved = JSON.parse(
        readFileSync(`qa/v1.8/before/${yard.id}-0.json`, "utf8"),
      );
      const current = generateBlueprintV17(saved.order, 0, {
        architecture: "BLOCK_ASSEMBLY",
      });
      const rounded = (v: unknown) =>
        JSON.parse(
          JSON.stringify(v, (_, x) =>
            typeof x === "number" ? Number(x.toFixed(10)) : x,
          ),
        );
      expect(rounded(current)).toEqual(rounded(saved));
      expect(saved.macroDesign).toBeUndefined();
      expect(validateBlueprint(current)).toEqual([]);
    }
  });
  it("replays Macro selection, shape / join / equipment / Integration and export exactly ten times", () => {
    for (const architecture of ARCHITECTURES) {
      const b = generateBlueprint(order(), 7, { architecture });
      const json = JSON.stringify(b);
      for (let i = 0; i < 10; i++)
        expect(
          JSON.stringify(generateBlueprint(order(), 7, { architecture })),
        ).toBe(json);
      expect(JSON.parse(json)).toEqual(b);
    }
  });
  it("rejects unsupported combinations and catches target / shape / actual layout drift", () => {
    expect(() =>
      generateBlueprint(order(), 0, {
        architecture: "TRUSS_POD",
        family: "HAMMERHEAD",
      }),
    ).toThrow("Unsupported Macro pairing");
    const b = generateBlueprint(order(), 0, {
      architecture: "BLOCK_ASSEMBLY",
      family: "HAMMERHEAD",
    });
    b.macroDesign!.foreMassRatio = 0.01;
    expect(validateMacro(b)).toContain("Macro target mismatch foreMassRatio");
    const c = generateBlueprint(order(), 0, { architecture: "MONOLITHIC" });
    c.structuralVolumes[0].position.x += 10;
    expect(validateMacro(c)).toContain("Macro layout drift citadel");
  });
  it("moves actual region budgets between forward armor, lateral bays and aft machinery", () => {
    const h = generateBlueprint(order(), 0, {
        architecture: "BLOCK_ASSEMBLY",
        family: "HAMMERHEAD",
      }),
      e = generateBlueprint(order(), 0, {
        architecture: "BLOCK_ASSEMBLY",
        family: "ENGINE_DOMINANT",
      }),
      w = generateBlueprint(order(), 0, {
        architecture: "BLOCK_ASSEMBLY",
        family: "WIDE_CARRIER",
      });
    expect(h.macroDesign!.foreMassRatio).toBeGreaterThan(
      e.macroDesign!.foreMassRatio + 0.25,
    );
    expect(e.macroDesign!.aftMassRatio).toBeGreaterThan(
      h.macroDesign!.aftMassRatio + 0.15,
    );
    expect(w.macroDesign!.lateralSpread).toBeGreaterThan(
      e.macroDesign!.lateralSpread + 0.15,
    );
  });
  it("changes Macro volumes when each order priority changes and when yard doctrine changes", () => {
    const base = order();
    for (const priority of [
      "firepower",
      "survivability",
      "mobility",
      "endurance",
      "missile",
      "sensor",
    ] as const) {
      const high = structuredClone(base);
      high.priorities[priority] = 100;
      const low = structuredClone(base);
      low.priorities[priority] = 0;
      const a = createMacroPlan(low, SHIPYARDS[2], "TRUSS_POD", 7),
        b = createMacroPlan(high, SHIPYARDS[2], "TRUSS_POD", 7);
      expect(a.majorModuleRoles).not.toEqual(b.majorModuleRoles);
    }
    const shapes = SHIPYARDS.map((y) =>
      JSON.stringify(
        createMacroPlan(order(y.id), y, "BLOCK_ASSEMBLY", 7, "HAMMERHEAD")
          .majorModuleRoles,
      ),
    );
    expect(new Set(shapes).size).toBe(4);
  });
  it("retains 29 composition recipes and multiple families on consecutive seed ranges", () => {
    const used = new Set<string>();
    for (const architecture of ARCHITECTURES) {
      const families = new Set<string>();
      for (let seed = 0; seed < 40; seed++) {
        const p = createMacroPlan(order(), SHIPYARDS[2], architecture, seed);
        used.add(`${architecture}/${p.composition}`);
        families.add(p.family);
      }
      expect(families.size).toBe(FAMILY_COMPATIBILITY[architecture].length);
    }
    expect(used.size).toBe(29);
  });
});
