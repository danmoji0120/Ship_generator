import {createProcurementPolicy} from '../procurement/policy';
import type { ShipBlueprint } from "../blueprint/types";
import { DOCTRINES, solidVolume } from "../generation/production/doctrine";
import { ARMOR_MATERIALS, HULL_MATERIALS } from "./materials";
import type { ArmorMaterialId, HullMaterialId } from "./materials";
import type { DesignPolicy, PhysicalMass } from "./types";
import type { PhysicalSource } from "./geometry";
import { savedFit } from "../free-mount/planner";
import { platformPart } from "../free-mount/platform";
const sum = (ns: number[]) => ns.reduce((n, x) => n + x, 0);
/** Only actually present exterior/core equipment participates; all equipment masses remain estimates. */
export function coreEquipmentMass(b: ShipBlueprint) {
  const armorIds = new Set([
      ...(
        b.productionDesign?.armor ??
        b.structuralArmorPilot?.components ??
        []
      ).map((s) => s.id),
      ...(b.productionDesign?.finish ?? []).map((s) => s.id),
    ]),
    seen = new Set<string>();
  let volume = 0;
  for (const p of b.prefabPlacements ?? [])
    for (const q of p.assembly?.parts ?? []) {
      if (armorIds.has(q.id) || seen.has(q.id)) continue;
      seen.add(q.id);
      volume += solidVolume(q.solid);
    }
  return volume * 160;
}
/** Separate real installed equipment and its owned support; neither is a slot reservation. */
export function mountedMassComponents(b:ShipBlueprint){
 let equipmentKg=0,platformKg=0;
 for(const entry of b.freeMountPlan?.entries??[]){const fit=savedFit(entry);equipmentKg+=sum(fit.parts.filter(p=>p.id!==entry.id+'/platform').map(p=>solidVolume(p.solid)))*160;platformKg+=solidVolume(platformPart(entry.id,entry.platform).solid)*2800;}
 return {equipmentKg,platformKg};
}
export function playerEquipmentMass(b:ShipBlueprint){const p=mountedMassComponents(b);return p.equipmentKg+p.platformKg;}
export function createDesignPolicy(
  b: ShipBlueprint,
  sources: PhysicalSource[],
  minimumArmorMassKg = 0,
): DesignPolicy {
  if(b.procurement)return createProcurementPolicy(b,sources,minimumArmorMassKg);
  const p = b.order.priorities,
    role = DOCTRINES[b.role],
    yard = b.shipyardId,
    target = b.order.targetDryMassKg ?? b.dimensions.estimatedMass * 1000;
  if (!Number.isFinite(target) || target <= 0)
    throw Error("INVALID_TARGET_DRY_MASS");
  const tech = { aegis: 4, vesper: 4, forge: 3, serein: 5 }[yard] ?? 3;
  let hull: HullMaterialId =
    yard === "vesper" || p.mobility >= 75
      ? "LIGHT_STRUCTURAL_ALLOY"
      : yard === "serein" || p.endurance >= 80
        ? "TITANIUM_STRUCTURAL_ALLOY"
        : "HIGH_STRENGTH_STRUCTURAL_STEEL";
  let armor: ArmorMaterialId =
    yard === "serein"
      ? "NANO_LAMINATE"
      : yard === "vesper" || p.mobility >= 75
        ? "TITANIUM_ARMOR"
        : yard === "forge"
          ? "ARMORED_STEEL"
          : "CERAMIC_COMPOSITE";
  const critical: ArmorMaterialId =
    p.survivability >= 80 && yard !== "serein" ? "TUNGSTEN_COMPOSITE" : armor;
  const hullThicknessMm = Math.max(
    8,
    Math.min(
      42,
      (10 + b.order.length * 0.027) *
        (0.8 + role.protection * 0.18) *
        (p.mobility >= 80 ? 0.85 : 1) *
        (p.endurance >= 80 ? 1.08 : 1),
    ),
  );
  const hullConservative = sources
    .filter((s) => s.kind === "HULL")
    .reduce(
      (n, s) =>
        n +
        ((s.areaM2 * hullThicknessMm) / 1000) *
          HULL_MATERIALS[hull].densityKgM3,
      0,
    );
  const legacy = b.dimensions.estimatedMass * 1000,
    structural = legacy * 0.18,
    unresolved = legacy * 0.1,
    core = coreEquipmentMass(b);
  const floors = {
    structure: structural + hullConservative,
    armor: minimumArmorMassKg,
    propulsion: unresolved * 0.6,
    endurance: unresolved * 0.4,
    sensor: 0,
    equipment: core,
  };
  const fixed = sum(Object.values(floors));
  if (fixed >= target)
    throw Error(
      "REQUIRED_PHYSICAL_MASS_BUDGET_EXCEEDED: hull / retained equipment / estimated structural minimum exceed target",
    );
  const weights = {
      structure: 1.1,
      armor: role.protection * (0.5 + p.survivability / 20),
      propulsion: role.mobility * (0.6 + p.mobility / 25),
      endurance: role.endurance * (0.45 + p.endurance / 25),
      sensor: role.sensor * (0.3 + p.sensor / 30),
      equipment: 1 + p.firepower / 25 + p.missile / 35,
    },
    denom = sum(Object.values(weights));
  const allocationsKg = Object.fromEntries(
    Object.entries(weights).map(([k, w]) => [
      k,
      floors[k as keyof typeof floors] + ((target - fixed) * w) / denom,
    ]),
  ) as DesignPolicy["allocationsKg"];
  const tradeoffs = [
    ...(minimumArmorMassKg > 0
      ? [
          "Minimum finite armor skin budget secured before optional target reserves; surplus is still shared competitively.",
        ]
      : []),
    "Legacy volume-derived total is a target estimate, replaced by the new mass breakdown, never added to it.",
    "Existing doctrine equipment/support reservations are not additional measured mass.",
    "Armor footprint is bounded by retained geometry: increased coverage target cannot create plates across openings or previously unarmored gaps.",
    "Frame, bulkhead, supply and sensor capability values below are future policy only.",
  ];
  if (p.mobility >= 75)
    tradeoffs.push(
      "Mobility: lower-density hull/armor selected at higher manufacturing cost; normalized propulsion reserve competes with armor.",
    );
  if (p.endurance >= 75)
    tradeoffs.push(
      "Endurance: support reserve and redundancy/subdivision preferences increased; no fabricated internal rooms or simulated endurance bonus.",
    );
  if (Object.values(p).every((v) => v >= 80))
    tradeoffs.push(
      "All priorities high: fixed target mass retained, competing reserves normalized; simultaneous maximum targets cannot all be funded.",
    );
  if (b.freeMountPlan?.entries.length)
    tradeoffs.push(
      "Player equipment mass is reported as an estimate; free mounting remains EXTERNAL_GEOMETRY_ONLY, with no internal/feed/power/load or mass-budget installation gate.",
    );
  return {
    version: "1.8.6.0",
    priorityWeights: structuredClone(p),
    priorityMapping: {
      ARMOR: "survivability",
      MISSILES: "missile",
      SENSORS: "sensor",
    },
    targetMassBudgetKg: target,
    budgetSource:
      b.order.targetDryMassKg === undefined
        ? "LEGACY_ESTIMATE_AS_TARGET"
        : "ORDER_TARGET",
    allocationsKg,
    hullMaterialPreference: hull,
    armorMaterialPreference: armor,
    criticalArmorMaterialPreference: critical,
    hullThicknessMm,
    armorCoveragePreference: 0.7 + p.survivability * 0.0025,
    criticalZoneProtectionPreference: 0.5 + p.survivability * 0.005,
    future: {
      status: "POLICY_ONLY_NOT_GENERATED",
      frameDensityPreference: 0.5 + p.survivability / 200 - p.mobility / 500,
      frameRedundancyPreference: 0.2 + p.endurance / 180,
      compartmentSubdivisionPreference: 0.25 + p.endurance / 160,
      bulkheadProtectionPreference: 0.3 + p.survivability / 200,
      systemRedundancyPreference: 0.2 + p.endurance / 150,
      systemPlacementPreference:
        p.endurance >= 70 ? "DISTRIBUTED" : "PROTECTED_CORE",
      protectedVolumePreference: 0.35 + p.survivability / 250,
      propulsionSupportPreference: 0.3 + p.mobility / 140,
      fireControlProtectionPreference: 0.25 + p.firepower / 150,
      missileSupportProtectionPreference: 0.25 + p.missile / 150,
      sensorSupportProtectionPreference: 0.25 + p.sensor / 150,
    },
    costPreference: yard === "forge" ? 0.9 : yard === "serein" ? 0.3 : 0.6,
    manufacturingTechPreference: tech,
    tradeoffs,
    legacyDoctrineReference: "RESERVATION_MODEL_NOT_ADDITIONAL_PHYSICAL_MASS",
  };
}
export function finishPhysicalMass(b: ShipBlueprint): PhysicalMass {
  const d = b.physicalDesign!,
    policy = d.policy,
    legacy = b.dimensions.estimatedMass * 1000;
  const hullShellMassKg = sum(
      d.surfaces.filter((s) => s.kind === "HULL").map((s) => s.massKg),
    ),
    armorMassKg = sum(
      d.surfaces.filter((s) => s.kind === "ARMOR").map((s) => s.massKg),
    );
  const frame=b.structuralFrame, actualFrameMassKg=frame?.massAccounting.frameMassKg??0, actualStructuralConnectorMassKg=frame?.massAccounting.connectorMassKg??0;
  const interior=b.compartmentPlan?.massAccounting, actualBulkheadMassKg=interior?.bulkheadMassKg??0, actualClosureMassKg=interior?.closureMassKg??0;
  const structuralMassEstimateKg = frame?.massAccounting.remainingStructuralEstimateKg ?? legacy * 0.18,
    coreEquipmentMassEstimateKg = coreEquipmentMass(b),
    unresolvedMassEstimateKg = legacy * 0.1,
    mounted = mountedMassComponents(b),
    playerMountedEquipmentMassEstimateKg = mounted.equipmentKg+mounted.platformKg;
  const totalEstimatedDryMassKg =
    hullShellMassKg +
    armorMassKg +
    structuralMassEstimateKg + actualFrameMassKg + actualStructuralConnectorMassKg + actualBulkheadMassKg + actualClosureMassKg +
    coreEquipmentMassEstimateKg +
    unresolvedMassEstimateKg +
    playerMountedEquipmentMassEstimateKg;
  const baseEstimatedDryMassKg=hullShellMassKg+armorMassKg+structuralMassEstimateKg+actualFrameMassKg+actualStructuralConnectorMassKg+actualBulkheadMassKg+actualClosureMassKg+coreEquipmentMassEstimateKg+unresolvedMassEstimateKg;
  const ledger:NonNullable<PhysicalMass['ledger']>={version:1,entries:[
   {component:'HULL_SHELL',massKg:hullShellMassKg,source:'GEOMETRY_DERIVED',basis:'Finite shell material volumes × constituent kg/m³'},
   {component:'ARMOR',massKg:armorMassKg,source:'GEOMETRY_DERIVED',basis:'Sum of finite layer volumes × constituent kg/m³; rendered housings not counted again'},
   ...(frame?[
    {component:'STRUCTURAL_FRAME' as const,massKg:actualFrameMassKg,source:'GEOMETRY_DERIVED' as const,basis:'Exclusive finite internal frame material × shared registry density'},
    {component:'STRUCTURAL_CONNECTOR' as const,massKg:actualStructuralConnectorMassKg,source:'GEOMETRY_DERIVED' as const,basis:'Existing connector/rail material union, alias trusses excluded, skins subtracted'},
   ]:[]),
   ...(interior?[{component:'BULKHEAD' as const,massKg:actualBulkheadMassKg,source:'GEOMETRY_DERIVED' as const,basis:'Finite boundary material minus actual occupied stock and apertures'},{component:'DOOR_HATCH' as const,massKg:actualClosureMassKg,source:'GEOMETRY_DERIVED' as const,basis:'Real closure material in its sealed default position, no mass assigned to empty apertures'}]:[]),
   {component:'STRUCTURE',massKg:structuralMassEstimateKg,source:'LEGACY_ESTIMATE',basis:frame?frame.massAccounting.scope:'Unresolved frame proxy: 18% of legacy volume-based reference; not measured frame geometry'},
   {component:'CORE_EQUIPMENT',massKg:coreEquipmentMassEstimateKg,source:'ESTIMATED',basis:'Unique existing assembly-part solid volumes × 160kg/m³ representation density'},
   {component:'MOUNTED_EQUIPMENT',massKg:mounted.equipmentKg,source:'ESTIMATED',basis:'Actually installed saved equipment geometry × 160kg/m³, owned platform excluded'},
   {component:'PLATFORM',massKg:mounted.platformKg,source:'ESTIMATED',basis:'Owned platform geometry × 2800kg/m³, counted once'},
   {component:'OTHER_ESTIMATED',massKg:unresolvedMassEstimateKg,source:'LEGACY_ESTIMATE',basis:'Unresolved propulsion/support proxy: 10% of legacy reference; no tanks/reactors generated'}
  ],baseEstimatedDryMassKg,mountedEstimatedDryMassKg:totalEstimatedDryMassKg,targetSemantics:b.procurement?'SOFT_TARGET_WITH_OPTIONAL_MAXIMUM':'EXISTING_BASE_DESIGN_LIMIT',maximumAllowedMassKg:b.procurement?.order.maximumBaseMassKg??null,baseRemainingKg:policy.targetMassBudgetKg-baseEstimatedDryMassKg,mountedRemainingKg:policy.targetMassBudgetKg-totalEstimatedDryMassKg,baseBudgetViolation:b.procurement?baseEstimatedDryMassKg>(b.procurement.order.maximumBaseMassKg??Infinity)+1e-3:baseEstimatedDryMassKg>policy.targetMassBudgetKg+1e-3,mountedLoadoutOverTarget:totalEstimatedDryMassKg>policy.targetMassBudgetKg+1e-3,operationalConsumables:'NOT_INCLUDED'};
  return {
    ledger,
    hullShellMassKg,
    armorMassKg,
    structuralMassEstimateKg,
    ...(frame?{actualFrameMassKg,actualStructuralConnectorMassKg}:{}),
    ...(interior?{actualBulkheadMassKg,actualClosureMassKg}:{}),
    coreEquipmentMassEstimateKg,
    playerMountedEquipmentMassEstimateKg,
    unresolvedMassEstimateKg,
    totalEstimatedDryMassKg,
    targetMassKg: policy.targetMassBudgetKg,
    remainingMassKg: policy.targetMassBudgetKg - totalEstimatedDryMassKg,
    armorBudgetRemainingKg: policy.allocationsKg.armor - armorMassKg,
    manufacturingCostIndexKg: sum(
      d.surfaces.map(
        (s) =>
          s.massKg *
          (s.kind === "ARMOR"
            ? ARMOR_MATERIALS[s.materialId as keyof typeof ARMOR_MATERIALS]
            : HULL_MATERIALS[s.materialId as keyof typeof HULL_MATERIALS]
          ).manufacturingCostIndex,
      ),
    ),
    estimatedComponents: [
      ...(frame?[frame.massAccounting.scope,...frame.massAccounting.unquantified]:["Structural frame estimate: 18% of historical volume-based target; no new frame generated"]),
      "Unresolved propulsion/support estimate: 10% of historical target; not simulated tank/reactor systems",
      "Core/player equipment: existing visual solid volume × 160kg/m³ average representation density; player support platform × 2800kg/m³; estimates, not load simulation",
      "Dry mass excludes operational propellant/ammunition; future reserves are allowances, not installed equipment",
    ],
    legacyMassEstimateReplacedKg: legacy,
  };
}

/** Accounting refresh never validates or blocks an externally valid installation. */
export function refreshPhysicalMass(b: ShipBlueprint) {
  if (!b.physicalDesign) return b;
  b.physicalDesign = { ...b.physicalDesign, mass: finishPhysicalMass(b) };
  return b;
}
