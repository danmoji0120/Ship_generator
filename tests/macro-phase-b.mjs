import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const { browser, page, errors } = await renderSession();
const report = [];
await mkdir("qa/v1.8/phase-b", { recursive: true });
try {
  for (const family of [
    "WEDGE_CITADEL",
    "HAMMERHEAD",
    "WIDE_CARRIER",
    "ENGINE_DOMINANT",
  ])
    for (const seed of [0, 7, 13]) {
      const result = await page.evaluate(
        async ({ family, seed }) => {
          try {
            const b = window.integrationQA.generate(
              { ...window.integrationQA.order, shipyardId: "forge" },
              seed,
              { architecture: "BLOCK_ASSEMBLY", family },
            );
            const shot = await window.integrationQA.capture(b);
            return { b, shot };
          } catch (e) {
            return { error: String(e) };
          }
        },
        { family, seed },
      );
      if (result.error) {
        console.log(family, seed, result.error);
        report.push({ family, seed, error: result.error });
        continue;
      }
      await writeFile(
        `qa/v1.8/phase-b/${family}-${seed}.png`,
        png(result.shot.pixels),
      );
      report.push({
        family,
        seed,
        candidate: result.b.candidate,
        metrics: result.b.macroDesign.realized,
        diagnostics: result.shot.diagnostics,
      });
    }
  await writeFile(
    "qa/v1.8/phase-b/report.json",
    JSON.stringify({ errors, report }, null, 2),
  );
  console.log(
    report.map((r) => ({
      family: r.family,
      seed: r.seed,
      candidate: r.candidate,
      error: r.error,
    })),
  );
} finally {
  await browser.close();
}
