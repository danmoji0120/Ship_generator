import "./gallery.css";
import {
  ARCHITECTURES,
  ROLES,
  SHAPE_KINDS,
  JOIN_TYPES,
  type ArchitectureGrammar,
  type ShipRole,
  type ShipBlueprint,
} from "../blueprint/types";
import { SHIPYARDS } from "../shipyards/config";
import { DEFAULT_ORDER, generateBlueprint } from "../generation/generate";
import { ShipViewer } from "../rendering/viewer";
import { seedSequence, diversityReport } from "./diversity";
import { shapeFixture, joinFixture } from "./fixtures";
const app = document.getElementById("qa-app")!;
app.innerHTML = `<header><div><small>PROCEDURAL SHIPYARD / V1.5</small><h1>Silhouette laboratory</h1><p>동일 문법, 서로 다른 설계. Shape와 Join을 함께 검증합니다.</p></div><a href="/">← Ship order</a></header><form id="qa-form"><label>Shipyard<select id="yard">${SHIPYARDS.map((y) => `<option value="${y.id}">${y.name}</option>`)}</select></label><label>Role<select id="role">${ROLES.map((r) => `<option ${r === "Cruiser" ? "selected" : ""}>${r}</option>`)}</select></label><label>Architecture<select id="architecture">${ARCHITECTURES.map((a) => `<option ${a === "BLOCK_ASSEMBLY" ? "selected" : ""}>${a}</option>`)}</select></label><label>Seed start<input id="start" type="number" min="0" max="4294967295" value="0"></label><label>Count<input id="count" type="number" min="1" max="40" value="20"></label><label class="check"><input id="neutral" type="checkbox" checked>Neutral silhouette</label><button>Build contact sheet</button></form><nav><button id="contact">Contact sheet</button><button id="shapes">Shape gallery / 11</button><button id="joins">Join gallery / 10</button><button id="report-download">↓ QA JSON</button></nav><p id="status" role="status"></p><section id="grid"></section><div id="thumbnail-stage" aria-hidden="true"></div>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const viewer = new ShipViewer(el("thumbnail-stage"));
let current: ShipBlueprint[] = [],
  report: unknown,
  busy = false;
async function renderGallery(mode: "contact" | "shapes" | "joins") {
  if (busy) return;
  busy = true;
  el("grid").innerHTML = "";
  el("status").textContent = "Rendering…";
  try {
    const yard = el<HTMLSelectElement>("yard").value,
      role = el<HTMLSelectElement>("role").value as ShipRole,
      architecture = el<HTMLSelectElement>("architecture")
        .value as ArchitectureGrammar;
    const order = { ...structuredClone(DEFAULT_ORDER), shipyardId: yard, role };
    if (role === "Spinal Gun Ship") {
      order.priorities.firepower = 100;
      order.priorities.missile = 10;
    }
    if (role === "Missile Ship") order.priorities.missile = 100;
    current =
      mode === "contact"
        ? seedSequence(
            Number(el<HTMLInputElement>("start").value),
            Number(el<HTMLInputElement>("count").value),
          ).map((seed) => generateBlueprint(order, seed, { architecture }))
        : mode === "shapes"
          ? SHAPE_KINDS.map(shapeFixture)
          : JOIN_TYPES.map(joinFixture);
    for (const [i, b] of current.entries()) {
      const rendered = structuredClone(b);
      if (el<HTMLInputElement>("neutral").checked) {
        rendered.materialTheme.hull = "#a5adb7";
        rendered.materialTheme.secondary = "#8f9ca6";
        rendered.materialTheme.accent = "#a5adb7";
        rendered.hardpoints = [];
        rendered.surfaceFeatures = [];
      }
      const src = viewer.snapshot(rendered, "Normal");
      const title =
        mode === "contact"
          ? `SEED ${b.seed}`
          : mode === "shapes"
            ? SHAPE_KINDS[i]
            : JOIN_TYPES[i];
      const card = document.createElement("article");
      card.innerHTML = `<img src="${src}" alt="${title}"><div><b>${title}</b><span>${mode === "contact" ? b.architecture.grammar : "PRIMITIVE QA"}</span><small>${mode === "contact" ? b.architecture.composition : mode === "shapes" ? "ShapeDefinition → station loft" : "StructuralConnector → join geometry"}</small></div>`;
      el("grid").append(card);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
    report =
      mode === "contact"
        ? diversityReport(current)
        : { mode, count: current.length };
    const d = mode === "contact" ? diversityReport(current) : undefined;
    el("status").textContent = d
      ? `${yard.toUpperCase()} / ${role} / ${architecture} · ${d.count} designs · ${d.compositions.length} compositions · ${d.uniqueSignatures} feature signatures · ${d.warnings.join(" ") || "Diversity check PASS — visually inspect joins and silhouette."}`
      : `${mode === "shapes" ? "11 shapes" : "10 joins"} · identical renderer and authoritative blueprint parameters`;
    Object.assign(window, {
      shipyardGallery: { ready: true, mode, blueprints: current, report },
    });
  } catch (e) {
    el("status").textContent = String(e);
    Object.assign(window, {
      shipyardGallery: { ready: true, error: String(e) },
    });
  } finally {
    busy = false;
  }
}
el("qa-form").onsubmit = (e) => {
  e.preventDefault();
  void renderGallery("contact");
};
for (const mode of ["contact", "shapes", "joins"] as const)
  el(mode).onclick = () => void renderGallery(mode);
el("report-download").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "shipyard-contact-sheet.qa.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
void renderGallery("contact");
