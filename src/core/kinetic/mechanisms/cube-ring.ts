/**
 * Cubes hinged into a closed ring: the mechanism, for any number of them.
 *
 * The ring is the point. A chain of pieces can be turned one joint at a time
 * with everything past the joint going along for the ride, which is what the
 * stack and the glued pair do; a *closed* chain cannot, so the only pose a
 * hinge can take is one that the rest of the ring also agrees to. That makes
 * the states scarce and hard-won rather than a free product of per-piece
 * choices, and it is what buries part of the surface: folded shut, two cubes
 * meet face to face and both of those faces stop being part of the object.
 *
 * An object of this kind is three things and nothing else — how many cubes,
 * how they are laid out when the tape goes on, and which edge each strip of
 * tape sits on (`cube-ring-objects.ts` is the list of them). Everything else
 * is read off those by geometry: which shapes it shuts into, which of those a
 * hand can stop at, which it can fold between, and therefore what the maze has
 * to survive.
 *
 * Three rules decide what counts as a state, and all three are the object
 * rather than a preference:
 *
 * - **A pose is a shape a hand can set down**: the cubes fill a solid block,
 *   or they lie one layer thick. An L of two layers is neither, and stands up
 *   only until someone lets go of it.
 * - **The tape has to be reachable.** A hinge with all four cubes round it
 *   present is buried inside the object; the shape exists on paper and not in
 *   the hand.
 * - **A pose nobody can fold to is not a state.** Short of peeling the tape
 *   off there is no way into it, so it is counted as a stray and left out —
 *   but every pose in the same component of the fold graph is kept, because a
 *   hand can get to all of them and the maze must hold up in each.
 *
 * DOM-free, like everything in `core/`.
 */

import type { Vec3 } from '../../types.ts';
import type { KineticCell, KineticState, Mat3, Mechanism, Placement } from '../types.ts';
import { IDENTITY } from '../types.ts';
import { buildFoldGraph, poseDistances } from '../fold-path.ts';
import type { FoldGraph } from '../fold-path.ts';

/** A cell of the cubic lattice the object is laid out on before it is taped. */
export type Lattice = readonly [number, number, number];

/**
 * An object: a ring of cubes, laid out and taped.
 *
 * The layout is the *reference*, the arrangement the tape is applied in — not
 * a pose the object prefers, though it is usually one of them. Everything is
 * measured against it, so two objects with the same taping numbers and
 * different references are different objects.
 */
export interface CubeRingObject {
  /** What a link calls it. */
  readonly id: string;
  /** What the panel calls it. */
  readonly label: string;
  /** One line about what it folds into. */
  readonly blurb: string;
  /** Where each cube sits while the tape is applied, in ring order. */
  readonly ring: readonly Lattice[];
  /** Which edge of each shared face the tape crosses. See `hingeLine`. */
  readonly hinges: readonly number[];
  /** The finest ruling worth offering: how small a cell can be cut out. */
  readonly maxCells: number;
}

/**
 * One strip of tape: the edge two cubes are hinged on, as each of them sees it.
 *
 * The hinge is a line in the lattice the object is laid out on, which is no
 * use to anyone printing a cube: a pattern is drawn in the cube's own frame
 * and cut out before the ring exists. So the same edge is given twice over,
 * once in each cube's frame, and it is the *same* edge — laid out as the
 * reference the two coincide, which is what fixes that this is a hinge and not
 * two marks that happen to be near each other.
 */
export interface TapeSeam {
  readonly seam: number;
  /** The cubes it joins, in ring order. */
  readonly pieces: readonly [number, number];
  /** The taped edge in the body frame of `pieces[0]`, then of `pieces[1]`. */
  readonly ends: readonly [readonly [Vec3, Vec3], readonly [Vec3, Vec3]];
}

