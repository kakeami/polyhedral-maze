/**
 * Wiring for the folding maze: object -> mechanism -> design -> scene.
 *
 * A maze is named by an object, a ruling and a seed, much as the polyhedral
 * page names one by a solid, a ruling and a seed, and found by searching for
 * it (`maze-contracted.ts`, about a second at any ruling on offer). The first
 * few seeds at every ruling come with the page
 * (`core/kinetic/mechanisms/cube-ring-designs.ts`) so that opening it, and
 * dragging the ruling slider, never waits for anything; every other seed is
 * searched for here, a round at a time with the browser handed back in
 * between.
 *
 * The objects are rings of hinged cubes and differ in how many and how taped
 * (`cube-ring-objects.ts`); everything else about them — how many shapes they
 * shut into, which ones a hand can fold between, what is buried in each — is
 * geometry, so this file never names a shape or counts one.
 *
 * A stored design is a set of class numbers, and class numbers mean whatever
 * the surface says they mean, so every one is verified as it is decoded — a
 * perfect maze in every pose, by the same arithmetic that would have judged a
 * fresh one — and a design that fails is searched for instead of drawn.
 *
 * The markers are the one thing this page cannot lift from the other two.
 * There is nowhere on a ring of cubes to print an entrance that is on show
 * however the thing is folded — not even on an object that keeps some squares
 * out in every shape, since none of those is reliably a dead end — so each
 * marker goes on a *pair* of cells that are on show one at a time
 * (`pickPrintedEnds`): one entrance and one exit are visible in every pose,
 * and which two they are changes as it folds. The route between them is
 * redrawn on arrival, and only then — mid-fold it would be a route through a
 * shape the object is only passing through.
 */

import { createRng } from '../core/prng.ts';
import { buildSurface } from '../core/kinetic/surface.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import {
  FOLD_OBJECTS, createFoldMechanism, foldObject, foldRulings, isCubeRingMechanism, isPrismRing,
} from './fold-objects.ts';
import type { FoldMechanism, FoldObject } from './fold-objects.ts';
import { cubeRingDesign } from '../core/kinetic/mechanisms/cube-ring-designs.ts';
import { decodeOpenClasses } from '../core/kinetic/stored-design.ts';
import type { KineticDesign, PrintedEnds } from '../core/kinetic/maze.ts';
import { longestWalk, pickPrintedEnds, stateStats, treeRate } from '../core/kinetic/maze.ts';
import { createContractedSearch } from '../core/kinetic/maze-contracted.ts';
import type { FoldGraph } from '../core/kinetic/fold-path.ts';
import {
  buildKineticPieces, kineticSolutionPath, kineticWalls, solutionLength,
} from '../render/kinetic-geometry.ts';
import { exportFoldPDF, exportHoneycombPDF } from '../render/pdf-kinetic-sheets.ts';
import { createFoldScene } from '../render/fold-scene.ts';
import { createFoldControls } from './fold-controls.ts';
import type { FoldPose } from './fold-controls.ts';
import { decodeFoldParams, encodeFoldParams, randomSeed } from './fold-param-codec.ts';
import type { FoldParams } from './fold-param-codec.ts';
import { SCENE_PRESETS } from '../render/scene-presets.ts';

interface Build {
  mech: FoldMechanism;
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
  mech: FoldMechanism;
  surface: KineticSurface;
  graph: FoldGraph;
}

