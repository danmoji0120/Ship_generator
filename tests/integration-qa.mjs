import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const dir = process.env.INTEGRATION_OUTPUT || "qa/v1.8/legacy-integration";
const raw = process.env.INTEGRATION_RAW || "/tmp/shipyard-v17-regression-images";
await mkdir(raw, { recursive: true });
await mkdir(dir, { recursive: true });
const { browser, page, errors } = await renderSession();
// This historical regression command explicitly exercises the immutable V1.7 pipeline.
await page.evaluate(async () => {
  const { generateBlueprint } = await import("/src/generation/generate.ts");
  window.integrationQA.generate = (order, seed, options) => generateBlueprint(order, seed, { ...options, version: options?.version ?? "1.7" });
});
const records = [],
  comparisons = [],
  benchmarks = [];
const hash = (v) => createHash("sha256").update(v).digest("hex");
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
const directions = ["iso", "top", "side", "front", "rear"];
try {
  for (const grammar of grammars)
    for (let seed = 0; seed < 20; seed++) {
      const data = await page.evaluate(
        async ({ grammar, seed, directions }) => {
          const q = window.integrationQA,
            order = { ...structuredClone(q.order), shipyardId: "forge" };
          const start = performance.now(),
            b = q.generate(order, seed, { architecture: grammar }),
            generationMs = performance.now() - start;
          const frames = [];
          for (const direction of directions) {
            const t = performance.now(),
              frame = await q.capture(b, direction);
            frames.push({
              ...frame,
              direction,
              elapsedMs: performance.now() - t,
            });
          }
          return { b, generationMs, frames };
        },
        { grammar, seed, directions },
      );
      for (const frame of data.frames) {
        if (frame.direction === "iso" || [0, 7, 13].includes(seed))
          await writeFile(
            `${raw}/forge-${grammar}-${seed}-${frame.direction}.png`,
            png(frame.pixels),
          );
      }
      records.push({
        yard: "forge",
        grammar,
        seed,
        composition: data.b.architecture.composition,
        version: data.b.generatorVersion,
        generationMs: data.generationMs,
        exteriorCount: data.b.prefabPlacements.filter((p) => p.exterior).length,
        decisions: data.b.hullIntegration.decisions,
        frames: data.frames.map((f) => ({
          direction: f.direction,
          hash: hash(png(f.pixels)),
          elapsedMs: f.elapsedMs,
          diagnostics: f.diagnostics,
        })),
      });
      if (seed === 19) console.log(`${grammar}: 20 seeds × 5 views rendered`);
    }
  // Identical architecture, order and seed range across the other three yards.
  for (const yard of ["aegis", "vesper", "serein"])
    for (let seed = 0; seed < 20; seed++) {
      const data = await page.evaluate(
        async ({ yard, seed, directions }) => {
          const q = window.integrationQA,
            b = q.generate(
              { ...structuredClone(q.order), shipyardId: yard },
              seed,
              { architecture: "BLOCK_ASSEMBLY" },
            );
          const frames = [];
          for (const direction of directions)
            frames.push({ ...(await q.capture(b, direction)), direction });
          return { b, frames };
        },
        { yard, seed, directions },
      );
      for (const f of data.frames)
        if (f.direction === "iso" || [0, 7, 13].includes(seed))
          await writeFile(
            `${raw}/${yard}-BLOCK_ASSEMBLY-${seed}-${f.direction}.png`,
            png(f.pixels),
          );
      records.push({
        yard,
        grammar: "BLOCK_ASSEMBLY",
        seed,
        composition: data.b.architecture.composition,
        exteriorCount: data.b.prefabPlacements.filter((p) => p.exterior).length,
        decisions: data.b.hullIntegration.decisions,
        frames: data.frames.map((f) => ({
          direction: f.direction,
          hash: hash(png(f.pixels)),
          diagnostics: f.diagnostics,
        })),
      });
      if (seed === 19)
        console.log(`${yard}: 20 identical-order seeds × 5 views rendered`);
    }
  const manifest = JSON.parse(
    await readFile(`qa/v1.7/before/manifest.json`, "utf8"),
  );
  await mkdir(`${dir}/after`, { recursive: true });
  for (const row of manifest.result) {
    const old = JSON.parse(
      await readFile(`qa/v1.7/before/${row.yard}-${row.seed}.json`, "utf8"),
    );
    const originalPng = await readFile(
      `qa/v1.7/before/${row.yard}-${row.seed}.png`,
    );
    const data = await page.evaluate(
      async ({ old, pose }) => {
        const q = window.integrationQA,
          { generateBlueprintV16 } =
            await import("/src/generation/generate.ts");
        const regenerated = generateBlueprintV16(old.order, old.seed, {
            architecture: "BLOCK_ASSEMBLY",
          }),
          b = q.generate(old.order, old.seed, {
            architecture: "BLOCK_ASSEMBLY",
          });
        const legacy = await q.capture(old, "iso", pose),
          after = await q.capture(b, "iso", pose);
        const repeated = [];
        for (let i = 0; i < 10; i++) {
          const next = q.generate(old.order, old.seed, {
            architecture: "BLOCK_ASSEMBLY",
          });
          repeated.push({
            json: JSON.stringify(next) === JSON.stringify(b),
            pixels:
              (await q.capture(next, "iso", pose)).pixels === after.pixels,
          });
        }
        const debug = [];
        if (old.seed === 0)
          for (const mode of ["Integration", "Armor", "Equipment"])
            debug.push({ mode, ...(await q.capture(b, "iso", pose, mode)) });
        return {
          legacy,
          after,
          repeated,
          debug,
          oldExact: JSON.stringify(regenerated) === JSON.stringify(old),
          b,
        };
      },
      { old, pose: row.pose },
    );
    assert.equal(data.oldExact, true);
    assert.equal(
      hash(originalPng),
      hash(png(data.legacy.pixels)),
      "Legacy V1.6 WebGL pixels changed",
    );
    assert(data.repeated.every((r) => r.json && r.pixels));
    await writeFile(
      `${dir}/after/${row.yard}-${row.seed}.png`,
      png(data.after.pixels),
    );
    for (const shot of data.debug)
      await writeFile(
        `${raw}/debug-${row.yard}-${shot.mode}.png`,
        png(shot.pixels),
      );
    comparisons.push({
      yard: row.yard,
      seed: row.seed,
      legacyPixelIdentical: true,
      tenJsonAndPixelRegenerations: true,
      pose: row.pose,
      before: row.diagnostics,
      after: data.after.diagnostics,
      exteriorBounds: data.b.hullIntegration.exteriorBounds,
      overallBounds: data.b.hullIntegration.overallBounds,
    });
    console.log(
      `Paired ${row.yard}/${row.seed}: old JSON/pixels compatible, 10 repeats deterministic`,
    );
  }
  // Warm CPU measurements isolate generation from the RAF/screenshot overhead; alternate versions.
  const perf = await page.evaluate(() => {
    const q = window.integrationQA,
      result = [];
    for (const yard of ["aegis", "vesper", "forge", "serein"]) {
      const order = { ...structuredClone(q.order), shipyardId: yard };
      for (let seed = 0; seed < 25; seed++) {
        for (const version of ["1.6", "1.7"]) {
          const t = performance.now();
          q.generate(order, seed, {
            architecture: "BLOCK_ASSEMBLY",
            ...(version === "1.6" ? { version } : {}),
          });
          const ms = performance.now() - t;
          if (seed >= 5) result.push({ yard, version, seed, ms });
        }
      }
    }
    return result;
  });
  benchmarks.push(...perf);
  // Shape, Join, Bow/Stern and Armor QA pages actually render their image grids.
  const gallery = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
  });
  gallery.on("pageerror", (e) => errors.push(e.message));
  gallery.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await gallery.goto(
    (process.env.QA_URL || "http://localhost:5173") + "/qa.html",
  );
  await gallery.waitForFunction(() => window.shipyardGallery?.ready);
  const galleryResults = [];
  for (const mode of ["shapes", "joins", "bow", "integration"]) {
    await gallery.evaluate(() => (window.shipyardGallery.ready = false));
    await gallery.click(`#${mode}`);
    await gallery.waitForFunction(() => window.shipyardGallery?.ready);
    const g = await gallery.evaluate(() => ({
      mode: window.shipyardGallery.mode,
      error: window.shipyardGallery.error,
      count: document.querySelectorAll("#grid img").length,
    }));
    assert.equal(g.error, undefined);
    assert.equal(g.count, mode === "shapes" ? 11 : mode === "joins" ? 10 : 20);
    galleryResults.push(g);
    await gallery.screenshot({
      path: `${dir}/${mode}-gallery-page.png`,
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/render-report.json`,
    JSON.stringify(
      {
        generatorVersion: "1.7",
        baselineCommit: manifest.commit,
        renderer: "Chromium / ANGLE SwiftShader",
        records,
        comparisons,
        benchmarks,
        galleryResults,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS: ${records.length} designs / ${records.length * 5} orientation renders; 12 paired comparisons, 120 JSON and pixel repeats; browser errors 0`,
  );
} finally {
  await browser.close();
}