/** A shape a hand can stop at, and what it looks like. */
export interface CubeRingPose {
  /** Where it sits in `closures()`. */
  readonly closure: number;
  /** Quarter turns at each hinge. */
  readonly turns: readonly number[];
  /** Genus of the object's surface here: 1 once it shuts into a frame. */
  readonly genus: number;
  /** Squares of the cubes' 6n faces that are on the outside. */
  readonly exposed: number;
  /** The shape's extent in lattice cells, in the order x, y, z. */
  readonly span: readonly number[];
  /** The occupancy, layer by layer, for anything that has to print it. */
  readonly layers: string;
  /** What to call it: Cube 1, Plank 2, Frame 1. */
  readonly label: string;
}

export interface CubeRingMechanism extends Mechanism {
  readonly object: CubeRingObject;
  /** Cells across one face of one cube. */
  readonly cellsPerFace: number;
  readonly ring: readonly Lattice[];
  readonly hinges: readonly number[];
  /** The states, described: same order, same length. */
  readonly poses: readonly CubeRingPose[];
  /** Poses of this object a hand cannot fold to from the states. */
  readonly strays: readonly CubeRingPose[];
  /** Index into `cells` for one cell of one cube. */
  cellIndex(piece: number, face: number, row: number, col: number): number;
  /**
   * Every way the ring closes, the open shapes included — `states` is the part
   * of this a hand can stop at. The way from one pose to another goes through
   * the rest, so anything working out the *motion* needs all of them.
   */
  closures(): readonly KineticState[];
  /** The folds between all of those, worked out once per object. */
  foldGraph(): FoldGraph;
  /** Where the tape goes, seam by seam, in the body frame of each cube. */
  tapeSeams(): readonly TapeSeam[];
  /** Half-extents of each piece about its own origin: these pieces are cubes. */
  readonly pieceHalfExtents: readonly Vec3[];
}

export interface CubeRingOptions {
  /** Cells across one face of one cube. */
  cells?: number;
  /** Refuse to build past this many closures, rather than grind. */
  maxClosures?: number;
}

// ─── the lattice arithmetic ──────────────────────────────────────────────
//
// Exact integers throughout: every placement is built by multiplying quarter
// turns together, and a drift of one part in 10^16 per turn is enough to stop
// two folded cubes from welding to the same corner.

function applyMat(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** The placement that applies `b` first and then `a`. */
function compose(a: Placement, b: Placement): Placement {
  const rot: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a.rot[i]![k]! * b.rot[k]![j]!;
      rot[i]![j] = sum;
    }
  }
  const moved = applyMat(a.rot, b.offset);
  return {
    rot: rot as unknown as Mat3,
    offset: [moved[0] + a.offset[0], moved[1] + a.offset[1], moved[2] + a.offset[2]],
  };
}

/** Rotation by whole quarter turns about a coordinate axis. */
function quarterTurn(axis: number, steps: number): Mat3 {
  const turn = ((steps % 4) + 4) % 4;
  const c = [1, 0, -1, 0][turn]!;
  const s = [0, 1, 0, -1][turn]!;
  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  const m: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  m[axis]![axis] = 1;
  m[u]![u] = c;
  m[v]![u] = s;
  m[u]![v] = -s;
  m[v]![v] = c;
  return m as unknown as Mat3;
}

function rotateAboutLine(point: Vec3, axis: number, steps: number): Placement {
  const rot = quarterTurn(axis, steps);
  const moved = applyMat(rot, point);
  return { rot, offset: [point[0] - moved[0], point[1] - moved[1], point[2] - moved[2]] };
}

const centreOf = (p: Lattice): Vec3 => [p[0] + 0.5, p[1] + 0.5, p[2] + 0.5];

/** Half-integers exactly, so a placement can be keyed on its text. */
const keyOf = (p: Placement): string =>
  `${p.rot.map(row => row.join(',')).join(';')}|${p.offset.map(x => x.toFixed(1)).join(',')}`;

const offsetKey = (v: Vec3): string => v.map(x => x.toFixed(1)).join(',');

