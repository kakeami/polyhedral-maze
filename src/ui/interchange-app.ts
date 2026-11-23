/**
 * Wiring for the interchange maze: ruling -> world -> maze -> scene.
 *
 * A maze is named by a ruling, a number of stations, a number of folds on the
 * way, and a seed. It is made here every time (`core/kinetic/interchange.ts`):
 * an attempt is a fraction of a millisecond to a dozen and one to ten of them
 * is the usual number, so there is nothing to ship and nothing to cache. Where
 * what was asked for is not to be had — more stations than a coarse ruling
 * has room for — the nearest found is shown and the status line says what it
 * is.
 *
 * The object, the surface and the folds between its shapes are the folding
 * page's, unchanged, and so is the scene. What differs is the printing — no
 * shape is a perfect maze here, and is not meant to be — and what showing the
 * solution means: the way from start to goal crosses shapes, so it is played
 * rather than drawn, a walk and a fold at a time (`FoldSceneContext.playRoute`).
 */

import { buildSurface } from '../core/kinetic/surface.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import { createCubeRing } from '../core/kinetic/mechanisms/cube-ring.ts';
import type { CubeRingMechanism } from '../core/kinetic/mechanisms/cube-ring.ts';
import type { FoldGraph } from '../core/kinetic/fold-path.ts';
import { poseDistances } from '../core/kinetic/fold-path.ts';
import { buildInterchangeWorld, createInterchangeSearch } from '../core/kinetic/interchange.ts';
import type { InterchangeMaze, InterchangeWorld } from '../core/kinetic/interchange.ts';
import { buildKineticPieces, kineticWalls } from '../render/kinetic-geometry.ts';
import {
  STATION_SYMBOLS, interchangeRouteLegs, stationGlyph,
} from '../render/interchange-geometry.ts';
import type { RouteLeg } from '../render/interchange-geometry.ts';
import { createFoldScene } from '../render/fold-scene.ts';
import { MAZE_STYLE } from '../render/scene-constants.ts';
import { SCENE_PRESETS } from '../render/scene-presets.ts';
import { createInterchangeControls } from './interchange-controls.ts';
import { INTERCHANGE_OBJECT, interchangeRulings, walkedStates } from './interchange-objects.ts';
import {
  INTERCHANGE_LIMITS, decodeInterchangeParams, encodeInterchangeParams, randomSeed,
} from './interchange-param-codec.ts';
import type { InterchangeParams } from './interchange-param-codec.ts';

/** Everything that depends on the ruling alone, kept so the sliders cost nothing. */
interface Ruling {
  mech: CubeRingMechanism;
  surface: KineticSurface;
  graph: FoldGraph;
  world: InterchangeWorld;
  labels: string[];
}

interface Build {
  ruling: Ruling;
  maze: InterchangeMaze;
  legs: RouteLeg[];
}

/** How long one frame may spend looking for a maze before the browser gets a turn. */
const SLICE_MS = 12;

