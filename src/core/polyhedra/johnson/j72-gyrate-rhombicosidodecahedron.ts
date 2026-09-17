import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { buildRhombicosiMod } from './_rhombicosi_builder.ts';

/**
 * Gyrate Rhombicosidodecahedron (J72). One pentagonal cupola cap is rotated
 * by 36° (π/5). 62 faces: 20 △ + 30 □ + 12 ⬠.
 */
export class GyrateRhombicosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    buildRhombicosiMod([{ kind: 'gyrate', pentagonIndex: 0 }]),
    1,
  );
}
