/**
 * A ring of cubes with every cube cut in half: the shape itself changes.
 *
 * Cut a cube from its centre into six square pyramids, one on each face, and
 * keep the three round one corner. That is a *half cube*: three squares where
 * the cube was, six triangles where it was cut. Tape eight of them on the
 * infinity cube's hinges and the ring folds exactly as the infinity cube does
 * — the same closures, the same folds, the same tape — because every hinge
 * lies on an edge both halves of a cube keep, and a half cube can only swing
 * through less than a whole one did. So everything about the motion is the
 * ring of whole cubes' (`cubeRingShape`), and this file says only what the
 * pieces are.
 *
 * What it does with that motion is new. Keep, in each cube, the corner that
 * sits at the middle of the first 2x2x2 the ring shuts into, and that 2x2x2
 * becomes a twelve-pointed star (the stellated rhombic dodecahedron): the
 * squares pressed together inside, the 48 triangles on show. The infinity cube
 * turns every face inside out on the way to its second 2x2x2, so there every
 * kept corner is an *outer* corner and the halves make a cube again, with a
 * star-shaped hollow in it — 24 squares on show, the 48 triangles lining a
 * cavity nobody can see. This is one half of Naoki Yoshimoto's cube (1971):
 * nest a star in a hollow cube and the two make a solid one.
 *
 * Two things here the rings of whole cubes never asked of the surface, both in
 * `surface.ts`: halves that meet along an edge and nothing more, so that four
 * faces come to one line and are paired round it, and the hollow, which is a
 * surface of its own and is hidden as shut inside.
 *
 * And one thing it cannot do that the ring of whole cubes does. Folded
 * halfway between a plank and a 2x2x2 — one end turned over onto the plank —
 * the infinity cube is a hook, a solid a hand stops at, and its maze holds up
 * there. This one's cannot: with its four hooks counted as well there is no
 * maze perfect in all ten, and it is a theorem rather than a failed search
 * (`countsAreConsistent` in `maze-contracted.ts`, 2026-10-15). Every shape
 * needs one more block on show than it has open seam passages, which is one
 * equation per shape; two of the hooks show, between them, exactly the faces
 * the cube, the star and one plank show between them, and carry the same
 * passages at every seam, so two trees would have to come up as short of
 * edges as three. (The search had said as much — none in seven seeds at two,
 * three and four cells across, none in eight times the search, one hook alone
 * fine and two already too many — but could not say why.) So the shapes here
 * are the six that are blocks or layers (`boxOrLayer`), and the object says,
 * on the page and on the pattern, that halfway it is not a perfect maze.
 *
 * DOM-free, like everything in `core/`.
 */

import type { Face, Vec3 } from '../../types.ts';
import type { CellSource, KineticCell, KineticState, Mechanism } from '../types.ts';
import { applyPlacement } from '../types.ts';
import { cellVertices3d } from '../../cell-geometry.ts';
import { cross, dot, mean, normalize, norm, sub } from '../../vec3.ts';
import { gridForPolygonFace } from '../../polyhedra/grids/dispatch.ts';
import { Solid } from '../../polyhedra/_solid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import type { FoldGraph } from '../fold-path.ts';
import { boxOrLayer, createCubeRing, cubeRingShape } from './cube-ring.ts';
import type { CubeRingObject, TapeSeam } from './cube-ring.ts';
import { INFINITY_CUBE } from './cube-ring-objects.ts';

/** An object: a ring of cubes, every cube of it halved. */
export interface HalfCubeRingObject {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
  /** The ring of whole cubes this one halves: its layout, its tape, its shapes. */
  readonly halves: CubeRingObject;
  /** The finest ruling worth offering. */
  readonly maxCells: number;
}

/** A shape a hand can stop at. */
export interface HalfCubeRingPose {
  /** Where it sits in `closures()`. */
  readonly closure: number;
  readonly turns: readonly number[];
  /** Star, Cube, or the whole ring's name for it (Plank 1, ...). */
  readonly label: string;
  readonly span: readonly number[];
}

export interface HalfCubeRingMechanism extends Mechanism {
  readonly object: HalfCubeRingObject;
  /** Cells across one edge of one face. */
  readonly cellsPerFace: number;
  /** The corner of its cube each piece keeps, in the cube's own frame. */
  readonly kept: readonly Vec3[];
  readonly poses: readonly HalfCubeRingPose[];
  readonly sources: readonly CellSource[];
  cellIndex(piece: number, faceId: number, cell: string): number;
  /** One piece as a solid of its own, which is what a pattern unfolds. */
  pieceSolid(piece: number): Polyhedron;
  closures(): readonly KineticState[];
  foldGraph(): FoldGraph;
  tapeSeams(): readonly TapeSeam[];
  /** Each piece's cube: what the folds were worked out with. */
  readonly pieceHalfExtents: readonly Vec3[];
}

