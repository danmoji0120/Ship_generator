import type {
  Hardpoint,
  ShipOrder,
  AnyShipBlueprint,
} from "../blueprint/types";
import {
  MOUNT_TYPES,
  SLOT_REGIONS,
  type HardpointRequest,
} from "../generation/hardpoint-system/types";
const el = (id: string) => document.getElementById(id)!;
let requests: HardpointRequest[] = [];
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function setupHardpointOrder() {
  el("add-hardpoint-request").addEventListener("click", () => {
    let existing: ReturnType<typeof readHardpointOrder>;
    try {
      existing = readHardpointOrder();
    } catch (e) {
      el("order-status").textContent = String(e);
      return;
    }
    requests = existing.hardpointRequests!;
    if (requests.length >= 32) return;
    let i = 0;
    while (requests.some((r) => r.id === "request-" + i)) i++;
    requests.push({
      id: "request-" + i,
      type: "UTILITY",
      size: "S",
      count: 4,
      mandatory: false,
      priority: 50,
    });
    renderRequests();
    el("order-form").dispatchEvent(new Event("change"));
  });
}
function renderRequests() {
  el("hardpoint-requests").replaceChildren();
  for (const r of requests) {
    const row = document.createElement("div");
    row.className = "hardpoint-request";
    row.dataset.id = r.id;
    const select = (field: string, values: readonly string[], value: string) =>
      `<label>${field}<select data-field="${field}">${values.map((v) => `<option ${v === value ? "selected" : ""}>${v}</option>`).join("")}</select></label>`;
    row.innerHTML =
      select("type", MOUNT_TYPES, r.type) +
      select("size", ["S", "M", "L", "XL"], r.size) +
      `<label>Count<input data-field="count" type="number" min="1" max="512" value="${r.count}"></label><label>Priority<input data-field="priority" type="number" min="0" max="100" value="${r.priority}"></label>` +
      select("region", ["ANY", ...SLOT_REGIONS], r.region ?? "ANY") +
      `<label>Mandatory<input data-field="mandatory" type="checkbox" ${r.mandatory ? "checked" : ""}></label><label class="wide">Parent (optional)<input data-field="parentId" value="${escape(r.parentId ?? "")}" placeholder="Any structural volume"></label><label class="wide">Direction xyz (optional)<input data-field="direction" value="${r.direction ? [r.direction.x, r.direction.y, r.direction.z].join(",") : ""}" placeholder="0, 0, -1"></label><button type="button" class="wide">Remove</button>`;
    row.querySelector("button")!.onclick = () => {
      row.remove();
      requests = requests.filter((a) => a.id !== r.id);
      el("order-form").dispatchEvent(new Event("change"));
    };
    el("hardpoint-requests").append(row);
  }
}
export function readHardpointOrder(): Pick<
  ShipOrder,
  "hardpointDensity" | "hardpointRequests"
