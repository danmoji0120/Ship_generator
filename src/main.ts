import {setupEquipmentPreview} from './ui/equipment-preview';
import {setupHardpointOrder,readHardpointOrder,applyHardpointOrder,showHardpointInspector,selectHardpoint} from "./ui/hardpoints";
import type {DetailMode} from './generation/details/types';
import {DesignRejection} from './generation/production/requirements';
import "./style.css";
import { layout, PRIORITY_LABELS } from "./ui/layout";
import { DEFAULT_ORDER, generateBlueprint } from "./generation/generate";
import {
  PRIORITIES,
  type ShipOrder,
  type ShipBlueprint,
  type AnyShipBlueprint,
  type ShipRole,
  type MassClass,
} from "./blueprint/types";
import { getShipyard } from "./shipyards/config";
import { validateBlueprint } from "./validation/validate";
import { ShipViewer } from "./rendering/viewer";
import type {FinishProfile} from './generation/appearance/types';
import type { DebugView } from "./rendering/ship";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
$("app").innerHTML = layout();
setupHardpointOrder();
let yardId = "aegis",
  blueprint: AnyShipBlueprint,
  storedBlueprint: string,
  viewer: ShipViewer | undefined;
try {
  viewer = new ShipViewer($("viewer"));
} catch (e) {
  $("viewer-error").hidden = false;
  $("viewer-error").textContent =
    "WebGL을 시작할 수 없습니다. 하드웨어 가속을 지원하는 브라우저를 사용하세요.";
  console.error(e);
}
const equipmentPreview=setupEquipmentPreview(viewer,()=>blueprint);
if(viewer)viewer.onHardpointSelect=id=>selectHardpoint(blueprint,id);
$<HTMLSelectElement>("detail-mode").onchange=()=>viewer?.setDetailMode($<HTMLSelectElement>("detail-mode").value as DetailMode);
$<HTMLSelectElement>("surface-finish").onchange=()=>viewer?.setSurfaceFinish($<HTMLSelectElement>("surface-finish").value as FinishProfile);
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
    ...readHardpointOrder(),
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
  applyHardpointOrder(o);
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
    present(next, start);
  } catch (e) {
    const failure=$("design-rejection");failure.replaceChildren();
    if(e instanceof DesignRejection){$("order-status").textContent=`설계 거절 · ${[...new Set(e.codes)].join(' / ')}`;const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='필수 요구사항 실패 상세';details.append(summary);const why=document.createElement('p');why.textContent=e.message;details.append(why);failure.append(details);}
    else $("order-status").textContent = e instanceof Error ? e.message : String(e);
    $("validated").textContent = "ORDER INVALID";
  }
}
function present(next: AnyShipBlueprint, start=performance.now()) {
    $("design-rejection").replaceChildren();
    viewer?.show(next);
    blueprint = next;
    showHardpointInspector(next);
    equipmentPreview.reset();
    setViewLabel("iso");
    const y = getShipyard(next.shipyardId);
    $("ship-name").textContent = next.designName;
    $("ship-subtitle").textContent = `${y.name} / ${next.role.toUpperCase()}`;
    $("manifest-seed").textContent = `SEED ${next.seed}`;
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
    const volumes = next.schemaVersion===2 ? next.structuralVolumes : [],
      counts = (type: string) => volumes.filter((v) => v.type === type).length;
    if(next.schemaVersion===2){
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
    if (next.layeredArmor) {
      const a=next.layeredArmor;
      $("architecture-summary").innerHTML += `<span>Armor: ${a.budget.segmentCount} panels · ${a.seams.length} physical seams · ${next.hardpoints.filter(h=>h.surfaceMount).length} surface mounts</span><span>Coverage T/B/P/S/F/A: ${["top","bottom","left","right","fore","aft"].map(k=>Math.round(a.coverage.byDirectionRatio[k as keyof typeof a.coverage.byDirectionRatio]*100)+"%").join(" / ")}</span>`;
    }
    if(next.productionDesign){const d=next.productionDesign,w=next.weaponLayout!;
      $("architecture-summary").innerHTML+=`<span>V1.8.4 exterior ${(d.overallBounds.max.z-d.overallBounds.min.z).toFixed(1)} × ${(d.overallBounds.max.x-d.overallBounds.min.x).toFixed(1)} × ${(d.overallBounds.max.y-d.overallBounds.min.y).toFixed(1)} m · ${d.armor.length} structural armor masses · ${d.finish.length} broad finishing courses · ${d.functionalPrefabIds.length} functional assemblies</span><span>Coverage T/B/P/S/F/A: ${Object.values(d.coverage.directions).map(m=>Math.round(m.ratio*100)+"%").join(" / ")}</span><span>Weapons: ${w.composition.map(c=>`${c.count} × ${c.size} ${c.category}`).join(" · ")} · T/B/P/S ${Object.values(w.budget.byRegion).join(" / ")} · ${w.omissions.length} reported group omissions</span>`;
    }
    if(next.schemaVersion===2&&next.exteriorDetailPlan){const d=next.exteriorDetailPlan;const line=document.createElement("span");line.textContent=`Exterior V${d.version}: ${d.kitPlacements.length} functional kits / ${d.detectedZones.length} zones · ${d.styleLanguage} · ${d.decisions.filter(x=>x.status==='omitted').length} recorded omissions · VISUAL ONLY`;$("architecture-summary").append(line);}
    if(next.designDoctrine){const d=next.designDoctrine;
      const section=document.createElement('details'),title=document.createElement('summary');title.textContent=`Design doctrine V${d.version} · ${d.role}`;section.append(title);
      const line=(text:string)=>{const node=document.createElement('span');node.textContent=text;section.append(node);};
      if(next.designRequirements){const r=next.designRequirements,mandatory=r.requirements.filter(q=>q.type==='MANDATORY');const overview=document.createElement('span');overview.id='requirements-summary';overview.textContent=`Requirements V${r.version} · 필수 ${mandatory.filter(q=>q.status==='SATISFIED').length}/${mandatory.length} 충족${next.role==='Spinal Gun Ship'?` · XL 설치 ${next.weaponLayout?.integrated?.length??0}`:''}`;$("architecture-summary").append(overview);
       line(`선체 이전 계획: ${r.chosen?.architecture} / ${r.chosen?.family} · ${r.spaces.length} 구획 예약 · ${r.rejectedCandidates.length} 후보 제외`);
       for(const q of r.requirements)line(`${q.type} ${q.id}: ${q.status} · ${q.metric.actual.toFixed(2)} / ${q.metric.target.toFixed(2)} ${q.metric.unit} · ${q.reason}`);
       for(const e of r.priorityEvidence)line(`${e.priority}: 분야 비중 ${(e.allocationFraction*100).toFixed(1)}% · 실제 예약 ${e.reservedVolumeM3.toFixed(0)} m³ · 관련 장비 ${e.actualEquipmentCount} · ${e.installedGeometry.name} ${e.installedGeometry.value.toFixed(1)} ${e.installedGeometry.unit} · 설계 예약 비중 목표 달성 ${(e.capacityIndex*100).toFixed(0)}%`);
       line(`Energy: ${r.energy.reserved.toFixed(1)}/${r.energy.capacity} abstract design units · ${r.energy.volumeM3.toFixed(0)} m³ structure 내부 예약 (MW/추력 계산 없음)`);
       for(const space of r.spaces)line(`${space.id}: ${space.hostId} · ${space.volumeM3.toFixed(0)} m³ · ${space.sector} 내부 구획`);
      }
      line(d.profile.goal);
      line(`목표: ${d.target.map(c=>`${c.count} × ${c.size} ${c.category}`).join(' · ')}`);
      line(`실제: ${d.actual.map(c=>`${c.count} × ${c.size} ${c.category}`).join(' · ')}`);
      line(`${next.designRequirements?'추정 설계 질량 환산 한도':'설계 한도'}: ${d.total.massTonnes.toFixed(0)} t / ${d.total.volumeM3.toFixed(0)} m³. 설비 수치는 내부·정비 공간을 포함한 예약 예산입니다.`);
      for(const [sector,r] of Object.entries(d.allocations))line(`${sector}: ${r.massTonnes.toFixed(0)} t / ${r.volumeM3.toFixed(0)} m³ 예약 · 사용 ${d.usage[sector as keyof typeof d.usage].massTonnes.toFixed(0)} t`);
      for(const [region,r] of Object.entries(d.directions))line(`${region}: 설치 점유 ${r.usedM2.toFixed(0)} / ${r.allocatedM2.toFixed(0)} m² · 남은 예약 표면 ${r.remainingM2.toFixed(0)} m²`);
      for(const e of d.equipmentTargets??[])line(`${e.kind} 설비: 목표 ${e.target} / 실제 ${e.installed}${e.missing?` · 생략 ${e.missing}: ${e.reasons.join('; ')}`:''}`);
      line(`미설치 목표: ${d.differences.filter(c=>c.missing).map(c=>`${c.missing} × ${c.size} ${c.category}`).join(' · ')||'없음'}`);
      for(const a of d.adjustments)line(`${a.groupId}: ${a.reason}`);
      $('architecture-summary').append(section);
    }
    if (next.macroDesign) {
      const m = next.macroDesign;
      $("architecture-summary").innerHTML +=
        `<strong>${m.family.replaceAll("_", " ")}</strong><span>Mass F / M / A: ${[m.foreMassRatio, m.midMassRatio, m.aftMassRatio].map((x) => Math.round(x * 100) + "%").join(" / ")} · ${m.negativeSpaceTargets.length} intentional channels · ${m.attempts?.length ?? 0} retries</span>`;
    }
    }else $("architecture-summary").textContent="Historical V0 Blueprint — original stored geometry";
    $("engine-pattern").textContent =
      `${y.doctrine} · ${next.generationStats.enginePattern} propulsion`;
    $("generation-time").textContent =
      `${Math.round(performance.now() - start)} ms · validated`;
    $("json-content").textContent = JSON.stringify(next, null, 2);
    $("order-status").textContent = "생성 완료 · 현재 주문서가 적용되었습니다";
    $("order-status").classList.remove("stale");
    $("validated").textContent = "✓ BLUEPRINT VALID";
    storedBlueprint=JSON.stringify(next);
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
    const armorLegend:Partial<Record<DebugView,string>>={"Hull Only":"STRUCTURAL HULL + FITTED CONNECTIONS","Armor Coverage":"TOP / CYAN · BOTTOM / VIOLET · PORT / GREEN · STARBOARD / AMBER · FORE / BLUE · AFT / ROSE","Armor Panels":"CLOSED GEOMETRIC PLATES / PHYSICAL THICKNESS + CHAMFER","Panel Seams":"LOW UNDERLAYER / ACTUAL GAPS BETWEEN PLATES","Secondary Armor":"LOCAL LOW, BROAD OVERLAYS","Hardpoint Mounts":"AMBER / FOUNDATION · CYAN / MOUNT · ARMOR RETAINED","Complete Ship":"COMPLETE ARMOR + SURFACE-MOUNTED EQUIPMENT"};
    $("debug-legend").textContent = armorLegend[mode] ?? (
      mode === "Hardpoints"
        ? "COLOR / SIZE: S CYAN · M GREEN · L AMBER · XL VIOLET · SHAPE / TYPE · CLICK A MARKER TO INSPECT"
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
                      : "SOLID / HULL + MODULES   ·   AMBER / STRUCTURAL TRUSS");
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
function importBlueprint(text: string) {
 const value:AnyShipBlueprint=JSON.parse(text);
 if(![1,2].includes(value.schemaVersion))throw Error("Unsupported Blueprint schema");
 const errors=validateBlueprint(value);if(errors.length)throw Error(errors.join("; "));
 present(value);applyOrder(value.order);$<HTMLInputElement>("seed").value=String(value.seed);
 $("order-status").textContent="저장된 Blueprint 로드 완료 · 재생성 없이 원본 재현";
}
$("import").onclick=()=>$<HTMLInputElement>("import-file").click();
$("import-file").onchange=async()=>{try{const file=$<HTMLInputElement>("import-file").files?.[0];if(file)importBlueprint(await file.text());}catch(e){$("order-status").textContent=String(e);}finally{$<HTMLInputElement>("import-file").value="";}};
$("reload").onclick=()=>{try{if(storedBlueprint)importBlueprint(storedBlueprint);}catch(e){$("order-status").textContent=String(e);}};
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