export function initInterchangeApp(viewportEl: HTMLElement, controlsEl: HTMLElement) {
  const opening = decodeInterchangeParams(window.location.search);
  const scene = createFoldScene(viewportEl, opening.style);
  const controls = createInterchangeControls(controlsEl, opening);

  const rulings = new Map<number, Ruling>();
  let build: Build | null = null;
  let cells = opening.cells;
  let stations = opening.stations;
  let folds = opening.folds;
  let seed = opening.seed;
  /** Which shape it stands in, among the shapes walked in. */
  let poseIndex = opening.pose;
  let buildToken = 0;

  function rulingFor(next: number): Ruling {
    const had = rulings.get(next);
    if (had) return had;
    const mech = createCubeRing(INTERCHANGE_OBJECT, { cells: next });
    const surface = buildSurface(mech, { maxStates: mech.states.length });
    const graph = mech.foldGraph();
    const lines = walkedStates(mech);
    const made: Ruling = {
      mech,
      surface,
      graph,
      world: buildInterchangeWorld(surface, lines, poseDistances(graph)),
      labels: lines.map(state => mech.poses[state]!.label),
    };
    rulings.set(next, made);
    return made;
  }

  function currentParams(): InterchangeParams {
    return { ...controls.getParams(), cells, stations, folds, seed, pose: poseIndex };
  }

  function syncUrl() {
    history.replaceState(null, '', encodeInterchangeParams(currentParams()) || window.location.pathname);
  }

  function refreshMetrics() {
    if (!build) return;
    const { ruling, maze } = build;
    const { world, mech } = ruling;
    const shown = world.visible[poseIndex];
    const reached = maze.reached[poseIndex];
    let cellsHere = 0;
    let walkableHere = 0;
    for (let cell = 0; cell < mech.cells.length; cell++) {
      if (shown?.[cell]) cellsHere++;
      if (reached?.[cell]) walkableHere++;
    }
    controls.setMetrics({
      stations: `${maze.stations.length}  ${maze.stations.map((_, i) => STATION_SYMBOLS[i % STATION_SYMBOLS.length]!.char).join(' ')}`,
      folds: maze.folds,
      steps: maze.steps,
      shapesOnTheWay: new Set(maze.route.map(leg => leg.line)).size,
      shapes: world.lines.length,
      stationsOffTheWay: maze.offRoute,
      walkableHere,
      cellsHere,
      squaresToACube: mech.cells.length / mech.pieceCount,
    });
  }

  function show(next: Build, keepPose: boolean) {
    build = next;
    const { ruling, maze } = next;
    const { mech, surface, world } = ruling;
    poseIndex = keepPose ? Math.min(poseIndex, world.lines.length - 1) : 0;
    scene.setModel({
      pieces: buildKineticPieces(
        mech, surface, maze, { start: maze.start, goal: maze.goal }, { stations: maze.stations },
      ),
      states: mech.states,
      graph: ruling.graph,
      wallsByPose: mech.states.map((_, state) =>
        kineticWalls(mech, surface, maze, surface.visibleOfState(state))),
      visibleByPose: mech.states.map((_, state) => surface.visibleOfState(state)),
      decals: maze.stations.map((cell, index) => ({
        piece: mech.cells[cell]!.piece,
        cell,
        pairs: stationGlyph(mech.cells[cell]!, index),
        color: MAZE_STYLE.markers.stationColor,
      })),
    });
    scene.setPose(world.lines[poseIndex]!);
    scene.setAutoRotate(controls.isAutoRotating());
    controls.setPoses(ruling.labels, poseIndex);
    controls.setSeed(seed);
    refreshMetrics();
    scene.playRoute(controls.isShowingSolution() ? next.legs : null);
    syncUrl();
  }

  /** Puts a maze on screen: at once if it is found within a frame, a frame at a time if not. */
  function rebuild(keepPose: boolean) {
    const token = ++buildToken;
    const ruling = rulingFor(cells);
    const search = createInterchangeSearch(ruling.world, { stations, folds, seed });
    const slice = (): boolean => {
      const until = performance.now() + SLICE_MS;
      while (performance.now() < until) if (search.step()) return true;
      return false;
    };
    const finish = () => {
      const { maze, exact } = search.result();
      controls.setProgress(null);
      controls.setBusy(false);
      controls.setStatus(exact ? '' : nearestNote(maze));
      show({
        ruling,
        maze,
        legs: interchangeRouteLegs(ruling.mech, ruling.surface, ruling.world, maze),
      }, keepPose);
    };
    if (slice()) {
      finish();
      return;
    }
    controls.setBusy(true);
    controls.setStatus('Looking for a maze with that way through it...');
    const pump = () => {
      if (token !== buildToken) return;
      if (slice()) {
        finish();
        return;
      }
      controls.setProgress(search.attempts / search.maxAttempts);
      requestAnimationFrame(pump);
    };
    requestAnimationFrame(pump);
  }

  /** What to say when the maze on show is not quite the one asked for. */
  function nearestNote(maze: InterchangeMaze): string {
    const got: string[] = [];
    if (maze.stations.length !== stations) got.push(`${maze.stations.length} stations`);
    if (maze.folds !== folds) got.push(`${maze.folds} folds on the way`);
    if (maze.offRoute < 1) got.push('no station off the way');
    if (!maze.covered) got.push('some cells nowhere walkable');
    return `Nearest found: ${got.join(', ') || 'not quite that'}. Shuffle for another seed.`;
  }

  controls.onPose(index => {
    if (!build) return;
    // Asked for a shape: the answer stops playing, since it would fold the
    // object away from what was asked for a moment later.
    if (controls.isShowingSolution()) {
      controls.setShowingSolution(false);
      scene.playRoute(null);
    }
    poseIndex = index;
    scene.setPose(build.ruling.world.lines[index]!, { animate: true });
  });

  controls.onRuling(next => {
    if (next === cells) return;
    cells = next;
    rebuild(true);
  });

  controls.onStations(next => {
    if (next === stations) return;
    stations = next;
    rebuild(true);
  });

  controls.onFolds(next => {
    if (next === folds) return;
    folds = next;
    rebuild(true);
  });

  controls.onSeed(next => {
    if (next === seed) return;
    seed = next;
    rebuild(true);
  });

  controls.onAction('shuffle-seed', () => {
    seed = randomSeed();
    rebuild(true);
  });

  controls.onAction('shuffle-all', () => {
    const offered = interchangeRulings();
    cells = offered[Math.floor(Math.random() * offered.length)] ?? cells;
    // Within what is found at once at any ruling: the far ends of both
    // sliders are for a visitor who asks, not for a shuffle.
    stations = INTERCHANGE_LIMITS.minStations + Math.floor(Math.random() * 6);
    folds = INTERCHANGE_LIMITS.minFolds + Math.floor(Math.random() * 3);
    seed = randomSeed();
    const style = SCENE_PRESETS[Math.floor(Math.random() * SCENE_PRESETS.length)];
    if (style) {
      controls.setStyle(style.id);
      scene.setPreset(style.id);
    }
    controls.setRulings(offered, cells);
    controls.setStations(stations);
    controls.setFolds(folds);
    rebuild(false);
  });

  controls.onAction('solution', () => {
    if (build) scene.playRoute(controls.isShowingSolution() ? build.legs : null);
    syncUrl();
  });

  controls.onAction('style', () => {
    scene.setPreset(controls.style());
    syncUrl();
  });

  controls.onAction('auto-rotate', () => {
    scene.setAutoRotate(controls.isAutoRotating());
    syncUrl();
  });

  controls.onAction('copy-url', () => {
    const url = window.location.origin + window.location.pathname
      + encodeInterchangeParams(currentParams());
    navigator.clipboard.writeText(url).then(
      () => controls.showToast('URL copied'),
      () => controls.showToast('Could not copy the URL'),
    );
  });

  // The scene speaks in the mechanism's states; the panel in the shapes that
  // are walked in. A fold only ever lands on one of those.
  scene.onArrive(state => {
    if (!build) return;
    const index = build.ruling.world.lines.indexOf(state);
    if (index < 0) return;
    poseIndex = index;
    controls.setPose(index);
    refreshMetrics();
    syncUrl();
  });

  window.addEventListener('resize', () => scene.resize());
  controls.setRulings(interchangeRulings(), cells);
  rebuild(true);
}
