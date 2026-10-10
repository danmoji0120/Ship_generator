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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(process.env.DEMO_URL ?? "http://localhost:4181");
await page.click("#play");
await page.keyboard.press("Tab");
await page.keyboard.press("Digit2");
await page.mouse.down();
let s;
let capturedEngagement = false;
const samples = [];
const begin = Date.now();
for (let i = 0; i < 1500; i++) {
  s = await page.evaluate(() => window.combatDemo.snapshot());
  if (s.outcome) break;
  let mode = s.time % 18 < 5 ? 1 : s.time % 18 < 12 ? 2 : 3;
  if (mode === 2 && !s.systems.spinal) mode = 3;
  if (mode === 3 && !s.systems.turret) mode = 1;
  if (mode === 1 && !s.systems.missile) mode = s.systems.spinal ? 2 : 3;
  if (mode !== s.mode) await page.keyboard.press("Digit" + mode);
  let [x, y, z] = mode === 1 ? s.targetNDC : s.leadNDC;
  if (mode === 2) {
    x -= s.spinalNDC[0];
    y -= s.spinalNDC[1];
  }
  const dx = Math.max(-150, Math.min(150, x * 200)),
    dy = Math.max(-120, Math.min(120, -y * 150));
  await page.evaluate(
    ({ dx, dy }) =>
      window.dispatchEvent(
        new MouseEvent("mousemove", { movementX: dx, movementY: dy }),
      ),
    { dx: z > 1 ? 100 : dx, dy },
  );
  if (!capturedEngagement && s.time > 13) {
    await page.screenshot({ path: "qa/engagement.png" });
    capturedEngagement = true;
  }
  if (i % 30 === 0) {
    samples.push(s);
    await page.screenshot({ path: "qa/duel-latest.png" });
  }
  if (s.incoming.some((t) => t < 0.45) && s.ships[0].energy >= 25) {
    await page.keyboard.down("KeyD");
    await page.keyboard.press("Shift");
  }
  if (i % 12 === 0) {
    await page.keyboard.up("KeyD");
    await page.keyboard.down("KeyA");
  }
  if (i % 12 === 6) {
    await page.keyboard.up("KeyA");
    await page.keyboard.down("KeyD");
  }
  await page.waitForTimeout(120);
  if (Date.now() - begin > 200000) break;
}
await page.mouse.up();
await page.screenshot({ path: "qa/duel-end.png" });
const final = await page.evaluate(() => window.combatDemo.snapshot());
let restart = null;
if (final.outcome) {
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(300);
  restart = await page.evaluate(() => window.combatDemo.snapshot());
}
const report = {
  final,
  restart,
  wallSeconds: (Date.now() - begin) / 1000,
  samples,
  errors,
};
await writeFile("qa/duel-report.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    { final, restart, wallSeconds: report.wallSeconds, errors },
    null,
    2,
  ),
);
await browser.close();
if (
  !final.outcome ||
  !restart ||
  restart.outcome ||
  errors.length ||
  Object.values(final.stats.playerShots).some((n) => n === 0)
)
  process.exitCode = 1;
