import {setPhysicalProfilingEnabled,capturePhysicalGeneration,physicalDiagnostics} from '../src/physical/diagnostics';
import {integratedLayerVolumes,tetraBelow} from '../src/physical/integration';
import {pieceLayers} from '../src/physical/layers';
import {tetra} from '../src/physical/convex';
import {preparePhysicalQueries} from '../src/physical/probe';
import {finishPhysicalMass} from '../src/physical/policy';
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Vector3, Quaternion, Euler } from "three";
import type { ShipBlueprint, Vec3 } from "../src/blueprint/types";
import {
  ARMOR_MATERIALS,
  HULL_MATERIALS,
  MATERIALS,
  materialLayers,
} from "../src/physical/materials";
import {
  triangleLayer,
  cellVolume,
  cellSolid,
  canonicalSolid,
  planes,
  clipCell,
  solidCell,
  subtractCell,
  orientCell,
} from "../src/physical/convex";
import { armorRayProbe } from "../src/physical/probe";
import {
  addPhysicalDesign,
  migratePhysicalDesign,
} from "../src/physical/build";
import { physicalSources } from "../src/physical/geometry";
import {
  createDesignPolicy,
  playerEquipmentMass,
} from "../src/physical/policy";
import { validatePhysicalDesign } from "../src/physical/validate";
import { createPhysicalInstanceState } from "../src/physical/types";
import { area, normal } from "../src/generation/armor/panels";
import { facetedBox } from "../src/generation/functional/geometry";
import {
  nearbyAnchor,
  evaluateFreeMount,
  savedFit,
} from "../src/free-mount/planner";
import { EquipmentHistory } from "../src/free-mount/store";
import { platformPart } from "../src/free-mount/platform";
import { solidVolume } from "../src/generation/production/doctrine";
const legacy = () =>
  JSON.parse(
    readFileSync("qa/v1.8.6.0/before/aegis470.json", "utf8"),
  ) as ShipBlueprint;
