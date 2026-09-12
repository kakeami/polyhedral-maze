import type { Vec3 } from '../types.ts';
import { VERTEX_EPSILON } from '../constants.ts';

/**
 * Maps 3D points to integer ids, merging points that lie within `eps`.
 *
 * Points are bucketed on a grid of side `eps` and lookups probe the 27
 * surrounding buckets, so a pair of coincident corners is never missed just
 * because it straddles a bucket boundary. Adjacency in this module is decided
 * purely by "these two cells share two welded corners", which is what lets one
 * piece of code serve every mechanism.
 */
export class VertexWelder {
  private readonly buckets = new Map<string, number[]>();
  private readonly points: Vec3[] = [];
  private readonly eps: number;

  constructor(eps: number = VERTEX_EPSILON) {
    this.eps = eps;
  }

  id(p: Vec3): number {
    const { eps } = this;
    const gx = Math.floor(p[0] / eps);
    const gy = Math.floor(p[1] / eps);
    const gz = Math.floor(p[2] / eps);
    const eps2 = eps * eps;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = this.buckets.get(`${gx + dx},${gy + dy},${gz + dz}`);
          if (!bucket) continue;
          for (const id of bucket) {
            const q = this.points[id]!;
            const ddx = q[0] - p[0];
            const ddy = q[1] - p[1];
            const ddz = q[2] - p[2];
            if (ddx * ddx + ddy * ddy + ddz * ddz <= eps2) return id;
          }
        }
      }
    }
    const id = this.points.length;
    this.points.push(p);
    const key = `${gx},${gy},${gz}`;
    const bucket = this.buckets.get(key);
    if (bucket) bucket.push(id);
    else this.buckets.set(key, [id]);
    return id;
  }

  get count(): number {
    return this.points.length;
  }
}
