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
 */

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
  /** Set when the maze on show was searched for rather than read off the shelf. */
  readonly searched?: boolean;
}

export interface FoldControlsContext {
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
}

export function createFoldControls(container: HTMLElement): FoldControlsContext {
  container.innerHTML = buildHTML();
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

  autoRotate.addEventListener('change', () => actions.get('auto-rotate')?.());
  autoFold.addEventListener('change', () => actions.get('auto-fold')?.());

  return {
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
  };
}

const BLURB =
  'Eight cubes taped into a ring, folded into every shape the tape allows. ' +
  'The maze is printed once and never changes; what changes is which half of ' +
  'it is on the outside. Every pose is a perfect maze in its own right.';

function buildHTML(): string {
  return `
    <h2>Folding Maze</h2>
    <p class="blurb">${esc(BLURB)}</p>

    <label>Cells across a face: <span id="fold-cells-val">3</span>
      <input id="fold-cells" type="range" min="0" max="0" value="0" />
    </label>

    <label>Maze: <span id="fold-maze-val">1 of 1</span>
      <input id="fold-maze" type="range" min="1" max="1" value="1" />
    </label>

    <label>Pose <span class="hint">(it folds its way there)</span>
      <select id="fold-pose"></select>
    </label>

    <div class="checkboxes">
      <label title="It goes from pose to pose on its own, a fold at a time, and keeps out of your way for a few seconds after you have asked for something. Off, it stays where it is put"><input id="fold-autofold" type="checkbox" checked /> Cubes fold</label>
      <label title="The view drifts around the object. This turns the camera, not the object"><input id="fold-autorotate" type="checkbox" checked /> Auto-rotate</label>
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
