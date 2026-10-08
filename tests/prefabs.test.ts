import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  ARCHITECTURES,
  LEGACY_PREFAB_KINDS as PREFAB_KINDS,
} from "../src/blueprint/types";
import {
  DEFAULT_ORDER,
  generateBlueprintV16 as generateBlueprint,
} from "../src/generation/generate";
import { PREFAB_LIBRARY } from "../src/generation/prefabs";
import { SHIPYARDS } from "../src/shipyards/config";
import { createShip, disposeShip } from "../src/rendering/ship";
import { validateBlueprint } from "../src/validation/validate";

describe("V1.6 socketed parametric kitbash", () => {
  it("retains authoritative socket and prefab metadata for deterministic multi-yard grammars", () => {
    const used = new Set<string>();
    for (const yard of SHIPYARDS) {
      for (const architecture of ARCHITECTURES) {
        for (const seed of [0, 1, 42, 2718]) {
          const order = {
            ...structuredClone(DEFAULT_ORDER),
            shipyardId: yard.id,
          };
          const b = generateBlueprint(order, seed, { architecture });
          expect(b.generatorVersion).toBe("1.6");
          expect(validateBlueprint(b), yard.id + "/" + architecture).toEqual(
            [],
          );
          expect(JSON.parse(JSON.stringify(b))).toEqual(b);
          expect(
            JSON.stringify(generateBlueprint(order, seed, { architecture })),
          ).toBe(JSON.stringify(b));
          for (const p of b.prefabPlacements ?? []) {
            used.add(p.kind);
            expect(PREFAB_KINDS).toContain(p.kind);
            expect(PREFAB_LIBRARY[p.kind].socketKind).toBe(p.socket.kind);
            expect(
              Math.hypot(
                p.socket.normal.x,
                p.socket.normal.y,
                p.socket.normal.z,
              ),
            ).toBeCloseTo(1, 5);
          }
        }
      }
    }
    expect([...used].sort()).toEqual([...PREFAB_KINDS].sort());
  }, 60000);

  it("renders only valid finite parametric meshes and exposes mount metadata", () => {
    const b = generateBlueprint(DEFAULT_ORDER, 42, {
      architecture: "TRUSS_POD",
    });
    const a = createShip(b, "Normal");
    const mounted: string[] = [];
    a.traverse((node) => {
      if (node.userData.prefabKind) mounted.push(node.userData.prefabKind);
      if (node instanceof THREE.Mesh) {
        expect(
          Array.from(node.geometry.getAttribute("position").array).every(
            Number.isFinite,
          ),
        ).toBe(true);
      }
    });
    expect(mounted.length).toBe(b.prefabPlacements?.length);
    const again = createShip(
      generateBlueprint(DEFAULT_ORDER, 42, { architecture: "TRUSS_POD" }),
      "Normal",
    );
    expect(
      new THREE.Box3()
        .setFromObject(a)
        .equals(new THREE.Box3().setFromObject(again)),
    ).toBe(true);
    disposeShip(a);
    disposeShip(again);
    const debug = createShip(b, "Structural Graph");
    let debugMounts = 0;
    debug.traverse((node) => {
      if (node.userData.prefabKind) debugMounts++;
    });
    expect(debugMounts).toBe(0);
    disposeShip(debug);
  });

  it("rejects detached, modified or duplicate sockets without breaking V1.5 exports", () => {
    const b = generateBlueprint(DEFAULT_ORDER, 42, {
      architecture: "BLOCK_ASSEMBLY",
    });
    expect(b.prefabPlacements?.length).toBeGreaterThan(0);
    const moved = structuredClone(b);
    moved.prefabPlacements![0].socket.position.x += 10000;
    expect(
      validateBlueprint(moved).some((error) =>
        error.includes("Detached prefab"),
      ),
    ).toBe(true);
    const flipped = structuredClone(b);
    flipped.prefabPlacements![0].socket.normal.x = 100;
    expect(
      validateBlueprint(flipped).some((error) =>
        error.includes("Invalid prefab"),
      ),
    ).toBe(true);
    const doubled = structuredClone(b);
    doubled.prefabPlacements!.push(
      structuredClone(doubled.prefabPlacements![0]),
    );
    expect(
      validateBlueprint(doubled).some((error) => error.includes("duplicate")),
    ).toBe(true);
    const old = structuredClone(b);
    old.generatorVersion = "1.5";
    delete old.prefabPlacements;
    expect(validateBlueprint(old)).toEqual([]);
    const restored = createShip(old, "Normal");
    disposeShip(restored);
  });
});