/**
 * The line one pair of cubes is hinged on.
 *
 * A hinge is a shared *edge*, which two cubes can have in two ways. Face to
 * face — one lattice coordinate apart — they share a whole square, and any of
 * its four edges will serve as the hinge; those are numbered round the square,
 * starting at the one that runs along the first of the other two axes at their
 * low corner. Cornerwise — two coordinates apart, meeting at a right angle
 * about their common edge — there is exactly one shared edge and no choice to
 * make. The second kind is what turns a cube as the ring folds, so it is the
 * second kind that brings new faces to the surface.
 */
export function hingeLine(
  from: Lattice,
  to: Lattice,
  edge: number,
): { point: Vec3; axis: number } {
  const apart = [0, 1, 2].filter(a => from[a] !== to[a]);
  if (apart.length === 0) throw new Error('two cubes of the ring share a lattice cell');
  if (apart.length === 3) throw new Error('two cubes of the ring meet at a corner only');

  const at: number[] = [from[0]!, from[1]!, from[2]!];
  for (const a of apart) at[a] = Math.max(from[a]!, to[a]!);
  if (apart.length === 2) {
    const along = [0, 1, 2].find(a => !apart.includes(a))!;
    return { point: at as unknown as Vec3, axis: along };
  }

  const axis = apart[0]!;
  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  switch (((edge % 4) + 4) % 4) {
    case 0: return { point: at as unknown as Vec3, axis: u };
    case 1: at[u] = from[u]! + 1; return { point: at as unknown as Vec3, axis: v };
    case 2: at[v] = from[v]! + 1; return { point: at as unknown as Vec3, axis: u };
    default: return { point: at as unknown as Vec3, axis: v };
  }
}

// ─── reference layouts ───────────────────────────────────────────────────

/**
 * The perimeter of a 2 by n/2 plank: its one Hamiltonian cycle.
 *
 * How these objects are actually built — the cubes in a row and back, taped
 * round the rim — rather than a loop through the faces of a solid block, which
 * is a different mechanism and a duller one: hinged that way the cubes never
 * turn, so the same squares face outward for ever and folding only shuffles
 * the walls of a fixed maze.
 */
export function plankRing(n: number): Lattice[] {
  if (n < 4 || n % 2 !== 0) throw new Error(`no plank of ${n} cubes`);
  const half = n / 2;
  const ring: Lattice[] = [];
  for (let x = 0; x < half; x++) ring.push([x, 0, 0]);
  for (let x = half - 1; x >= 0; x--) ring.push([x, 1, 0]);
  return ring;
}

/**
 * The perimeter of a w by h rectangle with its middle out: n = 2(w + h) − 4.
 *
 * A reference with a hole in it, which is what an object has to be laid out on
 * if a *pose* is ever to have one. The counts that matter are not squares: ten
 * cubes go round a 3 by 4 and twelve go round a 3 by 5 as well as a 4 by 4,
 * and those are different objects.
 */
export function rectRing(w: number, h: number): Lattice[] {
  if (w < 3 || h < 3) throw new Error(`a ${w}x${h} rectangle has no hole`);
  const ring: Lattice[] = [];
  for (let x = 0; x < w; x++) ring.push([x, 0, 0]);
  for (let y = 1; y < h; y++) ring.push([w - 1, y, 0]);
  for (let x = w - 2; x >= 0; x--) ring.push([x, h - 1, 0]);
  for (let y = h - 2; y >= 1; y--) ring.push([0, y, 0]);
  return ring;
}

// ─── every way it closes ─────────────────────────────────────────────────

