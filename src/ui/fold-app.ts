/**
 * Wiring for the folding maze: mechanism -> design -> scene.
 *
 * A maze is named by a ruling and a seed, exactly as on the polyhedral page,
 * and found by searching for it (`maze-contracted.ts`, about a second at any
 * ruling on offer). The first few seeds at every ruling come with the page
 * (`core/kinetic/mechanisms/infinity-cube-designs.ts`) so that opening it, and
 * dragging the ruling slider, never waits for anything; every other seed is
 * searched for here, a round at a time with the browser handed back in
 * between.
 *
 * A stored design is a set of class numbers, and class numbers mean whatever
 * the surface says they mean, so every one is verified as it is decoded — a
 * perfect maze in every pose, by the same arithmetic that would have judged a
 * fresh one — and a design that fails is searched for instead of drawn.
 *
 * The markers are the one thing this page cannot lift from the other two.
 * There is nowhere on a ring of cubes to print an entrance that is on show
 * however the thing is folded, so each marker goes on a *pair* of cells that
 * are on show one at a time (`pickPrintedEnds`): one entrance and one exit are
 * visible in every pose, and which two they are changes as it folds. The route
 * between them is redrawn on arrival, and only then — mid-fold it would be a
 * route through a shape the object is only passing through.
 */

import { createRng } from '../core/prng.ts';
import { buildSurface } from '../core/kinetic/surface.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import { createInfinityCube } from '../core/kinetic/mechanisms/infinity-cube.ts';
import type { InfinityCubeMechanism } from '../core/kinetic/mechanisms/infinity-cube.ts';
import {
  INFINITY_CUBE_RULINGS, infinityCubeDesign,
} from '../core/kinetic/mechanisms/infinity-cube-designs.ts';
import { decodeOpenClasses } from '../core/kinetic/stored-design.ts';
import type { KineticDesign, PrintedEnds } from '../core/kinetic/maze.ts';
import { longestWalk, pickPrintedEnds, stateStats, treeRate } from '../core/kinetic/maze.ts';
import { createContractedSearch } from '../core/kinetic/maze-contracted.ts';
import { buildFoldGraph } from '../core/kinetic/fold-path.ts';
import type { FoldGraph } from '../core/kinetic/fold-path.ts';
import {
  buildKineticPieces, kineticSolutionPath, kineticWalls, solutionLength,
} from '../render/kinetic-geometry.ts';
import { exportFoldPDF } from '../render/pdf-kinetic-sheets.ts';
import { createFoldScene } from '../render/fold-scene.ts';
import { createFoldControls } from './fold-controls.ts';
import type { FoldPose } from './fold-controls.ts';
import {
  FOLD_LIMITS, decodeFoldParams, encodeFoldParams, randomSeed,
} from './fold-param-codec.ts';
import type { FoldParams } from './fold-param-codec.ts';
import { SCENE_PRESETS } from '../render/scene-presets.ts';

interface Build {
  mech: InfinityCubeMechanism;
  surface: KineticSurface;
  graph: FoldGraph;
  design: KineticDesign;
  /** Where the two markers are printed, and which of each is out per pose. */
  ends: PrintedEnds;
  poses: FoldPose[];
  perfectPoses: number;
  /** The seed this maze is, and whether it came off the cache. */
  seed: number;
  cached: boolean;
}

/** Mechanism and surface, kept so that moving between mazes costs nothing. */
interface Ruling {
  mech: InfinityCubeMechanism;
  surface: KineticSurface;
  graph: FoldGraph;
}

