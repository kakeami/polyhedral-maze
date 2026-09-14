import type { CellKey, Face, Vec3 } from '../../types.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import type { KineticCell, KineticState, Placement, TurnableMechanism } from '../types.ts';
import { IDENTITY, rotZ } from '../types.ts';
import { cellVertices3d } from '../../cell-geometry.ts';
import { sub, scale, dot, cross, norm, normalize, mean } from '../../vec3.ts';
import { getShape } from '../../polyhedra/registry.ts';

/**
 * Two congruent solids glued at a regular polygon face, one free to turn.
 *
 * The glued face goes inside the object and is not printed; what remains is the
 * ring of edges around it, and that ring is carried onto itself by a turn of
 * 2*pi/gon, so the cells still meet edge for edge however the top is turned.
 * Nothing else is required of the two solids, which is why this covers far more
 * objects than cutting a catalogued solid open does: any solid with a regular
 * n-gon face will do, and the result is usually in no catalogue at all.
 *
 * Two triangular cupolas at their hexagon is the first one built. Half its
 * states are the cuboctahedron and half are the triangular orthobicupola
 * (J27), so the object changes its name as it turns.
 */

export interface JoinedPairOptions {
  /** Registry id of the solid, used for both halves. */
  shape?: string;
  /** Sides of the joint polygon. */
  gon?: number;
  /** Which face of that many sides to glue at, when the solid has several. */
  jointIndex?: number;
  /** Cells along one edge of a face. */
  n?: number;
}

/** Where a cell came from, which is what the printed net needs. */
export interface CellSource {
  readonly piece: number;
  readonly faceId: number;
  readonly cell: CellKey;
}

export interface JoinedPairMechanism extends TurnableMechanism {
  readonly shapeId: string;
  readonly shapeName: string;
  readonly gon: number;
  readonly n: number;
  /** The solid both halves are cut from, for the printed net to unfold. */
  readonly polyhedron: Polyhedron;
  /** The face the two halves are glued at, which is not printed. */
  readonly jointFaceId: number;
  /** Length of one edge of the solid, at the scale the cells are given in. */
  readonly edgeLength: number;
  /** Faces of one half that carry maze, the glued one having been dropped. */
  readonly facesPerPiece: number;
  /** Turn, in degrees, that one state step applies to the upper half. */
  readonly step: number;
  cellSource(index: number): CellSource;
  stateLabel(index: number): string;
}

/** A solid the joint is known to suit, with what the pair turns into. */
export interface JoinedPairChoice {
  readonly id: string;
  readonly shape: string;
  readonly gon: number;
  readonly label: string;
  /** What the object is at each turn, for the page to say out loud. */
  readonly becomes: string;
}

/**
 * The joints worth offering, in the order they were judged.
 *
 * Every solid in the catalogue with a regular polygon face could be glued to a
 * copy of itself, but most of them fold the seam into a crease too tight to
 * read a maze out of: the more faces a solid has the closer its dihedral angle
 * runs to a straight angle, and the crease opens through `360 - 2 * dihedral`.
 * These are the ones where that angle stays generous — see `creaseAngle`.
 */
export const JOINED_PAIRS: readonly JoinedPairChoice[] = [
  { id: 'j3@6', shape: 'j3', gon: 6, label: 'Triangular cupolas',
    becomes: 'a cuboctahedron and J27, turn about' },
  { id: 'j4@8', shape: 'j4', gon: 8, label: 'Square cupolas',
    becomes: 'J28 and J29, turn about' },
  { id: 'j5@10', shape: 'j5', gon: 10, label: 'Pentagonal cupolas',
    becomes: 'J30 and J31, turn about' },
  { id: 'j6@10', shape: 'j6', gon: 10, label: 'Pentagonal rotundas',
    becomes: 'an icosidodecahedron and J42, turn about' },
  { id: 'tetrahedron@3', shape: 'tetrahedron', gon: 3, label: 'Tetrahedra',
    becomes: 'a triangular bipyramid, whatever the turn' },
  { id: 'j1@4', shape: 'j1', gon: 4, label: 'Square pyramids',
    becomes: 'an octahedron, whatever the turn' },
  { id: 'j2@5', shape: 'j2', gon: 5, label: 'Pentagonal pyramids',
    becomes: 'a pentagonal bipyramid, whatever the turn' },
  { id: 'octahedron@3', shape: 'octahedron', gon: 3, label: 'Octahedra',
    becomes: 'the same pair of octahedra, whatever the turn' },
];

