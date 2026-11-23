import { describe, it, expect } from 'vitest';
import { buildSurface } from '../kinetic/surface.ts';
import { poseDistances } from '../kinetic/fold-path.ts';
import { createCubeRing } from '../kinetic/mechanisms/cube-ring.ts';
import { INFINITY_CUBE } from '../kinetic/mechanisms/cube-ring-objects.ts';
import {
  buildInterchangeWorld, checkInterchange, createInterchangeSearch, findInterchangeMaze,
} from '../kinetic/interchange.ts';
import type { InterchangeMaze, InterchangeWorld } from '../kinetic/interchange.ts';
import { walkedStates } from '../../ui/interchange-objects.ts';

function worldAt(cells: number): { world: InterchangeWorld; labels: string[] } {
  const mech = createCubeRing(INFINITY_CUBE, { cells });
  const surface = buildSurface(mech, { maxStates: mech.states.length });
  const lines = walkedStates(mech);
  return {
    world: buildInterchangeWorld(surface, lines, poseDistances(mech.foldGraph())),
    labels: lines.map(state => mech.poses[state]!.label),
  };
}

/** The route, walked: every step through an open side, every fold on a mark. */
function routeHolds(world: InterchangeWorld, maze: InterchangeMaze): boolean {
  const cellCount = world.surface.cellCount;
  const walks = new Set<string>();
  for (const classId of maze.open) {
    const edges = world.classEdges[classId]!;
    for (let i = 0; i < edges.length; i += 2) walks.add(`${edges[i]}:${edges[i + 1]}`);
  }
  const marks = new Set<number>([maze.start, maze.goal, ...maze.stations]);
  const folds = new Set(world.transfers.flatMap(([a, b]) => [`${a}:${b}`, `${b}:${a}`]));
  const { route } = maze;
  if (route.length === 0) return false;
  if (route[0]!.cells[0] !== maze.start || route.at(-1)!.cells.at(-1) !== maze.goal) return false;
  for (let i = 0; i < route.length; i++) {
    const leg = route[i]!;
    for (const cell of leg.cells) if (!world.visible[leg.line]![cell]) return false;
    for (let j = 1; j < leg.cells.length; j++) {
      const a = leg.line * cellCount + Math.min(leg.cells[j - 1]!, leg.cells[j]!);
      const b = leg.line * cellCount + Math.max(leg.cells[j - 1]!, leg.cells[j]!);
      if (!walks.has(`${a}:${b}`)) return false;
    }
    if (i === 0) continue;
    const before = route[i - 1]!;
    const on = before.cells.at(-1)!;
    if (leg.cells[0] !== on || !marks.has(on) || !folds.has(`${before.line}:${leg.line}`)) return false;
  }
  return true;
}

describe('the infinity cube as an interchange maze', () => {
  it('is walked in six shapes, folded between round a ring', () => {
    const { world, labels } = worldAt(2);
    expect(labels.map(label => label.replace(/ \d+$/, '')).sort())
      .toEqual(['Cube', 'Cube', 'Plank', 'Plank', 'Plank', 'Plank']);
    expect(world.transfers).toHaveLength(6);
    // Each shape folds to exactly two others: a ring, with no way across it.
    const ends = new Array(6).fill(0);
    for (const [a, b] of world.transfers) { ends[a]++; ends[b]++; }
    expect(ends).toEqual([2, 2, 2, 2, 2, 2]);
    // Every cell is on show in some shape, and none in all six: a mark seen
    // all the way round would let a finger go round without a step.
    expect(world.shownCells).toBe(world.surface.cellCount);
    for (let cell = 0; cell < world.surface.cellCount; cell++) {
      const shownIn = world.visible.filter(row => row[cell]).length;
      expect(shownIn).toBeGreaterThanOrEqual(2);
      expect(shownIn).toBeLessThanOrEqual(4);
    }
  });

  it('makes what it is asked for: a tree of places, a route, a station off it', () => {
    for (const cells of [2, 3, 4]) {
      const { world } = worldAt(cells);
      for (const seed of [42, 1, 2, 3]) {
        const { maze, exact } = findInterchangeMaze(world, { stations: 3, folds: 2, seed });
        expect(exact).toBe(true);
        expect(checkInterchange(world, maze)).toEqual({
          forest: true, tree: true, marksReached: true, covered: true,
        });
        expect(maze.covered).toBe(true);
        expect(maze.stations).toHaveLength(3);
        expect(maze.folds).toBe(2);
        expect(maze.offRoute).toBeGreaterThanOrEqual(1);
        expect(maze.route).toHaveLength(3);
        expect(maze.steps).toBe(maze.route.reduce((sum, leg) => sum + leg.cells.length - 1, 0));
        expect(routeHolds(world, maze)).toBe(true);
        // No two marks on one cell.
        expect(new Set([maze.start, maze.goal, ...maze.stations]).size).toBe(5);
      }
    }
  });

  it('is the same maze from the same seed', () => {
    const { world } = worldAt(3);
    const a = findInterchangeMaze(world, { stations: 4, folds: 2, seed: 7 }).maze;
    const b = findInterchangeMaze(world, { stations: 4, folds: 2, seed: 7 }).maze;
    expect([...a.open].sort((x, y) => x - y)).toEqual([...b.open].sort((x, y) => x - y));
    expect([a.start, a.goal, ...a.stations]).toEqual([b.start, b.goal, ...b.stations]);
    const other = findInterchangeMaze(world, { stations: 4, folds: 2, seed: 8 }).maze;
    expect([...other.open].sort((x, y) => x - y)).not.toEqual([...a.open].sort((x, y) => x - y));
  });

  it('gives the nearest thing when what was asked for is not there', () => {
    // Two squares a face has room for five or six stations, not twelve.
    const { world } = worldAt(2);
    const search = createInterchangeSearch(world, { stations: 12, folds: 2, seed: 42, maxAttempts: 40 });
    while (!search.step()) { /* to the end */ }
    const { maze, exact, attempts } = search.result();
    expect(exact).toBe(false);
    expect(attempts).toBe(40);
    expect(maze.stations.length).toBeLessThan(12);
    // Short of what was asked, and still a maze: the conditions are kept, not found.
    const check = checkInterchange(world, maze);
    expect(check.forest).toBe(true);
    expect(check.tree).toBe(true);
    expect(check.marksReached).toBe(true);
    expect(routeHolds(world, maze)).toBe(true);
  });

  it('holds its three conditions whatever comes out', () => {
    const { world } = worldAt(3);
    for (let seed = 100; seed < 130; seed++) {
      const { maze } = findInterchangeMaze(world, {
        stations: 2 + (seed % 6), folds: 1 + (seed % 4), seed, maxAttempts: 30,
      });
      const check = checkInterchange(world, maze);
      expect(check.forest).toBe(true);
      expect(check.tree).toBe(true);
      expect(check.marksReached).toBe(true);
      expect(check.covered).toBe(maze.covered);
      expect(routeHolds(world, maze)).toBe(true);
    }
  });
});
