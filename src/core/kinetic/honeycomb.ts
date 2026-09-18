/**
 * The honeycombs a ring of hinged pieces can be folded on.
 *
 * `mechanisms/cube-ring.ts` hard-codes one of these — the cubic lattice, with
 * quarter turns about coordinate axes and half-integer cell centres — because
 * it only ever had to hold cubes. What a ring actually needs of its lattice is
 * four things, and none of them is cubic:
 *
 * - a **piece**, as the polyhedron's vertices and faces;
 * - the **cells**: every placement of that piece which lands on the packing,
 *   which for a face-to-face honeycomb is exactly `rotation x translation`;
 * - the **joints**: for each edge of the piece, the turns about that edge
 *   which carry the honeycomb onto itself. This is *not* the number of cells
 *   round the edge, and the difference is the whole reason this file exists —
 *   four prisms meet along a horizontal edge and only the half turn keeps a
 *   prism upright, so that joint has two positions and not four;
 * - which cells **surround an edge**, because tape cannot be inside the
 *   object and an edge with every one of its cells present is.
 *
 * Everything here is exact integer arithmetic in each honeycomb's own lattice
 * basis, for the reason the cube code gives: a placement is built by
 * multiplying turns together, and a drift of one part in 10^16 per turn is
 * enough to stop two folded pieces from welding to the same corner. A sixth of
 * a turn is an integer matrix in the hexagonal basis and a third of a turn
 * about a body diagonal is a permutation of the coordinates, so nothing in
 * this file needs a float. The conversion to cartesian happens once, at the
 * end, in `cartesianOf`.
 *
 * Measured joint orders, which is the table this file replaces guesswork with
 * (`.dev/2026-09-18-other-polyhedra-fold.md` §1):
 *
 *     cubic             cube                 12 edges   4 cells   turn 4  (90 deg)
 *     triangular prism  2 triangles, 3 sq     9 edges   4/6/4     turn 2/6/2
 *     hexagonal prism   2 hexagons, 6 sq     18 edges   4/3/4     turn 2/3/2
 *     rhombic dodeca    12 rhombi            24 edges   3         turn 3
 *     truncated octa    8 hexagons, 6 sq     36 edges   3         turn 1  <- cannot fold
 *
 * The last line is why the choice of solid is not a matter of taste: no turn
 * about any edge of a truncated octahedron carries the packing onto itself, so
 * that solid has no hinge at all.
 *
 * DOM-free, like everything in `core/`.
 */

import type { Face, Vec3 } from '../types.ts';
import type { Polyhedron } from '../polyhedron.ts';
import { Solid } from '../polyhedra/_solid.ts';

/** A point of a lattice, in that lattice's own basis. */
export type Int3 = readonly [number, number, number];

/** A rotation of a honeycomb, in lattice coordinates. Integer, det 1. */
export type IMat3 = readonly [Int3, Int3, Int3];

/** A placement of the canonical piece: lattice point `rot * x + off`. */
export interface LatticePlacement {
  readonly rot: IMat3;
  readonly off: Int3;
}

export type HoneycombId = 'cube' | 'triprism' | 'hexprism';

export const IDENT3: IMat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** A half turn: minus the identity, in any basis at all. */
export const MINUS_I: IMat3 = [[-1, 0, 0], [0, -1, 0], [0, 0, -1]];

// ─── integer linear algebra ──────────────────────────────────────────────

export function matVec(m: IMat3, v: Int3): Int3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function matMul(a: IMat3, b: IMat3): IMat3 {
  const out: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += a[i]![k]! * b[k]![j]!;
      out[i]![j] = sum;
    }
  }
  return out as unknown as IMat3;
}

/**
 * The inverse of a lattice rotation.
 *
 * The adjugate rather than the transpose: these bases are not orthonormal (the
 * hexagonal one is not), so a rotation's matrix need not be orthogonal even
 * though the motion it stands for is.
 */
