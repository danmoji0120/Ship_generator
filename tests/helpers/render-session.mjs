import { chromium } from "playwright-core";
export async function renderSession() {
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
    viewport: { width: 1200, height: 800 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(process.env.QA_URL || "http://localhost:5173");
  await page.waitForFunction(() => window.shipyardQA?.getBlueprint());
  await page.evaluate(async () => {
    const { ShipViewer } = await import("/src/rendering/viewer.ts");
    const { generateBlueprint, DEFAULT_ORDER } =
      await import("/src/generation/generate.ts");
    const stage = document.createElement("div");
    stage.style.cssText =
      "position:fixed;inset:0;width:960px;height:620px;background:#162535;z-index:100";
    document.body.append(stage);
    const viewer = new ShipViewer(stage);
    window.integrationQA = {
      viewer,
      generate: generateBlueprint,
      order: DEFAULT_ORDER,
      async capture(b, direction = "iso", pose, mode = "Normal") {
        viewer.snapshot(b, mode);
        if (direction !== "iso") {
          if (viewer.view.length) viewer.view(direction);
        }
        if (pose) {
          viewer.camera.position.set(...pose.position);
          viewer.controls.target.set(...pose.target);
          viewer.camera.near = pose.near;
          viewer.camera.far = pose.far;
          viewer.camera.updateProjectionMatrix();
          viewer.controls.update();
        }
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        return {
          pixels: stage.querySelector("canvas").toDataURL(),
          pose: {
            position: viewer.camera.position.toArray(),
            target: viewer.controls.target.toArray(),
            near: viewer.camera.near,
            far: viewer.camera.far,
          },
          diagnostics: viewer.getDiagnostics(),
        };
      },
    };
  });
  return { browser, page, errors };
}
export function png(dataURL) {
  return Buffer.from(dataURL.split(",")[1], "base64");
}
