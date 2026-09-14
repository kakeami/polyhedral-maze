import type { Vec3 } from '../../types.ts';
import type { KineticCell, KineticState, Mat3, Mechanism, Placement } from '../types.ts';
import { IDENTITY } from '../types.ts';

export interface InfinityCubeOptions {
  /** Cells across one face of one cube. */
  cells?: number;
  /** Which cell of the 2x2x2 each cube of the ring sits in, when assembled. */
  ring?: readonly Lattice[];
  /**
   * Which edge of each shared face the ring is hinged on, one per pair of
   * neighbouring cubes. See `hingeLine` for the numbering.
   */
  hinges?: readonly number[];
  /** Refuse to build past this many states, rather than grind. */
  maxStates?: number;
}

export interface InfinityCubeMechanism extends Mechanism {
  readonly cellsPerFace: number;
  readonly ring: readonly Lattice[];
  readonly hinges: readonly number[];
  /** Quarter turns at each hinge, per state. */
  stateTurns(index: number): readonly number[];
  /** Index into `cells` for one cell of one cube. */
  cellIndex(piece: number, face: number, row: number, col: number): number;
}

/**
 * Eight cubes hinged into a ring — the fidget toy that folds forever.
 *
 * The ring is the point. A chain of pieces can be turned one joint at a time
 * with everything past the joint going along for the ride, which is what the
 * stack and the glued pair do; a *closed* chain cannot, so the only pose a
 * hinge can take is one that the rest of the ring also agrees to. That makes
 * the states scarce and hard-won rather than a free product of per-piece
 * choices, and it is what buries half the surface: folded shut, two cubes meet
 * face to face and both of those faces stop being part of the object.
 *
 * The eight lattice cells the cubes sit in form a cycle of the 2x2x2, so each
 * cube shares a face with the next, and the hinge is one of the four edges of
 * that shared face.
 */
export type Lattice = readonly [number, number, number];

/**
 * Where the tape goes: round the edge of the plank the cubes are laid out on.
 *
 * This is how the thing is actually built. Eight cubes in a 1x2x4 plank, taped
 * in a loop round its rim — not a loop through the 2x2x2's own face
 * adjacencies, which is a different mechanism and a duller one: hinged that
 * way the cubes never turn, so the same twenty-four squares face outward for
 * ever and folding only shuffles the walls of a fixed maze.
 *
 * The plank is the one Hamiltonian loop a 2x4 grid has.
 */
export const PLANK_RING: readonly Lattice[] = [
  [0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0],
  [3, 1, 0], [2, 1, 0], [1, 1, 0], [0, 1, 0],
];

/**
 * A ring through the 2x2x2 instead, for comparison.
 *
 * Kept because it is the obvious thing to try and the reason it is wrong is
 * worth being able to reproduce: with two of its eight joints cornerwise it
 * does bring new faces up, but it shuts into twelve poses of which none is a
 * plank, and a third of its surface never sees daylight at all.
 */
export const CUBE_RING: readonly Lattice[] = [
  [0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0],
  [1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0],
];

export const DEFAULT_RING = PLANK_RING;

/**
 * Which edge of each seam the tape sits on, numbered as `hingeLine` numbers
 * them. Of the four edges of a seam, three are on the plank's surface and one
 * is buried in it; a buried edge cannot be taped, and no pose that buries a
 * seam is a pose a hand can reach, so both are ruled out in `enumerateStates`.
 *
 * Of the 65536 tapings of the plank, exactly eight shut into two cubes, and
 * every one of those eight shuts into four planks as well — six poses in all —
 * and shows *completely different faces* in its two cubes. `.dev/probe-infinity.ts`
 * lists them; `.dev/probe-tape-map.ts` reads a taping back as "top, bottom or
 * which side", which is the form a pair of hands needs.
 *
 * This is the first of the eight. Seam by seam round the plank, the tape goes
 * on the outer side, the top, the bottom, the long side, the far outer side,
 * the top, the bottom, and the long side — which is `21022102` in the notation
 * the earlier probes used, the taping recommended for the first one built.
 */
