/** Game engineering specifications, not experimentally calibrated ballistic performance. */
export interface MaterialLayerDefinition {
  id: string;
  constituentMaterialId: string;
  fraction: number;
  densityKgM3: number;
  physicalRole: string;
  futureFailureModelId: string;
}
export interface PhysicalMaterial {
  materialId: string;
  displayName: string;
  materialFamily: string;
  densityKgM3: number;
  manufacturingCostIndex: number;
  requiredTechLevel: number;
  constructionProperties: string[];
  failureBehaviorProfile: string[];
  layerDefinition: readonly MaterialLayerDefinition[];
}
const layer = (
  id: string,
  constituentMaterialId: string,
  fraction: number,
  densityKgM3: number,
  physicalRole: string,
): MaterialLayerDefinition => ({
  id,
  constituentMaterialId,
  fraction,
  densityKgM3,
  physicalRole,
  futureFailureModelId:
    constituentMaterialId.toLowerCase() + "-pending-v1.8.6.4",
});
function material(
  materialId: string,
  displayName: string,
  materialFamily: string,
  cost: number,
  tech: number,
  layers: MaterialLayerDefinition[],
  properties: string[],
  failure: string[],
): PhysicalMaterial {
  return Object.freeze({
    materialId,
    displayName,
    materialFamily,
    densityKgM3: layers.reduce((n, l) => n + l.fraction * l.densityKgM3, 0),
    manufacturingCostIndex: cost,
    requiredTechLevel: tech,
    layerDefinition: Object.freeze(layers.map((l) => Object.freeze(l))),
    constructionProperties: Object.freeze(properties) as unknown as string[],
    failureBehaviorProfile: Object.freeze(failure) as unknown as string[],
  });
}
export const ARMOR_MATERIALS = Object.freeze({
  ARMORED_STEEL: material(
    "ARMORED_STEEL",
    "고강도 장갑강",
    "METAL",
    1,
    1,
    [layer("steel", "ARMOR_STEEL", 1, 7850, "DUCTILE_ARMOR")],
    ["Ductile metal; stable manufacturing"],
    [
      "Plastic deformation; local perforation; repeated-impact response pending",
    ],
  ),
  TITANIUM_ARMOR: material(
    "TITANIUM_ARMOR",
    "티타늄 합금 장갑",
    "METAL",
    3.2,
    2,
    [layer("titanium", "ARMOR_TITANIUM", 1, 4500, "LIGHT_METAL_ARMOR")],
    ["Lower density; expensive processing"],
    [
      "Local deformation; no automatic superiority over steel at equal thickness",
    ],
  ),
  CERAMIC_COMPOSITE: material(
    "CERAMIC_COMPOSITE",
    "세라믹 복합장갑",
    "COMPOSITE",
    2.4,
    3,
    [
      layer("ceramic", "CERAMIC_STRIKE_FACE", 0.5, 3200, "HARD_STRIKE_FACE"),
      layer("support", "STEEL_BACKING", 0.3, 7850, "DUCTILE_SUPPORT"),
      layer("spall", "FIBER_SPALL_BACKING", 0.2, 1725, "FRAGMENT_BACKING"),
    ],
    ["Ceramic strike face with separate support and backer"],
    [
      "Localized cracking; repeated hits must reference actual damaged location",
    ],
  ),
  TUNGSTEN_COMPOSITE: material(
    "TUNGSTEN_COMPOSITE",
    "텅스텐 복합장갑",
    "COMPOSITE",
    5,
    3,
    [
      layer("heavy", "TUNGSTEN_RICH_ALLOY", 0.5, 18000, "DENSE_STRIKE_LAYER"),
      layer("support", "TITANIUM_BACKING", 0.25, 4500, "STRUCTURAL_SUPPORT"),
      layer("spall", "LIGHT_SPALL_BACKING", 0.25, 1500, "FRAGMENT_BACKING"),
    ],
    ["Concentrated dense protection; costly fabrication"],
    [
      "Heavy layer and support fail separately; mean density is not pure tungsten density",
    ],
  ),
  NANO_LAMINATE: material(
    "NANO_LAMINATE",
    "나노 적층 복합장갑",
    "SF_SPECIAL",
    8,
    5,
    [
      layer("nano-hard", "SF_HARD_LAMINATE", 0.4, 7000, "IMPACT_DISTRIBUTION"),
      layer("nano-tough", "SF_TOUGH_LAMINATE", 0.35, 5000, "TOUGH_SUPPORT"),
      layer(
        "nano-back",
        "SF_SPALL_LAMINATE",
        0.25,
        2600,
        "FRAGMENT_DISTRIBUTION",
      ),
    ],
    ["Advanced laminate; high cost and technical complexity"],
    ["Localized delamination and damage propagation; no invulnerability"],
  ),
});
export const HULL_MATERIALS = Object.freeze({
  LIGHT_STRUCTURAL_ALLOY: material(
    "LIGHT_STRUCTURAL_ALLOY",
    "알루미늄계 구조 경합금",
    "STRUCTURAL",
    1.2,
    1,
    [layer("alloy", "ALUMINUM_STRUCTURAL", 1, 2800, "STRUCTURAL_SHELL")],
    ["Light structural skin; frame strength modeled separately"],
    ["Thin shell perforation; not ballistic armor"],
  ),
  TITANIUM_STRUCTURAL_ALLOY: material(
    "TITANIUM_STRUCTURAL_ALLOY",
    "티타늄계 구조 합금",
    "STRUCTURAL",
    3,
    2,
    [layer("alloy", "TITANIUM_STRUCTURAL", 1, 4500, "STRUCTURAL_SHELL")],
    ["Lightweight strong structural alloy"],
    ["Structural failure model pending; no armor equivalence"],
  ),
  HIGH_STRENGTH_STRUCTURAL_STEEL: material(
    "HIGH_STRENGTH_STRUCTURAL_STEEL",
    "고강도 구조강",
    "STRUCTURAL",
    1,
    1,
    [layer("steel", "STEEL_STRUCTURAL", 1, 7850, "STRUCTURAL_SHELL")],
    ["Economical load-support skin"],
    ["Thin structural shell; frame and connections modeled separately"],
  ),
});
export type ArmorMaterialId = keyof typeof ARMOR_MATERIALS;
export type HullMaterialId = keyof typeof HULL_MATERIALS;
export const MATERIALS: Readonly<Record<string, PhysicalMaterial>> =
  Object.freeze({ ...ARMOR_MATERIALS, ...HULL_MATERIALS });
export const FUTURE_DAMAGE_INTERACTIONS = [
  "KINETIC",
  "SHAPED_CHARGE",
  "FRAGMENT",
  "SURFACE_BLAST",
  "LOCAL_DAMAGE",
  "LAYER_PROPAGATION",
  "REPEATED_LOCAL_IMPACT",
] as const;
export interface FutureMaterialDamageModel {
  materialId: string;
  interactions: typeof FUTURE_DAMAGE_INTERACTIONS;
  calibration: "PENDING_V1.8.6.4";
}
export function materialLayers(id: string, thicknessMm: number) {
  const m = MATERIALS[id];
  if (!m || !Number.isFinite(thicknessMm) || thicknessMm <= 0)
    throw Error("INVALID_PHYSICAL_MATERIAL_OR_THICKNESS");
  return m.layerDefinition.map((l, i) => ({
    layerId: l.id,
    layerOrder: i,
    constituentMaterialId: l.constituentMaterialId,
    thicknessMm: thicknessMm * l.fraction,
    densityKgM3: l.densityKgM3,
    physicalRole: l.physicalRole,
    futureFailureModelId: l.futureFailureModelId,
  }));
}
