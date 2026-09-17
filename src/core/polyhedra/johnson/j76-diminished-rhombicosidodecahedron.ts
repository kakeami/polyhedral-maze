import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Diminished Rhombicosidodecahedron (J76). One pentagonal cupola cap is
 * removed, exposing a regular decagonal face. 52 faces: 15 △ + 25 □ + 11 ⬠ + 1 10gon.
 */
export class DiminishedRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([{ kind: 'diminish', pentagonIndex: 0 }]),
    1,
  );
}
