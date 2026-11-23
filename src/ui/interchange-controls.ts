/**
 * The panel for the interchange maze.
 *
 * The folding page's panel with two sliders more and one switch fewer. The
 * sliders are what this maze is asked for — how many stations, how many folds
 * on the way — and they sit with the ruling, above the pose, because like the
 * ruling they decide which maze it is. The switch that is gone is the one
 * that sets the object folding on its own: here the object folds when the
 * answer is being shown, and showing the answer is what that is for.
 *
 * Built like the other three, with their vocabulary and their order: a number
 * is a slider with its value in the label, a named choice is a select, the
 * seed is a field, and Seed and Style come last.
 */

import { SCENE_PRESETS } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';
import { pageSwitchHTML, sourceLinkHTML } from './page-nav.ts';
import { byId, esc, showToast } from './panel.ts';
import { INTERCHANGE_LIMITS } from './interchange-param-codec.ts';
import type { InterchangeParams } from './interchange-param-codec.ts';

export interface InterchangeMetrics {
  /** The symbols of the stations placed, in order. */
  readonly stations: string;
  readonly folds: number;
  readonly steps: number;
  /** Shapes the way passes through, and how many are walked in at all. */
  readonly shapesOnTheWay: number;
  readonly shapes: number;
  readonly stationsOffTheWay: number;
  /** In the shape on show: cells that can be walked on, of the cells outside. */
  readonly walkableHere: number;
  readonly cellsHere: number;
  readonly squaresToACube: number;
}

export interface InterchangeControlsContext {
  getParams(): InterchangeParams;
  setRulings(rulings: readonly number[], current: number): void;
  setStations(stations: number): void;
  setFolds(folds: number): void;
  setSeed(seed: number): void;
  setStyle(style: PresetId): void;
  /** The shapes that are walked in, and which one is on show. */
  setPoses(labels: readonly string[], current: number): void;
  setPose(index: number): void;
  setShowingSolution(on: boolean): void;
  setMetrics(m: InterchangeMetrics): void;
  setStatus(text: string): void;
  setProgress(fraction: number | null): void;
  setBusy(busy: boolean): void;
  setExportBusy(busy: boolean): void;
  onRuling(cb: (cells: number) => void): void;
  onStations(cb: (stations: number) => void): void;
  onFolds(cb: (folds: number) => void): void;
  onPose(cb: (index: number) => void): void;
  onSeed(cb: (seed: number) => void): void;
  onAction(action: string, cb: () => void): void;
  isAutoRotating(): boolean;
  isShowingSolution(): boolean;
  style(): PresetId;
  showToast(message: string): void;
}

