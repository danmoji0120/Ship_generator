import type { ShipBlueprint } from "../blueprint/types";
export function seedSequence(start: number, count: number) {
  if (
    !Number.isInteger(start) ||
    start < 0 ||
    start > 4294967295 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 40
  )
    throw new Error("QA seeds: uint32 start, count 1–40 required");
  return Array.from({ length: count }, (_, i) => (start + i) >>> 0);
}
export function designFeatures(b: ShipBlueprint) {
  const vs = b.structuralVolumes,
    sizes = vs.map((v) => v.dimensions.x * v.dimensions.y * v.dimensions.z),
    total = sizes.reduce((a, b) => a + b, 0);
  return {
    composition: b.architecture.composition,
    macroFamily: b.macroDesign?.family,
    shapes: vs.map((v) => v.shape?.kind),
    joins: b.structuralConnectors.map((c) => c.join?.type),
    nose: b.architecture.nose,
    engineLayout: b.architecture.engineArchitecture,
    primaryRatio: b.macroDesign?.primaryMassRatio ?? Math.max(...sizes) / total,
    foreMass:
      b.macroDesign?.foreMassRatio ??
      vs.reduce((s, v, i) => s + (v.position.z < 0 ? sizes[i] : 0), 0) / total,
    aftMass:
      b.macroDesign?.aftMassRatio ??
      vs.reduce((s, v, i) => s + (v.position.z >= 0 ? sizes[i] : 0), 0) / total,
    lateralSpread: b.dimensions.width / b.order.length,
    verticalSpread: b.dimensions.height / b.order.length,
    slenderness: b.silhouette.slenderness,
    topOccupancy: b.silhouette.occupancy.top,
    trussRatio:
      b.structuralConnectors.filter((c) => c.join?.type === "TRUSS").length /
      Math.max(1, b.structuralConnectors.length),
    tiers: vs.map((v) => v.hierarchyTier),
  };
}
export function diversityReport(blueprints: ShipBlueprint[]) {
  const features = blueprints.map(designFeatures),
    compositions = [...new Set(features.map((f) => f.composition))];
  const signatures = new Set(
    features.map((f) =>
      JSON.stringify({
        ...f,
        primaryRatio: +f.primaryRatio.toFixed(1),
        foreMass: +f.foreMass.toFixed(1),
        aftMass: +f.aftMass.toFixed(1),
        lateralSpread: +f.lateralSpread.toFixed(1),
        verticalSpread: +f.verticalSpread.toFixed(1),
        slenderness: +f.slenderness.toFixed(0),
        topOccupancy: +f.topOccupancy.toFixed(1),
      }),
    ),
  );
  const spread =
    Math.max(...features.map((f) => f.lateralSpread)) -
    Math.min(...features.map((f) => f.lateralSpread));
  const warnings: string[] = [];
  if (
    blueprints.length >= 20 &&
    (compositions.length < 2 || signatures.size < 12)
  )
    warnings.push(
      "Similar composition / feature vectors: inspect silhouettes manually.",
    );
  return {
    count: blueprints.length,
    compositions,
    uniqueSignatures: signatures.size,
    beamSpread: spread,
    warnings,
    features,
  };
}
