/**
 * The panel for the folding maze.
 *
 * Deliberately small. The object has one shape and one taping — both settled
 * by what folds rather than by anything a visitor would want to turn — and the
 * mazes are found offline and kept, so there is no seed to set either: there
 * is a handful of mazes at each ruling and a slider that moves along them.
 *
 * Built like `controls.ts` and `kinetic-controls.ts`, and with their
 * vocabulary: a number is a slider with its value in the label, a named choice
 * is a select. So the ruling and which maze are sliders, and the pose — six
 * shapes with names — is a select.
 *
 * The pose is the odd one out, and is put last on purpose. It is not a
 * parameter of the object at all: it is where the object happens to be
 * standing, the same thing a hand on a ring decides on the kinetic page. It
 * sits below the things that describe the object, and it is set from the scene
 * as well as from the panel — because the object arrives in a pose a moment
 * after it is asked to, and because, left alone, it goes and folds itself into
 * another one.
 *
 * The ruling slider runs over the *positions* in the list of rulings rather
 * than over the numbers themselves, so that a shipped set with a gap in it —
 * 2, 3, 5 — is still a slider with three stops rather than one that can be
 * dragged somewhere there is no maze.
 *
 * What it does carry that the object does not: the style of the 3D view, and
 * the two buttons every page here ends with — a link to what is on screen, and
 * the pattern to print. Both are named as the other pages name them.
 */

