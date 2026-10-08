import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  const url = process.env.PRODUCTION_URL || "http://localhost:4173";
  await page.goto(url);
  await page.waitForFunction(
    () =>
      document.querySelector("#validated")?.textContent === "✓ BLUEPRINT VALID",
  );
  assert.equal(await page.evaluate(() => Boolean(window.shipyardQA)), false);
  await page.fill("#seed", "9001");
  await page.click("#regenerate");
  await page.click("#inspect");
  const b = JSON.parse(await page.locator("#json-content").textContent());
  assert.equal(b.generatorVersion, "1.7");
  assert.equal(b.schemaVersion, 2);
  assert(b.hullIntegration);
  await page.click("#close-json");
  for (const mode of ["Integration", "Armor", "Equipment", "Normal"])
    await page.click(`[data-debug="${mode}"]`);
  const download = page.waitForEvent("download");
  await page.click("#export");
  assert.match((await download).suggestedFilename(), /\.blueprint\.json$/);
  await page.screenshot({
    path: "qa/v1.7/production-main.png",
    fullPage: true,
  });
  await page.goto(url + "/qa.html");
  await page.waitForFunction(() => window.shipyardGallery?.ready);
  assert.equal(await page.locator("#grid img").count(), 20);
  await page.evaluate(() => (window.shipyardGallery.ready = false));
  await page.click("#integration");
  await page.waitForFunction(() => window.shipyardGallery?.ready);
  assert.equal(await page.locator("#grid img").count(), 20);
  assert.deepEqual(errors, []);
  await writeFile(
    "qa/v1.7/production-smoke.json",
    JSON.stringify(
      {
        productionMain: true,
        productionGallery: true,
        developmentOrderHooksAbsent: true,
        version: "1.7",
        renderedThumbnails: 20,
        jsonExport: true,
        debugViews: true,
        consoleErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Production PASS: main, gallery, export and debug controls; console errors 0",
  );
} finally {
  await browser.close();
}
