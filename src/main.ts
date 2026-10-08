import "./style.css";
import { layout, PRIORITY_LABELS } from "./ui/layout";
import { DEFAULT_ORDER, generateBlueprint } from "./generation/generate";
import {
  PRIORITIES,
  type ShipOrder,
  type ShipBlueprint,
  type ShipRole,
  type MassClass,
} from "./blueprint/types";
import { getShipyard } from "./shipyards/config";
import { validateBlueprint } from "./validation/validate";
import { ShipViewer } from "./rendering/viewer";
import type { DebugView } from "./rendering/ship";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
$("app").innerHTML = layout();
let yardId = "aegis",
  blueprint: ShipBlueprint,
  viewer: ShipViewer | undefined;
try {
  viewer = new ShipViewer($("viewer"));
} catch (e) {
  $("viewer-error").hidden = false;
  $("viewer-error").textContent =
    "WebGL을 시작할 수 없습니다. 하드웨어 가속을 지원하는 브라우저를 사용하세요.";
  console.error(e);
}
function syncRanges() {
  for (const id of ["length", ...PRIORITIES]) {
    const input = $<HTMLInputElement>(id);
    $(id + "-value").innerHTML =
      id === "length" ? `${input.value} <span>m</span>` : input.value;
    input.style.setProperty(
      "--progress",
      `${((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100}%`,
    );
  }
}
function order(): ShipOrder {
  return {
    role: $<HTMLSelectElement>("role").value as ShipRole,
    shipyardId: yardId,
    length: Number($<HTMLInputElement>("length").value),
    massClass: $<HTMLSelectElement>("mass").value as MassClass,
    priorities: Object.fromEntries(
      PRIORITIES.map((k) => [k, Number($<HTMLInputElement>(k).value)]),
    ) as ShipOrder["priorities"],
  };
}
function applyOrder(o: ShipOrder) {
  yardId = o.shipyardId;
  $<HTMLSelectElement>("role").value = o.role;
  $<HTMLInputElement>("length").value = String(o.length);
  $<HTMLSelectElement>("mass").value = o.massClass;
  for (const k of PRIORITIES)
    $<HTMLInputElement>(k).value = String(o.priorities[k]);
  syncYard();
  syncRanges();
}
function syncYard() {
  const y = getShipyard(yardId);
  $("doctrine").textContent = y.description;
  document.querySelectorAll<HTMLButtonElement>("[data-yard]").forEach((el) => {
    el.classList.toggle("selected", el.dataset.yard === yardId);
    el.setAttribute("aria-pressed", String(el.dataset.yard === yardId));
  });
}
function randomSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  $<HTMLInputElement>("seed").value = String(a[0]);
}
function stale() {
  $("order-status").textContent = "주문서 변경됨 · 재생성하여 적용";
  $("order-status").classList.add("stale");
}
function generate() {
  try {
    const seedInput = $<HTMLInputElement>("seed"),
      seed = Number(seedInput.value);
    if (
      seedInput.value === "" ||
      !Number.isInteger(seed) ||
      seed < 0 ||
      seed > 4294967295
    )
      throw new Error("Seed는 0–4294967295 사이 정수여야 합니다.");
    const start = performance.now(),
      next = generateBlueprint(order(), seed);
    viewer?.show(next);
    blueprint = next;
    setViewLabel("iso");
    const y = getShipyard(next.shipyardId);
    $("ship-name").textContent = next.designName;
    $("ship-subtitle").textContent = `${y.name} / ${next.role.toUpperCase()}`;
    $("manifest-seed").textContent = `SEED ${seed}`;
    const d = next.dimensions,
      metrics = [
        ["Length", d.length.toFixed(1), "m"],
        ["Width", d.width.toFixed(1), "m"],
        ["Height", d.height.toFixed(1), "m"],
        ["Est. mass", d.estimatedMass.toLocaleString(), "t"],
        ["Engines", next.engines.length, "mounts"],
        ["Hardpoints", next.hardpoints.length, "mounts"],
        ["Hull sections", next.hullSections.length, "sections"],
      ];
    $("metrics").innerHTML = metrics
      .map(
        ([label, value, unit]) =>
          `<div class="metric"><span>${label}</span><strong>${value}<small>${unit}</small></strong></div>`,
      )
      .join("");
    const volumes = next.structuralVolumes,
      counts = (type: string) => volumes.filter((v) => v.type === type).length;
    $("architecture-summary").innerHTML =
      `<strong>${next.architecture.grammar.replaceAll("_", " ")}</strong><span>${next.architecture.composition} · ${volumes.length} major volumes · ${next.structuralConnectors.length} connectors · ${next.trusses.length} trusses</span><span>Hull ${counts("PRIMARY_HULL") + counts("HULL_BLOCK") + counts("ARMOR_BLOCK")} / Pod ${counts("POD")} / Nacelle ${counts("NACELLE")} / Spine ${counts("SPINE")}</span>`;
    $("architecture-summary").innerHTML +=
      `<span>Shapes: ${[...new Set(volumes.map((v) => v.shape?.kind))].join(" / ")} · Joins: ${[...new Set(next.structuralConnectors.map((c) => c.join?.type))].join(" / ")}</span>`;
    $("architecture-summary").innerHTML +=
      `<span>Kitbash: ${(next.prefabPlacements ?? []).length} mounted prefabs · ${[...new Set((next.prefabPlacements ?? []).map((p) => p.kind))].join(" / ") || "none"}</span>`;
    if (next.hullIntegration) {
      const bounds = next.hullIntegration.overallBounds;
      $("architecture-summary").innerHTML +=
        `<span>V1.7 exterior: ${next.prefabPlacements?.filter((p) => p.exterior).length} fitted structures · ${next.hullIntegration.reservedZones.length} equipment zones · envelope ${(bounds.max.z - bounds.min.z).toFixed(1)} × ${(bounds.max.x - bounds.min.x).toFixed(1)} × ${(bounds.max.y - bounds.min.y).toFixed(1)} m</span>`;
    }
    if (next.macroDesign) {
      const m = next.macroDesign;
      $("architecture-summary").innerHTML +=
        `<strong>${m.family.replaceAll("_", " ")}</strong><span>Mass F / M / A: ${[m.foreMassRatio, m.midMassRatio, m.aftMassRatio].map((x) => Math.round(x * 100) + "%").join(" / ")} · ${m.negativeSpaceTargets.length} intentional channels · ${m.attempts?.length ?? 0} retries</span>`;
    }
    $("engine-pattern").textContent =
      `${y.doctrine} · ${next.generationStats.enginePattern} propulsion`;
    $("generation-time").textContent =
      `${Math.round(performance.now() - start)} ms · validated`;
    $("json-content").textContent = JSON.stringify(next, null, 2);
    $("order-status").textContent = "생성 완료 · 현재 주문서가 적용되었습니다";
    $("order-status").classList.remove("stale");
    $("validated").textContent = "✓ BLUEPRINT VALID";
  } catch (e) {
    $("order-status").textContent = e instanceof Error ? e.message : String(e);
    $("validated").textContent = "ORDER INVALID";
  }
}
$("order-form").addEventListener("submit", (e) => {
  e.preventDefault();
  randomSeed();
  generate();
});
$("regenerate").addEventListener("click", generate);
$("random").addEventListener("click", () => {
  randomSeed();
  stale();
});
$("order-form").addEventListener("input", () => {
  syncRanges();
  stale();
});
$("order-form").addEventListener("change", stale);
for (const el of document.querySelectorAll<HTMLButtonElement>("[data-yard]"))
  el.onclick = () => {
    yardId = el.dataset.yard!;
    syncYard();
    stale();
  };
