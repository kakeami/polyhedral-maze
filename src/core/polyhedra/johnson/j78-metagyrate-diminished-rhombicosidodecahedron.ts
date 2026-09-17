import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Metagyrate Diminished Rhombicosidodecahedron (J78). Pentagon 0 is gyrated;
 * a meta-positioned pentagon (3) is diminished. 52 faces: 15 △ + 25 □ + 11 ⬠ + 1 10gon.
 */
export class MetagyrateDiminishedRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
      { kind: 'diminish', pentagonIndex: 3 },
    ]),
    1,
  );
}
