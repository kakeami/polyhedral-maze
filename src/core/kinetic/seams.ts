/**
 * Where a catalogued solid can be cut open and one part turned.
 *
 * A *gyration seam* is a plane that
 *
 *   1. is made of whole edges of the solid, forming one closed loop,
 *   2. has solid on both sides of it and no face straddling it, and
 *   3. is carried onto itself by a turn of `2*pi / order` about its own
 *      normal through the centre of the solid.
 *
 * Cut there and the part above the plane can be turned by that much, and the
 * two parts still meet edge for edge — so the cells that meet across the cut
 * meet a different partner in every turn, which is precisely what a side class
 * is for. Nothing is buried and nothing is lost: unlike the glued pair, whose
 * joint face goes inside the object, a cut solid keeps its whole surface, and
 * the maze runs over all of it.
 *
 * Several seams can share one axis, and then the solid comes apart into a line
 * of pieces each free to turn against the next. That is the same line
 * `chain.ts` reads off the surface, which is why nothing downstream needs to
 * know this file exists.
 *
 * DOM-free pure geometry, like the rest of `core/`.
 */

import type { Face, Vec3 } from '../types.ts';
import { cross, dot, norm, normalize, sub } from '../vec3.ts';
import { VertexWelder } from './weld.ts';

/** How near two heights along the axis count as the same plane. */
const LEVEL_EPSILON = 1e-5;
/** How near two axes count as the same line. */
const AXIS_EPSILON = 1e-6;

export interface GyrationSeam {
  /** Height of the plane along the axis, in the solid's own coordinates. */
  readonly level: number;
  /** Largest n whose turn of `2*pi / n` carries the loop onto itself. */
  readonly order: number;
  /** Edges of the solid the cut runs along. */
  readonly loop: number;
  /**
   * The cut line itself, in the solid's own coordinates, in order around it.
   *
   * Kept because the printed pattern needs it and nothing else can work it
   * out: the bulkhead that closes a piece off and gives it its bearing on the
   * dowel is this polygon, inset.
   */
  readonly polygon: readonly Vec3[];
}

export interface GyrationAxis {
  /** Unit vector, signed so its first non-zero component is positive. */
  readonly axis: Vec3;
  /** The seams on this axis, lowest first. */
  readonly seams: readonly GyrationSeam[];
  /**
   * Turn every seam on this axis shares, as a number of steps in a revolution.
   *
   * The greatest common divisor of the seams' own orders, because a seam of
   * order 10 is carried onto itself by a turn of `2*pi / 5` as well — that
   * turn is two of its own steps. Taking the divisor rather than refusing the
   * axis keeps a mixed axis usable, and costs nothing at all on the axes met
   * so far, where every seam has the same order.
   */
  readonly turnSteps: number;
  /** Pieces the solid falls into along this axis. */
  readonly pieces: number;
  /** States the pieces can be turned into: one per tuple of seam turns. */
  readonly stateCount: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Signed so that `axis` and `-axis` name the same line. */
function canonical(v: Vec3): Vec3 {
  const u = normalize(v);
  for (const c of u) {
    if (Math.abs(c) > AXIS_EPSILON) return c > 0 ? u : [-u[0], -u[1], -u[2]];
  }
  return u;
}

/**
 * Lines worth testing: face normals, directions to vertices, and directions to
 * edge midpoints.
 *
 * Every rotation axis of a polyhedron passes through a face, a vertex or the
 * middle of an edge, so this is a complete list and not a sample.
 */
function candidateAxes(faces: readonly Face[], points: readonly Vec3[], edges: readonly [number, number][]): Vec3[] {
  const axes: Vec3[] = [];
  const add = (v: Vec3) => {
    if (norm(v) < 1e-9) return;
    const u = canonical(v);
    for (const had of axes) if (Math.abs(Math.abs(dot(had, u)) - 1) < AXIS_EPSILON) return;
    axes.push(u);
  };
  for (const face of faces) add(face.normal);
  for (const p of points) add(p);
  for (const [a, b] of edges) {
    const p = points[a]!;
    const q = points[b]!;
    add([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]);
  }
  return axes;
}

/** The solid's vertices, welded, and its edges as pairs of those. */
function skeleton(faces: readonly Face[]): { points: Vec3[]; edges: [number, number][] } {
  const welder = new VertexWelder();
  const points: Vec3[] = [];
  const idOf = (p: Vec3): number => {
    const before = welder.count;
    const id = welder.id(p);
    if (id === before) points.push(p);
    return id;
  };
  const seen = new Set<number>();
  const edges: [number, number][] = [];
  for (const face of faces) {
    const ids = face.vertices.map(idOf);
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i]!;
      const b = ids[(i + 1) % ids.length]!;
      const key = a < b ? a * 1e6 + b : b * 1e6 + a;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(a < b ? [a, b] : [b, a]);
    }
  }
  return { points, edges };
}

/**
 * The seam on one axis at one height, or null.
 *
 * The order of the tests is the order they are cheapest in: a plane that has
 * nothing above it is thrown out before any edge is looked at.
 */
