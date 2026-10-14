import assert from "node:assert/strict";
import { renderSession } from "./helpers/render-session.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const { browser, page, errors } = await renderSession();
try {
  const rows = [];
  for (const id of ["aegis470", "vesper200", "forge300"]) {
    const b = JSON.parse(
      await readFile(`qa/v1.8.6.0/before/${id}.json`, "utf8"),
    );
    const row = await page.evaluate(async (b) => {
      const { generateBlueprint } = await import("/src/generation/generate.ts");
      const options = {
          architecture: b.architecture.grammar,
          family: b.macroDesign.family,
        },
        t = performance.now(),
        old = generateBlueprint(b.order, b.seed, {
          ...options,
          version: "1.8.5.5",
        }),
        beforeMs = performance.now() - t;
      let start = performance.now(),
        first = generateBlueprint(b.order, b.seed, options),
        firstMs = performance.now() - start;
      start = performance.now();
      const repeated = generateBlueprint(b.order, b.seed, options),
        repeatedMs = performance.now() - start;
      return {
        beforeMs,
        firstMs,
        repeatedMs,
        deterministic: JSON.stringify(first) === JSON.stringify(repeated),
        surfaces: first.physicalDesign.surfaces.length,
        pieces: first.physicalDesign.surfaces.reduce(
          (n, s) => n + s.pieces.length,
          0,
        ),
      };
    }, b);
    assert(row.deterministic);
    rows.push({ id, ...row });
    console.log(id, row);
  }
  assert.deepEqual(errors, []);
  await mkdir("qa/v1.8.6.0/performance", { recursive: true });
  await writeFile(
    "qa/v1.8.6.0/performance/report.json",
    JSON.stringify({ rows, errors }, null, 2),
  );
} finally {
  await browser.close();
}
