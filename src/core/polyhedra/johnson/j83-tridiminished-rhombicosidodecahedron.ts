import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Tridiminished Rhombicosidodecahedron (J83). Three mutually-meta pentagonal
 * cupola caps (0, 3, 11) are removed. 32 faces: 5 △ + 15 □ + 9 ⬠ + 3 10gon.
 */
export class TridiminishedRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'diminish', pentagonIndex: 0 },
      { kind: 'diminish', pentagonIndex: 3 },
      { kind: 'diminish', pentagonIndex: 11 },
    ]),
    1,
  );
}