export function matInvert(m: IMat3): IMat3 {
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  if (det !== 1 && det !== -1) throw new Error(`lattice rotation with determinant ${det}`);
  const out: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const rows = [0, 1, 2].filter(x => x !== j);
      const cols = [0, 1, 2].filter(x => x !== i);
      const minor =
        m[rows[0]!]![cols[0]!]! * m[rows[1]!]![cols[1]!]! -
        m[rows[0]!]![cols[1]!]! * m[rows[1]!]![cols[0]!]!;
      out[i]![j] = ((i + j) % 2 === 0 ? 1 : -1) * minor * det;
    }
  }
  return out as unknown as IMat3;
}

const addI = (a: Int3, b: Int3): Int3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subI = (a: Int3, b: Int3): Int3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const sameI = (a: Int3, b: Int3): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
export const pointKey = (v: Int3): string => `${v[0]},${v[1]},${v[2]}`;

/** The placement that applies `b` and then `a`. */
export function composeLattice(a: LatticePlacement, b: LatticePlacement): LatticePlacement {
  return { rot: matMul(a.rot, b.rot), off: addI(matVec(a.rot, b.off), a.off) };
}

export function invertLattice(p: LatticePlacement): LatticePlacement {
  const rot = matInvert(p.rot);
  const moved = matVec(rot, p.off);
  return { rot, off: [-moved[0], -moved[1], -moved[2]] };
}

export const IDLE: LatticePlacement = { rot: IDENT3, off: [0, 0, 0] };

export function placementKey(p: LatticePlacement): string {
  return `${p.rot.map(pointKey).join(';')}|${pointKey(p.off)}`;
}

// ─── the honeycombs ──────────────────────────────────────────────────────

interface HoneycombSpec {
  readonly id: HoneycombId;
  readonly label: string;
  /** What one piece is called, on its own. */
  readonly pieceName: string;
  /** The canonical piece's vertices, in lattice coordinates. */
  readonly verts: readonly Int3[];
  /** Each face as a plane `n . x = c`, with n a covector in lattice coordinates. */
  readonly planes: readonly { readonly n: Int3; readonly c: number }[];
  /** The rotations of the honeycomb, in lattice coordinates. */
  readonly group: readonly IMat3[];
  /** Generators of the translation lattice. */
  readonly gens: readonly [Int3, Int3, Int3];
  /** Lattice to cartesian: where each basis vector goes. */
  readonly basis: readonly [Vec3, Vec3, Vec3];
}

/** The 24 rotations of the cube, as integer matrices. */
function cubicRotations(): IMat3[] {
  const quarter: IMat3[] = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  ];
  const out: IMat3[] = [IDENT3];
  const seen = new Set([keyOfMat(IDENT3)]);
  const todo: IMat3[] = [IDENT3];
  while (todo.length) {
    const m = todo.pop()!;
    for (const q of quarter) {
      const next = matMul(q, m);
      const key = keyOfMat(next);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(next);
      todo.push(next);
    }
  }
  return out;
}

/**
 * The 12 rotations of a prismatic honeycomb: sixths of a turn about the
 * stacking axis, and a half turn about a horizontal lattice direction.
 *
 * A sixth of a turn is integral in the hexagonal basis (`a1 -> a2`,
 * `a2 -> a2 - a1`), which is what keeps this file free of floats even though a
 * sixth of a turn is not a rational rotation in cartesian coordinates.
 */
function prismaticRotations(): IMat3[] {
  const sixth: IMat3 = [[0, -1, 0], [1, 1, 0], [0, 0, 1]];
  const flip: IMat3 = [[1, 1, 0], [0, -1, 0], [0, 0, -1]];
  const out: IMat3[] = [];
  let m: IMat3 = IDENT3;
  for (let k = 0; k < 6; k++) {
    out.push(m, matMul(m, flip));
    m = matMul(sixth, m);
  }
  return out;
}

const keyOfMat = (m: IMat3): string => m.map(pointKey).join(';');

const CUBIC: HoneycombSpec = {
  id: 'cube',
  label: 'cubic honeycomb',
  pieceName: 'cube',
  verts: [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ],
  planes: [
    { n: [0, 0, 1], c: 0 }, { n: [0, 0, 1], c: 1 },
    { n: [0, 1, 0], c: 0 }, { n: [1, 0, 0], c: 1 },
    { n: [0, 1, 0], c: 1 }, { n: [1, 0, 0], c: 0 },
  ],
  group: cubicRotations(),
  gens: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
};

