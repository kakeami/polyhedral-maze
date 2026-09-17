import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupola } from './_cupola.ts';
import { elongate } from './_elongate.ts';

/**
 * Elongated Square Cupola (J19). J4 stacked on an octagonal prism.
 * 18 faces: 4 triangles + 13 squares + 1 octagon. 20 vertices, 36 edges.
 */
export class ElongatedSquareCupola extends Solid {
  protected readonly _faces = normalizeFaces(elongate(uniformCupola(4), 1), 1);
}
