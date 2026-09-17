import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { Dodecahedron } from '../platonic/dodecahedron.ts';
import { augmentFaces, findFaceAtDistance } from './_augment.ts';

function buildFaces() {
  const base = new Dodecahedron().faces();
  // Pick three pentagonal faces such that every pair is at face-graph
  // distance 2 (mutually meta, never adjacent or antipodal).
  const second = findFaceAtDistance(base, 0, 2);
  if (second < 0) throw new Error('J61: second face not found');
  const third = findFaceAtDistance(base, 0, 2, [second]);
  if (third < 0) throw new Error('J61: third face not found');
  return augmentFaces(base, [0, second, third], 'pyramid');
}

/**
 * Triaugmented Dodecahedron (J61). Dodecahedron with pentagonal pyramids
 * (J2) attached to three pentagonal faces, every pair being meta to every
 * other (no two pyramids share an edge or sit antipodally). 24 faces
 * (15 triangles + 9 pentagons), 23 vertices, 45 edges.
 */
export class TriaugmentedDodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(buildFaces(), 1);
}
