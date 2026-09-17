/**
 * The panel for the kinetic maze.
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
  maxCutN,
  maxPairN,
  maxRows,
  maxLayers,
  cutCellCount,
  cutSolidFacts,
  pairCellCount,
  pairStateCount,
  stateCount,
} from './kinetic-param-codec.ts';
import type { KineticParams, MechanismId } from './kinetic-param-codec.ts';
import { JOINED_PAIRS, joinedPairById, DEFAULT_JOINED_PAIR } from '../core/kinetic/mechanisms/joined.ts';
import { GYRATIONS, gyrationById, DEFAULT_GYRATION } from '../core/kinetic/mechanisms/gyration.ts';
import { SCENE_PRESETS, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';
import { pageSwitchHTML, sourceLinkHTML } from './page-nav.ts';

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
  /** A fraction for the search bar, or null to take it away. */
  setProgress(fraction: number | null): void;
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

  const mechSelect = el<HTMLSelectElement>('kin-mech');
  const pairSelect = el<HTMLSelectElement>('kin-pair');
  const pairNSlider = el<HTMLInputElement>('kin-pair-n');
  const cutSelect = el<HTMLSelectElement>('kin-cut');
  const cutNSlider = el<HTMLInputElement>('kin-cut-n');
  const stackGroup = el<HTMLDivElement>('kin-stack-group');
  const pairGroup = el<HTMLDivElement>('kin-pair-group');
  const cutGroup = el<HTMLDivElement>('kin-cut-group');
  const blurb = el<HTMLParagraphElement>('kin-blurb');
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
  const autoRotateCheck = el<HTMLInputElement>('kin-autorotate');
  const motionLabel = el<HTMLSpanElement>('kin-motion-label');
  const metricsDiv = el<HTMLDivElement>('kin-metrics');
  const statusDiv = el<HTMLDivElement>('kin-status');
  const progressBar = el<HTMLDivElement>('kin-progress');
  const progressFill = el<HTMLDivElement>('kin-progress-fill');

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
      mechanism: mechSelect.value as MechanismId,
      pair: pairSelect.value,
      pairN: Number(pairNSlider.value),
      cut: cutSelect.value,
      cutN: Number(cutNSlider.value),
      sides: Number(sidesSlider.value),
      layers: Number(layersSlider.value),
      cols: Number(colsSlider.value),
      rows: Number(rowsSlider.value),
      k: Number(kSlider.value),
      seed: Number(seedInput.value),
      showSolution: solutionCheck.checked,
      motion: motionCheck.checked,
      autoRotate: autoRotateCheck.checked,
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
    const pair = p.mechanism === 'pair';
    const cut = p.mechanism === 'cut';
    stackGroup.hidden = pair || cut;
    pairGroup.hidden = !pair;
    cutGroup.hidden = !cut;
    mechSelect.value = p.mechanism;
    blurb.textContent = cut ? CUT_BLURB : pair ? PAIR_BLURB : STACK_BLURB;

    layersSlider.max = String(maxLayers(p.sides));
    colsSlider.max = String(maxCols(p));
    rowsSlider.max = String(maxRows(p));
    sidesSlider.value = String(p.sides);
    layersSlider.value = String(p.layers);
    colsSlider.value = String(p.cols);
    rowsSlider.value = String(p.rows);
    pairSelect.value = p.pair;
    pairNSlider.max = String(maxPairN(p.pair));
    pairNSlider.value = String(p.pairN);
    cutSelect.value = p.cut;
    cutNSlider.max = String(maxCutN(p.cut));
    cutNSlider.value = String(p.cutN);
    // Every seam has to keep one class for joining its two pieces; what is
    // left over is what k can spend.
    const cutFacts = cutSolidFacts(p.cut, p.cutN);
    const spareSeamClasses = Math.max(0, cutFacts.seamClasses - (cutFacts.pieces - 1));
    kSlider.max = String(
      pair ? Math.max(0, p.pairN - 1) : cut ? spareSeamClasses : KINETIC_LIMITS.k.max,
    );
    kSlider.value = String(p.k);
    kSlider.disabled = (pair && p.pairN < 2) || (cut && spareSeamClasses === 0);
    motionLabel.textContent = cut ? ' Pieces turn' : pair ? ' Halves turn' : ' Rings turn';
    if (!exportBtn.disabled) {
      exportBtn.textContent = pair || cut ? 'Export pieces PDF' : 'Export rings PDF';
    }

    el('kin-sides-val').textContent = String(p.sides);
    el('kin-layers-val').textContent = String(p.layers);
    el('kin-cols-val').textContent = String(p.cols);
    el('kin-rows-val').textContent = String(p.rows);
    el('kin-pair-n-val').textContent = String(p.pairN);
    el('kin-cut-n-val').textContent = String(p.cutN);
    el('kin-k-val').textContent = p.k === 0 ? 'fewest' : `+${p.k}`;

    const choice = joinedPairById(p.pair) ?? DEFAULT_JOINED_PAIR;
    const cutChoice = gyrationById(p.cut) ?? DEFAULT_GYRATION;
    el('kin-shape-info').textContent = cut
      ? `${cutFacts.pieces} pieces · a ${ordinal(cutFacts.turnSteps)} of a turn · ` +
        `${cutCellCount(p.cut, p.cutN)} cells · ${cutFacts.stateCount} states · ${cutChoice.becomes}`
      : pair
        ? `${choice.gon}-gon joint · ${pairCellCount(p.pair, p.pairN)} cells · ` +
          `${pairStateCount(p.pair)} states · ${choice.becomes}`
        : `${p.sides}-gon · ${p.layers} rings · ${p.sides * p.layers * p.cols * p.rows} cells · ` +
          `${stateCount(p.sides, p.layers)} states`;
  }

  for (const slider of [sidesSlider, layersSlider, colsSlider, rowsSlider, pairNSlider, cutNSlider, kSlider]) {
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
  for (const select of [mechSelect, pairSelect, cutSelect]) {
    select.addEventListener('change', () => {
      effort = 1;
      syncBounds();
      fire();
    });
  }

  harderBtn.addEventListener('click', () => {
    effort = harderEffort(effort);
    fire();
  });
  solutionCheck.addEventListener('change', () => actions.get('solution')?.());
  motionCheck.addEventListener('change', () => actions.get('motion')?.());
  autoRotateCheck.addEventListener('change', () => actions.get('auto-rotate')?.());

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
    if (mechSelect.value === 'pair') {
      pairSelect.selectedIndex = Math.floor(Math.random() * pairSelect.options.length);
      syncBounds();
      pairNSlider.value = String(randomInRange(pairNSlider));
    } else if (mechSelect.value === 'cut') {
      cutSelect.selectedIndex = Math.floor(Math.random() * cutSelect.options.length);
      syncBounds();
      cutNSlider.value = String(randomInRange(cutNSlider));
    } else {
      sidesSlider.value = String(randomInRange(sidesSlider));
      syncBounds();
      layersSlider.value = String(randomInRange(layersSlider));
      syncBounds();
      colsSlider.value = String(randomInRange(colsSlider));
      syncBounds();
      rowsSlider.value = String(randomInRange(rowsSlider));
    }
    syncBounds();
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
      mechSelect.value = params.mechanism;
      pairSelect.value = params.pair;
      pairNSlider.value = String(params.pairN);
      cutSelect.value = params.cut;
      cutNSlider.value = String(params.cutN);
      sidesSlider.value = String(params.sides);
      layersSlider.value = String(params.layers);
      colsSlider.value = String(params.cols);
      rowsSlider.value = String(params.rows);
      kSlider.value = String(params.k);
      seedInput.value = String(params.seed);
      solutionCheck.checked = params.showSolution;
      motionCheck.checked = params.motion;
      autoRotateCheck.checked = params.autoRotate;
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
    setProgress(fraction) {
      progressBar.hidden = fraction === null;
      if (fraction === null) return;
      progressFill.style.width = `${Math.max(4, Math.min(100, fraction * 100))}%`;
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
      exportBtn.textContent = busy ? 'Exporting...'
        : mechSelect.value === 'stack' ? 'Export rings PDF' : 'Export pieces PDF';
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

const STACK_BLURB =
  'A maze on a stack of rings, free to turn on a dowel. Every way of turning ' +
  'them is a different maze — and every one of them is solvable. Drag a ring ' +
  'to turn it; drag the bottom one to turn the whole object.';

const PAIR_BLURB =
  'A maze on two identical solids, glued at one face and free to turn against ' +
  'each other on a dowel. The face they are glued at is inside the object, so ' +
  'the seam is the ring of edges around it. Drag the top half to turn it.';

const CUT_BLURB =
  'A maze on one whole solid, cut along rings of its own edges and free to turn ' +
  'there. Nothing is lost to the join, so the object is still that solid — and ' +
  'still a perfect maze — however far round it is turned. Every one of these is ' +
  'cut twice: the middle piece turns against both of its neighbours, which is ' +
  'what a glued pair cannot do. Drag a piece to turn it.';

/** "a sixth of a turn" reads better than "a 1/6 turn" in a line of prose. */
function ordinal(steps: number): string {
  const names: Record<number, string> = {
    3: 'third', 4: 'quarter', 5: 'fifth', 6: 'sixth', 8: 'eighth', 10: 'tenth', 12: 'twelfth',
  };
  return names[steps] ?? `1/${steps}`;
}

function buildHTML(p: KineticParams): string {
  const styleOptions = SCENE_PRESETS.map(s =>
    `<option value="${esc(s.id)}"${s.id === p.style ? ' selected' : ''}>${esc(s.label)}</option>`,
  ).join('');
  const pairOptions = JOINED_PAIRS.map(j =>
    `<option value="${esc(j.id)}"${j.id === p.pair ? ' selected' : ''}>` +
    `${esc(j.label)} (${j.gon}-gon)</option>`,
  ).join('');
  const cutOptions = GYRATIONS.map(g =>
    `<option value="${esc(g.id)}"${g.id === p.cut ? ' selected' : ''}>` +
    `${esc(g.label)}</option>`,
  ).join('');
  const L = KINETIC_LIMITS;

  return `
    ${pageSwitchHTML('turning')}

    <h2>Turning Maze</h2>
    <p class="blurb" id="kin-blurb">
      ${esc(p.mechanism === 'cut' ? CUT_BLURB : p.mechanism === 'pair' ? PAIR_BLURB : STACK_BLURB)}
    </p>

    <label>Mechanism
      <select id="kin-mech">
        <option value="stack"${p.mechanism === 'stack' ? ' selected' : ''}>Rings on a dowel</option>
        <option value="pair"${p.mechanism === 'pair' ? ' selected' : ''}>Two solids glued at a face</option>
        <option value="cut"${p.mechanism === 'cut' ? ' selected' : ''}>One solid, cut and turned</option>
      </select>
    </label>

    <div id="kin-stack-group"${p.mechanism === 'stack' ? '' : ' hidden'}>
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
    </div>

    <div id="kin-pair-group"${p.mechanism === 'pair' ? '' : ' hidden'}>
      <label>Solids <span class="hint">(two of them, glued)</span>
        <select id="kin-pair">
          ${pairOptions}
        </select>
      </label>

      <label>n along a face edge: <span id="kin-pair-n-val">${p.pairN}</span>
        <input id="kin-pair-n" type="range" min="${L.pairN.min}" max="${L.pairN.max}" value="${p.pairN}" />
      </label>
    </div>

    <div id="kin-cut-group"${p.mechanism === 'cut' ? '' : ' hidden'}>
      <label>Solid <span class="hint">(cut along its own edges)</span>
        <select id="kin-cut">
          ${cutOptions}
        </select>
      </label>

      <label>n along a face edge: <span id="kin-cut-n-val">${p.cutN}</span>
        <input id="kin-cut-n" type="range" min="${L.cutN.min}" max="${L.cutN.max}" value="${p.cutN}" />
      </label>
    </div>

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
      <label title="The pieces click round on their own. Off, they stay put until you turn one by hand"><input id="kin-motion" type="checkbox" ${p.motion ? 'checked' : ''} /><span id="kin-motion-label">${p.mechanism === 'pair' ? ' Halves turn' : ' Rings turn'}</span></label>
      <label title="The view drifts around the object. This turns the camera, not the mechanism"><input id="kin-autorotate" type="checkbox" ${p.autoRotate ? 'checked' : ''} /> Auto-rotate</label>
    </div>

    <div class="buttons">
      <button id="kin-shuffle-seed" title="A different maze on the same mechanism">Shuffle seed</button>
      <button id="kin-shuffle-all" title="A different mechanism as well: sides, rings, ruling, seams and seed">Shuffle all</button>
      <button id="kin-copy-url" class="wide">Copy URL</button>
      <button id="kin-export-pdf" class="wide" title="The pieces and their bulkheads, to print, cut and thread on a 6 mm dowel">${p.mechanism === 'pair' ? 'Export pieces PDF' : 'Export rings PDF'}</button>
      <button id="kin-harder" class="wide" hidden title="The search is a heuristic: more time is another attempt, not a better one, but it usually finds it">Search harder</button>
    </div>

    <div id="kin-progress" class="progress" hidden>
      <div id="kin-progress-fill" class="progress-fill"><span class="progress-stripe"></span></div>
    </div>
    <div id="kin-status" class="status"></div>
    <div id="kin-metrics" class="metrics"></div>

    <div class="legend">
      <div class="key"><span class="dot" style="color:#22bb22;">&#9679;</span>
        <span><b>Start</b> &mdash; where the walk begins</span></div>
      <div class="key"><span class="dot" style="color:#dd2222;">&#9679;</span>
        <span><b>Goal</b> &mdash; where it ends</span></div>
      <div class="note">Both sit on a dead end, and they stay put: the object turns
        underneath them, so the two marks are printed once and mean the same two squares
        however it is turned. A stack has a free rim to put them on; a closed object &mdash;
        a glued pair, a cut solid &mdash; has none, so they go on dead ends that stay dead
        ends in every state. The route between them is redrawn every
        time it settles, and dimmed while it moves &mdash; mid-turn it would mean
        nothing.</div>
    </div>

    ${sourceLinkHTML()}
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