/** A uniform triangular prism: equilateral triangles, square sides. */
const TRIANGULAR_PRISMATIC: HoneycombSpec = {
  id: 'triprism',
  label: 'triangular prismatic honeycomb',
  pieceName: 'triangular prism',
  verts: [
    [0, 0, 0], [1, 0, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1],
  ],
  planes: [
    { n: [0, 0, 1], c: 0 }, { n: [0, 0, 1], c: 1 },
    { n: [0, 1, 0], c: 0 }, { n: [1, 1, 0], c: 1 }, { n: [1, 0, 0], c: 0 },
  ],
  group: prismaticRotations(),
  gens: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  basis: [[1, 0, 0], [0.5, Math.sqrt(3) / 2, 0], [0, 0, 1]],
};

/** A uniform hexagonal prism: hexagons of side 1, square sides. */
const HEXAGONAL_PRISMATIC: HoneycombSpec = {
  id: 'hexprism',
  label: 'hexagonal prismatic honeycomb',
  pieceName: 'hexagonal prism',
  verts: [
    [1, 0, 0], [0, 1, 0], [-1, 1, 0], [-1, 0, 0], [0, -1, 0], [1, -1, 0],
    [1, 0, 1], [0, 1, 1], [-1, 1, 1], [-1, 0, 1], [0, -1, 1], [1, -1, 1],
  ],
  planes: [
    { n: [0, 0, 1], c: 0 }, { n: [0, 0, 1], c: 1 },
    // the six sides, in order round the hexagon, so that the neighbours across
    // them come out in order too
    { n: [1, 1, 0], c: 1 }, { n: [0, 1, 0], c: 1 }, { n: [-1, 0, 0], c: 1 },
    { n: [-1, -1, 0], c: 1 }, { n: [0, -1, 0], c: 1 }, { n: [1, 0, 0], c: 1 },
  ],
  group: prismaticRotations(),
  // hexagon centres are the index-3 sublattice of the triangular lattice
  gens: [[1, 1, 0], [-1, 2, 0], [0, 0, 1]],
  basis: [[1, 0, 0], [0.5, Math.sqrt(3) / 2, 0], [0, 0, 1]],
};

const SPECS: Record<HoneycombId, HoneycombSpec> = {
  cube: CUBIC,
  triprism: TRIANGULAR_PRISMATIC,
  hexprism: HEXAGONAL_PRISMATIC,
};

// ─── the piece, and what its edges can do ────────────────────────────────

export interface PieceEdge {
  /** The endpoints, in lattice coordinates of the canonical piece. */
  readonly ends: readonly [Int3, Int3];
  /** How many cells of the honeycomb have this edge. */
  readonly cells: number;
  /**
   * The turns about this edge that carry the honeycomb onto itself, the
   * identity first. One of these per seam is what a taping chooses.
   */
  readonly turns: readonly IMat3[];
}

export interface Honeycomb {
  readonly id: HoneycombId;
  readonly label: string;
  readonly pieceName: string;
  readonly verts: readonly Int3[];
  /** Vertex-index loops, ordered round each face. */
  readonly faces: readonly (readonly number[])[];
  readonly group: readonly IMat3[];
  readonly basis: readonly [Vec3, Vec3, Vec3];
  /** The piece's edges, in the order `faces` walks them. */
  readonly edges: readonly PieceEdge[];
  /** Which edges bound each face, as indices into `edges`. */
  readonly faceEdges: readonly (readonly number[])[];
  /**
   * The piece's own symmetries, as lattice placements that leave its vertices
   * where they were. One cell therefore has this many names, and a placement
   * is on the honeycomb when *any* of them translates by a lattice vector —
   * which is what `isCell` asks.
   */
  readonly selfSymmetries: readonly LatticePlacement[];
  /** Whether a translation is one of the honeycomb's own. */
  onLattice(t: Int3): boolean;
}

const built = new Map<HoneycombId, Honeycomb>();