export function initFoldApp(viewportEl: HTMLElement, controlsEl: HTMLElement) {
  const opening = decodeFoldParams(window.location.search);
  const scene = createFoldScene(viewportEl, opening.style);
  const controls = createFoldControls(controlsEl, opening);

  const rulings = new Map<number, Ruling>();
  let build: Build | null = null;
  let cells = opening.cells;
  let seed = opening.seed;
  let poseIndex = opening.pose;
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
  function storedDesign(ruling: Ruling, wanted: number): KineticDesign | null {
    const stored = infinityCubeDesign(ruling.mech.cellsPerFace, wanted);
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
      pieces: buildKineticPieces(next.mech, next.surface, next.design, next.ends),
      states: next.mech.states,
      graph: next.graph,
      // What each pose has on its surface. The pieces carry every wall, as the
      // paper does; a pose that presses two cubes together does not.
      wallsByPose: next.mech.states.map((_, state) =>
        kineticWalls(next.mech, next.surface, next.design, next.surface.visibleOfState(state))),
    });
    // Cut to the pose rather than fold to it: the object on screen a moment ago
    // was a different maze, so there was no journey.
    scene.setPose(pose);
    scene.setAutoRotate(controls.isAutoRotating());
    scene.setAutoFold(controls.isAutoFolding());
    controls.setPoses(next.poses, pose);
    controls.setSeed(next.seed, next.cached);
    refreshPose();
    syncUrl();
  }

  /** The route and the numbers for whichever pose the object has landed in. */
  function syncUrl() {
    history.replaceState(null, '', encodeFoldParams(currentParams()) || window.location.pathname);
  }

  /** The panel as it stands, with the things the panel does not hold. */
  function currentParams(): FoldParams {
    return { ...controls.getParams(), cells, seed, pose: poseIndex };
  }

  function refreshPose() {
    if (!build) return;
    const { mech, surface, design, ends } = build;
    const here = ends.byState[poseIndex] ?? ends.byState[0]!;
    // Read from the panel rather than from the build: whether the answer is on
    // screen is a switch the visitor holds, and it outlives any one pose.
    scene.setSolution(
      controls.isShowingSolution()
        ? kineticSolutionPath(mech, surface, design, poseIndex, here)
        : null,
    );
    controls.setMetrics({
      poses: build.poses,
      poseIndex,
      perfectPoses: build.perfectPoses,
      cellsPerFace: mech.cellsPerFace,
      solutionLength: solutionLength(surface, design, poseIndex, here),
      searched: !build.cached,
    });
  }

  function buildFrom(ruling: Ruling, design: KineticDesign, from: number, cached: boolean) {
    const rate = treeRate(ruling.surface, design);
    return {
      mech: ruling.mech,
      surface: ruling.surface,
      graph: ruling.graph,
      design,
      ends: pickPrintedEnds(ruling.surface, design),
      poses: describePoses(ruling.mech, ruling.surface, design),
      perfectPoses: rate.perfect,
      seed: from,
      cached,
    };
  }

  /** Puts a maze on screen: off the cache if it is there, searched for if not. */
  function rebuild(keepPose: boolean) {
    const token = ++buildToken;
    const ruling = rulingFor(cells);
    const design = storedDesign(ruling, seed);
    if (design) {
      controls.setStatus('');
      controls.setProgress(null);
      controls.setBusy(false);
      show(buildFrom(ruling, design, seed, true), keepPose);
      return;
    }
    searchInstead(ruling, token, keepPose);
  }

  /**
   * Find one here and now, an attempt at a time.
   *
   * The ordinary way to get a maze this page does not already have: any seed
   * beyond the few that ship with it. The page has one thread, so the search
   * is walked an attempt per frame with the browser handed back in between,
   * exactly as the kinetic page does it. An attempt is half a second to a
   * second, and usually the first one is enough.
   */
  function searchInstead(ruling: Ruling, token: number, keepPose: boolean) {
    controls.setBusy(true);
    controls.setStatus('Looking for a maze that survives every fold...');
    controls.setProgress(0);
    requestAnimationFrame(() => setTimeout(() => {
      if (token !== buildToken) return;
      const wanted = seed;
      // The budget is the search's own: an attempt is a few hundred
      // milliseconds, three to five is the usual number, and the ceiling is
      // there for the unlucky seed rather than for the hard ruling.
      const search = createContractedSearch(ruling.surface, { rng: createRng(wanted) });
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
            `Attempt ${progress.rounds}: perfect in ${progress.perfectStates} of ` +
            `${progress.stateCount} poses so far...`,
          );
          requestAnimationFrame(pump);
          return;
        }
        const found = search.result();
        show(buildFrom(ruling, found.design, wanted, false), keepPose);
        controls.setProgress(null);
        controls.setBusy(false);
        controls.setStatus(
          found.rate.rate < 1
            ? `Best found: a perfect maze in ${found.rate.perfect} of ` +
              `${ruling.surface.stateCount} poses. Shuffle for another seed.`
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
    // And then left alone with it. Asking for a pose and being folded away
    // from it a moment later would make the object feel like it was ignoring
    // the question.
    scene.holdAutoFold();
  });

  controls.onRuling(next => {
    if (next === cells) return;
    cells = next;
    // The seed carries over. A maze at one ruling has nothing to do with the
    // maze at another, but a seed is a name rather than a description, and
    // keeping it is what makes this slider feel like one control rather than
    // two: the object gets finer, and nothing else was asked for.
    rebuild(true);
    scene.holdAutoFold();
  });

  controls.onSeed(next => {
    if (next === seed) return;
    seed = next;
    rebuild(true);
    scene.holdAutoFold();
  });

  controls.onAction('shuffle-seed', () => {
    seed = randomSeed();
    rebuild(true);
    scene.holdAutoFold();
  });

  // Everything that describes the object, plus where it is standing and what
  // it is made of — but not the three switches, which are how the visitor has
  // decided to look at it rather than what they are looking at.
  controls.onAction('shuffle-all', () => {
    const rulings = INFINITY_CUBE_RULINGS;
    cells = rulings[Math.floor(Math.random() * rulings.length)] ?? cells;
    seed = randomSeed();
    poseIndex = Math.floor(Math.random() * FOLD_LIMITS.poses);
    const style = SCENE_PRESETS[Math.floor(Math.random() * SCENE_PRESETS.length)];
    if (style) {
      controls.setStyle(style.id);
      scene.setPreset(style.id);
    }
    controls.setRulings(rulings, cells);
    // Keeping the pose, because the pose is one of the things just shuffled.
    // `rebuild(false)` would go back to the first shape and undo it.
    rebuild(true);
    scene.holdAutoFold();
  });

  controls.onAction('solution', () => {
    refreshPose();
    syncUrl();
  });

  controls.onAction('style', () => {
    scene.setPreset(controls.style());
    syncUrl();
  });

  controls.onAction('copy-url', () => {
    const url = window.location.origin + window.location.pathname
      + encodeFoldParams(currentParams());
    navigator.clipboard.writeText(url).then(
      () => controls.showToast('URL copied'),
      () => controls.showToast('Could not copy the URL'),
    );
  });

  // The pattern is nine sheets and takes a moment to draw, so the button says
  // so before the work starts rather than after it.
  controls.onAction('export-pdf', () => {
    if (!build) return;
    const { mech, surface, design, ends, seed: from } = build;
    controls.setExportBusy(true);
    setTimeout(() => {
      try {
        const plan = exportFoldPDF(mech, surface, design, from, { ends });
        controls.showToast(
          `${plan.sheets.length} sheets — eight cubes ${plan.edgeMm.toFixed(0)} mm on a side, ` +
          `folding into a ${plan.cubeMm.toFixed(0)} mm cube`,
        );
      } catch (error) {
        controls.showToast(`Export failed: ${(error as Error).message}`);
      } finally {
        controls.setExportBusy(false);
      }
    }, 0);
  });

  controls.onAction('auto-rotate', () => {
    scene.setAutoRotate(controls.isAutoRotating());
    syncUrl();
  });

  controls.onAction('auto-fold', () => {
    scene.setAutoFold(controls.isAutoFolding());
    syncUrl();
  });

  // The numbers belong to the pose that is on screen, so they wait for the
  // folding to stop rather than describing a shape the object is passing
  // through.
  scene.onArrive(index => {
    poseIndex = index;
    controls.setPose(index);
    refreshPose();
    // Including the poses it folds itself into: the URL is what is on screen,
    // and the object moves on its own.
    syncUrl();
  });

  window.addEventListener('resize', () => scene.resize());
  controls.setRulings(INFINITY_CUBE_RULINGS, cells);
  // Opened in the pose the link asked for, and cut to it rather than folded:
  // there is nothing to have come from.
  rebuild(true);
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
      longestWalk: longestWalk(surface, design, index),
      perfect: stats.perfect,
    };
  });
}