export const DEFAULT_JOINED_PAIR = JOINED_PAIRS[0]!;

export function joinedPairById(id: string): JoinedPairChoice | undefined {
  return JOINED_PAIRS.find(p => p.id === id);
}

/** Vertices of a face, in order, with the centroid and circumradius. */
function regularFaces(faces: readonly Face[], gon: number): Face[] {
  return faces.filter(f => f.vertices.length === gon && isRegular(f));
}

function isRegular(face: Face): boolean {
  const v = face.vertices;
  const k = v.length;
  if (k < 3) return false;
  const c = mean(v as Vec3[]);
  const radii = v.map(p => norm(sub(p, c)));
  const edges = v.map((p, i) => norm(sub(v[(i + 1) % k]!, p)));
  const even = (xs: number[]): boolean => {
    const hi = Math.max(...xs);
    return hi - Math.min(...xs) < 1e-6 * hi;
  };
  return even(radii) && even(edges);
}

/**
 * How far the seam opens, in degrees, once the second copy is put on.
 *
 * A face next to the joint leaves the joint plane at `180 - dihedral`, and the
 * other half is its mirror image, so the seam opens through `360 - 2 *
 * dihedral`. Over 180 the seam is a ridge with nothing to reach into, at 180
 * it is flat, and under 180 it is a groove that narrows as the angle falls.
 * The worst edge of the joint is the one reported: that is the one a hand has
 * to get into.
 */
export function creaseAngle(options: JoinedPairOptions = {}): number {
  const { faces, joint } = resolve(options);
  let worst = Infinity;
  for (const other of faces) {
    if (other === joint || !sharesEdge(other, joint)) continue;
    const cosine = Math.max(-1, Math.min(1, dot(joint.normal, other.normal)));
    const dihedral = 180 - (Math.acos(cosine) * 180) / Math.PI;
    worst = Math.min(worst, 360 - 2 * dihedral);
  }
  if (!Number.isFinite(worst)) throw new Error('the joint face has no neighbours');
  return worst;
}

function sharesEdge(a: Face, b: Face): boolean {
  let shared = 0;
  for (const p of a.vertices) {
    for (const q of b.vertices) {
      if (norm(sub(p, q)) < 1e-7) { shared++; break; }
    }
  }
  return shared >= 2;
}

function resolve(options: JoinedPairOptions) {
  const shapeId = options.shape ?? DEFAULT_JOINED_PAIR.shape;
  const gon = options.gon ?? DEFAULT_JOINED_PAIR.gon;
  const jointIndex = options.jointIndex ?? 0;
  const descriptor = getShape(shapeId);
  if (!descriptor) throw new Error(`no such shape: ${shapeId}`);
  const polyhedron = descriptor.factory();
  const faces = polyhedron.faces();
  const candidates = regularFaces(faces, gon);
  if (candidates.length === 0) {
    throw new Error(`${shapeId} has no regular ${gon}-gon face to glue at`);
  }
  const joint = candidates[jointIndex];
  if (!joint) {
    throw new Error(`${shapeId} has ${candidates.length} regular ${gon}-gon faces, not ${jointIndex + 1}`);
  }
  return { shapeId, name: descriptor.name, gon, polyhedron, faces, joint };
}

