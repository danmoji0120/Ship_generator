import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const output = process.env.QA_OUTPUT || "qa/v1.5/regression";
await mkdir(output, { recursive: true });
await page.goto(process.env.QA_URL || "http://localhost:5173");
await page.waitForFunction(() => window.shipyardQA?.getBlueprint());
await page.waitForTimeout(500);
const defaultOrder = await page.evaluate(
  () => window.shipyardQA.getBlueprint().order,
);
const cases = [
  [
    "battleship-heavy",
    {
      role: "Battleship",
      shipyardId: "aegis",
      priorities: { ...defaultOrder.priorities, survivability: 95 },
    },
  ],
  [
    "destroyer-mobility",
    {
      role: "Destroyer",
      shipyardId: "vesper",
      priorities: {
        ...defaultOrder.priorities,
        mobility: 95,
        survivability: 30,
      },
    },
  ],
  [
    "missile-industrial",
    {
      role: "Missile Ship",
      shipyardId: "forge",
      priorities: {
        ...defaultOrder.priorities,
        missile: 100,
        survivability: 50,
        mobility: 40,
      },
    },
  ],
  [
    "spinal-advanced",
    {
      role: "Spinal Gun Ship",
      shipyardId: "serein",
      priorities: {
        ...defaultOrder.priorities,
        firepower: 100,
        mobility: 50,
        missile: 10,
      },
    },
  ],
  ["order-A", {}],
  [
    "order-B",
    {
      priorities: {
        ...defaultOrder.priorities,
        firepower: 40,
        survivability: 30,
        mobility: 90,
        missile: 30,
      },
    },
  ],
  [
    "order-C",
    {
      role: "Missile Ship",
      priorities: {
        ...defaultOrder.priorities,
        missile: 100,
        survivability: 50,
        mobility: 40,
      },
    },
  ],
  [
    "order-D",
    {
      role: "Spinal Gun Ship",
      priorities: {
        ...defaultOrder.priorities,
        firepower: 100,
        mobility: 50,
        missile: 10,
      },
    },
  ],
  ...["aegis", "vesper", "forge", "serein"].map((shipyardId) => [
    `yard-${shipyardId}`,
    { shipyardId },
  ]),
];
cases.push(
  ["corvette-mobility", { role: "Corvette", shipyardId: "vesper" }],
  ["cruiser-naval", { role: "Cruiser", shipyardId: "aegis" }],
);
const grammarFixtures = await page.evaluate((o) => {
  const fixtures = {};
  for (let seed = 0; seed < 500; seed++) {
    const b = window.shipyardQA.sample({ ...o, shipyardId: "forge" }, seed);
    const g = b.architecture.grammar;
    fixtures[g] ??= [];
    if (fixtures[g].length < 3) fixtures[g].push(seed);
    if (
      Object.keys(fixtures).length === 8 &&
      Object.values(fixtures).every((a) => a.length === 3)
    )
      break;
  }
  return fixtures;
}, defaultOrder);
assert.equal(Object.keys(grammarFixtures).length, 8);
for (const g of Object.keys(grammarFixtures))
  cases.push([`grammar-${g}`, { shipyardId: "forge" }]);
const results = [];
for (const [i, [name, partial]] of cases.entries())
  for (const seed of name.startsWith("grammar-")
    ? grammarFixtures[name.slice(8)]
    : i < 4 || name.startsWith("corvette-") || name === "cruiser-naval"
      ? [42, 2718, 742091]
      : [42]) {
    const o = { ...defaultOrder, ...partial };
    const b = await page.evaluate(
      ({ o, seed }) => window.shipyardQA.generate(o, seed),
      { o, seed },
    );
    assert.equal(b.seed, seed);
    assert.equal(b.role, o.role);
    assert.deepEqual(
      await page.evaluate(() => window.shipyardQA.validate()),
      [],
    );
    const diagnostics = await page.evaluate(() =>
      window.shipyardQA.diagnostics(),
    );
    assert.equal(diagnostics.geometryFinite, true);
    assert.ok(diagnostics.triangles > 0 && diagnostics.triangles < 30000);
    assert.ok(diagnostics.camera.every(Number.isFinite));
    await page.waitForTimeout(140);
    await page
      .locator(".viewer-panel")
      .screenshot({ path: `${output}/${name}-${seed}.png` });
    results.push({
      name,
      seed,
      grammar: b.architecture.grammar,
      volumes: b.structuralVolumes.length,
      connectors: b.structuralConnectors.length,
      silhouette: b.silhouette,
      width: b.dimensions.width,
      height: b.dimensions.height,
      engines: b.engines.length,
      hardpoints: b.hardpoints.length,
      ...diagnostics,
    });
  }
