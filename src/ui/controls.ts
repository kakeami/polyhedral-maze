import type { MazeParams } from './param-codec.ts';
import { randomSeed } from './param-codec.ts';
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
import { pageSwitchHTML, sourceLinkHTML } from './page-nav.ts';
import { byId, esc, randomIndex, randomWithinSlider, showToast } from './panel.ts';

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

/**
 * All three produce a perfect maze — one route between any two cells, no loops
 * — so what the choice changes is the character of the maze, not its validity.
 */
const ALGORITHM_NOTES: Record<Algorithm, string> = {
  KRUSKAL: 'Grows from everywhere at once: short branches, dead ends spread evenly.',
  DFS: 'Follows its nose until it is stuck: long winding corridors, fewer dead ends.',
  WILSON: 'Unbiased — every possible maze on this solid is equally likely.',
};

const ALL_CATEGORIES = '__all__';
type CategoryScope = ShapeCategory | typeof ALL_CATEGORIES;

export function createControls(container: HTMLElement, initial: MazeParams): ControlsContext {
  const initialShape = getShape(initial.shape) ?? SHAPES[0]!;
  const initialCategory: CategoryScope = initialShape.category;

  container.innerHTML = buildHTML(initial, initialCategory);

  const el = byId(container);

  const categorySelect = el<HTMLSelectElement>('ctrl-category');
  const shapeSelect = el<HTMLSelectElement>('ctrl-shape');
  const shapeInfo = el<HTMLDivElement>('ctrl-shape-info');
  const nSlider = el<HTMLInputElement>('ctrl-n');
  const nValue = el<HTMLSpanElement>('ctrl-n-val');
  const kSlider = el<HTMLInputElement>('ctrl-k');
  const kValue = el<HTMLSpanElement>('ctrl-k-val');
  const algoSelect = el<HTMLSelectElement>('ctrl-algo');
  const algoNote = el<HTMLDivElement>('ctrl-algo-note');
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
    updateAlgoNote();
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

  function updateAlgoNote() {
    algoNote.textContent = ALGORITHM_NOTES[algoSelect.value as Algorithm] ?? '';
  }
  updateAlgoNote();
  algoSelect.addEventListener('change', updateAlgoNote);

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
      <div>Solution: <b>${m.solutionLength}</b>
        <span class="hint">${(m.solutionRatio * 100).toFixed(1)}% of the maze</span></div>
      <div>Dead ends: <b>${m.deadEndCount}</b>
        <span class="hint">${(m.deadEndDensity * 100).toFixed(1)}% of cells</span></div>
      <div>Face crossings: <b>${m.faceCrossings}</b>
        <span class="hint">edges the answer runs over</span></div>
      <div>Faces visited: <b>${m.faceCoverage}</b>
        <span class="hint">of ${m.totalFaces}</span></div>
      ${m.warpUsed ? '<div>Warp: <b>on the answer</b></div>' : ''}
    `;
  }

  renderShapeOptions(initialShape.id);


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
    // Shorter than the default: what this panel says is "URL copied", where
    // the turning and folding panels report measurements worth reading twice.
    showToast: message => showToast(message, 1800),
    setExportBusy,
    setFacePagesBusy,
  };
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
    ${pageSwitchHTML('polyhedral')}

    <h2>Polyhedral Maze</h2>
    <p class="blurb">
      A maze across the whole surface of a solid, corridors running over the
      edges from face to face. It is a perfect maze: exactly one way from the
      green pin to the red one, and no loops anywhere. Drag to turn the solid,
      or print it flat and build it.
    </p>

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
    <div class="shape-info" id="ctrl-algo-note"></div>

    <label>n <span class="hint">(cells along a face edge)</span>: <span id="ctrl-n-val">${p.n}</span>
      <input id="ctrl-n" type="range" min="2" max="12" value="${p.n}" />
    </label>

    <label>k <span class="hint">(passages across each edge)</span>: <span id="ctrl-k-val">${p.k}</span>
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
      <label title="A skewer straight through the solid, surfacing on the far side: the one passage that does not run along the surface"><input id="ctrl-warp" type="checkbox" ${p.warp ? 'checked' : ''} /> Warp</label>
      <label><input id="ctrl-solution" type="checkbox" ${p.showSolution ? 'checked' : ''} /> Show solution</label>
      <label><input id="ctrl-auto-rotate" type="checkbox" checked /> Auto-rotate</label>
    </div>

    <div class="buttons">
      <button id="btn-shuffle-seed" title="A different maze on the same solid">Shuffle seed</button>
      <button id="btn-shuffle-all" title="A new solid, algorithm, resolution, seed and material — everything except the Warp and Show solution switches">Shuffle all</button>
      <button id="btn-copy-url" class="wide">Copy URL</button>
      <button id="btn-export-pdf" class="wide" title="Two pages: the whole net as a puzzle, plus the answer">Export net PDF</button>
      <button id="btn-export-faces" class="wide" title="Every face as a cut-out piece, all at the same scale, packed several to a sheet — for large papercraft">Export face pages PDF</button>
    </div>

    <div id="ctrl-metrics" class="metrics"></div>

    <div class="legend">
      <div class="key"><span class="dot" style="color:#22bb22;">&#9679;</span>
        <span><b>Start</b> &mdash; where the walk begins, on a dead end of the solid</span></div>
      <div class="key"><span class="dot" style="color:#dd2222;">&#9679;</span>
        <span><b>Goal</b> &mdash; where it ends, as far from the start as the maze allows</span></div>
      <div class="key"><span class="dot" style="color:#eecc00;">&#9679;</span>
        <span><b>Warp</b> &mdash; the two mouths of a passage straight through the solid</span></div>
      <div class="note">The pins stand up out of the surface so they can be found from
        any angle; the maze itself runs along the faces.</div>
    </div>

    ${sourceLinkHTML()}
  `;
}

