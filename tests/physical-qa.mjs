import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";
const out = "qa/v1.8.6.0/after";
await mkdir(out, { recursive: true });
const { browser, page, errors } = await renderSession();
try {
  const rows = [];
  for (const id of ["aegis470", "vesper200", "forge300"]) {
    const source = JSON.parse(
      await readFile(`qa/v1.8.6.0/before/${id}.json`, "utf8"),
    );
    const r = await page.evaluate(async (source) => {
      const { generateBlueprint } = await import("/src/generation/generate.ts"),
        { validateBlueprint } = await import("/src/validation/validate.ts"),
        { validatePhysicalDesign } = await import("/src/physical/validate.ts");
      let t = performance.now(),
        b = generateBlueprint(source.order, source.seed, {
          architecture: source.architecture.grammar,
          family: source.macroDesign.family,
        }),
        generationMs = performance.now() - t;
      const issues = validateBlueprint(b),
        physicalIssues = validatePhysicalDesign(b, true),
        copy = structuredClone(b);
      delete copy.physicalDesign;
      copy.generatorVersion = source.generatorVersion;
      const geometryPreserved = JSON.stringify(copy) === JSON.stringify(source),
        before = await window.integrationQA.capture(
          source,
          "iso",
          undefined,
          "Normal",
        ),
        normal = await window.integrationQA.capture(
          b,
          "iso",
          before.pose,
          "Normal",
        ),
        frames = [];
      for (const mode of [
        "Armor Thickness",
        "Physical Materials",
        "Physical Coverage",
      ])
        frames.push({
          mode,
          ...(await window.integrationQA.capture(b, "iso", before.pose, mode)),
        });
      const { armorRayProbe } = await import("/src/physical/probe.ts");
      const probe = armorRayProbe(
        b,
        { x: 0, y: source.order.length * 2, z: 0 },
        { x: 0, y: -1, z: 0 },
        source.order.length * 4,
      );
      return {
        generationMs,
        issues,
        physicalIssues,
        geometryPreserved,
        normalPixelsEqual: before.pixels === normal.pixels,
        normal,
        frames,
        probe,
        physical: b.physicalDesign,
        b,
      };
    }, source);
    await writeFile(`${out}/${id}.json.gz`, gzipSync(JSON.stringify(r.b)));
    delete r.b;
    await writeFile(`${out}/${id}-Normal.png`, png(r.normal.pixels));
    const rendering = [{ mode: "Normal", ...r.normal.diagnostics }];
    delete r.normal;
    for (const f of r.frames) {
      await writeFile(
        `${out}/${id}-${f.mode.replaceAll(" ", "-")}.png`,
        png(f.pixels),
      );
      rendering.push({ mode: f.mode, ...f.diagnostics });
    }
    delete r.frames;
    await writeFile(
      `${out}/${id}-probe.json`,
      JSON.stringify(r.probe, null, 2),
    );
    delete r.probe;
    const p = r.physical;
    delete r.physical;
    r.summary = {
      mass: p.mass,
      policy: p.policy,
      coverage: p.coverage,
      warnings: p.warnings,
      plates: p.surfaces.map((s) => ({
        id: s.id,
        kind: s.kind,
        materialId: s.materialId,
        nominalMm: s.thicknessMm,
        minMm: s.minimumFacetThicknessMm,
        maxMm: s.maximumFacetThicknessMm,
        areaM2: s.surfaceAreaM2,
        physicalOuterAreaM2: s.physicalOuterAreaM2,
        massKg: s.massKg,
        normalDensity: s.normalEquivalentDensityKgM3,
        integratedDensity: s.integratedMeanDensityKgM3,
      })),
    };
    r.id = id;
    r.rendering = rendering;
    rows.push(r);
    await writeFile(`${out}/report.json`, JSON.stringify(rows, null, 2));
    console.log(
      id,
      Math.round(r.generationMs),
      "issues",
      r.issues.length,
      "physical",
      r.physicalIssues.length,
      "pixels",
      r.normalPixelsEqual,
    );
    assert.deepEqual(r.issues, []);
    assert.deepEqual(r.physicalIssues, []);
    assert(r.geometryPreserved && r.normalPixelsEqual);
  }
  await writeFile(`${out}/console.json`, JSON.stringify(errors));
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
