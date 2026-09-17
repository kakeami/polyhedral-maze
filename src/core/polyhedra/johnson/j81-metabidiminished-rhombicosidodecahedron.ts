import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Metabidiminished Rhombicosidodecahedron (J81). Two meta-positioned
 * pentagonal cupola caps (0, 3) are removed. 42 faces: 10 △ + 20 □ + 10 ⬠ + 2 10gon.
 */
export class MetabidiminishedRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([
      { kind: 'diminish', pentagonIndex: 0 },
      { kind: 'diminish', pentagonIndex: 3 },
    ]),
    1,
  );
}
