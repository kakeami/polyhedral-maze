/**
 * Prisms hinged into a closed ring: the mechanism, on any honeycomb.
 *
 * `cube-ring.ts` is this for cubes, and everything it says about the *idea* of
 * the object holds here word for word: the ring is the point, a closed chain
 * can only take a pose the whole ring agrees to, and folding shut buries part
 * of the surface. What is different is the lattice, and one fact that follows
 * from it and decides which objects exist at all:
 *
 * **A fold turns one contiguous arc about one line, so the two hinges bounding
 * the arc have to be coaxial.** On the cubic lattice that is nearly free —
 * hinges are lattice edges and a plank has plenty of them on one line — and on
 * a prism honeycomb it has to be arranged, which is why the layout matters
 * more here than it does for cubes. Measured over the 4096 tapings of six
 * triangular prisms: laid in a *strip* 263 of them fold, and laid round one
 * lattice vertex — six wedges of a hexagonal prism — 313 do, but almost all of
 * those shut into flat blobs of the same outline, because the one line two of
 * their hinges can share is the central edge and the six wedges bury it
 * (`.dev/2026-09-18-other-polyhedra-fold.md` §2).
 *
 * That measurement is also a warning about the *collision* test, and the
 * warning is the reason `fold-path.ts` grew a second one: with pieces measured
 * by their bounding boxes, which is exact for a cube and hopeless for a prism,
 * every one of those 4096 tapings comes out rigid. A ring with several shapes
 * on paper and one in the hand is what a wrong collision test looks like.
 *
 * The other honeycomb fact worth having here: **the rhombic dodecahedron is a
 * poor hinge and the truncated octahedron is no hinge at all**. No turn about
 * any edge of a truncated octahedron carries its packing onto itself, and no
 * two edges of the rhombic dodecahedral honeycomb are collinear, so the two
 * most attractive space-filling solids in the catalogue are not offered here.
 *
 * DOM-free, like everything in `core/`.
 */

import type { Face, Vec3 } from '../../types.ts';
import type { CellSource, KineticCell, KineticState, Mat3, Mechanism } from '../types.ts';
import { gridForPolygonFace } from '../../polyhedra/grids/dispatch.ts';
import { cellVertices3d } from '../../cell-geometry.ts';
import { buildFoldGraph, poseDistances } from '../fold-path.ts';
import type { FoldGraph } from '../fold-path.ts';
import {
  cartesianOf, cellKey, composeLattice, edgeKeyOf, honeycombOf, invertLattice, isCell,
  matVec, placementKey, pointKey, turnAboutEdge,
} from '../honeycomb.ts';
import type { Honeycomb, HoneycombId, Int3, LatticePlacement } from '../honeycomb.ts';

/**
 * An object: a ring of prisms, laid out and taped.
 *
 * The layout is the *reference*, the arrangement the tape is applied in, and
 * everything is measured against it — two objects with the same taping numbers
 * and different references are different objects.
 */
export interface HoneycombRingObject {
  /** What a link calls it. */
  readonly id: string;
  /** What the panel calls it. */
  readonly label: string;
  /** One line about what it folds into. */
  readonly blurb: string;
  readonly honeycomb: HoneycombId;
  /** Where each piece sits while the tape is applied, in ring order. */
  readonly ring: readonly LatticePlacement[];
  /** Which edge of each shared face the tape crosses, in that face's order. */
  readonly hinges: readonly number[];
  /** The finest ruling worth offering: how small a cell can be cut out. */
  readonly maxCells: number;
}

/** A shape a hand can stop at, and what it looks like. */
export interface HoneycombRingPose {
  /** Where it sits in `closures()`. */
  readonly closure: number;
  /** Which turn was taken at each hinge. */
  readonly turns: readonly number[];
  /** Genus of the object's surface here: 1 once it shuts into a ring. */
  readonly genus: number;
  /** Faces of the pieces that are on the outside. */
  readonly exposed: number;
  /**
   * Whether some strip of tape is pinched between pieces in this shape.
   *
   * Not a reason to refuse the shape — see `honeycombRingShape` — but worth
   * carrying, because it is the one thing about a pose that the *paper* has an
   * opinion about and the geometry does not.
   */
  readonly tapePinched: boolean;
  /** How many layers deep the shape is. */
  readonly thickness: number;
  /**
   * The shape as a name, up to turning the object over: two poses with the
   * same silhouette differ only in which faces look outward. Counting these
   * rather than the states is how an object is judged
   * (`.dev/2026-09-17-fold-objects-2.md` §6).
   */
  readonly silhouette: string;
  /**
   * The occupancy, layer by layer, for anything that has to print it — the
   * same field, under the same name and in the same form, as a ring of cubes
   * hands over, so that a panel can hold either.
   */
  readonly layers: string;
  /** What to call it: Ring 1, Plate 2, Block 1. */
  readonly label: string;
}

