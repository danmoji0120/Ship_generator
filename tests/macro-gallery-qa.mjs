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
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const wait = async () => {
  await page.waitForFunction(() => window.shipyardGallery?.ready);
  assert.equal(
    await page.evaluate(() => window.shipyardGallery.error),
    undefined,
  );
};
try {
  await page.goto((process.env.QA_URL || "http://localhost:5173") + "/qa.html");
  await wait();
  for (const projection of [
    "Normal",
    "TOP",
    "SIDE",
    "FRONT",
    "ISOMETRIC",
    "MASS",
  ]) {
    await page.selectOption("#architecture", "BLOCK_ASSEMBLY");
    await page.selectOption("#family", "HAMMERHEAD");
    await page.selectOption("#projection", projection);
    await page.evaluate(() => (window.shipyardGallery.ready = false));
    await page.click("#contact");
    await wait();
    assert.equal(await page.locator("#grid img").count(), 20);
    const seeds = await page.evaluate(() =>
      window.shipyardGallery.blueprints.map((b) => b.seed),
    );
    assert.deepEqual(
      seeds,
      Array.from({ length: 20 }, (_, i) => i),
    );
    await page.screenshot({
      path: `qa/v1.8/gallery-${projection}.png`,
      fullPage: true,
    });
    results.push({ projection, count: 20, ordering: true });
  }
  await page.selectOption("#family", "");
  await page.selectOption("#projection", "Normal");
  for (const mode of ["shapes", "joins", "bow", "integration"]) {
    await page.evaluate(() => (window.shipyardGallery.ready = false));
    await page.click("#" + mode);
    await wait();
    const count = await page.locator("#grid img").count();
    assert.equal(count, mode === "shapes" ? 11 : mode === "joins" ? 10 : 20);
    await page.screenshot({
      path: `qa/v1.8/gallery-${mode}.png`,
      fullPage: true,
    });
    results.push({ mode, count });
  }
  await page.selectOption("#architecture", "TRUSS_POD");
  await page.selectOption("#family", "HAMMERHEAD");
  await page.evaluate(() => (window.shipyardGallery.ready = false));
  await page.click("#contact");
  await page.waitForFunction(() => window.shipyardGallery?.ready);
  assert.match(
    await page.evaluate(() => window.shipyardGallery.error),
    /Unsupported Macro pairing/,
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "qa/v1.8/gallery-report.json",
    JSON.stringify(
      { results, unsupportedPairingExplicit: true, errors },
      null,
      2,
    ),
  );
  console.log(
    "Gallery PASS: 120 new projection thumbnails, 11 Shapes / 10 Joins / 40 completion thumbnails, deterministic ordering, no console errors",
  );
} finally {
  await browser.close();
}
