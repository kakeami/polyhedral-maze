import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';

export interface RotundaGeometry {
  /** Top pentagon vertices, length 5. */
  top: Vec3[];
  /** Mid-ring vertices, length 5. */
  mid: Vec3[];
  /** Bottom decagon vertices, length 10. */
  bot: Vec3[];
  /** Perpendicular distance from bot plane to top plane. */
  height: number;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const R_TOP = 1 / (2 * Math.sin(Math.PI / 5)); // top pentagon circumradius
const R_MID = PHI * R_TOP; // mid-ring circumradius (= z of top pentagon in canonical frame)
const R_DEC = 1 / (2 * Math.sin(Math.PI / 10)); // decagon circumradius (= PHI)
const Z_TOP = R_MID; // height of top pentagon above the decagon plane
const Z_MID = R_TOP; // height of mid ring above the decagon plane

/**
 * Vertex layout of a unit-edge pentagonal rotunda (J6 / half-icosidodecahedron).
 *
 * Three rings, all sharing the 5-fold axis:
 *   - bottom decagon (10 vertices) at z = zBase, vertex k at angle kπ/5.
 *   - mid ring (5 vertices) at z = zBase + topZSign · R_TOP.
 *   - top pentagon (5 vertices) at z = zBase + topZSign · R_MID.
 *
 * Top / mid azimuths depend on `topRotationSteps`:
 *   - steps 0: top[i] at (4i−1)π/10, mid[i] at (4i+1)π/10.
 *   - steps 1: rotated by π/5 (mid azimuths swap with the "other half" decagon
 *     edges) — used for the gyro stacking variant.
 *
 * All 30 lateral edges are unit, all 5 mid pentagons are regular: derived from
 * r_top² + r_mid² − 2·r_top·r_mid·cos(π/5) + (z_top−z_mid)² = 1,
 * r_mid² + r_dec² − 2·r_mid·r_dec·cos(π/10) + z_mid² = 1, and
 * r_top² + r_dec² − 2·r_top·r_dec·cos(π/10) + z_top² = φ² (mid-pentagon diagonal).
 */
export function rotundaVertices(
  options: {
    zBase?: number;
    topZSign?: 1 | -1;
    topRotationSteps?: 0 | 1;
  } = {},
): RotundaGeometry {
  const zBase = options.zBase ?? 0;
  const topZSign = options.topZSign ?? 1;
  const topRotationSteps = options.topRotationSteps ?? 0;

  const topOffset = (topRotationSteps * Math.PI) / 5;
  const zTop = zBase + topZSign * Z_TOP;
  const zMid = zBase + topZSign * Z_MID;

  const top: Vec3[] = [];
  const mid: Vec3[] = [];
  const bot: Vec3[] = [];
  for (let i = 0; i < 5; i++) {
    const tTop = ((4 * i - 1) * Math.PI) / 10 + topOffset;
    const tMid = ((4 * i + 1) * Math.PI) / 10 + topOffset;
    top.push([R_TOP * Math.cos(tTop), R_TOP * Math.sin(tTop), zTop]);
    mid.push([R_MID * Math.cos(tMid), R_MID * Math.sin(tMid), zMid]);
  }
  for (let k = 0; k < 10; k++) {
    const t = (k * Math.PI) / 5;
    bot.push([R_DEC * Math.cos(t), R_DEC * Math.sin(t), zBase]);
  }
  return { top, mid, bot, height: Math.abs(zTop - zBase) };
}

/**
 * Append the 5 upper triangles, 5 mid pentagons, and 5 lower triangles of a
 * pentagonal rotunda. `topRotationSteps` must match the value used in
 * `rotundaVertices`.
 */
export function appendRotundaSides(
  faces: Face[],
  top: Vec3[],
  mid: Vec3[],
  bot: Vec3[],
  idRef: { value: number },
  topRotationSteps: 0 | 1 = 0,
): void {
  const k = topRotationSteps;
  for (let i = 0; i < 5; i++) {
    const iNext = (i + 1) % 5;
    // Upper triangle: top[i], top[i+1], mid[i]
    faces.push(makeFace(idRef.value++, [top[i]!, top[iNext]!, mid[i]!]));
  }
  for (let j = 0; j < 5; j++) {
    const jPrev = (j + 4) % 5;
    // Mid pentagon: top[j], mid[j-1], dec[2j-1+k], dec[2j+k], mid[j]
    const dA = (2 * j - 1 + k + 10) % 10;
    const dB = (2 * j + k + 10) % 10;
    faces.push(
      makeFace(idRef.value++, [
        top[j]!,
        mid[jPrev]!,
        bot[dA]!,
        bot[dB]!,
        mid[j]!,
      ]),
    );
  }
  for (let i = 0; i < 5; i++) {
    // Lower triangle: mid[i], dec[2i+k], dec[2i+1+k]
    const dA = (2 * i + k + 10) % 10;
    const dB = (2 * i + 1 + k + 10) % 10;
    faces.push(makeFace(idRef.value++, [mid[i]!, bot[dA]!, bot[dB]!]));
  }
}

/**
 * Standalone unit-edge pentagonal rotunda, centered so the midplane between
 * the decagon and the top pentagon sits at z = 0. 17 faces: 1 top pentagon,
 * 1 bottom decagon, 5 upper triangles, 5 mid pentagons, 5 lower triangles.
 */
export function uniformRotunda(): Face[] {
  const geom = rotundaVertices({ zBase: 0 });
  const dz = -geom.height / 2;
  const top = geom.top.map((v) => [v[0], v[1], v[2] + dz] as Vec3);
  const mid = geom.mid.map((v) => [v[0], v[1], v[2] + dz] as Vec3);
  const bot = geom.bot.map((v) => [v[0], v[1], v[2] + dz] as Vec3);

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...top]));
  faces.push(makeFace(id.value++, [...bot]));
  appendRotundaSides(faces, top, mid, bot, id, 0);
  return faces;
}
