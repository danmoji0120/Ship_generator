import {HULL_MATERIALS} from '../physical/materials';
import type { ShipBlueprint } from '../blueprint/types';
import { MATERIALS } from '../physical/materials';
import { preparePhysicalQueries } from '../physical/probe';
import { solidTriangles, normal, area } from '../generation/armor/panels';
import { dot, center, add, mul } from '../generation/integration/contours';
import { geometryOrder, validateProcurementOrder, rejectProcurement } from './order';
import { procurementMaterials } from './policy';
export function procurementCost(b: ShipBlueprint) {
    const frame=b.structuralFrame,d = b.physicalDesign!, material = d.surfaces.reduce((n, s) => n + s.massKg * MATERIALS[s.materialId].manufacturingCostIndex, 0);
    const fabrication = d.surfaces.reduce((n, s) => n + s.physicalOuterAreaM2 * (8 + 3 * (s.layerStack.length - 1)) * (1 + MATERIALS[s.materialId].requiredTechLevel * .1), 0) + b.order.length ** 2 * (b.structuralVolumes.length * 12 + (frame?0:b.structuralConnectors.length * 6) + new Set(d.surfaces.map(s => s.materialId)).size ** 2 * 2);
    const estimatedStructureAndCore = d.mass.structuralMassEstimateKg * .3 + d.mass.coreEquipmentMassEstimateKg * 2, yardProcessFactor = { aegis: 1, vesper: 1.12, forge: .85, serein: 1.25 }[b.shipyardId] ?? 1;
    const structuralMaterial=frame?.members.reduce((n,m)=>n+m.massKg*HULL_MATERIALS[m.materialId].manufacturingCostIndex,0)??0,structuralFabrication=frame?frame.members.reduce((n,m)=>n+m.lengthM*(12+4*HULL_MATERIALS[m.materialId].requiredTechLevel)*(m.section.widthM+m.section.heightM),0)+frame.joints.length*200+new Set(frame.members.map(m=>[m.section.kind,m.section.widthM.toFixed(3),m.section.heightM.toFixed(3)].join('/'))).size*2000:0;
    const interior=b.compartmentPlan,interiorMaterial=interior?interior.bulkheads.reduce((n,w)=>n+w.massKg*HULL_MATERIALS[w.materialId].manufacturingCostIndex,0)+interior.openings.reduce((n,o)=>n+(o.closure?o.closure.massKg*HULL_MATERIALS[o.closure.materialId].manufacturingCostIndex:0),0):0,interiorFabrication=interior?interior.bulkheads.reduce((n,w)=>n+w.grossAreaM2*(6+HULL_MATERIALS[w.materialId].requiredTechLevel*2),0)+interior.openings.length*250+new Set(interior.bulkheads.map(w=>w.materialId+'/'+w.thicknessMm)).size*500:0;
    return { model: interior?'MATERIAL_FRAME_INTERIOR_INDEX_V3' as const:frame?'MATERIAL_FRAME_AND_FABRICATION_INDEX_V2' as const:'MATERIAL_AND_FABRICATION_INDEX_V1' as const,...(frame?{structuralMaterial,structuralFabrication}:{}), ...(interior?{interiorMaterial,interiorFabrication}:{}), unit: 'RELATIVE_INDEX_NOT_CURRENCY' as const, material, fabrication, estimatedStructureAndCore, yardProcessFactor, total: (material + fabrication + estimatedStructureAndCore + structuralMaterial + structuralFabrication + interiorMaterial + interiorFabrication) * yardProcessFactor, assumptions: [...(interior?['Interior: actual boundary/closure mass × registry cost; gross area × (6+2×tech) + portal count×250 + section/material variants×500, relative index only.']:[]),'Material: actual finite layer mass × shared registry manufacturing cost index.', 'Fabrication: surviving area × layer/technology processing factor; distinct materials, structural modules and real connectors add process complexity.', ...(frame?['Frame: exclusive material mass × registry cost; fabrication = real member length × section perimeter × technology processing factor + actual joint count × 200 + section variant count × 2000. Relative manufacturing assumptions, not currency.','Remaining support/core retain estimated cost; no cost for uninstalled weapons.']:['Frame/core costs use explicitly estimated mass; no market prices or currency, no cost for uninstalled player weapons.'])] };
}
export function criticalCenterThickness(b: ShipBlueprint) {
    const q = preparePhysicalQueries(b);
    let minimum = Infinity, samples = 0;
    for (const s of b.physicalDesign!.surfaces.filter(s => s.kind === 'ARMOR' && s.protectionZoneId === 'CRITICAL')) {
        const centers = new Map<number, {
            point: ReturnType<typeof center>;
            area: number;
        }>();
        for (const piece of s.pieces) {
            const f = s.facets[piece.facetIndex];
            for (const tri of solidTriangles(piece.solid))
                if (dot(normal(tri), f.normal) > .99999 && tri.every(v => Math.abs(dot(v, f.normal) - f.planeOffsetM) < 1e-6)) {
                    const a = area(tri);
                    if (a > (centers.get(piece.facetIndex)?.area ?? 0))
                        centers.set(piece.facetIndex, { point: center(tri), area: a });
                }
        }
        for (const [index, c] of centers) {
            const n = s.facets[index].normal, padding = .05, r = q.probe(add(c.point, mul(n, padding)), mul(n, -1), padding + Math.max(.1, s.thicknessMm / 1000 * 3)), intervals = r.hits.filter(h => h.surfaceId === s.id).sort((a, c) => a.entryDistanceM - c.entryDistanceM);
            let length = 0, last = -Infinity;
            for (const h of intervals) {
                length += Math.max(0, h.exitDistanceM - Math.max(last, h.entryDistanceM));
                last = Math.max(last, h.exitDistanceM);
            }
            minimum = Math.min(minimum, length * 1000);
            samples++;
        }
    }
    return { minimumMm: samples ? minimum : 0, samples, scope: 'LARGEST_SURVIVING_OUTER_TRIANGLE_CENTER_PER_CRITICAL_FACET; not full-surface or edge minimum' };
}
export function procurementDesignIssues(b: ShipBlueprint) {
    const p = b.procurement;
    if (!p)
        return [];
    const issues = validateProcurementOrder(p.order), d = b.physicalDesign;
    if (issues.length)
        return issues;
    if (p.version !== '1.8.6.0.2' || p.contract !== 'UNARMED_YARD_DESIGN' || !['PASS', 'COMPROMISE'].includes(p.status) || !d)
        return [...issues, 'Invalid procurement delivery contract'];
    if (JSON.stringify(b.order) !== JSON.stringify(geometryOrder(p.order)) || b.seed !== p.order.seed || b.shipyardId !== p.order.shipyardId || b.role !== p.order.shipClass)
        issues.push('Native order/geometry compatibility bridge differs');
    if (b.designRequirements || b.designDoctrine || b.hardpoints.length || b.weaponLayout?.mounts.length || b.weaponLayout?.integrated?.length || b.weaponLayout?.composition.length || b.prefabPlacements?.some(p => ['turret', 'missile', 'electronic-warfare'].includes(p.functionality)))
        issues.push('Automated combat equipment/role reservations forbidden on native base');
    if (!b.engines.length || !p.coreSystems?.navigationControlIds.length || p.coreSystems.navigationControlIds.some(id => !b.prefabPlacements?.some(v => v.id === id && v.functionality === 'sensor')))
        issues.push('Essential propulsion/navigation control absent');
    const a = d.surfaces.filter(s => s.kind === 'ARMOR' && s.protectionZoneId === 'CRITICAL'), aux = d.surfaces.filter(s => s.kind === 'ARMOR' && s.protectionZoneId !== 'CRITICAL'), h = d.surfaces.filter(s => s.kind === 'HULL');
    for (const [field, surfaces] of [['mainArmor', a], ['auxiliaryArmor', aux], ['hull', h]] as const) {
        const selection = p.order[field];
        if (selection.mode === 'REQUIRE' && (!surfaces.length || surfaces.some(s => s.materialId !== selection.materialId)))
            issues.push('REQUIRED_MATERIAL_NOT_APPLIED: ' + field);
    }
    const tech = procurementMaterials(p.order).tech;
    if (d.surfaces.some(s => MATERIALS[s.materialId].requiredTechLevel > tech))
        issues.push('REQUIRED_MATERIAL_TECH_UNAVAILABLE');
    if (p.order.architecture.mode === 'REQUIRE' && b.architecture.grammar !== p.order.architecture.grammar)
        issues.push('REQUIRED_ARCHITECTURE_NOT_APPLIED');
    if (p.order.maximumBaseMassKg !== undefined && d.mass.ledger!.baseEstimatedDryMassKg > p.order.maximumBaseMassKg + 1e-3)
        issues.push('REQUIRED_MAXIMUM_BASE_MASS_EXCEEDED');
    const cost = procurementCost(b);
    if (!p.cost || JSON.stringify(cost) !== JSON.stringify(p.cost))
        issues.push('Construction cost estimate differs from actual design');
    if (p.order.maximumCostIndex !== undefined && cost.total > p.order.maximumCostIndex)
        issues.push('REQUIRED_CONSTRUCTION_COST_EXCEEDED');
    if (p.order.armorZoneRequirements.length) {
        const measured = criticalCenterThickness(b);
        if (!measured.samples || measured.minimumMm + 1e-4 < p.order.armorZoneRequirements[0].minimumThicknessMm)
            issues.push('REQUIRED_CRITICAL_CENTER_THICKNESS_UNAVAILABLE');
    }
    if (p.status === 'PASS' && (p.compromises.length || d.mass.ledger!.baseEstimatedDryMassKg > p.order.targetMassKg + 1e-3))
        issues.push('Procurement compromise incorrectly marked PASS');
    return issues;
}
export function finishProcurementDelivery(b: ShipBlueprint) {
    const p = b.procurement!, d = b.physicalDesign!, o = p.order, chosen = procurementMaterials(o), policy = d.policy;
    const selected = { mainArmor: policy.criticalArmorMaterialPreference, auxiliaryArmor: policy.armorMaterialPreference, hull: policy.hullMaterialPreference };
    p.materialDecisions = chosen.decisions.map(v => ({ ...v, selected: selected[v.field], reason: v.selected !== selected[v.field] ? 'Preferred material substituted to respect the maximum base mass minimum' : v.reason }));
    for (const v of p.materialDecisions)
        if (o[v.field].mode === 'PREFER' && v.requested !== v.selected)
            p.compromises.push(`${v.field}: ${v.reason} (${v.requested} → ${v.selected})`);
    if(b.compartmentPlan?.compartments.some(c=>c.pressureCapability==='EXPOSED'))p.compromises.push('Some finite interior spaces have an actual exterior opening; they are EXPOSED, not pressure-capable chambers.');
    if(b.compartmentPlan?.compartments.some(c=>c.boundaryCertainty==='UNRESOLVED'))p.compromises.push('Interior boundary precision is unresolved in '+b.compartmentPlan.compartments.filter(c=>c.boundaryCertainty==='UNRESOLVED').map(c=>c.id).join(', ')+'; pressure capability is not certified in those spaces.');
    if(b.compartmentPlan?.regions.some(r=>r.state==='UNRESOLVED'))p.compromises.push('Interior pressure boundaries remain unresolved in '+b.compartmentPlan.regions.filter(r=>r.state==='UNRESOLVED').map(r=>r.volumeId).join(', ')+'; no pressurizable room was invented in those regions.');
    const base = d.mass.ledger!.baseEstimatedDryMassKg;
    if (base > o.targetMassKg + 1e-3)
        p.compromises.push(`Soft target missed: actual estimated base ${base.toFixed(1)}kg > target ${o.targetMassKg}kg. Hard maximum remains independently enforced.`);
    if(b.structuralFrame){p.massConfidence='FRAME_GEOMETRY_WITH_UNRESOLVED_SUPPORT_AND_FITTINGS';}
    p.coreSystems = { propulsionIds: b.engines.map(e => e.id), navigationControlIds: (b.prefabPlacements ?? []).filter(v => v.functionality === 'sensor').map(v => v.id), description: 'Existing attached propulsion/nozzles, navigation/control housings and visual RCS. No simulated reactor, navigation performance, endurance or flight bonus is claimed.' };
    p.cost = procurementCost(b);
    p.requirements = [{ id: 'unarmed-delivery', mandatory: true, status: 'SATISFIED', actual: 0, target: 0, unit: 'automatic offensive mounts', reason: 'Automatic composition planner and role weapon requirements bypassed; player loadout remains separate.' }, { id: 'base-mass', mandatory: o.maximumBaseMassKg !== undefined, status: o.maximumBaseMassKg === undefined && base > o.targetMassKg ? 'LIMITED' : 'SATISFIED', actual: base, target: o.maximumBaseMassKg ?? o.targetMassKg, unit: 'estimated kg', reason: b.structuralFrame?'Measured finite primary frame replaces macro-frame proxy; unresolved fittings/service equipment keep compliance estimated.':'Includes unresolved frame/support estimates; compliance is an estimate, not a certified true mass bound.' }];
    if(b.compartmentPlan)p.requirements.push({id:'interior-boundaries',mandatory:false,status:b.compartmentPlan.compartments.some(c=>c.pressureCapability!=='PRESSURIZABLE')||b.compartmentPlan.regions.some(r=>r.state==='UNRESOLVED')?'LIMITED':'SATISFIED',actual:b.compartmentPlan.compartments.filter(c=>c.pressureCapability==='PRESSURIZABLE').length,target:b.compartmentPlan.compartments.length,unit:'finite pressure-capable spaces',reason:'Actual CSG empty space and physical boundaries/portals; unresolved external skins or numerical seams are not certified airtight. No pressure or oxygen runtime.'});
    if(b.structuralFrame)p.requirements.push({id:'structural-connectivity',mandatory:true,status:'SATISFIED',actual:b.structuralFrame.analysis.components.length,target:1,unit:'connected material network',reason:'Every module reaches the real root network through finite members and geometric weld contacts; not a strength certification.'});
    if (o.armorZoneRequirements.length) {
        const measured = criticalCenterThickness(b), requirement = o.armorZoneRequirements[0];
        p.requirements.push({ id: 'critical-center-thickness', mandatory: true, status: 'SATISFIED', actual: measured.minimumMm, target: requirement.minimumThicknessMm, unit: 'mm', reason: `${measured.samples} actual finite-volume center rays. ${measured.scope}. Hull thickness excluded.` });
    }
    p.compromises = [...new Set(p.compromises)];
    p.status = p.compromises.length ? 'COMPROMISE' : 'PASS';
    const issues = procurementDesignIssues(b);
    if (issues.length)
        rejectProcurement(issues.find(s => s.startsWith('REQUIRED_'))?.split(':')[0] ?? 'REQUIRED_PROCUREMENT_DESIGN_INVALID', issues.join('; '));
}
