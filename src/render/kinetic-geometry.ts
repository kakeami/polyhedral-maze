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
  /**
   * Closes each piece off at both ends, so a stack reads as a row of tins on a
   * shelf rather than a set of open bands.
   *
   * The flat ends carry no maze — in the built object they are the bulkheads
   * that keep a paper ring round — and they are deliberately not outlined,
   * because a line all the way around the end of a ring would draw a wall
   * across the seam passages that cross it.
   *
   * Axis-aligned like `axialGap`, and for the same reason.
   */
  readonly caps?: boolean;
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
    /** Every corner of the piece, kept only long enough to close its ends. */
    corners: Vec3[];
  }[] = Array.from({ length: mech.pieceCount }, () => ({
    positions: [], normals: [], walls: [], rim: [], markers: [],
    radius: 0, zMin: Infinity, zMax: -Infinity, corners: [] as Vec3[],
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
      piece.corners.push(v);
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

  if (options.caps) {
    for (const piece of pieces) {
      addCap(piece, piece.zMax, 1);
      addCap(piece, piece.zMin, -1);
    }
  }

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
/**
 * Fills in the flat end of a piece, as a fan of triangles around its middle.
 *
 * The outline of the end is whatever corners sit at that height, which is the
 * cross-section of the piece — a polygon, once the duplicates two neighbouring
 * cells share are dropped and the rest are put in order around it.
 */
function addCap(
  piece: { positions: number[]; normals: number[]; corners: Vec3[] },
  z: number,
  outward: 1 | -1,
): void {
  const seen = new Set<string>();
  const ring: Vec3[] = [];
  for (const v of piece.corners) {
    if (Math.abs(v[2] - z) > 1e-9) continue;
    // Quantised, not printed. Two cells meeting at a corner of the prism reach
    // it along different faces — one by interpolating to the end of its own
    // face, the other from the start of the next — and the last bits differ,
    // so a decimal key leaves a duplicate point in the ring and a stray sliver
    // of triangle in the end of every piece.
    const key = `${Math.round(v[0] / 1e-6)},${Math.round(v[1] / 1e-6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ring.push(v);
  }
  if (ring.length < 3) return;

  let cx = 0;
  let cy = 0;
  for (const v of ring) {
    cx += v[0];
    cy += v[1];
  }
  cx /= ring.length;
  cy /= ring.length;
  ring.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));

  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    // Wound so the face points the way its normal does, seen from outside.
    const triangle = outward === 1 ? [[cx, cy, z] as Vec3, a, b] : [[cx, cy, z] as Vec3, b, a];
    for (const v of triangle) {
      piece.positions.push(v[0], v[1], z);
      piece.normals.push(0, 0, outward);
    }
  }
}

/**
 * The cells the route visits, in order, and the side class it left each one
 * through. Empty when the two ends are not joined in this state.
 */
export function solutionCells(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  stateIndex: number,
  ends: StartGoal,
): { cells: number[]; doorway: Map<number, number> } {
  const adj = surface.adjByState[stateIndex];
  if (!adj) throw new Error(`no such state: ${stateIndex}`);

  const neighbours = new Map<number, { to: number; classId: number }[]>();
  for (const e of adj) {
    if (!design.open.has(e.classId)) continue;
    if (!neighbours.has(e.a)) neighbours.set(e.a, []);
    if (!neighbours.has(e.b)) neighbours.set(e.b, []);
    neighbours.get(e.a)!.push({ to: e.b, classId: e.classId });
    neighbours.get(e.b)!.push({ to: e.a, classId: e.classId });
  }

  const previous = new Map<number, number>([[ends.start, -1]]);
  /** Which side class each cell was reached through — the door, not the room. */
  const doorway = new Map<number, number>();
  const queue = [ends.start];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i]!;
    if (node === ends.goal) break;
    for (const { to, classId } of neighbours.get(node) ?? []) {
      if (previous.has(to)) continue;
      previous.set(to, node);
      doorway.set(to, classId);
      queue.push(to);
    }
  }
  if (!previous.has(ends.goal)) return { cells: [], doorway };

  const cells: number[] = [];
  for (let at = ends.goal; at !== -1; at = previous.get(at)!) cells.push(at);
  cells.reverse();
  return { cells, doorway };
}

export function kineticSolutionPath(
  mech: Mechanism,
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  stateIndex: number,
  ends: StartGoal,
  options: KineticGeometryOptions = {},
): Vec3[] {
  const { cells, doorway } = solutionCells(surface, design, stateIndex, ends);
  if (cells.length === 0) return [];
  const shrink = axialShrink(mech, options.axialGap ?? 0);
  const state = mech.states[stateIndex]!;
  const centreOf = (index: number): Vec3 => {
    const cell = mech.cells[index]!;
    return applyPlacement(state[cell.piece]!, shrink(cellCentre(cell), cell.piece));
  };

  /**
   * Midpoint of the side of `index` that faces `towards`, in world coordinates.
   *
   * A cell can hold two sides of the same class — the top and bottom of a
   * one-row ring both meet the neighbouring ring — so the class narrows it down
   * and the distance decides.
   */
  const doorMidpoint = (index: number, classId: number, towards: Vec3): Vec3 | null => {
    const cell = mech.cells[index]!;
    const placement = state[cell.piece]!;
    const base = surface.sideStart[index]!;
    let best: Vec3 | null = null;
    let bestDistance = Infinity;
    for (let side = 0; side < cell.corners.length; side++) {
      if (surface.classOf[base + side] !== classId) continue;
      const a = shrink(cell.corners[side]!, cell.piece);
      const b = shrink(cell.corners[(side + 1) % cell.corners.length]!, cell.piece);
      const middle = applyPlacement(placement, [
        (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2,
      ]);
      const distance =
        (middle[0] - towards[0]) ** 2 +
        (middle[1] - towards[1]) ** 2 +
        (middle[2] - towards[2]) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = middle;
      }
    }
    return best;
  };

  /**
   * The route goes centre, doorway, doorway, centre — not centre to centre.
   *
   * Straight between two centres is a chord, and a chord across the edge of a
   * prism passes *inside* the solid: the surface it is meant to lie on hides
   * it, and the answer appears to break every time it turns a corner. The same
   * goes for the gap between two rings, where the two doorways are not even in
   * the same place, and the line has to cross from one to the other.
   */
  const path: Vec3[] = [];
  const push = (point: Vec3) => {
    const last = path[path.length - 1];
    if (last && near(last, point)) return;
    path.push(point);
  };

  cells.forEach((index, i) => {
    const centre = centreOf(index);
    if (i > 0) {
      const previousCell = cells[i - 1]!;
      const classId = doorway.get(index);
      if (classId !== undefined) {
        const leaving = doorMidpoint(previousCell, classId, centre);
        const arriving = doorMidpoint(index, classId, centreOf(previousCell));
        if (leaving) push(leaving);
        if (arriving) push(arriving);
      }
    }
    push(centre);
  });
  return path;
}

function near(a: Vec3, b: Vec3, epsilon = 1e-9): boolean {
  return (
    Math.abs(a[0] - b[0]) < epsilon &&
    Math.abs(a[1] - b[1]) < epsilon &&
    Math.abs(a[2] - b[2]) < epsilon
  );
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

/**
 * Steps from start to goal: cells walked through, not points drawn.
 *
 * Not the length of `kineticSolutionPath`, which carries two more points at
 * every doorway so the line stays on the surface.
 */
export function solutionLength(
  surface: KineticSurface,
  design: Pick<KineticDesign, 'open'>,
  stateIndex: number,
  ends: StartGoal,
): number {
  return Math.max(0, solutionCells(surface, design, stateIndex, ends).cells.length - 1);
}
