import type { Face, Vec3 } from '../../types.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import type { CellSource, KineticCell, KineticState, Placement, TurnableMechanism } from '../types.ts';
import { rotZ } from '../types.ts';
import { cellVertices3d } from '../../cell-geometry.ts';
import { cross, dot, norm, normalize, scale, sub } from '../../vec3.ts';
import { getShape } from '../../polyhedra/registry.ts';
import { gyrationAxes } from '../seams.ts';
import type { GyrationAxis } from '../seams.ts';

/**
 * A catalogued solid cut open on a seam, with the parts free to turn.
 *
 * The cut runs along whole edges of the solid and closes into one loop that a
 * turn of `2*pi / turnSteps` carries onto itself (`seams.ts`), so the cells on
 * either side of it meet edge for edge at every turn — a different partner
 * each time, which is exactly what a side class is for. Where several seams
 * share an axis the solid falls into a line of pieces, each turning against
 * the next.
 *
 * What makes it worth having beside the glued pair is that nothing is thrown
 * away. The pair's joint face goes inside the object and the maze never
 * crosses it; here the whole surface of a known solid carries the maze, and
 * the object stays that solid however it is turned — an icosahedron is still
 * an icosahedron with its top fifth rotated.
 *
 * The parts are held the way the pair is held: a short dowel between two
 * bulkheads at the cut, with a disc glued on above the second one so the parts
 * cannot come apart. No hole is made in any printed face.
 */

export interface GyrationOptions {
  /** Registry id of the solid to cut. */
  shape?: string;
  /** Which of the solid's axes, in `gyrationAxes` order — 0 is the richest. */
  axisIndex?: number;
  /** Cells along one edge of a face. */
  n?: number;
}

export interface GyrationMechanism extends TurnableMechanism {
  readonly shapeId: string;
  readonly shapeName: string;
  readonly n: number;
  /** The solid the pieces are cut from, for a printed net to unfold. */
  readonly polyhedron: Polyhedron;
  /** The axis it is cut on, with the seams along it. */
  readonly axis: GyrationAxis;
  /** Ids of the faces each piece kept, lowest piece first. */
  readonly facesOfPiece: readonly (readonly number[])[];
  /** Scale from the solid's own coordinates to the cells given here. */
  readonly fit: number;
  /** Turn, in degrees, that one step applies. */
  readonly step: number;
  cellSource(index: number): CellSource;
  /** Turns (in steps) of each piece in a state, the lowest piece held at 0. */
  stateOffsets(index: number): number[];
}

/** A solid worth cutting, and what turning it makes of it. */
export interface GyrationChoice {
  readonly id: string;
  readonly shape: string;
  readonly axisIndex: number;
  readonly label: string;
  /** What the object becomes as it is turned, for the page to say out loud. */
  readonly becomes: string;
}

/**
 * The cuts worth offering: the ones the glued pair cannot already make.
 *
 * Ninety-one of the catalogue's 144 solids have a seam, which is far too many
 * for a list — but the first cut to reach for is the wrong one. Cut a solid in
 * two at a symmetric seam and the two halves are congruent, so the object *is*
 * two copies of one solid joined at a ring of edges, which is exactly what
 * `JOINED_PAIRS` offers. Measured rather than argued
 * (`.dev/probe-gyration-overlap.ts`): a cut octahedron, cuboctahedron and
 * icosidodecahedron come out with the same cells, the same states, the same
 * classes and the same multiset of class sizes as `j1@4`, `j3@6` and `j6@10`.
 * Two mechanisms, one object, and the panel offered it twice.
 *
 * So what is offered here is what a pair can never be: **a solid that comes
 * apart into three**. A glued pair has one joint and two pieces by
 * construction; a solid cut twice on one axis has a middle piece that turns
 * against both of its neighbours, and the states multiply rather than add —
 * a hundred of them on a rhombicosidodecahedron where the pair's richest joint
 * has ten.
 *
 * All five are convex, so the parts turn without catching, and all five are in
 * a catalogue, so the object has a name before the turn and after it.
 *
 * There is no `maxN` here, unlike `JOINED_PAIRS`, and that is a measurement
 * rather than an omission (`.dev/probe-gyration-gamma.ts`): over these solids,
 * at every ruling up to the cell cap, on three seeds each, the search never
 * once failed to find a design perfect in every state. What stops the slider
 * is the cell too small to print, and nothing else — so the cap says it.
 */
