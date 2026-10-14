import { chromium } from "playwright-core";
import { gunzipSync } from "node:zlib";
import { renderSession, png } from "./helpers/render-session.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const out = "qa/v1.8.6.0/controls";
await mkdir(out, { recursive: true });
const source = JSON.parse(
  await readFile("qa/v1.8.6.0/before/aegis470.json", "utf8"),
);
const variants = [
  ["ARMOR_FIRST", "survivability"],
  ["MOBILITY_FIRST", "mobility"],
  ["FIREPOWER_FIRST", "firepower"],
  ["ENDURANCE_FIRST", "endurance"],
  ["BALANCED", null],
  ["MISSILES_FIRST", "missile"],
  ["SENSORS_FIRST", "sensor"],
  ["ALL_HIGH", "all"],
];
async function probeSession() {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  // Stored-cell queries need modules, not an unrelated generated ship or render loop.
  await page.route("**/src/main.ts*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "export {};",
    }),
  );
  await page.goto(process.env.QA_URL || "http://localhost:5173", {
    timeout: 120000,
  });
  return { browser, page, errors };
}
const { browser, page, errors } = await (process.env.PROBE_ONLY
  ? probeSession()
  : renderSession());
try {
  const rows = process.env.PROBE_ONLY
    ? JSON.parse(await readFile(`${out}/comparison.json`, "utf8"))
    : [];
  for (const [name, priority] of process.env.PROBE_ONLY ? [] : variants) {
    const r = await page.evaluate(
      async ({ source, name, priority }) => {
        const { addPhysicalDesign } = await import("/src/physical/build.ts"),
          { validatePhysicalDesign } = await import(
            "/src/physical/validate.ts"
          ),
          { sampledHullArmorCoverage } = await import(
            "/tests/helpers/physical-coverage.ts"
          );
        const b = structuredClone(source);
        b.order.targetDryMassKg = source.dimensions.estimatedMass * 1000;
        b.order.priorities = Object.fromEntries(
          Object.keys(source.order.priorities).map((k) => [
            k,
            priority === "all" ? 100 : 50,
          ]),
        );
        if (priority && priority !== "all") b.order.priorities[priority] = 100;
        let t = performance.now();
        addPhysicalDesign(b);
        const planningMs = performance.now() - t,
          issues = validatePhysicalDesign(b),
          d = b.physicalDesign,
          coverage = sampledHullArmorCoverage(b),
          frames = [];
        if (
          [
            "ARMOR_FIRST",
            "MOBILITY_FIRST",
            "BALANCED",
            "FIREPOWER_FIRST",
            "ENDURANCE_FIRST",
          ].includes(name)
        )
          for (const mode of ["Armor Thickness", "Physical Materials"])
            frames.push({
              mode,
              ...(await window.integrationQA.capture(
                b,
                "iso",
                undefined,
                mode,
              )),
            });
        const range = (kind) => {
          const surfaces = d.surfaces.filter((s) => s.kind === kind),
            weights = surfaces.map((s) => s.physicalOuterAreaM2),
            sum = weights.reduce((n, a) => n + a, 0);
          return {
            minMm: Math.min(...surfaces.map((s) => s.minimumFacetThicknessMm)),
            maxMm: Math.max(...surfaces.map((s) => s.maximumFacetThicknessMm)),
            areaWeightedNominalMm: sum
              ? surfaces.reduce(
                  (n, s) => n + s.thicknessMm * s.physicalOuterAreaM2,
                  0,
                ) / sum
              : 0,
            materials: [...new Set(surfaces.map((s) => s.materialId))],
          };
        };
        return {
          name,
          planningMs,
          issues,
          mass: d.mass,
          armor: range("ARMOR"),
          hull: range("HULL"),
          policy: d.policy,
          coverage,
          sourceAreaRetention: d.coverage,
          frames,
        };
      },
      { source, name, priority },
    );
    for (const f of r.frames)
      await writeFile(
        `${out}/${name}-${f.mode.replaceAll(" ", "-")}.png`,
        png(f.pixels),
      );
    delete r.frames;
    rows.push(r);
    assert.deepEqual(r.issues, []);
    console.log(
      name,
      Math.round(r.mass.armorMassKg / 1000) + "t armor",
      Math.round(r.planningMs) + "ms",
    );
    await writeFile(`${out}/comparison.json`, JSON.stringify(rows, null, 2));
  }
  const a = rows.find((r) => r.name === "ARMOR_FIRST"),
    m = rows.find((r) => r.name === "MOBILITY_FIRST");
  assert(a.mass.armorMassKg > m.mass.armorMassKg);
  assert(a.mass.totalEstimatedDryMassKg <= a.mass.targetMassKg);
  assert(m.mass.totalEstimatedDryMassKg <= m.mass.targetMassKg);
  const yard = await page.evaluate(async (source) => {
    const { physicalSources } = await import("/src/physical/geometry.ts"),
      { createDesignPolicy } = await import("/src/physical/policy.ts");
    return ["aegis", "vesper", "forge", "serein"].map((shipyardId) => {
      const b = { ...source, shipyardId };
      const p = createDesignPolicy(b, physicalSources(b));
      return {
        shipyardId,
        hull: p.hullMaterialPreference,
        armor: p.armorMaterialPreference,
        critical: p.criticalArmorMaterialPreference,
        tech: p.manufacturingTechPreference,
      };
    });
  }, source);
  await writeFile(`${out}/yard-policy.json`, JSON.stringify(yard, null, 2));
  // Re-probe frozen representative geometry after query changes; no ship regeneration.
  for (const id of ["aegis470", "vesper200", "forge300"]) {
    const saved = JSON.parse(
      gunzipSync(await readFile(`qa/v1.8.6.0/after/${id}.json.gz`)).toString(),
    );
    const probe = await page.evaluate(async (text) => {
      const b = JSON.parse(text);
      const { armorRayProbe } = await import("/src/physical/probe.ts");
      return armorRayProbe(
        b,
        { x: 0, y: b.order.length * 2, z: 0 },
        { x: 0, y: -1, z: 0 },
        b.order.length * 4,
      );
    }, JSON.stringify(saved));
    assert(probe.valid);
    if (id === "aegis470")
      assert.equal(
        probe.hits.filter((h) => h.shellId).length,
        2,
        "station-boundary ray retains both finite Hull skins",
      );
    await writeFile(
      `qa/v1.8.6.0/after/${id}-probe.json`,
      JSON.stringify(probe, null, 2),
    );
    console.log(id, "probe intervals", probe.hits.length);
  }
  await writeFile(`${out}/console.json`, JSON.stringify(errors));
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
