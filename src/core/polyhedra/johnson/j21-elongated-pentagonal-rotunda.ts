import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformRotunda } from './_rotunda.ts';
import { elongate } from './_elongate.ts';

/**
 * Elongated Pentagonal Rotunda (J21). J6 stacked on a decagonal prism.
 * 27 faces: 10 triangles + 10 squares + 6 pentagons + 1 decagon. 30 vertices,
 * 55 edges.
 *
 * `uniformRotunda()` places the decagon at face id 1.
 */
export class ElongatedPentagonalRotunda extends Solid {
  protected readonly _faces = normalizeFaces(elongate(uniformRotunda(), 1), 1);
}