export const GYRATIONS: readonly GyrationChoice[] = [
  { id: 'icosahedron', shape: 'icosahedron', axisIndex: 0, label: 'Icosahedron',
    becomes: 'an icosahedron, whatever the turn — both caps turn' },
  { id: 'rhombicuboctahedron', shape: 'rhombicuboctahedron', axisIndex: 0, label: 'Rhombicuboctahedron',
    becomes: 'a rhombicuboctahedron and J37, as either cap turns' },
  { id: 'rhombicosidodecahedron', shape: 'rhombicosidodecahedron', axisIndex: 0, label: 'Rhombicosidodecahedron',
    becomes: 'a rhombicosidodecahedron, J72 and J73, as the caps turn' },
  { id: 'pentakis-dodecahedron', shape: 'pentakis-dodecahedron', axisIndex: 0, label: 'Pentakis dodecahedron',
    becomes: 'a pentakis dodecahedron, whatever the turn' },
  { id: 'triakis-icosahedron', shape: 'triakis-icosahedron', axisIndex: 0, label: 'Triakis icosahedron',
    becomes: 'a triakis icosahedron, whatever the turn' },
];

export const DEFAULT_GYRATION = GYRATIONS[0]!;

export function gyrationById(id: string): GyrationChoice | undefined {
  return GYRATIONS.find(g => g.id === id);
}

interface Resolved {
  shapeId: string;
  name: string;
  polyhedron: Polyhedron;
  faces: Face[];
  axis: GyrationAxis;
  axisCount: number;
}

function resolve(options: GyrationOptions): Resolved {
  const shapeId = options.shape ?? DEFAULT_GYRATION.shape;
  const descriptor = getShape(shapeId);
  if (!descriptor) throw new Error(`no such shape: ${shapeId}`);
  const polyhedron = descriptor.factory();
  const faces = polyhedron.faces();
  const found = gyrationAxes(faces);
  const wanted = options.axisIndex ?? 0;
  const axis = found[wanted];
  if (!axis) {
    throw new Error(found.length === 0
      ? `${shapeId} has no seam to cut on`
      : `${shapeId} has ${found.length} axes to cut on, not ${wanted + 1}`);
  }
  return { shapeId, name: descriptor.name, polyhedron, faces, axis, axisCount: found.length };
}

/** Piece each face belongs to: the seams it stands above. */
function pieceOfFace(face: Face, axis: GyrationAxis): number {
  let height = 0;
  for (const v of face.vertices) height += dot(v, axis.axis);
  height /= face.vertices.length;
  let piece = 0;
  for (const seam of axis.seams) if (height > seam.level) piece++;
  return piece;
}

