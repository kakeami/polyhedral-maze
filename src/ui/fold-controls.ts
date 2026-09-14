/**
 * The panel for the folding maze.
 *
 * Deliberately small, and smaller than it first was. The object has one shape
 * and one taping — both settled by what folds rather than by anything a
 * visitor would want to turn — and the mazes are found offline and kept, so
 * there is no seed to set either: there is a handful of mazes at each ruling
 * and a button that moves along them. What is left to choose is how finely the
 * faces are ruled, which maze, and which pose to look at.
 *
 * Built like `controls.ts` and `kinetic-controls.ts`: one string of HTML, then
 * listeners, so the three pages stay recognisably one site.
 */

export interface FoldPose {
  readonly label: string;
  /** Cells on the outside in this pose — different for a cube and a plank. */
  readonly cells: number;
  readonly passages: number;
  readonly perfect: boolean;
}

export interface FoldMetrics {
  readonly poses: readonly FoldPose[];
  readonly poseIndex: number;
  readonly perfectPoses: number;
  readonly maze: number;
  readonly mazes: number;
  readonly cellsPerFace: number;
  /** Set when the maze on show was searched for rather than read off the shelf. */
  readonly searched?: boolean;
}

export interface FoldControlsContext {
  setRulings(rulings: readonly number[], current: number): void;
  setPoses(poses: readonly FoldPose[], current: number): void;
  setMetrics(m: FoldMetrics): void;
  setStatus(text: string): void;
  setProgress(fraction: number | null): void;
  setBusy(busy: boolean): void;
  onPose(cb: (index: number) => void): void;
  onRuling(cb: (cells: number) => void): void;
  onAction(action: string, cb: () => void): void;
  isAutoRotating(): boolean;
}

export function createFoldControls(container: HTMLElement): FoldControlsContext {
  container.innerHTML = buildHTML();
  const el = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;

  const rulingRow = el<HTMLDivElement>('fold-rulings');
  const poseRow = el<HTMLDivElement>('fold-poses');
  const metricsDiv = el<HTMLDivElement>('fold-metrics');
  const statusDiv = el<HTMLDivElement>('fold-status');
  const progressBar = el<HTMLDivElement>('fold-progress');
  const progressFill = el<HTMLDivElement>('fold-progress-fill');
  const anotherBtn = el<HTMLButtonElement>('fold-another');
  const autoRotate = el<HTMLInputElement>('fold-autorotate');

  const actions = new Map<string, () => void>();
  let poseCallback: ((index: number) => void) | null = null;
  let rulingCallback: ((cells: number) => void) | null = null;

  /** Marks the button that was pressed, so the panel answers before the object does. */
  function pickInRow(row: HTMLElement, button: HTMLElement) {
    for (const other of row.querySelectorAll('button')) {
      other.classList.toggle('active', other === button);
    }
  }

  poseRow.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-pose]');
    if (!button) return;
    pickInRow(poseRow, button);
    poseCallback?.(Number(button.dataset['pose']));
  });

  rulingRow.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-cells]');
    if (!button) return;
    pickInRow(rulingRow, button);
    rulingCallback?.(Number(button.dataset['cells']));
  });

  anotherBtn.addEventListener('click', () => actions.get('another')?.());
  autoRotate.addEventListener('change', () => actions.get('auto-rotate')?.());

  return {
    setRulings(rulings, current) {
      rulingRow.innerHTML = rulings.map(cells =>
        `<button type="button" class="category-tab${cells === current ? ' active' : ''}"` +
        ` data-cells="${cells}">${cells} &times; ${cells}</button>`,
      ).join('');
    },
    setPoses(poses, current) {
      poseRow.innerHTML = poses.map((pose, index) =>
        `<button type="button" class="category-tab${index === current ? ' active' : ''}"` +
        ` data-pose="${index}"` +
        `${pose.perfect ? '' : ' title="not a perfect maze in this pose"'}>` +
        `${esc(pose.label)}${pose.perfect ? '' : ' *'}</button>`,
      ).join('');
    },
    setMetrics(m) {
      const pose = m.poses[m.poseIndex];
      metricsDiv.innerHTML = [
        ['Pose', pose ? pose.label : '—'],
        ['Cells on show', pose ? String(pose.cells) : '—'],
        ['Passages here', pose ? String(pose.passages) : '—'],
        ['Perfect in', `${m.perfectPoses} of ${m.poses.length} poses`],
        ['Cells across a face', String(m.cellsPerFace)],
        ['Maze', m.searched ? 'searched for' : `${m.maze} of ${m.mazes}`],
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
      anotherBtn.disabled = busy;
    },
    onPose(cb) {
      poseCallback = cb;
    },
    onRuling(cb) {
      rulingCallback = cb;
    },
    onAction(action, cb) {
      actions.set(action, cb);
    },
    isAutoRotating() {
      return autoRotate.checked;
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

    <label>Cells across a face</label>
    <div class="category-tabs" id="fold-rulings"></div>

    <label>Pose <span class="hint">(it folds its way there)</span></label>
    <div class="category-tabs" id="fold-poses"></div>

    <div class="checkboxes">
      <label><input id="fold-autorotate" type="checkbox" checked /> Drift the view</label>
    </div>

    <div class="buttons">
      <button class="wide" id="fold-another" type="button">Another maze</button>
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
