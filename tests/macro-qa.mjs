import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const dir = process.env.MACRO_OUTPUT || "qa/v1.8",
  raw = process.env.MACRO_RAW || "/tmp/shipyard-v18-images";
for (const p of [
  dir,
  raw,
  `${dir}/silhouettes`,
  `${dir}/after`,
  `${dir}/families`,
])
  await mkdir(p, { recursive: true });
const { browser, page, errors } = await renderSession();
const records = [],
  failures = [],
  comparisons = [],
  familyGallery = [],
  determinism = [],
  compatibility = [];
const hash = (s) => createHash("sha256").update(png(s)).digest("hex");
const grammars = [
  "MONOLITHIC",
  "BLOCK_ASSEMBLY",
  "SPINE_AND_MODULES",
  "TRUSS_POD",
  "TWIN_HULL",
  "CORE_AND_NACELLES",
  "STACKED_BLOCKS",
  "HYBRID",
];
try {
  await page.evaluate(async () => {
    const { SilhouetteRenderer } = await import("/src/rendering/silhouette.ts");
    window.macroQA = { renderer: new SilhouetteRenderer(320) };
  });
  const cases = grammars.flatMap((architecture) =>
    Array.from({ length: 20 }, (_, seed) => ({
      yard: "forge",
      architecture,
      seed,
    })),
  );
  cases.push(
    ...["aegis", "vesper", "serein"].flatMap((yard) =>
      Array.from({ length: 20 }, (_, seed) => ({
        yard,
        architecture: "BLOCK_ASSEMBLY",
        seed,
      })),
    ),
  );
  for (const c of cases) {
    const data = await page.evaluate(async (c) => {
      try {
        const q = window.integrationQA,
          order = { ...structuredClone(q.order), shipyardId: c.yard },
          t = performance.now(),
          b = q.generate(order, c.seed, { architecture: c.architecture }),
          generationMs = performance.now() - t;
        const normal = await q.capture(b),
          silhouettes = [];
        for (const view of ["TOP", "SIDE", "FRONT", "ISOMETRIC"])
          silhouettes.push(window.macroQA.renderer.capture(b, view));
        silhouettes.push(window.macroQA.renderer.capture(b, "TOP", "fixed"));
        const extra = [];
        if ([0, 7, 13].includes(c.seed))
          for (const direction of ["top", "side", "front", "rear"])
            extra.push({ direction, ...(await q.capture(b, direction)) });
        return {
          normal,
          silhouettes,
          extra,
          plan: b.macroDesign,
          composition: b.architecture.composition,
          generationMs,
          candidate: b.candidate,
          decisions: b.hullIntegration.decisions,
          volumes: b.structuralVolumes.map((v) => ({
            id: v.id,
            type: v.type,
            position: v.position,
            dimensions: v.dimensions,
          })),
          stats: b.silhouette,
        };
      } catch (e) {
        return { error: String(e) };
      }
    }, c);
    if (data.error) {
      failures.push({ ...c, error: data.error });
      console.log("FAILED", c, data.error);
      continue;
    }
    const key = `${c.yard}-${c.architecture}-${c.seed}`;
    await writeFile(`${raw}/${key}-iso.png`, png(data.normal.pixels));
    for (const f of data.extra)
      await writeFile(`${raw}/${key}-${f.direction}.png`, png(f.pixels));
    for (const f of data.silhouettes)
      await writeFile(
        `${dir}/silhouettes/${key}-${f.view}-${f.scale}.png`,
        png(f.pixels),
      );
    records.push({
      ...c,
      key,
      family: data.plan.family,
      composition: data.composition,
      candidate: data.candidate,
      attempts: data.plan.attempts,
      metrics: data.plan.realized,
      negativeSpaceTargets: data.plan.negativeSpaceTargets,
      volumes: data.volumes,
      generationMs: data.generationMs,
      diagnostics: data.normal.diagnostics,
      decisions: data.decisions,
      silhouettes: data.silhouettes.map(({ pixels, ...f }) => ({
        ...f,
        hash: hash(pixels),
      })),
    });
    if (c.seed === 19)
      console.log(
        `${c.yard}/${c.architecture}: seeds 0–19 rendered in Normal + 4 normalized / fixed TOP silhouettes`,
      );
  }
  const manifest = JSON.parse(
    await readFile(`${dir}/before/manifest.json`, "utf8"),
  );
  for (const row of manifest.result) {
    const key = row.architecture
      ? `${row.yard}-${row.architecture}-${row.seed}`
      : `${row.yard}-${row.seed}`;
    const old = JSON.parse(await readFile(`${dir}/before/${key}.json`, "utf8"));
    const result = await page.evaluate(
      async ({ old, pose }) => {
        const q = window.integrationQA,
          { generateBlueprintV17 } = await import(
            "/src/generation/generate.ts"
          );
        const restored = generateBlueprintV17(old.order, old.seed, {
            architecture: old.architecture.grammar,
          }),
          b = q.generate(old.order, old.seed, {
            architecture: old.architecture.grammar,
          });
        const legacy = await q.capture(old, "iso", pose),
          after = await q.capture(b, "iso", pose),
          pair = [];
        for (const view of ["TOP", "SIDE", "FRONT", "ISOMETRIC"])
          for (const scale of ["normalized", "fixed"])
            pair.push(
              {
                version: "1.7",
                ...window.macroQA.renderer.capture(old, view, scale),
              },
              {
                version: "1.8",
                ...window.macroQA.renderer.capture(b, view, scale),
              },
            );
        return {
          oldExact: JSON.stringify(restored) === JSON.stringify(old),
          legacy,
          after,
          b,
          pair,
        };
      },
      { old, pose: row.pose },
    );
    assert(result.oldExact, `Legacy JSON ${row.yard}/${row.seed}`);
    assert.equal(
      hash(result.legacy.pixels),
      createHash("sha256")
        .update(await readFile(`${dir}/before/${key}.png`))
        .digest("hex"),
    );
    await writeFile(`${dir}/after/${key}.png`, png(result.after.pixels));
    await writeFile(
      `${dir}/after/${key}.json`,
      JSON.stringify(result.b, null, 2),
    );
    for (const f of result.pair)
      await writeFile(
        `${raw}/pair-${key}-${f.version}-${f.view}-${f.scale}.png`,
        png(f.pixels),
      );
    comparisons.push({
      yard: row.yard,
      architecture: old.architecture.grammar,
      seed: row.seed,
      family: result.b.macroDesign.family,
      legacyJsonExact: true,
      legacyPixelExact: true,
      pose: row.pose,
      before: row.diagnostics,
      after: result.after.diagnostics,
      pair: result.pair.map(({ pixels, ...f }) => ({
        ...f,
        hash: hash(pixels),
      })),
    });
  }
  for (const architecture of grammars) {
    const result = await page.evaluate(async (architecture) => {
      const q = window.integrationQA,
        order = { ...q.order, shipyardId: "forge" },
        first = q.generate(order, 7, { architecture }),
        shot = await q.capture(first),
        sil = window.macroQA.renderer.capture(first, "TOP"),
        checks = [];
      for (let i = 0; i < 10; i++) {
        const b = q.generate(order, 7, { architecture });
        checks.push({
          json: JSON.stringify(b) === JSON.stringify(first),
          normal: (await q.capture(b)).pixels === shot.pixels,
          silhouette:
            window.macroQA.renderer.capture(b, "TOP").pixels === sil.pixels,
        });
      }
      return checks;
    }, architecture);
    assert(result.every((c) => c.json && c.normal && c.silhouette));
    determinism.push({ architecture, seed: 7, repeats: result });
  }
  for (const [family, architecture] of [
    ["WEDGE_CITADEL", "MONOLITHIC"],
    ["HAMMERHEAD", "BLOCK_ASSEMBLY"],
    ["WIDE_CARRIER", "BLOCK_ASSEMBLY"],
    ["ENGINE_DOMINANT", "CORE_AND_NACELLES"],
    ["SPLIT_FRAME", "TRUSS_POD"],
    ["WEAPON_DOMINANT", "SPINE_AND_MODULES"],
  ]) {
    const data = await page.evaluate(
      async ({ family, architecture }) => {
        const q = window.integrationQA,
          order = {
            ...q.order,
            shipyardId: family === "WEDGE_CITADEL" ? "serein" : "forge",
            ...(family === "WEAPON_DOMINANT"
              ? {
                  role: "Spinal Gun Ship",
                  priorities: { ...q.order.priorities, firepower: 100 },
                }
              : {}),
          },
          b = q.generate(order, 7, { architecture, family }),
          normal = await q.capture(b),
          shots = [];
        for (const view of ["TOP", "SIDE", "FRONT", "ISOMETRIC"])
          shots.push(window.macroQA.renderer.capture(b, view));
        shots.push(
          window.macroQA.renderer.capture(b, "ISOMETRIC", "normalized", true),
        );
        return { b, normal, shots };
      },
      { family, architecture },
    );
    await writeFile(
      `${dir}/families/${family}.json`,
      JSON.stringify(data.b, null, 2),
    );
    await writeFile(
      `${raw}/family-${family}-normal.png`,
      png(data.normal.pixels),
    );
    for (const [i, f] of data.shots.entries())
      await writeFile(
        `${raw}/family-${family}-${i === 4 ? "MASS" : f.view}.png`,
        png(f.pixels),
      );
    familyGallery.push({
      family,
      architecture,
      plan: data.b.macroDesign,
      diagnostics: data.normal.diagnostics,
    });
  }
  for (const path of [
    "qa/v0/export.blueprint.json",
    "qa/v1/export.blueprint.json",
    "qa/v1.5/regression/export.blueprint.json",
    "qa/v1.7/before/forge-0.json",
    "qa/v1.7/regression/export.blueprint.json",
  ]) {
    const b = JSON.parse(await readFile(path, "utf8"));
    const shot = await page.evaluate(
      async (b) => await window.integrationQA.capture(b),
      b,
    );
    assert(shot.diagnostics.geometryFinite);
    compatibility.push({
      path,
      diagnostics: shot.diagnostics,
      hash: hash(shot.pixels),
    });
  }
  const shipyardForced = [];
  for (const yard of ["aegis", "vesper", "forge", "serein"]) {
    const result = await page.evaluate(async (yard) => {
      const q = window.integrationQA,
        b = q.generate({ ...q.order, shipyardId: yard }, 7, {
          architecture: "BLOCK_ASSEMBLY",
          family: "HAMMERHEAD",
        });
      const neutral = structuredClone(b);
      Object.assign(neutral.materialTheme, {
        hull: "#a5adb7",
        secondary: "#8f9ca6",
        accent: "#a5adb7",
      });
      const normal = await q.capture(neutral),
        top = window.macroQA.renderer.capture(b, "TOP");
      const debug = [];
      for (const mode of ["Integration", "Armor", "Equipment"])
        debug.push({ mode, ...(await q.capture(b, "iso", undefined, mode)) });
      return { normal, top, debug, metrics: b.macroDesign.realized };
    }, yard);
    await writeFile(`${raw}/neutral-${yard}.png`, png(result.normal.pixels));
    await writeFile(`${raw}/forced-${yard}-TOP.png`, png(result.top.pixels));
    for (const d of result.debug)
      await writeFile(`${raw}/debug-${yard}-${d.mode}.png`, png(d.pixels));
    shipyardForced.push({
      yard,
      seed: 7,
      family: "HAMMERHEAD",
      metrics: result.metrics,
    });
  }
  const benchmarks = await page.evaluate(() => {
    const q = window.integrationQA,
      result = [];
    for (const yard of ["aegis", "vesper", "forge", "serein"])
      for (let seed = 0; seed < 25; seed++)
        for (const version of ["1.7", "1.8"]) {
          const t = performance.now();
          q.generate({ ...q.order, shipyardId: yard }, seed, {
            architecture: "BLOCK_ASSEMBLY",
            ...(version === "1.7" ? { version } : {}),
          });
          if (seed >= 5)
            result.push({ yard, seed, version, ms: performance.now() - t });
        }
    return result;
  });
  await writeFile(
    `${dir}/render-report.json`,
    JSON.stringify(
      {
        version: "1.8",
        baselineCommit: manifest.commit,
        renderer: "Chromium ANGLE SwiftShader",
        resolution: { normal: [960, 620], silhouette: [320, 320] },
        records,
        failures,
        comparisons,
        familyGallery,
        determinism,
        compatibility,
        benchmarks,
        shipyardForced,
        errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  assert.equal(records.length, 220);
  assert.equal(failures.length, 0);
  console.log(
    `PASS ${records.length} actual designs, ${records.length * 5} orthographic silhouettes, 15 immutable comparisons, 80 JSON / Normal / silhouette repeats, errors 0`,
  );
} finally {
  await browser.close();
}
