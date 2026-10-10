import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(process.env.DEMO_URL ?? "http://localhost:4180");
await page.waitForTimeout(1000);
await page.screenshot({ path: "qa/start.png" });
await page.click("#play");
await page.waitForTimeout(500);
const snapshot = () => page.evaluate(() => window.combatDemo.snapshot());
const start = await snapshot();
if (start.paused) throw Error("Pointer lock did not engage");
await page.keyboard.press("Tab");
await page.keyboard.down("KeyD");
await page.keyboard.press("Shift");
await page.waitForTimeout(700);
await page.keyboard.up("KeyD");
const boost = await snapshot();
await page.keyboard.press("Digit3");
const before = await snapshot();
await page.mouse.move(900, 430);
await page.waitForTimeout(300);
const cameraOnly = await snapshot();
await page.keyboard.press("Digit1");
await page.mouse.down();
await page.waitForTimeout(6500);
await page.mouse.up();
await page.screenshot({ path: "qa/combat.png" });
const combat = await snapshot();
await page.keyboard.press("Digit2");
await page.mouse.move(720, 450);
await page.mouse.down();
await page.waitForTimeout(700);
await page.mouse.up();
const spinal = await snapshot();
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
const pause = await snapshot();
await page.click("#play");
await page.waitForTimeout(300);
const resume = await snapshot();
const checks = {
  directionalBoost:
    boost.ships[0].position[0] > start.ships[0].position[0] &&
    boost.ships[0].energy <= 75,
  cameraDoesNotTurnHull:
    JSON.stringify(before.ships[0].attitude) ===
    JSON.stringify(cameraOnly.ships[0].attitude),
  persistentLock: combat.locked && spinal.locked,
  missileFire: combat.stats.playerShots.MISSILE > 0,
  spinalFire: spinal.stats.playerShots.SPINAL > 0,
  pauseResume: pause.paused && !resume.paused && resume.time >= pause.time,
};
const report = {
  checks,
  start,
  boost,
  before,
  cameraOnly,
  combat,
  spinal,
  pause,
  resume,
  errors,
};
await writeFile("qa/browser-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (errors.length || Object.values(checks).some((v) => !v))
  process.exitCode = 1;