> {
  const rows = [
    ...el("hardpoint-requests").querySelectorAll<HTMLElement>(
      ".hardpoint-request",
    ),
  ];
  return {
    hardpointDensity: (el("hardpoint-density") as HTMLSelectElement)
      .value as ShipOrder["hardpointDensity"],
    hardpointRequests: rows.map((row) => {
      const input = (f: string) =>
        row.querySelector<HTMLInputElement>(`[data-field="${f}"]`)!;
      const region = input("region").value,
        raw = input("direction").value.trim(),
        values = raw.split(",").map(Number);
      if (
        raw &&
        (values.length !== 3 || values.some((v) => !Number.isFinite(v)))
      )
        throw Error("Direction requires three finite xyz values");
      return {
        id: row.dataset.id!,
        type: input("type").value as HardpointRequest["type"],
        size: input("size").value as HardpointRequest["size"],
        count: Number(input("count").value),
        mandatory: input("mandatory").checked,
        priority: Number(input("priority").value),
        ...(region !== "ANY"
          ? { region: region as HardpointRequest["region"] }
          : {}),
        ...(input("parentId").value.trim()
          ? { parentId: input("parentId").value.trim() }
          : {}),
        ...(raw
          ? { direction: { x: values[0], y: values[1], z: values[2] } }
          : {}),
      };
    }),
  };
}
export function applyHardpointOrder(o: ShipOrder) {
  (el("hardpoint-density") as HTMLSelectElement).value =
    o.hardpointDensity ?? "STANDARD";
  requests = structuredClone(o.hardpointRequests ?? []);
  renderRequests();
}
export function showHardpointInspector(b: AnyShipBlueprint) {
  const p = b.schemaVersion === 2 ? b.modularHardpoints : undefined;
  el("hardpoint-inspector").hidden = !p;
  if (!p) return;
  el("hardpoint-summary").textContent =
    `TOTAL ${p.summary.total} · EMPTY ${p.summary.empty} · OCCUPIED ${p.summary.occupied} · ${p.density}`;
  const distribution = el("hardpoint-distribution");
  distribution.replaceChildren();
  for (const line of [
    `S / M / L / XL: ${Object.values(p.summary.bySize).join(" / ")}`,
    `Compatible types (tags overlap): ${Object.entries(p.summary.byType)
      .map(([k, v]) => k + " " + v)
      .join(" · ")}`,
    `TOP / BOTTOM / PORT / STARBOARD / FORE / AFT: ${Object.values(p.summary.byRegion).join(" / ")}`,
    `Support pockets ${p.budget.reservedM3.toFixed(0)} / ${p.budget.availableM3.toFixed(0)} m³ (within structure allocation)`,
    `Target ${p.target} · ${p.diagnostics.stopReason}`,
  ]) {
    const node = document.createElement("p");
    node.textContent = line;
    distribution.append(node);
  }
  const select = el("hardpoint-selection") as HTMLSelectElement;
  select.replaceChildren(
    ...b.hardpoints.map(
      (h) =>
        new Option(
          `${h.id} · ${h.size} · ${h.modular?.mountTypes.join("/")} · ${h.parentId}`,
          h.id,
        ),
    ),
  );
  const show = () =>
    showSelected(b.hardpoints.find((h) => h.id === select.value));
  select.onchange = show;
  show();
  const results = el("hardpoint-requirement-results");
  results.replaceChildren();
  for (const r of p.requests) {
    const node = document.createElement("p");
    node.textContent = `${r.request.id}: ${r.status} · ${r.matchedIds.length}/${r.request.count} · missing ${r.missing} · ${r.reason}`;
    results.append(node);
  }
}
function showSelected(h?: Hardpoint) {
  el("hardpoint-selection-info").textContent = h
    ? `${h.id} / ${h.modular?.state}\n${h.size} · ${h.modular?.mountTypes.join("/")} · ${h.modular?.region}\nZone ${h.modular?.zoneId ?? "Historical"}\nPair ${h.modular?.pairId ?? "—"} · Battery ${h.modular?.batteryGroupId ?? "—"}\n${h.modular?.symmetryReason ?? ""}\nParent ${h.parentId}\nPosition ${[h.position.x, h.position.y, h.position.z]
        .map((v) => v.toFixed(2))
        .join(", ")} m\nNormal ${[h.normal.x, h.normal.y, h.normal.z]
        .map((v) => v.toFixed(3))
        .join(
          ", ",
        )}\nFootprint ${h.modular?.footprint.width.toFixed(2)} × ${h.modular?.footprint.length.toFixed(2)} m\nInternal pocket ${h.modular?.internalVolumeM3.toFixed(2)} m³\n${h.modular?.interface.power}`
    : "";
}
export function selectHardpoint(b: AnyShipBlueprint, id: string) {
  const select = el("hardpoint-selection") as HTMLSelectElement;
  select.value = id;
  const details = el("hardpoint-inspector").querySelector("details");
  if (details) details.open = true;
  showSelected(b.hardpoints.find((h) => h.id === id));
}
