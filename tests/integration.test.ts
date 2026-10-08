import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { ARCHITECTURES } from "../src/blueprint/types";
import {
  DEFAULT_ORDER,
  generateBlueprintV17 as generateBlueprint,
  generateBlueprintV16,
} from "../src/generation/generate";
import { SHIPYARDS } from "../src/shipyards/config";
import { validateBlueprint } from "../src/validation/validate";
import { validateIntegration } from "../src/validation/integration";
import { exteriorGeometry } from "../src/rendering/exterior";
import { createShip, disposeShip } from "../src/rendering/ship";
import { containsVolume } from "../src/generation/architecture/volumes";

describe("V1.7 station-fitted exterior integration", () => {
  it("keeps the V1.6 baseline JSON and original structural layout reproducible", () => {
    for (const yard of SHIPYARDS) {
      const saved = JSON.parse(
        readFileSync(`qa/v1.7/before/${yard.id}-0.json`, "utf8"),
      );
      const old = generateBlueprintV16(saved.order, 0, {
        architecture: "BLOCK_ASSEMBLY",
      });
      // Math.pow last-bit differences between Node and Chromium are not a historical schema change.
      const rounded = (v: unknown) =>
        JSON.parse(
          JSON.stringify(v, (_, x) =>
            typeof x === "number" ? Number(x.toFixed(10)) : x,
          ),
        );
      expect(rounded(old)).toEqual(rounded(saved));
      const next = generateBlueprint(saved.order, 0, {
        architecture: "BLOCK_ASSEMBLY",
      });
      expect(next.schemaVersion).toBe(2);
      expect(next.generatorVersion).toBe("1.7");
      expect(next.structuralVolumes).toEqual(old.structuralVolumes);
      expect(next.structuralConnectors).toEqual(old.structuralConnectors);
      expect(next.hardpoints).toEqual(old.hardpoints);
      expect(next.engines.map((e) => e.position)).toEqual(
        old.engines.map((e) => e.position),
      );
    }
  });

  it("renders archived V0, V1 and V1.5 exported JSON without integration fields", () => {
    for (const path of [
      "qa/v0/export.blueprint.json",
      "qa/v1/export.blueprint.json",
      "qa/v1.5/regression/export.blueprint.json",
    ]) {
      const b = JSON.parse(readFileSync(path, "utf8"));
      expect(b.hullIntegration).toBeUndefined();
      const root = createShip(b, "Normal");
      let triangles = 0;
      root.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          for (const name of ["position", "normal"]) {
            const a = node.geometry.getAttribute(name);
            if (a) expect([...a.array].every(Number.isFinite)).toBe(true);
          }
          triangles += node.geometry.getAttribute("position").count / 3;
        }
      });
      expect(triangles).toBeGreaterThan(0);
      disposeShip(root);
    }
  });
  it("is deterministic, connected and finite across every grammar, yard and scale", () => {
    const used = new Set<string>();
    for (const yard of SHIPYARDS)
      for (const architecture of ARCHITECTURES)
        for (const seed of [0, 7, 42]) {
          const order = {
            ...structuredClone(DEFAULT_ORDER),
            shipyardId: yard.id,
            length: seed === 42 ? 600 : seed === 7 ? 40 : 300,
          };
          const b = generateBlueprint(order, seed, { architecture });
          expect(
            validateBlueprint(b),
            `${yard.id}/${architecture}/${seed}`,
          ).toEqual([]);
          expect(JSON.parse(JSON.stringify(b))).toEqual(b);
          expect(
            JSON.stringify(generateBlueprint(order, seed, { architecture })),
          ).toBe(JSON.stringify(b));
          const ids = b.prefabPlacements!.map((p) => p.id);
          expect(new Set(ids).size).toBe(ids.length);
          for (const p of b.prefabPlacements!.filter((p) => p.exterior)) {
            used.add(p.exterior!.phase);
            const e = p.exterior!;
            for (const s of e.contactSamples)
              expect(
                containsVolume(
                  b.structuralVolumes.find((v) => v.id === s.parentId)!,
                  s.position,
                  order.length * 0.0001,
                ),
              ).toBe(true);
            const g = exteriorGeometry(e);
            for (const name of ["position", "normal"])
              expect(
                [...g.getAttribute(name).array].every(Number.isFinite),
              ).toBe(true);
            expect(g.boundingSphere!.radius).toBeGreaterThan(0);
            const vertices = g.getAttribute("position");
            let signedVolume = 0;
            for (let i = 0; i < vertices.count; i += 3) {
              const a = new THREE.Vector3().fromBufferAttribute(vertices, i),
                d = new THREE.Vector3().fromBufferAttribute(vertices, i + 1),
                c = new THREE.Vector3().fromBufferAttribute(vertices, i + 2);
              signedVolume += a.dot(d.cross(c)) / 6;
            }
            expect(
              signedVolume,
              `${yard.id}/${architecture}/${seed}/${p.kind}`,
            ).toBeGreaterThan(0);
            g.dispose();
          }
        }
    expect([...used].sort()).toEqual([
      "armor",
      "bow",
      "equipment",
      "integration",
      "stern",
    ]);
  }, 30000);
  it("bounds include actual rendered skins, legacy equipment and mounts", () => {
    for (const architecture of ARCHITECTURES)
      for (const yard of SHIPYARDS)
        for (const seed of [0, 7, 42]) {
          const b = generateBlueprint(
              { ...structuredClone(DEFAULT_ORDER), shipyardId: yard.id },
              seed,
              { architecture },
            ),
            root = createShip(b, "Normal");
          const actual = new THREE.Box3().setFromObject(root),
            bounds = b.hullIntegration!.overallBounds;
          for (const axis of ["x", "y", "z"] as const) {
            expect(bounds.min[axis]).toBeLessThanOrEqual(
              actual.min[axis] + 0.001,
            );
            expect(bounds.max[axis]).toBeGreaterThanOrEqual(
              actual.max[axis] - 0.001,
            );
          }
          disposeShip(root);
        }
  });
  it("rejects detached contacts, dangling equipment, blocked exhaust and weapon interference", () => {
    const b = generateBlueprint(DEFAULT_ORDER, 0, {
      architecture: "BLOCK_ASSEMBLY",
    });
    const bad = structuredClone(b),
      p = bad.prefabPlacements!.find(
        (p) => p.exterior?.phase === "armor" && p.exterior?.rings,
      )!;
    p.exterior!.contactSamples[0].position.x += 10000;
    expect(
      validateIntegration(bad).some((e) =>
        e.includes("Detached exterior contour"),
      ),
    ).toBe(true);
    const dangling = structuredClone(b);
    dangling.hullIntegration!.reservedZones[0].equipmentId = "missing";
    expect(
      validateIntegration(dangling).some((e) =>
        e.includes("Invalid equipment zone"),
      ),
    ).toBe(true);
    const blocked = structuredClone(b),
      casing = blocked.prefabPlacements!.find(
        (p) => p.kind === "ENGINE_HOUSING",
      )!;
    casing.exterior!.tube!.innerRadius = 0.0001;
    expect(
      validateIntegration(blocked).some((e) => e.includes("Blocked exhaust")),
    ).toBe(true);
    const covered = structuredClone(b),
      plate = covered.prefabPlacements!.find((p) => p.exterior?.rings)!;
    const zone = covered.hullIntegration!.reservedZones.find(
      (z) => z.kind === "weapon",
    )!;
    plate.exterior!.rings![0][0] = {
      x: zone.position.x + zone.normal.x * zone.depth * 0.5,
      y: zone.position.y + zone.normal.y * zone.depth * 0.5,
      z: zone.position.z + zone.normal.z * zone.depth * 0.5,
    };
    expect(
      validateIntegration(covered).some((e) =>
        e.includes("Equipment occluded"),
      ),
    ).toBe(true);
  });
  it("keeps annular exhaust and spinal apertures open to rays", () => {
    for (const role of ["Cruiser", "Spinal Gun Ship"] as const) {
      const b = generateBlueprint(
        { ...structuredClone(DEFAULT_ORDER), role },
        0,
        {
          architecture:
            role === "Cruiser" ? "BLOCK_ASSEMBLY" : "SPINE_AND_MODULES",
        },
      );
      for (const p of b.prefabPlacements!.filter((p) => p.exterior?.tube)) {
        const t = p.exterior!.tube!,
          g = exteriorGeometry(p.exterior!),
          mesh = new THREE.Mesh(
            g,
            new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
          );
        mesh.updateMatrixWorld();
        const ray = new THREE.Raycaster(
          new THREE.Vector3(t.center.x, t.center.y, t.center.z + t.length),
          new THREE.Vector3(0, 0, -1),
        );
        expect(ray.intersectObject(mesh)).toEqual([]);
        g.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    }
  });
  it("finishes exposed unpowered aft faces without moving engines or hiding exhaust", () => {
    const b = generateBlueprint(
      { ...structuredClone(DEFAULT_ORDER), shipyardId: "forge" },
      7,
      { architecture: "SPINE_AND_MODULES" },
    );
    const caps = b.prefabPlacements!.filter((p) => p.id.includes("terminal-"));
    expect(caps.length).toBeGreaterThan(0);
    for (const cap of caps) {
      expect(cap.exterior!.phase).toBe("stern");
      expect(cap.exterior!.armorClass).toBe("EDGE");
      expect(
        b.engines.some((e) => cap.exterior!.parentIds.includes(e.parentId)),
      ).toBe(false);
    }
    expect(validateIntegration(b)).toEqual([]);
  });
  it("applies priorities to armor thickness, casing length and sensor housings", () => {
    const low = structuredClone(DEFAULT_ORDER),
      high = structuredClone(DEFAULT_ORDER);
    low.priorities.survivability = 10;
    high.priorities.survivability = 100;
    const a = generateBlueprint(low, 0, { architecture: "BLOCK_ASSEMBLY" }),
      b = generateBlueprint(high, 0, { architecture: "BLOCK_ASSEMBLY" });
    expect(
      b
        .prefabPlacements!.filter((p) => p.kind === "ARMOR_ENVELOPE")
        .map((p) => p.dimensions),
    ).not.toEqual(
      a
        .prefabPlacements!.filter((p) => p.kind === "ARMOR_ENVELOPE")
        .map((p) => p.dimensions),
    );
    expect(
      b.prefabPlacements!.find((p) => p.exterior)!.exterior!.protectionGrade,
    ).toBeGreaterThan(
      a.prefabPlacements!.find((p) => p.exterior)!.exterior!.protectionGrade,
    );
  });
});
