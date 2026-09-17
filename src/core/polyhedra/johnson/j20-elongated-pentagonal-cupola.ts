import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupola } from './_cupola.ts';
import { elongate } from './_elongate.ts';

/**
 * Elongated Pentagonal Cupola (J20). J5 stacked on a decagonal prism.
 * 22 faces: 5 triangles + 15 squares + 1 pentagon + 1 decagon. 25 vertices,
 * 45 edges.
 */
export class ElongatedPentagonalCupola extends Solid {
  protected readonly _faces = normalizeFaces(elongate(uniformCupola(5), 1), 1);
}