export interface HoneycombRingMechanism extends Mechanism {
  readonly object: HoneycombRingObject;
  readonly honeycomb: Honeycomb;
  /** Cells across one edge of one face. */
  readonly cellsPerFace: number;
  /** Where each cell came from, which is what a printed pattern needs. */
  readonly sources: readonly CellSource[];
  /** The states, described: same order, same length. */
  readonly poses: readonly HoneycombRingPose[];
  /** Poses of this object a hand cannot fold to from the states. */
  readonly strays: readonly HoneycombRingPose[];
  /** Index into `cells` for one cell of one piece. */
  cellIndex(piece: number, faceId: number, cell: string): number;
  /** Every way the ring closes, the open shapes included. */
  closures(): readonly KineticState[];
  /** The folds between all of those, worked out once per object. */
  foldGraph(): FoldGraph;
  /** Where the tape goes, seam by seam, in the body frame of each piece. */
  tapeSeams(): readonly TapeSeam[];
  readonly pieceHalfExtents: readonly Vec3[];
  readonly pieceFaces: readonly (readonly (readonly Vec3[])[])[];
}

/** One strip of tape: the edge two pieces are hinged on, as each of them sees it. */
export interface TapeSeam {
  readonly seam: number;
  /** The pieces it joins, in ring order. */
  readonly pieces: readonly [number, number];
  /** The taped edge in the body frame of `pieces[0]`, then of `pieces[1]`. */
  readonly ends: readonly [readonly [Vec3, Vec3], readonly [Vec3, Vec3]];
}

export interface HoneycombRingOptions {
  /** Cells across one edge of one face. */
  cells?: number;
  /** Refuse to build past this many closures, rather than grind. */
  maxClosures?: number;
}

// ─── reference layouts ───────────────────────────────────────────────────

/** An upward triangular prism of the prismatic honeycomb, by its cell. */
export const upPrism = (i: number, j: number, layer: number): LatticePlacement =>
  ({ rot: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], off: [i, j, layer] });

/**
 * A downward triangular prism, by its cell.
 *
 * A half turn takes the upward prism at the origin to a downward one, and in
 * any basis a half turn is minus the identity — which is why this is the one
 * lattice arithmetic in this file that needs no matrix of its own.
 */
export const downPrism = (i: number, j: number, layer: number): LatticePlacement =>
  ({ rot: [[-1, 0, 0], [0, -1, 0], [0, 0, -1]], off: [i + 1, j + 1, layer + 1] });

/** A hexagonal prism, by its cell in the hexagonal tiling's own coordinates. */
export const hexPrism = (q: number, r: number, layer: number): LatticePlacement =>
  ({ rot: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], off: [q - r, q + 2 * r, layer] });

/**
 * A strip of triangular prisms, k in a row and k in the layer above.
 *
 * What a plank of cubes is on this honeycomb, and for the same reason: the tape
 * goes on with the pieces in a row, and the horizontal edges of a row lie on
 * two straight lines of the lattice, so two hinges can be coaxial and the
 * thing can fold at all.
 */
export function prismStrip(k: number): LatticePlacement[] {
  if (k < 2) throw new Error(`no strip of ${k} prisms`);
  const ring: LatticePlacement[] = [];
  for (let i = 0; i < k; i++) {
    ring.push(i % 2 === 0 ? upPrism(Math.floor(i / 2), 0, 0) : downPrism(Math.floor(i / 2), 0, 0));
  }
  for (let i = k - 1; i >= 0; i--) {
    ring.push(i % 2 === 0 ? upPrism(Math.floor(i / 2), 0, 1) : downPrism(Math.floor(i / 2), 0, 1));
  }
  return ring;
}

/**
 * The six triangular prisms round a lattice vertex, in ring order: a hexagonal
 * prism made of six wedges.
 *
 * The prettiest layout on this honeycomb — the object *is* a hexagonal prism
 * when it is laid out — and the hardest to get much out of. Every hinge sits
 * round the one point, so the only line two of them can share is the central
 * edge, and the six wedges bury that: of the 313 tapings (in 4096) that fold
 * at all, nearly all shut into flat blobs of one outline, and the ones worth
 * having are the few that keep the hexagon itself as a pose.
 */
