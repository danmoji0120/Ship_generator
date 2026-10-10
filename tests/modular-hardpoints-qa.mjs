import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const phase = process.env.PHASE || "after",
  dir = `qa/v1.8.5.4/${phase}`;
await mkdir(dir, { recursive: true });
const cases = [
  {
    id: "small-monolithic",
    seed: 7,
    shipyardId: "aegis",
    length: 80,
    role: "Corvette",
    architecture: "MONOLITHIC",
    family: "WEDGE_CITADEL",
  },
  {
    id: "large-blocks",
    seed: 7,
    shipyardId: "forge",
    length: 500,
    role: "Battleship",
    architecture: "BLOCK_ASSEMBLY",
    family: "WEDGE_CITADEL",
  },
  {
    id: "spinal-modules",
    seed: 7,
    shipyardId: "serein",
    length: 300,
    role: "Spinal Gun Ship",
    architecture: "SPINE_AND_MODULES",
    family: "WEAPON_DOMINANT",
  },
  {
    id: "truss-pods",
    seed: 7,
    shipyardId: "vesper",
    length: 300,
    role: "Frigate",
    architecture: "TRUSS_POD",
    family: "SPLIT_FRAME",
  },
  {
    id: "twin-hull",
    seed: 11,
    shipyardId: "forge",
    length: 400,
    role: "Frigate",
    architecture: "TWIN_HULL",
    family: "WIDE_CARRIER",
  },
  {
    id: "core-nacelles",
    seed: 7,
    shipyardId: "vesper",
    length: 200,
    role: "Frigate",
    architecture: "CORE_AND_NACELLES",
    family: "ENGINE_DOMINANT",
  },
  {
    id: "stacked-blocks",
    seed: 7,
    shipyardId: "aegis",
    length: 300,
    role: "Cruiser",
    architecture: "STACKED_BLOCKS",
    family: "WEDGE_CITADEL",
  },
  {
    id: "hybrid",
    seed: 11,
    shipyardId: "serein",
    length: 300,
    role: "Frigate",
    architecture: "HYBRID",
    family: "SPLIT_FRAME",
  },
];
const { browser, page, errors } = await renderSession();
try {
  for (const c of cases) {
    if (process.env.CASE_IDS && !process.env.CASE_IDS.split(",").includes(c.id))
      continue;
    const baseline =
      phase === "after"
        ? JSON.parse(await readFile(`qa/v1.8.5.4/before/${c.id}.json`, "utf8"))
        : null;
    const row = await page.evaluate(
      async ({ c, phase, baseline }) => {
        const { generateBlueprint, DEFAULT_ORDER } =
            await import("/src/generation/generate.ts"),
          { validateBlueprint } = await import("/src/validation/validate.ts");
        const order = {
            ...structuredClone(DEFAULT_ORDER),
            shipyardId: c.shipyardId,
            length: c.length,
            role: c.role,
          },
          start = performance.now();
        let b;
        try {
          b = generateBlueprint(order, c.seed, {
            architecture: c.architecture,
            family: c.family,
            ...(phase === "before" ? { version: "1.8.5.3.1" } : {}),
          });
        } catch (e) {
          return { case: c, rejected: String(e), captures: [] };
        }
        const generationMs = performance.now() - start,
          issues = validateBlueprint(b),
          counts = Object.fromEntries(
            ["S", "M", "L", "XL"].map((s) => [
              s,
              b.hardpoints.filter((h) => h.size === s).length,
            ]),
          );
        const preserveKeys = [
          "structuralVolumes",
          "structuralConnectors",
          "engines",
          "productionDesign",
          "weaponLayout",
          "mesoStructurePlan",
          "exteriorDetailPlan",
          "prefabPlacements",
        ];
        const geometryPreserved =
          !baseline ||
          preserveKeys.every(
            (k) => JSON.stringify(b[k]) === JSON.stringify(baseline[k]),
          );
        const q = window.integrationQA,
          captures = [];
        for (const mode of ["Normal", "Hardpoints"]) {
          const f = await q.capture(b, "iso", undefined, mode);
          captures.push({
            name: mode,
            pixels: f.pixels,
            diagnostics: f.diagnostics,
          });
        }
        let normalPixelsEqual = null;
        if (baseline) {
          const old = await q.capture(baseline, "iso", undefined, "Normal");
          normalPixelsEqual =
            old.pixels === captures.find((c) => c.name === "Normal").pixels;
        }
        return {
          geometryPreserved,
          normalPixelsEqual,
          case: c,
          b,
          issues,
          generationMs,
          hardpoints: b.hardpoints.length,
          weapons:
            (b.weaponLayout?.mounts.length ?? 0) +
            (b.weaponLayout?.integrated?.length ?? 0),
          counts,
          slots: b.modularHardpoints,
          captures,
        };
      },
      { c, phase, baseline },
    );
    if (row.b) await writeFile(`${dir}/${c.id}.json`, JSON.stringify(row.b));
    for (const cap of row.captures)
      await writeFile(`${dir}/${c.id}-${cap.name}.png`, png(cap.pixels));
    row.rendering = row.captures.map(({ name, diagnostics }) => ({
      name,
      ...diagnostics,
    }));
    delete row.b;
    delete row.captures;
    await writeFile(`${dir}/${c.id}-checks.json`, JSON.stringify(row, null, 2));
    console.log(
      c.id,
      row.rejected ||
        `${row.hardpoints} slots / ${row.weapons} weapons / ${row.generationMs.toFixed(0)}ms`,
    );
  }
  await writeFile(`${dir}/console.json`, JSON.stringify(errors));
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
}
