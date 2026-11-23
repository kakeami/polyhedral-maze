import { describe, it, expect } from 'vitest';
import { buildSurface } from '../kinetic/surface.ts';
import { poseDistances } from '../kinetic/fold-path.ts';
import { applyPlacement } from '../kinetic/types.ts';
import { createCubeRing } from '../kinetic/mechanisms/cube-ring.ts';
import { INFINITY_CUBE } from '../kinetic/mechanisms/cube-ring-objects.ts';
import { buildInterchangeWorld, findInterchangeMaze } from '../kinetic/interchange.ts';
import { walkedStates } from '../../ui/interchange-objects.ts';
import {
  buildKineticPieces, cellCentre, cellNormal, kineticSolutionPath,
} from '../../render/kinetic-geometry.ts';
import {
  STATION_SYMBOLS, interchangeRouteLegs, stationGlyph,
} from '../../render/interchange-geometry.ts';
import { INTERCHANGE_LIMITS } from '../../ui/interchange-param-codec.ts';

const mech = createCubeRing(INFINITY_CUBE, { cells: 3 });
const surface = buildSurface(mech, { maxStates: mech.states.length });
const world = buildInterchangeWorld(surface, walkedStates(mech), poseDistances(mech.foldGraph()));
const { maze } = findInterchangeMaze(world, { stations: 4, folds: 2, seed: 42 });

describe('the symbols stations are told apart by', () => {
  it('has one for every station the page will place, no two alike', () => {
    expect(STATION_SYMBOLS.length).toBeGreaterThanOrEqual(INTERCHANGE_LIMITS.maxStations);
    expect(new Set(STATION_SYMBOLS.map(symbol => symbol.char)).size).toBe(STATION_SYMBOLS.length);
    expect(new Set(STATION_SYMBOLS.map(symbol => symbol.name)).size).toBe(STATION_SYMBOLS.length);
  });

  it('has none that is another turned round, since a cube has no way up', () => {
    // A symbol is seen from whichever side the cube is held, so two that
    // differ by a quarter turn or a half are one symbol. (An eighth of a turn
    // is told by the lines of the cell: a diamond stands on a corner there.)
    const sample = (symbol: number, quarters: number): [number, number][] => {
      const cos = Math.round(Math.cos(quarters * Math.PI / 2));
      const sin = Math.round(Math.sin(quarters * Math.PI / 2));
      const points: [number, number][] = [];
      for (const stroke of STATION_SYMBOLS[symbol]!.strokes) {
        for (let i = 1; i < stroke.length; i++) {
          const [ax, ay] = stroke[i - 1]!;
          const [bx, by] = stroke[i]!;
          for (let k = 0; k <= 12; k++) {
            const x = ax + (bx - ax) * (k / 12);
            const y = ay + (by - ay) * (k / 12);
            points.push([x * cos - y * sin, x * sin + y * cos]);
          }
        }
      }
      return points;
    };
    const farthest = (from: [number, number][], to: [number, number][]): number =>
      Math.max(...from.map(p => Math.min(...to.map(q => Math.hypot(p[0] - q[0], p[1] - q[1])))));
    for (let a = 0; a < STATION_SYMBOLS.length; a++) {
      for (let b = a + 1; b < STATION_SYMBOLS.length; b++) {
        for (let quarters = 0; quarters < 4; quarters++) {
          const one = sample(a, quarters);
          const other = sample(b, 0);
          const apart = Math.max(farthest(one, other), farthest(other, one));
          // In units of the symbol's own radius.
          expect(apart, `${STATION_SYMBOLS[a]!.name} / ${STATION_SYMBOLS[b]!.name}`).toBeGreaterThan(0.09);
        }
      }
    }
  });

  it('draws each inside its cell, flat on it', () => {
    const cell = mech.cells[maze.stations[0]!]!;
    const centre = cellCentre(cell);
    const normal = cellNormal(cell);
    // A square of side a third: anything further than a sixth from the middle,
    // measured along either side, is in the next cell.
    const half = 1 / 6;
    STATION_SYMBOLS.forEach((_, symbol) => {
      const pairs = stationGlyph(cell, symbol);
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs.length % 2).toBe(0);
      for (const point of pairs) {
        const d = [point[0] - centre[0], point[1] - centre[1], point[2] - centre[2]];
        expect(Math.abs(d[0]! * normal[0] + d[1]! * normal[1] + d[2]! * normal[2])).toBeLessThan(1e-9);
        for (const part of d) expect(Math.abs(part)).toBeLessThan(half);
      }
    });
  });

  it('puts a pin on the start, the goal and every station', () => {
    const pieces = buildKineticPieces(
      mech, surface, maze, { start: maze.start, goal: maze.goal }, { stations: maze.stations },
    );
    const kinds = new Map<number, string>();
    for (const piece of pieces) {
      piece.markers.forEach((marker, i) => kinds.set(piece.markerCells[i]!, marker.kind));
    }
    expect(kinds.get(maze.start)).toBe('start');
    expect(kinds.get(maze.goal)).toBe('goal');
    for (const cell of maze.stations) expect(kinds.get(cell)).toBe('station');
    expect(kinds.size).toBe(2 + maze.stations.length);
  });
});

