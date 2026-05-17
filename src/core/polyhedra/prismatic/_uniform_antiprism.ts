import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';

/**
 * Uniform n-antiprism with unit edges, centered at the origin.
 *
 * - Top / bottom n-gons are rotated by π/n relative to each other.
 * - Circumradius of each n-gon r = 1 / (2·sin(π/n)) gives n-gon edge = 1.
 * - Total height h is chosen so the lateral triangle edges are also unit:
 *     h² = 1 − 2·r²·(1 − cos(π/n))
 *   (h > 0 for all n ≥ 3.)
 *
 * Returns 2 + 2n faces: top n-gon, bottom n-gon, then alternating triangles —
 * `tUp_i = (top[i], top[i+1], bot[i])` and
 * `tDn_i = (bot[i], bot[i+1], top[i+1])`.
 */
export function uniformAntiprism(n: number): Face[] {
  if (n < 3) {
    throw new Error(`uniformAntiprism: n must be >= 3 (got ${n})`);
  }
  const r = 1 / (2 * Math.sin(Math.PI / n));
  const h2 = 1 - 2 * r * r * (1 - Math.cos(Math.PI / n));
  if (h2 <= 0) {
    throw new Error(`uniformAntiprism: degenerate height for n=${n}`);
  }
  const zHalf = Math.sqrt(h2) / 2;

  const top: Vec3[] = [];
  const bot: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const tTop = (2 * Math.PI * i) / n;
    const tBot = (2 * Math.PI * i) / n + Math.PI / n;
    top.push([r * Math.cos(tTop), r * Math.sin(tTop), zHalf]);
    bot.push([r * Math.cos(tBot), r * Math.sin(tBot), -zHalf]);
  }

  const faces: Face[] = [];
  let id = 0;
  faces.push(makeFace(id++, [...top]));
  faces.push(makeFace(id++, [...bot]));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push(makeFace(id++, [top[i]!, top[j]!, bot[i]!]));
    faces.push(makeFace(id++, [bot[i]!, bot[j]!, top[j]!]));
  }
  return faces;
}