// UI seed input and same-seed button: compare both JSON and actual WebGL pixels.
await page.evaluate((o) => window.shipyardQA.generate(o, 9001), defaultOrder);
await page.waitForTimeout(250);
const first = await page.evaluate(() => ({
  json: JSON.stringify(window.shipyardQA.getBlueprint()),
  pixels: document.querySelector("canvas").toDataURL(),
}));
for (let i = 0; i < 10; i++) {
  await page.locator("#regenerate").click();
  await page.waitForTimeout(90);
  const current = await page.evaluate(() => ({
    json: JSON.stringify(window.shipyardQA.getBlueprint()),
    pixels: document.querySelector("canvas").toDataURL(),
  }));
  assert.equal(current.json, first.json);
  assert.equal(current.pixels, first.pixels);
}
// Debug controls and camera presets.
for (const mode of [
  "Hull Sections",
  "Hardpoints",
  "Engines",
  "Structure",
  "Architecture",
  "Structural Graph",
  "Normal",
]) {
  await page.locator(`[data-debug="${mode}"]`).click();
  assert.equal(
    await page.locator(`[data-debug="${mode}"]`).getAttribute("aria-pressed"),
    "true",
  );
  await page.waitForTimeout(100);
  await page
    .locator(".viewer-panel")
    .screenshot({ path: `${output}/debug-${mode.replaceAll(" ", "-")}.png` });
}
await page.locator("#top").click();
await page.waitForTimeout(100);
assert.match(await page.locator(".axis-label").textContent(), /DORSAL/);
await page.locator("#iso").click();
assert.match(await page.locator(".axis-label").textContent(), /ISOMETRIC/);
await page.locator("#rear").click();
await page.waitForTimeout(250);
await page
  .locator(".viewer-panel")
  .screenshot({ path: `${output}/rear-engines.png` });
// Exercise real OrbitControls drag and wheel, then reset.
const canvas = page.locator("canvas"),
  bounds = await canvas.boundingBox();
const before = await page.evaluate(
  () => window.shipyardQA.diagnostics().camera,
);
await page.mouse.move(
  bounds.x + bounds.width * 0.5,
  bounds.y + bounds.height * 0.5,
);
await page.mouse.down();
await page.mouse.move(
  bounds.x + bounds.width * 0.5 + 80,
  bounds.y + bounds.height * 0.5 + 35,
  { steps: 8 },
);
await page.mouse.up();
await page.waitForTimeout(300);
const after = await page.evaluate(() => window.shipyardQA.diagnostics().camera);
assert.notDeepEqual(after, before);
await page.mouse.wheel(0, 180);
await page.waitForTimeout(300);
assert.notDeepEqual(
  await page.evaluate(() => window.shipyardQA.diagnostics().camera),
  after,
);
await page.locator("#fit").click();
assert.match(await page.locator(".axis-label").textContent(), /ISOMETRIC/);
// Inspector, downloadable JSON and random-seed actions.
await page.locator("#inspect").click();
assert.equal(await page.locator("#json-dialog").isVisible(), true);
assert.deepEqual(
  JSON.parse(await page.locator("#json-content").textContent()),
  await page.evaluate(() => window.shipyardQA.getBlueprint()),
);
await page.locator("#close-json").click();
const download = page.waitForEvent("download");
await page.locator("#export").click();
const file = await download;
assert.match(file.suggestedFilename(), /\.blueprint\.json$/);
await file.saveAs(`${output}/export.blueprint.json`);
const oldSeed = await page.locator("#seed").inputValue();
await page.locator("#random").click();
assert.notEqual(await page.locator("#seed").inputValue(), oldSeed);
await page.locator("#regenerate").click();
assert.equal(
  (await page.evaluate(() => window.shipyardQA.getBlueprint())).seed,
  Number(await page.locator("#seed").inputValue()),
);
await page.locator("#seed").fill("1234");
await page.locator("#regenerate").click();
assert.equal(
  (await page.evaluate(() => window.shipyardQA.getBlueprint())).seed,
  1234,
);
await page.locator("#generate").click();
assert.notEqual(
  (await page.evaluate(() => window.shipyardQA.getBlueprint())).seed,
  1234,
);
await page.evaluate((o) => window.shipyardQA.generate(o, 742091), defaultOrder);
await page.locator('[data-debug="Normal"]').click();
await page.locator("#fit").click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${output}/desktop.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
assert.ok(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
);
await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
assert.deepEqual(errors, []);
const report = {
  browser: "Chromium / WebGL SwiftShader",
  renderedDesigns: results.length,
  seedRepetitions: 10,
  blueprintIdentical: true,
  pixelIdentical: true,
  orbit: true,
  zoom: true,
  debugViews: 7,
  grammarFixtures,
  jsonExport: true,
  mobileOverflow: false,
  consoleErrors: errors,
  blueprintHash: createHash("sha256").update(first.json).digest("hex"),
  results,
};
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
await browser.close();
