import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { compactBipyramid } from './_compact_bipyramid.ts';

/**
 * Octagonal Bipyramid (n=8) with aspect ratio h/r = 1.
 * 16 isosceles-triangle faces, 10 vertices, 24 edges. D_8h has central
 * inversion → every face has an antipode.
 */
export class OctagonalBipyramid extends Solid {
  protected readonly _faces = normalizeFaces(compactBipyramid(8), 1);
}
