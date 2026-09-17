/**
 * How one pose becomes another: the folds, and the way through the open shapes.
 *
 * A mechanism hands over the poses a hand can stop at and nothing about the
 * motion between them, which is all the maze needs and not enough to animate.
 * What is needed here is the other half: a fold is one contiguous arc of the
 * ring turned about one line, everything else standing still, and a transition
 * is a sequence of those.
 *
 * Two facts decide the shape of this file:
 *
 * - **Most pairs of poses are not one fold apart.** Four of the fifteen are;
 *   the rest go through shapes that are not poses at all — the ring closed but
 *   splayed open, which a hand passes through without stopping. So the search
 *   is over every closure, not over the six poses, and a transition comes back
 *   as a path of two or three folds.
 * - **A rigid motion is a screw.** Given where an arc starts and where it ends,
 *   the line it turns about and how far are not a choice, they are read off the
 *   motion; all that is chosen is which way round, and that is chosen by which
 *   way misses the rest of the object.
 *
 * DOM-free, like everything in `core/`.
 */

import type { Vec3 } from '../types.ts';
import type { KineticState, Mat3, Placement } from './types.ts';

export interface FoldAxis {
  /** A point on the line the arc turns about. */
  readonly point: Vec3;
  /** Unit direction of that line. */
  readonly direction: Vec3;
}

export interface FoldStep {
  /** The arc that moves; every other piece stands still. */
  readonly pieces: readonly number[];
  readonly axis: FoldAxis;
  /** Signed turn in radians — the way round that misses the object. */
  readonly angle: number;
  readonly from: KineticState;
  readonly to: KineticState;
}

export interface FoldGraph {
  /** Every way the ring closes, poses and open shapes alike. */
  readonly shapes: readonly KineticState[];
  /** Where each of the mechanism's poses sits in `shapes`. */
  readonly poseAt: readonly number[];
  /** Folds out of each shape, and where each one lands. */
  readonly folds: readonly (readonly { to: number; step: FoldStep }[])[];
}

/** What a mechanism has to say for its motion to be worked out. */
export interface FoldableMechanism {
  readonly pieceCount: number;
  readonly states: readonly KineticState[];
  /** Every closure, open shapes included. */
  closures(): readonly KineticState[];
  /**
   * Each piece's own bounding box, as half-extents about its placement origin
   * in its body frame. Only used to tell whether a fold swings a piece through
   * another one, which is why a box is enough: the pieces of a folding ring
   * are cubes, and a box that contains a piece can only ever be pessimistic.
   */
  readonly pieceHalfExtents: readonly Vec3[];
}

/**
 * How far two pieces may overlap before the fold is called impossible.
 *
 * Not zero: the cubes of a ring are in contact all the time — face to face
 * along the plank, edge to edge at a hinge as it turns — and a test that
 * refused contact would refuse every fold there is. A fiftieth of a cube is
 * comfortably more than the arithmetic wobbles and comfortably less than the
 * shallowest real collision, which is a whole cube going through another.
 */
const TOUCH_SLACK = 0.02;

/** How many points along a sweep are checked for a collision. */
const SWEEP_SAMPLES = 24;

const EPS = 1e-9;

/**
 * The fold graph of a mechanism: every closure, and every single fold between.
 *
 * Quadratic in the closures, which for the ring of eight is twenty-four — the
 * cost is nothing, and the alternative (generating folds from the hinges) would
 * have to rediscover exactly the pairs this reads off.
 */
export function buildFoldGraph(mech: FoldableMechanism): FoldGraph {
  const shapes = [...mech.closures()];
  const index = new Map<string, number>();
  shapes.forEach((state, i) => index.set(stateKey(state), i));

  const poseAt = mech.states.map(state => {
    const at = index.get(stateKey(state));
    if (at === undefined) throw new Error('a pose of the mechanism is not among its closures');
    return at;
  });

  const folds: { to: number; step: FoldStep }[][] = shapes.map(() => []);
  for (let a = 0; a < shapes.length; a++) {
    for (let b = a + 1; b < shapes.length; b++) {
      const step = foldBetween(shapes[a]!, shapes[b]!, mech);
      if (!step) continue;
      folds[a]!.push({ to: b, step });
      folds[b]!.push({ to: a, step: reverse(step) });
    }
  }
  return { shapes, poseAt, folds };
}

