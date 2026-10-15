import {showStructuralInspector,setupStructuralInspector} from './ui/structure';
import {generateProcurementBlueprint} from './procurement/generate';
import {DEFAULT_PROCUREMENT_ORDER,convertLegacyOrder} from './procurement/order';
import type {ProcurementOrder,ProcurementDelivery} from './procurement/types';
import {readProcurementForm,applyProcurementForm,syncProcurementFields,procurementInputErrors,showProcurementResult} from './ui/procurement';
import {setupPhysicalInspector,showPhysicalInspector} from "./ui/physical";
import {retainFreeLoadout} from "./free-mount/store";
import {setupFreeEquipment} from "./ui/free-equipment";
import {setupEquipmentPreview} from './ui/equipment-preview';
import {showHardpointInspector,selectHardpoint} from "./ui/hardpoints";
import type {DetailMode} from './generation/details/types';
import {DesignRejection} from './generation/production/requirements';
import "./style.css";
import { layout } from "./ui/layout";
import { generateBlueprint } from "./generation/generate";
import {
  type ShipOrder,
  type AnyShipBlueprint,
} from "./blueprint/types";
import { getShipyard } from "./shipyards/config";
import { validateBlueprint } from "./validation/validate";
import { ShipViewer } from "./rendering/viewer";
import type {FinishProfile} from './generation/appearance/types';
import type { DebugView } from "./rendering/ship";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
$("app").innerHTML = layout();

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
setupPhysicalInspector(viewer,()=>blueprint,next=>present(next));
setupStructuralInspector(viewer,()=>blueprint);
const equipmentPreview=setupEquipmentPreview(viewer,()=>blueprint);
const freeEditor=setupFreeEquipment(viewer,()=>blueprint,next=>{
 blueprint=next;storedBlueprint=JSON.stringify(next);$('json-content').textContent='Open View JSON to format the current Blueprint.';viewer?.show(next,false);$("order-status").textContent=`Free equipment: ${next.freeMountPlan?.entries.length??0} · base Hull / Armor / Weapons preserved`;showHardpointInspector(next);showPhysicalInspector(next);showStructuralInspector(next,viewer);showProcurementResult(next);
});
if(viewer)viewer.onHardpointSelect=id=>selectHardpoint(blueprint,id);
$<HTMLSelectElement>("detail-mode").onchange=()=>viewer?.setDetailMode($<HTMLSelectElement>("detail-mode").value as DetailMode);
$<HTMLSelectElement>("surface-finish").onchange=()=>viewer?.setSurfaceFinish($<HTMLSelectElement>("surface-finish").value as FinishProfile);
let legacyMode=false;
let conversion:ProcurementDelivery['conversion'];
function applyOrder(o:ProcurementOrder){yardId=o.shipyardId;applyProcurementForm(o);syncYard();}
function setLegacyMode(value:boolean){legacyMode=value;$('legacy-order-notice').hidden=!value;$<HTMLButtonElement>('generate').disabled=value;$<HTMLButtonElement>('regenerate').disabled=value;}
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
function stale(){
 const errors=procurementInputErrors(yardId);
 $<HTMLButtonElement>('generate').disabled=legacyMode||errors.length>0;
 $<HTMLButtonElement>('regenerate').disabled=legacyMode||errors.length>0;
 $('order-status').textContent=legacyMode?'과거 설계 · 명시적 변환 또는 새 발주를 선택하세요':errors.length?'입력 조건을 확인하세요':'주문서 변경됨 · Generate로 적용';
 $('order-status').classList.add('stale');
}
function failure(e:unknown){
 const node=$('design-rejection');node.replaceChildren();
 $('order-status').textContent=e instanceof DesignRejection?`REJECT · ${[...new Set(e.codes)].join(' / ')}`:String(e);
 const why=document.createElement('p');why.textContent=e instanceof Error?e.message:String(e);node.append(why);
 $('validated').textContent=blueprint?'PREVIOUS DESIGN RETAINED':'ORDER REJECTED';
}
function generate(){
 try{
  if(legacyMode)throw Error('Explicit conversion is required before new procurement.');
  const start=performance.now(),next=generateProcurementBlueprint(readProcurementForm(yardId));
  if(conversion)next.procurement!.conversion=structuredClone(conversion);
  present(blueprint?.schemaVersion===2?retainFreeLoadout(blueprint,next):next,start);
 }catch(e){failure(e);}
}
function present(next: AnyShipBlueprint, start=performance.now()) {
    $("design-rejection").replaceChildren();
    viewer?.show(next);
    blueprint = next;
    showHardpointInspector(next);showPhysicalInspector(next);showStructuralInspector(next,viewer);showProcurementResult(next);
    equipmentPreview.reset();freeEditor.reset();
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
        ["Est. dry mass", (next.schemaVersion===2&&next.physicalDesign?Math.round(next.physicalDesign.mass.totalEstimatedDryMassKg/1000):d.estimatedMass).toLocaleString(), "t"],
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
    $('json-content').textContent='Open View JSON to format the current Blueprint.';
    $("order-status").textContent = "생성 완료 · 현재 주문서가 적용되었습니다";
    $("order-status").classList.remove("stale");
    $("validated").textContent = "✓ BLUEPRINT VALID";
    storedBlueprint=JSON.stringify(next);
}
$("order-form").addEventListener("submit", (e) => {
  e.preventDefault();
  generate();
});
$("regenerate").addEventListener("click", generate);
$("random").addEventListener("click", () => {
  randomSeed();
  stale();
});
$("order-form").addEventListener("input", () => {
  syncProcurementFields();
  stale();
});
$('order-form').addEventListener('change',e=>{syncProcurementFields(e.target as HTMLElement);stale();});
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
    const armorLegend:Partial<Record<DebugView,string>>={"Frame":"REAL EXCLUSIVE FRAME MATERIAL · WHITE / LONGITUDINAL · CYAN / FRAMES · AMBER / REINFORCEMENT · HULL BOUNDARY GHOST · CLICK TO INSPECT","Connectivity":"FINITE MEMBERS / CYAN · ROOTS / GREEN · IDEAL WELDED CONTACTS, NO STRESS SOLUTION","Critical Connections":"RED / BRIDGE MEMBER · AMBER / ARTICULATION · GREEN / ROOT · TOPOLOGY, NOT FAILURE STRENGTH","Structural Mass":"MEMBER MATERIAL MASS: BLUE → RED (LOG SCALE) · GEOMETRY-DERIVED, EXCLUSIVE OWNERSHIP","Armor Thickness":"ACTUAL LOCAL FACET THICKNESS: BLUE → RED (600mm) · HULL GRAY · saturation shown in Inspector","Physical Materials":"STEEL GRAY · TITANIUM CYAN · CERAMIC GOLD · TUNGSTEN VIOLET · NANO GREEN · STRUCTURAL HULL MUTED","Physical Coverage":"FINITE ARMOR SKINS / AMBER · HULL SHELL / BLUE · retained source area, not a whole-ship protection percentage","Armor Ray Probe":"CLICK TO TRACE ACTUAL MATERIAL INTERVALS · FREE EDITOR OFF · blue ray / amber armor / cyan hull","Hull Only":"STRUCTURAL HULL + FITTED CONNECTIONS","Armor Coverage":"TOP / CYAN · BOTTOM / VIOLET · PORT / GREEN · STARBOARD / AMBER · FORE / BLUE · AFT / ROSE","Armor Panels":"CLOSED GEOMETRIC PLATES / PHYSICAL THICKNESS + CHAMFER","Panel Seams":"LOW UNDERLAYER / ACTUAL GAPS BETWEEN PLATES","Secondary Armor":"LOCAL LOW, BROAD OVERLAYS","Hardpoint Mounts":"AMBER / FOUNDATION · CYAN / MOUNT · ARMOR RETAINED","Complete Ship":"COMPLETE ARMOR + SURFACE-MOUNTED EQUIPMENT"};
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
 present(value);conversion=undefined;if(value.schemaVersion===2&&value.procurement){setLegacyMode(false);applyOrder(value.procurement.order);}else setLegacyMode(true);
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
$('inspect').onclick=()=>{$('json-content').textContent=JSON.stringify(blueprint,null,2);$<HTMLDialogElement>('json-dialog').showModal();};
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
$('new-order').onclick=()=>{conversion=undefined;setLegacyMode(false);applyOrder(DEFAULT_PROCUREMENT_ORDER);stale();};
$('convert-legacy').onclick=()=>{try{if(blueprint.schemaVersion!==2)throw Error('Schema 1 is read-only. Create a new procurement order explicitly.');const c=convertLegacyOrder(blueprint);conversion=c.conversion;setLegacyMode(false);applyOrder(c.order);stale();$('order-status').textContent=c.conversion.warning;}catch(e){failure(e);}};
$('replay-legacy').onclick=()=>{try{if(blueprint.schemaVersion!==2)throw Error('Historical Schema 1 is read-only.');const b=blueprint,start=performance.now();const allowed=['1.8','1.8.1','1.8.2','1.8.3','1.8.4','1.8.4.1','1.8.4.2','1.8.5','1.8.5.1','1.8.5.2','1.8.5.3','1.8.5.3.1','1.8.5.4','1.8.5.4.1','1.8.5.5','1.8.6.0','1.8.6.0.1'];if(!allowed.includes(b.generatorVersion))throw Error('This historical generation contract is read-only.');const next=generateBlueprint(b.order,b.seed,{version:b.generatorVersion as any,architecture:b.architecture.grammar,family:b.macroDesign?.family});present(retainFreeLoadout(b,next),start);setLegacyMode(true);$('order-status').textContent='Original generation contract replayed; original stored Blueprint can be reimported.';}catch(e){failure(e);}};
applyOrder(DEFAULT_PROCUREMENT_ORDER);
generate();
// Read-only QA hooks. Generation still goes through the same pipeline used by the UI.
if (import.meta.env.DEV)
  Object.assign(window, {
    shipyardQA: {
      getBlueprint: () => structuredClone(blueprint),
      sample: generateBlueprint,
      generate: (o: ShipOrder, seed: number) => {
        present(generateBlueprint(o,seed));setLegacyMode(true);
        return structuredClone(blueprint);
      },
      validate: () => validateBlueprint(blueprint),
      diagnostics: () => viewer?.getDiagnostics(),
      projectMount: (p:import("./blueprint/types").Vec3)=>viewer?.projectShipPoint(p),
      generateProcurement:(o:ProcurementOrder)=>{setLegacyMode(false);applyOrder(o);generate();},
      importBlueprint,
      procurementOrder:()=>readProcurementForm(yardId),
    },
  });
