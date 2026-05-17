import type { Face } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { cupolaVertices, appendCupolaSides } from './_cupola.ts';
import { rotundaVertices, appendRotundaSides } from './_rotunda.ts';

/**
 * Bicupola (n = 3, 4, 5): two unit-edge n-cupolas sharing their 2n-gon
 * equators. The shared 2n-gon is internal and not emitted as a face.
 *
 * - mode='ortho': bottom cupola at the same azimuth as the top (J27/J28/J30).
 * - mode='gyro':  bottom cupola rotated by π/n (J29/J31).
 *
 * Note: the n=3 gyrobicupola is the Cuboctahedron (Archimedean, not Johnson),
 * and the n=5 gyrobirotunda is the Icosidodecahedron. Those are not exposed
 * here; the shape registry skips them.
 */
export function uniformBicupola(
  n: 3 | 4 | 5,
  mode: 'ortho' | 'gyro',
): Face[] {
  const bottomSteps: 0 | 1 = mode === 'gyro' ? 1 : 0;
  const topGeom = cupolaVertices(n, { zBase: 0, topZSign: 1 });
  const botGeom = cupolaVertices(n, {
    zBase: 0,
    topZSign: -1,
    topRotationSteps: bottomSteps,
  });

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...topGeom.top]));
  faces.push(makeFace(id.value++, [...botGeom.top]));
  appendCupolaSides(faces, topGeom.top, topGeom.bot, id, 0);
  appendCupolaSides(faces, botGeom.top, botGeom.bot, id, bottomSteps);
  return faces;
}

/**
 * Pentagonal cupolarotunda: a pentagonal cupola joined to a pentagonal
 * rotunda along their decagons.
 *
 * - mode='ortho' (J32): rotunda at default azimuth.
 * - mode='gyro'  (J33): rotunda rotated by π/5.
 */
export function uniformCupolaRotunda(mode: 'ortho' | 'gyro'): Face[] {
  const rotSteps: 0 | 1 = mode === 'gyro' ? 1 : 0;
  const cupGeom = cupolaVertices(5, { zBase: 0, topZSign: 1 });
  const rotGeom = rotundaVertices({
    zBase: 0,
    topZSign: -1,
    topRotationSteps: rotSteps,
  });

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...cupGeom.top]));
  faces.push(makeFace(id.value++, [...rotGeom.top]));
  appendCupolaSides(faces, cupGeom.top, cupGeom.bot, id, 0);
  appendRotundaSides(faces, rotGeom.top, rotGeom.mid, rotGeom.bot, id, rotSteps);
  return faces;
}

/**
 * Pentagonal orthobirotunda (J34): two pentagonal rotundas joined at the
 * decagon at matching azimuth. The gyro variant is the Icosidodecahedron.
 */
export function uniformBirotunda(): Face[] {
  const topGeom = rotundaVertices({ zBase: 0, topZSign: 1, topRotationSteps: 0 });
  const botGeom = rotundaVertices({ zBase: 0, topZSign: -1, topRotationSteps: 0 });

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...topGeom.top]));
  faces.push(makeFace(id.value++, [...botGeom.top]));
  appendRotundaSides(faces, topGeom.top, topGeom.mid, topGeom.bot, id, 0);
  appendRotundaSides(faces, botGeom.top, botGeom.mid, botGeom.bot, id, 0);
  return faces;
}
