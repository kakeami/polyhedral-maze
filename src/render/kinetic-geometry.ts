/**
 * 3D geometry for a kinetic (multi-state) maze.
 *
 * The whole point of the mechanism is that the drawing on a piece never
 * changes: a side is open or closed by its *class*, and a class is shared by
 * every side it can ever meet, so the walls are a property of the piece alone
 * (see `core/kinetic/surface.ts`). That is why everything here comes back in
 * each piece's own body frame and is built once: to animate the object, the
 * scene moves the pieces, it does not rebuild the maze.
 *
 * The one thing that does depend on the state is the route from start to goal,
 * which is why `kineticSolutionPath` is separate and returns world coordinates.
 *
 * DOM-free and three-free, like `maze-geometry.ts`.
 */

import type { Vec3 } from '../core/types.ts';
import type { Mechanism, KineticCell } from '../core/kinetic/types.ts';
import { applyPlacement } from '../core/kinetic/types.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign, StartGoal } from '../core/kinetic/maze.ts';
import type { MazeMarker } from './maze-geometry.ts';

export interface PieceBounds {
  /** Largest distance from the turning axis, in the body frame. */
  readonly radius: number;
  readonly zMin: number;
  readonly zMax: number;
}

export interface KineticGeometryOptions {
  /**
   * Shortens each piece along the turning axis, as a fraction of its own
   * height, so a stack reads as separate pieces on a dowel rather than one
   * barrel with lines drawn around it.
   *
   * Axis-aligned, and therefore an assumption about the mechanism: the stack
   * is arranged along z. Anything else should leave it at 0 until it says
   * where its own daylight goes.
   */
  readonly axialGap?: number;
}

export interface KineticPieceGeometry {
  readonly piece: number;
  /** Cell polygons, triangulated, body frame. */
  readonly positions: number[];
  readonly normals: number[];
  /** Closed sides as consecutive pairs of points, body frame. */
  readonly walls: Vec3[];
  /** Free rim of the object — sides that never meet anything — as pairs. */
  readonly rim: Vec3[];
  /** Start / goal pins carried by this piece, body frame. */
  readonly markers: MazeMarker[];
  readonly bounds: PieceBounds;
}

export function cellCentre(cell: KineticCell): Vec3 {
  const c = cell.corners;
  let x = 0, y = 0, z = 0;
  for (const v of c) {
    x += v[0]; y += v[1]; z += v[2];
  }
  return [x / c.length, y / c.length, z / c.length];
}

/**
 * Outward unit normal of a cell.
 *
 * Cells are wound counter-clockwise seen from outside the object — the
 * convention every mechanism here follows — so the cross product of two
 * consecutive edges points out of the surface without needing to know where
 * the inside is. That matters for the toroidal and non-convex cases, where
 * "away from the origin" is not outward at all.
 */