/**
 * Eight half cubes on the infinity cube's tape.
 *
 * The one ring of whole cubes whose two 2x2x2s show no face in common, which
 * is what it takes for one of them to become the star and the other the cube.
 */
export const STAR_CUBE: HalfCubeRingObject = {
  id: 'star-cube',
  label: 'Star cube',
  blurb: 'Eight cubes, each cut in half, that fold from a cube into a twelve-pointed star by way of four '
    + 'planks; the two show none of the same cells. Folded only halfway, one end turned over, it is '
    + 'not a perfect maze.',
  halves: INFINITY_CUBE,
  // Eight cells along an edge is 7.2 mm on the 58 mm a square prints at, and
  // a triangle's cells 5.1 mm from base to tip; nine would put those at 4.6,
  // under the 5 mm a knife can be asked to follow.
  maxCells: 8,
};

export const HALF_CUBE_RING_OBJECTS: readonly HalfCubeRingObject[] = [STAR_CUBE];

/** Cells across a face: what an object can be ruled into, coarsest to finest. */
export function halfCubeRingRulings(object: HalfCubeRingObject): number[] {
  const rulings: number[] = [];
  for (let cells = 2; cells <= object.maxCells; cells++) rulings.push(cells);
  return rulings;
}

// ─── the piece ───────────────────────────────────────────────────────────

const keyOf = (v: Vec3): string => v.map(x => (Math.abs(x) < 1e-9 ? 0 : x).toFixed(6)).join(',');

/**
 * The faces of the half of a unit cube (centred at the origin) round corner
 * `kept`: the three squares there, then the six triangles from the centre to
 * the six edges that touch neither that corner nor the one opposite.
 *
 * Every face is wound counter-clockwise seen from outside, which the surface
 * reads the inside and the outside from; a triangle keeps the centre first.
 */
export function halfCubeFaces(kept: Vec3): Face[] {
  const faces: Face[] = [];
  const triangles: Face[] = [];
  const centre: Vec3 = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const square = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([du, dv]) => {
      const p = [0, 0, 0];
      p[axis] = kept[axis]!;
      p[u] = du! - 0.5;
      p[v] = dv! - 0.5;
      return p as unknown as Vec3;
    });
    const out: Vec3 = [0, 0, 0];
    out[axis] = Math.sign(kept[axis]!);
    faces.push({ id: axis, vertices: wound(square, out), normal: out });

    // The square's pyramid is the one this face's triangles bound: its inside
    // is halfway from the centre to the square's middle.
    const middle = mean(square);
    const pyramid: Vec3 = [middle[0] / 2, middle[1] / 2, middle[2] / 2];
    for (let k = 0; k < 4; k++) {
      const a = square[k]!;
      const b = square[(k + 1) % 4]!;
      if (keyOf(a) === keyOf(kept) || keyOf(b) === keyOf(kept)) continue;
      const n = normalize(cross(a, b));
      const towards = mean([centre, a, b]);
      const facing = dot(n, sub(towards, pyramid)) > 0;
      const normal: Vec3 = facing ? n : [-n[0], -n[1], -n[2]];
      triangles.push({ id: -1, vertices: wound([centre, a, b], normal), normal });
    }
  }
  triangles.forEach((face, index) => faces.push({ ...face, id: 3 + index }));
  return faces;
}

/** The loop, turned if need be so it runs counter-clockwise about `out`. */
function wound(loop: Vec3[], out: Vec3): Vec3[] {
  const [a, b, c] = [loop[0]!, loop[1]!, loop[2]!];
  const n = cross(sub(b, a), sub(c, b));
  if (dot(n, out) > 0) return loop;
  // Reversed, but keeping the first point first.
  return [loop[0]!, ...loop.slice(1).reverse()];
}

class HalfCubeSolid extends Solid {
  protected readonly _faces: Face[];

  constructor(faces: Face[]) {
    super();
    this._faces = faces;
  }
}

const solids = new Map<string, Polyhedron>();

/** The half cube round that corner, as a solid: one per corner, kept. */
export function halfCubeSolid(kept: Vec3): Polyhedron {
  const key = keyOf(kept);
  const had = solids.get(key);
  if (had) return had;
  const made = new HalfCubeSolid(halfCubeFaces(kept));
  solids.set(key, made);
  return made;
}

// ─── the shapes ──────────────────────────────────────────────────────────

