import type { Face } from '../../types.ts';
import { SectorGrid } from './_sector-grid.ts';

/** PentGrid: 5-sector triangular grid for pentagonal faces. 5n² cells. */
export class PentGrid extends SectorGrid {
  constructor(face: Face, n: number) {
    super(face, n, 5, 'pent');
  }
}
