import type { LayeringStyle } from './types';
/** Broad wrapping slabs; no yard selects tall narrow horns / fins as armor. */
export const ARMOR_LANGUAGES: Record<string, { depth: number; width: number; cap: number; end: number; overlap: number; secondary: number; style: LayeringStyle; shoulder: number }> = {
  aegis: { depth: .24, width: .99, cap: .94, end: .82, overlap: .025, secondary: .38, style: 'STEPPED', shoulder: 1.18 },
  vesper: { depth: .15, width: .97, cap: .88, end: .68, overlap: .045, secondary: .26, style: 'OVERLAPPING_SCALE', shoulder: .96 },
  forge: { depth: .20, width: .96, cap: .91, end: .90, overlap: .020, secondary: .32, style: 'ANGULAR_CAP', shoulder: 1.10 },
  serein: { depth: .16, width: .995, cap: .96, end: .80, overlap: .030, secondary: .28, style: 'EDGE_OVERLAY', shoulder: 1.02 },
};
