import type { Face } from '../../types.ts';
import { SectorGrid } from './_sector-grid.ts';

/**
 * KiteGrid: 4-sector triangular grid for quadrilateral faces that are not
 * parallelograms (e.g. the kite faces of Deltoidal Catalan solids).
 *
 * A RectGrid would give a kite four rows of cells that are not alike; the
 * sector fan gives it the same cells a pentagon or a hexagon gets.
 */
export class KiteGrid extends SectorGrid {
  constructor(face: Face, n: number) {
    super(face, n, 4, 'kite');
  }
}