export function createGyration(options: GyrationOptions = {}): GyrationMechanism {
  const n = options.n ?? 3;
  if (!Number.isInteger(n) || n < 1) throw new Error('n must be a positive whole number');
  const { shapeId, name, polyhedron, faces, axis } = resolve(options);

  // Stand the axis up as +z, so that everything downstream — the scene's
  // daylight between the pieces, the caps on their ends, the drag that turns
  // one — can go on assuming a turn is a rotation about z.
  const w = axis.axis;
  const away = faces.flatMap(f => f.vertices).reduce((best, v) => {
    const radial = norm(sub(v, scale(w, dot(v, w))));
    return radial > best.radial ? { radial, v } : best;
  }, { radial: 0, v: [1, 0, 0] as Vec3 });
  if (away.radial < 1e-9) throw new Error('the axis meets every vertex of the solid');
  const e1 = normalize(sub(away.v, scale(w, dot(away.v, w))));
  const e2 = cross(w, e1);
  const toAxisFrame = (p: Vec3): Vec3 => [dot(p, e1), dot(p, e2), dot(p, w)];

  const byPiece: Face[][] = Array.from({ length: axis.pieces }, () => []);
  for (const face of faces) byPiece[pieceOfFace(face, axis)]!.push(face);
  if (byPiece.some(list => list.length === 0)) {
    throw new Error(`${shapeId} leaves a piece with no faces on this axis`);
  }

  const outlines: Vec3[][] = [];
  const sources: CellSource[] = [];
  byPiece.forEach((list, piece) => {
    for (const face of list) {
      const grid = polyhedron.gridForFace(face, n);
      for (const cell of grid.cells()) {
        outlines.push(cellVertices3d(face, cell, n, grid.kind).map(toAxisFrame));
        sources.push({ piece, faceId: face.id, cell });
      }
    }
  });

  // One overall scale, so every solid arrives on screen at the size the rest of
  // the app uses.
  let reach = 0;
  for (const poly of outlines) for (const p of poly) reach = Math.max(reach, norm(p));
  const fit = 1 / reach;
  const cells: KineticCell[] = outlines.map((poly, index) => ({
    piece: sources[index]!.piece,
    corners: poly.map(p => scale(p, fit)),
  }));

  const { turnSteps } = axis;
  const step = (2 * Math.PI) / turnSteps;
  const stateCount = turnSteps ** (axis.pieces - 1);
  const stateOffsets = (index: number): number[] => {
    if (index < 0 || index >= stateCount) throw new Error(`no such state: ${index}`);
    const offsets = [0];
    let rest = index;
    for (let piece = 1; piece < axis.pieces; piece++) {
      offsets.push(rest % turnSteps);
      rest = Math.floor(rest / turnSteps);
    }
    return offsets;
  };

  const states: KineticState[] = [];
  for (let index = 0; index < stateCount; index++) {
    const placements: Placement[] = stateOffsets(index).map((k): Placement => ({
      rot: rotZ(k * step),
      offset: [0, 0, 0],
    }));
    states.push(placements);
  }

  return {
    id: `gyration-${shapeId}-${options.axisIndex ?? 0}`,
    shapeId,
    shapeName: name,
    n,
    polyhedron,
    axis,
    facesOfPiece: byPiece.map(list => list.map(f => f.id)),
    fit,
    step: 360 / turnSteps,
    turnSteps,
    pieceCount: axis.pieces,
    cells,
    states,
    cellSource: (index: number) => {
      const source = sources[index];
      if (!source) throw new Error(`no such cell: ${index}`);
      return source;
    },
    stateOffsets,
    stateIndex: (offsets: readonly number[]) => {
      // The lowest piece is not part of the state: turning the whole object by
      // hand is not a move, so whatever step it is given here is ignored.
      let index = 0;
      let place = 1;
      for (let piece = 1; piece < axis.pieces; piece++) {
        const turn = ((Math.round(offsets[piece] ?? 0) % turnSteps) + turnSteps) % turnSteps;
        index += turn * place;
        place *= turnSteps;
      }
      return index;
    },
    stateLabel: (index: number) => stateOffsets(index)
      .slice(1)
      .map(k => `${Math.round((k * 360) / turnSteps)}°`)
      .join(' / '),
  };
}

/** Cells the cut solid will have, without building it. Used to bound the sliders. */
export function gyrationCellCount(options: GyrationOptions = {}): number {
  const n = options.n ?? 3;
  const { polyhedron, faces } = resolve(options);
  let total = 0;
  for (const face of faces) total += polyhedron.gridForFace(face, n).cells().length;
  return total;
}

/**
 * What the cut solid will be, without building it.
 *
 * The panel needs to say how many pieces and how many turns before a maze
 * exists, and to know how many seam classes there are to spend: a seam whose
 * loop is `loop` edges long, ruled `n` cells to an edge and carried onto
 * itself by `order` turns, has `loop * n / order` of them — the turns act on
 * the sides along the cut without fixing any, so every class is one whole
 * orbit.
 */
export function gyrationFacts(options: GyrationOptions = {}): {
  pieces: number;
  turnSteps: number;
  stateCount: number;
  seamClasses: number;
} {
  const n = options.n ?? 3;
  const { axis } = resolve(options);
  let seamClasses = 0;
  for (const seam of axis.seams) seamClasses += (seam.loop * n) / seam.order;
  return {
    pieces: axis.pieces,
    turnSteps: axis.turnSteps,
    stateCount: axis.stateCount,
    seamClasses,
  };
}
