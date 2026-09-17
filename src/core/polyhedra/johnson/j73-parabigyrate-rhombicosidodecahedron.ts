import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Parabigyrate Rhombicosidodecahedron (J73). Two antipodal pentagonal cupola
 * caps are gyrated. 62 faces: 20 △ + 30 □ + 12 ⬠.
 *
 * Pentagons 0 and 5 of the underlying dodecahedron are antipodal (face
 * BFS distance 3 in the dodecahedron face graph).
 */
export class ParabigyrateRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
      { kind: 'gyrate', pentagonIndex: 5 },
    ]),
    1,
  );
}