/** The honeycomb of that name, worked out once. */
export function honeycombOf(id: HoneycombId): Honeycomb {
  const had = built.get(id);
  if (had) return had;
  const made = build(SPECS[id]);
  built.set(id, made);
  return made;
}

const specFaces = new Map<HoneycombId, number[][]>();

/** The face loops of a spec, ordered, worked out once. */
function facesOfSpec(spec: HoneycombSpec): number[][] {
  const had = specFaces.get(spec.id);
  if (had) return had;
  throw new Error(`${spec.id}: faces asked for before they were ordered`);
}

function build(spec: HoneycombSpec): Honeycomb {
  const world = (v: Int3): Vec3 => {
    const [b0, b1, b2] = spec.basis;
    return [
      b0[0] * v[0] + b1[0] * v[1] + b2[0] * v[2],
      b0[1] * v[0] + b1[1] * v[1] + b2[1] * v[2],
      b0[2] * v[0] + b1[2] * v[1] + b2[2] * v[2],
    ];
  };

  // Faces: the vertices on each plane, ordered round the face. The normal has
  // to come from two spokes that are not parallel — a rhombus lists its two
  // *opposite* corners first, and their cross product is zero, which sorts the
  // loop into its own diagonals.
  const faces: number[][] = spec.planes.map(plane => {
    const on: number[] = [];
    spec.verts.forEach((v, i) => {
      if (plane.n[0] * v[0] + plane.n[1] * v[1] + plane.n[2] * v[2] === plane.c) on.push(i);
    });
    if (on.length < 3) throw new Error(`${spec.id}: a face plane holds ${on.length} vertices`);
    const points = on.map(i => world(spec.verts[i]!));
    const centre = mean(points);
    const u = unit(minus(points[0]!, centre));
    let normal: Vec3 | null = null;
    for (let k = 1; k < points.length; k++) {
      const x = cross(minus(points[0]!, centre), minus(points[k]!, centre));
      if (Math.hypot(x[0], x[1], x[2]) > 1e-9) {
        normal = unit(x);
        break;
      }
    }
    if (!normal) throw new Error(`${spec.id}: a face with no plane`);
    const v = cross(normal, u);
    return on
      .map((index, k) => {
        const d = minus(points[k]!, centre);
        return { index, angle: Math.atan2(dot(d, v), dot(d, u)) };
      })
      .sort((a, b) => a.angle - b.angle)
      .map(x => x.index);
  });

  specFaces.set(spec.id, faces);
  const onLattice = latticeTest(spec.gens);
  const selfSymmetries = symmetriesOf(spec);
  const lands = (at: LatticePlacement): boolean =>
    selfSymmetries.some(s => onLattice(addI(matVec(at.rot, s.off), at.off)));

  // The edges, and what each one can do. The turns are read off the group; the
  // cells round an edge are counted over a small patch of the honeycomb, which
  // is the only search in this file and happens once per honeycomb.
  const patch = nearbyCells(spec, onLattice);
  const edges: PieceEdge[] = [];
  const faceEdges: number[][] = [];
  const edgeAt = new Map<string, number>();
  faces.forEach(loop => {
    const mine: number[] = [];
    for (let k = 0; k < loop.length; k++) {
      const a = spec.verts[loop[k]!]!;
      const b = spec.verts[loop[(k + 1) % loop.length]!]!;
      const key = edgeKeyOf(a, b);
      let at = edgeAt.get(key);
      if (at === undefined) {
        at = edges.length;
        edgeAt.set(key, at);
        const dir = subI(b, a);
        const about = spec.group.filter(g => sameI(matVec(g, dir), dir));
        const turns = [
          ...about.filter(g => keyOfMat(g) === keyOfMat(IDENT3)),
          ...about.filter(g => keyOfMat(g) !== keyOfMat(IDENT3)),
        ].filter(g => lands({ rot: g, off: subI(a, matVec(g, a)) }));
        edges.push({ ends: [a, b], cells: cellsWithEdge(spec, patch, a, b), turns });
      }
      mine.push(at);
    }
    faceEdges.push(mine);
  });

  return {
    id: spec.id,
    label: spec.label,
    pieceName: spec.pieceName,
    verts: spec.verts,
    faces,
    group: spec.group,
    basis: spec.basis,
    edges,
    faceEdges,
    selfSymmetries,
    onLattice,
  };
}

