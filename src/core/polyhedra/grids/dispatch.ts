import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import { TriGrid } from './tri-grid.ts';
import { RectGrid } from './rect-grid.ts';
import { PentGrid } from './pent-grid.ts';
import { HexGrid } from './hex-grid.ts';
import { OctGrid } from './oct-grid.ts';
import { DecGrid } from './dec-grid.ts';

/**
 * Pick the FaceGrid implementation by face polygon size.
 *
 * This is what a solid does with its faces unless it says otherwise (see
 * `Solid` in `../_solid.ts`): the number of sides decides the grid, and a
 * solid that mixes polygons — a prism, a cupola, a truncation — needs to say
 * nothing at all. The one thing the count cannot settle is a quadrilateral,
 * which is a RectGrid here and a KiteGrid on the solids whose quads have no
 * parallel sides; those seven say so themselves.
 */
export function gridForPolygonFace(face: Face, n: number): FaceGrid {
  switch (face.vertices.length) {
    case 3:
      return new TriGrid(face, n);
    case 4:
      return new RectGrid(face, n);
    case 5:
      return new PentGrid(face, n);
    case 6:
      return new HexGrid(face, n);
    case 8:
      return new OctGrid(face, n);
    case 10:
      return new DecGrid(face, n);
    default:
      throw new Error(
        `gridForPolygonFace: unsupported polygon (${face.vertices.length}-gon)`,
      );
  }
}