/**
 * Which corner each cube keeps: the one at the middle of the first 2x2x2.
 *
 * Read off the ring's own poses rather than chosen, so that "the star" is a
 * shape the object really has. A ring of whole cubes that never shuts into a
 * 2x2x2 has no such corner, and is refused.
 */
function keptCorners(object: HalfCubeRingObject): Vec3[] {
  const shape = cubeRingShape(object.halves);
  const block = shape.poses.find(pose => pose.span.every(extent => extent === 2));
  if (!block) throw new Error(`${object.halves.id} never shuts into a 2x2x2`);
  const placed = shape.closures[block.closure]!;
  const middle = mean(placed.map(p => [...p.offset] as Vec3));
  return placed.map(at => {
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
      if (keyOf(applyPlacement(at, [x, y, z])) === keyOf(middle)) return [x, y, z] as Vec3;
    }
    throw new Error('a cube of the 2x2x2 has no corner at its middle');
  });
}

/**
 * The poses, named for what a hand holds: the star, the cube, and the planks.
 *
 * The whole ring's blocks and layers only — not its hooks, for the reason the
 * top of this file gives.
 *
 * A 2x2x2 whose kept corners all sit at its middle is the star; one whose kept
 * corners are all its outer corners is a cube from outside. Listed cube first
 * and star second, then the rest in the order the ring found them, so that the
 * page opens on a cube and the first thing it does is become a star.
 */
function namedPoses(object: HalfCubeRingObject, kept: readonly Vec3[]): HalfCubeRingPose[] {
  const shape = cubeRingShape(object.halves);
  const pieces = object.halves.ring.length;
  const named = shape.poses.filter(pose => boxOrLayer(pose.span, pieces)).map(pose => {
    const placed = shape.closures[pose.closure]!;
    let label = pose.label;
    if (pose.span.every(extent => extent === 2)) {
      const middle = mean(placed.map(p => [...p.offset] as Vec3));
      const reach = placed.map((at, piece) => {
        return norm(sub(applyPlacement(at, kept[piece]!), middle));
      });
      if (reach.every(r => r < 1e-9)) label = 'Star';
      else if (reach.every(r => Math.abs(r - Math.sqrt(3)) < 1e-9)) label = 'Cube';
    }
    return { closure: pose.closure, turns: pose.turns, label, span: pose.span };
  });
  const rank = (label: string) => (label === 'Cube' ? 0 : label === 'Star' ? 1 : 2);
  return named
    .map((pose, order) => ({ pose, order }))
    .sort((a, b) => rank(a.pose.label) - rank(b.pose.label) || a.order - b.order)
    .map(({ pose }) => pose);
}

// ─── the mechanism ───────────────────────────────────────────────────────

export function createHalfCubeRing(
  object: HalfCubeRingObject,
  options: { cells?: number } = {},
): HalfCubeRingMechanism {
  const cells = options.cells ?? 2;
  if (cells < 1) throw new Error('a face needs at least one cell across it');

  const shape = cubeRingShape(object.halves);
  const kept = keptCorners(object);
  const poses = namedPoses(object, kept);
  const pieces = object.halves.ring.length;

  const all: KineticCell[] = [];
  const sources: CellSource[] = [];
  const index = new Map<string, number>();
  for (let piece = 0; piece < pieces; piece++) {
    for (const face of halfCubeFaces(kept[piece]!)) {
      const grid = gridForPolygonFace(face, cells);
      for (const cell of grid.cells()) {
        index.set(`${piece}/${face.id}/${cell}`, all.length);
        all.push({ piece, corners: cellVertices3d(face, cell, cells, grid.kind) });
        sources.push({ piece, faceId: face.id, cell });
      }
    }
  }

  // The whole ring's graph, with its poses in this ring's order.
  const graph: FoldGraph = { ...shape.foldGraph, poseAt: poses.map(pose => pose.closure) };
  const whole = createCubeRing(object.halves, { cells: 1 });

  return {
    id: `half-cube-ring-${object.id}-${cells}`,
    pieceCount: pieces,
    cells: all,
    states: poses.map(pose => shape.closures[pose.closure]!),
    object,
    cellsPerFace: cells,
    kept,
    poses,
    sources,
    cellIndex: (piece, faceId, cell) => {
      const at = index.get(`${piece}/${faceId}/${cell}`);
      if (at === undefined) throw new Error(`no cell ${cell} on face ${faceId} of piece ${piece}`);
      return at;
    },
    pieceSolid: piece => halfCubeSolid(kept[piece]!),
    stateLabel: at => poses[at]?.label ?? `state ${at}`,
    closures: () => shape.closures,
    foldGraph: () => graph,
    tapeSeams: () => whole.tapeSeams(),
    pieceHalfExtents: whole.pieceHalfExtents,
  };
}
