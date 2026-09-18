/**
 * The panel for the folding maze.
 *
 * Deliberately small. An object is a ring of cubes and a taping, both settled
 * by what can be folded rather than by anything a visitor would want to turn,
 * so what is left to set is which of them, how finely it is ruled, and which
 * maze.
 *
 * Which object is a select and not a slider, because the ones on offer are not
 * settings of one thing: a different layout, or the same layout taped another
 * way, folds into a different number of different shapes. It stands first,
 * where the polyhedral page puts the solid, since everything under it is read
 * in terms of it.
 *
 * Which maze is a *seed*, and the two Shuffles beside it are the polyhedral
 * page's, doing the same thing: one asks for a different maze on the same
 * object, the other for a different everything. A seed is only affordable
 * because a maze can now be found in about a second whatever the ruling; when
 * the page shipped a shelf of six this was a slider that ran along them.
 *
 * Built like `controls.ts` and `kinetic-controls.ts`, and with their
 * vocabulary: a number is a slider with its value in the label, a named choice
 * is a select, and a seed is a number field. So the ruling is a slider, the
 * seed is a field, and the pose — a handful of shapes with names — is a select.
 *
 * The order is theirs too, and it is why the pose is not last: every panel
 * here ends with Seed and then Style, so those two are found in the same place
 * whichever maze you are looking at. Above them go the things that describe
 * this object, and the pose among them — which is a liberty, because the pose
 * is not a parameter of the object at all but where it happens to be standing.
 * It is set from the scene as well as from the panel, because the object
 * arrives in a pose a moment after it is asked to, and because, left alone, it
 * goes and folds itself into another one.
 *
 * The ruling slider runs over the *positions* in the list of rulings rather
 * than over the numbers themselves, so that a shipped set with a gap in it —
 * 2, 3, 5 — is still a slider with three stops rather than one that can be
 * dragged somewhere there is no maze.
 *
 * What it does carry that the object does not: the style of the 3D view, and
 * the buttons every page here ends with — a link to what is on screen, and the
 * pattern to print. All of them are named as the other pages name them.
 */

import { SCENE_PRESETS, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';
import type { FoldObjectSummary } from './fold-objects.ts';
import { pageSwitchHTML, sourceLinkHTML } from './page-nav.ts';
import { byId, esc, showToast } from './panel.ts';
import { FOLD_LIMITS } from './fold-param-codec.ts';
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
  /** Set when the maze on show was searched for rather than read off the cache. */
  readonly searched?: boolean;
}

export interface FoldControlsContext {
  /** Everything a link carries, read off the panel as it stands. */
  getParams(): FoldParams;
  /** The rings of cubes on offer, and which one is on show. */
  setObjects(objects: readonly FoldObjectSummary[], current: string): void;
  /**
   * Whether this object has a printed pattern, and what the button says.
   *
   * A ring of prisms has no pattern yet, and a button that fails when it is
   * pressed is worse than one that says why it is not there.
   */
  setExport(state: { enabled: boolean; label: string }): void;
  /** Follows a shuffle that picked a different object. */
  setObject(id: string): void;
  /** The rulings there are mazes for, and which one is on show. */
  setRulings(rulings: readonly number[], current: number): void;
  /** The seed of the maze on show, and whether it came off the cache. */
  setSeed(seed: number, cached: boolean): void;
  /** Used by Shuffle all, which picks a material as well as an object. */
  setStyle(style: PresetId): void;
  setPoses(poses: readonly FoldPose[], current: number): void;
  /** Follows the object into a pose it has finished folding into. */
  setPose(index: number): void;
  setMetrics(m: FoldMetrics): void;
  setStatus(text: string): void;
  setProgress(fraction: number | null): void;
  setBusy(busy: boolean): void;
  onObject(cb: (id: string) => void): void;
  onPose(cb: (index: number) => void): void;
  onRuling(cb: (cells: number) => void): void;
  onSeed(cb: (seed: number) => void): void;
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
  const el = byId(container);

  const objectSelect = el<HTMLSelectElement>('fold-object');
  const objectNote = el<HTMLDivElement>('fold-object-note');
  const cellsSlider = el<HTMLInputElement>('fold-cells');
  const cellsValue = el<HTMLSpanElement>('fold-cells-val');
  const seedInput = el<HTMLInputElement>('fold-seed');
  const seedNote = el<HTMLSpanElement>('fold-seed-note');
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
  const shuffleSeedBtn = el<HTMLButtonElement>('fold-shuffle-seed');
  const shuffleAllBtn = el<HTMLButtonElement>('fold-shuffle-all');

  const actions = new Map<string, () => void>();
  let rulings: readonly number[] = [];
  let objects: readonly FoldObjectSummary[] = [];
  /** What the pattern button says while it is not busy, and whether it works. */
  let exportState = { enabled: true, label: 'Export cubes PDF' };
  let objectCallback: ((id: string) => void) | null = null;
  let poseCallback: ((index: number) => void) | null = null;
  let rulingCallback: ((cells: number) => void) | null = null;
  let seedCallback: ((seed: number) => void) | null = null;

  const rulingAt = (index: number) => rulings[index] ?? rulings[0] ?? 0;
  const blurbOf = (id: string) => objects.find(object => object.id === id)?.blurb ?? '';

  objectSelect.addEventListener('change', () => {
    objectNote.textContent = blurbOf(objectSelect.value);
    objectCallback?.(objectSelect.value);
  });

  // On `input` rather than `change`: the first seeds at every ruling are kept
  // with the page, so dragging this moves between objects that are already in
  // hand and the search never starts. Land on a seed that is not kept and it
  // does, which is what the progress bar is for.
  cellsSlider.addEventListener('input', () => {
    cellsValue.textContent = String(rulingAt(Number(cellsSlider.value)));
    rulingCallback?.(rulingAt(Number(cellsSlider.value)));
  });

