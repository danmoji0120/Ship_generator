import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const stage = process.env.STAGE || "after",
  out = "qa/stacked-refinement";
if(stage === "before" && process.env.CAPTURE_ONLY !== "1") throw Error("Preserved Before snapshots may only be recaptured with CAPTURE_ONLY=1");
await mkdir(`${out}/${stage}`, { recursive: true });
const { browser, page, errors } = await renderSession();
try {
  if (stage === "sample") {
    const timing = await page.evaluate(async () => {
      const { createMacroPlan } = await import("/src/generation/macro/plan.ts"),
        { DEFAULT_ORDER } = await import("/src/generation/generate.ts"),
        { getShipyard } = await import("/src/shipyards/config.ts");
      const yard = getShipyard("forge");
      createMacroPlan(DEFAULT_ORDER, yard, "STACKED_BLOCKS", 7);
      const rows = [];
      for (let seed = 12; seed < 24; seed++) {
        const a = performance.now();
        createMacroPlan(
          DEFAULT_ORDER,
          yard,
          "STACKED_BLOCKS",
          seed,
          undefined,
          undefined,
          false,
        );
        const b = performance.now();
        createMacroPlan(DEFAULT_ORDER, yard, "STACKED_BLOCKS", seed);
        const c = performance.now();
        rows.push({ seed, beforeMs: b - a, afterMs: c - b });
      }
      return rows;
    });
    await writeFile(
      `${out}/macro-timing.json`,
      JSON.stringify(timing, null, 2),
    );
  }
  const cases =
    stage === "sample"
      ? Array.from({ length: 9 }, (_, i) => ({
          shipyardId: ["aegis", "vesper", "forge", "serein"][i % 4],
          seed: 12 + i,
          length: 300,
          role: "Cruiser",
          family: i % 2 ? "WEDGE_CITADEL" : "HAMMERHEAD",
          massClass: "Standard",
        }))
      : ["aegis", "vesper", "forge", "serein"].flatMap((shipyardId) =>
          [4, 7, 11].map((seed, i) => ({
            shipyardId,
            seed,
            length: [120, 300, 500][i],
            role: i === 1 ? "Cruiser" : "Frigate",
            family: i === 1 ? "WEDGE_CITADEL" : "HAMMERHEAD",
            massClass: i === 2 ? "Heavy" : "Standard",
          })),
        );
  for (const c of cases) {
    if(process.env.CASE_IDS && !process.env.CASE_IDS.split(",").includes(`${c.shipyardId}-${c.seed}`))continue;
    const id = `${c.shipyardId}-${c.seed}`,
      baseline = await readFile(`${out}/before/${id}.json`, "utf8")
        .then((s) => JSON.parse(s))
        .catch(() => undefined);
    const row = await page.evaluate(
      async ({ c, baseline, stage, captureOnly }) => {
        const { generateBlueprint, DEFAULT_ORDER } =
            await import("/src/generation/generate.ts"),
          { validateBlueprint } = await import("/src/validation/validate.ts"),
          { ArmorQARenderer } = await import("/src/rendering/armor-qa.ts");
        const order = { ...structuredClone(DEFAULT_ORDER), ...c };
        delete order.seed;
        delete order.family;
        let b;
        try {
          b = captureOnly
            ? baseline
            : generateBlueprint(order, c.seed, {
                architecture: "STACKED_BLOCKS",
                family: c.family,
              });
        } catch (e) {
          return {
            rejected: String(e),
            issues: [],
            deterministic: null,
            captures: [],
          };
        }
        const { measureStackedUnion } =
            await import("/src/generation/macro/stacked-measurement.ts"),
          { profileRing } = await import("/src/generation/hull.ts");
        const metrics = (bp) => {
          const vs = bp.structuralVolumes,
            [primary, middle, upper] = [
              "armored-keel",
              "magazine-deck",
              "command-deck",
            ].map((id) => vs.find((v) => v.id === id));
          const areas = (v) =>
            v.geometry.stations.map((st) => {
              const ring = profileRing(st);
              return (
                Math.abs(
                  ring.reduce((n, p, i) => {
                    const q = ring[(i + 1) % ring.length];
                    return n + p[0] * q[1] - q[0] * p[1];
                  }, 0),
                ) / 2
              );
            });
          return {
            union: measureStackedUnion(vs, bp.order.length),
            upperUnion: measureStackedUnion([middle, upper], bp.order.length),
            ratios: Object.fromEntries(
              ["x", "y", "z"].map((axis) => [
                axis,
                middle.dimensions[axis] / primary.dimensions[axis],
              ]),
            ),
            individualUpperVolumeRatio:
              bp.macroDesign.moduleVolumesM3[middle.id] /
              bp.macroDesign.moduleVolumesM3[primary.id],
            upperNormalizedCenter: middle.position.z / bp.order.length + 0.5,
            frontRectangularity: bp.silhouette.occupancy.front,
            frontCapToMaximumSection: vs.map((v) => {
              const a = areas(v);
              return { id: v.id, ratio: a[0] / Math.max(...a) };
            }),
            estimatedMassTonnes: bp.dimensions.estimatedMass,
            physicalMassCentroid: null,
          };
        };
        const afterMetrics = metrics(b),
          beforeMetrics = baseline ? metrics(baseline) : null;
        const issues = validateBlueprint(b),
          r = new ArmorQARenderer(540),
          captures = [];
        for (const view of ["FRONT", "LEFT", "TOP", "ISOMETRIC"]) {
          const opts = {
            neutral: true,
            reviewLighting: true,
            scale: "fixed",
            closeup: {
              center: { x: 0, y: order.length * 0.03, z: 0 },
              extent:
                view === "FRONT" ? order.length * 1.12 : order.length * 1.28,
            },
          };
          // HULL_ONLY deliberately strips armor/details: structural silhouette cannot be credited to decoration.
          for (const layer of [
            "HULL_ONLY",
            ...(c.seed === 7 ? ["COMPLETE"] : []),
          ])
            captures.push({
              name: `${view}-${layer}`,
              pixels: r.capture(b, layer, view, opts).pixels,
            });
        }
        const deterministic = captureOnly
          ? null
          : JSON.stringify(b) ===
            JSON.stringify(
              generateBlueprint(order, c.seed, {
                architecture: "STACKED_BLOCKS",
                family: c.family,
              }),
            );
        let replayEqual = null;
        if (baseline) {
          const opts = { neutral: true, reviewLighting: true, scale: "fixed" };
          replayEqual =
            r.capture(baseline, "COMPLETE", "FRONT", opts).pixels ===
            r.capture(
              JSON.parse(JSON.stringify(baseline)),
              "COMPLETE",
              "FRONT",
              opts,
            ).pixels;
        }
        r.dispose();
        return {
          b,
          issues,
          deterministic,
          replayEqual,
          captures,
          afterMetrics,
          beforeMetrics,
        };
      },
      { c, baseline, stage, captureOnly: process.env.CAPTURE_ONLY === "1" },
    );
    if (row.b)
      await writeFile(`${out}/${stage}/${id}.json`, JSON.stringify(row.b));
    for (const cap of row.captures)
      await writeFile(`${out}/${stage}/${id}-${cap.name}.png`, png(cap.pixels));
    delete row.b;
    delete row.captures;
    if (process.env.CAPTURE_ONLY !== "1")
      await writeFile(
        `${out}/${stage}/${id}-checks.json`,
        JSON.stringify({ case: c, ...row }, null, 2),
      );
    console.log(JSON.stringify({ id, ...row }));
  }
  await writeFile(
    `${out}/${stage}/console.json`,
    JSON.stringify(errors, null, 2),
  );
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
}