export function createJoinedPair(options: JoinedPairOptions = {}): JoinedPairMechanism {
  const n = options.n ?? 3;
  if (!Number.isInteger(n) || n < 1) throw new Error('n must be a positive whole number');
  const { shapeId, name, gon, polyhedron, faces, joint } = resolve(options);

  // Put the joint in the z = 0 plane, centred, with its circumradius at 1. The
  // body then sits below, because a face normal points out of the solid.
  const centre = mean(joint.vertices as Vec3[]);
  const radius = norm(sub(joint.vertices[0]!, centre));
  const w = normalize(joint.normal);
  const first = sub(joint.vertices[0]!, centre);
  const e1 = normalize(sub(first, scale(w, dot(first, w))));
  const e2 = cross(w, e1);
  const toJointFrame = (p: Vec3): Vec3 => {
    const q = scale(sub(p, centre), 1 / radius);
    return [dot(q, e1), dot(q, e2), dot(q, w)];
  };
  // The upper half is the lower one turned half a revolution about x: a proper
  // rotation, so both halves are the same piece of paper rather than mirror
  // images of each other.
  const flip = (p: Vec3): Vec3 => [p[0], -p[1], -p[2]];

  const lower: Vec3[][] = [];
  const sources: CellSource[] = [];
  const carriers = faces.filter(f => f !== joint);
  for (const face of carriers) {
    const grid = polyhedron.gridForFace(face, n);
    for (const cell of grid.cells()) {
      lower.push(cellVertices3d(face, cell, n, grid.kind).map(toJointFrame));
      sources.push({ piece: 0, faceId: face.id, cell });
    }
  }

  // One overall scale, so every joint and every solid arrives on screen at the
  // size the rest of the app uses.
  let reach = 0;
  for (const poly of lower) for (const p of poly) reach = Math.max(reach, norm(p));
  const fit = 1 / reach;

  const cells: KineticCell[] = [];
  for (const poly of lower) cells.push({ piece: 0, corners: poly.map(p => scale(p, fit)) });
  for (const poly of lower) cells.push({ piece: 1, corners: poly.map(p => scale(flip(p), fit)) });
  const perPiece = sources.length;
  for (let i = 0; i < perPiece; i++) sources.push({ ...sources[i]!, piece: 1 });

  const states: KineticState[] = [];
  for (let k = 0; k < gon; k++) {
    const turned: Placement = { rot: rotZ((k * 2 * Math.PI) / gon), offset: [0, 0, 0] };
    states.push([{ rot: IDENTITY, offset: [0, 0, 0] }, turned]);
  }

  const step = 360 / gon;
  return {
    id: `pair-${shapeId}-${gon}`,
    shapeId,
    shapeName: name,
    gon,
    n,
    facesPerPiece: carriers.length,
    polyhedron,
    jointFaceId: joint.id,
    edgeLength: norm(sub(joint.vertices[1]!, joint.vertices[0]!)) * fit / radius,
    step,
    turnSteps: gon,
    pieceCount: 2,
    cells,
    states,
    cellSource: (index: number) => {
      const source = sources[index];
      if (!source) throw new Error(`no such cell: ${index}`);
      return source;
    },
    stateIndex: (offsets: readonly number[]) => {
      // The lower half is not part of the state: turning the whole object by
      // hand is not a move, so whatever step it is given here is ignored.
      const turn = Math.round(offsets[1] ?? 0);
      return ((turn % gon) + gon) % gon;
    },
    stateLabel: (index: number) => {
      if (index < 0 || index >= gon) throw new Error(`no such state: ${index}`);
      return `${Math.round(index * step)}°`;
    },
  };
}

/** Cells the pair will have, without building it. Used to bound the sliders. */
export function joinedPairCellCount(options: JoinedPairOptions = {}): number {
  const n = options.n ?? 3;
  const { polyhedron, faces, joint } = resolve(options);
  let total = 0;
  for (const face of faces) {
    if (face === joint) continue;
    total += polyhedron.gridForFace(face, n).cells().length;
  }
  return total * 2;
}
