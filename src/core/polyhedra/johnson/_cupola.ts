import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';

export interface CupolaGeometry {
  /** Top n-gon vertices, length n. */
  top: Vec3[];
  /** Bottom 2n-gon vertices, length 2n. */
  bot: Vec3[];
  /** Perpendicular distance between top and bottom planes. */
  height: number;
}

/**
 * Vertex layout of a unit-edge n-cupola (n = 3, 4, 5).
 *
 * - Bottom 2n-gon at z = `zBase` (vertex j at angle j·π/n).
 * - Top n-gon at z = zBase + topZSign·h. Vertex i at angle
 *   (4i + 1)·π/(2n) + topRotationSteps·π/n.
 *   `topRotationSteps = 0` is the canonical cupola; `topRotationSteps = 1`
 *   rotates the top n-gon by π/n, which is the gyro variant.
 * - h is chosen so each lateral triangle and square is unit-edge.
 *
 * Sphere radii:
 *   r_top = 1 / (2·sin(π/n)),   r_bot = 1 / (2·sin(π/(2n))).
 * Height comes from |r_bot·cos(π/(2n)) − r_top·cos(π/n)|² + h² = 1.
 */
export function cupolaVertices(
  n: 3 | 4 | 5,
  options: {
    zBase?: number;
    topZSign?: 1 | -1;
    topRotationSteps?: 0 | 1;
  } = {},
): CupolaGeometry {
  const zBase = options.zBase ?? 0;
  const topZSign = options.topZSign ?? 1;
  const topRotationSteps = options.topRotationSteps ?? 0;

  const rTop = 1 / (2 * Math.sin(Math.PI / n));
  const rBot = 1 / (2 * Math.sin(Math.PI / (2 * n)));
  const apothemDiff =
    rBot * Math.cos(Math.PI / (2 * n)) - rTop * Math.cos(Math.PI / n);
  const h2 = 1 - apothemDiff * apothemDiff;
  if (h2 <= 0) {
    throw new Error(`cupolaVertices: degenerate height for n=${n}`);
  }
  const h = Math.sqrt(h2);

  const topZ = zBase + topZSign * h;
  const topOffset = (topRotationSteps * Math.PI) / n;

  const top: Vec3[] = [];
  const bot: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((4 * i + 1) * Math.PI) / (2 * n) + topOffset;
    top.push([rTop * Math.cos(t), rTop * Math.sin(t), topZ]);
  }
  for (let j = 0; j < 2 * n; j++) {
    const t = (j * Math.PI) / n;
    bot.push([rBot * Math.cos(t), rBot * Math.sin(t), zBase]);
  }
  return { top, bot, height: h };
}

/**
 * Append the n lateral triangles and n lateral squares of an n-cupola.
 * `topRotationSteps` must match the value used in `cupolaVertices`.
 * `idRef.value` is incremented for every face appended.
 */
export function appendCupolaSides(
  faces: Face[],
  top: Vec3[],
  bot: Vec3[],
  idRef: { value: number },
  topRotationSteps: 0 | 1 = 0,
): void {
  const n = top.length;
  const twoN = bot.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = (2 * i + topRotationSteps + twoN) % twoN;
    const b = (a + 1) % twoN;
    const c = (a + 2) % twoN;
    faces.push(makeFace(idRef.value++, [top[i]!, bot[a]!, bot[b]!]));
    faces.push(
      makeFace(idRef.value++, [top[i]!, top[j]!, bot[c]!, bot[b]!]),
    );
  }
}

/**
 * Standalone unit-edge n-cupola, centered so the midplane between bot and top
 * sits at z = 0. Returns 2 + 2n faces:
 * 1 top n-gon, 1 bottom 2n-gon, n lateral triangles, n lateral squares.
 */
export function uniformCupola(n: 3 | 4 | 5): Face[] {
  const geom = cupolaVertices(n, { zBase: 0 });
  const dz = -geom.height / 2;
  const top = geom.top.map((v) => [v[0], v[1], v[2] + dz] as Vec3);
  const bot = geom.bot.map((v) => [v[0], v[1], v[2] + dz] as Vec3);

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...top]));
  faces.push(makeFace(id.value++, [...bot]));
  appendCupolaSides(faces, top, bot, id, 0);
  return faces;
}
