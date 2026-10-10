import { beforeAll, it, expect } from "vitest";
import { generateBlueprint, DEFAULT_ORDER } from "../src/generation/generate";
import { PREVIEW_EQUIPMENT } from "../src/equipment-preview/library";
import {
  fitEquipment,
  planEquipmentPreview,
} from "../src/equipment-preview/fitment";
import {
  equipmentGeometry,
  gunPivot,
  posePoint,
} from "../src/equipment-preview/geometry";
import { slotEnvironment,surfaceSlot } from "../src/generation/hardpoint-system/planner";
import {
  boxSolid,
  boxBounds,
  boxesOverlap,
} from "../src/generation/hardpoint-system/geometry";
import { worldPoint } from "../src/generation/weapons/surfaces";
import { boundsIndex } from "../src/generation/hardpoint-system/geometry";
import type { ShipBlueprint, Hardpoint } from "../src/blueprint/types";
let b: ShipBlueprint, m: Hardpoint, original: string;
const gun = PREVIEW_EQUIPMENT.find((e) => e.id === "gun-210")!;
const launcher = PREVIEW_EQUIPMENT.find((e) => e.id === "missile-medium")!;
beforeAll(() => {
  b = generateBlueprint(
    {
      ...structuredClone(DEFAULT_ORDER),
      length: 470,
      role: "Battleship",
      hardpointDensity: "SPARSE",
    },
    7,
    { architecture: "MONOLITHIC", family: "WEDGE_CITADEL" },
  );
  m = b.hardpoints.find(
    (h) =>
      h.modular?.state === "EMPTY" &&
      h.size === "M" &&
      h.modular.region === "TOP",
  )!;
  original = JSON.stringify(b);
}, 30000);
it("separates caliber, module dimensions and actual slot compatibility", () => {
  expect(PREVIEW_EQUIPMENT.find((e) => e.id === "gun-406")!.size).toBe(
    PREVIEW_EQUIPMENT.find((e) => e.id === "gun-500")!.size,
  );
  expect(
    fitEquipment(b, m, PREVIEW_EQUIPMENT.find((e) => e.id === "gun-406")!)
      .status,
  ).toBe("INCOMPATIBLE");
  expect(
    fitEquipment(
      b,
      b.hardpoints.find((h) => h.modular?.state === "OCCUPIED")!,
      gun,
    ).status,
  ).toBe("INCOMPATIBLE");
});
it("seats an actual closed foundation at 17 coherent measured contacts", () => {
  const r = fitEquipment(b, m, gun);
  expect(["VALID", "PARTIAL_ARC"]).toContain(r.status);
  expect(r.contacts).toHaveLength(17);
  expect(r.parts[0].role).toBe("FOUNDATION");
  for (const part of r.parts) {
    const edges = new Map<string, number>();
    let volume = 0;
    for (let i = 0; i < part.solid.indices.length; i += 3) {
      const ids = part.solid.indices.slice(i, i + 3),
        [a, c, d] = ids.map((k) => part.solid.vertices[k]);
      volume +=
        (a.x * (c.y * d.z - c.z * d.y) +
          a.y * (c.z * d.x - c.x * d.z) +
          a.z * (c.x * d.y - c.y * d.x)) /
        6;
      for (let j = 0; j < 3; j++) {
        const key = [ids[j], ids[(j + 1) % 3]].sort((x, y) => x - y).join("/");
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    expect(volume).toBeGreaterThan(1e-7);
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
  }

  expect(
    r.parts.every(
      (p) =>
        p.solid.indices.length % 3 === 0 &&
        p.solid.vertices.every((v) => Object.values(v).every(Number.isFinite)),
    ),
  ).toBe(true);
});
it("records blocked yaw/elevation samples and genuine limited operating arcs", () => {
  const r = fitEquipment(b, m, gun);
  expect(r.status).toBe("PARTIAL_ARC");
  expect(r.samples.some((s) => s.clear)).toBe(true);
  expect(r.samples.some((s) => !s.clear)).toBe(true);
  expect(r.samples).toHaveLength(52);
  expect(
    r.samples.find(
      (s) => s.yaw === r.pose!.yaw && s.elevation === r.pose!.elevation,
    )!.clear,
  ).toBe(true);
});
it("validates bottom and side assemblies in each saved local frame, not world-up", () => {
  for (const region of ["BOTTOM", "PORT", "STARBOARD"] as const) {
    const h = b.hardpoints.find(
      (h) =>
        h.modular?.state === "EMPTY" &&
        h.size === "M" &&
        h.modular.region === region,
    )!;
    expect(h).toBeDefined();
    const g = equipmentGeometry(h, launcher);
    expect(
      g.shots.every(
        (s) =>
          JSON.stringify(s.direction) ===
          JSON.stringify(h.modular!.frame.normal),
      ),
    ).toBe(true);
    expect(fitEquipment(b, h, launcher).status).not.toBe("INCOMPATIBLE");
  }
});
it("rejects actual body and barrel interference instead of using center distance", () => {
  const env = slotEnvironment(b),
    geo = equipmentGeometry(m, gun),
    p = geo.parts.find((p) => p.id.endsWith("armored-turret"))!;
  const obstruction = {
    id: "test-obstruction",
    solid: p.solid,
    bounds: p.bounds,
  };
  env.scene.push(obstruction);
  env.sceneQuery = boundsIndex(env.scene);
  const r = fitEquipment(b, m, gun, [], env);
  expect(r.samples.some((s) => s.blockers.includes("test-obstruction"))).toBe(
    true,
  );
});
it("detects a blocked missile initial exit path", () => {
  const env = slotEnvironment(b),
    origin = worldPoint(m.position, m.modular!.frame, { x: 0, y: 14, z: 0 }),
    box = {
      position: origin,
      frame: m.modular!.frame,
      localBounds: { min: { x: -7, y: 0, z: -7 }, max: { x: 7, y: 2, z: 7 } },
    };
  env.scene.push({
    id: "test-launch-block",
    solid: boxSolid(box),
    bounds: boxBounds(box),
  });
  const r = fitEquipment(b, m, launcher, [], env);
  expect(r.status).toBe("NO_CLEARANCE");
  expect(r.reasons.some((s) => s.includes("test-launch-block"))).toBe(true);
});
it("adopts actual mirrored pairs atomically and rejects nonexistent pairs", () => {
  const pair = planEquipmentPreview(b, {
    scope: "PAIR",
    slotId: m.id,
    equipmentId: gun.id,
  });
  expect(pair.results).toHaveLength(2);
  expect(pair.results[0].pose!.yaw + pair.results[1].pose!.yaw).toBeCloseTo(0);
  expect(pair.results.every((r) => r.parts.length > 0)).toBe(true);
  const copy = structuredClone(b);
  copy.hardpoints.find((h) => h.id === pair.results[1].slotId)!.modular!.state =
    "OCCUPIED";
  const rejected = planEquipmentPreview(copy, {
    scope: "PAIR",
    slotId: m.id,
    equipmentId: gun.id,
  });
  expect(rejected.results.every((r) => !r.parts.length)).toBe(true);
  const singleton = b.hardpoints.find(
    (h) => h.modular?.state === "EMPTY" && !h.modular.pairId,
  )!;
  expect(
    planEquipmentPreview(b, {
      scope: "PAIR",
      slotId: singleton.id,
      equipmentId: gun.id,
    }).results[0].status,
  ).toBe("INCOMPATIBLE");
});
it("fits a real battery and preserves canonical JSON and cached deterministic results", () => {
  const h = b.hardpoints.find(
    (h) =>
      h.size === "M" && h.modular?.region === "TOP" && h.modular.batteryGroupId,
  )!;
  const request = {
    scope: "BATTERY" as const,
    slotId: h.id,
    equipmentId: gun.id,
  };
  const a = planEquipmentPreview(b, request),
    c = planEquipmentPreview(b, request);
  expect(a.results.filter((r) => r.parts.length).length).toBeGreaterThanOrEqual(
    3,
  );
  expect(c.cached).toBe(true);
  expect(c.results).toEqual(a.results);
  expect(JSON.stringify(b)).toBe(original);
});

it("refines only real empty paired M slots into a safely spaced three-per-side battery", () => {
  const h = b.hardpoints.find(
    (h) =>
      h.size === "M" && h.modular?.region === "TOP" && h.modular.batteryGroupId,
  )!;
  const p = planEquipmentPreview(b, {
    scope: "BATTERY",
    slotId: h.id,
    equipmentId: gun.id,
    refineBattery: true,
  });
  expect(p.batteryRefinement?.accepted).toBe(true);
  expect(p.results.filter((r) => r.parts.length)).toHaveLength(6);
  expect(p.slotOverrides!.every((h) => h.modular?.state === "EMPTY")).toBe(
    true,
  );
  expect(
    p.slotOverrides!.every(
      (h) =>
        Math.abs(
          h.position.z - b.hardpoints.find((x) => x.id === h.id)!.position.z,
        ) < 80,
    ),
  ).toBe(true);
  const negative = p
    .slotOverrides!.filter((h) => h.position.x < 0)
    .sort((a, c) => a.position.z - c.position.z);
  expect(negative[1].position.z - negative[0].position.z).toBeCloseTo(
    negative[2].position.z - negative[1].position.z,
    5,
  );
  for (const x of p.slotOverrides!)
    for (const y of b.hardpoints.filter(
      (h) =>
        h.modular?.state === "EMPTY" &&
        !p.batteryRefinement!.movedIds.includes(h.id),
    ))
      expect(boxesOverlap(x.modular!.envelope, y.modular!.envelope)).toBe(
        false,
      );
  expect(JSON.stringify(b)).toBe(original);
});

it("refuses an incomplete stored pair and never refines single-slot preview implicitly", () => {
  const clone = structuredClone(b);
  clone.hardpoints = clone.hardpoints.filter(
    (h) => h.id === m.id || h.modular?.pairId !== m.modular?.pairId,
  );
  const p = planEquipmentPreview(clone, {
    scope: "PAIR",
    slotId: m.id,
    equipmentId: gun.id,
  });
  expect(p.results.every((r) => !r.parts.length)).toBe(true);
  const h = b.hardpoints.find(
    (h) =>
      h.size === "M" && h.modular?.region === "TOP" && h.modular.batteryGroupId,
  )!;
  expect(
    planEquipmentPreview(b, {
      scope: "SINGLE",
      slotId: h.id,
      equipmentId: gun.id,
      refineBattery: true,
    }).slotOverrides,
  ).toBeUndefined();
});

it("protects actual non-axial engine exhaust directions as well as nozzle geometry", () => {
  const clone = structuredClone(b),
    f = m.modular!.frame;
  clone.engines = [
    {
      id: "angled-preview-test-engine",
      parentId: m.parentId,
      position: worldPoint(m.position, f, { x: -20, y: 0.3, z: 0 }),
      direction: f.right,
      nozzleRadius: 1,
      nozzleLength: 30,
      bellRatio: 1,
    },
  ];
  const r = fitEquipment(clone, m, gun);
  expect(r.status).toBe("BLOCKED");
  expect(
    r.reasons.some((s) =>
      s.includes("angled-preview-test-engine/directional-exhaust"),
    ),
  ).toBe(true);
});

it("keeps the elevated barrel trunnion fixed and connects body to the rotating base", () => {
  const pivot = gunPivot(gun);
  for (const elevation of gun.elevation)
    expect(posePoint(pivot, 0, elevation, pivot)).toEqual(pivot);
  const parts = equipmentGeometry(m, gun, 0, 70).parts;
  const collar = parts.find((p) => p.id.endsWith("support-collar"))!;
  expect(collar).toBeDefined();
  const base = parts.find((p) => p.id.endsWith("rotation-base"))!,
    body = parts.find((p) => p.id.endsWith("armored-turret"))!;
  expect(collar.bounds.min.y).toBeLessThan(base.bounds.max.y);
  expect(collar.bounds.max.y).toBeGreaterThan(body.bounds.min.y);
});

it('fits a 500mm L module to an actually supported flush XL surface with a physical shim',()=>{
 const copy=structuredClone(b),host=copy.structuralVolumes[0];host.position={x:0,y:0,z:0};
 const station=structuredClone(host.geometry.stations[0]);host.geometry.stations=host.geometry.stations.map((_,i,all)=>({...station,z:-100+i*200/(all.length-1),width:160,height:80}));
 copy.structuralVolumes=[host];copy.structuralConnectors=[];copy.prefabPlacements=[];copy.engines=[];copy.exteriorDetailPlan=undefined;copy.mesoStructurePlan=undefined;copy.designRequirements=undefined;copy.productionDesign!.armor=[];copy.productionDesign!.finish=[];copy.productionDesign!.zones=[];copy.productionDesign!.channels=[];copy.weaponLayout!.mounts=[];
 const env=slotEnvironment(copy),r=surfaceSlot(copy,{x:0,y:0,z:0},'TOP','XL',env);r.slot.mountTypes=['TURRET'];
 const h:Hardpoint={id:'flush-xl',type:'Large Turret',size:'XL',position:r.position,normal:r.slot.frame.normal,parentId:r.parentId,allowedCategories:['TURRET'],radius:r.slot.footprint.width/2,modular:r.slot};
 const fit=fitEquipment(copy,h,PREVIEW_EQUIPMENT.find(e=>e.id==='gun-500')!,[],env);
 expect(['VALID','PARTIAL_ARC']).toContain(fit.status);expect(fit.interfaceOffsetMeters).toBeCloseTo(.25);expect(fit.contacts).toHaveLength(17);
});
