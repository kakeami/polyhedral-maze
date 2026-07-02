import type { Face, Vec3 } from '../../types.ts';
import type { Vec2 } from '../../vec2.ts';
import { orientFacesOutward } from './_orient.ts';

/**
 * Extrude a flat 2D face complex (an annular "frame") into a toroidal prism:
 * a copy of every cell at z = +h/2 and z = -h/2, plus a wall quad for every
 * boundary edge (a 2D edge used by exactly one cell).
 *
 * Cells must tile the frame edge-to-edge with bitwise-identical shared vertex
 * coordinates. The result is handed to `orientFacesOutward`, so cell winding
 * order does not matter.
 */
export function extrudeFrame(cells2d: Vec2[][], h: number): Face[] {
  const zTop = h / 2;
  const zBot = -h / 2;

  // Memoize 3D points so every shared vertex is a single reference.
  const topPts = new Map<string, Vec3>();
  const botPts = new Map<string, Vec3>();
  const point = (m: Map<string, Vec3>, v: Vec2, z: number): Vec3 => {
    const key = `${v[0]},${v[1]}`;
    let p = m.get(key);
    if (!p) {
      p = [v[0], v[1], z];
      m.set(key, p);
    }
    return p;
  };
  const top = (v: Vec2) => point(topPts, v, zTop);
  const bot = (v: Vec2) => point(botPts, v, zBot);

  const loops: Vec3[][] = [];
  for (const cell of cells2d) loops.push(cell.map(top));
  for (const cell of cells2d) loops.push(cell.map(bot));

  // Boundary edges: 2D edges used by exactly one cell.
  const edgeCount = new Map<string, { a: Vec2; b: Vec2; count: number }>();
  for (const cell of cells2d) {
    for (let i = 0; i < cell.length; i++) {
      const a = cell[i]!;
      const b = cell[(i + 1) % cell.length]!;
      const ka = `${a[0]},${a[1]}`;
      const kb = `${b[0]},${b[1]}`;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const entry = edgeCount.get(key);
      if (entry) entry.count++;
      else edgeCount.set(key, { a, b, count: 1 });
    }
  }
  for (const { a, b, count } of edgeCount.values()) {
    if (count > 2) throw new Error('extrudeFrame: edge shared by more than two cells');
    if (count === 1) {
      loops.push([top(a), top(b), bot(b), bot(a)]);
    }
  }

  return orientFacesOutward(loops);
}
