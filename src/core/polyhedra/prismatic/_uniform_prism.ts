import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';

/**
 * Uniform n-prism with unit edges, centered at the origin.
 *
 * - Top / bottom n-gons at z = ±1/2 with circumradius r = 1 / (2·sin(π/n))
 *   → top and bottom edge lengths equal 1.
 * - n lateral square faces of side 1.
 *
 * Returns 2 + n faces. `makeFace` fixes vertex order so each normal points
 * outward.
 */
export function uniformPrism(n: number): Face[] {
  if (n < 3) {
    throw new Error(`uniformPrism: n must be >= 3 (got ${n})`);
  }
  const r = 1 / (2 * Math.sin(Math.PI / n));
  const zHalf = 0.5;

  const top: Vec3[] = [];
  const bot: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const x = r * Math.cos(t);
    const y = r * Math.sin(t);
    top.push([x, y, zHalf]);
    bot.push([x, y, -zHalf]);
  }

  const faces: Face[] = [];
  let id = 0;
  faces.push(makeFace(id++, [...top]));
  faces.push(makeFace(id++, [...bot]));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push(makeFace(id++, [top[i]!, top[j]!, bot[j]!, bot[i]!]));
  }
  return faces;
}
