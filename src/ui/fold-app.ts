/**
 * Wiring for the folding maze: mechanism -> search -> scene.
 *
 * The same shape as `kinetic-app.ts`, and for the same reason: the search is
 * a few seconds of solid arithmetic and the page has one thread, so it is run
 * a round at a time with the browser handed back in between. What is different
 * is how little there is to choose. The object is eight cubes taped one
 * particular way — the taping is a property of what folds, not a preference —
 * so the only inputs are the seed and which pose to look at.
 *
 * This is the first cut: the poses are switched, not folded into each other,
 * and there is no start or finish yet. Both are the next things to build; see
 * the note in `.dev/`.
 */

import { createRng } from '../core/prng.ts';
import { buildSurface } from '../core/kinetic/surface.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import { createInfinityCube } from '../core/kinetic/mechanisms/infinity-cube.ts';
import type { InfinityCubeMechanism } from '../core/kinetic/mechanisms/infinity-cube.ts';
import type { KineticDesign } from '../core/kinetic/maze.ts';
import { DEFAULT_SEARCH_EFFORT, createAllStatesSearch, stateStats } from '../core/kinetic/maze.ts';
import { buildKineticPieces } from '../render/kinetic-geometry.ts';
import { createFoldScene } from '../render/fold-scene.ts';
import { createFoldControls } from './fold-controls.ts';
import type { FoldPose } from './fold-controls.ts';

/**
 * Cells across one face of one cube.
 *
 * Three, because that is what the paper model is meant to be built at, and
 * because four is where the search stops being something to wait for: a design
 * that takes two to seven seconds at three takes fifteen at four, and comes
 * back empty three times in four.
 */
const CELLS_PER_FACE = 3;

/**
 * How long the search may go on, and in how many rounds.
 *
 * More generous than the default on both counts. The default budget is set so
 * that asking for something impossible is refused in about a second, which is
 * right on a page where most requests are answerable; here every request is a
 * hard one — six poses of a folding object, all of which must come out perfect
 * — and stopping at a second means never finding anything at all.
 */
const FOLD_EFFORT = DEFAULT_SEARCH_EFFORT * 12;
const FOLD_ROUNDS = 12;
const FOLD_RESTARTS = 4;

interface Build {
  mech: InfinityCubeMechanism;
  surface: KineticSurface;
  design: KineticDesign;
  poses: FoldPose[];
  perfectPoses: number;
  seed: number;
}

export function initFoldApp(viewportEl: HTMLElement, controlsEl: HTMLElement) {
  const scene = createFoldScene(viewportEl);
  const controls = createFoldControls(controlsEl);

  let build: Build | null = null;
  let poseIndex = 0;
  let seed = 1;
  /** Bumped by every rebuild, so an older search knows it has been overtaken. */
  let buildToken = 0;

  function show(next: Build) {
    build = next;
    poseIndex = 0;
    scene.setModel({
      pieces: buildKineticPieces(next.mech, next.surface, next.design),
      states: next.mech.states,
    });
    scene.setPose(poseIndex);
    scene.setAutoRotate(controls.isAutoRotating());
    controls.setPoses(next.poses, poseIndex);
    refreshPose();
  }

  function refreshPose() {
    if (!build) return;
    controls.setMetrics({
      poses: build.poses,
      poseIndex,
      perfectPoses: build.perfectPoses,
      seed: build.seed,
      cellsPerFace: build.mech.cellsPerFace,
    });
  }

  /**
   * Builds the object, then walks the search one round per frame.
   *
   * `token` stands in for cancellation: if anything starts a newer build, the
   * older loop finds its token stale and drops what it was doing.
   */
  function rebuild() {
    const token = ++buildToken;
    const mine = seed;
    controls.setBusy(true);
    controls.setStatus('Folding the ring...');
    controls.setProgress(0);

    // Let the browser paint that line before the thread disappears into the
    // first round, exactly as the kinetic page does.
    requestAnimationFrame(() => setTimeout(() => {
      if (token !== buildToken) return;
      const mech = createInfinityCube({ cells: CELLS_PER_FACE });
      const surface = buildSurface(mech, { maxStates: mech.states.length });
      const search = createAllStatesSearch(surface, {
        rng: createRng(mine),
        effort: FOLD_EFFORT,
        maxRounds: FOLD_ROUNDS,
        restarts: FOLD_RESTARTS,
      });
      controls.setStatus('Looking for a maze that survives every fold...');

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
        show({
          mech,
          surface,
          design: found.design,
          poses: describePoses(mech, surface, found.design),
          perfectPoses: found.rate.perfectStates.length,
          seed: mine,
        });
        controls.setProgress(null);
        controls.setBusy(false);
        const short = found.rate.rate < 1;
        controls.setStatus(
          short
            ? `Best found: a perfect maze in ${found.rate.perfectStates.length} of ` +
              `${surface.stateCount} poses. Try another maze.`
            : '',
        );
      };
      requestAnimationFrame(pump);
    }, 0));
  }

  controls.onPose(index => {
    poseIndex = index;
    scene.setPose(index);
    refreshPose();
  });

  controls.onAction('another', () => {
    seed++;
    rebuild();
  });

  controls.onAction('auto-rotate', () => scene.setAutoRotate(controls.isAutoRotating()));

  window.addEventListener('resize', () => scene.resize());
  rebuild();
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
