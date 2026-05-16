# Polyhedral Maze

Interactive 3D maze generator on the surfaces of convex polyhedra.

Generate perfect mazes (unique-solution spanning trees) on all 5 Platonic, all
13 Archimedean, and all 13 Catalan solids — 31 shapes in total — and explore
them in an interactive 3D viewer.

## Features

- **31 polyhedra** across three categories:
  - **Platonic (5)**: tetrahedron, cube, octahedron, dodecahedron, icosahedron
  - **Archimedean (13)**: cuboctahedron, icosidodecahedron, rhombicuboctahedron, rhombicosidodecahedron, truncated tetrahedron / cube / octahedron / cuboctahedron / dodecahedron / icosahedron / icosidodecahedron, snub cube, snub dodecahedron
  - **Catalan (13)**: triakis tetrahedron / octahedron / icosahedron, tetrakis hexahedron, pentakis dodecahedron, rhombic dodecahedron, rhombic triacontahedron, deltoidal icositetrahedron / hexecontahedron, disdyakis dodecahedron / triacontahedron, pentagonal icositetrahedron / hexecontahedron
- **7 face-type grids** (rectangular, triangular, kite, pentagonal, hexagonal, octagonal, decagonal) that compose freely on mixed-face solids
- **3 maze algorithms**: Kruskal, DFS backtracker, Wilson (loop-erased random walk)
- **Warp tunnels**: shortcut through the polyhedron connecting opposite faces
- **Interactive 3D viewer**: rotate, zoom, auto-rotate, and inspect the maze on the surface
- **URL sharing**: any maze configuration is reproducible via URL parameters
- **PDF export**: download unfolded net diagrams (puzzle + answer) for paper craft

## Demo

[https://kakeami.github.io/polyhedral-maze/](https://kakeami.github.io/polyhedral-maze/)

## Development

```bash
npm install          # install dependencies
npm run dev          # start dev server
npm run build        # production build (output: dist/)
npm test             # run vitest
npm run test:watch   # vitest in watch mode
```

## Configuration

All parameters are encoded in the URL query string:

| Parameter | Values | Default |
|-----------|--------|---------|
| `shape` | one of the 31 shape IDs below | `icosahedron` |
| `n` | 2–12 (grid resolution per face edge) | `9` |
| `k` | 1–4 (inter-face passages per shared edge) | `3` |
| `algo` | `kruskal`, `dfs`, `wilson` | `dfs` |
| `seed` | 0–999999 | `42` |
| `warp` | `1` or `0` | `0` |
| `solution` | `1` or `0` (overlay the solution path) | `0` |

### Shape IDs

| Category | IDs |
|----------|-----|
| Platonic | `tetrahedron`, `cube`, `octahedron`, `dodecahedron`, `icosahedron` |
| Archimedean | `cuboctahedron`, `icosidodecahedron`, `rhombicuboctahedron`, `rhombicosidodecahedron`, `truncated-tetrahedron`, `truncated-cube`, `truncated-octahedron`, `truncated-cuboctahedron`, `truncated-dodecahedron`, `truncated-icosahedron`, `truncated-icosidodecahedron`, `snub-cube`, `snub-dodecahedron` |
| Catalan | `triakis-tetrahedron`, `triakis-octahedron`, `tetrakis-hexahedron`, `triakis-icosahedron`, `pentakis-dodecahedron`, `rhombic-dodecahedron`, `rhombic-triacontahedron`, `deltoidal-icositetrahedron`, `deltoidal-hexecontahedron`, `disdyakis-dodecahedron`, `disdyakis-triacontahedron`, `pentagonal-icositetrahedron`, `pentagonal-hexecontahedron` |

Example: `?shape=snub-dodecahedron&n=3&algo=wilson&seed=7&warp=1`

## Tech stack

Vanilla TypeScript + Vite + Three.js. No UI framework. The math core (`src/core/`) has zero DOM dependencies and is fully unit-tested with Vitest.

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
Non-commercial use (personal, educational, academic, research) is freely permitted.

For commercial licensing inquiries, contact [@kakeami](https://github.com/kakeami).
