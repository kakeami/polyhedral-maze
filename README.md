# Polyhedral Maze

Interactive 3D maze generator on Platonic solid surfaces.

Generate perfect mazes (unique-solution spanning trees) on all five Platonic
solids — tetrahedron, cube, octahedron, dodecahedron, and icosahedron — and
explore them in an interactive 3D viewer.

## Features

- **5 Platonic solids** with face-specific grid systems (rectangular, triangular, pentagonal)
- **3 maze algorithms**: Kruskal, DFS backtracker, Wilson (LERW)
- **Warp tunnels**: Shortcut through the polyhedron connecting opposite faces
- **Interactive 3D viewer**: Rotate, zoom, and inspect the maze on the polyhedron surface
- **URL sharing**: Share any maze configuration via URL parameters
- **PDF export**: Download unfolded net diagrams (puzzle + answer) for paper craft

## Demo

Visit [https://kakeami.github.io/polyhedral-maze/](https://kakeami.github.io/polyhedral-maze/)

## Development

```bash
npm install          # install dependencies
npm run dev          # start dev server
npm run build        # production build (output: dist/)
npm test             # run vitest
npm run test:watch   # vitest in watch mode
```

## Configuration

All parameters can be set via URL query string:

| Parameter | Values | Default |
|-----------|--------|---------|
| `shape` | tetrahedron, cube, octahedron, dodecahedron, icosahedron | cube |
| `n` | 2–12 (grid resolution) | 6 |
| `k` | 1–4 (inter-face passages per edge) | 2 |
| `algo` | kruskal, dfs, wilson | kruskal |
| `seed` | 0–999999 | 42 |
| `warp` | true, false | false |

Example: `?shape=icosahedron&n=8&algo=wilson&seed=7&warp=true`

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
Non-commercial use (personal, educational, academic, research) is freely permitted.

For commercial licensing inquiries, please contact [@kakeami](https://github.com/kakeami).
