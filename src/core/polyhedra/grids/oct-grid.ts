import type { Face } from '../../types.ts';
import { SectorGrid } from './_sector-grid.ts';

/** OctGrid: 8-sector triangular grid for octagonal faces. 8n² cells. */
export class OctGrid extends SectorGrid {
  constructor(face: Face, n: number) {
    super(face, n, 8, 'oct');
  }
}
