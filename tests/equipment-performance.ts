import { generateBlueprint, DEFAULT_ORDER } from "../src/generation/generate";
import { resolve } from "node:path";
const baselinePath = resolve(
  process.env.SHIPYARD_BASELINE_DIR ?? "../Ship_generator-v18541",
  "src/generation/generate.ts",
);
const { generateBlueprint: baseline } = (await import(
  /* @vite-ignore */ baselinePath
)) as { generateBlueprint: typeof generateBlueprint };
import { planEquipmentPreview } from "../src/equipment-preview/fitment";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const order = {
    ...structuredClone(DEFAULT_ORDER),
    role: "Battleship" as const,
    length: 470,
    hardpointDensity: "SPARSE" as const,
  },
  options = {
    architecture: "MONOLITHIC" as const,
    family: "WEDGE_CITADEL" as const,
  };
const pairs = [],
  sha = (b: unknown) =>
    createHash("sha256").update(JSON.stringify(b)).digest("hex");
let b: ReturnType<typeof generateBlueprint>;
for (let i = 0; i < 3; i++) {
  const currentFirst = i % 2 === 1;
  const start = performance.now(),
    first = (currentFirst ? generateBlueprint : baseline)(order, 7, options),
    firstMs = performance.now() - start;
  const secondStart = performance.now(),
    second = (currentFirst ? baseline : generateBlueprint)(order, 7, options),
    secondMs = performance.now() - secondStart;
  b = currentFirst ? first : second;
  pairs.push({
    order: currentFirst ? "current→baseline" : "baseline→current",
    baselineMs: currentFirst ? secondMs : firstMs,
    currentMs: currentFirst ? firstMs : secondMs,
    identical: sha(first) === sha(second),
  });
}

const request = {
  scope: "BATTERY" as const,
  slotId: b!.hardpoints.find(
    (h) =>
      h.size === "M" && h.modular?.region === "TOP" && h.modular.batteryGroupId,
  )!.id,
  equipmentId: "gun-210",
  refineBattery: true,
};
const start = performance.now(),
  p = planEquipmentPreview(b!, request),
  cold = performance.now() - start;
const warm = performance.now();
planEquipmentPreview(b!, request);
const cached = performance.now() - warm;
const autoStart = performance.now(),
  auto = planEquipmentPreview(b!, { scope: "AUTO", equipmentId: "gun-210" }),
  autoMs = performance.now() - autoStart;
writeFileSync(
  "qa/v1.8.5.4.2/performance.json",
  JSON.stringify(
    {
      environment:
        "Node 24.19.0, same container, three paired comparisons with reversed middle-pair order; no simultaneous QA jobs",
      pairs,
      preview: {
        refinedBatteryMs: cold,
        cachedMs: cached,
        autoMs,
        autoCounts: auto.results.reduce(
          (c, r) => ((c[r.status] = (c[r.status] ?? 0) + 1), c),
          {} as Record<string, number>,
        ),
      },
      generationPath: "unchanged 1.8.5.4.1 canonical generator",
      gpu: "Software SwiftShader browser only; hardware GPU/frame time NOT measured",
    },
    null,
    2,
  ),
);
console.log(pairs, cold, cached, autoMs);
