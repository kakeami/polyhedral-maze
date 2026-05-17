# Polyhedral Maze

Interactive 3D maze generator on the surfaces of convex polyhedra.

Generate perfect mazes (unique-solution spanning trees) on all 5 Platonic, all
13 Archimedean, all 13 Catalan, the 5 non-Platonic convex deltahedra, 10
uniform prisms & antiprisms, 8 uniform bipyramids & trapezohedra, and the
first 12 Johnson solids (cupolas, rotunda, bicupolas, birotunda) — 66 shapes
in total — and explore them in an interactive 3D viewer.

## Features

- **66 polyhedra** across seven categories:
  - **Platonic (5)**: tetrahedron, cube, octahedron, dodecahedron, icosahedron
  - **Archimedean (13)**: cuboctahedron, icosidodecahedron, rhombicuboctahedron, rhombicosidodecahedron, truncated tetrahedron / cube / octahedron / cuboctahedron / dodecahedron / icosahedron / icosidodecahedron, snub cube, snub dodecahedron
  - **Catalan (13)**: triakis tetrahedron / octahedron / icosahedron, tetrakis hexahedron, pentakis dodecahedron, rhombic dodecahedron, rhombic triacontahedron, deltoidal icositetrahedron / hexecontahedron, disdyakis dodecahedron / triacontahedron, pentagonal icositetrahedron / hexecontahedron
  - **Deltahedra (5)** — the non-Platonic convex deltahedra: triangular bipyramid, pentagonal bipyramid, snub disphenoid (J84), triaugmented triangular prism (J51), gyroelongated square bipyramid (J17)
  - **Prismatic (10)** — uniform prisms and antiprisms: triangular / pentagonal / hexagonal / octagonal / decagonal prism, square / pentagonal / hexagonal / octagonal / decagonal antiprism
  - **Dipyramidal (8)** — uniform bipyramids and trapezohedra (duals of the Prismatic family): hexagonal / octagonal / decagonal bipyramid, tetragonal / pentagonal / hexagonal / octagonal / decagonal trapezohedron
  - **Johnson (12)** — first batch of Johnson solids (cupolas, rotunda, bicupolas, cupolarotundas, birotunda): J3 / J4 / J5 cupola, J6 pentagonal rotunda, J27 triangular orthobicupola, J28 / J29 square ortho/gyrobicupola, J30 / J31 pentagonal ortho/gyrobicupola, J32 / J33 pentagonal ortho/gyrocupolarotunda, J34 pentagonal orthobirotunda
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
| `shape` | one of the 66 shape IDs below | `icosahedron` |
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
| Deltahedra | `triangular-bipyramid`, `pentagonal-bipyramid`, `snub-disphenoid`, `triaugmented-triangular-prism`, `gyroelongated-square-bipyramid` |
| Prismatic | `triangular-prism`, `pentagonal-prism`, `hexagonal-prism`, `octagonal-prism`, `decagonal-prism`, `square-antiprism`, `pentagonal-antiprism`, `hexagonal-antiprism`, `octagonal-antiprism`, `decagonal-antiprism` |
| Dipyramidal | `hexagonal-bipyramid`, `octagonal-bipyramid`, `decagonal-bipyramid`, `tetragonal-trapezohedron`, `pentagonal-trapezohedron`, `hexagonal-trapezohedron`, `octagonal-trapezohedron`, `decagonal-trapezohedron` |
| Johnson | `j3`, `j4`, `j5`, `j6`, `j27`, `j28`, `j29`, `j30`, `j31`, `j32`, `j33`, `j34` |

Example: `?shape=snub-dodecahedron&n=3&algo=wilson&seed=7&warp=1`

## Tech stack

Vanilla TypeScript + Vite + Three.js. No UI framework. The math core (`src/core/`) has zero DOM dependencies and is fully unit-tested with Vitest.

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
Non-commercial use (personal, educational, academic, research) is freely permitted.

For commercial licensing inquiries, contact [@kakeami](https://github.com/kakeami).
