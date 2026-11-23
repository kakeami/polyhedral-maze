/**
 * What the interchange maze adds to a folding ring's geometry: the symbol
 * drawn on each station, and the route as walks to be traced one at a time.
 *
 * A station is told from the next by a symbol and never by a number or a
 * letter: nothing about the maze says in what order they are met, and a 2
 * beside a 3 would. So each is a shape with no place in any sequence — a
 * star, a diamond, a triangle — drawn in the cell it stands on, and no two
 * stations of one maze share one.
 *
 * DOM-free and three-free, like `kinetic-geometry.ts`, which this leans on.
 */

import type { Vec3 } from '../core/types.ts';
import type { KineticCell, Mechanism } from '../core/kinetic/types.ts';
import { applyPlacement } from '../core/kinetic/types.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { InterchangeMaze, InterchangeWorld } from '../core/kinetic/interchange.ts';
import { cellCentre, cellNormal, kineticPathThrough } from './kinetic-geometry.ts';

export interface StationSymbol {
  readonly name: string;
  /** The same shape as a character, for the panel. */
  readonly char: string;
  /** Strokes in a unit circle, x right and y up: each a run of points. */
  readonly strokes: readonly (readonly (readonly [number, number])[])[];
}

type Stroke = (readonly [number, number])[];

