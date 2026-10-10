import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  addModularHardpoints,
  normalizeHardpointOrder,
  surfaceSlot, slotEnvironment, slotPhysicalIssues,
} from "../src/generation/hardpoint-system/planner";
import { validateModularHardpoints } from "../src/generation/hardpoint-system/validate";
import {
  moduleCompatibility,
  slotStandard,
} from "../src/generation/hardpoint-system/compatibility";
import { generateBlueprint, DEFAULT_ORDER } from "../src/generation/generate";
import { validateBlueprint } from "../src/validation/validate";
import type { ShipBlueprint } from "../src/blueprint/types";
const baseline = () =>
  JSON.parse(
    readFileSync("qa/v1.8.5.4/before/stacked-blocks.json", "utf8"),
  ) as ShipBlueprint;
describe("modular hardpoint installation contracts", () => {
  it("prepares many genuinely empty slots without changing structural or installed equipment geometry", () => {
    const b = baseline(),
      before = JSON.stringify([
        b.structuralVolumes,
        b.structuralConnectors,
        b.productionDesign,
        b.engines,
        b.weaponLayout,
        b.mesoStructurePlan,
        b.exteriorDetailPlan,
        b.prefabPlacements,
      ]);
    normalizeHardpointOrder(b.order);
    addModularHardpoints(b);
    console.log("SLOTS", b.hardpoints.length, b.modularHardpoints?.diagnostics);
    expect(b.hardpoints.length).toBeGreaterThan(30);
    expect(b.modularHardpoints!.summary.empty).toBeGreaterThan(10);
    expect(
      JSON.stringify([
        b.structuralVolumes,
        b.structuralConnectors,
        b.productionDesign,
        b.engines,
        b.weaponLayout,
        b.mesoStructurePlan,
        b.exteriorDetailPlan,
        b.prefabPlacements,
      ]),
    ).toBe(before);
    expect(validateModularHardpoints(b)).toEqual([]);
  });
});

it("density changes prepared capacity without changing the chosen hull, and JSON regeneration is deterministic", () => {
  const builds = ["SPARSE", "STANDARD", "DENSE"].map((d) => {
    const b = baseline();
    b.order.hardpointDensity = d as any;
    normalizeHardpointOrder(b.order);
    return addModularHardpoints(b);
  });
  expect(builds[0].hardpoints.length).toBeLessThan(builds[1].hardpoints.length);
  expect(builds[1].hardpoints.length).toBeLessThan(builds[2].hardpoints.length);
  const repeated = baseline();
  normalizeHardpointOrder(repeated.order);
  addModularHardpoints(repeated);
  expect(JSON.stringify(repeated)).toBe(JSON.stringify(builds[1]));
  expect(
    validateModularHardpoints(JSON.parse(JSON.stringify(builds[2]))),
  ).toEqual([]);
});

it("supports smaller composite modules in larger surface slots while keeping size and mount type independent", () => {
  // Isolated flat-surface geometry fixture, not a modified/shippable Production hull.
  const b = baseline(), host = structuredClone(b.structuralVolumes[0]);
  host.position = {x:0,y:0,z:0}; host.dimensions = {x:200,y:70,z:400};
  host.geometry.stations = [-200,200].map(z => ({z,width:200,height:70,profile:"box",bevel:0,topSlope:0,sideSlope:0}));
  host.shape = undefined; host.geometry.primitive = "Box";
  b.structuralVolumes = [host]; b.structuralConnectors = []; b.engines = [];
  b.prefabPlacements = []; b.hardpoints = []; b.trusses = [];
  b.productionDesign = undefined; b.designRequirements = undefined;
  b.mesoStructurePlan = undefined; b.exteriorDetailPlan = undefined;
  b.weaponLayout = undefined;
  const env = slotEnvironment(b), resolved = surfaceSlot(b,{x:0,y:0,z:0},"TOP","XL",env);
  expect(resolved.slot.contacts).toHaveLength(17);
  expect(slotPhysicalIssues(b,resolved.slot,env)).toEqual([]);
  const s = slotStandard("XL",300), h = {
    id:"fixture-xl",type:"Large Turret" as const,size:"XL" as const,parentId:resolved.parentId,
    position:resolved.position,normal:resolved.slot.frame.normal,radius:s.footprint.width/2,
    allowedCategories:["TURRET"],modular:resolved.slot,
  };
  h.modular.mountTypes = ["TURRET", "MISSILE", "DEFENSIVE"];
  const small = slotStandard("S", 300),
    module = {
      id: "composite-launcher",
      size: "S" as const,
      mountType: "MISSILE" as const,
      footprint: small.footprint,
      envelope: small.envelope,
      internalVolumeM3: 0,
      powerInterfaceIndex: 1,
      componentCount: 8,
      clearanceMeters: 1,
    };
  expect(moduleCompatibility(h, module).allowed).toBe(true);
  expect(moduleCompatibility(h, {...module,requiredDirection:{x:0,y:1,z:0}}).allowed).toBe(true);
  expect(moduleCompatibility(h, {...module,requiredDirection:{x:0,y:-1,z:0}}).allowed).toBe(false);
  expect(
    moduleCompatibility(h, { ...module, mountType: "SPINAL" }).allowed,
  ).toBe(false);
  expect(
    moduleCompatibility(h, {
      ...module,
      footprint: { width: 100, length: 100 },
    }).allowed,
  ).toBe(false);
  expect(
    moduleCompatibility(h, { ...module, mountType: "UTILITY" }).allowed,
  ).toBe(false);
});

