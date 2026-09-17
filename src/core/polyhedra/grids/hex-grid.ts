import type { Face } from '../../types.ts';
import { SectorGrid } from './_sector-grid.ts';

/** HexGrid: 6-sector triangular grid for hexagonal faces. 6n² cells. */
export class HexGrid extends SectorGrid {
  constructor(face: Face, n: number) {
    super(face, n, 6, 'hex');
  }
}