/**
 * Every way the ring closes back on itself, open shapes included.
 *
 * A hinge turns in whole quarter turns — anything else leaves the lattice, and
 * the cubes would not meet — so a configuration is one turn count per hinge,
 * and all that is asked of them is that the chain comes back to where it
 * started with no two cubes in the same cell.
 *
 * The first cube is pinned, which is what quotients out turning the whole
 * object round in your hands: those are one shape, not twenty-four.
 *
 * A closed walk of n cells cannot reach further than n/2 from where it began,
 * so capping the span at n/2 + 1 loses nothing and saves a great deal. (An
 * earlier sweep capped it at 4 regardless of n, which hid every shape six
 * cells long — the 2 by 6 plank among them — and with it most of what these
 * objects are for.)
 */
export function ringClosures(
  ring: readonly Lattice[],
  hinges: readonly number[],
  options: { maxClosures?: number } = {},
): { shapes: KineticState[]; turns: number[][] } {
  const pieces = ring.length;
  if (hinges.length !== pieces) {
    throw new Error(`a ring of ${pieces} cubes needs ${pieces} hinges`);
  }
  const maxClosures = options.maxClosures ?? 100000;
  const bound = pieces / 2 + 1;

  const relative: Placement[][] = [];
  for (let i = 0; i < pieces; i++) {
    const from = ring[i]!;
    const to = ring[(i + 1) % pieces]!;
    const line = hingeLine(from, to, hinges[i]!);
    const back: Placement = { rot: IDENTITY, offset: centreOf(from).map(x => -x) as Vec3 };
    const forth: Placement = { rot: IDENTITY, offset: centreOf(to) };
    relative.push([0, 1, 2, 3].map(steps =>
      compose(compose(back, rotateAboutLine(line.point, line.axis, steps)), forth),
    ));
  }

  const start: Placement = { rot: IDENTITY, offset: centreOf(ring[0]!) };
  const startKey = keyOf(start);
  const shapes: KineticState[] = [];
  const turns: number[][] = [];
  const placed: Placement[] = [start];
  const taken = new Set<string>([offsetKey(start.offset)]);
  const chosen: number[] = [];

  const onLattice = (v: Vec3): boolean =>
    v.every(x => Math.abs(x - Math.round(x - 0.5) - 0.5) < 1e-9);
  const spanOf = (axis: number): number => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of placed) {
      lo = Math.min(lo, p.offset[axis]!);
      hi = Math.max(hi, p.offset[axis]!);
    }
    return hi - lo + 1;
  };

  const walk = (index: number): void => {
    if (shapes.length > maxClosures) throw new Error(`over ${maxClosures} closures`);
    if (index === pieces - 1) {
      for (let steps = 0; steps < 4; steps++) {
        if (keyOf(compose(placed[index]!, relative[index]![steps]!)) !== startKey) continue;
        shapes.push(placed.map(p => ({ rot: p.rot, offset: p.offset })));
        turns.push([...chosen, steps]);
      }
      return;
    }
    for (let steps = 0; steps < 4; steps++) {
      const next = compose(placed[index]!, relative[index]![steps]!);
      const where = offsetKey(next.offset);
      if (!onLattice(next.offset) || taken.has(where)) continue;
      placed.push(next);
      if (spanOf(0) > bound || spanOf(1) > bound || spanOf(2) > bound) {
        placed.pop();
        continue;
      }
      taken.add(where);
      chosen.push(steps);
      walk(index + 1);
      chosen.pop();
      taken.delete(where);
      placed.pop();
    }
  };
  walk(0);
  return { shapes, turns };
}

// ─── what a hand can hold ────────────────────────────────────────────────

/** Where each strip of tape sits, in the body frame of the cube it starts on. */
function tapeFrames(
  ring: readonly Lattice[],
  hinges: readonly number[],
): { mid: Vec3; axis: Vec3 }[] {
  return ring.map((from, i) => {
    const line = hingeLine(from, ring[(i + 1) % ring.length]!, hinges[i]!);
    const centre = centreOf(from);
    const unit: Vec3 = [0, 0, 0];
    unit[line.axis] = 1;
    return {
      mid: [
        line.point[0] + unit[0] / 2 - centre[0],
        line.point[1] + unit[1] / 2 - centre[1],
        line.point[2] + unit[2] / 2 - centre[2],
      ],
      axis: unit,
    };
  });
}

