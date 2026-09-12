/**
 * The panel for the moving maze.
 *
 * Built the same way as `controls.ts` — one string of HTML, then listeners —
 * so the two pages stay recognisably one site. What differs is that some of
 * these sliders bound each other: turning up the sides takes rings away, and
 * both take cells away, because the search has to hold every state in hand at
 * once. The bounds themselves live in `kinetic-param-codec.ts`; here they are
 * only shown.
 */

import {
  KINETIC_LIMITS,
  clampKineticParams,
  harderEffort,
  isMaxEffort,
  maxCols,
  maxRows,
  maxUsableLayers,
  stateCount,
} from './kinetic-param-codec.ts';
import type { KineticParams } from './kinetic-param-codec.ts';
import { SCENE_PRESETS, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';

export interface KineticMetrics {
  cells: number;
  states: number;
  /** Passages in the maze. The same number in every state — that is the point. */
  passages: number;
  perfectStates: number;
  /** Seam classes opened, and how many the mechanism has to offer. */
  seamPassages: number;
  seamClasses: number;
  /** How the rings stand right now, e.g. "0-2-5-1". */
  stateLabel: string;
  stateIndex: number;
  solutionLength: number;
}

export interface KineticControlsContext {
  getParams(): KineticParams;
  setParams(params: KineticParams): void;
  setMetrics(m: KineticMetrics): void;
  setStatus(text: string): void;
  /** Shows or hides the offer to spend more time on a search that fell short. */
  setCanSearchHarder(can: boolean): void;
  onChange(cb: () => void): void;
  onAction(action: string, cb: () => void): void;
  showToast(message: string): void;
  setExportBusy(busy: boolean): void;
}

export function createKineticControls(
  container: HTMLElement,
  initial: KineticParams,
): KineticControlsContext {
  container.innerHTML = buildHTML(initial);
  const el = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;

  const sidesSlider = el<HTMLInputElement>('kin-sides');
  const layersSlider = el<HTMLInputElement>('kin-layers');
  const colsSlider = el<HTMLInputElement>('kin-cols');
  const rowsSlider = el<HTMLInputElement>('kin-rows');
  const kSlider = el<HTMLInputElement>('kin-k');
  const seedInput = el<HTMLInputElement>('kin-seed');
  const styleSelect = el<HTMLSelectElement>('kin-style');
  const styleNote = el<HTMLDivElement>('kin-style-note');
  const solutionCheck = el<HTMLInputElement>('kin-solution');
  const motionCheck = el<HTMLInputElement>('kin-motion');
  const metricsDiv = el<HTMLDivElement>('kin-metrics');
  const statusDiv = el<HTMLDivElement>('kin-status');

  const callbacks: (() => void)[] = [];
  const actions = new Map<string, () => void>();
  const fire = () => callbacks.forEach(cb => cb());

  // Effort has no control of its own: it is not a property of the object, it
  // is how much patience the last search was given. Touching any real
  // parameter puts it back to normal, so a stubborn mechanism cannot leave
  // every later rebuild slow.
  let effort = initial.effort;
  const harderBtn = el<HTMLButtonElement>('kin-harder');

  function readParams(): KineticParams {
    return clampKineticParams({
      sides: Number(sidesSlider.value),
      layers: Number(layersSlider.value),
      cols: Number(colsSlider.value),
      rows: Number(rowsSlider.value),
      k: Number(kSlider.value),
      seed: Number(seedInput.value),
      showSolution: solutionCheck.checked,
      motion: motionCheck.checked,
      effort,
      style: styleSelect.value as PresetId,
    });
  }

  /**
   * Shows the bounds the other sliders have put on each one, and pulls any
   * slider that is now out of bounds back to where it can be. Silently, and
   * before the maze is built: a slider that can be dragged somewhere the
   * object cannot go is a slider that lies.
   */
  function syncBounds() {
    const p = readParams();
    layersSlider.max = String(maxUsableLayers(p.sides));
    colsSlider.max = String(maxCols(p));
    rowsSlider.max = String(maxRows(p));
    sidesSlider.value = String(p.sides);
    layersSlider.value = String(p.layers);
    colsSlider.value = String(p.cols);
    rowsSlider.value = String(p.rows);
    kSlider.value = String(p.k);

    el('kin-sides-val').textContent = String(p.sides);
    el('kin-layers-val').textContent = String(p.layers);
    el('kin-cols-val').textContent = String(p.cols);
    el('kin-rows-val').textContent = String(p.rows);
    el('kin-k-val').textContent = p.k === 0 ? 'fewest' : `+${p.k}`;
    el('kin-shape-info').textContent =
      `${p.sides}-gon · ${p.layers} rings · ${p.sides * p.layers * p.cols * p.rows} cells · ` +
      `${stateCount(p.sides, p.layers)} states`;
  }

  for (const slider of [sidesSlider, layersSlider, colsSlider, rowsSlider, kSlider]) {
    slider.addEventListener('input', () => {
      effort = 1;
      syncBounds();
      fire();
    });
  }
  seedInput.addEventListener('change', () => {
    effort = 1;
    fire();
  });

  harderBtn.addEventListener('click', () => {
    effort = harderEffort(effort);
    fire();
  });
  solutionCheck.addEventListener('change', () => actions.get('solution')?.());
  motionCheck.addEventListener('change', () => actions.get('motion')?.());

  function updateStyleNote() {
    styleNote.textContent = resolvePreset(styleSelect.value).note;
  }
  styleSelect.addEventListener('change', () => {
    updateStyleNote();
    actions.get('style')?.();
  });
  updateStyleNote();

  el('kin-shuffle-seed').addEventListener('click', () => {
    seedInput.value = String(randomSeed());
    effort = 1;
    fire();
  });

  // A whole different object: sides, rings, ruling, seams and seed. The two
  // view switches are left alone — they are how you are reading the maze, not
  // which maze it is.
  el('kin-shuffle-all').addEventListener('click', () => {
    effort = 1;
    sidesSlider.value = String(randomInRange(sidesSlider));
    syncBounds();
    layersSlider.value = String(randomInRange(layersSlider));
    syncBounds();
    colsSlider.value = String(randomInRange(colsSlider));
    syncBounds();
    rowsSlider.value = String(randomInRange(rowsSlider));
    kSlider.value = String(randomInRange(kSlider));
    seedInput.value = String(randomSeed());
    syncBounds();
    fire();
  });

  el('kin-copy-url').addEventListener('click', () => actions.get('copy-url')?.());
  const exportBtn = el<HTMLButtonElement>('kin-export-pdf');
  exportBtn.addEventListener('click', () => actions.get('export-pdf')?.());

  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  function showToast(message: string) {
    let toast = document.querySelector<HTMLDivElement>('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast?.classList.remove('show'), 2600);
  }

  syncBounds();

  return {
    getParams: readParams,
    setParams(params) {
      sidesSlider.value = String(params.sides);
      layersSlider.value = String(params.layers);
      colsSlider.value = String(params.cols);
      rowsSlider.value = String(params.rows);
      kSlider.value = String(params.k);
      seedInput.value = String(params.seed);
      solutionCheck.checked = params.showSolution;
      motionCheck.checked = params.motion;
      styleSelect.value = params.style;
      updateStyleNote();
      syncBounds();
    },
    setMetrics(m) {
      const everyState = m.perfectStates === m.states;
      metricsDiv.innerHTML = `
        <div class="${everyState ? 'good' : 'warn'}">Perfect in
          <b>${m.perfectStates}</b> of ${m.states} states${everyState ? ' — all of them' : ''}</div>
        <div>Passages: <b>${m.passages}</b> <span class="hint">(the same in every state)</span></div>
        <div>Seams opened: <b>${m.seamPassages}</b> <span class="hint">of ${m.seamClasses}</span></div>
        <div>Cells: <b>${m.cells}</b></div>
        <div>Now: <b>${m.stateLabel}</b> <span class="hint">(state ${m.stateIndex})</span></div>
        <div>Solution: <b>${m.solutionLength}</b> steps</div>
      `;
    },
    setStatus(text) {
      statusDiv.textContent = text;
      statusDiv.classList.toggle('busy', text !== '');
    },
    /** Offers more patience only when more patience could change something. */
    setCanSearchHarder(can) {
      harderBtn.hidden = !can || isMaxEffort(effort);
      harderBtn.textContent = `Search harder (x${harderEffort(effort)})`;
    },
    onChange(cb) { callbacks.push(cb); },
    onAction(action, cb) { actions.set(action, cb); },
    showToast,
    setExportBusy(busy) {
      exportBtn.disabled = busy;
      exportBtn.textContent = busy ? 'Exporting...' : 'Export rings PDF';
    },
  };
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1000000);
}

/** A value in the slider's own range, so the bounds stay declared in one place. */
function randomInRange(slider: HTMLInputElement): number {
  const min = Number(slider.min);
  const max = Number(slider.max);
  return min + Math.floor(Math.random() * (max - min + 1));
}

function buildHTML(p: KineticParams): string {
  const styleOptions = SCENE_PRESETS.map(s =>
    `<option value="${esc(s.id)}"${s.id === p.style ? ' selected' : ''}>${esc(s.label)}</option>`,
  ).join('');
  const L = KINETIC_LIMITS;

  return `
    <h2>Moving Maze</h2>
    <p class="blurb">
      A maze on a stack of rings, free to turn on a dowel. Every way of turning
      them is a different maze — and every one of them is solvable. Drag a ring
      to turn it; drag the bottom one to turn the whole object.
    </p>

    <label>Rings: <span id="kin-layers-val">${p.layers}</span>
      <input id="kin-layers" type="range" min="${L.layers.min}" max="${L.layers.max}" value="${p.layers}" />
    </label>

    <label>Sides: <span id="kin-sides-val">${p.sides}</span>
      <input id="kin-sides" type="range" min="${L.sides.min}" max="${L.sides.max}" value="${p.sides}" />
    </label>

    <label>n across a face: <span id="kin-cols-val">${p.cols}</span>
      <input id="kin-cols" type="range" min="${L.cols.min}" max="${L.cols.max}" value="${p.cols}" />
    </label>

    <label>n up a ring: <span id="kin-rows-val">${p.rows}</span>
      <input id="kin-rows" type="range" min="${L.rows.min}" max="${L.rows.max}" value="${p.rows}" />
    </label>

    <label>k (seam passages): <span id="kin-k-val">${p.k}</span>
      <input id="kin-k" type="range" min="${L.k.min}" max="${L.k.max}" value="${p.k}" />
    </label>

    <label>Seed
      <input id="kin-seed" type="number" min="${L.seed.min}" max="${L.seed.max}" value="${p.seed}" />
    </label>
    <div class="shape-info" id="kin-shape-info"></div>

    <label>Style <span class="hint">(3D view only)</span>
      <select id="kin-style">
        ${styleOptions}
      </select>
    </label>
    <div class="shape-info" id="kin-style-note"></div>

    <div class="checkboxes">
      <label><input id="kin-solution" type="checkbox" ${p.showSolution ? 'checked' : ''} /> Show solution</label>
      <label><input id="kin-motion" type="checkbox" ${p.motion ? 'checked' : ''} /> Rings turn</label>
    </div>

    <div class="buttons">
      <button id="kin-shuffle-seed" title="A different maze on the same mechanism">Shuffle seed</button>
      <button id="kin-shuffle-all" title="A different mechanism as well: sides, rings, ruling, seams and seed">Shuffle all</button>
      <button id="kin-copy-url" class="wide">Copy URL</button>
      <button id="kin-export-pdf" class="wide" title="The rings and their bulkheads, to print, cut and thread on a 6 mm dowel">Export rings PDF</button>
      <button id="kin-harder" class="wide" hidden title="The search is a heuristic: more time is another attempt, not a better one, but it usually finds it">Search harder</button>
    </div>

    <div id="kin-status" class="status"></div>
    <div id="kin-metrics" class="metrics"></div>

    <div class="legend">
      <span style="color:#22bb22;">&#9679;</span> Start
      <span style="color:#dd2222; margin-left:0.8em;">&#9679;</span> Goal
    </div>

    <div class="nav-links">
      <a href="../">&#8592; Polyhedral maze</a>
      <a class="github-link" href="https://github.com/kakeami/polyhedral-maze" target="_blank" rel="noopener noreferrer">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        GitHub
      </a>
    </div>
  `;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' :
    ch === '<' ? '&lt;' :
    ch === '>' ? '&gt;' :
    ch === '"' ? '&quot;' :
    '&#39;'
  ));
}
