/**
 * Wiring for the moving maze: panel -> mechanism -> scene.
 *
 * The one thing to know about the shape of this file is why the build is
 * announced before it runs. Finding a design that is a perfect maze in every
 * state takes a few hundred milliseconds of solid arithmetic, and the page has
 * one thread; so the status line is written, a frame is allowed through to
 * paint it, and only then does the search start. Without the gap the browser
 * coalesces both into one repaint and the panel simply freezes.
 */

import { createRng } from '../core/prng.ts';
import { buildSurface } from '../core/kinetic/surface.ts';
import { createStack } from '../core/kinetic/mechanisms/stack.ts';
import type { StackMechanism } from '../core/kinetic/mechanisms/stack.ts';
import type { KineticSurface } from '../core/kinetic/surface.ts';
import type { KineticDesign, StartGoal } from '../core/kinetic/maze.ts';
import {
  DEFAULT_SEARCH_EFFORT,
  createAllStatesSearch,
  expandCutClasses,
  pickStartGoal,
} from '../core/kinetic/maze.ts';
import {
  buildKineticPieces,
  kineticSolutionPath,
  modelBounds,
  solutionLength,
} from '../render/kinetic-geometry.ts';
import { createKineticScene } from '../render/kinetic-scene.ts';
import { KINETIC_SCENE } from '../render/kinetic-scene-constants.ts';
import { exportStackPDF } from '../render/pdf-stack-sheets.ts';
import { A4_SHEET, STACK_SHEET_DEFAULTS } from '../render/kinetic-sheet-constants.ts';
import { createKineticControls } from './kinetic-controls.ts';
import { decodeKineticParams, encodeKineticParams, isMaxEffort } from './kinetic-param-codec.ts';
import type { KineticParams } from './kinetic-param-codec.ts';

interface Build {
  mech: StackMechanism;
  surface: KineticSurface;
  design: KineticDesign;
  ends: StartGoal;
  perfectStates: number;
  passages: number;
  seamPassages: number;
  params: KineticParams;
}