export function createInterchangeControls(
  container: HTMLElement,
  initial: InterchangeParams,
): InterchangeControlsContext {
  container.innerHTML = buildHTML(initial);
  const el = byId(container);

  const cellsSlider = el<HTMLInputElement>('ix-cells');
  const cellsValue = el<HTMLSpanElement>('ix-cells-val');
  const stationsSlider = el<HTMLInputElement>('ix-stations');
  const stationsValue = el<HTMLSpanElement>('ix-stations-val');
  const foldsSlider = el<HTMLInputElement>('ix-folds');
  const foldsValue = el<HTMLSpanElement>('ix-folds-val');
  const poseSelect = el<HTMLSelectElement>('ix-pose');
  const seedInput = el<HTMLInputElement>('ix-seed');
  const styleSelect = el<HTMLSelectElement>('ix-style');
  const solution = el<HTMLInputElement>('ix-solution');
  const autoRotate = el<HTMLInputElement>('ix-autorotate');
  const metricsDiv = el<HTMLDivElement>('ix-metrics');
  const statusDiv = el<HTMLDivElement>('ix-status');
  const progressBar = el<HTMLDivElement>('ix-progress');
  const progressFill = el<HTMLDivElement>('ix-progress-fill');
  const shuffleSeedBtn = el<HTMLButtonElement>('ix-shuffle-seed');
  const shuffleAllBtn = el<HTMLButtonElement>('ix-shuffle-all');
  const copyBtn = el<HTMLButtonElement>('ix-copy-url');
  const exportBtn = el<HTMLButtonElement>('ix-export-pdf');

  const actions = new Map<string, () => void>();
  let rulings: readonly number[] = [];
  let rulingCallback: ((cells: number) => void) | null = null;
  let stationsCallback: ((stations: number) => void) | null = null;
  let foldsCallback: ((folds: number) => void) | null = null;
  let poseCallback: ((index: number) => void) | null = null;
  let seedCallback: ((seed: number) => void) | null = null;
  /** Looking for a maze, and drawing the pattern of one: either keeps the button shut. */
  let searching = false;
  let exporting = false;
  const showExport = () => {
    exportBtn.textContent = exporting ? 'Exporting...' : EXPORT_LABEL;
    exportBtn.disabled = searching || exporting;
  };

  const rulingAt = (index: number) => rulings[index] ?? rulings[0] ?? 0;

  // On `input`, all three: a maze is a few milliseconds, so the object can
  // follow the slider rather than wait for it to be let go.
  cellsSlider.addEventListener('input', () => {
    cellsValue.textContent = String(rulingAt(Number(cellsSlider.value)));
    rulingCallback?.(rulingAt(Number(cellsSlider.value)));
  });
  stationsSlider.addEventListener('input', () => {
    stationsValue.textContent = stationsSlider.value;
    stationsCallback?.(Number(stationsSlider.value));
  });
  foldsSlider.addEventListener('input', () => {
    foldsValue.textContent = foldsSlider.value;
    foldsCallback?.(Number(foldsSlider.value));
  });
  seedInput.addEventListener('change', () => seedCallback?.(Number(seedInput.value)));
  poseSelect.addEventListener('change', () => poseCallback?.(Number(poseSelect.value)));
  solution.addEventListener('change', () => actions.get('solution')?.());
  autoRotate.addEventListener('change', () => actions.get('auto-rotate')?.());
  styleSelect.addEventListener('change', () => actions.get('style')?.());
  shuffleSeedBtn.addEventListener('click', () => actions.get('shuffle-seed')?.());
  shuffleAllBtn.addEventListener('click', () => actions.get('shuffle-all')?.());
  copyBtn.addEventListener('click', () => actions.get('copy-url')?.());
  exportBtn.addEventListener('click', () => actions.get('export-pdf')?.());

  return {
    getParams() {
      return {
        cells: rulingAt(Number(cellsSlider.value)),
        stations: Number(stationsSlider.value),
        folds: Number(foldsSlider.value),
        seed: Number(seedInput.value),
        pose: Number(poseSelect.value),
        showSolution: solution.checked,
        autoRotate: autoRotate.checked,
        style: styleSelect.value as PresetId,
      };
    },
    setRulings(next, current) {
      rulings = next;
      const at = Math.max(0, next.indexOf(current));
      cellsSlider.min = '0';
      cellsSlider.max = String(Math.max(0, next.length - 1));
      cellsSlider.value = String(at);
      cellsValue.textContent = String(rulingAt(at));
    },
    setStations(stations) {
      stationsSlider.value = String(stations);
      stationsValue.textContent = String(stations);
    },
    setFolds(folds) {
      foldsSlider.value = String(folds);
      foldsValue.textContent = String(folds);
    },
    setSeed(seed) {
      seedInput.value = String(seed);
    },
    setStyle(style) {
      styleSelect.value = style;
    },
    setPoses(labels, current) {
      poseSelect.innerHTML = labels.map((label, index) =>
        `<option value="${index}"${index === current ? ' selected' : ''}>${esc(label)}</option>`,
      ).join('');
    },
    setPose(index) {
      poseSelect.value = String(index);
    },
    setShowingSolution(on) {
      solution.checked = on;
    },
    setMetrics(m) {
      metricsDiv.innerHTML = [
        ['Stations', m.stations],
        ['Folds on the way', String(m.folds)],
        ['Steps on the way', String(m.steps)],
        ['Shapes on the way', `${m.shapesOnTheWay} of ${m.shapes}`],
        ['Stations off the way', String(m.stationsOffTheWay)],
        ['Walkable here', `${m.walkableHere} of ${m.cellsHere} cells`],
        ['Squares to a cube', String(m.squaresToACube)],
      ].map(([k, v]) => `<div><span>${esc(k!)}</span><span>${esc(v!)}</span></div>`).join('');
    },
    setStatus(text) {
      statusDiv.textContent = text;
      statusDiv.hidden = text === '';
    },
    setProgress(fraction) {
      if (fraction === null) {
        progressBar.hidden = true;
        return;
      }
      progressBar.hidden = false;
      progressFill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
    },
    setBusy(busy) {
      seedInput.disabled = busy;
      shuffleSeedBtn.disabled = busy;
      shuffleAllBtn.disabled = busy;
      // The maze on show is the one before: its pattern is not what is asked for.
      searching = busy;
      showExport();
    },
    setExportBusy(busy) {
      exporting = busy;
      showExport();
    },
    onRuling(cb) {
      rulingCallback = cb;
    },
    onStations(cb) {
      stationsCallback = cb;
    },
    onFolds(cb) {
      foldsCallback = cb;
    },
    onPose(cb) {
      poseCallback = cb;
    },
    onSeed(cb) {
      seedCallback = cb;
    },
    onAction(action, cb) {
      actions.set(action, cb);
    },
    isAutoRotating() {
      return autoRotate.checked;
    },
    isShowingSolution() {
      return solution.checked;
    },
    style() {
      return styleSelect.value as PresetId;
    },
    showToast,
  };
}

