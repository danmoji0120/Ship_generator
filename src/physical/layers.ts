import type { ProtectionSurface, PhysicalPiece } from "./types";
import { solidCell, clipCell, cellVolume } from "./convex";
/** One finite coating cell stores its complete geometry. Material depth planes partition it
 * exactly; constituent geometry is derived on demand rather than triplicated in every export. */
export function pieceLayers(surface: ProtectionSurface, piece: PhysicalPiece) {
  const cell = solidCell(piece.solid);
  if (piece.layerOrder >= 0)
    return [{ cell, layerOrder: piece.layerOrder, volumeM3: cellVolume(cell) }];
  const facet = surface.facets[piece.facetIndex],
    n = facet.normal,
    plane = facet.planeOffsetM;
  let depth = 0;
  const out = [];
  for (const l of surface.layerStack) {
    const end =
        depth +
        ((l.thicknessMm / 1000) * facet.thicknessMm) / surface.thicknessMm,
      outer = clipCell(cell, n, plane - depth, true),
      slice = outer && clipCell(outer, n, plane - end, false);
    depth = end;
    if (slice) {
      const volumeM3 = cellVolume(slice);
      if (volumeM3 > 1e-9)
        out.push({ cell: slice, layerOrder: l.layerOrder, volumeM3 });
    }
  }
  return out;
}