export function initKineticApp(viewportEl: HTMLElement, controlsEl: HTMLElement) {
  const params = decodeKineticParams(window.location.search);
  const scene = createKineticScene(viewportEl, params.style);
  const controls = createKineticControls(controlsEl, params);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let build: Build | null = null;
  let stateIndex = 0;
  /** Bumped by every rebuild, so an older search knows it has been overtaken. */
  let buildToken = 0;

  function startSearch(p: KineticParams) {
    const mech = createStack({ sides: p.sides, layers: p.layers, cols: p.cols, rows: p.rows });
    const surface = buildSurface(mech, { maxStates: mech.states.length });
    const rng = createRng(p.seed);
    const openCutClasses = expandCutClasses(surface, { rng, extra: p.k });
    const search = createAllStatesSearch(surface, {
      rng,
      openCutClasses,
      effort: DEFAULT_SEARCH_EFFORT * p.effort,
    });
    return { mech, surface, search };
  }

  function finishBuild(
    mech: StackMechanism,
    surface: KineticSurface,
    found: ReturnType<ReturnType<typeof createAllStatesSearch>['result']>,
    p: KineticParams,
  ): Build {
    const ends = pickStartGoal(surface, found.design);
    const rate = found.rate;
    return {
      mech,
      surface,
      design: found.design,
      ends,
      perfectStates: rate.perfectStates.length,
      passages: rate.edgeCounts[0] ?? 0,
      seamPassages: found.design.openCutClasses.length,
      params: p,
    };
  }

  function show(next: Build) {
    build = next;
    stateIndex = 0;
    const { mech, surface, design, ends } = next;
    const bounds = modelBounds(mech);
    scene.setModel({
      pieces: buildKineticPieces(mech, surface, design, ends, {
        axialGap: KINETIC_SCENE.ringGap,
        caps: true,
      }),
      pieceZ: mech.states[0]!.map(placement => placement.offset[2]),
      sides: mech.sides,
      radius: bounds.radius,
      zMin: bounds.zMin,
      zMax: bounds.zMax,
      seed: next.params.seed,
    });
    scene.setMotion(next.params.motion);
    refreshState(stateIndex);
  }

  /** Redraws the route and the numbers for whichever state the rings are in. */
  function refreshState(index: number) {
    if (!build) return;
    stateIndex = index;
    const { mech, surface, design, ends } = build;
    // Read from the panel, not from the build: whether the answer is on screen
    // is a switch the visitor holds, and the rings settle long after the maze
    // was made.
    const wanted = controls.getParams().showSolution;
    const path = wanted
      ? kineticSolutionPath(mech, surface, design, index, ends, {
          axialGap: KINETIC_SCENE.ringGap,
        })
      : null;
    scene.setSolution(path);
    controls.setMetrics({
      cells: surface.cellCount,
      states: surface.stateCount,
      passages: build.passages,
      perfectStates: build.perfectStates,
      seamPassages: build.seamPassages,
      seamClasses: surface.cutClasses.length,
      stateLabel: mech.stateLabel(index),
      stateIndex: index,
      solutionLength: solutionLength(surface, design, index, ends),
    });
  }

  /**
   * Builds the mechanism, then walks the search one round per frame.
   *
   * A round at a time rather than all at once because the page has one thread.
   * Between rounds the browser gets it back, so the rings carry on turning and
   * the bar moves — and a search that takes ten seconds looks like a search
   * rather than like a page that has died. `token` stands in for cancellation:
   * if anything starts a newer build, the older loop finds its token stale and
   * drops what it was doing.
   */
  function rebuild() {
    const p = controls.getParams();
    const token = ++buildToken;
    controls.setParams(p);
    syncUrl(p);
    controls.setStatus('Building the surface...');
    controls.setProgress(0);

    // Let the browser paint that line before the thread disappears into the
    // first round; see the note at the top of the file.
    requestAnimationFrame(() => setTimeout(() => {
      if (token !== buildToken) return;
      let started;
      try {
        started = startSearch(p);
      } catch (error) {
        controls.setStatus(`Could not build that one: ${(error as Error).message}`);
        controls.setProgress(null);
        controls.setCanSearchHarder(false);
        return;
      }
      const { mech, surface, search } = started;
      controls.setStatus('Looking for a maze that survives every turn...');

      const pump = () => {
        if (token !== buildToken) return;
        let done: boolean;
        try {
          done = search.step();
        } catch (error) {
          // Nothing on screen may be left mid-search: the bar would sit there
          // sweeping away at a search that has stopped.
          controls.setStatus(`The search gave up: ${(error as Error).message}`);
          controls.setProgress(null);
          controls.setCanSearchHarder(false);
          return;
        }
        const progress = search.progress;
        if (!done) {
          // Two things are true at once: rounds are being used up, and the
          // design is getting closer. Show whichever is further along, so the
          // bar reflects the one that is actually moving.
          const byRounds = progress.rounds / progress.maxRounds;
          const byStates = progress.perfectStates / Math.max(1, progress.stateCount);
          controls.setProgress(Math.max(byRounds, byStates * 0.9));
          controls.setStatus(
            `Round ${progress.rounds}: perfect in ${progress.perfectStates} of ` +
            `${progress.stateCount} states so far...`,
          );
          requestAnimationFrame(pump);
          return;
        }

        let next: Build;
        try {
          next = finishBuild(mech, surface, search.result(), p);
        } catch (error) {
          controls.setStatus(`Could not finish that one: ${(error as Error).message}`);
          controls.setProgress(null);
          controls.setCanSearchHarder(false);
          return;
        }
        show(next);
        controls.setProgress(null);
        const short = next.perfectStates < next.surface.stateCount;
        const canTryHarder = !isMaxEffort(p.effort);
        controls.setStatus(
          short
            ? `Best found: a perfect maze in ${next.perfectStates} of ` +
              `${next.surface.stateCount} states. ` +
              (canTryHarder ? 'Search harder, or try another seed.' : 'Try another seed.')
            : '',
        );
        controls.setCanSearchHarder(short);
      };
      requestAnimationFrame(pump);
    }, 0));
  }

  function syncUrl(p: KineticParams) {
    history.replaceState(null, '', encodeKineticParams(p) || window.location.pathname);
  }

  scene.onState((offsets, atRest) => {
    if (!atRest || !build) return;
    refreshState(build.mech.stateIndex(offsets));
  });

  controls.onChange(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rebuild, 150);
  });

  controls.onAction('style', () => {
    const p = controls.getParams();
    scene.setPreset(p.style);
    // The preset rebuilt the rings; the route has to go back on.
    refreshState(stateIndex);
    syncUrl(p);
  });

  controls.onAction('solution', () => {
    const p = controls.getParams();
    refreshState(stateIndex);
    syncUrl(p);
  });

  controls.onAction('motion', () => {
    const p = controls.getParams();
    scene.setMotion(p.motion);
    syncUrl(p);
  });

  controls.onAction('copy-url', () => {
    const p = controls.getParams();
    const url = window.location.origin + window.location.pathname + encodeKineticParams(p);
    navigator.clipboard.writeText(url).then(
      () => controls.showToast('URL copied'),
      () => controls.showToast('Could not copy the URL'),
    );
  });

  controls.onAction('export-pdf', () => {
    if (!build) return;
    const { mech, surface, design, params: p } = build;
    // A cell is printed at a fixed size, so a wide barrel has to be drawn
    // smaller or the band would not fit across the sheet — down to a point.
    // Past that the object stops being something anyone can cut out, and
    // saying so beats handing over a PDF that cannot be built.
    const columns = mech.sides * mech.cols;
    const usable = A4_SHEET.width - 2 * A4_SHEET.margin - STACK_SHEET_DEFAULTS.bandTabMm;
    const cellMm = Math.min(STACK_SHEET_DEFAULTS.cellMm, usable / columns);
    if (cellMm < STACK_SHEET_DEFAULTS.minCellMm) {
      const fits = Math.floor(usable / (STACK_SHEET_DEFAULTS.minCellMm * mech.sides));
      controls.showToast(
        `${columns} cells around the barrel is too wide to print on A4 — a cell would be ` +
        `${cellMm.toFixed(1)} mm. Try ${fits} across a face, or fewer sides.`,
      );
      return;
    }
    controls.setExportBusy(true);
    setTimeout(() => {
      try {
        const plan = exportStackPDF(mech, surface, design, p.seed, { cellMm });
        controls.showToast(
          `${plan.sheets.length} sheets — a ${plan.barrelWidthMm.toFixed(0)} mm barrel, ` +
          `${plan.barrelHeightMm.toFixed(0)} mm tall, on a ${STACK_SHEET_DEFAULTS.dowelMm} mm dowel`,
        );
      } catch (error) {
        controls.showToast(`Export failed: ${(error as Error).message}`);
      } finally {
        controls.setExportBusy(false);
      }
    }, 0);
  });

  window.addEventListener('resize', () => scene.resize());
  rebuild();
}
