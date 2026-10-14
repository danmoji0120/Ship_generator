import { chromium } from "playwright-core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
const out = "qa/v1.8.6.0/ui";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const check = (name, result) => {
  assert(result, name);
  checks.push({ name, passed: true });
};
const current = () =>
  page.locator("#json-content").textContent().then(JSON.parse);
const load = async (b) => {
  await page.locator("#import-file").setInputFiles({
    name: "blueprint.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(b)),
  });
  await page.waitForFunction(
    (expected) => {
      try {
        return (
          JSON.stringify(
            JSON.parse(document.querySelector("#json-content").textContent),
          ) === expected
        );
      } catch {
        return false;
      }
    },
    JSON.stringify(b),
    { timeout: 120000 },
  );
};
try {
  await page.goto(process.env.UI_QA_URL || "http://localhost:4206", {
    timeout: 120000,
  });
  await page.waitForFunction(
    () => document.querySelector("#json-content")?.textContent.length > 100,
    {},
    { timeout: 120000 },
  );
  check("Production no DEV API", await page.evaluate(() => !window.shipyardQA));
  const b = JSON.parse(
    gunzipSync(await readFile("qa/v1.8.6.0/after/aegis470.json.gz")),
  );
  await load(b);
  check(
    "Physical Blueprint import exact",
    JSON.stringify(await current()) === JSON.stringify(b),
  );
  check(
    "Physical inspector reads registry/data",
    (await page.locator("#physical-summary").textContent()).includes(
      "PHYSICAL V1.8.6.0",
    ),
  );
  await page
    .locator("#physical-inspector details")
    .first()
    .evaluate((e) => (e.open = true));
  await page
    .locator("#physical-selection")
    .selectOption(b.physicalDesign.surfaces.find((s) => s.kind === "ARMOR").id);
  check(
    "Selected plate layer stack",
    (await page.locator("#physical-selection-info").textContent()).includes(
      "nominal",
    ),
  );
  for (const mode of [
    "Armor Thickness",
    "Physical Materials",
    "Physical Coverage",
  ]) {
    await page.locator(`[data-debug="${mode}"]`).click();
    await page
      .locator("#viewer canvas")
      .screenshot({ path: `${out}/${mode.replaceAll(" ", "-")}.png` });
    check(
      mode + " view",
      (await page
        .locator(`[data-debug="${mode}"]`)
        .getAttribute("aria-pressed")) === "true",
    );
  }
  await page
    .locator("#physical-inspector details")
    .nth(1)
    .evaluate((e) => (e.open = true));
  await page.locator("#run-physical-probe").click();
  check(
    "Manual probe actual finite intervals",
    (await page.locator("#physical-probe-result").textContent()).includes(
      "VALID",
    ) &&
      (await page.locator("#physical-probe-result").textContent()).includes(
        "Entry",
      ),
  );
  await page
    .locator("#physical-probe-result")
    .screenshot({ path: `${out}/probe.png` });
  await page.screenshot({ path: `${out}/inspector.png`, fullPage: true });
  const downloaded = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloaded;
  await download.saveAs(`${out}/export.json`);
  check(
    "Export preserves physical data",
    JSON.stringify(JSON.parse(await readFile(`${out}/export.json`, "utf8"))) ===
      JSON.stringify(b),
  );
  await page.locator("#reload").click();
  check(
    "Reload stored exact",
    JSON.stringify(await current()) === JSON.stringify(b),
  );
  const old = JSON.parse(
    await readFile("qa/v1.8.6.0/before/aegis470.json", "utf8"),
  );
  await load(old);
  check(
    "Old import does not synthesize physical data",
    !(await current()).physicalDesign,
  );
  check(
    "Explicit migration option visible",
    await page.locator("#migrate-physical").isVisible(),
  );
  await page.locator("#migrate-physical").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#physical-summary")
        .textContent.includes("MIGRATED_DEFAULT_ESTIMATE"),
    {},
    { timeout: 120000 },
  );
  const migrated = await current();
  check(
    "Migration marks estimates and keeps exact hull/armor/weapons",
    migrated.physicalDesign.provenance === "MIGRATED_DEFAULT_ESTIMATE" &&
      JSON.stringify(migrated.structuralVolumes) ===
        JSON.stringify(old.structuralVolumes) &&
      JSON.stringify(migrated.productionDesign) ===
        JSON.stringify(old.productionDesign) &&
      JSON.stringify(migrated.weaponLayout) ===
        JSON.stringify(old.weaponLayout),
  );
  check(
    "Free mount editor retained",
    (await page.locator("#free-on").count()) === 1,
  );
  await page.locator("#free-on").check();
  check(
    "Free mount editor toggles on",
    await page.locator("#free-on").isChecked(),
  );
  await page.locator("#free-cancel").click();
  await page.locator("#free-on").uncheck();
  check(
    "Free mount editor returns off",
    !(await page.locator("#free-on").isChecked()),
  );
  await page.locator('[data-debug="Normal"]').click();
  check(
    "Normal view returns",
    (await page
      .locator('[data-debug="Normal"]')
      .getAttribute("aria-pressed")) === "true",
  );
  await page.locator("#target-dry-mass").fill("1");
  await page.locator("#generate").click();
  check(
    "Impossible dry-mass target displays concrete rejection",
    (await page.locator("#design-rejection").textContent()).includes(
      "REQUIRED_PHYSICAL_MASS_BUDGET_EXCEEDED",
    ),
  );
  check(
    "Rejected order retains the previous valid Blueprint",
    JSON.stringify(await current()) === JSON.stringify(migrated),
  );
  await page.locator("#target-dry-mass").fill("");
  check("Console errors zero", errors.length === 0);
  await writeFile(
    `${out}/report.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(`${checks.length} focused Production checks passed`);
} finally {
  await browser.close();
}