for (const el of document.querySelectorAll<HTMLButtonElement>("[data-debug]"))
  el.onclick = () => {
    document.querySelectorAll("[data-debug]").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    el.classList.add("active");
    el.setAttribute("aria-pressed", "true");
    const mode = el.dataset.debug as DebugView;
    viewer?.setMode(mode);
    $("debug-legend").hidden = mode === "Normal";
    $("debug-legend").textContent =
      mode === "Hardpoints"
        ? "ARROW / NORMAL · " +
          blueprint.hardpoints
            .map((h) => `${h.id}: ${h.type} ${h.size} → ${h.parentId}`)
            .join(" · ")
        : mode === "Hull Sections"
          ? "COLOR / LOGICAL HULL SECTION   ·   OUTLINE / STATION BOUNDARY"
          : mode === "Engines"
            ? "CYAN / PROPULSION   ·   ARROW / THRUST AXIS"
            : mode === "Architecture"
              ? "BLUE / HULL · AMBER / POD · MINT / NACELLE · GOLD / SPINE · VIOLET / ARMOR"
              : mode === "Structural Graph"
                ? "NODES / VOLUMES · WHITE / DIRECT · AMBER / TRUSS · MINT / BRIDGE + MOUNT"
                : mode === "Integration"
                  ? "STATION-FITTED / JOINT, BOW & STERN · GHOST / ORIGINAL HULL"
                  : mode === "Armor"
                    ? "PROTECTION / PRIMARY, SECONDARY, EDGE, JOINT, MACHINERY"
                    : mode === "Equipment"
                      ? "HOUSINGS / SENSOR, MISSILE, WEAPON, THERMAL, PROPULSION"
                      : "SOLID / HULL + MODULES   ·   AMBER / STRUCTURAL TRUSS";
  };
function setViewLabel(id: "top" | "rear" | "iso") {
  document.querySelector(".axis-label")!.innerHTML =
    `<span class="axis-dot"></span> ${id === "top" ? "DORSAL" : id === "rear" ? "AFT" : "ISOMETRIC"} VIEW`;
}
$("fit").onclick = () => {
  viewer?.fit();
  setViewLabel("iso");
};
for (const id of ["top", "rear", "iso"] as const)
  $(id).onclick = () => {
    viewer?.view(id);
    setViewLabel(id);
  };
$("export").onclick = () => {
  if (!blueprint) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(blueprint, null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${blueprint.shipyardId}-${blueprint.seed}.blueprint.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("inspect").onclick = () => $<HTMLDialogElement>("json-dialog").showModal();
$("close-json").onclick = () => $<HTMLDialogElement>("json-dialog").close();
$("copy-json").onclick = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(blueprint, null, 2));
    $("copy-json").textContent = "Copied";
  } catch {
    $("copy-json").textContent =
      "복사 불가 · JSON을 선택하거나 Export를 사용하세요";
  }
};
applyOrder(DEFAULT_ORDER);
generate();
// Read-only QA hooks. Generation still goes through the same pipeline used by the UI.
if (import.meta.env.DEV)
  Object.assign(window, {
    shipyardQA: {
      getBlueprint: () => structuredClone(blueprint),
      sample: generateBlueprint,
      generate: (o: ShipOrder, seed: number) => {
        applyOrder(o);
        $<HTMLInputElement>("seed").value = String(seed);
        generate();
        return structuredClone(blueprint);
      },
      validate: () => validateBlueprint(blueprint),
      diagnostics: () => viewer?.getDiagnostics(),
      priorities: PRIORITY_LABELS,
    },
  });
