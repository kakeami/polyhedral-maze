import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { compactBipyramid } from './_compact_bipyramid.ts';

/**
 * Decagonal Bipyramid (n=10) with aspect ratio h/r = 1.
 * 20 isosceles-triangle faces, 12 vertices, 30 edges. D_10h has central
 * inversion → every face has an antipode.
 */
export class DecagonalBipyramid extends Solid {
  protected readonly _faces = normalizeFaces(compactBipyramid(10), 1);
}
