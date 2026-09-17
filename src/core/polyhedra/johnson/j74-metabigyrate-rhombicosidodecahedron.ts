import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Metabigyrate Rhombicosidodecahedron (J74). Two meta-positioned pentagonal
 * cupola caps are gyrated. 62 faces: 20 △ + 30 □ + 12 ⬠.
 *
 * Pentagons 0 and 3 of the underlying dodecahedron are at face BFS distance 2
 * (meta), distinguishing this from the para (J73) and adjacent variants.
 */
export class MetabigyrateRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
      { kind: 'gyrate', pentagonIndex: 3 },
    ]),
    1,
  );
}