/**
 * Whether every strip of tape is still reachable from outside the object.
 *
 * An edge with all four cubes round it present is inside the shape, and tape
 * cannot be there: the pose exists on paper and not in the hand.
 */
function tapeOutside(
  placed: readonly Placement[],
  frames: readonly { mid: Vec3; axis: Vec3 }[],
): boolean {
  const centres = placed.map(p => p.offset);
  for (let i = 0; i < placed.length; i++) {
    const at = placed[i]!;
    const mid = applyMat(at.rot, frames[i]!.mid);
    const world: Vec3 = [mid[0] + at.offset[0], mid[1] + at.offset[1], mid[2] + at.offset[2]];
    const along = applyMat(at.rot, frames[i]!.axis);
    const across = [0, 1, 2].filter(a => Math.abs(along[a]!) < 0.5);
    let round = 0;
    for (const du of [-0.5, 0.5]) {
      for (const dv of [-0.5, 0.5]) {
        const probe: number[] = [world[0], world[1], world[2]];
        probe[across[0]!] = probe[across[0]!]! + du;
        probe[across[1]!] = probe[across[1]!]! + dv;
        if (centres.some(c => c.every((x, a) => Math.abs(x - probe[a]!) < 1e-9))) round++;
      }
    }
    if (round === 4) return false;
  }
  return true;
}

interface Skin {
  /** Genus of the boundary, summed over its components. */
  readonly genus: number;
  readonly manifold: boolean;
  /** Boundary components: two means a sealed cavity, one means none. */
  readonly comps: number;
  readonly exposed: number;
  /** Whether two cubes meet at a vertex alone — a pinch the edge test misses. */
  readonly pinched: boolean;
}

/** The boundary surface of the shape, from which cells it occupies alone. */
function skinOf(offsets: readonly Vec3[]): Skin {
  const cells = offsets.map(c => c.map(x => Math.round(x - 0.5)));
  const at = new Set(cells.map(c => c.join(',')));
  const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const faces: string[][] = [];
  for (const key of at) {
    const c = key.split(',').map(Number);
    for (const d of dirs) {
      if (at.has([c[0]! + d[0]!, c[1]! + d[1]!, c[2]! + d[2]!].join(','))) continue;
      const axis = d.findIndex(x => x !== 0);
      const base = c.slice();
      if (d[axis]! > 0) base[axis] = base[axis]! + 1;
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      faces.push([[0, 0], [1, 0], [1, 1], [0, 1]].map(([du, dv]) => {
        const p = base.slice();
        p[u] = p[u]! + du!;
        p[v] = p[v]! + dv!;
        return p.join(',');
      }));
    }
  }

  const edgeFaces = new Map<string, number[]>();
  faces.forEach((corners, i) => {
    for (let k = 0; k < 4; k++) {
      const a = corners[k]!;
      const b = corners[(k + 1) % 4]!;
      const key = a < b ? `${a}/${b}` : `${b}/${a}`;
      const list = edgeFaces.get(key);
      if (list) list.push(i);
      else edgeFaces.set(key, [i]);
    }
  });

  const parent = faces.map((_unused, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r]!;
    return r;
  };
  for (const list of edgeFaces.values()) {
    for (let k = 1; k < list.length; k++) parent[find(list[0]!)] = find(list[k]!);
  }
  const groups = new Map<number, number[]>();
  faces.forEach((_unused, i) => {
    const root = find(i);
    const list = groups.get(root);
    if (list) list.push(i);
    else groups.set(root, [i]);
  });

  let genus = 0;
  for (const list of groups.values()) {
    const verts = new Set<string>();
    const edges = new Set<string>();
    for (const i of list) {
      for (let k = 0; k < 4; k++) {
        const a = faces[i]![k]!;
        const b = faces[i]![(k + 1) % 4]!;
        verts.add(a);
        edges.add(a < b ? `${a}/${b}` : `${b}/${a}`);
      }
    }
    genus += (2 - (verts.size - edges.size + list.length)) / 2;
  }

  return {
    genus,
    comps: groups.size,
    exposed: faces.length,
    manifold: [...edgeFaces.values()].every(list => list.length === 2),
    pinched: pinchedAtAVertex(at),
  };
}

