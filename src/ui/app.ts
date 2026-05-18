import { MazeGraph } from '../core/maze-graph.ts';
import { generate } from '../core/maze.ts';
import { computeMetrics } from '../core/metrics.ts';
import { createRng } from '../core/prng.ts';
import { getShape, SHAPES } from '../core/polyhedra/registry.ts';
import { createScene } from '../render/three-scene.ts';
import { computeRenderData } from '../render/texture-painter.ts';
import { exportPDF } from '../render/pdf-exporter.ts';
import { createControls } from './controls.ts';
import { decodeParams, encodeParams } from './param-codec.ts';

interface BuildSnapshot {
  mg: MazeGraph;
  maze: ReturnType<typeof generate>;
  metrics: ReturnType<typeof computeMetrics>;
}

export function initApp(viewportEl: HTMLElement, controlsEl: HTMLElement) {
  const params = decodeParams(window.location.search);
  const scene = createScene(viewportEl);
  const controls = createControls(controlsEl, params);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastBuild: BuildSnapshot | null = null;

  function rebuild() {
    const p = controls.getParams();
    const shape = getShape(p.shape) ?? SHAPES[0]!;
    const polyhedron = shape.factory();
    const mg = new MazeGraph(polyhedron, p.n, p.k);
    mg.build();
    const maze = generate(mg, {
      algorithm: p.algorithm,
      warp: p.warp,
      rng: createRng(p.seed),
    });
    const metrics = computeMetrics(maze, mg);
    const renderData = computeRenderData(mg, maze, p.showSolution);

    lastBuild = { mg, maze, metrics };

    scene.updateMaze(polyhedron, renderData);
    controls.setMetrics(metrics);

    history.replaceState(null, '', encodeParams(p) || window.location.pathname);
  }

  controls.onChange(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rebuild, 150);
  });

  controls.onAction('copy-url', () => {
    const p = controls.getParams();
    const url = window.location.origin + window.location.pathname + encodeParams(p);
    navigator.clipboard.writeText(url).then(
      () => controls.showToast('URL copied'),
      err => {
        console.warn('Clipboard write failed:', err);
        controls.showToast('Copy failed — use the address bar');
      },
    );
  });

  controls.onAction('export-pdf', () => {
    if (!lastBuild) return;
    const p = controls.getParams();
    const baseUrl = window.location.origin + window.location.pathname;
    controls.setExportBusy(true);
    exportPDF(p, lastBuild.mg, lastBuild.maze, lastBuild.metrics, baseUrl)
      .catch(err => {
        console.error('PDF export failed:', err);
        controls.showToast('PDF export failed — see console');
      })
      .finally(() => controls.setExportBusy(false));
  });

  controls.onAction('auto-rotate', () => {
    scene.controls.autoRotate = controls.getAutoRotate();
  });

  const ac = new AbortController();
  window.addEventListener('resize', () => scene.resize(), { signal: ac.signal });

  rebuild();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      ac.abort();
      if (debounceTimer) clearTimeout(debounceTimer);
      scene.dispose();
    });
  }
}