import { SCENE_PRESETS, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';
import type { FoldParams } from './fold-param-codec.ts';

export interface FoldPose {
  readonly label: string;
  /** Cells on the outside in this pose — different for a cube and a plank. */
  readonly cells: number;
  readonly passages: number;
  /** The longest walk through this pose: the maze's own diameter. */
  readonly longestWalk: number;
  readonly perfect: boolean;
}

export interface FoldMetrics {
  readonly poses: readonly FoldPose[];
  readonly poseIndex: number;
  readonly perfectPoses: number;
  readonly cellsPerFace: number;
  /** Steps from the entrance to the exit in the pose on show. */
  readonly solutionLength: number;
  /** Set when the maze on show was searched for rather than read off the shelf. */
  readonly searched?: boolean;
}

export interface FoldControlsContext {
  /** Everything a link carries, read off the panel as it stands. */
  getParams(): FoldParams;
  /** The rulings there are mazes for, and which one is on show. */
  setRulings(rulings: readonly number[], current: number): void;
  /** How many mazes this ruling has, and which of them is on show (from one). */
  setMazes(count: number, current: number): void;
  setPoses(poses: readonly FoldPose[], current: number): void;
  /** Follows the object into a pose it has finished folding into. */
  setPose(index: number): void;
  setMetrics(m: FoldMetrics): void;
  setStatus(text: string): void;
  setProgress(fraction: number | null): void;
  setBusy(busy: boolean): void;
  onPose(cb: (index: number) => void): void;
  onRuling(cb: (cells: number) => void): void;
  onMaze(cb: (maze: number) => void): void;
  onAction(action: string, cb: () => void): void;
  isAutoRotating(): boolean;
  isAutoFolding(): boolean;
  isShowingSolution(): boolean;
  style(): PresetId;
  showToast(message: string): void;
  setExportBusy(busy: boolean): void;
}

export function createFoldControls(
  container: HTMLElement,
  initial: FoldParams,
): FoldControlsContext {
  container.innerHTML = buildHTML(initial);
  const el = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;

  const cellsSlider = el<HTMLInputElement>('fold-cells');
  const cellsValue = el<HTMLSpanElement>('fold-cells-val');
  const mazeSlider = el<HTMLInputElement>('fold-maze');
  const mazeValue = el<HTMLSpanElement>('fold-maze-val');
  const poseSelect = el<HTMLSelectElement>('fold-pose');
  const metricsDiv = el<HTMLDivElement>('fold-metrics');
  const statusDiv = el<HTMLDivElement>('fold-status');
  const progressBar = el<HTMLDivElement>('fold-progress');
  const progressFill = el<HTMLDivElement>('fold-progress-fill');
  const autoRotate = el<HTMLInputElement>('fold-autorotate');
  const autoFold = el<HTMLInputElement>('fold-autofold');
  const solution = el<HTMLInputElement>('fold-solution');
  const styleSelect = el<HTMLSelectElement>('fold-style');
  const styleNote = el<HTMLDivElement>('fold-style-note');
  const exportBtn = el<HTMLButtonElement>('fold-export-pdf');
  const copyBtn = el<HTMLButtonElement>('fold-copy-url');
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const actions = new Map<string, () => void>();
  let rulings: readonly number[] = [];
  let poseCallback: ((index: number) => void) | null = null;
  let rulingCallback: ((cells: number) => void) | null = null;
  let mazeCallback: ((maze: number) => void) | null = null;

  const rulingAt = (index: number) => rulings[index] ?? rulings[0] ?? 0;

  // On `input` rather than `change`: a maze is read off the shelf and put on
  // screen in a few milliseconds, so a slider can be dragged through them and
  // the object keeps up. Neither of these sliders starts a search.
  cellsSlider.addEventListener('input', () => {
    cellsValue.textContent = String(rulingAt(Number(cellsSlider.value)));
    rulingCallback?.(rulingAt(Number(cellsSlider.value)));
  });

  mazeSlider.addEventListener('input', () => {
    mazeValue.textContent = `${mazeSlider.value} of ${mazeSlider.max}`;
    mazeCallback?.(Number(mazeSlider.value));
  });

  poseSelect.addEventListener('change', () => poseCallback?.(Number(poseSelect.value)));

  solution.addEventListener('change', () => actions.get('solution')?.());
  autoRotate.addEventListener('change', () => actions.get('auto-rotate')?.());
  autoFold.addEventListener('change', () => actions.get('auto-fold')?.());
  exportBtn.addEventListener('click', () => actions.get('export-pdf')?.());
  copyBtn.addEventListener('click', () => actions.get('copy-url')?.());
  styleSelect.addEventListener('change', () => {
    styleNote.textContent = resolvePreset(styleSelect.value).note;
    actions.get('style')?.();
  });
  styleNote.textContent = resolvePreset(styleSelect.value).note;

  return {
    getParams() {
      return {
        cells: rulingAt(Number(cellsSlider.value)),
        maze: Number(mazeSlider.value),
        pose: Number(poseSelect.value),
        showSolution: solution.checked,
        fold: autoFold.checked,
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
      cellsSlider.disabled = next.length < 2;
      cellsValue.textContent = String(rulingAt(at));
    },
    setMazes(count, current) {
      mazeSlider.min = '1';
      mazeSlider.max = String(Math.max(1, count));
      mazeSlider.value = String(Math.min(Math.max(1, current), Math.max(1, count)));
      mazeSlider.disabled = count < 2;
      mazeValue.textContent = count > 0
        ? `${mazeSlider.value} of ${mazeSlider.max}`
        : 'searched for';
    },
    setPoses(poses, current) {
      poseSelect.innerHTML = poses.map((pose, index) =>
        `<option value="${index}"${index === current ? ' selected' : ''}>` +
        `${esc(pose.label)}${pose.perfect ? '' : ' (not a perfect maze here)'}</option>`,
      ).join('');
    },
    setPose(index) {
      poseSelect.value = String(index);
    },
    setMetrics(m) {
      const pose = m.poses[m.poseIndex];
      metricsDiv.innerHTML = [
        ['Cells on show', pose ? String(pose.cells) : '—'],
        ['Passages here', pose ? String(pose.passages) : '—'],
        ['Longest walk here', pose ? String(pose.longestWalk) : '—'],
        ['Solution here', `${m.solutionLength} steps`],
        ['Perfect in', `${m.perfectPoses} of ${m.poses.length} poses`],
        ['Squares to a cube', `${m.cellsPerFace * m.cellsPerFace * 6}`],
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
      cellsSlider.disabled = busy || rulings.length < 2;
      mazeSlider.disabled = busy || Number(mazeSlider.max) < 2;
    },
    onPose(cb) {
      poseCallback = cb;
    },
    onRuling(cb) {
      rulingCallback = cb;
    },
    onMaze(cb) {
      mazeCallback = cb;
    },
    onAction(action, cb) {
      actions.set(action, cb);
    },
    isAutoRotating() {
      return autoRotate.checked;
    },
    isAutoFolding() {
      return autoFold.checked;
    },
    isShowingSolution() {
      return solution.checked;
    },
    style() {
      return styleSelect.value as PresetId;
    },
    showToast(message) {
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
    },
    setExportBusy(busy) {
      exportBtn.disabled = busy;
      exportBtn.textContent = busy ? 'Exporting...' : 'Export cubes PDF';
    },
  };
}

const BLURB =
  'Eight cubes taped into a ring, folded into every shape the tape allows. ' +
  'The maze is printed once and never changes; what changes is which half of ' +
  'it is on the outside. Every pose is a perfect maze in its own right.';

function buildHTML(p: FoldParams): string {
  const styleOptions = SCENE_PRESETS.map(style =>
    `<option value="${esc(style.id)}"${style.id === p.style ? ' selected' : ''}>` +
    `${esc(style.label)}</option>`).join('');
  return `
    <h2>Folding Maze</h2>
    <p class="blurb">${esc(BLURB)}</p>

    <label>Cells across a face: <span id="fold-cells-val">${p.cells}</span>
      <input id="fold-cells" type="range" min="0" max="0" value="0" />
    </label>

    <label>Maze: <span id="fold-maze-val">1 of 1</span>
      <input id="fold-maze" type="range" min="1" max="1" value="1" />
    </label>

    <label>Pose <span class="hint">(it folds its way there)</span>
      <select id="fold-pose"></select>
    </label>

    <label>Style <span class="hint">(3D view only)</span>
      <select id="fold-style">
        ${styleOptions}
      </select>
    </label>
    <div class="shape-info" id="fold-style-note"></div>

    <div class="checkboxes">
      <label title="The way from the entrance to the exit in the pose on show. It is a different way in every pose"><input id="fold-solution" type="checkbox" ${p.showSolution ? 'checked' : ''} /> Show solution</label>
      <label title="It goes from pose to pose on its own, a fold at a time, and keeps out of your way for a few seconds after you have asked for something. Off, it stays where it is put"><input id="fold-autofold" type="checkbox" ${p.fold ? 'checked' : ''} /> Cubes fold</label>
      <label title="The view drifts around the object. This turns the camera, not the object"><input id="fold-autorotate" type="checkbox" ${p.autoRotate ? 'checked' : ''} /> Auto-rotate</label>
    </div>

    <div class="buttons">
      <button id="fold-copy-url" class="wide">Copy URL</button>
      <button id="fold-export-pdf" class="wide" title="Nine sheets: how the eight cubes go together, then one cube each, to print, cut and tape">Export cubes PDF</button>
    </div>

    <div class="progress" id="fold-progress" hidden>
      <div class="progress-fill" id="fold-progress-fill"></div>
    </div>
    <div class="status" id="fold-status" hidden></div>
    <div class="metrics" id="fold-metrics"></div>

    <div class="nav-links">
      <a href="../">&#8592; Polyhedral maze</a>
      <a href="../kinetic/">Kinetic maze &#8594;</a>
    </div>
  `;
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}
