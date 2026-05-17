import type { Face } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { RectGrid } from '../grids/rect-grid.ts';
import { PentGrid } from '../grids/pent-grid.ts';
import { HexGrid } from '../grids/hex-grid.ts';
import { OctGrid } from '../grids/oct-grid.ts';
import { DecGrid } from '../grids/dec-grid.ts';

/**
 * Pick the FaceGrid implementation by face polygon size. Prism/antiprism
 * families mix multiple polygons on the same solid, so dispatch happens here
 * rather than per-shape.
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
