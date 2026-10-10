import type { AnyShipBlueprint } from "../blueprint/types";
import type { ShipViewer } from "../rendering/viewer";
import { PREVIEW_EQUIPMENT } from "../equipment-preview/library";
import type { PreviewRequest, PreviewPlan } from "../equipment-preview/fitment";
export function setupEquipmentPreview(
  viewer: ShipViewer | undefined,
  getBlueprint: () => AnyShipBlueprint,
) {
  const host = document.getElementById("hardpoint-inspector")!,
    panel = document.createElement("details");
  panel.id = "equipment-preview";
  panel.innerHTML =
    '<summary>Equipment fitment preview · 1.8.5.4.2</summary><p>임시 장착 검사 · Blueprint 변경 없음 · 하중/전투 성능 미구현</p><label><input id="equipment-preview-on" type="checkbox"> Preview ON</label><label class="field">Module<select id="equipment-module"></select></label><label class="field">Scope<select id="equipment-scope"><option value="SINGLE">Single selected slot</option><option value="PAIR">Symmetric pair</option><option value="BATTERY">Selected battery</option><option value="AUTO">Representative auto fit (max 32)</option></select></label><label><input id="equipment-refine" type="checkbox"> Try longer M battery (empty slots only, temporary)</label><label><input id="equipment-arcs" type="checkbox"> Sampled arcs / launch paths</label><button id="equipment-apply">Apply preview</button><pre id="equipment-results" style="max-height:320px;overflow:auto;white-space:pre-wrap">Preview OFF</pre>';
  host.append(panel);
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const module = el<HTMLSelectElement>("equipment-module");
  for (const e of PREVIEW_EQUIPMENT) {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = `${e.name} · ${e.size} interface · ${e.footprint.width} × ${e.footprint.length} m`;
    module.append(opt);
  }
  module.value = "gun-210";
  let worker: Worker | undefined,
    last: AnyShipBlueprint | undefined,
    sequence = 0,
    busy = false;
  const scope = el<HTMLSelectElement>("equipment-scope"),
    refine = el<HTMLInputElement>("equipment-refine");
  refine.disabled = true;
  scope.onchange = () => {
    refine.disabled = scope.value !== "BATTERY";
  };
  const apply = () => {
    const id = ++sequence;
    if (!el<HTMLInputElement>("equipment-preview-on").checked) {
      if (busy) {
        worker?.terminate();
        worker = undefined;
        last = undefined;
        busy = false;
      }
      viewer?.setEquipmentPreview();
      el("equipment-results").textContent =
        "Preview OFF · original ship restored";
      return;
    }
    const b = getBlueprint();
    if (b.schemaVersion !== 2) {
      el("equipment-results").textContent =
        "Historical Blueprint has no modular preview contract";
      return;
    }
    try {
      const request: PreviewRequest = {
        scope: el<HTMLSelectElement>("equipment-scope")
          .value as PreviewRequest["scope"],
        equipmentId: module.value,
        refineBattery: el<HTMLInputElement>("equipment-refine").checked,
        slotId: el<HTMLSelectElement>("hardpoint-selection").value,
      };
      if (!worker)
        worker = new Worker(
          new URL("../equipment-preview/worker.ts", import.meta.url),
          { type: "module" },
        );
      el("equipment-results").textContent =
        "검사 중… 실제 접촉 / 회전 / 발사 경로 계산 (UI 조작 및 OFF 가능)";
      worker.onmessage = (
        event: MessageEvent<{ id: number; plan?: PreviewPlan; error?: string }>,
      ) => {
        busy = false;
        if (
          event.data.id !== sequence ||
          !el<HTMLInputElement>("equipment-preview-on").checked
        )
          return;
        if (event.data.error) {
          el("equipment-results").textContent = event.data.error;
          return;
        }
        const plan = event.data.plan!;
        viewer?.setEquipmentPreview(
          plan,
          el<HTMLInputElement>("equipment-arcs").checked,
        );
        const counts = plan.results.reduce(
          (c, r) => ((c[r.status] = (c[r.status] ?? 0) + 1), c),
          {} as Record<string, number>,
        );
        el("equipment-results").textContent =
          (plan.batteryRefinement
            ? JSON.stringify(plan.batteryRefinement) + "\n"
            : "") +
          `Temporary fitment: ${JSON.stringify(counts)} · ${plan.omissions?.length ?? 0} omitted by preview cap · ${plan.cached ? "cached" : plan.elapsedMs.toFixed(1) + " ms"}\n` +
          plan.results
            .map((r) => {
              const e = PREVIEW_EQUIPMENT.find((e) => e.id === r.equipmentId)!;
              // List actual clear sample angles per elevation, not a misleading min/max across blocked gaps.
              const angles = [...new Set(r.samples.map((s) => s.elevation))]
                .map(
                  (p) =>
                    `${p}° elevation: yaw [${r.samples
                      .filter((s) => s.elevation === p && s.clear)
                      .map((s) => s.yaw)
                      .join(", ")}]`,
                )
                .join("\n");
              const slot =
                plan.slotOverrides?.find((h) => h.id === r.slotId) ??
                b.hardpoints.find((h) => h.id === r.slotId)!;
              return `${e.name} / ${r.slotId} / ${b.hardpoints.find((h) => h.id === r.slotId)?.size} / ${r.status}\nPosition ${JSON.stringify(slot.position)} · normal ${JSON.stringify(slot.normal)}\nBattery ${r.batteryId ?? "—"} · Pair ${r.pairId ?? "—"}\nPose ${JSON.stringify(r.pose ?? null)}\n${angles}\n${r.reasons.join("; ")}${r.compatibleAlternatives?.length ? "\nCompatible alternative slots (geometry not yet checked): " + r.compatibleAlternatives.join(", ") : ""}`;
            })
            .join("\n\n") +
          "\n\n" +
          plan.limitations.join("\n");
      };
      worker.onerror = () => {
        el("equipment-results").textContent = "Preview worker failed";
        viewer?.setEquipmentPreview();
      };
      busy = true;
      worker.postMessage({
        id,
        request,
        ...(last !== b ? { blueprint: b } : {}),
      });
      last = b;
    } catch (e) {
      viewer?.setEquipmentPreview();
      el("equipment-results").textContent = String(e);
    }
  };
  el("equipment-apply").onclick = apply;
  el("equipment-preview-on").onchange = apply;
  el("equipment-arcs").onchange = apply;
  return {
    reset() {
      sequence++;
      busy = false;
      worker?.terminate();
      worker = undefined;
      last = undefined;
      el<HTMLInputElement>("equipment-preview-on").checked = false;
      el("equipment-results").textContent = "Preview OFF";
      viewer?.setEquipmentPreview();
    },
  };
}
