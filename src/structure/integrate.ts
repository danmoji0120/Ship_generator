import { structuralSkinContext } from './skin-context';
import { addHullSkinSupports } from './skin-support';
import type { ShipBlueprint } from '../blueprint/types';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import { boundsOf } from '../generation/integration/contours';
import { solidCell, subtractCell } from '../physical/convex';
import { refreshPhysicalMass } from '../physical/policy';
import { timedPhysical } from '../physical/diagnostics';
import { convexParts, structuralMaterialVolume, closedStructuralSolid } from './geometry';
import { updateStructuralMass } from './build';
import type { StructuralFramePlan } from './types';
let integratedCache: {
    key: string;
    plan: StructuralFramePlan;
} | undefined;
export const clearStructuralIntegrationCache = () => { integratedCache = undefined; };
export const structuralIntegrationCacheBytes = () => integratedCache ? 2 * (integratedCache.key.length + JSON.stringify(integratedCache.plan).length) : 0;
/** Skin owns existing exterior material first; frame owns the remaining finite material.
 * Keeps the original renderer and external Armor/Hull probe entirely unchanged. */
export function integrateStructuralMaterial(b: ShipBlueprint) {
    return timedPhysical('Structural skin integration', () => {
        const f = b.structuralFrame, d = b.physicalDesign;
        if (!f || !d)
            throw Error('STRUCTURAL_SKIN_DATA_ABSENT');
        if (f.materialIntegration === 'SKINS_SUBTRACTED')
            return b;
        const key = JSON.stringify([f.sourceSignature, d.surfaces.map(s => [s.id, s.materialId, s.thicknessMm, s.pieces.map(p => p.solid)])]);
        if (integratedCache?.key === key)
            b.structuralFrame = structuredClone(integratedCache.plan);
        else {
            const context = structuralSkinContext(d);
            timedPhysical('Hull skin support ties', () => addHullSkinSupports(b, context));
            for (const m of f.members) {
                const owned = [];
                for (const p of m.pieces) {
                    let pieces = convexParts(p);
                    for (const skin of context.near(boundsOf(p.vertices))) {
                        const cell = context.cell(skin);
                        pieces = pieces.flatMap(p => subtractCell(p, cell!));
                        if (!pieces.length)
                            break;
                    }
                    owned.push(...pieces);
                }
                m.pieces = owned.map(closedStructuralSolid);
                m.volumeM3 = m.pieces.reduce((n, s) => n + structuralMaterialVolume(s), 0);
                m.massKg = m.volumeM3 * m.densityKgM3;
                if (m.volumeM3 < 1e-9)
                    throw Error('REQUIRED_FRAME_MATERIAL_FULLY_OCCUPIED_BY_SKIN ' + m.id);
            }
            for (const v of f.volumeFrames)
                v.hullShellRefs = d.surfaces.filter(s => s.kind === 'HULL' && s.geometryReference.parentStructureId === v.volumeId).map(s => s.id);
            f.materialIntegration = 'SKINS_SUBTRACTED';
            updateStructuralMass(f);
            f.warnings.push('Hull/armor have first material ownership. Frame union excludes their finite solids; nominal welded envelopes remain as construction/contact evidence.');
            integratedCache = { key, plan: structuredClone(f) };
        }
        refreshPhysicalMass(b);
        return b;
    });
}
