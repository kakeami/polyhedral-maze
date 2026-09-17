import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Parabidiminished Rhombicosidodecahedron (J80). Two antipodal pentagonal
 * cupola caps (0, 5) are removed. 42 faces: 10 △ + 20 □ + 10 ⬠ + 2 10gon.
 */
export class ParabidiminishedRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'diminish', pentagonIndex: 0 },
      { kind: 'diminish', pentagonIndex: 5 },
    ]),
    1,
  );
}