  // On `change` rather than `input`: typing 1234 would otherwise ask for the
  // maze at seed 1, then 12, then 123 on the way.
  seedInput.addEventListener('change', () => seedCallback?.(Number(seedInput.value)));
  shuffleSeedBtn.addEventListener('click', () => actions.get('shuffle-seed')?.());
  shuffleAllBtn.addEventListener('click', () => actions.get('shuffle-all')?.());

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
        object: objectSelect.value,
        cells: rulingAt(Number(cellsSlider.value)),
        seed: Number(seedInput.value),
        pose: Number(poseSelect.value),
        showSolution: solution.checked,
        fold: autoFold.checked,
        autoRotate: autoRotate.checked,
        style: styleSelect.value as PresetId,
      };
    },
    setObjects(next, current) {
      objects = next;
      objectSelect.innerHTML = next.map(object =>
        `<option value="${esc(object.id)}"${object.id === current ? ' selected' : ''}>` +
        `${esc(object.label)}</option>`).join('');
      objectSelect.value = current;
      objectNote.textContent = blurbOf(current);
    },
    setObject(id) {
      objectSelect.value = id;
      objectNote.textContent = blurbOf(id);
    },
    setExport(state) {
      exportState = { ...state };
      exportBtn.textContent = state.label;
      exportBtn.disabled = !state.enabled;
      exportBtn.title = state.enabled
        ? 'How the pieces go together, then one sheet for each piece, to print, cut and tape'
        : 'This object has no printed pattern yet';
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
    setSeed(seed, cached) {
      seedInput.value = String(seed);
      // Said quietly, because it is about the page rather than about the maze:
      // the same seed is the same maze either way.
      seedNote.textContent = cached ? '' : 'searched';
    },
    setStyle(style) {
      styleSelect.value = style;
      styleNote.textContent = resolvePreset(style).note;
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
      objectSelect.disabled = busy || objects.length < 2;
      cellsSlider.disabled = busy || rulings.length < 2;
      seedInput.disabled = busy;
      shuffleSeedBtn.disabled = busy;
      shuffleAllBtn.disabled = busy;
    },
    onObject(cb) {
      objectCallback = cb;
    },
    onPose(cb) {
      poseCallback = cb;
    },
    onRuling(cb) {
      rulingCallback = cb;
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
    isAutoFolding() {
      return autoFold.checked;
    },
    isShowingSolution() {
      return solution.checked;
    },
    style() {
      return styleSelect.value as PresetId;
    },
    showToast,
    setExportBusy(busy) {
      exportBtn.textContent = busy ? 'Exporting...' : exportState.label;
      exportBtn.disabled = busy || !exportState.enabled;
    },
  };
}

const BLURB =
  'Cubes taped into a ring, folded into every shape the tape allows. ' +
  'The maze is printed once and never changes; what changes is which part of ' +
  'it is on the outside. Every pose is a perfect maze in its own right.';

function buildHTML(p: FoldParams): string {
  const styleOptions = SCENE_PRESETS.map(style =>
    `<option value="${esc(style.id)}"${style.id === p.style ? ' selected' : ''}>` +
    `${esc(style.label)}</option>`).join('');
  return `
    ${pageSwitchHTML('folding')}

    <h2>Folding Maze</h2>
    <p class="blurb">${esc(BLURB)}</p>

    <label>Object
      <select id="fold-object"></select>
    </label>
    <div class="shape-info" id="fold-object-note"></div>

    <label>Cells across a face: <span id="fold-cells-val">${p.cells}</span>
      <input id="fold-cells" type="range" min="0" max="0" value="0" />
    </label>

    <label>Pose <span class="hint">(it folds its way there)</span>
      <select id="fold-pose"></select>
    </label>

    <label>Seed <span class="hint" id="fold-seed-note"></span>
      <input id="fold-seed" type="number" min="0" max="${FOLD_LIMITS.maxSeed}" value="${p.seed}" />
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
      <button id="fold-shuffle-seed" title="A different maze on the same object. Every seed is a maze that is perfect in every pose; the first few at each ruling come with the page, the rest are found here and now">Shuffle seed</button>
      <button id="fold-shuffle-all" title="A new object, ruling, seed, pose and material — everything except the Show solution, Cubes fold and Auto-rotate switches">Shuffle all</button>
      <button id="fold-copy-url" class="wide">Copy URL</button>
      <button id="fold-export-pdf" class="wide" title="How the cubes go together, then one sheet for each cube, to print, cut and tape">Export cubes PDF</button>
    </div>

    <div class="progress" id="fold-progress" hidden>
      <div class="progress-fill" id="fold-progress-fill"></div>
    </div>
    <div class="status" id="fold-status" hidden></div>
    <div class="metrics" id="fold-metrics"></div>

    <div class="legend">
      <div class="key"><span class="dot" style="color:#22bb22;">&#9679;</span>
        <span><b>Start</b> &mdash; where the walk begins</span></div>
      <div class="key"><span class="dot" style="color:#dd2222;">&#9679;</span>
        <span><b>Goal</b> &mdash; where it ends</span></div>
      <div class="note">Each mark is printed on <b>two</b> squares, and exactly one of
        the two is on the outside in any pose &mdash; a ring of cubes buries part of
        itself, and what it buries changes as it folds. Fold the object and the mark you
        were looking at goes inside while its twin comes out. Both are drawn here, so the
        buried one is hidden in the cube it is pressed against.</div>
    </div>

    ${sourceLinkHTML()}
  `;
}

