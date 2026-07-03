# Polyhedral Maze

Interactive 3D maze generator on polyhedral surfaces.

Generate perfect mazes (unique-solution spanning trees) on all 5 Platonic, all
13 Archimedean, all 13 Catalan, the 5 non-Platonic convex deltahedra, 10
uniform prisms & antiprisms, 8 uniform bipyramids & trapezohedra, 87
Johnson solids (cupolas, rotundas, bicupolas, pyramids, elongated/gyroelongated
variants and bicupolae, the gyrobifastigium, augmented prisms / dodecahedra /
truncated solids, diminished icosahedra, gyrate/diminished
rhombicosidodecahedra, and the 8 sporadic Johnson solids J85–J92), and 3
toroidal (genus-1) polyhedra — 144 shapes in total — and explore them in an
interactive 3D viewer.

## Features

- **144 polyhedra** across eight categories:
  - **Platonic (5)**: tetrahedron, cube, octahedron, dodecahedron, icosahedron
  - **Archimedean (13)**: cuboctahedron, icosidodecahedron, rhombicuboctahedron, rhombicosidodecahedron, truncated tetrahedron / cube / octahedron / cuboctahedron / dodecahedron / icosahedron / icosidodecahedron, snub cube, snub dodecahedron
  - **Catalan (13)**: triakis tetrahedron / octahedron / icosahedron, tetrakis hexahedron, pentakis dodecahedron, rhombic dodecahedron, rhombic triacontahedron, deltoidal icositetrahedron / hexecontahedron, disdyakis dodecahedron / triacontahedron, pentagonal icositetrahedron / hexecontahedron
  - **Deltahedra (5)** — the non-Platonic convex deltahedra: triangular bipyramid, pentagonal bipyramid, snub disphenoid (J84), triaugmented triangular prism (J51), gyroelongated square bipyramid (J17)
  - **Prismatic (10)** — uniform prisms and antiprisms: triangular / pentagonal / hexagonal / octagonal / decagonal prism, square / pentagonal / hexagonal / octagonal / decagonal antiprism
  - **Dipyramidal (8)** — uniform bipyramids and trapezohedra (duals of the Prismatic family): hexagonal / octagonal / decagonal bipyramid, tetragonal / pentagonal / hexagonal / octagonal / decagonal trapezohedron
  - **Toroidal (3)** — genus-1 polyhedra (mazes can loop around the hole): square torus, hexagonal torus, drilled truncated octahedron (a Stewart-toroid-style tunnel)
  - **Johnson (87)** — pyramids, cupolas, rotunda, their bicupola/birotunda joins, elongated/gyroelongated variants and bicupolae, the gyrobifastigium, augmented prisms / dodecahedra / truncated solids, diminished icosahedra, the 12 gyrate/diminished rhombicosidodecahedra, and the 8 sporadic Johnson solids. The UI splits them into eleven sub-lists (pyramids & elongated, cupolas & rotunda, bicupolas & birotunda, elongated cupolas, elongated bicupolae, augmented prisms, augmented dodecahedra, augmented truncated, diminished icosahedra, rhombicosi. mods, sporadic). Members: J1–J11 (except J12, J13), J14–J16, J18–J50, J52–J83, J85–J92. The 5 deltahedron-equivalent Johnsons (J12, J13, J17, J51, J84) appear in the Deltahedra category. Combined coverage of the Johnson family is 92/92.
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
| `shape` | one of the 144 shape IDs below | `icosahedron` |
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
| Toroidal | `square-torus`, `hexagonal-torus`, `drilled-truncated-octahedron` |
| Johnson | `j1`, `j2`, `j3`, `j4`, `j5`, `j6`, `j7`, `j8`, `j9`, `j10`, `j11`, `j14`, `j15`, `j16`, `j18`, `j19`, `j20`, `j21`, `j22`, `j23`, `j24`, `j25`, `j26`, `j27`, `j28`, `j29`, `j30`, `j31`, `j32`, `j33`, `j34`, `j35`, `j36`, `j37`, `j38`, `j39`, `j40`, `j41`, `j42`, `j43`, `j44`, `j45`, `j46`, `j47`, `j48`, `j49`, `j50`, `j52`, `j53`, `j54`, `j55`, `j56`, `j57`, `j58`, `j59`, `j60`, `j61`, `j62`, `j63`, `j64`, `j65`, `j66`, `j67`, `j68`, `j69`, `j70`, `j71`, `j72`, `j73`, `j74`, `j75`, `j76`, `j77`, `j78`, `j79`, `j80`, `j81`, `j82`, `j83`, `j85`, `j86`, `j87`, `j88`, `j89`, `j90`, `j91`, `j92` |

Example: `?shape=snub-dodecahedron&n=3&algo=wilson&seed=7&warp=1`

## Tech stack

Vanilla TypeScript + Vite + Three.js. No UI framework. The math core (`src/core/`) has zero DOM dependencies and is fully unit-tested with Vitest.

## License

Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).
Non-commercial use (personal, educational, academic, research) is freely permitted.

For commercial licensing inquiries, contact [@kakeami](https://github.com/kakeami).