export function initFoldApp(viewportEl: HTMLElement, controlsEl: HTMLElement) {
  const opening = decodeFoldParams(window.location.search);
  const scene = createFoldScene(viewportEl, opening.style);
  const controls = createFoldControls(controlsEl, opening);

  // Keyed by object and ruling both: a visitor who tries the other object and
  // comes back should find what they left, and each of these is a surface
  // rather than a number.
  const rulings = new Map<string, Ruling>();
  let build: Build | null = null;
  let object: FoldObject = foldObject(opening.object);
  let cells = opening.cells;
  let seed = opening.seed;
  let poseIndex = opening.pose;
  /** Bumped by every rebuild, so an older search knows it has been overtaken. */
  let buildToken = 0;

  function rulingFor(next: number): Ruling {
    const key = `${object.id}:${next}`;
    const had = rulings.get(key);
    if (had) return had;
    const mech = createFoldMechanism(object, { cells: next });
    const made: Ruling = {
      mech,
      surface: buildSurface(mech, { maxStates: mech.states.length }),
      // Worked out once per object rather than once per ruling: which shapes
      // it folds between has nothing to do with how finely it is ruled.
      graph: mech.foldGraph(),
    };
    rulings.set(key, made);
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
    // Only the rings of cubes have a shelf of mazes; a ring of prisms is
    // searched for, which takes a few milliseconds at any ruling it offers.
    const stored = isPrismRing(ruling.mech.object)
      ? null
      : cubeRingDesign(ruling.mech.object.id, ruling.mech.cellsPerFace, wanted);
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
    return { ...controls.getParams(), object: object.id, cells, seed, pose: poseIndex };
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

  // A different object is a different everything — different shapes, a
  // different number of them, a different surface — so the maze is found
  // again. The seed carries over, for the same reason it does across rulings:
  // it is a name rather than a description of any one object.
  controls.onObject(next => {
    if (next === object.id) return;
    object = foldObject(next);
    cells = nearestRulingOf(object, cells);
    controls.setRulings(foldRulings(object), cells);
    showExport();
    rebuild(false);
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
    object = FOLD_OBJECTS[Math.floor(Math.random() * FOLD_OBJECTS.length)] ?? object;
    const rulings = foldRulings(object);
    cells = rulings[Math.floor(Math.random() * rulings.length)] ?? cells;
    seed = randomSeed();
    poseIndex = Math.floor(Math.random() * rulingFor(cells).mech.states.length);
    const style = SCENE_PRESETS[Math.floor(Math.random() * SCENE_PRESETS.length)];
    if (style) {
      controls.setStyle(style.id);
      scene.setPreset(style.id);
    }
    controls.setObject(object.id);
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

  /**
   * What the pattern button says, which the object decides.
   *
   * Both kinds print one piece a sheet and a sheet of notes in front, and both
   * print the piece as large as a sheet holds — a cube at 58 mm a side, a
   * prism at 43 — so the button only has to name what comes out.
   */
  function showExport() {
    controls.setExport({
      enabled: true,
      label: isPrismRing(object) ? 'Export prisms PDF' : 'Export cubes PDF',
    });
  }

  // The pattern is a sheet a piece and takes a moment to draw, so the button
  // says so before the work starts rather than after it.
  controls.onAction('export-pdf', () => {
    if (!build) return;
    const { mech, surface, design, ends, seed: from } = build;
    controls.setExportBusy(true);
    setTimeout(() => {
      try {
        const plan = isCubeRingMechanism(mech)
          ? exportFoldPDF(mech, surface, design, from, { ends })
          : exportHoneycombPDF(mech, surface, design, from, { ends });
        controls.showToast(
          `${plan.sheets.length} sheets — ${mech.pieceCount} ` +
          `${isCubeRingMechanism(mech) ? 'cubes' : 'prisms'} ` +
          `${plan.edgeMm.toFixed(0)} mm on a side`,
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
  controls.setObjects(FOLD_OBJECTS, object.id);
  controls.setRulings(foldRulings(object), cells);
  showExport();
  // Opened in the pose the link asked for, and cut to it rather than folded:
  // there is nothing to have come from.
  rebuild(true);
}

/** The ruling nearest the one on show, among those the object offers. */
function nearestRulingOf(next: FoldObject, cells: number): number {
  const rulings = foldRulings(next);
  return rulings.reduce((best, ruling) =>
    Math.abs(ruling - cells) < Math.abs(best - cells) ? ruling : best, rulings[0]!);
}

/**
 * What to call each pose, and what the maze is like in it.
 *
 * The name comes from the mechanism, which reads it off the shape rather than
 * storing it: a frame has a hole through it, a plank lies flat, a cube is the
 * solid block that is square. Numbered in the order the mechanism found them,
 * which is the order the buttons stand in.
 */
function describePoses(
  mech: FoldMechanism,
  surface: KineticSurface,
  design: KineticDesign,
): FoldPose[] {
  return mech.poses.map((pose, index) => {
    const stats = stateStats(surface, design, index);
    return {
      label: pose.label,
      cells: surface.visibleCount[index] ?? 0,
      passages: stats.edges,
      longestWalk: longestWalk(surface, design, index),
      perfect: stats.perfect,
    };
  });
}
