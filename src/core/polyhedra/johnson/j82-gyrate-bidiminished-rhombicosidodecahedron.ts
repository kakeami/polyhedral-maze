import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Gyrate Bidiminished Rhombicosidodecahedron (J82). One pentagonal cap (0)
 * is gyrated; two mutually-meta caps (3, 11) are diminished.
 * 42 faces: 10 △ + 20 □ + 10 ⬠ + 2 10gon.
 */
export class GyrateBidiminishedRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
      { kind: 'diminish', pentagonIndex: 3 },
      { kind: 'diminish', pentagonIndex: 11 },
    ]),
    1,
  );
}
