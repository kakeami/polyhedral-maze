/**
 * Wiring for the folding maze: mechanism -> design -> scene.
 *
 * Unlike the other two pages, this one does not search. Nothing about the
 * object varies — one taping, one ring, six poses — so the mazes were found
 * once, offline, and are read off the shelf here
 * (`core/kinetic/mechanisms/infinity-cube-designs.ts`). A search would be two
 * to seven seconds at three cells across a face and half a minute at four,
 * which is a wait nobody asked for and, at four, one most tries do not even
 * come back from.
 *
 * What is kept from the searching version is the check and the fallback. A
 * stored design is a set of class numbers, and class numbers mean whatever the
 * surface says they mean; so every design is verified as it is decoded — a
 * perfect maze in every pose, by the same arithmetic that would have judged a
 * fresh one — and if a design ever fails that, the page searches for one
 * instead of drawing something it cannot vouch for.
 *
 * This is the second cut: poses fold into one another now. There is still no
 * start or finish marker; that is next, and it is a question about where a
 * marker can go on an object that hides half of itself, not about this file.
 */

import { createRng } from '../core/prng.ts';
import { buildSurface } from '../core/kinetic/surface.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import { createInfinityCube } from '../core/kinetic/mechanisms/infinity-cube.ts';
import type { InfinityCubeMechanism } from '../core/kinetic/mechanisms/infinity-cube.ts';
import {
  INFINITY_CUBE_RULINGS, infinityCubeDesigns,
} from '../core/kinetic/mechanisms/infinity-cube-designs.ts';
import { decodeOpenClasses } from '../core/kinetic/stored-design.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import {
  DEFAULT_SEARCH_EFFORT, createAllStatesSearch, stateStats, treeRate,
} from '../core/kinetic/maze.ts';
import { buildFoldGraph } from '../core/kinetic/fold-path.ts';
import type { FoldGraph } from '../core/kinetic/fold-path.ts';
import { buildKineticPieces } from '../render/kinetic-geometry.ts';
import { createFoldScene } from '../render/fold-scene.ts';
import { createFoldControls } from './fold-controls.ts';
import type { FoldPose } from './fold-controls.ts';

/** Cells across one face of one cube, to open with: what the paper model is. */
const DEFAULT_CELLS = 3;

/**
 * What a search gets, on the rare occasion one is needed.
 *
 * More generous than the default on both counts. The default budget is set so
 * that asking for something impossible is refused in about a second, which is
 * right on a page where most requests are answerable; a request here is a hard
 * one — six poses of a folding object, all of which must come out perfect —
 * and stopping at a second would mean never finding anything at all.
 */
const FOLD_EFFORT = DEFAULT_SEARCH_EFFORT * 12;
const FOLD_ROUNDS = 12;
const FOLD_RESTARTS = 4;

interface Build {
  mech: InfinityCubeMechanism;
  surface: KineticSurface;
  graph: FoldGraph;
  design: KineticDesign;
  poses: FoldPose[];
  perfectPoses: number;
  /** Which of the stored mazes this is, counting from one; 0 when searched for. */
  maze: number;
  mazes: number;
}

/** Mechanism and surface, kept so that moving between mazes costs nothing. */
interface Ruling {
  mech: InfinityCubeMechanism;
  surface: KineticSurface;
  graph: FoldGraph;
}

