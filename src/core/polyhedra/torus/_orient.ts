import type { Face, Vec3 } from '../../types.ts';
import { normalize } from '../../vec3.ts';

/**
 * Build consistently outward-oriented Faces from raw vertex loops of a closed
 * surface of arbitrary genus.
 *
 * `makeFace` / `buildOrderedFace` orient each face so its normal points away
 * from the origin, which is only correct for star-shaped (e.g. convex)
 * solids. A toroidal solid has faces whose outward normal points toward the
 * central hole, so orientation is instead propagated combinatorially:
 * adjacent loops must traverse their shared edge in opposite directions.
 * The remaining global mirror ambiguity is resolved by requiring positive
 * enclosed volume (divergence theorem — valid for any closed oriented
 * surface, independent of genus).
 *
 * Requirements on input: loops share bitwise-identical vertex coordinates,
 * and every undirected edge is used by exactly two loops (closed 2-manifold).
 */
export function orientFacesOutward(loops: Vec3[][]): Face[] {
  const nf = loops.length;
  if (nf === 0) return [];

  const vKey = (v: Vec3) => `${v[0]},${v[1]},${v[2]}`;

  // Undirected edge key → [{loop index, canonical direction}]
  interface EdgeUse {
    face: number;
    /** true if the loop traverses the edge from the lower vKey to the higher */
    ascending: boolean;
  }
  const edges = new Map<string, EdgeUse[]>();
  for (let f = 0; f < nf; f++) {
    const loop = loops[f]!;
    for (let i = 0; i < loop.length; i++) {
      const ka = vKey(loop[i]!);
      const kb = vKey(loop[(i + 1) % loop.length]!);
      if (ka === kb) throw new Error(`orientFacesOutward: degenerate edge in loop ${f}`);
      const ascending = ka < kb;
      const key = ascending ? `${ka}|${kb}` : `${kb}|${ka}`;
      let uses = edges.get(key);
      if (!uses) { uses = []; edges.set(key, uses); }
      uses.push({ face: f, ascending });
    }
  }
  for (const [key, uses] of edges) {
    if (uses.length !== 2) {
      throw new Error(
        `orientFacesOutward: edge ${key} used by ${uses.length} loops (expected 2)`,
      );
    }
  }

  // Propagate orientation: two consistently oriented neighbors traverse the
  // shared edge in opposite directions.
  const flip: (boolean | null)[] = new Array(nf).fill(null);
  flip[0] = false;
  const queue = [0];
  while (queue.length > 0) {
    const f = queue.shift()!;
    for (const uses of edges.values()) {
      const mine = uses.find((u) => u.face === f);
      if (!mine) continue;
      const other = uses.find((u) => u !== mine)!;
      // After flipping, a loop's traversal direction reverses.
      const wantFlip = flip[f]! !== (mine.ascending === other.ascending);
      if (flip[other.face] === null) {
        flip[other.face] = wantFlip;
        queue.push(other.face);
      } else if (flip[other.face] !== wantFlip) {
        throw new Error('orientFacesOutward: surface is not orientable');
      }
    }
  }
  if (flip.some((x) => x === null)) {
    throw new Error('orientFacesOutward: surface is not edge-connected');
  }

  let oriented = loops.map((loop, f) => (flip[f] ? [...loop].reverse() : [...loop]));

  // Signed volume via fan triangulation (divergence theorem).
  let vol6 = 0;
  for (const loop of oriented) {
    const a = loop[0]!;
    for (let i = 1; i < loop.length - 1; i++) {
      const b = loop[i]!;
      const c = loop[i + 1]!;
      vol6 +=
        a[0] * (b[1] * c[2] - b[2] * c[1]) +
        a[1] * (b[2] * c[0] - b[0] * c[2]) +
        a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
  }
  if (vol6 === 0) throw new Error('orientFacesOutward: zero enclosed volume');
  if (vol6 < 0) {
    oriented = oriented.map((loop) => [...loop].reverse());
  }

  return oriented.map((loop, id) => ({ id, vertices: loop, normal: newellNormal(loop) }));
}

/** Newell's method: robust polygon normal consistent with winding order. */
function newellNormal(loop: Vec3[]): Vec3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return normalize([nx, ny, nz]);
}
