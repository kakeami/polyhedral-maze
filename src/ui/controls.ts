import type { MazeParams } from './param-codec.ts';
import type { Algorithm } from '../core/maze.ts';
import type { MazeMetrics } from '../core/metrics.ts';
import {
  SHAPES,
  CATEGORY_LABELS,
  getShape,
  shapesByCategory,
  availableCategories,
} from '../core/polyhedra/registry.ts';
import type { ShapeCategory, ShapeDescriptor } from '../core/polyhedra/registry.ts';
import { SCENE_PRESETS, resolvePreset } from '../render/scene-presets.ts';
import type { PresetId } from '../render/scene-presets.ts';

export interface ControlsContext {
  container: HTMLElement;
  getParams(): MazeParams;
  setMetrics(m: MazeMetrics): void;
  getAutoRotate(): boolean;
  onChange(cb: () => void): void;
  onAction(action: string, cb: () => void): void;
  showToast(message: string): void;
  setExportBusy(busy: boolean): void;
  setFacePagesBusy(busy: boolean, progress?: string): void;
}

const ALL_CATEGORIES = '__all__';
type CategoryScope = ShapeCategory | typeof ALL_CATEGORIES;

export function createControls(container: HTMLElement, initial: MazeParams): ControlsContext {
  const initialShape = getShape(initial.shape) ?? SHAPES[0]!;
  const initialCategory: CategoryScope = initialShape.category;

  container.innerHTML = buildHTML(initial, initialCategory);

  const el = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;

  const categorySelect = el<HTMLSelectElement>('ctrl-category');
  const shapeSelect = el<HTMLSelectElement>('ctrl-shape');
  const shapeInfo = el<HTMLDivElement>('ctrl-shape-info');
  const nSlider = el<HTMLInputElement>('ctrl-n');
  const nValue = el<HTMLSpanElement>('ctrl-n-val');
  const kSlider = el<HTMLInputElement>('ctrl-k');
  const kValue = el<HTMLSpanElement>('ctrl-k-val');
  const algoSelect = el<HTMLSelectElement>('ctrl-algo');
  const seedInput = el<HTMLInputElement>('ctrl-seed');
  const styleSelect = el<HTMLSelectElement>('ctrl-style');
  const styleNote = el<HTMLDivElement>('ctrl-style-note');
  const warpCheck = el<HTMLInputElement>('ctrl-warp');
  const solutionCheck = el<HTMLInputElement>('ctrl-solution');
  const metricsDiv = el<HTMLDivElement>('ctrl-metrics');

  const callbacks: (() => void)[] = [];
  const actions = new Map<string, () => void>();

  function fire() {
    callbacks.forEach(cb => cb());
  }

  function shapesInScope(): ShapeDescriptor[] {
    const cat = categorySelect.value as CategoryScope;
    return cat === ALL_CATEGORIES ? [...SHAPES] : shapesByCategory(cat as ShapeCategory);
  }

  function renderShapeOptions(preselectId?: string) {
    const cat = categorySelect.value as CategoryScope;
    const showCategoryGroups = cat === ALL_CATEGORIES;
    const shapes = shapesInScope();

    let html = '';
    if (showCategoryGroups) {
      const byCat = new Map<ShapeCategory, ShapeDescriptor[]>();
      for (const s of shapes) {
        if (!byCat.has(s.category)) byCat.set(s.category, []);
        byCat.get(s.category)!.push(s);
      }
      for (const c of availableCategories()) {
        const group = byCat.get(c);
        if (!group || group.length === 0) continue;
        html += `<optgroup label="${esc(CATEGORY_LABELS[c])}">`;
        for (const s of group) {
          html += `<option value="${esc(s.id)}">${esc(s.name)}</option>`;
        }
        html += `</optgroup>`;
      }
    } else {
      html = shapes.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    }
    shapeSelect.innerHTML = html;

    const target = preselectId && shapes.some(s => s.id === preselectId)
      ? preselectId
      : shapes[0]!.id;
    shapeSelect.value = target;
    updateShapeInfo();
  }

  function updateShapeInfo() {
    const s = getShape(shapeSelect.value);
    if (!s) {
      shapeInfo.textContent = '';
      return;
    }
    const catLabel = CATEGORY_LABELS[s.category];
    shapeInfo.textContent = `${catLabel} · ${s.faceComposition} · ${s.faceCount} faces`;
  }

  categorySelect.addEventListener('change', () => {
    renderShapeOptions();
    fire();
  });
  shapeSelect.addEventListener('change', () => { updateShapeInfo(); fire(); });

  nSlider.addEventListener('input', () => { nValue.textContent = nSlider.value; fire(); });
  kSlider.addEventListener('input', () => { kValue.textContent = kSlider.value; fire(); });
  for (const input of [algoSelect, seedInput, warpCheck, solutionCheck]) {
    input.addEventListener('change', fire);
  }

  el('btn-shuffle-seed').addEventListener('click', () => {
    seedInput.value = String(randomSeed());
    fire();
  });

  // Everything the catalogue offers, in one press. Warp and Show solution are
  // deliberately left alone: they are how you are reading the maze, not which
  // maze it is, and one of them gives the answer away.
  el('btn-shuffle-all').addEventListener('click', () => {
    const shape = randomShape();
    categorySelect.value = shape.category;
    renderShapeOptions(shape.id);

    algoSelect.selectedIndex = randomIndex(algoSelect.options.length);
    styleSelect.selectedIndex = randomIndex(styleSelect.options.length);
    updateStyleNote();

    nSlider.value = String(randomWithinSlider(nSlider));
    nValue.textContent = nSlider.value;
    kSlider.value = String(randomWithinSlider(kSlider));
    kValue.textContent = kSlider.value;
    seedInput.value = String(randomSeed());

    // The style goes straight to the scene; the rest needs a rebuild.
    actions.get('style')?.();
    fire();
  });
  el('btn-copy-url').addEventListener('click', () => {
    actions.get('copy-url')?.();
  });
  el('btn-export-pdf').addEventListener('click', () => {
    actions.get('export-pdf')?.();
  });
  el('btn-export-faces').addEventListener('click', () => {
    actions.get('export-face-pages')?.();
  });

  function updateStyleNote() {
    styleNote.textContent = resolvePreset(styleSelect.value).note;
  }
  updateStyleNote();
  styleSelect.addEventListener('change', () => {
    updateStyleNote();
    actions.get('style')?.();
  });

  const autoRotateCheck = el<HTMLInputElement>('ctrl-auto-rotate');
  autoRotateCheck.addEventListener('change', () => {
    actions.get('auto-rotate')?.();
  });

  function getParams(): MazeParams {
    return {
      shape: shapeSelect.value,
      n: Number(nSlider.value),
      k: Number(kSlider.value),
      algorithm: algoSelect.value as Algorithm,
      seed: Number(seedInput.value),
      warp: warpCheck.checked,
      showSolution: solutionCheck.checked,
      style: styleSelect.value as PresetId,
    };
  }

  function setMetrics(m: MazeMetrics) {
    metricsDiv.innerHTML = `
      <div>Cells: <b>${m.totalCells}</b></div>
      <div>Solution: <b>${m.solutionLength}</b> (${(m.solutionRatio * 100).toFixed(1)}%)</div>
      <div>Dead ends: <b>${m.deadEndCount}</b> (${(m.deadEndDensity * 100).toFixed(1)}%)</div>
      <div>Face crossings: <b>${m.faceCrossings}</b></div>
      <div>Faces visited: <b>${m.faceCoverage}</b>/${m.totalFaces}</div>
      ${m.warpUsed ? '<div>Warp: <b>used</b></div>' : ''}
    `;
  }

  renderShapeOptions(initialShape.id);

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
    toastTimer = setTimeout(() => toast?.classList.remove('show'), 1800);
  }

  const exportBtn = el<HTMLButtonElement>('btn-export-pdf');
  function setExportBusy(busy: boolean) {
    exportBtn.disabled = busy;
    exportBtn.textContent = busy ? 'Exporting...' : 'Export net PDF';
  }

  const facesBtn = el<HTMLButtonElement>('btn-export-faces');
  function setFacePagesBusy(busy: boolean, progress?: string) {
    facesBtn.disabled = busy;
    facesBtn.textContent = busy
      ? (progress ? `Exporting ${progress}...` : 'Exporting...')
      : 'Export face pages PDF';
  }

  return {
    container,
    getParams,
    setMetrics,
    getAutoRotate() { return autoRotateCheck.checked; },
    onChange(cb) { callbacks.push(cb); },
    onAction(action, cb) { actions.set(action, cb); },
    showToast,
    setExportBusy,
    setFacePagesBusy,
  };
}

