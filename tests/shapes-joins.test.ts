import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  ARCHITECTURES,
  SHAPE_KINDS,
  JOIN_TYPES,
  ROLES,
} from "../src/blueprint/types";
import { generateBlueprintV17 as generateBlueprint, DEFAULT_ORDER } from "../src/generation/generate";
import { SHIPYARDS } from "../src/shipyards/config";
import {
  shapeDefinition,
  shapeStations,
  SHAPE_CONTEXT,
  shapeContext,
} from "../src/generation/shapes/definition";
import { loftGeometry } from "../src/rendering/geometry";
import { createShip, disposeShip } from "../src/rendering/ship";
import { connectorGroup } from "../src/rendering/architecture";
import { containsVolume } from "../src/generation/architecture/volumes";
import { validateBlueprint } from "../src/validation/validate";
import {
  seedSequence,
  diversityReport,
  designFeatures,
} from "../src/qa/diversity";
import { joinFixture } from "../src/qa/fixtures";
function checkGeometry(g: THREE.BufferGeometry) {
  for (const attr of ["position", "normal"])
    expect(Array.from(g.getAttribute(attr).array).every(Number.isFinite)).toBe(
      true,
    );
  const p = g.getAttribute("position"),
    n = g.getAttribute("normal");
  let signedVolume = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i),
      b = new THREE.Vector3().fromBufferAttribute(p, i + 1),
      c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    signedVolume += a.dot(b.cross(c)) / 6;
    expect(
      new THREE.Vector3().fromBufferAttribute(n, i).length(),
    ).toBeGreaterThan(0.9);
  }
  expect(signedVolume).toBeGreaterThan(0);
  g.dispose();
}
describe("V1.5 shape / join contracts", () => {
  it("serializes every shape and produces finite outward geometry at multiple scales", () => {
    for (const kind of SHAPE_KINDS)
      for (const length of [40, 300, 600])
        for (const variant of [0, 0.5, 1]) {
          const s = shapeDefinition(
            kind,
            { x: length * 0.3, y: length * 0.18, z: length },
            variant,
          );
          expect(JSON.parse(JSON.stringify(s))).toEqual(s);
          expect(Math.min(s.width, s.height, s.length)).toBeGreaterThan(0);
          checkGeometry(loftGeometry(shapeStations(s)));
        }
  });
  it("renders all ten joins between actual mating structures with valid endpoints", () => {
    for (const type of JOIN_TYPES) {
      const b = joinFixture(type),
        c = b.structuralConnectors[0];
      expect(c.join?.type).toBe(type);
      expect(containsVolume(b.structuralVolumes[0], c.start, 0.01)).toBe(true);
      expect(containsVolume(b.structuralVolumes[1], c.end, 0.01)).toBe(true);
      expect(JSON.parse(JSON.stringify(c))).toEqual(c);
      const mat = new THREE.MeshStandardMaterial();
      const group = connectorGroup(c, mat, 300);
      group.traverse((node) => {
        if (node instanceof THREE.Mesh)
          expect(
            Array.from(node.geometry.getAttribute("position").array).every(
              Number.isFinite,
            ),
          ).toBe(true);
      });
      disposeShip(group);
    }
  });
  it("keeps deterministic compositions, hierarchy, connected graphs and usable supports for all fixed grammars / yards", () => {
    const usedShapes = new Set<string>(),
      usedJoins = new Set<string>();
    for (const yard of SHIPYARDS)
      for (const architecture of ARCHITECTURES) {
        const samples = seedSequence(0, 20).map((seed) =>
          generateBlueprint(
            { ...structuredClone(DEFAULT_ORDER), shipyardId: yard.id },
            seed,
            { architecture },
          ),
        );
        const report = diversityReport(samples);
        expect(report.warnings, `${yard.id}/${architecture}`).toEqual([]);
        for (const b of samples) {
          expect(b.architecture.grammar).toBe(architecture);
          expect(validateBlueprint(b)).toEqual([]);
          expect(b.silhouette.disconnectedPenalty).toBe(0);
          expect(JSON.parse(JSON.stringify(b))).toEqual(b);
          const again = generateBlueprint(b.order, b.seed, { architecture });
          expect(JSON.stringify(again)).toBe(JSON.stringify(b));
          const features = designFeatures(b);
          expect(features.primaryRatio).toBeGreaterThan(0.2);
          expect(
            b.structuralVolumes.filter((v) => v.hierarchyTier === 1),
          ).toHaveLength(1);
          for (const v of b.structuralVolumes) {
            usedShapes.add(v.shape!.kind);
            if (v.type !== "PRIMARY_HULL")
              expect(SHAPE_CONTEXT[shapeContext(v)]).toContain(v.shape!.kind);
            if (v.type === "SPINE")
              expect(
                v.dimensions.z / Math.min(v.dimensions.x, v.dimensions.y),
              ).toBeLessThanOrEqual(17);
          }
          for (const c of b.structuralConnectors) {
            usedJoins.add(c.join!.type);
            if (c.join!.type === "TRUSS") {
              const a = b.structuralVolumes.find(
                  (v) => v.id === c.fromStructureId,
                )!,
                d = b.structuralVolumes.find((v) => v.id === c.toStructureId)!;
              expect(
                c.thickness /
                  Math.min(
                    a.dimensions.x,
                    a.dimensions.y,
                    d.dimensions.x,
                    d.dimensions.y,
                  ),
              ).toBeGreaterThanOrEqual(0.35);
            }
          }
        }
      }
    // BOX is intentionally confined to supply structures; sample low missile orders as well.
    for (const role of ROLES)
      for (let seed = 0; seed < 20; seed++) {
        const b = generateBlueprint(
          {
            ...structuredClone(DEFAULT_ORDER),
            shipyardId: "forge",
            role,
            priorities: { ...DEFAULT_ORDER.priorities, missile: 0 },
          },
          seed,
          { architecture: "BLOCK_ASSEMBLY" },
        );
        for (const v of b.structuralVolumes) usedShapes.add(v.shape!.kind);
      }
    expect([...usedShapes].sort()).toEqual([...SHAPE_KINDS].sort());
    expect([...usedJoins].sort()).toEqual([...JOIN_TYPES].sort());
  }, 60000);
  it("rejects mismatched authority cache, nonfinite values, undersized support and thin spine", () => {
    const b = generateBlueprint(
      { ...structuredClone(DEFAULT_ORDER), shipyardId: "forge" },
      1,
      { architecture: "TRUSS_POD" },
    );
    const badSupport = structuredClone(b);
    badSupport.structuralConnectors.find(
      (c) => c.join?.type === "TRUSS",
    )!.thickness = 0.001;
    expect(
      validateBlueprint(badSupport).some((e) => e.includes("Undersized truss")),
    ).toBe(true);
    b.structuralVolumes[0].shape!.width = 0;
    expect(validateBlueprint(b).length).toBeGreaterThan(0);
    const c = generateBlueprint(DEFAULT_ORDER, 0, {
      architecture: "SPINE_AND_MODULES",
    });
    c.structuralVolumes[0].dimensions.x = 1;
    expect(
      validateBlueprint(c).some((x) => x.includes("Spine slenderness")),
    ).toBe(true);
    b.structuralVolumes[0].position.x = Infinity;
    expect(validateBlueprint(b)).toEqual(["Invalid numeric value"]);
  });
  it("suppresses hardpoint debug markers in Normal while retaining mount foundations and parent metadata", () => {
    const b = generateBlueprint(DEFAULT_ORDER, 0);
    for (const mode of ["Normal", "Hardpoints"] as const) {
      const root = createShip(b, mode);
      let markers = 0,
        mounts = 0,
        arrows = 0;
      root.traverse((n) => {
        if (n.userData.debugMarker) markers++;
        if (n.userData.hardpoint) mounts++;
        if (n instanceof THREE.ArrowHelper) arrows++;
      });
      expect(mounts).toBe(b.hardpoints.length);
      expect(markers).toBe(mode === "Normal" ? 0 : b.hardpoints.length);
      expect(arrows).toBe(mode === "Normal" ? 0 : b.hardpoints.length);
      disposeShip(root);
    }
  });
  it("orders contact sheets deterministically including uint32 wrapping and flags identical designs", () => {
    expect(seedSequence(0, 20)).toEqual(
      Array.from({ length: 20 }, (_, i) => i),
    );
    expect(seedSequence(4294967295, 3)).toEqual([4294967295, 0, 1]);
    expect(() => seedSequence(-1, 20)).toThrow();
    expect(() => seedSequence(0, 41)).toThrow();
    expect(
      diversityReport(Array(20).fill(generateBlueprint(DEFAULT_ORDER, 0)))
        .warnings,
    ).toHaveLength(1);
  });
});
