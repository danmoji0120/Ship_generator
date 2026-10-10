import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = "qa/v1.8.5.4/controls";
await mkdir(out, { recursive: true });
const source = JSON.parse(
    await readFile("qa/v1.8.5.4/before/stacked-blocks.json", "utf8"),
  ),
  large = JSON.parse(
    await readFile("qa/v1.8.5.4/before/large-blocks.json", "utf8"),
  );
const { browser, page, errors } = await renderSession();
try {
  const densities = [];
  for (const density of ["SPARSE", "STANDARD", "DENSE"]) {
    const r = await page.evaluate(
      async ({ source, density }) => {
        const { addModularHardpoints, normalizeHardpointOrder } =
            await import("/src/generation/hardpoint-system/planner.ts"),
          { validateModularHardpoints } =
            await import("/src/generation/hardpoint-system/validate.ts");
        const b = structuredClone(source);
        b.order.hardpointDensity = density;
        normalizeHardpointOrder(b.order);
        let t = performance.now();
        addModularHardpoints(b);
        const planningMs = performance.now() - t;
        t = performance.now();
        const issues = validateModularHardpoints(b);
        const validationMs = performance.now() - t;
        const copy = structuredClone(source);
        copy.order.hardpointDensity = density;
        normalizeHardpointOrder(copy.order);
        addModularHardpoints(copy);
        const deterministic = JSON.stringify(b) === JSON.stringify(copy);
        const f = await window.integrationQA.capture(
          b,
          "iso",
          undefined,
          "Hardpoints",
        );
        return {
          density,
          summary: b.modularHardpoints.summary,
          planningMs,
          validationMs,
          issues,
          deterministic,
          pixels: f.pixels,
        };
      },
      { source, density },
    );
    assert.deepEqual(r.issues, []);
    assert(r.deterministic);
    await writeFile(`${out}/${density}.png`, png(r.pixels));
    delete r.pixels;
    densities.push(r);
  }
  assert(
    densities[0].summary.total < densities[1].summary.total &&
      densities[1].summary.total < densities[2].summary.total,
  );
  await writeFile(`${out}/density.json`, JSON.stringify(densities, null, 2));
  const requirement = await page.evaluate(
    async ({ source, large }) => {
      const { addModularHardpoints, normalizeHardpointOrder } =
          await import("/src/generation/hardpoint-system/planner.ts"),
        { validateModularHardpoints } =
          await import("/src/generation/hardpoint-system/validate.ts");
      const b = structuredClone(source);
      b.order.hardpointRequests = [
        {
          id: "utility-top",
          type: "UTILITY",
          size: "S",
          count: 4,
          mandatory: true,
          priority: 90,
          region: "TOP",
        },
        {
          id: "four-spinal",
          type: "SPINAL",
          size: "XL",
          count: 4,
          mandatory: false,
          priority: 80,
        },
      ];
      normalizeHardpointOrder(b.order);
      addModularHardpoints(b);
      const report = {
        requests: b.modularHardpoints.requests,
        issues: validateModularHardpoints(b),
      };
      const xl = structuredClone(large);
      xl.order.hardpointRequests = [
        {
          id: "surface-xl",
          type: "TURRET",
          size: "XL",
          count: 1,
          mandatory: false,
          priority: 100,
        },
      ];
      normalizeHardpointOrder(xl.order);
      addModularHardpoints(xl);
      report.surfaceXL = {
        requests: xl.modularHardpoints.requests,
        issues: validateModularHardpoints(xl),
        count: xl.hardpoints.filter((h) => h.size === "XL").length,
        diagnostics: xl.modularHardpoints.diagnostics,
      };
      const fail = structuredClone(source);
      fail.order.hardpointRequests = [
        {
          id: "impossible",
          type: "SPINAL",
          size: "XL",
          count: 4,
          mandatory: true,
          priority: 100,
        },
      ];
      normalizeHardpointOrder(fail.order);
      try {
        addModularHardpoints(fail);
        report.rejection = null;
      } catch (e) {
        report.rejection = { name: e.name, codes: e.codes, message: e.message };
      }
      return report;
    },
    { source, large },
  );
  assert.deepEqual(requirement.issues, []);
  assert.deepEqual(requirement.surfaceXL.issues, []);
  assert(
    requirement.rejection.codes.includes(
      "REQUIRED_HARDPOINT_CAPACITY_UNAVAILABLE",
    ),
  );
  await writeFile(
    `${out}/requirements.json`,
    JSON.stringify(requirement, null, 2),
  );
  // Limited side / underside views of two representatives; no additional generation.
  for (const id of ["stacked-blocks", "large-blocks"]) {
    const b = JSON.parse(await readFile(`qa/v1.8.5.4/after/${id}.json`,"utf8"));
    for (const view of ["side", "underside"]) {
      const f = await page.evaluate(async({b,view}) => {
        const q = window.integrationQA;
        const initial = await q.capture(b,"iso",undefined,"Hardpoints");
        const t = initial.pose.target, length = b.order.length;
        const position = view === "side" ? [t[0]+length*1.7,t[1],t[2]] :
          [t[0]+length*.35,t[1]-length*1.7,t[2]+length*.65];
        return q.capture(b,"iso",{...initial.pose,target:t,position},"Hardpoints");
      },{b,view});
      await writeFile(`${out}/${id}-${view}.png`,png(f.pixels));
    }
  }
  // Verify the actual shared viewer's instanced-marker hit test, without requiring DEV hooks in Production.
  const pick = await page.evaluate(async (source) => {
    const { addModularHardpoints, normalizeHardpointOrder } =
        await import("/src/generation/hardpoint-system/planner.ts"),
      THREE = await import("/node_modules/.vite/deps/three.js");
    const b = structuredClone(source);
    normalizeHardpointOrder(b.order);
    addModularHardpoints(b);
    const viewer = window.integrationQA.viewer;
    viewer.onHardpointSelect = (id) => (window.selectedMarker = id);
    await window.integrationQA.capture(b, "iso", undefined, "Hardpoints");
    const h = b.hardpoints.find((h) => h.modular.state === "EMPTY"),
      p = new THREE.Vector3(h.position.x, h.position.y, h.position.z).project(
        viewer.camera,
      ),
      r = viewer.renderer.domElement.getBoundingClientRect();
    return {
      x: r.x + ((p.x + 1) * r.width) / 2,
      y: r.y + ((1 - p.y) * r.height) / 2,
      ids: b.hardpoints.map((h) => h.id),
    };
  }, source);
  await page.mouse.click(pick.x, pick.y);
  const selected = await page.evaluate(() => window.selectedMarker);
  assert(pick.ids.includes(selected));
  await writeFile(
    `${out}/marker-pick.json`,
    JSON.stringify({
      selected,
      method:
        "Actual canvas pointer -> Three.js instance raycast -> ShipViewer callback",
    }),
  );
  await writeFile(`${out}/console.json`, JSON.stringify(errors));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      densities: densities.map((d) => [d.density, d.summary.total]),
      requirements: requirement.requests.map((r) => [
        r.request.id,
        r.status,
        r.missing,
      ]),
      surfaceXL: requirement.surfaceXL.count,
      selected,
    }),
  );
} finally {
  await browser.close();
}