function ring(points: number, radius: number, turn = 0): Stroke {
  const out: Stroke = [];
  for (let i = 0; i <= points; i++) {
    const angle = turn + (i / points) * Math.PI * 2;
    out.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return out;
}

function star(): Stroke {
  const out: Stroke = [];
  for (let i = 0; i <= 10; i++) {
    const angle = Math.PI / 2 + (i / 10) * Math.PI * 2;
    const radius = i % 2 === 0 ? 1 : 0.42;
    out.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return out;
}

function heart(): Stroke {
  const out: Stroke = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    out.push([x / 17, (y + 2.5) / 17]);
  }
  return out;
}

/**
 * Twelve, which is as many stations as the page will place. In the order they
 * are handed out, so that a maze with few stations gets the shapes that are
 * easiest to tell apart at a few millimetres.
 */
export const STATION_SYMBOLS: readonly StationSymbol[] = [
  { name: 'star', char: '☆', strokes: [star()] },
  { name: 'diamond', char: '◇', strokes: [ring(4, 1)] },
  { name: 'triangle', char: '△', strokes: [ring(3, 1, Math.PI / 2)] },
  { name: 'circle', char: '○', strokes: [ring(20, 0.9)] },
  { name: 'square', char: '□', strokes: [ring(4, 1.1, Math.PI / 4)] },
  { name: 'cross', char: '✕', strokes: [[[-0.8, -0.8], [0.8, 0.8]], [[-0.8, 0.8], [0.8, -0.8]]] },
  { name: 'nabla', char: '▽', strokes: [ring(3, 1, -Math.PI / 2)] },
  { name: 'heart', char: '♡', strokes: [heart()] },
  { name: 'hexagon', char: '⬡', strokes: [ring(6, 1, Math.PI / 6)] },
  { name: 'plus', char: '＋', strokes: [[[-1, 0], [1, 0]], [[0, -1], [0, 1]]] },
  { name: 'hourglass', char: '⧖', strokes: [[[-0.8, 0.9], [0.8, 0.9], [-0.8, -0.9], [0.8, -0.9], [-0.8, 0.9]]] },
  { name: 'bars', char: '≡', strokes: [
    [[-0.9, 0.7], [0.9, 0.7]], [[-0.9, 0], [0.9, 0]], [[-0.9, -0.7], [0.9, -0.7]],
  ] },
];

/** How much of the cell's inscribed circle a symbol fills. */
const SYMBOL_FILL = 0.62;

/**
 * A symbol drawn on a cell, as pairs of points in the piece's body frame.
 *
 * Sized to the circle the cell can hold, so it stays inside whatever the cell
 * is — a square of a cube, a triangle of a half cube — and stood up along the
 * cell's first side, which is the only direction a cell has.
 */
export function stationGlyph(cell: KineticCell, symbol: number): Vec3[] {
  const shape = STATION_SYMBOLS[symbol % STATION_SYMBOLS.length]!;
  const centre = cellCentre(cell);
  const normal = cellNormal(cell);
  const corners = cell.corners;
  const first = corners[0]!;
  const second = corners[1]!;
  const along = unit([second[0] - first[0], second[1] - first[1], second[2] - first[2]]);
  const up = cross(normal, along);

  let inradius = Infinity;
  for (let side = 0; side < corners.length; side++) {
    const a = corners[side]!;
    const b = corners[(side + 1) % corners.length]!;
    const edge = unit([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const to: Vec3 = [centre[0] - a[0], centre[1] - a[1], centre[2] - a[2]];
    const alongEdge = to[0] * edge[0] + to[1] * edge[1] + to[2] * edge[2];
    const away = Math.hypot(
      to[0] - edge[0] * alongEdge, to[1] - edge[1] * alongEdge, to[2] - edge[2] * alongEdge,
    );
    inradius = Math.min(inradius, away);
  }
  const size = inradius * SYMBOL_FILL;

  const at = ([x, y]: readonly [number, number]): Vec3 => [
    centre[0] + (along[0] * x + up[0] * y) * size,
    centre[1] + (along[1] * x + up[1] * y) * size,
    centre[2] + (along[2] * x + up[2] * y) * size,
  ];
  const pairs: Vec3[] = [];
  for (const stroke of shape.strokes) {
    for (let i = 1; i < stroke.length; i++) pairs.push(at(stroke[i - 1]!), at(stroke[i]!));
  }
  return pairs;
}

/** One walk of the route, as a line to trace in the shape it is walked in. */
export interface RouteLeg {
  /** The state of the mechanism the walk is made in. */
  readonly pose: number;
  /** The line, in the mechanism's coordinates for that state. One point if the shape is only folded through. */
  readonly points: readonly Vec3[];
  /** The outward normal of the surface under each point. */
  readonly normals: readonly Vec3[];
  /**
   * The cell the walk ends on, as the piece that carries it: where on that
   * piece, and which way is out, in the piece's own frame. The object is
   * folded with the point standing there, so through the fold the point goes
   * where that piece goes — which no line in either shape can say.
   */
  readonly endsOn: { readonly piece: number; readonly at: Vec3; readonly normal: Vec3 };
}

/**
 * The route of a maze as lines, a walk at a time.
 *
 * Each walk lies in one shape, so it is drawn in that shape's coordinates and
 * means nothing in any other: the cubes it crosses are somewhere else once
 * the object is folded.
 */
export function interchangeRouteLegs(
  mech: Mechanism,
  surface: KineticSurface,
  world: InterchangeWorld,
  maze: Pick<InterchangeMaze, 'open' | 'route'>,
): RouteLeg[] {
  return maze.route.map(leg => {
    const pose = world.lines[leg.line]!;
    const state = mech.states[pose]!;
    // Which side each cell is entered through: the open class the step crosses.
    const steps = new Map<string, number>();
    for (const edge of surface.adjOfState(pose)) {
      if (!maze.open.has(edge.classId)) continue;
      steps.set(`${edge.a}:${edge.b}`, edge.classId);
      steps.set(`${edge.b}:${edge.a}`, edge.classId);
    }
    const doorway = new Map<number, number>();
    for (let i = 1; i < leg.cells.length; i++) {
      const classId = steps.get(`${leg.cells[i - 1]}:${leg.cells[i]}`);
      if (classId !== undefined) doorway.set(leg.cells[i]!, classId);
    }
    const path = kineticPathThrough(mech, surface, pose, leg.cells, doorway);
    const normals = path.cells.map(index => {
      const cell = mech.cells[index]!;
      const placement = state[cell.piece]!;
      const origin = applyPlacement(placement, [0, 0, 0]);
      const tip = applyPlacement(placement, cellNormal(cell));
      return unit([tip[0] - origin[0], tip[1] - origin[1], tip[2] - origin[2]]);
    });
    const last = mech.cells[leg.cells[leg.cells.length - 1]!]!;
    return {
      pose,
      points: path.points,
      normals,
      endsOn: { piece: last.piece, at: cellCentre(last), normal: cellNormal(last) },
    };
  });
}

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
