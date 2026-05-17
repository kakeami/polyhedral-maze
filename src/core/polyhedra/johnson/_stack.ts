import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';
import { cupolaVertices, appendCupolaSides } from './_cupola.ts';
import { rotundaVertices, appendRotundaSides } from './_rotunda.ts';

/** Rotate a vertex list about the +z axis by `angle` radians. */
function rotateZ(verts: Vec3[], angle: number): Vec3[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return verts.map(
    ([x, y, z]) => [c * x - s * y, s * x + c * y, z] as Vec3,
  );
}

/**
 * Append 2n vertical rectangles connecting two coaxial 2n-gons (a prism band).
 * `top` and `bot` must be in matching CCW order, length 2n.
 */
function appendPrismBand(
  faces: Face[],
  top: Vec3[],
  bot: Vec3[],
  idRef: { value: number },
): void {
  const m = top.length;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    faces.push(
      makeFace(idRef.value++, [top[i]!, top[j]!, bot[j]!, bot[i]!]),
    );
  }
}

/**
 * Append 2·(2n) triangles connecting two coaxial 2n-gons (an antiprism band).
 * `top` is canonical-azimuth, `bot` is rotated by π/(2n).
 */
function appendAntiprismBand(
  faces: Face[],
  top: Vec3[],
  bot: Vec3[],
  idRef: { value: number },
): void {
  const m = top.length;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    faces.push(makeFace(idRef.value++, [top[i]!, top[j]!, bot[i]!]));
    faces.push(makeFace(idRef.value++, [bot[i]!, top[j]!, bot[j]!]));
  }
}

/** Antiprism height between two unit-edge 2n-gons. */
function antiprismHeight(twoN: number): number {
  const r = 1 / (2 * Math.sin(Math.PI / twoN));
  const h2 = 1 - 2 * r * r * (1 - Math.cos(Math.PI / twoN));
  if (h2 <= 0) {
    throw new Error(`antiprismHeight: degenerate for 2n=${twoN}`);
  }
  return Math.sqrt(h2);
}

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

/**
 * Elongated bicupola (J35/J36 n=3, J37 n=4 gyro, J38/J39 n=5):
 * two n-cupolas joined to a unit-edge 2n-prism inserted at the equator.
 * `mode='ortho'` keeps the two cupolas at matching azimuth; `mode='gyro'`
 * rotates the bottom cupola by π/n.
 */
export function uniformElongatedBicupola(
  n: 3 | 4 | 5,
  mode: 'ortho' | 'gyro',
): Face[] {
  const bottomSteps: 0 | 1 = mode === 'gyro' ? 1 : 0;
  const half = 0.5;
  const topGeom = cupolaVertices(n, { zBase: half, topZSign: 1 });
  const botGeom = cupolaVertices(n, {
    zBase: -half,
    topZSign: -1,
    topRotationSteps: bottomSteps,
  });

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...topGeom.top]));
  faces.push(makeFace(id.value++, [...botGeom.top]));
  appendCupolaSides(faces, topGeom.top, topGeom.bot, id, 0);
  appendCupolaSides(faces, botGeom.top, botGeom.bot, id, bottomSteps);
  appendPrismBand(faces, topGeom.bot, botGeom.bot, id);
  return faces;
}

/**
 * Elongated pentagonal cupolarotunda (J40 ortho / J41 gyro): pentagonal cupola
 * and pentagonal rotunda joined to a unit-edge decagonal prism.
 */
export function uniformElongatedCupolaRotunda(mode: 'ortho' | 'gyro'): Face[] {
  const rotSteps: 0 | 1 = mode === 'gyro' ? 1 : 0;
  const half = 0.5;
  const cupGeom = cupolaVertices(5, { zBase: half, topZSign: 1 });
  const rotGeom = rotundaVertices({
    zBase: -half,
    topZSign: -1,
    topRotationSteps: rotSteps,
  });

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...cupGeom.top]));
  faces.push(makeFace(id.value++, [...rotGeom.top]));
  appendCupolaSides(faces, cupGeom.top, cupGeom.bot, id, 0);
  appendRotundaSides(faces, rotGeom.top, rotGeom.mid, rotGeom.bot, id, rotSteps);
  appendPrismBand(faces, cupGeom.bot, rotGeom.bot, id);
  return faces;
}

