import { renderSession, png } from "./helpers/render-session.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const { browser, page, errors } = await renderSession();
const result = [];
try {
  for (const architecture of [
    "MONOLITHIC",
    "BLOCK_ASSEMBLY",
    "SPINE_AND_MODULES",
    "TRUSS_POD",
    "TWIN_HULL",
    "CORE_AND_NACELLES",
    "STACKED_BLOCKS",
    "HYBRID",
  ]) {
    const r = await page.evaluate(async (architecture) => {
      const q = window.integrationQA,
        b = q.generate(q.order, 7, { architecture }),
        shot = await q.capture(b),
        json = JSON.stringify(b);
      let identical = true;
      for (let i = 0; i < 10; i++) {
        const next = q.generate(q.order, 7, { architecture }),
          image = await q.capture(next, "iso", shot.pose);
        identical &&=
          JSON.stringify(next) === json && image.pixels === shot.pixels;
      }
      return {
        architecture,
        seed: 7,
        identical,
        diagnostics: shot.diagnostics,
      };
    }, architecture);
    assert.equal(r.identical, true);
    result.push(r);
  }
  const prior = JSON.parse(
    await readFile("qa/v1.7/render-report.json", "utf8"),
  );
  const { createHash } = await import("node:crypto");
  for (const row of prior.records.filter(
    (r) => r.yard === "forge" && r.seed === 7,
  )) {
    const shot = await page.evaluate(async (row) => {
      const q = window.integrationQA,
        b = q.generate(
          { ...structuredClone(q.order), shipyardId: row.yard },
          row.seed,
          { architecture: row.grammar },
        );
      return q.capture(b);
    }, row);
    assert.equal(
      createHash("sha256").update(png(shot.pixels)).digest("hex"),
      row.frames.find((f) => f.direction === "iso").hash,
      "Final phase extraction changed a verified render",
    );
  }
  for (const version of ["v0", "v1", "v1.5"]) {
    const path =
        version === "v1.5"
          ? "qa/v1.5/regression/export.blueprint.json"
          : `qa/${version}/export.blueprint.json`,
      b = JSON.parse(await readFile(path, "utf8"));
    const shot = await page.evaluate(
      async (b) => window.integrationQA.capture(b),
      b,
    );
    assert.equal(shot.diagnostics.geometryFinite, true);
    await writeFile(`qa/v1.7/compatibility-${version}.png`, png(shot.pixels));
  }
  // Aft view of identical legacy JSON and the fixed result exposes the overlapping bell issue and its correction.
  for (const yard of ["aegis", "forge"]) {
    const b = JSON.parse(
      await readFile(`qa/v1.7/before/${yard}-0.json`, "utf8"),
    );
    const pair = await page.evaluate(async (b) => {
      const q = window.integrationQA,
        a = q.generate(b.order, b.seed, { architecture: "BLOCK_ASSEMBLY" }),
        old = await q.capture(b, "rear");
      return [old, await q.capture(a, "rear", old.pose)];
    }, b);
    for (const [i, shot] of pair.entries())
      await writeFile(
        `qa/v1.7/engine-clearance-${yard}-${i ? "after" : "before"}.png`,
        png(shot.pixels),
      );
  }
  const neutral = [];
  for (const yard of ["aegis", "vesper", "forge", "serein"]) {
    const shot = await page.evaluate(async (yard) => {
      const q = window.integrationQA,
        b = q.generate({ ...structuredClone(q.order), shipyardId: yard }, 7, {
          architecture: "BLOCK_ASSEMBLY",
        });
      b.materialTheme.hull = "#a5adb7";
      b.materialTheme.secondary = "#8f9ca6";
      b.materialTheme.accent = "#a5adb7";
      return q.capture(b);
    }, yard);
    await writeFile(`qa/v1.7/neutral-${yard}.png`, png(shot.pixels));
    neutral.push(yard);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    "qa/v1.7/final-render-check.json",
    JSON.stringify(
      {
        sameSeedWebGL: result,
        legacyJsonRendered: ["V0", "V1", "V1.5"],
        neutralShipyardComparison: neutral,
        contactSheetPixelsStillIdentical: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: all 8 architectures × 10 pixel-identical regenerations; actual historical JSON rendered; console errors 0",
  );
} finally {
  await browser.close();
}
