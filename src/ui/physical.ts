import {physicalDiagnostics,setPhysicalProfilingEnabled} from '../physical/diagnostics';
import type { AnyShipBlueprint, ShipBlueprint, Vec3 } from "../blueprint/types";
import { MATERIALS } from "../physical/materials";
import { migratePhysicalDesign } from "../physical/build";
import { armorRayProbe, preparePhysicalQueries } from "../physical/probe";
import type { ShipViewer } from "../rendering/viewer";
const el = (id: string) => document.getElementById(id)!;
export function showPhysicalInspector(b: AnyShipBlueprint) {
  const d = b.schemaVersion === 2 ? b.physicalDesign : undefined;
  el('physical-selection').onchange=null;
  el("migrate-physical").hidden = !!d || b.schemaVersion !== 2;
  el("physical-summary").textContent = d
    ? `PHYSICAL V1.8.6.0 · ${d.surfaces.filter((s) => s.kind === "ARMOR").length} armor plates · ${d.surfaces.filter((s) => s.kind === "HULL").length} hull shells · ${d.provenance}`
    : b.schemaVersion === 2
      ? "물리 재질 없음 · 과거 외형 유지 · 명시적 추정 마이그레이션 가능"
      : "Schema 1 원본 렌더링 전용 · 물리 추정 마이그레이션은 StructuralVolume이 있는 Schema 2에서 지원";
  el("physical-details").replaceChildren();
  el("physical-selection").replaceChildren();
  el("physical-selection-info").textContent = "";
  el("physical-probe-result").textContent = "";
  const perf=b.schemaVersion===2?physicalDiagnostics(b):undefined;
  el("physical-performance").textContent=perf?`Generation ${perf.totalMs.toFixed(1)}ms · cache ${perf.cache.hits} hit / ${perf.cache.misses} miss · ${Object.entries(perf.stages).map(([name,v])=>`${name} ${v.ms.toFixed(1)}ms (${v.calls})`).join(' · ')} (nested timings overlap)`:'No runtime profile retained; enable before regeneration. Not serialized.';
  if (!d) return;
  const line = (text: string) => {
      const p = document.createElement("p");
      p.textContent = text;
      el("physical-details").append(p);
    },
    m = d.mass,
    policy = d.policy,
    t = (n: number) =>
      (n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " t";
  line(
    `Hull shell ${t(m.hullShellMassKg)} · Armor ${t(m.armorMassKg)} (finite layer volumes × constituent density)`,
  );
  line(
    `Actual frame ${t(m.actualFrameMassKg??0)} / connector ${t(m.actualStructuralConnectorMassKg??0)} · Remaining estimated structure ${t(m.structuralMassEstimateKg)} · Core equipment ${t(m.coreEquipmentMassEstimateKg)} · Player equipment ${t(m.playerMountedEquipmentMassEstimateKg)} · Unresolved ${t(m.unresolvedMassEstimateKg)}`,
  );
  if(b.schemaVersion===2&&b.compartmentPlan)line(`Actual bulkheads ${t(m.actualBulkheadMassKg??0)} / door-hatch closures ${t(m.actualClosureMassKg??0)} · interior material charged to base mass, not empty-space volume`);
  line(
    `Total estimated dry mass ${t(m.totalEstimatedDryMassKg)} / target ${t(m.targetMassKg)} · remaining ${t(m.remainingMassKg)} · skin material cost ${m.manufacturingCostIndexKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} index·kg (not currency)`,
  );
  if(m.ledger?.reconciliation){const r=m.ledger.reconciliation;line(`Mass policy ${r.policyVersion}: modeled base ${t(r.actualModeledBaseKg)} · remaining estimate ${t(r.remainingEstimatedBaseKg)} · unknown legacy service ${t(r.unknownLegacyServiceKg)} (10% of ${t(r.referenceMassKg)}, not the order target)`);for(const note of r.uncertaintyNotes)line(note);}
  if(m.ledger){const l=m.ledger;line(`Base ${t(l.baseEstimatedDryMassKg)} · mounted dry ${t(l.mountedEstimatedDryMassKg)} · base budget ${l.baseBudgetViolation?'EXCEEDED':'WITHIN'} · mounted ${l.mountedLoadoutOverTarget?'OVER TARGET':'WITHIN TARGET'} · maximum allowed mass ${l.maximumAllowedMassKg==null?'unspecified':t(l.maximumAllowedMassKg)}; consumables not included`);for(const e of l.entries)line(`${e.component}: ${t(e.massKg)} [${e.source}] — ${e.basis}`);}
  if(b.schemaVersion===2&&b.structuralVolumes.some(v=>v.type==='SPINE'))line(`Unspecified SPINE structures: ${b.structuralVolumes.filter(v=>v.type==='SPINE').length}. Visible finite boundaries are traced, but material/shell thickness are unresolved; no invented armor mass.`);
  line(`Physical cells ${d.surfaces.reduce((n,s)=>n+s.pieces.length,0)} · material layers ${d.surfaces.reduce((n,s)=>n+s.layerStack.length,0)} · geometry warnings ${d.warnings.length}`);
  line(
    `Hull ${MATERIALS[policy.hullMaterialPreference].displayName} / nominal ${policy.hullThicknessMm.toFixed(1)}mm · Armor ${MATERIALS[policy.armorMaterialPreference].displayName} · Critical ${MATERIALS[policy.criticalArmorMaterialPreference].displayName}`,
  );
  line(
    `Surviving finite outer skin: armor ${d.coverage.armorOuterAreaM2.toFixed(1)} m² / eligible source area ${d.coverage.eligibleArmorAreaM2.toFixed(1)} m² (${(d.coverage.armorRetainedFraction * 100).toFixed(1)}%). This is area retention, not a whole-ship ballistic coverage percentage.`,
  );
  for (const [k, v] of Object.entries(policy.allocationsKg))
    line(
      `${k} allocation ${t(v)} (unused/future reserves are not installed systems)`,
    );
  line(
    `Policy (${policy.future.status}): frame density ${policy.future.frameDensityPreference.toFixed(2)}, redundancy ${policy.future.frameRedundancyPreference.toFixed(2)}, subdivision ${policy.future.compartmentSubdivisionPreference.toFixed(2)}, system ${policy.future.systemPlacementPreference}`,
  );
  for (const text of [...policy.tradeoffs, ...d.warnings]) line(text);
  line(d.approximation);
  const select = el("physical-selection") as HTMLSelectElement;
  select.replaceChildren(
    ...d.surfaces.map(
      (s) =>
        new Option(
          `${s.id} · ${s.materialId} · nominal ${s.thicknessMm.toFixed(1)}mm`,
          s.id,
        ),
    ),
  );
  select.onchange = () => {
    const s = d.surfaces.find((s) => s.id === select.value)!;
    el("physical-selection-info").textContent =
      `${s.id}\n${s.kind} / ${s.protectionZoneId} / ${s.geometryReference.sourceId}\n${MATERIALS[s.materialId].displayName}\nNominal ${s.thicknessMm.toFixed(3)} mm · facet planned depth ${s.minimumFacetThicknessMm.toFixed(3)}–${s.maximumFacetThicknessMm.toFixed(3)} mm\nRender source area ${s.surfaceAreaM2.toFixed(3)} m² · surviving physical outer area ${s.physicalOuterAreaM2.toFixed(3)} m²\nMass ${t(s.massKg)} · normal thickness-weighted density ${s.normalEquivalentDensityKgM3.toFixed(3)} kg/m³ · actual volume-weighted density ${s.integratedMeanDensityKgM3.toFixed(3)} kg/m³\n${s.layerStack.map((l) => `${l.layerOrder}: ${l.constituentMaterialId} / nominal ${l.thicknessMm.toFixed(3)} mm / ${l.densityKgM3} kg/m³ / ${t(l.massKg)}`).join("\n")}`;
  };
  select.dispatchEvent(new Event("change"));
}
export function showProbeResult(r: ReturnType<typeof armorRayProbe>) {
  el("physical-probe-result").textContent =
    `${r.valid ? "VALID" : "INVALID"} · ${r.complete?"COMPLETE":"PARTIAL / unresolved geometry"} · ${r.hits.length} material intervals · exact for stored cells: ${r.exactForStoredCells}\n${r.hits.map((h) => `${h.surfaceId} / ${h.constituentMaterialId}\n${h.entryDistanceM.toFixed(4)}→${h.exitDistanceM.toFixed(4)} m · path ${(h.pathLengthM * 1000).toFixed(3)} mm · normal measured ${h.measuredNormalThicknessMm.toFixed(3)} mm / planned ${h.localFacetLayerThicknessMm.toFixed(3)} mm · incidence ${h.incidenceDegrees?.toFixed(2) ?? "inside"}°\nEntry ${[h.entryPoint.x, h.entryPoint.y, h.entryPoint.z].map((n) => n.toFixed(3)).join(", ")} · Exit ${[h.exitPoint.x, h.exitPoint.y, h.exitPoint.z].map((n) => n.toFixed(3)).join(", ")}`).join("\n")}\n${r.unresolvedCrossings.map(c=>`${c.structureId} @ ${c.distanceM.toFixed(4)}m: ${c.reason}`).join("\n")}\n${r.warnings.join("\n")}`;
}
export function setupPhysicalInspector(
  viewer: ShipViewer | undefined,
  current: () => AnyShipBlueprint,
  changed: (b: ShipBlueprint) => void,
) {
  if (viewer) viewer.onArmorProbe = showProbeResult;
  el("physical-profile").onchange=()=>setPhysicalProfilingEnabled((el("physical-profile") as HTMLInputElement).checked);
  el("prepare-physical-queries").onclick=()=>{try{const b=current();if(b.schemaVersion!==2)throw Error('Schema 2 required');const t=performance.now(),q=preparePhysicalQueries(b);el("physical-probe-result").textContent=`Query preparation/check ${(performance.now()-t).toFixed(1)}ms · initial build ${q.preparationMs.toFixed(1)}ms · ${q.pieceCount} cells / ${q.planeCount} planes · plane storage estimate ${q.estimatedBytes} bytes (excludes JS/index overhead)`;}catch(e){el("physical-probe-result").textContent=String(e);}};
  el("migrate-physical").onclick = () => {
    try {
      const b = current();
      if (b.schemaVersion === 2) changed(migratePhysicalDesign(b));
    } catch (e) {
      el("physical-summary").textContent = String(e);
    }
  };
  el("run-physical-probe").onclick = () => {
    try {
      const b = current();
      if (b.schemaVersion !== 2)
        throw Error("Schema 2 physical geometry required");
      const parse = (id: string): Vec3 => {
        const a = (el(id) as HTMLInputElement).value.split(",").map(Number);
        if (a.length !== 3 || !a.every(Number.isFinite))
          throw Error("Finite xyz values required");
        return { x: a[0], y: a[1], z: a[2] };
      };
      const origin = parse("probe-origin"),
        dir = parse("probe-direction"),
        max = Number((el("probe-distance") as HTMLInputElement).value),
        r = armorRayProbe(b, origin, dir, max);
      const tab = document.querySelector<HTMLButtonElement>(
        '[data-debug="Armor Ray Probe"]',
      );
      if (tab) tab.click();
      else viewer?.setMode("Armor Ray Probe");
      viewer?.setArmorProbeVisual(origin, dir, max, r.hits);
      showProbeResult(r);
    } catch (e) {
      el("physical-probe-result").textContent = String(e);
    }
  };
}
