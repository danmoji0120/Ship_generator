import type { PhysicalDesign } from '../physical/types';
import { boundsIndex } from '../generation/hardpoint-system/geometry';
import { boundsOf } from '../generation/integration/contours';
import { solidCell } from '../physical/convex';
/** One ephemeral bounds index per mandatory integration pass; cells materialize on demand.
 * It is neither serialized nor retained as a debug/ray query accelerator. */
export function structuralSkinContext(d: PhysicalDesign) {
    const items = d.surfaces.flatMap(surface => surface.pieces.map((piece, pieceIndex) => ({ surface, piece, pieceIndex, bounds: boundsOf(piece.solid.vertices) }))), near = boundsIndex(items), cells = new WeakMap<object, ReturnType<typeof solidCell>>();
    return { items, near, cell(item: typeof items[number]) {
            let c = cells.get(item);
            if (!c) {
                c = solidCell(item.piece.solid);
                cells.set(item, c);
            }
            return c;
        } };
}
export type StructuralSkinContext = ReturnType<typeof structuralSkinContext>;
