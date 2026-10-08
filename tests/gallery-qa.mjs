import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const output = process.env.GALLERY_OUTPUT || "qa/v1.7/gallery";
await mkdir(output, { recursive: true });
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
const page = await browser.newPage({
  viewport: { width: 1600, height: 1100 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto((process.env.QA_URL || "http://localhost:5173") + "/qa.html");
await page.waitForFunction(() => window.shipyardGallery?.ready);
const sheets = [];
async function sheet(yard, architecture, role = "Cruiser") {
  await page.selectOption("#yard", yard);
  await page.selectOption("#architecture", architecture);
  await page.selectOption("#role", role);
  await page.evaluate(() => (window.shipyardGallery.ready = false));
  await page.locator("#qa-form button").click();
  await page.waitForFunction(() => window.shipyardGallery?.ready, undefined, {
    timeout: 60000,
  });
  const result = await page.evaluate(() => {
    const g = window.shipyardGallery;
    return {
      ...g,
      images: [...document.querySelectorAll("#grid img")].map((i) => i.src),
    };
  });
  assert.equal(result.error, undefined);
  assert.equal(result.blueprints.length, 20);
  assert.equal(await page.locator("#grid img").count(), 20);
  assert.deepEqual(
    result.blueprints.map((b) => b.seed),
    Array.from({ length: 20 }, (_, i) => i),
  );
  assert.ok(
    result.blueprints.every((b) => b.architecture.grammar === architecture),
  );
  assert.deepEqual(result.report.warnings, []);
  const hashes = result.images.map((s) =>
    createHash("sha256").update(s).digest("hex"),
  );
  assert.equal(new Set(hashes).size, 20);
  await page.screenshot({
    path: `${output}/contact-${yard}-${architecture}.png`,
    fullPage: true,
  });
  sheets.push({
    yard,
    role,
    architecture,
    ...result.report,
    pixelHashes: hashes,
  });
  console.log(
    `${yard}/${architecture}: 20 renders / ${result.report.compositions.length} compositions / 20 unique pixels`,
  );
}
try {
  const architectures = [
    "MONOLITHIC",
    "BLOCK_ASSEMBLY",
    "SPINE_AND_MODULES",
    "TRUSS_POD",
    "TWIN_HULL",
    "CORE_AND_NACELLES",
    "STACKED_BLOCKS",
    "HYBRID",
  ];
  for (const architecture of architectures) await sheet("forge", architecture);
  for (const yard of ["aegis", "vesper", "serein"])
    await sheet(yard, "BLOCK_ASSEMBLY");
  for (const mode of ["shapes", "joins"]) {
    await page.evaluate(() => (window.shipyardGallery.ready = false));
    await page.locator(`#${mode}`).click();
    await page.waitForFunction(() => window.shipyardGallery?.ready);
    assert.equal(
      await page.locator("#grid img").count(),
      mode === "shapes" ? 11 : 10,
    );
    await page.screenshot({
      path: `${output}/gallery-${mode}.png`,
      fullPage: true,
    });
  }
  await page.locator("#contact").click();
  await page.waitForFunction(() => window.shipyardGallery?.mode === "contact");
  const download = page.waitForEvent("download");
  await page.locator("#report-download").click();
  const file = await download;
  assert.equal(file.suggestedFilename(), "shipyard-contact-sheet.qa.json");
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/gallery-report.json`,
    JSON.stringify(
      {
        browser: "Chromium / WebGL SwiftShader",
        renderedDesigns: sheets.length * 20,
        shapeGallery: 11,
        joinGallery: 10,
        consoleErrors: errors,
        sheets,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