/** The folding page's words for the same eight sheets of cubes. */
const EXPORT_LABEL = 'Export cubes PDF';

const BLURB =
  'The ring of cubes again, with a maze no one shape can solve. ' +
  'Walk it in the shape it is in; on a mark, and only on a mark, fold it ' +
  'into another shape and walk on. There is exactly one way from start to goal.';

function buildHTML(p: InterchangeParams): string {
  const { minStations, maxStations, minFolds, maxFolds, maxSeed } = INTERCHANGE_LIMITS;
  const styleOptions = SCENE_PRESETS.map(style =>
    `<option value="${esc(style.id)}"${style.id === p.style ? ' selected' : ''}>` +
    `${esc(style.label)}</option>`).join('');
  return `
    ${pageSwitchHTML('interchange')}

    <h2>Interchange Maze</h2>
    <p class="blurb">${esc(BLURB)}</p>

    <label>Cells across a face: <span id="ix-cells-val">${p.cells}</span>
      <input id="ix-cells" type="range" min="0" max="0" value="0" />
    </label>

    <label>Stations: <span id="ix-stations-val">${p.stations}</span>
      <input id="ix-stations" type="range" min="${minStations}" max="${maxStations}" value="${p.stations}" />
    </label>

    <label>Folds on the way: <span id="ix-folds-val">${p.folds}</span>
      <input id="ix-folds" type="range" min="${minFolds}" max="${maxFolds}" value="${p.folds}" />
    </label>

    <label>Pose
      <select id="ix-pose"></select>
    </label>

    <label>Seed
      <input id="ix-seed" type="number" min="0" max="${maxSeed}" value="${p.seed}" />
    </label>

    <label>Style
      <select id="ix-style">
        ${styleOptions}
      </select>
    </label>

    <div class="checkboxes">
      <label><input id="ix-solution" type="checkbox" ${p.showSolution ? 'checked' : ''} /> Show solution</label>
      <label><input id="ix-autorotate" type="checkbox" ${p.autoRotate ? 'checked' : ''} /> Auto-rotate</label>
    </div>

    <div class="buttons">
      <button id="ix-shuffle-seed">Shuffle seed</button>
      <button id="ix-shuffle-all">Shuffle all</button>
      <button id="ix-copy-url" class="wide">Copy URL</button>
      <button id="ix-export-pdf" class="wide">${EXPORT_LABEL}</button>
    </div>

    <div class="progress" id="ix-progress" hidden>
      <div class="progress-fill" id="ix-progress-fill"></div>
    </div>
    <div class="status" id="ix-status" hidden></div>
    <div class="metrics" id="ix-metrics"></div>

    <div class="legend">
      <div class="key"><span class="dot" style="color:#22bb22;">&#9679;</span>
        <span><b>Start</b></span></div>
      <div class="key"><span class="dot" style="color:#dd2222;">&#9679;</span>
        <span><b>Goal</b></span></div>
      <div class="key"><span class="dot" style="color:#2f7fff;">&#9679;</span>
        <span><b>Station</b></span></div>
    </div>

    ${sourceLinkHTML()}
  `;
}
