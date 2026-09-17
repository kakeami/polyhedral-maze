import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { compactBipyramid } from './_compact_bipyramid.ts';

/**
 * Hexagonal Bipyramid (n=6) with aspect ratio h/r = 1.
 * 12 isosceles-triangle faces, 8 vertices, 18 edges. D_6h has central
 * inversion → every face has an antipode.
 */
export class HexagonalBipyramid extends Solid {
  protected readonly _faces = normalizeFaces(compactBipyramid(6), 1);
}
