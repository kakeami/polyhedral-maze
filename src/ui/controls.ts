import type { MazeParams } from './param-codec.ts';
import type { MazeMetrics } from '../core/metrics.ts';

export interface ControlsContext {
  container: HTMLElement;
  getParams(): MazeParams;
  setParams(p: MazeParams): void;
  setMetrics(m: MazeMetrics): void;
  onChange(cb: () => void): void;
  onAction(action: string, cb: () => void): void;
}

export function createControls(container: HTMLElement, initial: MazeParams): ControlsContext {
  container.innerHTML = buildHTML(initial);

  const el = <T extends HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;

  const shapeSelect = el<HTMLSelectElement>('ctrl-shape');
  const nSlider = el<HTMLInputElement>('ctrl-n');
  const nValue = el<HTMLSpanElement>('ctrl-n-val');
  const kSlider = el<HTMLInputElement>('ctrl-k');
  const kValue = el<HTMLSpanElement>('ctrl-k-val');
  const algoSelect = el<HTMLSelectElement>('ctrl-algo');
  const seedInput = el<HTMLInputElement>('ctrl-seed');
  const warpCheck = el<HTMLInputElement>('ctrl-warp');
  const solutionCheck = el<HTMLInputElement>('ctrl-solution');
  const labelsCheck = el<HTMLInputElement>('ctrl-labels');
  const metricsDiv = el<HTMLDivElement>('ctrl-metrics');

  const callbacks: (() => void)[] = [];
  const actions = new Map<string, (() => void)[]>();

  function fire() {
    callbacks.forEach(cb => cb());
  }

  // Sync slider display values
  nSlider.addEventListener('input', () => { nValue.textContent = nSlider.value; fire(); });
  kSlider.addEventListener('input', () => { kValue.textContent = kSlider.value; fire(); });
  for (const input of [shapeSelect, algoSelect, seedInput, warpCheck, solutionCheck, labelsCheck]) {
    input.addEventListener('change', fire);
  }

  // Action buttons
  el('btn-regenerate').addEventListener('click', () => {
    seedInput.value = String(Number(seedInput.value) + 1);
    fire();
    actions.get('regenerate')?.forEach(cb => cb());
  });
  el('btn-random').addEventListener('click', () => {
    seedInput.value = String(Math.floor(Math.random() * 999999));
    fire();
    actions.get('random')?.forEach(cb => cb());
  });
  el('btn-copy-url').addEventListener('click', () => {
    actions.get('copy-url')?.forEach(cb => cb());
  });
  el('btn-export-pdf').addEventListener('click', () => {
    actions.get('export-pdf')?.forEach(cb => cb());
  });

  function getParams(): MazeParams {
    return {
      shape: shapeSelect.value,
      n: Number(nSlider.value),
      k: Number(kSlider.value),
      algorithm: algoSelect.value,
      seed: Number(seedInput.value),
      warp: warpCheck.checked,
      showSolution: solutionCheck.checked,
      showLabels: labelsCheck.checked,
    };
  }

  function setParams(p: MazeParams) {
    shapeSelect.value = p.shape;
    nSlider.value = String(p.n);
    nValue.textContent = String(p.n);
    kSlider.value = String(p.k);
    kValue.textContent = String(p.k);
    algoSelect.value = p.algorithm;
    seedInput.value = String(p.seed);
    warpCheck.checked = p.warp;
    solutionCheck.checked = p.showSolution;
    labelsCheck.checked = p.showLabels;
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

  return {
    container,
    getParams,
    setParams,
    setMetrics,
    onChange(cb) { callbacks.push(cb); },
    onAction(action, cb) {
      if (!actions.has(action)) actions.set(action, []);
      actions.get(action)!.push(cb);
    },
  };
}

function buildHTML(p: MazeParams): string {
  return `
    <h2>Polyhedral Maze</h2>

    <label>Shape
      <select id="ctrl-shape">
        <option value="tetrahedron"${p.shape === 'tetrahedron' ? ' selected' : ''}>Tetrahedron</option>
        <option value="cube"${p.shape === 'cube' ? ' selected' : ''}>Cube</option>
        <option value="octahedron"${p.shape === 'octahedron' ? ' selected' : ''}>Octahedron</option>
        <option value="icosahedron"${p.shape === 'icosahedron' ? ' selected' : ''}>Icosahedron</option>
        <option value="dodecahedron"${p.shape === 'dodecahedron' ? ' selected' : ''}>Dodecahedron</option>
      </select>
    </label>

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

    <div class="checkboxes">
      <label><input id="ctrl-warp" type="checkbox" ${p.warp ? 'checked' : ''} /> Warp</label>
      <label><input id="ctrl-solution" type="checkbox" ${p.showSolution ? 'checked' : ''} /> Show solution</label>
      <label><input id="ctrl-labels" type="checkbox" ${p.showLabels ? 'checked' : ''} /> Show labels</label>
    </div>

    <div class="buttons">
      <button id="btn-regenerate">Regenerate</button>
      <button id="btn-random">Random</button>
      <button id="btn-copy-url">Copy URL</button>
      <button id="btn-export-pdf">Export PDF</button>
    </div>

    <div id="ctrl-metrics" class="metrics"></div>
  `;
}