describe('the route as lines to trace', () => {
  const legs = interchangeRouteLegs(mech, surface, world, maze);

  it('is one line a walk, in the shape the walk is made in', () => {
    expect(legs).toHaveLength(maze.route.length);
    legs.forEach((leg, i) => {
      const walk = maze.route[i]!;
      expect(leg.pose).toBe(world.lines[walk.line]);
      expect(leg.normals).toHaveLength(leg.points.length);
      const state = mech.states[leg.pose]!;
      const at = (index: number) => {
        const cell = mech.cells[index]!;
        return applyPlacement(state[cell.piece]!, cellCentre(cell));
      };
      const first = at(walk.cells[0]!);
      const last = at(walk.cells.at(-1)!);
      for (let axis = 0; axis < 3; axis++) {
        expect(leg.points[0]![axis]).toBeCloseTo(first[axis]!, 9);
        expect(leg.points.at(-1)![axis]).toBeCloseTo(last[axis]!, 9);
      }
      for (const normal of leg.normals) expect(Math.hypot(...normal)).toBeCloseTo(1, 9);
    });
  });

  it('stays on the surface: no step longer than a cell', () => {
    for (const leg of legs) {
      for (let i = 1; i < leg.points.length; i++) {
        const a = leg.points[i - 1]!;
        const b = leg.points[i]!;
        expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])).toBeLessThanOrEqual(1 / 3 + 1e-9);
      }
    }
  });

  it('meets itself across a fold: the same cell, in two shapes', () => {
    for (let i = 1; i < maze.route.length; i++) {
      expect(maze.route[i]!.cells[0]).toBe(maze.route[i - 1]!.cells.at(-1));
    }
  });

  it('says what each walk ends on, so the point can ride the fold', () => {
    // The point stands on a cell while the object is folded under it. Put on
    // the piece that carries that cell, it must be where the walk left it
    // before the fold, and where the next walk picks it up after.
    const placed = (pose: number, piece: number, v: readonly [number, number, number]) =>
      applyPlacement(mech.states[pose]![piece]!, v);
    legs.forEach((leg, i) => {
      const { piece, at, normal } = leg.endsOn;
      expect(piece).toBe(mech.cells[maze.route[i]!.cells.at(-1)!]!.piece);
      const here = placed(leg.pose, piece, at);
      const origin = placed(leg.pose, piece, [0, 0, 0]);
      const tip = placed(leg.pose, piece, normal);
      for (let axis = 0; axis < 3; axis++) {
        expect(here[axis]).toBeCloseTo(leg.points.at(-1)![axis]!, 9);
        expect(tip[axis]! - origin[axis]!).toBeCloseTo(leg.normals.at(-1)![axis]!, 9);
      }
      const next = legs[i + 1];
      if (!next) return;
      const there = placed(next.pose, piece, at);
      const originThere = placed(next.pose, piece, [0, 0, 0]);
      const tipThere = placed(next.pose, piece, normal);
      for (let axis = 0; axis < 3; axis++) {
        expect(there[axis]).toBeCloseTo(next.points[0]![axis]!, 9);
        expect(tipThere[axis]! - originThere[axis]!).toBeCloseTo(next.normals[0]![axis]!, 9);
      }
    });
  });

  it('leaves the one-shape route exactly as it was', () => {
    // `kineticSolutionPath` was split to share its line-drawing; within one
    // shape it must still give the line it gave.
    const walk = maze.route.find(leg => leg.cells.length > 1)!;
    const pose = world.lines[walk.line]!;
    const whole = kineticSolutionPath(mech, surface, maze, pose, {
      start: walk.cells[0]!, goal: walk.cells.at(-1)!,
    });
    expect(whole).toEqual(legs[maze.route.indexOf(walk)]!.points);
  });
});
