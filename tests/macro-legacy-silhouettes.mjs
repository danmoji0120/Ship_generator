import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { browser, page, errors } = await renderSession();
const records = [];
await mkdir("qa/v1.8/v17-silhouettes", { recursive: true });
try {
  await page.evaluate(async () => {
    const { SilhouetteRenderer } = await import("/src/rendering/silhouette.ts");
    window.legacySilhouette = new SilhouetteRenderer(320);
  });
  for (const architecture of ["MONOLITHIC", "BLOCK_ASSEMBLY"])
    for (let seed = 0; seed < 20; seed++) {
      const data = await page.evaluate(
        async ({ architecture, seed }) => {
          const q = window.integrationQA,
            b = q.generate({ ...q.order, shipyardId: "forge" }, seed, {
              architecture,
              version: "1.7",
            }),
            frames = [];
          for (const view of ["TOP", "SIDE", "FRONT", "ISOMETRIC"])
            frames.push(window.legacySilhouette.capture(b, view));
          return { frames, composition: b.architecture.composition };
        },
        { architecture, seed },
      );
      for (const f of data.frames)
        await writeFile(
          `qa/v1.8/v17-silhouettes/forge-${architecture}-${seed}-${f.view}-normalized.png`,
          png(f.pixels),
        );
      records.push({ architecture, seed, composition: data.composition });
    }
  assert.deepEqual(errors, []);
  await writeFile(
    "qa/v1.8/v17-silhouette-report.json",
    JSON.stringify(
      {
        version: "1.7",
        renderer:
          "same Chromium ANGLE SwiftShader / orthographic 320px / normalized",
        records,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "40 archived V1.7 recipes, 160 actual black-geometry silhouettes saved for direct diversity comparison",
  );
} finally {
  await browser.close();
}
