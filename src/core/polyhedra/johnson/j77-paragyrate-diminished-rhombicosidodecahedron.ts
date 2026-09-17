import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Paragyrate Diminished Rhombicosidodecahedron (J77). Pentagon 0 is gyrated;
 * its antipode (pentagon 5) is diminished. 52 faces: 15 △ + 25 □ + 11 ⬠ + 1 10gon.
 */
export class ParagyrateDiminishedRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
      { kind: 'diminish', pentagonIndex: 5 },
    ]),
    1,
  );
}