export function prismHexagon(layer = 0): LatticePlacement[] {
  return [
    upPrism(0, 0, layer), downPrism(0, -1, layer), upPrism(0, -1, layer),
    downPrism(-1, -1, layer), upPrism(-1, 0, layer), downPrism(-1, 0, layer),
  ];
}

/** Two hexagons of wedges, one above the other: twelve prisms, a ring round both. */
export function prismHexPair(): LatticePlacement[] {
  const lower = prismHexagon(0);
  const upper = prismHexagon(1);
  return [...lower, ...upper.slice().reverse()];
}

/**
 * Twelve triangular prisms round an empty one: a plate with a hole in it.
 *
 * The triangular lattice's own answer to the hexagonal prism's ring of six.
 * Three prisms would surround the empty triangle's *edges*, but they would
 * meet each other along a vertical line and nowhere else — a pinch, which
 * falls apart in the hand — so the ring has to go round the whole
 * neighbourhood, and the whole neighbourhood is twelve.
 */
export function prismHole(): LatticePlacement[] {
  return [
    downPrism(0, -1, 0), upPrism(1, -1, 0), downPrism(1, -1, 0), upPrism(1, 0, 0),
    downPrism(0, 0, 0), upPrism(0, 1, 0), downPrism(-1, 1, 0), upPrism(-1, 1, 0),
    downPrism(-1, 0, 0), upPrism(-1, 0, 0), downPrism(-1, -1, 0), upPrism(0, -1, 0),
  ];
}

/**
 * Six hexagonal prisms round an empty one.
 *
 * The layout that makes the object worth having: it is already a *ring with a
 * hole through it*, so the reference pose is a torus, and the shapes it folds
 * into are not. Six is the fewest pieces any honeycomb here can do that with —
 * ten cubes is the minimum on the cubic lattice, exhaustively
 * (`.dev/2026-09-17-genus-change.md`).
 */
export function hexPrismHole(): LatticePlacement[] {
  return [
    hexPrism(1, 0, 0), hexPrism(0, 1, 0), hexPrism(-1, 1, 0),
    hexPrism(-1, 0, 0), hexPrism(0, -1, 0), hexPrism(1, -1, 0),
  ];
}

// ─── the seams, and every way the ring closes ────────────────────────────

interface Seam {
  /** The taped edge, in the coordinates the layout is written in. */
  readonly edge: readonly [Int3, Int3];
  /** Which edge of the canonical piece it is, for the first of the two. */
  readonly edgeOf: number;
}

/** Which face two consecutive pieces share, and which of its edges is taped. */
export function ringSeams(
  hc: Honeycomb,
  ring: readonly LatticePlacement[],
  hinges: readonly number[],
): Seam[] {
  if (hinges.length !== ring.length) {
    throw new Error(`a ring of ${ring.length} pieces needs ${ring.length} hinges`);
  }
  return ring.map((here, i) => {
    const next = ring[(i + 1) % ring.length]!;
    const mine = facesOf(hc, here);
    const theirs = new Set(facesOf(hc, next).map(f => f.key));
    const shared = mine.find(f => theirs.has(f.key));
    if (!shared) throw new Error(`pieces ${i} and ${(i + 1) % ring.length} share no face`);
    const loop = shared.loop;
    const at = ((hinges[i]! % loop.length) + loop.length) % loop.length;
    const edge: readonly [Int3, Int3] = [loop[at]!, loop[(at + 1) % loop.length]!];
    // the same edge, as the canonical piece sees it, which is what says how
    // many cells surround it
    const body = invertLattice(here);
    const key = edgeKeyOf(
      applyTo(body, edge[0]),
      applyTo(body, edge[1]),
    );
    const edgeOf = hc.edges.findIndex(e => edgeKeyOf(e.ends[0], e.ends[1]) === key);
    if (edgeOf < 0) throw new Error('a taped edge that is not an edge of the piece');
    return { edge, edgeOf };
  });
}

const applyTo = (p: LatticePlacement, v: Int3): Int3 => {
  const moved = matVec(p.rot, v);
  return [moved[0] + p.off[0], moved[1] + p.off[1], moved[2] + p.off[2]];
};

interface PlacedFace {
  readonly loop: readonly Int3[];
  readonly key: string;
}