/**
 * Elongated pentagonal birotunda (J42 ortho / J43 gyro): two pentagonal
 * rotundas joined to a unit-edge decagonal prism.
 */
export function uniformElongatedBirotunda(mode: 'ortho' | 'gyro'): Face[] {
  const botSteps: 0 | 1 = mode === 'gyro' ? 1 : 0;
  const half = 0.5;
  const topGeom = rotundaVertices({ zBase: half, topZSign: 1, topRotationSteps: 0 });
  const botGeom = rotundaVertices({
    zBase: -half,
    topZSign: -1,
    topRotationSteps: botSteps,
  });

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...topGeom.top]));
  faces.push(makeFace(id.value++, [...botGeom.top]));
  appendRotundaSides(faces, topGeom.top, topGeom.mid, topGeom.bot, id, 0);
  appendRotundaSides(faces, botGeom.top, botGeom.mid, botGeom.bot, id, botSteps);
  appendPrismBand(faces, topGeom.bot, botGeom.bot, id);
  return faces;
}

/**
 * Gyroelongated bicupola (J44/J45/J46): two n-cupolas joined to a unit-edge
 * 2n-antiprism inserted at the equator. The antiprism's intrinsic π/(2n)
 * twist sets the relative azimuth; there is no ortho/gyro choice.
 */
export function uniformGyroelongatedBicupola(n: 3 | 4 | 5): Face[] {
  const twoN = 2 * n;
  const hAnti = antiprismHeight(twoN);
  const half = hAnti / 2;

  const topGeom = cupolaVertices(n, { zBase: half, topZSign: 1 });
  // Bottom cupola: build at canonical azimuth, then rotate the whole rig by π/(2n).
  const rawBot = cupolaVertices(n, { zBase: -half, topZSign: -1 });
  const botTopN = rotateZ(rawBot.top, Math.PI / twoN);
  const botBot2N = rotateZ(rawBot.bot, Math.PI / twoN);

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...topGeom.top]));
  faces.push(makeFace(id.value++, [...botTopN]));
  appendCupolaSides(faces, topGeom.top, topGeom.bot, id, 0);
  appendCupolaSides(faces, botTopN, botBot2N, id, 0);
  appendAntiprismBand(faces, topGeom.bot, botBot2N, id);
  return faces;
}

/**
 * Gyroelongated pentagonal cupolarotunda (J47): pentagonal cupola and
 * pentagonal rotunda joined by a unit-edge decagonal antiprism.
 */
export function uniformGyroelongatedCupolaRotunda(): Face[] {
  const hAnti = antiprismHeight(10);
  const half = hAnti / 2;

  const cupGeom = cupolaVertices(5, { zBase: half, topZSign: 1 });
  const rawRot = rotundaVertices({ zBase: -half, topZSign: -1 });
  const rotTop = rotateZ(rawRot.top, Math.PI / 10);
  const rotMid = rotateZ(rawRot.mid, Math.PI / 10);
  const rotBot = rotateZ(rawRot.bot, Math.PI / 10);

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...cupGeom.top]));
  faces.push(makeFace(id.value++, [...rotTop]));
  appendCupolaSides(faces, cupGeom.top, cupGeom.bot, id, 0);
  appendRotundaSides(faces, rotTop, rotMid, rotBot, id, 0);
  appendAntiprismBand(faces, cupGeom.bot, rotBot, id);
  return faces;
}

/**
 * Gyroelongated pentagonal birotunda (J48): two pentagonal rotundas joined
 * by a unit-edge decagonal antiprism.
 */
export function uniformGyroelongatedBirotunda(): Face[] {
  const hAnti = antiprismHeight(10);
  const half = hAnti / 2;

  const topGeom = rotundaVertices({ zBase: half, topZSign: 1 });
  const rawBot = rotundaVertices({ zBase: -half, topZSign: -1 });
  const botTop = rotateZ(rawBot.top, Math.PI / 10);
  const botMid = rotateZ(rawBot.mid, Math.PI / 10);
  const botBot = rotateZ(rawBot.bot, Math.PI / 10);

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...topGeom.top]));
  faces.push(makeFace(id.value++, [...botTop]));
  appendRotundaSides(faces, topGeom.top, topGeom.mid, topGeom.bot, id, 0);
  appendRotundaSides(faces, botTop, botMid, botBot, id, 0);
  appendAntiprismBand(faces, topGeom.bot, botBot, id);
  return faces;
}