/**
 * The placements that leave the piece exactly where it was.
 *
 * A cell of the honeycomb is a *set of points*, and several placements fill
 * it: a triangular prism turned by a third of a turn about its own axis is the
 * same prism. So "is this placement on the honeycomb" cannot be answered by
 * looking at its translation alone, and this is the list that answers it.
 */
function symmetriesOf(spec: HoneycombSpec): LatticePlacement[] {
  const want = new Set(spec.verts.map(pointKey));
  const centroid = [0, 1, 2].map(a =>
    spec.verts.reduce((s, v) => s + v[a]!, 0) / spec.verts.length);
  const out: LatticePlacement[] = [];
  for (const g of spec.group) {
    const moved = [0, 1, 2].map(a =>
      g[a]![0]! * centroid[0]! + g[a]![1]! * centroid[1]! + g[a]![2]! * centroid[2]!);
    const off = [0, 1, 2].map(a => centroid[a]! - moved[a]!);
    if (off.some(x => Math.abs(x - Math.round(x)) > 1e-9)) continue;
    const t = off.map(Math.round) as unknown as Int3;
    const got = spec.verts.map(v => pointKey(addI(matVec(g, v), t)));
    if (got.every(k => want.has(k))) out.push({ rot: g, off: t });
  }
  return out;
}

/**
 * Whether a translation belongs to the honeycomb.
 *
 * For the cubic and triangular prismatic honeycombs every integer vector does,
 * and the test is free. For hexagonal prisms the cell centres are an index-3
 * sublattice, so a turn about an edge can land a piece where no cell is — and
 * that is the test that catches it.
 */
function latticeTest(gens: readonly [Int3, Int3, Int3]): (t: Int3) => boolean {
  const m = [0, 1, 2].map(i => [gens[0]![i]!, gens[1]![i]!, gens[2]![i]!]);
  const det =
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
  if (det === 0) throw new Error('a honeycomb with degenerate translations');
  const adj: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const rows = [0, 1, 2].filter(x => x !== j);
      const cols = [0, 1, 2].filter(x => x !== i);
      adj[i]![j] =
        ((i + j) % 2 === 0 ? 1 : -1) *
        (m[rows[0]!]![cols[0]!]! * m[rows[1]!]![cols[1]!]! -
          m[rows[0]!]![cols[1]!]! * m[rows[1]!]![cols[0]!]!);
    }
  }
  return (t: Int3): boolean => {
    for (let i = 0; i < 3; i++) {
      const x = adj[i]![0]! * t[0] + adj[i]![1]! * t[1] + adj[i]![2]! * t[2];
      if (x % det !== 0) return false;
    }
    return true;
  };
}

/** The placed piece's vertices, as a key that names the cell it fills. */
export function cellKey(hc: Honeycomb, at: LatticePlacement): string {
  return hc.verts.map(v => pointKey(addI(matVec(at.rot, v), at.off))).sort().join(' ');
}

function cellKeyOf(spec: HoneycombSpec, at: LatticePlacement): string {
  return spec.verts.map(v => pointKey(addI(matVec(at.rot, v), at.off))).sort().join(' ');
}

/** A small patch of the honeycomb, one placement per cell. */
function nearbyCells(
  spec: HoneycombSpec,
  onLattice: (t: Int3) => boolean,
): LatticePlacement[] {
  const seen = new Set<string>();
  const out: LatticePlacement[] = [];
  const R = 2;
  for (let i = -R; i <= R; i++) {
    for (let j = -R; j <= R; j++) {
      for (let k = -R; k <= R; k++) {
        const t = addI(
          addI(scaleI(spec.gens[0], i), scaleI(spec.gens[1], j)),
          scaleI(spec.gens[2], k),
        );
        if (!onLattice(t)) continue;
        for (const g of spec.group) {
          const at: LatticePlacement = { rot: g, off: t };
          const key = cellKeyOf(spec, at);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(at);
        }
      }
    }
  }
  return out;
}