function facesOf(hc: Honeycomb, at: LatticePlacement): PlacedFace[] {
  return hc.faces.map(loop => {
    const points = loop.map(i => applyTo(at, hc.verts[i]!));
    return { loop: points, key: points.map(pointKey).sort().join(' ') };
  });
}

export interface Closure {
  readonly places: readonly LatticePlacement[];
  readonly turns: readonly number[];
}

/**
 * Every way the taped ring closes back on itself, open shapes included.
 *
 * One turn per hinge, drawn from the turns about that hinge's line which carry
 * the honeycomb onto itself — anything else and the pieces would not meet face
 * to face — and all that is asked is that the chain comes back exactly where
 * it started with no two pieces in one cell. The first piece is pinned, which
 * quotients out turning the whole object round in your hands.
 */
export function ringClosures(
  hc: Honeycomb,
  ring: readonly LatticePlacement[],
  hinges: readonly number[],
  options: { maxClosures?: number } = {},
): Closure[] {
  const pieces = ring.length;
  const maxClosures = options.maxClosures ?? 100000;
  const seams = ringSeams(hc, ring, hinges);

  const relative: LatticePlacement[][] = seams.map((seam, i) => {
    const back = invertLattice(ring[i]!);
    const forth = ring[(i + 1) % pieces]!;
    return hc.edges[seam.edgeOf]!.turns.map(turn =>
      composeLattice(back, composeLattice(turnAboutEdge(seam.edge, turn), forth)));
  });

  const start = ring[0]!;
  const startKey = placementKey(start);
  const out: Closure[] = [];
  const placed: LatticePlacement[] = [start];
  const taken = new Set<string>([cellKey(hc, start)]);
  const chosen: number[] = [];

  const walk = (index: number): void => {
    if (out.length > maxClosures) throw new Error(`over ${maxClosures} closures`);
    const options_ = relative[index]!;
    if (index === pieces - 1) {
      options_.forEach((step, k) => {
        if (placementKey(composeLattice(placed[index]!, step)) !== startKey) return;
        out.push({ places: placed.map(p => p), turns: [...chosen, k] });
      });
      return;
    }
    options_.forEach((step, k) => {
      const next = composeLattice(placed[index]!, step);
      if (!isCell(hc, next)) return;
      const key = cellKey(hc, next);
      if (taken.has(key)) return;
      taken.add(key);
      placed.push(next);
      chosen.push(k);
      walk(index + 1);
      chosen.pop();
      placed.pop();
      taken.delete(key);
    });
  };
  walk(0);
  return out;
}

// ─── what a hand can hold ────────────────────────────────────────────────

/** Where a cell sits, as an integer: the sum of its corners. */
function anchorOf(hc: Honeycomb, at: LatticePlacement): Int3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const v of hc.verts) {
    const p = applyTo(at, v);
    x += p[0];
    y += p[1];
    z += p[2];
  }
  return [x, y, z];
}

export interface Skin {
  readonly manifold: boolean;
  /** Whether two pieces meet at a point alone — a pinch the edge test misses. */
  readonly pinched: boolean;
  /** Boundary components: two means a sealed cavity, one means none. */
  readonly comps: number;
  /** Genus of the boundary, summed over its components. */
  readonly genus: number;
  readonly exposed: number;
}

/** The boundary surface of a shape, from the cells it fills alone. */
export function skinOf(hc: Honeycomb, places: readonly LatticePlacement[]): Skin {
  const faces = new Map<string, readonly Int3[]>();
  const mine = places.map(at => facesOf(hc, at));
  const owners = new Map<string, number>();
  mine.forEach(list => {
    for (const face of list) owners.set(face.key, (owners.get(face.key) ?? 0) + 1);
  });
  mine.forEach(list => {
    for (const face of list) if (owners.get(face.key) === 1) faces.set(face.key, face.loop);
  });

  const ids = new Map<string, number>();
  const idOf = (p: Int3): number => {
    const key = pointKey(p);
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
    }
    return id;
  };
  const loops = [...faces.values()].map(loop => loop.map(idOf));

  const edgeFaces = new Map<string, number[]>();
  loops.forEach((loop, index) => {
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k]!;
      const b = loop[(k + 1) % loop.length]!;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const list = edgeFaces.get(key);
      if (list) list.push(index);
      else edgeFaces.set(key, [index]);
    }
  });
  const manifold = [...edgeFaces.values()].every(list => list.length === 2);

  const parent = loops.map((_unused, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r]!;
    let c = x;
    while (parent[c] !== c) {
      const next = parent[c]!;
      parent[c] = r;
      c = next;
    }
    return r;
  };
  for (const list of edgeFaces.values()) {
    for (let i = 1; i < list.length; i++) {
      const ra = find(list[0]!);
      const rb = find(list[i]!);
      if (ra !== rb) parent[ra] = rb;
    }
  }
  const comps = new Map<number, { v: Set<number>; e: Set<string>; f: number }>();
  loops.forEach((loop, index) => {
    const root = find(index);
    let part = comps.get(root);
    if (!part) {
      part = { v: new Set(), e: new Set(), f: 0 };
      comps.set(root, part);
    }
    part.f++;
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k]!;
      const b = loop[(k + 1) % loop.length]!;
      part.v.add(a);
      part.e.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    }
  });
  let genus = 0;
  for (const part of comps.values()) genus += (2 - (part.v.size - part.e.size + part.f)) / 2;

  return {
    manifold,
    pinched: pinchedAtAVertex(loops, edgeFaces),
    comps: comps.size,
    genus,
    exposed: loops.length,
  };
}

