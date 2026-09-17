import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { makeFace } from '../archimedean/_utils.ts';

function makeGyroelongatedSquareBipyramidFaces(): Face[] {
  // Unit-edge square antiprism: top corners at (±1/2, ±1/2, h/2), bottom
  // corners on the same axis rotated 45° at (±1/√2, 0, −h/2), (0, ±1/√2, −h/2).
  // Lateral edge length 1 ⇒ h² = 1/√2.
  const h = Math.pow(2, -0.25); // h² = 1/√2

  const T: Vec3[] = [
    [0.5, 0.5, h / 2],
    [-0.5, 0.5, h / 2],
    [-0.5, -0.5, h / 2],
    [0.5, -0.5, h / 2],
  ];
  const invR = 1 / Math.SQRT2;
  const B: Vec3[] = [
    [invR, 0, -h / 2],
    [0, invR, -h / 2],
    [-invR, 0, -h / 2],
    [0, -invR, -h / 2],
  ];

  // Pyramid apexes: unit-edge square pyramid → apex offset 1/√2 from base
  // centre. Bases are the top/bottom squares of the antiprism (centred on
  // z = ±h/2, lying in horizontal planes).
  const apexTop: Vec3 = [0, 0, h / 2 + 1 / Math.SQRT2];
  const apexBot: Vec3 = [0, 0, -h / 2 - 1 / Math.SQRT2];

  const faces: Face[] = [];
  let id = 0;

  // 8 antiprism lateral triangles. T_i links to B_i and B_{i+1}.
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    // Upward triangle on top edge T_i-T_j, apex on bottom.
    faces.push(makeFace(id++, [T[i]!, T[j]!, B[j]!]));
    // Downward triangle on bottom edge B_i-B_j, apex on top.
    faces.push(makeFace(id++, [B[i]!, B[j]!, T[i]!]));
  }

  // 4 + 4 pyramid triangles.
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    faces.push(makeFace(id++, [T[i]!, T[j]!, apexTop]));
    faces.push(makeFace(id++, [B[i]!, B[j]!, apexBot]));
  }
  return faces;
}

/**
 * Gyroelongated Square Bipyramid (J17, deltahedron #7).
 * 16 equilateral-triangle faces, 10 vertices, 24 edges.
 * D_4d symmetry — no central inversion → no antipodal faces.
 */
export class GyroelongatedSquareBipyramid extends Solid {
  protected readonly _faces = normalizeFaces(makeGyroelongatedSquareBipyramidFaces(), 1);
}