/**
 * Whether the shape touches itself at a vertex alone.
 *
 * The edge test above passes a shape whose two halves meet at one corner,
 * because no edge of the boundary has four faces on it — the two halves simply
 * do not share an edge at all. Such a thing falls apart in the hand, so it is
 * not a pose. Read off the 2x2x2 block of lattice cells round each corner: a
 * diagonal pair present and their two neighbours absent is a pinch.
 */
function pinchedAtAVertex(at: ReadonlySet<string>): boolean {
  const corners = new Set<string>();
  for (const key of at) {
    const c = key.split(',').map(Number);
    for (const dx of [0, 1]) {
      for (const dy of [0, 1]) {
        for (const dz of [0, 1]) {
          corners.add([c[0]! + dx, c[1]! + dy, c[2]! + dz].join(','));
        }
      }
    }
  }
  for (const corner of corners) {
    const c = corner.split(',').map(Number);
    const block: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      block.push(at.has(
        [c[0]! - 1 + (i & 1), c[1]! - 1 + ((i >> 1) & 1), c[2]! - 1 + ((i >> 2) & 1)].join(','),
      ));
    }
    if (block.filter(Boolean).length !== 2) continue;
    for (let i = 0; i < 8; i++) if (block[i] && block[7 - i]) return true;
  }
  return false;
}

/** The extent of a shape in lattice cells, along each axis. */
function spanOf(placed: readonly Placement[]): number[] {
  return [0, 1, 2].map(axis => {
    const xs = placed.map(p => p.offset[axis]!);
    return Math.round(Math.max(...xs) - Math.min(...xs)) + 1;
  });
}

/**
 * Whether the shape is one a hand can set down and leave standing: a solid
 * block, or a single layer.
 */
function standsUp(placed: readonly Placement[]): boolean {
  const span = spanOf(placed);
  return span[0]! * span[1]! * span[2]! === placed.length || Math.min(...span) === 1;
}

/** The occupancy, layer by layer — what a pattern draws to name a shape. */
function drawLayers(placed: readonly Placement[]): string {
  const cells = placed.map(q => q.offset.map(x => Math.round(x - 0.5)));
  const lo = [0, 1, 2].map(a => Math.min(...cells.map(c => c[a]!)));
  const at = new Set(cells.map(c => c.map((x, a) => x - lo[a]!).join(',')));
  const hi = [0, 1, 2].map(a => Math.max(...cells.map(c => c[a]! - lo[a]!)));
  const layers: string[] = [];
  for (let z = 0; z <= hi[2]!; z++) {
    const rows: string[] = [];
    for (let y = hi[1]!; y >= 0; y--) {
      let row = '';
      for (let x = 0; x <= hi[0]!; x++) row += at.has([x, y, z].join(',')) ? '#' : '.';
      rows.push(row);
    }
    layers.push(rows.join('/'));
  }
  return layers.join('  |  ');
}

/**
 * What to call a shape, from the shape alone.
 *
 * A hand tells these apart by silhouette, so that is what the name says: a
 * frame is the one with a hole through it, a plank lies flat, a block is
 * solid, and a cube is the block that is square. Numbered within its kind, in
 * the order the closures came out, which is the order the buttons stand in.
 */
