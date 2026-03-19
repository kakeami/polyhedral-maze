import type { Polyhedron } from '../core/polyhedron.ts';
import type { Algorithm } from '../core/maze.ts';
import { MazeGraph } from '../core/maze-graph.ts';
import { generate } from '../core/maze.ts';
import { computeMetrics } from '../core/metrics.ts';
import { createRng } from '../core/prng.ts';
import { Tetrahedron } from '../core/polyhedra/tetrahedron.ts';
import { Cube } from '../core/polyhedra/cube.ts';
import { Octahedron } from '../core/polyhedra/octahedron.ts';
import { Icosahedron } from '../core/polyhedra/icosahedron.ts';
import { Dodecahedron } from '../core/polyhedra/dodecahedron.ts';
import { createScene } from '../render/three-scene.ts';
import { computeRenderData } from '../render/texture-painter.ts';
import { createControls } from './controls.ts';
import { decodeParams, encodeParams } from './param-codec.ts';

const shapeFactories: Record<string, () => Polyhedron> = {
  tetrahedron: () => new Tetrahedron(),
  cube: () => new Cube(),
  octahedron: () => new Octahedron(),
  icosahedron: () => new Icosahedron(),
  dodecahedron: () => new Dodecahedron(),
};

export function initApp(viewportEl: HTMLElement, controlsEl: HTMLElement) {
  const params = decodeParams(window.location.search);
  const scene = createScene(viewportEl);
  const controls = createControls(controlsEl, params);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function rebuild() {
    const p = controls.getParams();
    const polyhedron = (shapeFactories[p.shape] ?? shapeFactories['cube'])!();
    const mg = new MazeGraph(polyhedron, p.n, p.k);
    mg.build();
    const maze = generate(mg, {
      algorithm: p.algorithm as Algorithm,
      warp: p.warp,
      rng: createRng(p.seed),
    });
    const metrics = computeMetrics(maze, mg);
    const renderData = computeRenderData(mg, maze, p.showSolution);

    scene.updateMaze(polyhedron, renderData);
    controls.setMetrics(metrics);

    // Update URL
    history.replaceState(null, '', encodeParams(p) || window.location.pathname);
  }

  controls.onChange(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(rebuild, 150);
  });

  controls.onAction('copy-url', () => {
    const p = controls.getParams();
    const url = window.location.origin + window.location.pathname + encodeParams(p);
    navigator.clipboard.writeText(url).then(() => {
      alert('URL copied to clipboard');
    });
  });

  controls.onAction('export-pdf', () => {
    alert('PDF export coming soon');
  });

  window.addEventListener('resize', () => scene.resize());

  // Initial build
  rebuild();
}