export const DEFAULT_HINGES: readonly number[] = [3, 2, 0, 2, 1, 2, 0, 0];

export const CUBE_RING_HINGES: readonly number[] = [0, 2, 2, 0, 1, 0, 1, 0];

const PIECE_COUNT = 8;

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

/**
 * Rotation by whole quarter turns about a coordinate axis.
 *
 * Exact integers rather than cosines: every placement in this mechanism is
 * built by multiplying these together, and a drift of one part in 10^16 per
 * turn is enough to stop two folded cubes from welding to the same corner.
 */
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

const centreOf = (p: Lattice): Vec3 =>
  [p[0] + 0.5, p[1] + 0.5, p[2] + 0.5];

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

/** Half-integers exactly, so a placement can be keyed on its text. */
const keyOf = (p: Placement): string =>
  `${p.rot.map(row => row.join(',')).join(';')}|${p.offset.map(x => x.toFixed(1)).join(',')}`;

const offsetKey = (v: Vec3): string => v.map(x => x.toFixed(1)).join(',');

/**
 * Every way the ring closes back into a 2x2x2.
 *
 * A hinge turns in whole quarter turns — anything else leaves the lattice, and
 * the cubes would not meet — so a configuration is eight quarter-turn counts,
 * and all that is asked of them is that the chain comes back to where it
 * started with the eight cubes in eight different cells of one 2x2x2 box.
 *
 * This is a *superset* of what a hand can fold: nothing here checks that the
 * ring can be moved into the pose without passing through itself. That is the
 * safe direction to err in. A design that survives every pose in the superset
 * survives every pose that can actually be reached, whatever the path.
 *
 * The first cube is pinned, which is what quotients out turning the whole
 * object round in your hands: those are one state, not twenty-four.
 */
export interface ClosureOptions {
  maxStates?: number;
  /**
   * Keep only the poses a hand can stop at: the eight cubes filling a solid
   * block with every hinge still on the surface. Off, what comes back is every
   * way the ring closes at all, open shapes included — which is what a search
   * for a path from one pose to another has to walk through.
   */
  shut?: boolean;
}