/**
 * The folds that take one pose to another, or null if none do.
 *
 * Breadth-first, so what comes back is as few folds as the object allows. The
 * object is small enough that this could be worked out once and cached; it is
 * not, because a path is asked for when a visitor presses a button and there
 * are twenty-four shapes.
 */
export function foldPath(
  graph: FoldGraph,
  fromPose: number,
  toPose: number,
): FoldStep[] | null {
  const start = graph.poseAt[fromPose];
  const goal = graph.poseAt[toPose];
  if (start === undefined || goal === undefined) throw new Error('no such pose');
  if (start === goal) return [];

  const cameBy: (FoldStep | null)[] = graph.shapes.map(() => null);
  const cameFrom = new Int32Array(graph.shapes.length).fill(-1);
  const queue = [start];
  cameFrom[start] = start;
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const { to: next, step } of graph.folds[at]!) {
      if (cameFrom[next]! >= 0) continue;
      cameFrom[next] = at;
      cameBy[next] = step;
      if (next === goal) {
        const path: FoldStep[] = [];
        for (let node = goal; node !== start; node = cameFrom[node]!) {
          path.unshift(cameBy[node]!);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * How many folds apart each pose is from each other, for a page that wants to
 * fold the object on its own.
 *
 * Poses, not shapes: what can be stopped at. Something choosing where to fold
 * next wants to prefer somewhere close, because a journey of four folds is a
 * long time to watch — and it wants the far ones to remain possible, because
 * only four of the fifteen pairs are a single fold apart and a wanderer that
 * only ever took those would never leave three of the six poses.
 */
export function poseDistances(graph: FoldGraph): number[][] {
  return graph.poseAt.map(from => {
    const distance = new Int32Array(graph.shapes.length).fill(-1);
    distance[from] = 0;
    const queue = [from];
    for (let head = 0; head < queue.length; head++) {
      const at = queue[head]!;
      for (const { to } of graph.folds[at]!) {
        if (distance[to]! >= 0) continue;
        distance[to] = distance[at]! + 1;
        queue.push(to);
      }
    }
    return graph.poseAt.map(to => distance[to]!);
  });
}

/**
 * Where to fold next, left to itself.
 *
 * **Every shape once a round, and the cheapest way round taken as it goes.**
 * The caller keeps a bag of the shapes not yet shown; this takes one out of
 * it, and fills the bag again when nothing in it can be reached. So each shape
 * gets an equal share of the stops however far away it is.
 *
 * That replaced a weighting by 1/distance^2, and the reason is the twelve-cube
 * ring. On the eight-cube ring every pair of shapes is one to four folds apart
 * and the weighting was fine; on the twelve, the frame is seven to ten folds
 * from three of the other four, so its weight was one part in fifty: it came
 * up in 8% of the stops and 5% of the time on screen, and a visitor could
 * watch for a minute without seeing the shape that object is *for*
 * (`.dev/probe-fold-visits.ts`). With the bag it is a fifth of the stops.
 *
 * Which of the owed shapes to take is not simply the nearest, and the same
 * object says why: plain nearest-first leaves the frame for last every round,
 * and then has to reach it from wherever that lands — a ten-fold hop, when
 * three would have done from the shape it was standing on two stops earlier.
 * So a shape is judged by the fold it costs *and* by how far it is from the
 * nearest shape still owed after it, which is enough to take the frame on the
 * way past rather than at the end. Measured over the round, that is twenty
 * folds a round down to ten.
 *
 * The shape it is standing on stays in the bag, since it cannot be chosen from
 * nowhere; it is simply come back to later in the round. Dropping it instead
 * would skip whichever shape a round happens to start on, which is uneven in
 * exactly the way this is meant to fix.
 */
export function chooseNextPose(options: {
  distances: readonly (readonly number[])[];
  from: number;
  /** The shapes not yet shown this round. Emptied as they are, refilled here. */
  unseen: Set<number>;
  random?: () => number;
}): number | null {
  const { distances, from, unseen } = options;
  const random = options.random ?? Math.random;
  const away = distances[from];
  if (!away) return null;

  const canGo = (pose: number) => pose !== from && (away[pose] ?? -1) > 0;
  if (![...unseen].some(canGo)) {
    unseen.clear();
    for (let pose = 0; pose < away.length; pose++) unseen.add(pose);
  }
  const owed = [...unseen].filter(canGo);

  let best = -1;
  let cheapest = Infinity;
  let tied = 0;
  for (const pose of owed) {
    // What it costs to go there, plus what it will cost to go on from there to
    // the nearest shape still owed: enough lookahead to take a far shape on
    // the way past rather than stranding it until last.
    let onward = Infinity;
    for (const next of owed) {
      if (next !== pose) onward = Math.min(onward, distances[pose]![next] ?? 0);
    }
    const cost = away[pose]! + (Number.isFinite(onward) ? onward : 0);
    if (cost < cheapest) {
      cheapest = cost;
      best = pose;
      tied = 1;
    } else if (cost === cheapest && random() < 1 / ++tied) {
      // Shapes that cost the same are chosen between at random, which is most
      // of the choosing on the eight-cube ring: it has ties everywhere.
      best = pose;
    }
  }
  return best < 0 ? null : (unseen.delete(best), best);
}

/**
 * The object part-way through a fold.
 *
 * `at` runs from 0 at the start of the fold to 1 at the end; the pieces that
 * are not in the arc are handed back exactly as they were, so nothing drifts
 * over a sequence of folds.
 */
export function stateDuringFold(step: FoldStep, at: number): KineticState {
  const turning = rotationAbout(step.axis, step.angle * at);
  const moving = new Set(step.pieces);
  return step.from.map((placement, piece) => (
    moving.has(piece) ? applyMotion(turning, step.axis.point, placement) : placement
  ));
}

/**
 * The single fold that takes one closure to another, if there is one.
 *
 * Three things have to hold, and all three are about the object rather than
 * about this code: the pieces that moved form one unbroken arc of the ring
 * (tape does not let a piece in the middle stay behind); they all moved by the
 * *same* rigid motion (an arc is rigid); and that motion is a turn about a
 * line, not a turn and a slide along it (a hinge is a line, not a screw).
 */
function foldBetween(
  from: KineticState,
  to: KineticState,
  mech: Pick<FoldableMechanism, 'pieceCount' | 'pieceHalfExtents'>,
): FoldStep | null {
  const { pieceCount } = mech;
  const moved: number[] = [];
  for (let piece = 0; piece < pieceCount; piece++) {
    if (placementKey(from[piece]!) !== placementKey(to[piece]!)) moved.push(piece);
  }
  if (moved.length === 0 || moved.length === pieceCount) return null;
  if (!contiguous(moved, pieceCount)) return null;

  const first = motionBetween(from[moved[0]!]!, to[moved[0]!]!);
  for (const piece of moved.slice(1)) {
    if (!sameMotion(first, motionBetween(from[piece]!, to[piece]!))) return null;
  }

  const screw = screwOf(first);
  if (!screw) return null;

  // Either way round lands in the same place; only one of them may have to go
  // through the rest of the object to get there.
  for (const angle of [screw.angle, screw.angle - Math.sign(screw.angle) * 2 * Math.PI]) {
    const step: FoldStep = { pieces: moved, axis: screw.axis, angle, from, to };
    if (sweepIsClear(step, mech)) return step;
  }
  return null;
}

/**
 * Whether the arc can be swung that way round without going through anything.
 *
 * Exported because it is what decides which way a fold goes, and a claim like
 * that should be checkable from outside.
 *
 * Sampled rather than solved. What is being ruled out is a cube passing
 * through a cube — a collision half an object deep and a third of a turn long,
 * not a graze — and two dozen samples cannot step over one of those. The
 * cheaper alternative, checking only the ends, rules out nothing at all: both
 * ends are poses of the object and therefore always clear.
 */
export function sweepIsClear(
  step: FoldStep,
  mech: Pick<FoldableMechanism, 'pieceCount' | 'pieceHalfExtents'>,
): boolean {
  const moving = new Set(step.pieces);
  const still: number[] = [];
  for (let piece = 0; piece < mech.pieceCount; piece++) {
    if (!moving.has(piece)) still.push(piece);
  }

  for (let sample = 1; sample < SWEEP_SAMPLES; sample++) {
    const state = stateDuringFold(step, sample / SWEEP_SAMPLES);
    for (const a of step.pieces) {
      for (const b of still) {
        const overlap = boxesOverlap(
          state[a]!, mech.pieceHalfExtents[a]!,
          state[b]!, mech.pieceHalfExtents[b]!,
        );
        if (overlap) return false;
      }
    }
  }
  return true;
}

/**
 * Whether two boxes share more than a skin of space.
 *
 * The separating-axis test: the fifteen directions that can tell two boxes
 * apart are the six face normals and the nine cross products of their edges.
 * If any of them leaves daylight — or less than a hair of overlap — the boxes
 * are apart.
 */
function boxesOverlap(a: Placement, halfA: Vec3, b: Placement, halfB: Vec3): boolean {
  const axes: Vec3[] = [];
  for (let i = 0; i < 3; i++) axes.push(columnOf(a.rot, i), columnOf(b.rot, i));
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const c = cross(columnOf(a.rot, i), columnOf(b.rot, j));
      if (Math.hypot(c[0], c[1], c[2]) > 1e-6) axes.push(normalise(c));
    }
  }
  const between: Vec3 = [
    b.offset[0] - a.offset[0], b.offset[1] - a.offset[1], b.offset[2] - a.offset[2],
  ];
  for (const axis of axes) {
    const gap = Math.abs(dot(between, axis))
      - reachAlong(a.rot, halfA, axis)
      - reachAlong(b.rot, halfB, axis);
    if (gap > -TOUCH_SLACK) return false;
  }
  return true;
}

/** How far a box reaches along a direction, from its own centre. */
function reachAlong(rot: Mat3, half: Vec3, axis: Vec3): number {
  let reach = 0;
  for (let i = 0; i < 3; i++) reach += half[i]! * Math.abs(dot(columnOf(rot, i), axis));
  return reach;
}

/** The rigid motion that takes one placement to the other: b after a inverted. */
function motionBetween(a: Placement, b: Placement): Placement {
  const rot = multiply(b.rot, transpose(a.rot));
  const moved = apply(rot, a.offset);
  return {
    rot,
    offset: [b.offset[0] - moved[0], b.offset[1] - moved[1], b.offset[2] - moved[2]],
  };
}

/**
 * The line a rigid motion turns about, and by how much.
 *
 * Null where the motion is a slide with no turn, or a screw — a turn *and* a
 * slide along the same line. Neither is a fold: a hinge holds the arc to the
 * line it is taped to.
 */
function screwOf(motion: Placement): { axis: FoldAxis; angle: number } | null {
  const { rot, offset } = motion;
  const trace = rot[0][0] + rot[1][1] + rot[2][2];
  const cosine = Math.min(1, Math.max(-1, (trace - 1) / 2));
  const angle = Math.acos(cosine);
  if (angle < 1e-6) return null; // a slide, or nothing at all

  let direction: Vec3;
  if (Math.PI - angle < 1e-6) {
    // Half a turn: the usual formula divides by sin, which is zero here, so the
    // direction comes from the symmetric part instead — (R + I) / 2 is the
    // outer product of the axis with itself, so its biggest column *is* the
    // axis, up to length.
    let best = 0;
    for (let i = 1; i < 3; i++) if (rot[i]![i]! > rot[best]![best]!) best = i;
    const column: Vec3 = [
      (rot[0]![best]! + (best === 0 ? 1 : 0)) / 2,
      (rot[1]![best]! + (best === 1 ? 1 : 0)) / 2,
      (rot[2]![best]! + (best === 2 ? 1 : 0)) / 2,
    ];
    direction = normalise(column);
  } else {
    direction = normalise([
      rot[2]![1]! - rot[1]![2]!,
      rot[0]![2]! - rot[2]![0]!,
      rot[1]![0]! - rot[0]![1]!,
    ]);
  }

  // A turn about a line through p moves everything by (I - R) p, so the line is
  // whatever p solves that. It is a line, not a point, so the one nearest the
  // origin is picked: that is what the extra `d d^T` term does — it is zero
  // across the line and one along it, which pins down the only direction the
  // equation says nothing about.
  const a = subtractFromIdentity(rot);
  const normal = addOuter(multiply(transpose(a), a), direction);
  const inverse = invert(normal);
  if (!inverse) return null;
  const point = apply(inverse, apply(transpose(a), offset));

  // Anything left over is a slide along the line, and a hinge cannot do that.
  if (Math.abs(dot(offset, direction)) > 1e-6) return null;

  return { axis: { point, direction }, angle };
}

function applyMotion(rot: Mat3, about: Vec3, placement: Placement): Placement {
  const local: Vec3 = [
    placement.offset[0] - about[0],
    placement.offset[1] - about[1],
    placement.offset[2] - about[2],
  ];
  const moved = apply(rot, local);
  return {
    rot: multiply(rot, placement.rot),
    offset: [moved[0] + about[0], moved[1] + about[1], moved[2] + about[2]],
  };
}

function rotationAbout(axis: FoldAxis, angle: number): Mat3 {
  const [x, y, z] = axis.direction;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

/** The same fold, walked the other way. */
function reverse(step: FoldStep): FoldStep {
  return {
    pieces: step.pieces,
    axis: step.axis,
    angle: -step.angle,
    from: step.to,
    to: step.from,
  };
}

/** Whether a set of pieces is one unbroken arc of the ring. */
function contiguous(pieces: readonly number[], pieceCount: number): boolean {
  const set = new Set(pieces);
  let breaks = 0;
  for (let i = 0; i < pieceCount; i++) {
    if (set.has(i) !== set.has((i + 1) % pieceCount)) breaks++;
  }
  return breaks === 2;
}

const placementKey = (p: Placement): string =>
  `${p.rot.map(row => row.join(',')).join(';')}|${p.offset.map(x => x.toFixed(3)).join(',')}`;

const stateKey = (state: KineticState): string => state.map(placementKey).join('/');

const sameMotion = (a: Placement, b: Placement): boolean =>
  placementKey(a) === placementKey(b);

// ─── small matrix arithmetic, kept local ─────────────────────────────────

function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function multiply(a: Mat3, b: Mat3): Mat3 {
  const out: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[i]![k]! * b[k]![j]!;
      out[i]![j] = sum;
    }
  }
  return out as unknown as Mat3;
}

function transpose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

function subtractFromIdentity(m: Mat3): Mat3 {
  return [
    [1 - m[0][0], -m[0][1], -m[0][2]],
    [-m[1][0], 1 - m[1][1], -m[1][2]],
    [-m[2][0], -m[2][1], 1 - m[2][2]],
  ];
}

function addOuter(m: Mat3, v: Vec3): Mat3 {
  const out: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) out[i]![j] = m[i]![j]! + v[i]! * v[j]!;
  }
  return out as unknown as Mat3;
}

function invert(m: Mat3): Mat3 | null {
  const [a, b, c] = [m[0][0], m[0][1], m[0][2]];
  const [d, e, f] = [m[1][0], m[1][1], m[1][2]];
  const [g, h, i] = [m[2][0], m[2][1], m[2][2]];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < EPS) return null;
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
}

const columnOf = (m: Mat3, i: number): Vec3 => [m[0]![i]!, m[1]![i]!, m[2]![i]!];

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
