import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Trigyrate Rhombicosidodecahedron (J75). Three mutually-meta pentagonal
 * cupola caps are gyrated. 62 faces: 20 △ + 30 □ + 12 ⬠.
 *
 * Pentagons 0, 3, 11 form a pairwise-meta triple (each pair at face BFS
 * distance 2 in the dodecahedron face graph).
 */
export class TrigyrateRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
      { kind: 'gyrate', pentagonIndex: 3 },
      { kind: 'gyrate', pentagonIndex: 11 },
    ]),
    1,
  );
}
