import { ARCHITECTURES, type AnyShipBlueprint } from '../blueprint/types';
import { SHIPYARDS } from '../shipyards/config';
import { ARMOR_MATERIALS, HULL_MATERIALS, MATERIALS } from '../physical/materials';
import { DEFAULT_PROCUREMENT_ORDER, validateProcurementOrder } from '../procurement/order';
import { PROCUREMENT_CLASSES, PROCUREMENT_PRIORITIES, type ProcurementOrder } from '../procurement/types';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const options = (values: readonly string[]) => values.map(v => `<option value="${v}">${v.replaceAll('_', ' ')}</option>`).join('');
const materialOptions = (registry: typeof ARMOR_MATERIALS | typeof HULL_MATERIALS) => '<option value="AUTO">Shipyard automatic</option>' + Object.values(registry).map(m => `<option value="${m.materialId}">${m.displayName}</option>`).join('');
const mode = (id: string) => `<label class="field">${id === 'mainArmor' ? 'Main armor' : id === 'hull' ? 'Hull' : 'Auxiliary armor'} selection mode<select id="${id}-mode">${options(['AUTO', 'PREFER', 'REQUIRE'])}</select></label>`;
export function procurementForm() {
    return `<form id="order-form"><div class="order-fields">
<section><div class="section-title"><h2>01 · Basic order</h2><span>기본 발주</span></div><div class="yard-grid">${SHIPYARDS.map((y, i) => `<button type="button" class="yard-card ${i === 0 ? 'selected' : ''}" data-yard="${y.id}" aria-pressed="${i === 0}"><span class="yard-icon">${['▰', '◈', '▦', '⬡'][i]}</span><span><b>${y.name.split(' ')[0]}</b><small>${y.doctrine}</small></span></button>`).join('')}</div><p id="doctrine" class="doctrine"></p>
<label class="field">Ship class<select id="role">${options(PROCUREMENT_CLASSES)}</select></label><div class="length-label"><label for="length">Target length</label><output id="length-value">300 m</output></div><input id="length" type="range" min="40" max="600" step="1" value="300"><div class="range-ends"><span>40 m</span><span>600 m</span></div><label class="field">Target base mass (t)<input id="target-dry-mass" type="number" min="0.001" step="any" required></label><div class="seed-row"><span>#</span><input id="seed" aria-label="Design seed" type="number" min="0" max="4294967295" step="1" required><button type="button" id="random" title="Random Seed" aria-label="Random Seed">⤨</button></div></section>
<section><div class="section-title"><h2>02 · Design priorities</h2><span>자원 배분</span></div><label class="field">Primary priority<select id="primary-priority">${options(['BALANCED', ...PROCUREMENT_PRIORITIES])}</select></label><p class="seed-note">비무장 출고 · 무장과 전투 센서는 이후 자유 장착합니다.</p></section>
<section><div class="section-title"><h2>03 · Protection</h2><span>방호 사양</span></div><label class="field">Main armor material<select id="mainArmor-material">${materialOptions(ARMOR_MATERIALS)}</select></label><label class="field">Hull material<select id="hull-material">${materialOptions(HULL_MATERIALS)}</select></label><label class="field">Armor distribution<select id="armor-distribution">${options(['CITADEL', 'BALANCED', 'BROAD_COVERAGE'])}</select></label></section>
<details id="procurement-advanced" class="procurement-advanced"><summary>04 · Advanced constraints</summary><label class="field">Secondary priority<select id="secondary-priority"><option value="">None</option>${options(PROCUREMENT_PRIORITIES)}</select></label><label class="field">Maximum base mass (t, optional)<input id="maximum-base-mass" type="number" min="0.001" step="any" placeholder="No hard upper limit"></label><label class="field">Architecture mode<select id="architecture-mode">${options(['AUTO', 'PREFER', 'REQUIRE'])}</select></label><label class="field">Architecture<select id="architecture-choice">${options(ARCHITECTURES)}</select></label>${mode('mainArmor')}${mode('hull')}<label class="field">Auxiliary armor material<select id="auxiliaryArmor-material">${materialOptions(ARMOR_MATERIALS)}</select></label>${mode('auxiliaryArmor')}<p class="seed-note">재질 선택 시 PREFER. REQUIRE는 대체 불가. 주 장갑 지정은 핵심 방호판에 적용됩니다.</p><label class="field" title="실제 노출 facet 중심에서만 유한 체적을 검사합니다. 가장자리나 전체 표면 최소 두께 보장은 지원하지 않습니다.">Critical centers · minimum (mm)<input id="minimum-critical-armor" type="number" min="0.001" max="2000" step="any" placeholder="Optional · facet centers only"></label><p class="seed-note">두께 검증 범위: 핵심 장갑 노출면 중심. 전면·가장자리 보장은 지원하지 않습니다.</p><label class="field">Maximum construction index<input id="maximum-cost" type="number" min="0.001" step="any" placeholder="Relative index · not currency"></label><label class="field">Available technology ceiling<select id="technology"><option value="">Shipyard capability</option>${options(['1', '2', '3', '4', '5'])}</select></label></details>
</div><section class="seed-section"><p id="input-validation" role="alert"></p><div id="legacy-order-notice" hidden><p>과거 설계 · 원본 형상과 설치 장비를 보존합니다.</p><button id="replay-legacy" class="secondary" type="button">Replay original generation contract</button><button id="convert-legacy" class="secondary" type="button">Convert to new unarmed order</button></div><button id="generate" class="primary" type="submit"><span>Generate unarmed design</span><span>✧</span></button><button id="regenerate" class="secondary" type="button">Regenerate same order / seed</button><button id="new-order" class="secondary" type="button">New procurement order</button><p id="order-status" role="status">발주서 준비 완료</p><div id="design-rejection"></div></section></form>`;
}
export function readProcurementForm(yard: string): ProcurementOrder {
    const value = (id: string) => $<HTMLInputElement>(id).value;
    const selection = (field: string) => { const mode = value(field + '-mode'); return mode === 'AUTO' ? { mode: 'AUTO' } : { mode, materialId: value(field + '-material') }; };
    const arch = value('architecture-mode'), min = value('minimum-critical-armor');
    return { version: '1.8.6.0.2', shipyardId: yard, shipClass: value('role'), lengthM: Number(value('length')), seed: value('seed').trim() ? Number(value('seed')) : NaN, targetMassKg: Number(value('target-dry-mass')) * 1000, primaryPriority: value('primary-priority'), ...(value('secondary-priority') ? { secondaryPriority: value('secondary-priority') } : {}), architecture: arch === 'AUTO' ? { mode: 'AUTO' } : { mode: arch, grammar: value('architecture-choice') }, mainArmor: selection('mainArmor'), auxiliaryArmor: selection('auxiliaryArmor'), hull: selection('hull'), armorDistribution: value('armor-distribution'), armorZoneRequirements: min ? [{ zone: 'CRITICAL_ZONE', verification: 'EXPOSED_FACET_CENTERS', minimumThicknessMm: Number(min) }] : [], ...(value('maximum-base-mass') ? { maximumBaseMassKg: Number(value('maximum-base-mass')) * 1000 } : {}), ...(value('maximum-cost') ? { maximumCostIndex: Number(value('maximum-cost')) } : {}), ...(value('technology') ? { availableTechLevel: Number(value('technology')) } : {}) } as ProcurementOrder;
}
export function applyProcurementForm(o: ProcurementOrder = DEFAULT_PROCUREMENT_ORDER) {
    const set = (id: string, v: string | number = '') => $<HTMLInputElement>(id).value = String(v);
    set('role', o.shipClass);
    set('length', o.lengthM);
    set('seed', o.seed);
    set('target-dry-mass', o.targetMassKg / 1000);
    set('primary-priority', o.primaryPriority);
    set('secondary-priority', o.secondaryPriority);
    set('maximum-base-mass', o.maximumBaseMassKg === undefined ? '' : o.maximumBaseMassKg / 1000);
    set('architecture-mode', o.architecture.mode);
    if (o.architecture.mode !== 'AUTO')
        set('architecture-choice', o.architecture.grammar);
    for (const field of ['mainArmor', 'auxiliaryArmor', 'hull'] as const) {
        set(field + '-mode', o[field].mode);
        set(field + '-material', o[field].mode === 'AUTO' ? 'AUTO' : o[field].materialId);
    }
    set('armor-distribution', o.armorDistribution);
    set('minimum-critical-armor', o.armorZoneRequirements[0]?.minimumThicknessMm);
    set('maximum-cost', o.maximumCostIndex);
    set('technology', o.availableTechLevel);
    syncProcurementFields();
}
export function syncProcurementFields(changed?: HTMLElement) {
    for (const field of ['mainArmor', 'auxiliaryArmor', 'hull']) {
        const mat = $<HTMLSelectElement>(field + '-material'), mode = $<HTMLSelectElement>(field + '-mode');
        if (changed === mat) {
            if (mat.value === 'AUTO')
                mode.value = 'AUTO';
            else if (mode.value === 'AUTO')
                mode.value = 'PREFER';
        }
        if (changed === mode && mode.value === 'AUTO')
            mat.value = 'AUTO';
    }
    $<HTMLSelectElement>('architecture-choice').disabled = $<HTMLSelectElement>('architecture-mode').value === 'AUTO';
    $('length-value').textContent = $<HTMLInputElement>('length').value + ' m';
}
export function procurementInputErrors(yard: string) { const errors = validateProcurementOrder(readProcurementForm(yard)); $('input-validation').textContent = errors.join(' · '); return errors; }
export function showProcurementResult(b: AnyShipBlueprint) {
    const root = $('procurement-result');
    root.replaceChildren();
    if (b.schemaVersion !== 2 || !b.procurement) {
        root.textContent = 'LEGACY DESIGN · Original order, geometry, material data and installed equipment retained. No new delivery policy is applied on load.';
        return;
    }
    const d = b.procurement, p = b.physicalDesign!, m = p.mass, l = m.ledger!, o = d.order;
    const line = (label: string, value: string) => { const row = document.createElement('div'), key = document.createElement('span'), text = document.createElement('strong'); row.className = 'result-row'; key.textContent = label; text.textContent = value; row.append(key, text); root.append(row); };
    const t = (v: number) => (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' t';
    const arm = p.surfaces.filter(s => s.kind === 'ARMOR'), mm = arm.map(s => s.thicknessMm);
    line('05 · Design result', d.status + ' · UNARMED BASE');
    line('Architecture', b.architecture.grammar);
    line('Protection', o.armorDistribution + ' · ' + d.materialDecisions.map(x => `${x.field}: ${MATERIALS[x.selected as keyof typeof MATERIALS]?.displayName ?? x.selected}`).join(' / '));
    line('Nominal armor thickness', `${Math.min(...mm).toFixed(1)}–${Math.max(...mm).toFixed(1)} mm · tapered boundaries vary`);
    line('Armor coverage', `${Object.entries(b.productionDesign!.coverage.directions).map(([k, v]) => `${k} ${(v.ratio * 100).toFixed(0)}%`).join(' / ')} · sampled source surfaces`);
    line('Hull / armor', t(m.hullShellMassKg) + ' / ' + t(m.armorMassKg));
    if(b.structuralFrame)line('Actual frame / connector',t(m.actualFrameMassKg??0)+' / '+t(m.actualStructuralConnectorMassKg??0));
    line('Other base mass (estimated)', t(l.baseEstimatedDryMassKg - m.hullShellMassKg - m.armorMassKg-(m.actualFrameMassKg??0)-(m.actualStructuralConnectorMassKg??0)));
    line('Base / target / maximum', `${t(l.baseEstimatedDryMassKg)} / ${t(o.targetMassKg)} / ${o.maximumBaseMassKg === undefined ? 'Unspecified' : t(o.maximumBaseMassKg)}`);
    line('Operational dry mass', t(m.totalEstimatedDryMassKg) + ' · mounted equipment counted separately');
    line('Construction cost', d.cost!.total.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' relative index · material + fabrication + estimated core');
    line('Mass confidence', b.structuralFrame?'Primary frame geometry derived; fittings/service equipment unresolved. Maximum checks estimated base, not certified actual mass.':'Frame / support estimated; upper limit checked against this estimate, not certified actual mass.');
    const details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = `Requirements & compromises · ${d.compromises.length}`;
    details.append(summary);
    for (const r of d.requirements) {
        const x = document.createElement('p');
        x.textContent = `${r.id}: ${r.status} · ${r.actual.toFixed(2)} / ${r.target.toFixed(2)} ${r.unit} · ${r.reason}`;
        details.append(x);
    }
    for (const text of d.compromises) {
        const x = document.createElement('p');
        x.textContent = text;
        details.append(x);
    }
    for(const rejected of d.candidateRejections??[]){const x=document.createElement('p');x.textContent=`Rejected hull candidate ${rejected.architecture}/${rejected.family}: ${rejected.reason}`;details.append(x);}
    const future = document.createElement('p');
    future.textContent = `Policy ${p.policy.future.status}: frame redundancy ${p.policy.future.frameRedundancyPreference.toFixed(2)}, subdivision ${p.policy.future.compartmentSubdivisionPreference.toFixed(2)}. Compartments, systems and endurance performance remain ungenerated.`;
    details.append(future);
    root.append(details);
}