const tri = [
  { x: -10, y: -10, z: 0 },
  { x: 10, y: -10, z: 0 },
  { x: 0, y: 10, z: 0 },
];
function plate(
  id: string,
  kind: "ARMOR" | "HULL",
  polygon: Vec3[],
  thicknessMm: number,
  materialId: string,
) {
  const layers = materialLayers(materialId, thicknessMm).map((l) => ({
      ...l,
      volumeM3: 0,
      massKg: 0,
    })),
    pieces: any[] = [];
  let depth = 0;
  for (const l of layers) {
    const end = depth + l.thicknessMm / 1000,
      c = triangleLayer(polygon, depth, end),
      volumeM3 = cellVolume(c);
    l.volumeM3 = volumeM3;
    l.massKg = volumeM3 * l.densityKgM3;
    pieces.push({
      facetIndex: 0,
      layerOrder: l.layerOrder,
      solid: cellSolid(c),
      volumeM3,
    });
    depth = end;
  }
  const massKg = layers.reduce((n, l) => n + l.massKg, 0),
    volumeM3 = layers.reduce((n, l) => n + l.volumeM3, 0);
  return {
    id,
    kind,
    materialId,
    thicknessMm,
    facets: [
      {
        sourceTriangle: 0,
        normal: normal(polygon),
        areaM2: area(polygon),
        thicknessMm,
        maximumThicknessMm: 1000,
      },
    ],
    layerStack: layers,
    pieces,
    massKg,
    volumeM3,
    surfaceAreaM2: area(polygon),
    integratedMeanDensityKgM3: massKg / volumeM3,
  };
}
function rayFixture(armored = true) {
  return {
    physicalDesign: {
      surfaces: [
        ...(armored
          ? [plate("armor", "ARMOR", tri, 300, "CERAMIC_COMPOSITE")]
          : []),
        plate(
          "hull",
          "HULL",
          tri.map((p) => ({ ...p, z: -1 })),
          18,
          "LIGHT_STRUCTURAL_ALLOY",
        ),
      ],
      geometryModel: "FINITE_TEST_TRIANGLE_PRISMS",
      approximation: "Finite flat test geometry",
      warnings: [],
    },
  } as unknown as ShipBlueprint;
}
function sandbox() {
  const b = legacy(),
    v = b.structuralVolumes[0];
  v.id = "fixture-hull";
  v.type = "PRIMARY_HULL";
  v.position = { x: 0, y: 0, z: 0 };
  v.rotation = { x: 0, y: 0, z: 0 };
  v.dimensions = { x: 160, y: 40, z: 200 };
  v.shape = undefined;
  v.geometry = {
    primitive: "Box",
    stations: [-100, 100].map((z) => ({
      z,
      width: 160,
      height: 40,
      profile: "box",
      bevel: 0,
      topSlope: 0,
      sideSlope: 0,
    })),
  };
  b.structuralVolumes = [v];
  b.structuralConnectors = [];
  b.engines = [];
  b.prefabPlacements = [];
  b.hardpoints = [];
  b.trusses = [];
  b.designRequirements = undefined;
  b.mesoStructurePlan = undefined;
  b.exteriorDetailPlan = undefined;
  b.productionDesign!.armor = [];
  b.productionDesign!.finish = [];
  b.productionDesign!.zones = [];
  b.productionDesign!.channels = [];
  b.weaponLayout!.mounts = [];
  b.freeMountPlan = {
    version: "1.8.5.5",
    entries: [],
    nextId: 1,
    internalValidation: "NOT_PERFORMED",
  };
  return b;
}
describe("physical material, finite layer and accounting foundation", () => {
  it("defines exactly five armor and three hull materials, immutable densities and honest composite thickness/mass", () => {
    expect(Object.keys(ARMOR_MATERIALS)).toHaveLength(5);
    expect(Object.keys(HULL_MATERIALS)).toHaveLength(3);
    expect(Object.values(ARMOR_MATERIALS).map((m) => m.densityKgM3)).toEqual([
      7850, 4500, 4300, 10500, 5200,
    ]);
    expect(Object.values(HULL_MATERIALS).map((m) => m.densityKgM3)).toEqual([
      2800, 4500, 7850,
    ]);
    for (const m of Object.values(MATERIALS)) {
      const ls = materialLayers(m.materialId, 300);
      expect(ls.reduce((n, l) => n + l.thicknessMm, 0)).toBeCloseTo(300, 10);
      expect(
        ls.reduce((n, l) => n + (l.thicknessMm * l.densityKgM3) / 300, 0),
      ).toBeCloseTo(m.densityKgM3, 9);
      expect(Object.isFrozen(m)).toBe(true);
      expect(m.manufacturingCostIndex).toBeGreaterThan(0);
    }
    for (const t of [0, -1, NaN, Infinity])
      expect(() => materialLayers("ARMORED_STEEL", t)).toThrow();
  });
  it("integrates finite volumes and layer density without double shell mass, and isolates instance state", () => {
    const a = plate("armor", "ARMOR", tri, 300, "CERAMIC_COMPOSITE"),
      h = plate("hull", "HULL", tri, 18, "LIGHT_STRUCTURAL_ALLOY");
    expect(a.volumeM3).toBeCloseTo(area(tri) * 0.3, 8);
    expect(a.massKg).toBeCloseTo(area(tri) * 0.3 * 4300, 6);
    expect(a.integratedMeanDensityKgM3).toBeCloseTo(4300, 9);
    expect(h.massKg).toBeCloseTo(area(tri) * 0.018 * 2800, 7);
    expect(h.massKg).toBeLessThan(a.massKg);
    const one = createPhysicalInstanceState("one", "same"),
      two = createPhysicalInstanceState("two", "same");
    one.armorDamage.foo = [];
    expect(two.armorDamage).toEqual({});
  });
  it("returns actual entry/exit for 0/30/60-degree incidence and armor layers before the separate hull shell", () => {
    for (const angle of [0, 30, 60]) {
      const r = (angle * Math.PI) / 180,
        b = rayFixture(),
        hit = armorRayProbe(
          b,
          { x: Math.sin(r) * 5, y: 0, z: Math.cos(r) * 5 },
          { x: -Math.sin(r), y: 0, z: -Math.cos(r) },
          20,
        );
      expect(hit.valid).toBe(true);
      expect(hit.hits.map((h) => h.surfaceId)).toEqual([
        "armor",
        "armor",
        "armor",
        "hull",
      ]);
      expect(
        hit.hits.slice(0, 3).reduce((n, h) => n + h.pathLengthM, 0),
      ).toBeCloseTo(0.3 / Math.cos(r), 8);
      for (const h of hit.hits) {
        expect(h.incidenceDegrees).toBeCloseTo(angle, 7);
        expect(
          Math.hypot(
            h.exitPoint.x - h.entryPoint.x,
            h.exitPoint.y - h.entryPoint.y,
            h.exitPoint.z - h.entryPoint.z,
          ),
        ).toBeCloseTo(h.pathLengthM, 9);
      }
    }
  });
  it("clips edge escape, reports bare hull, stays finite at grazing incidence and rejects invalid rays", () => {
    const edge = armorRayProbe(
      rayFixture(),
      { x: 8.4, y: -9, z: 0.1 },
      { x: 1, y: 0, z: -0.1 },
      20,
    );
    expect(
      edge.hits.filter((h) => h.plateId).reduce((n, h) => n + h.pathLengthM, 0),
    ).toBeLessThan(0.3 / 0.1);
    const bare = armorRayProbe(
      rayFixture(false),
      { x: 0, y: 0, z: 5 },
      { x: 0, y: 0, z: -1 },
      20,
    );
    expect(bare.hits.map((h) => h.surfaceId)).toEqual(["hull"]);
    const boundary = rayFixture(false);
    const left = plate(
      "joint",
      "HULL",
      [
        { x: -10, y: -10, z: 0 },
        { x: 0, y: -10, z: 0 },
        { x: 0, y: 10, z: 0 },
      ],
      18,
      "LIGHT_STRUCTURAL_ALLOY",
    );
    const right = plate(
      "joint",
      "HULL",
      [
        { x: 0, y: -10, z: 0 },
        { x: 10, y: -10, z: 0 },
        { x: 0, y: 10, z: 0 },
      ],
      18,
      "LIGHT_STRUCTURAL_ALLOY",
    );
    left.pieces.push(...right.pieces);
    boundary.physicalDesign!.surfaces = [left] as any;
    const joint = armorRayProbe(
      boundary,
      { x: 0, y: 0, z: 5 },
      { x: 0, y: 0, z: -1 },
      20,
    );
    expect(joint.hits).toHaveLength(1);
    expect(joint.hits[0].pathLengthM).toBeCloseTo(0.018, 8);
    const grazing = armorRayProbe(
      rayFixture(),
      { x: 0, y: 0, z: 1e-8 },
      { x: 1, y: 0, z: -1e-9 },
      100,
    );
    expect(grazing.valid).toBe(true);
    expect(
      grazing.hits.every(
        (h) => Number.isFinite(h.pathLengthM) && h.pathLengthM <= 100,
      ),
    ).toBe(true);
    expect(
      armorRayProbe(
        rayFixture(),
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        10,
      ).valid,
    ).toBe(false);
  });
  it("transforms normals/entry points with a rotated translated ship and traces inclined nonparallel facets", () => {
    const q = new Quaternion().setFromEuler(new Euler(0.3, 0.7, 0.2)),
      p = new Vector3(20, -7, 31),
      o = new Vector3(0, 0, 5).applyQuaternion(q).add(p),
      d = new Vector3(0, 0, -1).applyQuaternion(q),
      r = armorRayProbe(
        rayFixture(),
        { x: o.x, y: o.y, z: o.z },
        { x: d.x, y: d.y, z: d.z },
        20,
        { position: { x: p.x, y: p.y, z: p.z }, quaternion: q },
      );
    expect(r.hits[0].incidenceDegrees).toBeCloseTo(0, 6);
    expect(
      r.hits.slice(0, 3).reduce((n, h) => n + h.pathLengthM, 0),
    ).toBeCloseTo(0.3, 8);
    const n = new Vector3(0, 0, 1).applyQuaternion(q);
    expect(r.hits[0].surfaceNormal.x).toBeCloseTo(n.x, 8);
    const curved = rayFixture();
    curved.physicalDesign!.surfaces = [
      plate(
        "inclined",
        "ARMOR",
        tri.map((v) => ({ x: v.x, y: v.y, z: v.x * 0.3 })),
        120,
        "ARMORED_STEEL",
      ),
    ] as any;
    const cr = armorRayProbe(
      curved,
      { x: 0, y: 0, z: 5 },
      { x: 0, y: 0, z: -1 },
      20,
    );
    expect(cr.hits[0].incidenceDegrees).toBeCloseTo(
      (Math.atan(0.3) * 180) / Math.PI,
      6,
    );
    expect(cr.hits[0].pathLengthM).toBeCloseTo(
      0.12 * Math.sqrt(1 + 0.3 ** 2),
      7,
    );
    // A genuinely nonparallel back face must shorten the path rather than use nominal / cosine.
    const wedge = rayFixture(false),
      w = plate("wedge", "HULL", tri, 300, "LIGHT_STRUCTURAL_ALLOY");
    const cut = clipCell(
      solidCell(w.pieces[0].solid),
      { x: 0.05, y: 0, z: -1 },
      0.2,
    )!;
    w.pieces[0].solid = cellSolid(cut);
    w.pieces[0].volumeM3 = cellVolume(cut);
    wedge.physicalDesign!.surfaces = [w] as any;
    expect(
      armorRayProbe(wedge, { x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: -1 }, 20)
        .hits[0].pathLengthM,
    ).toBeCloseTo(0.2, 8);
    const arc = rayFixture(false);
    arc.physicalDesign!.surfaces = [-1, 1].map((side) =>
      plate(
        "curve/" + side,
        "ARMOR",
        tri.map((v) => ({ x: v.x + side * 20, y: v.y, z: v.x * 0.3 * side })),
        120,
        "ARMORED_STEEL",
      ),
    ) as any;
    for (const side of [-1, 1])
      expect(
        armorRayProbe(
          arc,
          { x: side * 20, y: 0, z: 5 },
          { x: 0, y: 0, z: -1 },
          20,
        ).hits[0].incidenceDegrees,
      ).toBeCloseTo((Math.atan(0.3) * 180) / Math.PI, 6);
  });
  it("subtracts real overlapping volumes without mass duplication, including collinear clipped face vertices", () => {
    const cube = (x: number) => {
      const v = (a: number, b: number, c: number) => ({ x: x + a, y: b, z: c });
      return orientCell(
        [
          [v(-2, -2, -2), v(2, -2, -2), v(2, 2, -2), v(-2, 2, -2)],
          [v(-2, -2, 2), v(2, -2, 2), v(2, 2, 2), v(-2, 2, 2)],
          [v(-2, -2, -2), v(2, -2, -2), v(2, -2, 2), v(-2, -2, 2)],
          [v(-2, 2, -2), v(2, 2, -2), v(2, 2, 2), v(-2, 2, 2)],
          [v(-2, -2, -2), v(-2, 2, -2), v(-2, 2, 2), v(-2, -2, 2)],
          [v(2, -2, -2), v(2, 2, -2), v(2, 2, 2), v(2, -2, 2)],
        ].filter((f) => f.length),
      );
    };
    const a = cube(0),
      b = cube(2),
      remaining = subtractCell(a, b);
    expect(remaining.reduce((n, c) => n + cellVolume(c), 0)).toBeCloseTo(
      cellVolume(a) / 2,
      7,
    );
    const cell = triangleLayer(tri, 0, 0.3);
    cell.faces[0].splice(1, 0, { x: 0, y: -10, z: 0 });
    expect(cellVolume(solidCell(cellSolid(cell)))).toBeCloseTo(
      cellVolume(cell),
      9,
    );
    const repaired = canonicalSolid(
      JSON.parse(
        readFileSync(
          new URL(
            "./fixtures/physical/nearly-collinear-clipped-cell.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    expect(
      planes(solidCell(repaired)).every((p) =>
        repaired.vertices.every(
          (v) => v.x * p.n.x + v.y * p.n.y + v.z * p.n.z <= p.d + 1e-5,
        ),
      ),
    ).toBe(true);
  });
  it("shares one priority interpretation, fixed target mass and competing budgets across armor/mobility/endurance/weapons/sensors", () => {
    const source = legacy(),
      sources = physicalSources(source),
      plans = [
        "survivability",
        "mobility",
        "firepower",
        "endurance",
        "missile",
        "sensor",
      ].map((k) => {
        const b = structuredClone(source);
        b.order.targetDryMassKg = source.dimensions.estimatedMass * 1000;
        b.order.priorities = {
          firepower: 50,
          survivability: 50,
          mobility: 50,
          endurance: 50,
          missile: 50,
          sensor: 50,
        };
        b.order.priorities[k as keyof typeof b.order.priorities] = 100;
        return createDesignPolicy(b, sources);
      });
    for (const p of plans)
      expect(
        Object.values(p.allocationsKg).reduce((n, v) => n + v, 0),
      ).toBeCloseTo(plans[0].targetMassBudgetKg, 4);
    expect(plans[0].allocationsKg.armor).toBeGreaterThan(
      plans[1].allocationsKg.armor,
    );
    expect(plans[1].hullMaterialPreference).toBe("LIGHT_STRUCTURAL_ALLOY");
    expect(plans[3].future.systemPlacementPreference).toBe("DISTRIBUTED");
    expect(plans[3].future.compartmentSubdivisionPreference).toBeGreaterThan(
      plans[0].future.compartmentSubdivisionPreference,
    );
    expect(plans[2].future.fireControlProtectionPreference).toBeGreaterThan(
      plans[0].future.fireControlProtectionPreference,
    );
    expect(plans[4].future.missileSupportProtectionPreference).toBeGreaterThan(
      plans[0].future.missileSupportProtectionPreference,
    );
    expect(plans[5].allocationsKg.sensor).toBeGreaterThan(
      plans[0].allocationsKg.sensor,
    );
  });
  it("keeps finite shell data deterministic, validates JSON and marks explicit migration without rewriting historical geometry", () => {
    const b = sandbox(),
      before = JSON.stringify(b);
    addPhysicalDesign(b);
    expect(validatePhysicalDesign(JSON.parse(JSON.stringify(b)))).toEqual([]);
    const repeat = sandbox();
    addPhysicalDesign(repeat);
    expect(JSON.stringify(repeat)).toBe(JSON.stringify(b));
    const old = sandbox(),
      copy = JSON.stringify(old),
      migrated = migratePhysicalDesign(old);
    expect(JSON.stringify(old)).toBe(copy);
    expect(migrated.physicalDesign?.provenance).toBe(
      "MIGRATED_DEFAULT_ESTIMATE",
    );
    expect(JSON.stringify(migrated.structuralVolumes)).toBe(
      JSON.stringify(old.structuralVolumes),
    );
    const originalThickness = b.physicalDesign!.surfaces[0].thicknessMm;
    b.physicalDesign!.surfaces[0].thicknessMm = 0;
    expect(validatePhysicalDesign(b).length).toBeGreaterThan(0);
    b.physicalDesign!.surfaces[0].thicknessMm = originalThickness;
    expect(validatePhysicalDesign(b)).toEqual([]);
    const invalid = structuredClone(b);
    invalid.physicalDesign!.surfaces[0].thicknessMm = 0;
    expect(validatePhysicalDesign(invalid).length).toBeGreaterThan(0);
    const noBudget = sandbox();
    noBudget.order.targetDryMassKg = 1;
    expect(() => addPhysicalDesign(noBudget)).toThrow(/MASS_BUDGET/);
  });
  it("keeps free mounts external-only, preserves owned platforms, refreshes estimates once and restores exact undo JSON", () => {
    const b = sandbox();
    addPhysicalDesign(b);
    b.designRequirements = {
      spaces: [
        {
          purpose: "ENERGY_SYSTEM",
          bounds: {
            min: { x: -999, y: -999, z: -999 },
            max: { x: 999, y: 999, z: 999 },
          },
        },
      ],
    } as any;
    const request = {
        equipmentId: "gun-210",
        anchor: nearbyAnchor(b, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 30),
        headingDegrees: 0,
        platforms: true,
        mode: "SINGLE" as const,
      },
      r = evaluateFreeMount(b, request);
    expect(r.status).toBe("DIRECT_VALID");
    const history = new EquipmentHistory(b),
      before = JSON.stringify(b);
    history.install(request, r);
    expect(history.blueprint.freeMountPlan!.internalValidation).toBe(
      "NOT_PERFORMED",
    );
    expect(
      history.blueprint.physicalDesign!.mass
        .playerMountedEquipmentMassEstimateKg,
    ).toBeGreaterThan(0);
    const entry = history.blueprint.freeMountPlan!.entries[0],
      fit = savedFit(entry),
      platform = platformPart(entry.id, entry.platform);
    expect(playerEquipmentMass(history.blueprint)).toBeCloseTo(
      fit.parts
        .filter((p) => p.id !== platform.id)
        .reduce((n, p) => n + solidVolume(p.solid) * 160, 0) +
        solidVolume(platform.solid) * 2800,
      7,
    );
    expect(validatePhysicalDesign(history.blueprint)).toEqual([]);
    history.undo();
    expect(JSON.stringify(history.blueprint)).toBe(before);
  });
});

describe('V1.8.6.0.1 physical performance and integrity',()=>{
 it('integrates the same finite layer volumes as independent plane clipping, including clipped corner cells',()=>{
  const b=sandbox();addPhysicalDesign(b);
  for(const s of b.physicalDesign!.surfaces)for(const p of s.pieces){const fast=integratedLayerVolumes(s,p),reference=pieceLayers(s,p);for(let i=0;i<s.layerStack.length;i++)expect(fast.find(v=>v.layerOrder===i)?.volumeM3??0).toBeCloseTo(reference.find(v=>v.layerOrder===i)?.volumeM3??0,6);}
  const p=[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}],c=tetra(...p as [Vec3,Vec3,Vec3,Vec3]);
  for(const n of [{x:1,y:2,z:3},{x:-2,y:3,z:-1}])for(const d of [-3,-1,0,.2,.7,1,1.5,2.5,4]){const h=p.map(v=>v.x*n.x+v.y*n.y+v.z*n.z),clipped=clipCell(c,n,d,true);expect(tetraBelow(p,h,d,1/6)).toBeCloseTo(clipped?cellVolume(clipped):0,10);}
 });
 it('invalidates content caches for changed policy, seed, dimensions and source geometry while hit/miss data agree',()=>{
  const original=sandbox();addPhysicalDesign(original);const hit=sandbox();addPhysicalDesign(hit);expect(hit.physicalDesign).toEqual(original.physicalDesign);
  const changed=sandbox();changed.seed++;changed.order.priorities.mobility=100;changed.structuralVolumes[0].geometry.stations.forEach(s=>s.width-=20);changed.dimensions.width*=.9;addPhysicalDesign(changed);expect(changed.physicalDesign!.policy.hullMaterialPreference).toBe('LIGHT_STRUCTURAL_ALLOY');expect(changed.physicalDesign!.surfaces[0].bounds).not.toEqual(original.physicalDesign!.surfaces[0].bounds);
  const restored=sandbox();addPhysicalDesign(restored);expect(restored.physicalDesign).toEqual(original.physicalDesign);
 });
 it('reuses immutable query snapshots and invalidates edited geometry/material without serializing cache state',()=>{
  const b=rayFixture(),json=JSON.stringify(b),q=preparePhysicalQueries(b),o={x:0,y:0,z:5},d={x:0,y:0,z:-1};expect(preparePhysicalQueries(b)).toBe(q);expect(JSON.stringify(b)).toBe(json);
  const old=q.probe(o,d,20);b.physicalDesign!.surfaces[0].materialId='TUNGSTEN_COMPOSITE';for(const p of b.physicalDesign!.surfaces[0].pieces)for(const v of p.solid.vertices)v.x+=100;
  const fresh=preparePhysicalQueries(b);expect(fresh).not.toBe(q);expect(fresh.probe(o,d,20).hits.map(h=>h.surfaceId)).toEqual(['hull']);expect(q.probe(o,d,20)).toEqual(old);expect(armorRayProbe(b,o,d,20)).toEqual(fresh.probe(o,d,20));b.physicalDesign!.surfaces[1].materialId='TITANIUM_STRUCTURAL_ALLOY';b.physicalDesign!.surfaces[1].layerStack[0].thicknessMm+=1;const edited=preparePhysicalQueries(b);expect(edited).not.toBe(fresh);expect(edited.probe(o,d,20).hits[0].materialId).toBe('TITANIUM_STRUCTURAL_ALLOY');
 });
 it('splits owned platforms once, reconciles the ledger and reports a mounted overrun without excusing invalid base mass',()=>{
  const b=sandbox();addPhysicalDesign(b);const h=new EquipmentHistory(b),request={equipmentId:'gun-210',anchor:nearbyAnchor(b,{x:0,y:0,z:0},{x:0,y:1,z:0},30),headingDegrees:0,platforms:true,mode:'SINGLE' as const};h.install(request);const ship=h.blueprint,m=ship.physicalDesign!.mass,l=m.ledger!;
  expect(l.entries).toHaveLength(7);expect(l.entries.reduce((n,e)=>n+e.massKg,0)).toBeCloseTo(m.totalEstimatedDryMassKg,5);expect(l.entries.find(e=>e.component==='PLATFORM')!.massKg).toBeGreaterThan(0);expect(l.entries.filter(e=>['MOUNTED_EQUIPMENT','PLATFORM'].includes(e.component)).reduce((n,e)=>n+e.massKg,0)).toBe(m.playerMountedEquipmentMassEstimateKg);
  const target=(value:number)=>{const p=ship.physicalDesign!.policy,f=value/p.targetMassBudgetKg;for(const k of Object.keys(p.allocationsKg) as (keyof typeof p.allocationsKg)[])p.allocationsKg[k]*=f;ship.order.targetDryMassKg=value;p.targetMassBudgetKg=value;ship.physicalDesign!.mass=finishPhysicalMass(ship);};target(l.baseEstimatedDryMassKg+m.playerMountedEquipmentMassEstimateKg/2);expect(ship.physicalDesign!.mass.ledger!.mountedLoadoutOverTarget).toBe(true);expect(validatePhysicalDesign(ship)).toEqual([]);
  target(l.baseEstimatedDryMassKg-1);expect(validatePhysicalDesign(ship)).toContain('Physical ship mass target exceeded');
 });
 it('reports real SPINE boundary intersections as unresolved rather than inventing shell material or silently omitting them',()=>{
  const b=sandbox();addPhysicalDesign(b);const spine=structuredClone(b.structuralVolumes[0]);spine.id='unclassified-axial';spine.type='SPINE';spine.purpose='axial-weapon';spine.position.x=200;b.structuralVolumes.push(spine);
  const q=preparePhysicalQueries(b),r=q.probe({x:200,y:100,z:0},{x:0,y:-1,z:0},200);expect(r.valid).toBe(true);expect(r.complete).toBe(false);expect(r.hits).toHaveLength(0);expect(r.unresolvedCrossings).toHaveLength(2);expect(r.unresolvedCrossings[0].distanceM).toBeCloseTo(80,8);expect(r.unresolvedCrossings[1].distanceM).toBeCloseTo(120,8);expect(r.unresolvedCrossings.every(c=>c.structureId===spine.id)).toBe(true);expect(q.probe({x:400,y:100,z:0},{x:0,y:-1,z:0},200).complete).toBe(true);
 });
});

it('keeps diagnostics runtime-only, reports real hits/misses and invalidates a seed-only cache change',()=>{
 setPhysicalProfilingEnabled(true);
 try{const make=(seed:number)=>{const b=sandbox();b.seed=seed;return capturePhysicalGeneration(()=>addPhysicalDesign(b));};
 const first=make(1000),hit=make(1000),changed=make(1001);
 expect(physicalDiagnostics(first)!.cache).toEqual({hits:0,misses:1});expect(physicalDiagnostics(hit)!.cache).toEqual({hits:1,misses:0});expect(physicalDiagnostics(changed)!.cache).toEqual({hits:0,misses:1});expect(JSON.stringify(first)).toBe(JSON.stringify(hit));
 setPhysicalProfilingEnabled(false);const off=make(1000);expect(physicalDiagnostics(off)).toBeUndefined();expect(JSON.stringify(off)).toBe(JSON.stringify(first));
 }finally{setPhysicalProfilingEnabled(false);}
});

it('keeps the represented-volume cutoff for constituent query intervals without cutting the finite outer cell',()=>{
 const b=rayFixture(false),poly=tri.map(p=>({x:p.x/1000,y:p.y/1000,z:p.z})),s=plate('tiny-constituent','ARMOR',poly,300,'CERAMIC_COMPOSITE') as any;
 s.facets[0].planeOffsetM=0;s.layerStack[0].thicknessMm=.001;s.layerStack[1].thicknessMm=149.999;s.layerStack[2].thicknessMm=150;
 const cell=triangleLayer(poly,0,.3);s.pieces=[{facetIndex:0,layerOrder:-1,solid:cellSolid(cell),volumeM3:cellVolume(cell)}];b.physicalDesign!.surfaces=[s];
 expect(pieceLayers(s,s.pieces[0]).map(p=>p.layerOrder)).toEqual([1,2]);expect(preparePhysicalQueries(b).probe({x:0,y:0,z:1},{x:0,y:0,z:-1},2).hits.map(h=>h.layerOrder)).toEqual([1,2]);
});