function randomIndex(count: number): number {
  return Math.floor(Math.random() * count);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1000000);
}

/** A value in the slider's own range, so the bounds stay declared in one place. */
function randomWithinSlider(slider: HTMLInputElement): number {
  const min = Number(slider.min);
  const max = Number(slider.max);
  return min + randomIndex(max - min + 1);
}

/**
 * A category first, then a shape inside it. Drawing uniformly from all shapes
 * would land on a Johnson solid about two times in three — they are 92 of the
 * catalogue — and the point of the button is to tour the catalogue rather than
 * its largest family.
 */
function randomShape(): ShapeDescriptor {
  const categories = availableCategories();
  const inCategory = shapesByCategory(categories[randomIndex(categories.length)]!);
  return inCategory.length > 0
    ? inCategory[randomIndex(inCategory.length)]!
    : SHAPES[randomIndex(SHAPES.length)]!;
}

function buildHTML(p: MazeParams, activeCategory: CategoryScope): string {
  const styleOptions = SCENE_PRESETS.map(s =>
    `<option value="${esc(s.id)}"${s.id === p.style ? ' selected' : ''}>${esc(s.label)}</option>`,
  ).join('');

  const categories = availableCategories();
  const categoryOptions = [
    ...categories.map(c =>
      `<option value="${esc(c)}"${c === activeCategory ? ' selected' : ''}>${esc(CATEGORY_LABELS[c])}</option>`,
    ),
    `<option value="${ALL_CATEGORIES}"${activeCategory === ALL_CATEGORIES ? ' selected' : ''}>All categories</option>`,
  ].join('');

  return `
    <h2>Polyhedral Maze</h2>

    <label>Category
      <select id="ctrl-category">
        ${categoryOptions}
      </select>
    </label>

    <label>Shape
      <select id="ctrl-shape"></select>
    </label>
    <div class="shape-info" id="ctrl-shape-info"></div>

    <label>Algorithm
      <select id="ctrl-algo">
        <option value="KRUSKAL"${p.algorithm === 'KRUSKAL' ? ' selected' : ''}>Kruskal</option>
        <option value="DFS"${p.algorithm === 'DFS' ? ' selected' : ''}>DFS</option>
        <option value="WILSON"${p.algorithm === 'WILSON' ? ' selected' : ''}>Wilson</option>
      </select>
    </label>

    <label>n (resolution): <span id="ctrl-n-val">${p.n}</span>
      <input id="ctrl-n" type="range" min="2" max="12" value="${p.n}" />
    </label>

    <label>k (passages): <span id="ctrl-k-val">${p.k}</span>
      <input id="ctrl-k" type="range" min="1" max="4" value="${p.k}" />
    </label>

    <label>Seed
      <input id="ctrl-seed" type="number" min="0" max="999999" value="${p.seed}" />
    </label>

    <label>Style <span class="hint">(3D view only)</span>
      <select id="ctrl-style">
        ${styleOptions}
      </select>
    </label>
    <div class="shape-info" id="ctrl-style-note"></div>

    <div class="checkboxes">
      <label><input id="ctrl-warp" type="checkbox" ${p.warp ? 'checked' : ''} /> Warp</label>
      <label><input id="ctrl-solution" type="checkbox" ${p.showSolution ? 'checked' : ''} /> Show solution</label>
      <label><input id="ctrl-auto-rotate" type="checkbox" checked /> Auto-rotate</label>
    </div>

    <div class="buttons">
      <button id="btn-shuffle-seed" title="A different maze on the same solid">Shuffle seed</button>
      <button id="btn-shuffle-all" title="A new solid, algorithm, resolution, seed and material — everything except the Warp and Show solution switches">Shuffle all</button>
      <button id="btn-copy-url" class="wide">Copy URL</button>
      <button id="btn-export-pdf" class="wide" title="Two pages: the whole net as a puzzle, plus the answer">Export net PDF</button>
      <button id="btn-export-faces" class="wide" title="One page per face, all at the same scale — for large papercraft">Export face pages PDF</button>
    </div>

    <div id="ctrl-metrics" class="metrics"></div>

    <div class="legend">
      <span style="color:#22bb22;">&#9679;</span> Start
      <span style="color:#dd2222; margin-left:0.8em;">&#9679;</span> Goal
      <span style="color:#eecc00; margin-left:0.8em;">&#9679;</span> Warp
    </div>

    <div class="nav-links">
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