export function initFoldApp(viewportEl: HTMLElement, controlsEl: HTMLElement) {
  const scene = createFoldScene(viewportEl);
  const controls = createFoldControls(controlsEl);

  const rulings = new Map<number, Ruling>();
  let build: Build | null = null;
  let cells = INFINITY_CUBE_RULINGS.includes(DEFAULT_CELLS)
    ? DEFAULT_CELLS
    : INFINITY_CUBE_RULINGS[0] ?? DEFAULT_CELLS;
  let maze = 0;
  let poseIndex = 0;
  /** Bumped by every rebuild, so an older search knows it has been overtaken. */
  let buildToken = 0;

  function rulingFor(next: number): Ruling {
    const had = rulings.get(next);
    if (had) return had;
    const mech = createInfinityCube({ cells: next });
    const made: Ruling = {
      mech,
      surface: buildSurface(mech, { maxStates: mech.states.length }),
      graph: buildFoldGraph(mech),
    };
    rulings.set(next, made);
    return made;
  }

  /**
   * The stored maze, if it still describes this surface.
   *
   * Two checks, and the second is the one that matters. The class count only
   * says the design is the right size; that it is a *perfect maze in every
   * pose* is asked of the geometry, exactly as it would be of a design found a
   * moment ago.
   */
  function storedDesign(ruling: Ruling, index: number): KineticDesign | null {
    const shelf = infinityCubeDesigns(ruling.mech.cellsPerFace);
    const stored = shelf[index % Math.max(1, shelf.length)];
    if (!stored || stored.classCount !== ruling.surface.classCount) return null;
    const design: KineticDesign = {
      open: decodeOpenClasses(stored),
      openCutClasses: [],
      targetState: 0,
    };
    return treeRate(ruling.surface, design).rate === 1 ? design : null;
  }

  function show(next: Build, keepPose: boolean) {
    build = next;
    const pose = keepPose ? Math.min(poseIndex, next.mech.states.length - 1) : 0;
    poseIndex = pose;
    scene.setModel({
      pieces: buildKineticPieces(next.mech, next.surface, next.design),
      states: next.mech.states,
      graph: next.graph,
    });
    // Cut to the pose rather than fold to it: the object on screen a moment ago
    // was a different maze, so there was no journey.
    scene.setPose(pose);
    scene.setAutoRotate(controls.isAutoRotating());
    controls.setPoses(next.poses, pose);
    refreshPose();
  }

  function refreshPose() {
    if (!build) return;
    controls.setMetrics({
      poses: build.poses,
      poseIndex,
      perfectPoses: build.perfectPoses,
      maze: build.maze,
      mazes: build.mazes,
      cellsPerFace: build.mech.cellsPerFace,
      searched: build.maze === 0,
    });
  }

  function buildFrom(ruling: Ruling, design: KineticDesign, index: number, mazes: number) {
    const rate = treeRate(ruling.surface, design);
    return {
      mech: ruling.mech,
      surface: ruling.surface,
      graph: ruling.graph,
      design,
      poses: describePoses(ruling.mech, ruling.surface, design),
      perfectPoses: rate.perfectStates.length,
      maze: index,
      mazes,
    };
  }

  /** Puts a maze on screen: off the shelf if it is there, searched for if not. */
  function rebuild(keepPose: boolean) {
    const token = ++buildToken;
    const ruling = rulingFor(cells);
    const shelf = infinityCubeDesigns(cells);
    const design = storedDesign(ruling, maze);
    if (design) {
      controls.setStatus('');
      controls.setProgress(null);
      controls.setBusy(false);
      show(buildFrom(ruling, design, (maze % shelf.length) + 1, shelf.length), keepPose);
      return;
    }
    searchInstead(ruling, token, keepPose);
  }

  /**
   * The fallback: find one here and now, a round at a time.
   *
   * Only reached if the stored mazes have stopped describing the object — a
   * change to how the surface is built, say. The page has one thread, so the
   * search is walked a round per frame with the browser handed back in
   * between, exactly as the kinetic page does it.
   */
  function searchInstead(ruling: Ruling, token: number, keepPose: boolean) {
    controls.setBusy(true);
    controls.setStatus('Looking for a maze that survives every fold...');
    controls.setProgress(0);
    requestAnimationFrame(() => setTimeout(() => {
      if (token !== buildToken) return;
      const search = createAllStatesSearch(ruling.surface, {
        rng: createRng(maze + 1),
        effort: FOLD_EFFORT,
        maxRounds: FOLD_ROUNDS,
        restarts: FOLD_RESTARTS,
      });
      const pump = () => {
        if (token !== buildToken) return;
        let done: boolean;
        try {
          done = search.step();
        } catch (error) {
          controls.setStatus(`The search gave up: ${(error as Error).message}`);
          controls.setProgress(null);
          controls.setBusy(false);
          return;
        }
        const progress = search.progress;
        if (!done) {
          const byRounds = progress.rounds / progress.maxRounds;
          const byPoses = progress.perfectStates / Math.max(1, progress.stateCount);
          controls.setProgress(Math.max(byRounds, byPoses * 0.9));
          controls.setStatus(
            `Round ${progress.rounds}: perfect in ${progress.perfectStates} of ` +
            `${progress.stateCount} poses so far...`,
          );
          requestAnimationFrame(pump);
          return;
        }
        const found = search.result();
        show(buildFrom(ruling, found.design, 0, 0), keepPose);
        controls.setProgress(null);
        controls.setBusy(false);
        controls.setStatus(
          found.rate.rate < 1
            ? `Best found: a perfect maze in ${found.rate.perfectStates.length} of ` +
              `${ruling.surface.stateCount} poses. Try another maze.`
            : '',
        );
      };
      requestAnimationFrame(pump);
    }, 0));
  }

  controls.onPose(index => {
    poseIndex = index;
    // Folded to, not cut to: the whole claim of the page is that these six
    // shapes are the same object, and a cut says nothing about that.
    scene.setPose(index, { animate: true });
  });

  controls.onRuling(next => {
    if (next === cells) return;
    cells = next;
    maze = 0;
    rebuild(true);
  });

  controls.onAction('another', () => {
    maze++;
    rebuild(true);
  });

  controls.onAction('auto-rotate', () => scene.setAutoRotate(controls.isAutoRotating()));

  // The numbers belong to the pose that is on screen, so they wait for the
  // folding to stop rather than describing a shape the object is passing
  // through.
  scene.onArrive(index => {
    poseIndex = index;
    refreshPose();
  });

  window.addEventListener('resize', () => scene.resize());
  controls.setRulings(INFINITY_CUBE_RULINGS, cells);
  rebuild(false);
}

/**
 * What to call each pose, and what the maze is like in it.
 *
 * The name is read off the object rather than stored: a pose whose eight cubes
 * span two lattice cells each way is a cube, and one that spans one by two by
 * four is a plank. Numbered in the order the mechanism found them, which is
 * the order the buttons stand in.
 */
function describePoses(
  mech: InfinityCubeMechanism,
  surface: KineticSurface,
  design: KineticDesign,
): FoldPose[] {
  let cubes = 0;
  let planks = 0;
  return mech.states.map((state, index) => {
    const span = [0, 1, 2]
      .map(axis => new Set(state.map(p => p.offset[axis]!.toFixed(1))).size)
      .sort((a, b) => a - b)
      .join('x');
    const label = span === '2x2x2' ? `Cube ${++cubes}` : `Plank ${++planks}`;
    const stats = stateStats(surface, design, index);
    return {
      label,
      cells: surface.visibleCount[index] ?? 0,
      passages: stats.edges,
      perfect: stats.perfect,
    };
  });
}
