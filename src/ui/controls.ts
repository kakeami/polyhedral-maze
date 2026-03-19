import type { MazeParams } from './param-codec.ts';
import type { MazeMetrics } from '../core/metrics.ts';

export interface ControlsContext {
  container: HTMLElement;
  getParams(): MazeParams;
  setParams(p: MazeParams): void;
  setMetrics(m: MazeMetrics): void;
  getAutoRotate(): boolean;
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
  const metricsDiv = el<HTMLDivElement>('ctrl-metrics');

  const callbacks: (() => void)[] = [];
  const actions = new Map<string, (() => void)[]>();

  function fire() {
    callbacks.forEach(cb => cb());
  }

  // Sync slider display values
  nSlider.addEventListener('input', () => { nValue.textContent = nSlider.value; fire(); });
  kSlider.addEventListener('input', () => { kValue.textContent = kSlider.value; fire(); });
  for (const input of [shapeSelect, algoSelect, seedInput, warpCheck, solutionCheck]) {
    input.addEventListener('change', fire);
  }

  // Action buttons
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

  const autoRotateCheck = el<HTMLInputElement>('ctrl-auto-rotate');
  autoRotateCheck.addEventListener('change', () => {
    actions.get('auto-rotate')?.forEach(cb => cb());
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
    getAutoRotate() { return autoRotateCheck.checked; },
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
      <label><input id="ctrl-auto-rotate" type="checkbox" checked /> Auto-rotate</label>
    </div>

    <div class="buttons">
      <button id="btn-random">Random</button>
      <button id="btn-copy-url">Copy URL</button>
      <button id="btn-export-pdf">Export PDF</button>
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
      <a class="github-link" href="report/index.html" target="_blank" rel="noopener noreferrer">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1h8a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm1 2v2h6V3H5zm0 4v1h6V7H5zm0 3v1h4v-1H5z"/></svg>
        Technical Report
      </a>
    </div>
  `;
}