function labelFor(span: readonly number[], genus: number, pieces: number): string {
  const sorted = [...span].sort((a, b) => a - b);
  if (genus > 0) return 'Frame';
  if (sorted[0] === 1) return 'Plank';
  if (sorted[0]! * sorted[1]! * sorted[2]! === pieces) {
    return sorted[0] === sorted[2] ? 'Cube' : 'Block';
  }
  return 'Shape';
}

// ─── the object's own shape, worked out once ─────────────────────────────

export interface CubeRingShape {
  /** Every way it closes: what the motion is planned over. */
  readonly closures: readonly KineticState[];
  /** The poses of one fold component: what a hand can get to, all of it. */
  readonly poses: readonly CubeRingPose[];
  /** Poses in no component of its own — there is no way to fold into them. */
  readonly strays: readonly CubeRingPose[];
  /** The folds between every closure, with `poseAt` on the states. */
  readonly foldGraph: FoldGraph;
}

const shapes = new Map<string, CubeRingShape>();

const shapeKey = (object: CubeRingObject): string =>
  `${object.ring.map(cell => cell.join(',')).join(' ')}|${object.hinges.join('')}`;

/**
 * Everything about an object that the ruling does not touch.
 *
 * Which shapes it shuts into, which of them a hand can stop at and fold
 * between: none of it depends on how finely the cubes are ruled, and all of it
 * costs a walk over four to the twelfth in the worst case, so it is worked out
 * once per object and kept. A page that offers nine rulings of two objects
 * does this twice, not eighteen times.
 */
export function cubeRingShape(
  object: CubeRingObject,
  options: { maxClosures?: number } = {},
): CubeRingShape {
  const key = shapeKey(object);
  const had = shapes.get(key);
  if (had) return had;

  const { shapes: closures, turns } = ringClosures(object.ring, object.hinges, options);
  if (closures.length === 0) throw new Error('this taping never closes');

  const frames = tapeFrames(object.ring, object.hinges);
  const pieces = object.ring.length;
  const candidates: { closure: number; turns: number[]; genus: number; exposed: number;
    span: number[]; layers: string }[] = [];
  const seen = new Set<string>();
  closures.forEach((placed, closure) => {
    if (!tapeOutside(placed, frames)) return;
    if (!standsUp(placed)) return;
    const skin = skinOf(placed.map(p => p.offset));
    if (!skin.manifold || skin.comps !== 1 || skin.pinched) return;
    // Two closures with the same cubes in the same cells, differing only in
    // which way a cube is turned, are two shapes and not one: the same hand
    // holds them and different squares face outward.
    const shapeText = placed.map(keyOf).join('/');
    if (seen.has(shapeText)) return;
    seen.add(shapeText);
    candidates.push({
      closure,
      turns: turns[closure]!,
      genus: skin.genus,
      exposed: skin.exposed,
      span: spanOf(placed),
      layers: drawLayers(placed),
    });
  });
  if (candidates.length === 0) throw new Error('this taping shuts into nothing a hand can hold');

  // The folds first, then the poses: which of them are states is decided by
  // what the object can be folded into, and that is what the graph says.
  const over = buildFoldGraph({
    pieceCount: pieces,
    states: candidates.map(pose => closures[pose.closure]!),
    closures: () => closures,
    pieceHalfExtents: Array.from({ length: pieces }, () => [0.5, 0.5, 0.5] as Vec3),
  });
  const distances = poseDistances(over);
  const group = candidates.map((_unused, i) => i);
  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      if (distances[i]![j]! >= 0) group[j] = Math.min(group[j]!, group[i]!);
    }
  }
  const parts = new Map<number, number[]>();
  group.forEach((g, i) => {
    const list = parts.get(g);
    if (list) list.push(i);
    else parts.set(g, [i]);
  });
  const reachable = [...parts.values()].sort((a, b) => b.length - a.length)[0]!;
  const inComponent = new Set(reachable);

  const counted = new Map<string, number>();
  const name = (span: readonly number[], genus: number): string => {
    const kind = labelFor(span, genus, pieces);
    const nth = (counted.get(kind) ?? 0) + 1;
    counted.set(kind, nth);
    return `${kind} ${nth}`;
  };
  const poses: CubeRingPose[] = reachable.map(i => ({
    ...candidates[i]!, label: name(candidates[i]!.span, candidates[i]!.genus),
  }));
  const strays: CubeRingPose[] = candidates
    .filter((_unused, i) => !inComponent.has(i))
    .map(pose => ({ ...pose, label: labelFor(pose.span, pose.genus, pieces) }));

  const made: CubeRingShape = {
    closures,
    poses,
    strays,
    foldGraph: { ...over, poseAt: poses.map(pose => pose.closure) },
  };
  shapes.set(key, made);
  return made;
}

