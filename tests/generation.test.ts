import { describe, it, expect } from "vitest";
import {
  generateBlueprintV0 as generateBlueprint,
  DEFAULT_ORDER,
} from "./helpers/generate-v181";
import { validateBlueprint } from "../src/validation/validate";
import { SHIPYARDS, getShipyard } from "../src/shipyards/config";
import {
  ROLES,
  HARDPOINT_TYPES,
  PRIORITIES,
  type ShipOrder,
} from "../src/blueprint/types";
import { loftGeometry, moduleGeometry } from "../src/rendering/geometry";
import { createShip, disposeShip } from "../src/rendering/ship";
import * as THREE from "three";
const order = (partial: Partial<ShipOrder> = {}) => ({
  ...structuredClone(DEFAULT_ORDER),
  ...partial,
});
describe("Deterministic blueprint boundary", () => {
  it("matches serialized blueprint across 10 independent runs", () => {
    for (const yard of SHIPYARDS) {
      const o = order({ shipyardId: yard.id });
      const json = JSON.stringify(generateBlueprint(o, 4294967295));
      for (let i = 0; i < 10; i++)
        expect(JSON.stringify(generateBlueprint(o, 4294967295))).toBe(json);
    }
  });
  it("serializes with no loss and never mutates the order", () => {
    const o = order(),
      before = JSON.stringify(o),
      b = generateBlueprint(o, 0);
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
    expect(JSON.stringify(o)).toBe(before);
  });
  it("changes coherent proportions and structures for different seeds", () => {
    const a = generateBlueprint(order(), 42),
      b = generateBlueprint(order(), 43);
    expect(a.stations).not.toEqual(b.stations);
    expect(a.secondaryStructures).not.toEqual(b.secondaryStructures);
  });
  it("rejects malformed orders and seeds instead of producing NaN", () => {
    for (const length of [NaN, Infinity, 0, 601])
      expect(() => generateBlueprint(order({ length }), 1)).toThrow();
    expect(() =>
      generateBlueprint(order({ shipyardId: "unknown" }), 1),
    ).toThrow();
    expect(() => generateBlueprint(order(), NaN)).toThrow();
    expect(() =>
      generateBlueprint(
        order({ priorities: { ...DEFAULT_ORDER.priorities, mobility: -1 } }),
        1,
      ),
    ).toThrow();
  });
});
describe("Domain invariants over the design space", () => {
  it("loads four distinct doctrines and six available profile families", () => {
    expect(SHIPYARDS).toHaveLength(4);
    expect(new Set(SHIPYARDS.map((y) => y.structure)).size).toBe(4);
    expect(new Set(SHIPYARDS.flatMap((y) => y.profiles)).size).toBe(6);
    for (const y of SHIPYARDS) expect(getShipyard(y.id)).toBe(y);
  });
  it("validates 1,296 designs across every role, yard, length and priority extreme", () => {
    for (const yard of SHIPYARDS)
      for (const role of ROLES)
        for (const length of [40, 150, 600])
          for (const massClass of ["Light", "Standard", "Superheavy"] as const)
            for (const seed of [0, 42, 123456789, 4294967295]) {
              const priorities = Object.fromEntries(
                PRIORITIES.map((k) => [
                  k,
                  seed === 0
                    ? 0
                    : seed === 42
                      ? 100
                      : DEFAULT_ORDER.priorities[k],
                ]),
              ) as ShipOrder["priorities"];
              const b = (() => {
                try {
                  return generateBlueprint(
                    order({
                      role,
                      shipyardId: yard.id,
                      length,
                      massClass,
                      priorities,
                    }),
                    seed,
                  );
                } catch (e) {
                  throw new Error(
                    `${yard.id}/${role}/${length}/${massClass}/${seed}: ${e}`,
                  );
                }
              })();
              expect(
                validateBlueprint(b),
                `${yard.id}/${role}/${length}/${massClass}/${seed}`,
              ).toEqual([]);
              expect(b.stations.length).toBeGreaterThanOrEqual(5);
              expect(b.stations.length).toBeLessThanOrEqual(12);
              expect([1, 2, 4, 6]).toContain(b.engines.length);
              expect(b.hardpoints.length).toBeLessThan(100);
              for (const h of b.hardpoints)
                expect(HARDPOINT_TYPES).toContain(h.type);
              if (role === "Spinal Gun Ship")
                expect(b.hardpoints.some((h) => h.type === "Spinal")).toBe(
                  true,
                );
              if (role === "Missile Ship")
                expect(
                  b.hardpoints.filter((h) => h.type === "Missile").length,
                ).toBeGreaterThanOrEqual(10);
            }
  });
  it("all priorities affect a design parameter, independently", () => {
    for (const k of PRIORITIES) {
      const a = generateBlueprint(
          order({ priorities: { ...DEFAULT_ORDER.priorities, [k]: 0 } }),
          42,
        ),
        b = generateBlueprint(
          order({ priorities: { ...DEFAULT_ORDER.priorities, [k]: 100 } }),
          42,
        );
      const design = (x: typeof a) => ({
        s: x.stations,
        m: x.secondaryStructures,
        e: x.engines,
        h: x.hardpoints,
        f: x.surfaceFeatures,
      });
      expect(design(a), k).not.toEqual(design(b));
    }
  });
  it("A/B/C/D orders separate hull silhouettes beyond mount counts", () => {
    const a = generateBlueprint(order(), 42),
      b = generateBlueprint(
        order({
          priorities: {
            ...DEFAULT_ORDER.priorities,
            firepower: 40,
            survivability: 30,
            mobility: 90,
            missile: 30,
          },
        }),
        42,
      ),
      c = generateBlueprint(
        order({
          role: "Missile Ship",
          priorities: {
            ...DEFAULT_ORDER.priorities,
            missile: 100,
            survivability: 50,
            mobility: 40,
          },
        }),
        42,
      ),
      d = generateBlueprint(
        order({
          role: "Spinal Gun Ship",
          priorities: {
            ...DEFAULT_ORDER.priorities,
            firepower: 100,
            mobility: 50,
            missile: 10,
          },
        }),
        42,
      );
    const width = (x: typeof a) => Math.max(...x.stations.map((s) => s.width));
    expect(width(a) / width(b)).toBeGreaterThan(1.3);
    expect(width(c) / width(d)).toBeGreaterThan(2);
    expect(c.secondaryStructures.some((m) => m.kind === "missile")).toBe(true);
  });
  it("validation catches disconnected mounts, engines, modules and invalid geometry", () => {
    const b = generateBlueprint(order(), 42);
    b.engines[0].position.x = 10000;
    b.hardpoints[0].position.y = 10000;
    b.secondaryStructures[0].position.x = 10000;
    b.stations[1].height = NaN;
    const errors = validateBlueprint(b).join(";");
    expect(errors).toContain("Invalid numeric");
    expect(errors).toContain("Detached engine");
    expect(errors).toContain("Detached hardpoint");
    expect(errors).toContain("Detached module");
  });
});
describe("Geometry bridge", () => {
  it("renders finite, outward-facing, non-degenerate loft triangles", () => {
    for (const y of SHIPYARDS) {
      const b = generateBlueprint(order({ shipyardId: y.id }), 742091);
      const g = loftGeometry(b.stations),
        p = g.getAttribute("position");
      const a = new THREE.Vector3(),
        c = new THREE.Vector3(),
        d = new THREE.Vector3();
      for (let i = 0; i < p.count; i += 3) {
        a.fromBufferAttribute(p, i);
        c.fromBufferAttribute(p, i + 1);
        d.fromBufferAttribute(p, i + 2);
        const normal = c.clone().sub(a).cross(d.clone().sub(a)),
          center = a.clone().add(c).add(d).divideScalar(3);
        expect(normal.length()).toBeGreaterThan(0.00001);
        if (Math.abs(normal.z) < normal.length() * 0.99)
          expect(normal.x * center.x + normal.y * center.y).toBeGreaterThan(0);
      }
      g.dispose();
    }
  });
  it("places hardpoints on the exposed rendered surface using independent ray intersections", () => {
    for (const yard of SHIPYARDS)
      for (const role of [
        "Cruiser",
        "Missile Ship",
        "Spinal Gun Ship",
      ] as const)
        for (const seed of [42, 2718, 742091]) {
          const b = generateBlueprint(
              order({ shipyardId: yard.id, role }),
              seed,
            ),
            l = b.order.length;
          const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
          });
          const meshes = [
            new THREE.Mesh(loftGeometry(b.stations), material),
            ...b.secondaryStructures.map((m) => {
              const mesh = new THREE.Mesh(moduleGeometry(m), material);
              mesh.position.set(m.position.x, m.position.y, m.position.z);
              return mesh;
            }),
          ];
          meshes.forEach((m) => m.updateMatrixWorld());
          for (const mount of b.hardpoints.filter((h) => h.type !== "Spinal")) {
            const ray = new THREE.Raycaster(
              new THREE.Vector3(mount.position.x, l, mount.position.z),
              new THREE.Vector3(0, -1, 0),
            );
            const hit = ray.intersectObjects(meshes, false)[0];
            expect(hit, `${yard.id}/${role}/${seed}/${mount.id}`).toBeDefined();
            expect(
              Math.abs(hit.point.y - mount.position.y),
              `${yard.id}/${role}/${seed}/${mount.id}`,
            ).toBeLessThan(l * 0.004);
          }
          meshes.forEach((m) => m.geometry.dispose());
          material.dispose();
        }
  });
  it("reproduces identical mesh vertex buffers and bounds", () => {
    const b = generateBlueprint(order(), 42);
    const a = createShip(b, "Normal"),
      c = createShip(generateBlueprint(order(), 42), "Normal");
    const buffers = (r: THREE.Group) => {
      const data: number[][] = [];
      r.traverse((n) => {
        if (n instanceof THREE.Mesh)
          data.push(Array.from(n.geometry.getAttribute("position").array));
      });
      return data;
    };
    expect(buffers(a)).toEqual(buffers(c));
    expect(
      new THREE.Box3()
        .setFromObject(a)
        .equals(new THREE.Box3().setFromObject(c)),
    ).toBe(true);
    disposeShip(a);
    disposeShip(c);
  });
});