/** How many cells of the honeycomb have a given edge — tape's whole problem. */
function cellsWithEdge(
  spec: HoneycombSpec,
  patch: readonly LatticePlacement[],
  a: Int3,
  b: Int3,
): number {
  const want = edgeKeyOf(a, b);
  let count = 0;
  for (const at of patch) {
    let has = false;
    for (const loop of facesOfSpec(spec)) {
      for (let k = 0; k < loop.length && !has; k++) {
        const p = addI(matVec(at.rot, spec.verts[loop[k]!]!), at.off);
        const q = addI(matVec(at.rot, spec.verts[loop[(k + 1) % loop.length]!]!), at.off);
        if (edgeKeyOf(p, q) === want) has = true;
      }
      if (has) break;
    }
    if (has) count++;
  }
  return count;
}

const scaleI = (v: Int3, k: number): Int3 => [v[0] * k, v[1] * k, v[2] * k];

export function edgeKeyOf(a: Int3, b: Int3): string {
  const ka = pointKey(a);
  const kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/**
 * A hinge's turn: the rotation `turn` about the line through one edge.
 *
 * The edge is given in whatever frame the caller is working in, and comes back
 * as a placement in that same frame — which is what lets a ring compose turns
 * without ever leaving the lattice.
 */
export function turnAboutEdge(edge: readonly [Int3, Int3], turn: IMat3): LatticePlacement {
  const [a] = edge;
  return { rot: turn, off: subI(a, matVec(turn, a)) };
}

/**
 * Whether a placement fills a cell of the honeycomb.
 *
 * Every rotation that gets here came from the honeycomb's own group — the
 * turns of a taping are drawn from `PieceEdge.turns` — so what is left to
 * check is where the piece was put, and it is enough that *one* of the cell's
 * several names translates by a lattice vector. On the cubic and triangular
 * prismatic honeycombs every integer translation is one, and this is free; on
 * hexagonal prisms the centres are an index-3 sublattice and a turn about an
 * edge really can land a piece where no cell is.
 */
export function isCell(hc: Honeycomb, at: LatticePlacement): boolean {
  for (const s of hc.selfSymmetries) {
    const off = matVec(at.rot, s.off);
    if (hc.onLattice([off[0] + at.off[0], off[1] + at.off[1], off[2] + at.off[2]])) return true;
  }
  return false;
}

// ─── cartesian, once, at the end ─────────────────────────────────────────

export interface CartesianPiece {
  /** The piece's faces, as loops of points about its own centroid. */
  readonly faces: readonly (readonly Vec3[])[];
  /** Each face's outward normal, which is what a sector grid asks for. */
  readonly normals: readonly Vec3[];
  /** Half the piece's bounding box, about the same centroid. */
  readonly halfExtents: Vec3;
  /** A lattice placement as a rigid motion of that body. */
  place(at: LatticePlacement): { rot: readonly [Vec3, Vec3, Vec3]; offset: Vec3 };
}

const cartesian = new Map<HoneycombId, CartesianPiece>();

/**
 * The piece as a solid, and a lattice placement as a rigid motion of it.
 *
 * The body frame sits on the piece's centroid rather than on the lattice
 * origin, because a fold is checked for collisions against each piece's own
 * bounding box and a box that is not centred on the placement's origin would
 * be wrong rather than merely generous.
 */
export function cartesianOf(id: HoneycombId): CartesianPiece {
  const had = cartesian.get(id);
  if (had) return had;
  const hc = honeycombOf(id);
  const spec = SPECS[id];
  const B: number[][] = [0, 1, 2].map(i => [0, 1, 2].map(j => spec.basis[j]![i]!));
  const Binv = inverse3(B);
  const centroid = [0, 1, 2].map(a => hc.verts.reduce((s, v) => s + v[a]!, 0) / hc.verts.length);
  const act = (m: number[][], v: readonly number[]): Vec3 => [
    m[0]![0]! * v[0]! + m[0]![1]! * v[1]! + m[0]![2]! * v[2]!,
    m[1]![0]! * v[0]! + m[1]![1]! * v[1]! + m[1]![2]! * v[2]!,
    m[2]![0]! * v[0]! + m[2]![1]! * v[1]! + m[2]![2]! * v[2]!,
  ];
  const faces = hc.faces.map(loop =>
    loop.map(i => act(B, [0, 1, 2].map(a => hc.verts[i]![a]! - centroid[a]!))));
  const spread = [0, 1, 2].map(a => {
    const xs = faces.flat().map(v => v[a]!);
    return (Math.max(...xs) - Math.min(...xs)) / 2;
  }) as unknown as Vec3;

  const normals = faces.map(loop => {
    const n = unit(cross(minus(loop[1]!, loop[0]!), minus(loop[2]!, loop[0]!)));
    // the body frame is centred on the piece, so "outward" is "away from 0"
    return dot(n, loop[0]!) < 0 ? ([-n[0], -n[1], -n[2]] as Vec3) : n;
  });

  const made: CartesianPiece = {
    faces,
    normals,
    halfExtents: spread,
    place: (at: LatticePlacement) => {
      const rot = mul3(mul3(B, at.rot.map(r => [...r])), Binv);
      const moved = [0, 1, 2].map(a =>
        at.rot[a]![0]! * centroid[0]! + at.rot[a]![1]! * centroid[1]! +
        at.rot[a]![2]! * centroid[2]! + at.off[a]!);
      return {
        rot: [rot[0], rot[1], rot[2]] as unknown as readonly [Vec3, Vec3, Vec3],
        offset: act(B, moved),
      };
    },
  };
  cartesian.set(id, made);
  return made;
}

/**
 * The piece as a catalogued solid is: faces, adjacency, and a grid per face.
 *
 * Nothing new — the same faces `cartesianOf` hands the mechanism, wrapped in
 * `Solid` so that everything written for a solid works on a piece of a ring.
 * The printed pattern is what wants this: `render/piece-net-model.ts` unfolds
 * a connected set of a solid's faces and draws the maze on them, and a piece
 * of a folding ring is a solid all of whose faces it keeps.
 */
export function pieceSolid(id: HoneycombId): Polyhedron {
  const had = solids.get(id);
  if (had) return had;
  const piece = cartesianOf(id);
  const faces: Face[] = piece.faces.map((loop, index) => ({
    id: index,
    vertices: loop.map(v => [...v] as unknown as Vec3),
    normal: piece.normals[index]!,
  }));
  const made = new PieceSolid(faces);
  solids.set(id, made);
  return made;
}

const solids = new Map<HoneycombId, Polyhedron>();

class PieceSolid extends Solid {
  protected readonly _faces: Face[];

  constructor(faces: Face[]) {
    super();
    this._faces = faces;
  }
}

/** A point of the canonical piece's lattice frame, in cartesian coordinates. */
export function toCartesian(id: HoneycombId, v: Int3): Vec3 {
  const spec = SPECS[id];
  const [b0, b1, b2] = spec.basis;
  return [
    b0[0] * v[0] + b1[0] * v[1] + b2[0] * v[2],
    b0[1] * v[0] + b1[1] * v[1] + b2[1] * v[2],
    b0[2] * v[0] + b1[2] * v[1] + b2[2] * v[2],
  ];
}

function mul3(a: number[][], b: readonly (readonly number[])[]): number[][] {
  return [0, 1, 2].map(i => [0, 1, 2].map(j =>
    a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!));
}

function inverse3(m: number[][]): number[][] {
  const det =
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
  const out: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const rows = [0, 1, 2].filter(x => x !== j);
      const cols = [0, 1, 2].filter(x => x !== i);
      out[i]![j] =
        (((i + j) % 2 === 0 ? 1 : -1) *
          (m[rows[0]!]![cols[0]!]! * m[rows[1]!]![cols[1]!]! -
            m[rows[0]!]![cols[1]!]! * m[rows[1]!]![cols[0]!]!)) / det;
    }
  }
  return out;
}

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mean = (points: readonly Vec3[]): Vec3 => [
  points.reduce((s, p) => s + p[0], 0) / points.length,
  points.reduce((s, p) => s + p[1], 0) / points.length,
  points.reduce((s, p) => s + p[2], 0) / points.length,
];
