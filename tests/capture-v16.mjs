import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, writeFile, access } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "qa/v1.7/before";
try {
  await access(`${dir}/manifest.json`);
  throw new Error(
    "Baseline already exists; choose another archive path rather than overwrite it",
  );
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
await mkdir(dir, { recursive: true });
const { browser, page, errors } = await renderSession();
const result = [];
try {
  for (const yard of ["aegis", "vesper", "forge", "serein"])
    for (const seed of [0, 7, 13]) {
      const b = await page.evaluate(
        ({ yard, seed }) =>
          window.integrationQA.generate(
            {
              ...structuredClone(window.integrationQA.order),
              shipyardId: yard,
            },
            seed,
            { architecture: "BLOCK_ASSEMBLY", version: "1.6" },
          ),
        { yard, seed },
      );
      const shot = await page.evaluate(
        async (b) => window.integrationQA.capture(b),
        b,
      );
      await writeFile(`${dir}/${yard}-${seed}.png`, png(shot.pixels));
      await writeFile(
        `${dir}/${yard}-${seed}.json`,
        JSON.stringify(b, null, 2),
      );
      result.push({
        yard,
        seed,
        pose: shot.pose,
        diagnostics: shot.diagnostics,
      });
    }
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/manifest.json`,
    JSON.stringify(
      {
        commit: "f2b77fa8f34f5f1351971b22d192af010b83a412",
        generatorVersion: "1.6",
        errors,
        result,
      },
      null,
      2,
    ),
  );
  console.log("12 V1.6 actual Block snapshots / poses / JSON saved");
} finally {
  await browser.close();
}
