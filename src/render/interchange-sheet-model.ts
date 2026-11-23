/**
 * The interchange maze, as something to cut out.
 *
 * The cubes, their nets, the tabs and the tape are the folding maze's, and
 * `fold-sheet-model.ts` draws them: an object is a layout and a taping, and
 * neither knows which maze is printed on it. What is said here is the rest —
 * the two things that make this the other maze.
 *
 * **The marks.** A start and a goal, one square each (the folding maze prints
 * each on two, so that one is outside in any shape; here a shape that hides
 * the start is simply not one the walk begins in), and a symbol on every
 * station. The symbols are the one thing printed on the model that is not
 * maze or the two letters, and they have to be: a station is where the ring
 * may be folded, and nothing but a mark on the square can say so. They are
 * the strokes the screen draws (`stationGlyph`), so a cube in the hand and
 * the picture of it agree about which way up a star stands.
 *
 * **The rule.** The folding maze's sheet says every shape is a perfect maze,
 * which here is false of every shape and not what is wanted of any. A maze in
 * which a wall is only a wall until the object is folded cannot be played
 * from the printing alone, so the first sheet says how it is: walk in the
 * shape it is in, fold on a mark and nowhere else. Only what is true of the
 * maze in hand is said — that a symbol leads off the way, when one does.
 *
 * No answer is printed (user's decision, 2026-11-23). The way from start to
 * goal crosses shapes, so it is not a line on any one drawing; the page plays
 * it.
 *
 * DOM-free, like the model it leans on.
 */

import type { CubeRingMechanism } from '../core/kinetic/mechanisms/cube-ring.ts';
import type { InterchangeMaze, InterchangeWorld } from '../core/kinetic/interchange.ts';
import { STATION_SYMBOLS, stationGlyph } from './interchange-geometry.ts';
import { buildCubeRingSheets, countWord, shapeKinds, shapesClause } from './fold-sheet-model.ts';
import type {
  CubeMarks, CubeRingNotes, CubeRingSheetOptions, CubeRingSheetPlan,
} from './fold-sheet-model.ts';

export type InterchangeSheetOptions = CubeRingSheetOptions;
export type InterchangeSheetPlan = CubeRingSheetPlan;

type PrintedMaze = Pick<InterchangeMaze, 'open' | 'start' | 'goal' | 'stations' | 'folds' | 'offRoute'>;

export function buildInterchangeSheets(
  mech: CubeRingMechanism,
  world: InterchangeWorld,
  maze: PrintedMaze,
  options: InterchangeSheetOptions = {},
): InterchangeSheetPlan {
  return buildCubeRingSheets(
    mech, world.surface, maze, interchangeMarks(mech, maze), interchangeNotes(mech, world, maze), options,
  );
}

/** What goes on the cubes beside the walls: the two letters, and a symbol a station. */
export function interchangeMarks(
  mech: CubeRingMechanism,
  maze: Pick<InterchangeMaze, 'start' | 'goal' | 'stations'>,
): CubeMarks {
  return {
    start: [maze.start],
    goal: [maze.goal],
    glyphs: maze.stations.map((cell, index) => ({
      cell,
      pairs: stationGlyph(mech.cells[cell]!, index),
    })),
  };
}

/**
 * What the first sheet says of the maze: where it is walked, how, and what
 * the marks are.
 *
 * Read off the object and the maze rather than written for the one object on
 * offer — which shapes are walked in is the world's to say, and whether a
 * symbol leads off the way is the maze's.
 */
export function interchangeNotes(
  mech: CubeRingMechanism,
  world: Pick<InterchangeWorld, 'lines'>,
  maze: Pick<InterchangeMaze, 'stations' | 'folds' | 'offRoute'>,
): CubeRingNotes {
  const walkedIn = new Set(world.lines);
  const walked = mech.poses.filter((_, state) => walkedIn.has(state)).map(pose => pose.label);
  const passed = mech.poses.filter((_, state) => !walkedIn.has(state)).map(pose => pose.label);
  const where = passed.length === 0
    ? 'The maze is walked in every one of them.'
    : `The maze is walked in ${countWord(walked.length)} of them, ${shapeKinds(walked, 'the')}; `
      + `${shapeKinds(passed, 'the')} ${passed.length === 1 ? 'is' : 'are'} only folded through.`;

  return {
    title: 'Interchange maze',
    sentences: [
      `${shapesClause(mech)} ${where}`,
      'Walk it with a finger, in whichever of those shapes the ring is in. On a mark — the S, the G '
        + 'or a symbol — and nowhere else, the ring may be folded into another of them that keeps the '
        + 'mark outside, the finger staying on it.',
      'There is exactly one way from S to G'
        + (maze.folds > 0 ? ', and it crosses shapes' : '')
        + ': start in any shape that shows the S, and finish in any that shows the G.'
        + (maze.offRoute > 0 ? ' Not every symbol is on the way.' : ''),
      'A part of a shape with no mark in it cannot be entered in that shape.',
    ],
    key: {
      label: maze.stations.length === 1 ? 'The symbol on this one:' : 'The symbols on this one:',
      symbols: maze.stations.map((_, index) => STATION_SYMBOLS[index % STATION_SYMBOLS.length]!.strokes),
    },
  };
}
