import type { Face } from '../../types.ts';
import { SectorGrid } from './_sector-grid.ts';

/**
 * DecGrid: 10-sector triangular grid for decagonal faces. 10n² cells.
 *
 * Note: at large n the central cells become very narrow wedges. Recommended
 * to keep n ≤ 3 for visual clarity.
 */
export class DecGrid extends SectorGrid {
  constructor(face: Face, n: number) {
    super(face, n, 10, 'dec');
  }
}
