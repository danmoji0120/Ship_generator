import { renderSession, png } from "./helpers/render-session.mjs";
import { mkdir, writeFile } from "node:fs/promises";
const out = "qa/v1.8.6.0/before";
await mkdir(out, { recursive: true });
const cases = [
  {
    id: "aegis470",
    shipyardId: "aegis",
    length: 470,
    role: "Cruiser",
    seed: 7,
    architecture: "MONOLITHIC",
    family: "WEDGE_CITADEL",
  },
  {
    id: "vesper200",
    shipyardId: "vesper",
    length: 200,
    role: "Frigate",
    seed: 11,
    architecture: "CORE_AND_NACELLES",
    family: "ENGINE_DOMINANT",
  },
  {
    id: "forge300",
    shipyardId: "forge",
    length: 300,
    role: "Battleship",
    seed: 23,
    architecture: "BLOCK_ASSEMBLY",
    family: "WEDGE_CITADEL",
  },
];
const { browser, page, errors } = await renderSession();
try {
  const rows = [];
  for (const c of cases) {
    const r = await page.evaluate(async (c) => {
      const q = window.integrationQA,
        start = performance.now(),
        b = q.generate(
          {
            ...structuredClone(q.order),
            shipyardId: c.shipyardId,
            length: c.length,
            role: c.role,
          },
          c.seed,
          {
            architecture: c.architecture,
            family: c.family,
            version: "1.8.5.5",
          },
        ),
        ms = performance.now() - start;
      const f = await q.capture(b, "iso", undefined, "Normal");
      return {
        case: c,
        ms,
        massTonnes: b.dimensions.estimatedMass,
        pose: f.pose,
        pixels: f.pixels,
        b,
        rendering: f.diagnostics,
      };
    }, c);
    await writeFile(`${out}/${c.id}.png`, png(r.pixels));
    delete r.pixels;
    await writeFile(`${out}/${c.id}.json`, JSON.stringify(r.b));
    delete r.b;
    rows.push(r);
    console.log(c.id, Math.round(r.ms), r.massTonnes);
    await writeFile(`${out}/report.json`, JSON.stringify(rows, null, 2));
  }
  await writeFile(`${out}/console.json`, JSON.stringify(errors));
  if (errors.length) throw Error(errors.join("\n"));
} finally {
  await browser.close();
}