// ─── the mechanism ───────────────────────────────────────────────────────

/** The unit cube's faces, ruled n by n, in the order they are numbered. */
function cubeCells(piece: number, cells: number): KineticCell[] {
  const made: KineticCell[] = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [1, -1]) {
      const u = sign > 0 ? (axis + 1) % 3 : (axis + 2) % 3;
      const v = sign > 0 ? (axis + 2) % 3 : (axis + 1) % 3;
      for (let row = 0; row < cells; row++) {
        for (let col = 0; col < cells; col++) {
          const corners: Vec3[] = [];
          for (const [du, dv] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
            const point: number[] = [];
            point[axis] = sign * 0.5;
            point[u] = -0.5 + (col + du) / cells;
            point[v] = -0.5 + (row + dv) / cells;
            corners.push(point as unknown as Vec3);
          }
          made.push({ piece, corners });
        }
      }
    }
  }
  return made;
}

function tapeSeamsOf(
  ring: readonly Lattice[],
  hinges: readonly number[],
): TapeSeam[] {
  return ring.map((from, seam) => {
    const next = (seam + 1) % ring.length;
    const to = ring[next]!;
    const { point, axis } = hingeLine(from, to, hinges[seam]!);
    const along: Vec3 = [0, 0, 0];
    along[axis] = 1;
    const inFrameOf = (cell: Lattice): readonly [Vec3, Vec3] => {
      const centre = centreOf(cell);
      const a: Vec3 = [point[0] - centre[0], point[1] - centre[1], point[2] - centre[2]];
      return [a, [a[0] + along[0], a[1] + along[1], a[2] + along[2]]];
    };
    return {
      seam,
      pieces: [seam, next] as const,
      ends: [inFrameOf(from), inFrameOf(to)] as const,
    };
  });
}

export function createCubeRing(
  object: CubeRingObject,
  options: CubeRingOptions = {},
): CubeRingMechanism {
  const cells = options.cells ?? 1;
  if (cells < 1) throw new Error('a cube needs at least one cell across a face');

  const shape = cubeRingShape(object, options);
  const pieces = object.ring.length;
  const all: KineticCell[] = [];
  for (let piece = 0; piece < pieces; piece++) all.push(...cubeCells(piece, cells));
  const perFace = cells * cells;
  const perPiece = 6 * perFace;

  return {
    id: `cube-ring-${object.id}-${cells}`,
    pieceCount: pieces,
    cells: all,
    states: shape.poses.map(pose => shape.closures[pose.closure]!),
    object,
    cellsPerFace: cells,
    ring: object.ring.map(cell => [...cell] as unknown as Lattice),
    hinges: [...object.hinges],
    poses: shape.poses,
    strays: shape.strays,
    cellIndex: (piece, face, row, col) => piece * perPiece + face * perFace + row * cells + col,
    stateLabel: index => (shape.poses[index]?.turns ?? []).join(''),
    closures: () => shape.closures,
    foldGraph: () => shape.foldGraph,
    tapeSeams: () => tapeSeamsOf(object.ring, object.hinges),
    pieceHalfExtents: Array.from({ length: pieces }, () => [0.5, 0.5, 0.5] as Vec3),
  };
}