/**
 * Whether the shape touches itself at a vertex alone.
 *
 * The edge test above passes a shape whose two halves meet at one corner,
 * because no edge of the boundary has four faces on it — the two halves simply
 * do not share an edge. Such a thing falls apart in the hand, so it is not a
 * pose. Read off the boundary faces round each vertex: they have to come round
 * in one cycle, not two.
 */
function pinchedAtAVertex(
  loops: readonly (readonly number[])[],
  edgeFaces: ReadonlyMap<string, readonly number[]>,
): boolean {
  const atVertex = new Map<number, number[]>();
  loops.forEach((loop, index) => {
    for (const v of loop) {
      const list = atVertex.get(v);
      if (list) list.push(index);
      else atVertex.set(v, [index]);
    }
  });
  for (const [vertex, list] of atVertex) {
    if (list.length < 3) continue;
    const seat = new Map(list.map((face, i) => [face, i]));
    const parent = list.map((_unused, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
    for (const [key, faces] of edgeFaces) {
      const [a, b] = key.split('-').map(Number);
      if (a !== vertex && b !== vertex) continue;
      const here = faces.filter(f => seat.has(f));
      for (let i = 1; i < here.length; i++) {
        const ra = find(seat.get(here[0]!)!);
        const rb = find(seat.get(here[i]!)!);
        if (ra !== rb) parent[ra] = rb;
      }
    }
    if (new Set(list.map((_unused, i) => find(i))).size > 1) return true;
  }
  return false;
}

/**
 * Whether every strip of tape is still reachable from outside the object.
 *
 * Exported because it is the test that decides most of what is *not* a state,
 * and a claim like that should be checkable from outside: an edge with every
 * one of its cells present is inside the shape, and tape cannot be there, so
 * the pose exists on paper and not in the hand.
 */
export function tapeOutside(
  hc: Honeycomb,
  ring: readonly LatticePlacement[],
  seams: readonly Seam[],
  places: readonly LatticePlacement[],
): boolean {
  const mine = places.map(at => new Set(edgeKeysOf(hc, at)));
  for (let i = 0; i < seams.length; i++) {
    const body = invertLattice(ring[i]!);
    const a = applyTo(places[i]!, applyTo(body, seams[i]!.edge[0]));
    const b = applyTo(places[i]!, applyTo(body, seams[i]!.edge[1]));
    const key = edgeKeyOf(a, b);
    let round = 0;
    for (const set of mine) if (set.has(key)) round++;
    if (round >= hc.edges[seams[i]!.edgeOf]!.cells) return false;
  }
  return true;
}

function edgeKeysOf(hc: Honeycomb, at: LatticePlacement): string[] {
  const out = new Set<string>();
  for (const loop of hc.faces) {
    for (let k = 0; k < loop.length; k++) {
      out.add(edgeKeyOf(
        applyTo(at, hc.verts[loop[k]!]!),
        applyTo(at, hc.verts[loop[(k + 1) % loop.length]!]!),
      ));
    }
  }
  return [...out];
}

/**
 * Whether the shape is one a hand can set down and leave standing.
 *
 * Every piece rests on the table or on another piece. Weaker than the cube
 * ring's rule (a solid block, or one layer) on purpose: that one throws away
 * four of the eight-cube ring's ten poses, all of them gapless lumps a hand
 * can hold, and on a prism honeycomb "a solid block" is not even the right
 * question — a 6-fold edge lets a block keep its tape on the outside, which is
 * exactly what a cube block cannot do.
 */
export function standsUp(hc: Honeycomb, places: readonly LatticePlacement[]): boolean {
  const step = hc.verts.length;
  const at = new Set(places.map(p => pointKey(anchorOf(hc, p))));
  const anchors = places.map(p => anchorOf(hc, p));
  const floor = Math.min(...anchors.map(a => a[2]));
  return anchors.every(a =>
    a[2] === floor || at.has(pointKey([a[0], a[1], a[2] - step])));
}

/** The shape a set of cells makes, up to turning it over and moving it. */
export function shapeKey(hc: Honeycomb, places: readonly LatticePlacement[]): string {
  const anchors = places.map(p => anchorOf(hc, p));
  let best: string | null = null;
  for (const g of hc.group) {
    const moved = anchors.map(a => matVec(g, a));
    moved.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
    const base = moved[0]!;
    const text = moved.map(v => pointKey([v[0] - base[0], v[1] - base[1], v[2] - base[2]])).join(' ');
    if (best === null || text < best) best = text;
  }
  return best!;
}

/**
 * The occupancy, layer by layer — what a pattern draws to name a shape.
 *
 * An upward triangle is `A` and a downward one `V`; a hexagon or a cube is
 * `#`. Layers are separated by `|`, rows within a layer by `/`, which is the
 * form `cube-ring.ts` prints and the panels already read.
 */
export function drawLayers(hc: Honeycomb, places: readonly LatticePlacement[]): string {
  const step = hc.verts.length;
  const spots = places.map(p => {
    const a = anchorOf(hc, p);
    if (hc.id === 'triprism') {
      const up = ((a[0] % 6) + 6) % 6 === 2;
      const i = (a[0] - (up ? 2 : 4)) / 6;
      const j = (a[1] - (up ? 2 : 4)) / 6;
      return { col: 2 * i + j + (up ? 0 : 1), row: -j, mark: up ? 'A' : 'V', layer: a[2] / step };
    }
    if (hc.id === 'hexprism') {
      const q = a[0] / 12;
      const r = a[1] / 12;
      return { col: 2 * q + r, row: -r, mark: '#', layer: a[2] / step };
    }
    return { col: a[0] / 8, row: -a[1] / 8, mark: '#', layer: a[2] / step };
  });
  const layers = [...new Set(spots.map(s => s.layer))].sort((a, b) => a - b);
  return layers.map(layer => {
    const here = spots.filter(s => s.layer === layer);
    const c0 = Math.min(...here.map(s => s.col));
    const c1 = Math.max(...here.map(s => s.col));
    const r0 = Math.min(...here.map(s => s.row));
    const r1 = Math.max(...here.map(s => s.row));
    const rows: string[] = [];
    for (let r = r0; r <= r1; r++) {
      let line = '';
      for (let c = c0; c <= c1; c++) {
        line += here.find(s => s.col === c && s.row === r)?.mark ?? '.';
      }
      rows.push(line);
    }
    return rows.join('/');
  }).join('  |  ');
}

/**
 * What to call a shape, from the shape alone.
 *
 * A hand tells these apart by silhouette: a ring is the one with a hole
 * through it, a plate lies flat on the table, anything else is a block.
 */
function labelFor(genus: number, thickness: number): string {
  if (genus > 0) return 'Ring';
  return thickness === 1 ? 'Plate' : 'Block';
}

// ─── the object's own shape, worked out once ─────────────────────────────

export interface HoneycombRingShape {
  readonly closures: readonly KineticState[];
  readonly latticeClosures: readonly Closure[];
  readonly poses: readonly HoneycombRingPose[];
  readonly strays: readonly HoneycombRingPose[];
  readonly foldGraph: FoldGraph;
}

const shapes = new Map<string, HoneycombRingShape>();

const objectKey = (object: HoneycombRingObject): string =>
  `${object.honeycomb}|${object.ring.map(placementKey).join(' ')}|${object.hinges.join(',')}`;

/**
 * Everything about an object that the ruling does not touch.
 *
 * Which shapes it shuts into, which of them a hand can stop at and fold
 * between: none of it depends on how finely the pieces are ruled, so it is
 * worked out once per object and kept.
 *
 * **Where the tape has to be reachable is the layout, not the pose.** The ring
 * of cubes asks it of every pose (`cube-ring.ts`: an edge with all four cubes
 * round it is inside the object, so the shape "exists on paper and not in the
 * hand"), and on this mechanism that rule refuses a shape the object *has to
 * pass through*: the hexagonal-prism ring reaches its third block only through
 * a triangle two layers deep, in which one strip is pinched between four
 * prisms. A rule that forbids stopping where the motion must go is a rule
 * about nothing — and the thing being forbidden is a tenth of a millimetre of
 * tape between two sheets of card, which paper absorbs. So the strip must be
 * reachable where it is *applied*, and a pose that squeezes one says so
 * (`HoneycombRingPose.tapePinched`) rather than being thrown away.
 *
 * The rings of cubes are untouched, and the same argument would give them more
 * states than they are shipped with; that is a claim about four published
 * objects and their cached designs, so it is left alone here
 * (`.dev/2026-09-18-other-polyhedra-fold.md` §11).
 */
export function honeycombRingShape(
  object: HoneycombRingObject,
  options: { maxClosures?: number } = {},
): HoneycombRingShape {
  const key = objectKey(object);
  const had = shapes.get(key);
  if (had) return had;

  const hc = honeycombOf(object.honeycomb);
  const piece = cartesianOf(object.honeycomb);
  const closures = ringClosures(hc, object.ring, object.hinges, options);
  if (closures.length === 0) throw new Error('this taping never closes');
  const seams = ringSeams(hc, object.ring, object.hinges);
  const pieces = object.ring.length;

  const states: KineticState[] = closures.map(c => c.places.map(p => {
    const placed = piece.place(p);
    return { rot: placed.rot as unknown as Mat3, offset: placed.offset };
  }));

  // The tape has to be reachable where it goes *on* — the layout the object is
  // assembled in — and that is a different demand from anything a pose makes.
  if (!tapeOutside(hc, object.ring, seams, object.ring)) {
    throw new Error('this taping cannot be applied in its own layout');
  }

  const candidates: { closure: number; pose: Omit<HoneycombRingPose, 'label'> }[] = [];
  const seen = new Set<string>();
  closures.forEach((closure, index) => {
    if (!standsUp(hc, closure.places)) return;
    const skin = skinOf(hc, closure.places);
    if (!skin.manifold || skin.pinched || skin.comps !== 1) return;
    // Two closures with the same pieces in the same cells, differing only in
    // which way a piece is turned, are two shapes and not one: the same hand
    // holds them and different faces look outward.
    const text = closure.places.map(placementKey).join('/');
    if (seen.has(text)) return;
    seen.add(text);
    const step = hc.verts.length;
    candidates.push({
      closure: index,
      pose: {
        closure: index,
        turns: closure.turns,
        genus: skin.genus,
        exposed: skin.exposed,
        tapePinched: !tapeOutside(hc, object.ring, seams, closure.places),
        thickness: new Set(closure.places.map(p => anchorOf(hc, p)[2] / step)).size,
        silhouette: shapeKey(hc, closure.places),
        layers: drawLayers(hc, closure.places),
      },
    });
  });
  if (candidates.length === 0) throw new Error('this taping shuts into nothing a hand can hold');

  // The folds first, then the poses: which of them are states is decided by
  // what the object can be folded into, and that is what the graph says.
  const over = buildFoldGraph({
    pieceCount: pieces,
    states: candidates.map(c => states[c.closure]!),
    closures: () => states,
    pieceHalfExtents: Array.from({ length: pieces }, () => piece.halfExtents),
    pieceFaces: Array.from({ length: pieces }, () => piece.faces),
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
  const name = (genus: number, thickness: number): string => {
    const kind = labelFor(genus, thickness);
    const nth = (counted.get(kind) ?? 0) + 1;
    counted.set(kind, nth);
    return `${kind} ${nth}`;
  };
  const poses: HoneycombRingPose[] = reachable.map(i => ({
    ...candidates[i]!.pose,
    label: name(candidates[i]!.pose.genus, candidates[i]!.pose.thickness),
  }));
  const strays: HoneycombRingPose[] = candidates
    .filter((_unused, i) => !inComponent.has(i))
    .map(c => ({ ...c.pose, label: labelFor(c.pose.genus, c.pose.thickness) }));

  const made: HoneycombRingShape = {
    closures: states,
    latticeClosures: closures,
    poses,
    strays,
    foldGraph: { ...over, poseAt: poses.map(pose => pose.closure) },
  };
  shapes.set(key, made);
  return made;
}

// ─── the mechanism ───────────────────────────────────────────────────────

/** The piece's faces, ruled, with the cell they came from beside each one. */
function pieceCells(
  object: HoneycombRingObject,
  cells: number,
): { corners: Vec3[]; faceId: number; cell: string }[] {
  const piece = cartesianOf(object.honeycomb);
  const out: { corners: Vec3[]; faceId: number; cell: string }[] = [];
  piece.faces.forEach((loop, faceId) => {
    const face: Face = { id: faceId, vertices: [...loop], normal: piece.normals[faceId]! };
    const grid = gridForPolygonFace(face, cells);
    for (const cell of grid.cells()) {
      out.push({ corners: cellVertices3d(face, cell, cells, grid.kind), faceId, cell });
    }
  });
  return out;
}

function tapeSeamsOf(object: HoneycombRingObject): TapeSeam[] {
  const hc = honeycombOf(object.honeycomb);
  const seams = ringSeams(hc, object.ring, object.hinges);
  const centroid = [0, 1, 2].map(a =>
    hc.verts.reduce((sum, v) => sum + v[a]!, 0) / hc.verts.length);
  const inFrameOf = (cell: LatticePlacement, point: Int3): Vec3 => {
    const body = invertLattice(cell);
    const local = applyTo(body, point);
    const shifted: Int3 = [local[0] - centroid[0]!, local[1] - centroid[1]!, local[2] - centroid[2]!];
    return cartesianPoint(object.honeycomb, shifted);
  };
  return seams.map((seam, index) => {
    const next = (index + 1) % object.ring.length;
    return {
      seam: index,
      pieces: [index, next] as const,
      ends: [
        [inFrameOf(object.ring[index]!, seam.edge[0]), inFrameOf(object.ring[index]!, seam.edge[1])],
        [inFrameOf(object.ring[next]!, seam.edge[0]), inFrameOf(object.ring[next]!, seam.edge[1])],
      ] as const,
    };
  });
}

/** A point of the lattice frame, in the piece's own cartesian frame. */
function cartesianPoint(id: HoneycombId, v: readonly number[]): Vec3 {
  const hc = honeycombOf(id);
  const [b0, b1, b2] = hc.basis;
  return [
    b0[0] * v[0]! + b1[0] * v[1]! + b2[0] * v[2]!,
    b0[1] * v[0]! + b1[1] * v[1]! + b2[1] * v[2]!,
    b0[2] * v[0]! + b1[2] * v[1]! + b2[2] * v[2]!,
  ];
}

export function createHoneycombRing(
  object: HoneycombRingObject,
  options: HoneycombRingOptions = {},
): HoneycombRingMechanism {
  const cells = options.cells ?? 2;
  if (cells < 1) throw new Error('a face needs at least one cell across it');

  const hc = honeycombOf(object.honeycomb);
  const piece = cartesianOf(object.honeycomb);
  const shape = honeycombRingShape(object, options);
  const pieces = object.ring.length;

  const perPiece = pieceCells(object, cells);
  const all: KineticCell[] = [];
  const sources: CellSource[] = [];
  const index = new Map<string, number>();
  for (let p = 0; p < pieces; p++) {
    perPiece.forEach(cell => {
      index.set(`${p}/${cell.faceId}/${cell.cell}`, all.length);
      all.push({ piece: p, corners: cell.corners });
      sources.push({ piece: p, faceId: cell.faceId, cell: cell.cell });
    });
  }

  return {
    id: `honeycomb-ring-${object.id}-${cells}`,
    pieceCount: pieces,
    cells: all,
    states: shape.poses.map(pose => shape.closures[pose.closure]!),
    object,
    honeycomb: hc,
    cellsPerFace: cells,
    sources,
    poses: shape.poses,
    strays: shape.strays,
    cellIndex: (p, faceId, cell) => {
      const at = index.get(`${p}/${faceId}/${cell}`);
      if (at === undefined) throw new Error(`no cell ${cell} on face ${faceId} of piece ${p}`);
      return at;
    },
    stateLabel: at => shape.poses[at]?.label ?? `state ${at}`,
    closures: () => shape.closures,
    foldGraph: () => shape.foldGraph,
    tapeSeams: () => tapeSeamsOf(object),
    pieceHalfExtents: Array.from({ length: pieces }, () => piece.halfExtents),
    pieceFaces: Array.from({ length: pieces }, () => piece.faces),
  };
}
