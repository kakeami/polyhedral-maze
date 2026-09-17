import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Bigyrate Diminished Rhombicosidodecahedron (J79). Two pentagonal caps are
 * gyrated (0, 3) and a third mutually-meta pentagon (11) is diminished.
 * 52 faces: 15 △ + 25 □ + 11 ⬠ + 1 10gon.
 */
export class BigyrateDiminishedRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'gyrate', pentagonIndex: 0 },
      { kind: 'gyrate', pentagonIndex: 3 },
      { kind: 'diminish', pentagonIndex: 11 },
    ]),
    1,
  );
}