function seamAt(
  axis: Vec3,
  level: number,
  points: readonly Vec3[],
  proj: readonly number[],
  edges: readonly [number, number][],
  faces: readonly Face[],
): GyrationSeam | null {
  const on: number[] = [];
  let above = false;
  let below = false;
  for (let i = 0; i < points.length; i++) {
    const d = proj[i]! - level;
    if (Math.abs(d) < LEVEL_EPSILON) on.push(i);
    else if (d > 0) above = true;
    else below = true;
  }
  if (on.length < 3 || !above || !below) return null;

  // No edge may cross the plane: then no face straddles it either, because a
  // face is flat and its boundary is edges. And the edges that lie in the
  // plane have to form one closed loop — the cut line.
  const near = new Uint8Array(points.length);
  for (const i of on) near[i] = 1;
  const loop: [number, number][] = [];
  const degree = new Map<number, number[]>();
  for (const [a, b] of edges) {
    const da = proj[a]! - level;
    const db = proj[b]! - level;
    if (near[a] && near[b]) {
      loop.push([a, b]);
      (degree.get(a) ?? degree.set(a, []).get(a)!).push(b);
      (degree.get(b) ?? degree.set(b, []).get(b)!).push(a);
      continue;
    }
    if (da > LEVEL_EPSILON && db < -LEVEL_EPSILON) return null;
    if (da < -LEVEL_EPSILON && db > LEVEL_EPSILON) return null;
  }
  if (degree.size !== on.length) return null;
  for (const [, next] of degree) if (next.length !== 2) return null;
  // One loop, not two: walk it and see that it comes back having seen them all.
  // The walk is kept, because the order it visits the vertices in *is* the cut
  // line, and a bulkhead is that line inset.
  const ring: number[] = [];
  let at = on[0]!;
  let from = -1;
  do {
    ring.push(at);
    const next = degree.get(at)!;
    const step = next[0] === from ? next[1]! : next[0]!;
    from = at;
    at = step;
  } while (at !== on[0]! && ring.length <= on.length);
  if (ring.length !== on.length) return null;
  // A face lying in the plane would belong to neither piece.
  for (const face of faces) {
    if (face.vertices.every(v => Math.abs(dot(v, axis) - level) < LEVEL_EPSILON)) return null;
  }

  // The centre of the loop has to sit on the axis, or a turn about the axis is
  // not a symmetry of the loop whatever its order looks like.
  let cx = 0, cy = 0, cz = 0;
  for (const i of on) {
    cx += points[i]![0];
    cy += points[i]![1];
    cz += points[i]![2];
  }
  const centre: Vec3 = [cx / on.length, cy / on.length, cz / on.length];
  const height = dot(centre, axis);
  const radial = sub(centre, [axis[0] * height, axis[1] * height, axis[2] * height]);
  if (norm(radial) > 1e-6) return null;

  // Polar coordinates of the loop in its own plane, then the largest turn that
  // carries every vertex onto a vertex *and* every edge onto an edge. Radius
  // and angle rather than distance in space: the points all lie in one plane,
  // so this is exact where a 3D comparison drifts.
  const e1 = normalize(sub(points[on[0]!]!, centre));
  const e2 = cross(axis, e1);
  const angle = new Map<number, number>();
  const radius = new Map<number, number>();
  for (const i of on) {
    const d = sub(points[i]!, centre);
    angle.set(i, Math.atan2(dot(d, e2), dot(d, e1)));
    radius.set(i, norm(d));
  }
  const edgeKey = new Set(loop.map(([a, b]) => (a < b ? `${a}:${b}` : `${b}:${a}`)));
  for (let order = on.length; order >= 2; order--) {
    const step = (2 * Math.PI) / order;
    const image = new Map<number, number>();
    for (const i of on) {
      const want = angle.get(i)! + step;
      const found = on.find(j =>
        Math.abs(((want - angle.get(j)! + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1e-5 &&
        Math.abs(radius.get(i)! - radius.get(j)!) < 1e-5);
      if (found === undefined) break;
      image.set(i, found);
    }
    if (image.size !== on.length) continue;
    const carries = loop.every(([a, b]) => {
      const p = image.get(a)!;
      const q = image.get(b)!;
      return edgeKey.has(p < q ? `${p}:${q}` : `${q}:${p}`);
    });
    if (carries) return { level, order, loop: on.length, polygon: ring.map(i => points[i]!) };
  }
  return null;
}

/**
 * Every axis the solid can be cut and turned on, richest first.
 *
 * "Richest" is the number of states, then the number of pieces: an axis that
 * gives more ways to turn the same number of pieces is the better one to
 * offer, and the tie is broken towards more pieces to turn.
 */
export function gyrationAxes(faces: readonly Face[]): GyrationAxis[] {
  const { points, edges } = skeleton(faces);
  const found: GyrationAxis[] = [];
  for (const axis of candidateAxes(faces, points, edges)) {
    const proj = points.map(p => dot(p, axis));
    const levels = [...new Set(proj.map(t => Math.round(t / LEVEL_EPSILON) * LEVEL_EPSILON))];
    const seams: GyrationSeam[] = [];
    for (const level of levels) {
      const seam = seamAt(axis, level, points, proj, edges, faces);
      if (seam) seams.push(seam);
    }
    if (seams.length === 0) continue;
    seams.sort((a, b) => a.level - b.level);
    const turnSteps = seams.map(s => s.order).reduce(gcd);
    if (turnSteps < 2) continue;
    found.push({
      axis,
      seams,
      turnSteps,
      pieces: seams.length + 1,
      stateCount: turnSteps ** seams.length,
    });
  }
  found.sort((a, b) => b.stateCount - a.stateCount || b.pieces - a.pieces);
  return found;
}
