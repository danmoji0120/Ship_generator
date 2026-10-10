import { generateBlueprint, DEFAULT_ORDER } from "../src/generation/generate";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const dir = "qa/v1.8.5.4.2";
mkdirSync(dir, { recursive: true });
const primary = generateBlueprint(
  {
    ...structuredClone(DEFAULT_ORDER),
    role: "Battleship",
    length: 470,
    hardpointDensity: "SPARSE",
  },
  7,
  { architecture: "MONOLITHIC", family: "WEDGE_CITADEL" },
);
writeFileSync(`${dir}/470-baseline.json`, JSON.stringify(primary));
for (const name of ["stacked-blocks", "spinal-modules", "truss-pods"]) {
  const old = JSON.parse(
    readFileSync("qa/v1.8.5.4/after/" + name + ".json", "utf8"),
  );
  const start = performance.now();
  const b = generateBlueprint(old.order, old.seed, {
    architecture: old.architecture.grammar,
    family: old.macroDesign.family,
  });
  writeFileSync(`${dir}/${name}.json`, JSON.stringify(b));
  console.log(name, performance.now() - start, b.hardpoints.length);
}