export function enumerateClosures(
  ring: readonly Lattice[],
  hinges: readonly number[],
  options: ClosureOptions = {},
): {
  states: KineticState[];
  turns: number[][];
} {
  const maxStates = options.maxStates ?? 4096;
  const shut = options.shut ?? true;
  const relative: Placement[][] = [];
  const hingeMid: Vec3[] = [];
  const hingeAxis: Vec3[] = [];
  for (let i = 0; i < PIECE_COUNT; i++) {
    const from = ring[i]!;
    const to = ring[(i + 1) % PIECE_COUNT]!;
    const line = hingeLine(from, to, hinges[i]!);
    const centre = centreOf(from);
    const unit: Vec3 = [0, 0, 0];
    unit[line.axis] = 1;
    hingeAxis.push(unit);
    hingeMid.push([
      line.point[0] + unit[0] / 2 - centre[0],
      line.point[1] + unit[1] / 2 - centre[1],
      line.point[2] + unit[2] / 2 - centre[2],
    ]);
    const back: Placement = { rot: IDENTITY, offset: centreOf(from).map(x => -x) as Vec3 };
    const forth: Placement = { rot: IDENTITY, offset: centreOf(to) };
    relative.push([0, 1, 2, 3].map(steps =>
      compose(compose(back, rotateAboutLine(line.point, line.axis, steps)), forth),
    ));
  }

  const start: Placement = { rot: IDENTITY, offset: centreOf(ring[0]!) };
  const startKey = keyOf(start);
  const states: KineticState[] = [];
  const turns: number[][] = [];
  const seen = new Set<string>();
  const placed: Placement[] = [start];
  const taken = new Set<string>([offsetKey(start.offset)]);
  const chosen: number[] = [];

  const onLattice = (v: Vec3): boolean =>
    v.every(x => Math.abs(x - Math.round(x - 0.5) - 0.5) < 1e-9 && Math.abs(x) < 8);

  /**
   * Whether the eight cubes fill a solid block with no gap.
   *
   * Any block, not the 2x2x2 alone: eight cubes shut into a 1x2x4 plank are
   * just as closed, just as printable and just as much a maze, and the object
   * passes through that shape every time it folds. Leaving the plank out would
   * be designing for two of the poses a hand can stop at and ignoring four.
   */
  const blockVolume = (): number => {
    const spans = [0, 1, 2].map(axis => new Set(placed.map(p => p.offset[axis]!.toFixed(1))).size);
    return spans[0]! * spans[1]! * spans[2]!;
  };

  const fillsABlock = (): boolean => blockVolume() === PIECE_COUNT;

  /**
   * Whether every hinge is still on the outside.
   *
   * The hinge is a strip of tape across an edge. An edge with all four cubes
   * round it present is inside the block, and tape cannot be there: the pose
   * exists on paper and not in the hand.
   */
  const tapeOnTheOutside = (): boolean => {
    const centres = placed.map(p => p.offset);
    for (let i = 0; i < PIECE_COUNT; i++) {
      const at = placed[i]!;
      const mid = applyMat(at.rot, hingeMid[i]!);
      const world: Vec3 = [mid[0] + at.offset[0], mid[1] + at.offset[1], mid[2] + at.offset[2]];
      const along = applyMat(at.rot, hingeAxis[i]!);
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
  };

  const walk = (index: number): void => {
    if (states.length > maxStates) throw new Error(`over ${maxStates} states`);
    if (index === PIECE_COUNT - 1) {
      for (let steps = 0; steps < 4; steps++) {
        const closing = compose(placed[index]!, relative[index]![steps]!);
        if (keyOf(closing) !== startKey) continue;
        if (shut && (!fillsABlock() || !tapeOnTheOutside())) continue;
        const key = placed.map(keyOf).join('/');
        if (seen.has(key)) continue;
        seen.add(key);
        states.push(placed.map(p => ({ rot: p.rot, offset: p.offset })));
        turns.push([...chosen, steps]);
      }
      return;
    }
    for (let steps = 0; steps < 4; steps++) {
      const next = compose(placed[index]!, relative[index]![steps]!);
      const where = offsetKey(next.offset);
      if (!onLattice(next.offset) || taken.has(where)) continue;
      placed.push(next);
      // Nothing that has already spread wider than a block of eight can be
      // folded back into one, so there is no point following it any further.
      if (shut && blockVolume() > PIECE_COUNT) {
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
  return { states, turns };
}

/** The unit cube's faces, in the order they are numbered. */
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

export function createInfinityCube(options: InfinityCubeOptions = {}): InfinityCubeMechanism {
  const cells = options.cells ?? 1;
  const ring = options.ring ?? DEFAULT_RING;
  const hinges = options.hinges ?? DEFAULT_HINGES;
  const maxStates = options.maxStates ?? 4096;
  if (cells < 1) throw new Error('a cube needs at least one cell across a face');
  if (ring.length !== PIECE_COUNT) throw new Error(`a ring of ${PIECE_COUNT} cubes is needed`);
  if (hinges.length !== PIECE_COUNT) throw new Error(`a ring of ${PIECE_COUNT} needs that many hinges`);

  const all: KineticCell[] = [];
  for (let piece = 0; piece < PIECE_COUNT; piece++) all.push(...cubeCells(piece, cells));
  const perFace = cells * cells;
  const perPiece = 6 * perFace;

  const { states, turns } = enumerateClosures(ring, hinges, { maxStates, shut: true });
  if (states.length === 0) throw new Error('this hinge pattern never closes into a cube');

  return {
    id: `infinity-cube-${cells}-${ring.map(p => p.join('')).join('')}-${hinges.join('')}`,
    pieceCount: PIECE_COUNT,
    cells: all,
    states,
    cellsPerFace: cells,
    ring: ring.map(p => [...p] as unknown as Lattice),
    hinges: [...hinges],
    stateTurns: index => turns[index] ?? [],
    cellIndex: (piece, face, row, col) => piece * perPiece + face * perFace + row * cells + col,
    stateLabel: index => (turns[index] ?? []).join(''),
  };
}