it("honors distinct required support slots and reports preferred shortages without inventing spinal structure", () => {
  const b = baseline();
  b.order.hardpointRequests = [
    {
      id: "sensors",
      type: "UTILITY",
      size: "S",
      count: 4,
      mandatory: true,
      priority: 90,
      region: "TOP",
    },
    {
      id: "unavailable-axis",
      type: "SPINAL",
      size: "XL",
      count: 2,
      mandatory: false,
      priority: 80,
    },
  ];
  normalizeHardpointOrder(b.order);
  addModularHardpoints(b);
  expect(
    b.modularHardpoints!.requests.find((r) => r.request.id === "sensors")
      ?.status,
  ).toBe("SATISFIED");
  expect(
    b.modularHardpoints!.requests.find(
      (r) => r.request.id === "unavailable-axis",
    )?.missing,
  ).toBe(2);
  const ids = b.modularHardpoints!.requests.flatMap((r) => r.matchedIds);
  expect(new Set(ids).size).toBe(ids.length);
  expect(validateModularHardpoints(b)).toEqual([]);
});

it("rejects impossible mandatory XL requests using the existing DesignRejection contract", () => {
  const b = JSON.parse(
    readFileSync("qa/v1.8.5.4/before/spinal-modules.json", "utf8"),
  ) as ShipBlueprint;
  b.order.hardpointRequests = [
    {
      id: "four-axis",
      type: "SPINAL",
      size: "XL",
      count: 4,
      mandatory: true,
      priority: 100,
    },
  ];
  normalizeHardpointOrder(b.order);
  expect(() => addModularHardpoints(b)).toThrow(
    /REQUIRED_HARDPOINT_CAPACITY_UNAVAILABLE.*requested 4, matched 1, missing 3/,
  );
  const invalid = baseline().order;
  invalid.hardpointRequests = [
    {
      id: "bad",
      type: "TURRET",
      size: "S",
      count: NaN,
      mandatory: true,
      priority: 50,
    },
  ];
  expect(() => normalizeHardpointOrder(invalid)).toThrow(
    "INVALID_HARDPOINT_ORDER",
  );
});

it("detects detached positions and rewritten capacity instead of trusting saved summary counts", () => {
  const b = baseline();
  normalizeHardpointOrder(b.order);
  addModularHardpoints(b);
  const h = b.hardpoints.find((h) => h.modular?.state === "EMPTY")!;
  h.position.x = NaN;
  expect(validateModularHardpoints(b).join(";")).toMatch(/Non-finite/);
  h.position.x = 1000;
  h.modular!.internalVolumeM3 *= 2;
  expect(validateModularHardpoints(b).join(";")).toMatch(
    /support|Detached|mismatch/,
  );
});

it("integrates the default Production pipeline and preserves the historical Blueprint validator", () => {
  const b = generateBlueprint(
    { ...structuredClone(DEFAULT_ORDER), shipyardId: "aegis" },
    7,
    { architecture: "STACKED_BLOCKS", family: "WEDGE_CITADEL" },
  );
  const repeated = generateBlueprint(
    { ...structuredClone(DEFAULT_ORDER), shipyardId: "aegis" }, 7,
    { architecture: "STACKED_BLOCKS", family: "WEDGE_CITADEL" },
  );
  expect(JSON.stringify(repeated)).toBe(JSON.stringify(b));
  expect(b.generatorVersion).toBe("1.8.5.4.1");
  expect(validateBlueprint(JSON.parse(JSON.stringify(b)))).toEqual([]);
  const old = baseline(),
    copy = JSON.stringify(old);
  expect(old.modularHardpoints).toBeUndefined();
  expect(validateBlueprint(old)).toEqual([]);
  expect(JSON.stringify(old)).toBe(copy);
});

it("uses oriented occupied volumes and actual ray intersections rather than center distance", async () => {
  const { boxesOverlap, rayBox } =
    await import("../src/generation/hardpoint-system/geometry");
  const { detailFrame } = await import("../src/generation/details/geometry");
  const a = {
    position: { x: 0, y: 0, z: 0 },
    frame: detailFrame({ x: 0, y: 1, z: 0 }),
    localBounds: {
      min: { x: -22.5, y: 0, z: -10 },
      max: { x: 22.5, y: 6, z: 10 },
    },
  };
  expect(boxesOverlap(a, { ...a, position: { x: 40, y: 0, z: 0 } })).toBe(true);
  expect(
    boxesOverlap(a, {
      ...a,
      position: { x: 0, y: -0.1, z: 0 },
      frame: detailFrame({ x: 0, y: -1, z: 0 }),
    }),
  ).toBe(false);
  expect(rayBox({ x: 100, y: 3, z: 0 }, { x: -1, y: 0, z: 0 }, 100, a)).toBe(
    true,
  );
  expect(rayBox({ x: 100, y: 30, z: 0 }, { x: -1, y: 0, z: 0 }, 100, a)).toBe(
    false,
  );
});
