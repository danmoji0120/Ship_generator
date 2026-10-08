import { describe, it, expect, vi } from "vitest";
import { generateBlueprint, generateBlueprintV17, DEFAULT_ORDER } from "../src/generation/generate";
import {
  ARCHITECTURES,
  ROLES,
  type ShipOrder,
  type ArchitectureGrammar,
} from "../src/blueprint/types";
import { SHIPYARDS } from "../src/shipyards/config";
import { validateBlueprint } from "../src/validation/validate";
import { containsVolume } from "../src/generation/architecture/volumes";
import * as silhouetteValidation from "../src/validation/silhouette";
import { primitiveStations } from "../src/generation/architecture/volumes";
import { createShip, disposeShip } from "../src/rendering/ship";
import { loftGeometry } from "../src/rendering/geometry";
import * as THREE from "three";
const o = (
  shipyardId = "forge",
  role: ShipOrder["role"] = "Cruiser",
): ShipOrder => ({ ...structuredClone(DEFAULT_ORDER), shipyardId, role });
export const GRAMMAR_SEEDS: Record<ArchitectureGrammar, number> = {
  MONOLITHIC: 7,
  BLOCK_ASSEMBLY: 0,
  SPINE_AND_MODULES: 12,
  TRUSS_POD: 1,
  TWIN_HULL: 2,
  CORE_AND_NACELLES: 41,
  STACKED_BLOCKS: 4,
  HYBRID: 36,
};
describe("V1 architecture", () => {
  it("generates valid layouts for 1296 orders while retaining all V0 regressions", () => {
    for (const y of SHIPYARDS)
      for (const role of ROLES)
        for (const length of [40, 150, 600])
          for (const massClass of ["Light", "Standard", "Superheavy"] as const)
            for (const seed of [0, 42, 123456789, 4294967295]) {
              const order = { ...o(y.id, role), length, massClass };
              const b = (() => {
                try {
                  return generateBlueprint(order, seed);
                } catch (e) {
                  throw new Error(
                    `${y.id}/${role}/${length}/${massClass}/${seed}: ${e}`,
                  );
                }
              })();
              expect(validateBlueprint(b)).toEqual([]);
              expect(new Set(b.structuralVolumes.map((v) => v.id)).size).toBe(
                b.structuralVolumes.length,
              );
              expect(b.silhouette.disconnectedPenalty).toBe(0);
              for (const c of b.structuralConnectors) {
                expect(
                  containsVolume(
                    b.structuralVolumes.find(
                      (v) => v.id === c.fromStructureId,
                    )!,
                    c.start,
                    length * 0.001,
                  ),
                ).toBe(true);
                expect(
                  containsVolume(
                    b.structuralVolumes.find((v) => v.id === c.toStructureId)!,
                    c.end,
                    length * 0.001,
                  ),
                ).toBe(true);
              }
            }
  }, 60000);
  it("keeps deterministic fixtures for all eight grammars, including no-primary layouts", () => {
    expect(Object.keys(GRAMMAR_SEEDS).sort()).toEqual(
      [...ARCHITECTURES].sort(),
    );
    console.log("V1 grammar fixtures", JSON.stringify(GRAMMAR_SEEDS));
    for (const [grammar, seed] of Object.entries(GRAMMAR_SEEDS)) {
      const a = generateBlueprint(o(), seed!);
      expect(a.architecture.grammar).toBe(grammar);
      for (let i = 0; i < 10; i++)
        expect(JSON.stringify(generateBlueprint(o(), seed!))).toBe(
          JSON.stringify(a),
        );
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
      if (grammar !== "MONOLITHIC") expect(a.stations).toHaveLength(0);
    }
  });
  it("uses more than one structural grammar across twenty seeds for each role and yard", () => {
    for (const y of SHIPYARDS)
      for (const role of ROLES) {
        const counts = new Map<string, number>();
        for (let seed = 0; seed < 20; seed++) {
          const b = generateBlueprint(o(y.id, role), seed);
          counts.set(
            b.architecture.grammar,
            (counts.get(b.architecture.grammar) ?? 0) + 1,
          );
        }
        expect(counts.size, `${y.id}/${role}`).toBeGreaterThan(1);
        expect(Math.max(...counts.values()), `${y.id}/${role}`).toBeLessThan(
          20,
        );
      }
  });
  it("rejects moved volumes, missing graph edges, wrong parents and misdirected engines", () => {
    const b = generateBlueprint(o(), 1);
    b.structuralVolumes.at(-1)!.position.x += 1000;
    b.structuralConnectors.splice(0, 1);
    b.engines[0].parentId = "invalid";
    b.engines[0].direction = { x: 0, y: 0, z: -1 };
    b.hardpoints[0].parentId = "invalid";
    expect(validateBlueprint(b).length).toBeGreaterThan(0);
  });
  it("mounts equipment on rendered V1 volumes using independent ray intersections", () => {
    for (const seed of Object.values(GRAMMAR_SEEDS)) {
      const b = generateBlueprint(o(), seed!);
      const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      const meshes = b.structuralVolumes.map((v) => {
        const m = new THREE.Mesh(loftGeometry(v.geometry.stations), mat);
        m.position.set(v.position.x, v.position.y, v.position.z);
        m.updateMatrixWorld();
        return m;
      });
      for (const h of b.hardpoints.filter((h) => h.type !== "Spinal")) {
        const hit = new THREE.Raycaster(
          new THREE.Vector3(h.position.x, b.order.length, h.position.z),
          new THREE.Vector3(0, -1, 0),
        ).intersectObjects(meshes, false)[0];
        expect(hit).toBeDefined();
        expect(
          Math.abs(hit.point.y - h.position.y),
          `${b.architecture.grammar}/${h.id}`,
        ).toBeLessThan(b.order.length * 0.004);
      }
      meshes.forEach((m) => m.geometry.dispose());
      mat.dispose();
    }
  });
  it("falls back from a rejected two-grammar hybrid after three bounded candidates", () => {
    const spy = vi
      .spyOn(silhouetteValidation, "validateSilhouette")
      .mockReturnValueOnce(["Rejected hybrid silhouette"])
      .mockReturnValueOnce(["Rejected hybrid silhouette"])
      .mockReturnValueOnce(["Rejected hybrid silhouette"]);
    try {
      const b = generateBlueprintV17(o(), 36);
      expect(b.candidate).toBe(3);
      expect(b.architecture.requestedGrammar).toBe("HYBRID");
      expect(b.architecture.grammar).toBe("SPINE_AND_MODULES");
      expect(b.architecture.components).toHaveLength(1);
      expect(b.architecture.fallbackReason).toBe("Rejected hybrid silhouette");
    } finally {
      spy.mockRestore();
    }
  });
  it("supports all eight primitive definitions with valid loft geometry", () => {
    for (const primitive of [
      "Box",
      "Chamfered Box",
      "Wedge",
      "Hexagonal Prism",
      "Tapered Box",
      "Rounded Box",
      "Short Loft",
      "Long Loft",
    ] as const) {
      const stations = primitiveStations(
          primitive,
          { x: 35, y: 20, z: 90 },
          "chamfer",
          "blunt armored",
        ),
        geometry = loftGeometry(stations);
      expect(
        Array.from(geometry.getAttribute("position").array).every(
          Number.isFinite,
        ),
      ).toBe(true);
      geometry.dispose();
    }
  });
  it("detects a graph disconnection independently of numeric or mount errors", () => {
    const b = generateBlueprint(o(), 1),
      edge = b.structuralConnectors.find(
        (c) => c.toStructureId === "sensor-forebody",
      )!;
    b.structuralConnectors = b.structuralConnectors.filter(
      (c) => c.id !== edge.id,
    );
    expect(validateBlueprint(b)).toContain("Unconnected major structure");
  });
  it("renders deterministic finite buffers for every grammar and both new debug views", () => {
    for (const seed of Object.values(GRAMMAR_SEEDS))
      for (const mode of [
        "Normal",
        "Architecture",
        "Structural Graph",
      ] as const) {
        const b = generateBlueprint(o(), seed!),
          a = createShip(b, mode),
          c = createShip(generateBlueprint(o(), seed!), mode);
        const buffers = (r: THREE.Group) => {
          const list: number[][] = [];
          r.traverse((n) => {
            if (n instanceof THREE.Mesh) {
              const array = Array.from(
                n.geometry.getAttribute("position").array as ArrayLike<number>,
              );
              expect(array.every(Number.isFinite)).toBe(true);
              list.push(array);
            }
          });
          return list;
        };
        expect(buffers(a)).toEqual(buffers(c));
        disposeShip(a);
        disposeShip(c);
      }
  });
});