export function cellNormal(cell: KineticCell): Vec3 {
  const [a, b, c] = [cell.corners[0]!, cell.corners[1]!, cell.corners[2]!];
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - b[0], vy = c[1] - b[1], vz = c[2] - b[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/**
 * Size of the whole object, in world coordinates, for fitting the camera.
 *
 * Measured in one state because a mechanism's states are rigid rearrangements
 * of the same pieces; where that stops being true (a ring that folds flat) the
 * caller wants the largest state, not this.
 */
export function modelBounds(mech: Mechanism, stateIndex = 0): PieceBounds {
  const state = mech.states[stateIndex];
  if (!state) throw new Error(`no such state: ${stateIndex}`);
  let radius = 0;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const cell of mech.cells) {
    const placement = state[cell.piece]!;
    for (const v of cell.corners) {
      const w = applyPlacement(placement, v);
      radius = Math.max(radius, Math.hypot(w[0], w[1]));
      zMin = Math.min(zMin, w[2]);
      zMax = Math.max(zMax, w[2]);
    }
  }
  return { radius, zMin, zMax };
}

/**
 * Every piece's surface, walls and rim, in the piece's own body frame.
 *
 * A wall stands wherever a side's class is not open — the same one-line rule
 * the printed pattern uses (`stack-sheet-model.ts`), which is what keeps the
 * screen and the paper honest about each other.
 */
export function buildKineticPieces(
  mech: Mechanism,
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  ends?: StartGoal | null,
  options: KineticGeometryOptions = {},
): KineticPieceGeometry[] {
  const shrink = axialShrink(mech, options.axialGap ?? 0);
  const pieces: {
    positions: number[];
    normals: number[];
    walls: Vec3[];
    rim: Vec3[];
    markers: MazeMarker[];
    radius: number;
    zMin: number;
    zMax: number;
  }[] = Array.from({ length: mech.pieceCount }, () => ({
    positions: [], normals: [], walls: [], rim: [], markers: [],
    radius: 0, zMin: Infinity, zMax: -Infinity,
  }));

  // An internal class is one wall shared by two cells of the same piece, so it
  // would otherwise be drawn twice, in exactly the same place.
  const drawnInternal = new Set<number>();

  mech.cells.forEach((cell, index) => {
    const piece = pieces[cell.piece]!;
    const corners = cell.corners.map(v => shrink(v, cell.piece));
    // From the cell as it is, not as it is drawn: a hair off the height must
    // not tilt the normal the pins and the shading stand on.
    const normal = cellNormal(cell);

    for (let i = 1; i < corners.length - 1; i++) {
      for (const v of [corners[0]!, corners[i]!, corners[i + 1]!]) {
        piece.positions.push(v[0], v[1], v[2]);
        piece.normals.push(normal[0], normal[1], normal[2]);
      }
    }
    for (const v of corners) {
      piece.radius = Math.max(piece.radius, Math.hypot(v[0], v[1]));
      piece.zMin = Math.min(piece.zMin, v[2]);
      piece.zMax = Math.max(piece.zMax, v[2]);
    }

    const base = surface.sideStart[index]!;
    for (let side = 0; side < corners.length; side++) {
      const classId = surface.classOf[base + side]!;
      const kind = surface.classKind[classId]!;
      const a = corners[side]!;
      const b = corners[(side + 1) % corners.length]!;
      if (kind === 'rim') {
        piece.rim.push(a, b);
      } else if (!design.open.has(classId)) {
        if (kind === 'internal') {
          if (drawnInternal.has(classId)) continue;
          drawnInternal.add(classId);
        }
        piece.walls.push(a, b);
      }
    }

    if (ends && (index === ends.start || index === ends.goal)) {
      piece.markers.push({
        kind: index === ends.start ? 'start' : 'goal',
        at: shrink(cellCentre(cell), cell.piece),
        normal,
      });
    }
  });

  return pieces.map((p, piece) => ({
    piece,
    positions: p.positions,
    normals: p.normals,
    walls: p.walls,
    rim: p.rim,
    markers: p.markers,
    bounds: {
      radius: p.radius,
      zMin: p.zMin === Infinity ? 0 : p.zMin,
      zMax: p.zMax === -Infinity ? 0 : p.zMax,
    },
  }));
}

/**
 * The route from start to goal in one state, in world coordinates.
 *
 * This is the part that has to be redrawn every time a piece clicks into its
 * next position: the walls are printed and never move, but which way round
 * them leads anywhere is different in each of the mechanism's states.
 */
export function kineticSolutionPath(
  mech: Mechanism,
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  stateIndex: number,
  ends: StartGoal,
  options: KineticGeometryOptions = {},
): Vec3[] {
  const shrink = axialShrink(mech, options.axialGap ?? 0);
  const adj = surface.adjByState[stateIndex];
  if (!adj) throw new Error(`no such state: ${stateIndex}`);

  const neighbours = new Map<number, number[]>();
  for (const e of adj) {
    if (!design.open.has(e.classId)) continue;
    if (!neighbours.has(e.a)) neighbours.set(e.a, []);
    if (!neighbours.has(e.b)) neighbours.set(e.b, []);
    neighbours.get(e.a)!.push(e.b);
    neighbours.get(e.b)!.push(e.a);
  }

  const previous = new Map<number, number>([[ends.start, -1]]);
  const queue = [ends.start];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i]!;
    if (node === ends.goal) break;
    for (const next of neighbours.get(node) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, node);
      queue.push(next);
    }
  }
  if (!previous.has(ends.goal)) return [];

  const cells: number[] = [];
  for (let at = ends.goal; at !== -1; at = previous.get(at)!) cells.push(at);
  cells.reverse();

  const state = mech.states[stateIndex]!;
  return cells.map(index => {
    const cell = mech.cells[index]!;
    return applyPlacement(state[cell.piece]!, shrink(cellCentre(cell), cell.piece));
  });
}

/**
 * Pulls a body-frame point towards its own piece's mid-height.
 *
 * Shared by the surface and the route on purpose: a gap applied to one and not
 * the other leaves the answer floating off the maze it runs through.
 */
function axialShrink(mech: Mechanism, gap: number): (v: Vec3, piece: number) => Vec3 {
  if (gap <= 0) return v => v;
  const extent = new Map<number, [number, number]>();
  for (const cell of mech.cells) {
    const range = extent.get(cell.piece) ?? [Infinity, -Infinity];
    for (const v of cell.corners) {
      range[0] = Math.min(range[0], v[2]);
      range[1] = Math.max(range[1], v[2]);
    }
    extent.set(cell.piece, range);
  }
  const centres = new Map<number, number>();
  for (const [piece, [lo, hi]] of extent) centres.set(piece, (lo + hi) / 2);

  return (v, piece) => {
    const centre = centres.get(piece) ?? 0;
    return [v[0], v[1], centre + (v[2] - centre) * (1 - gap)];
  };
}

/** Cells the path visits, for reporting its length without building geometry. */
export function solutionLength(
  mech: Mechanism,
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  stateIndex: number,
  ends: StartGoal,
): number {
  return Math.max(0, kineticSolutionPath(mech, surface, design, stateIndex, ends).length - 1);
}
