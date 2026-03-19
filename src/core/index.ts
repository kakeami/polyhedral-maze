export type { Vec3, CellKey, CellId, Face, EdgeVertices } from './types.ts';
export { cellKey, cellIdToKey, parseCell } from './types.ts';

export type { Rng } from './prng.ts';
export { createRng } from './prng.ts';

export * as vec3 from './vec3.ts';

export { Graph, UnionFind, bfsShortestPath, bfsSingleSourceLengths } from './graph.ts';

export type { FaceGrid } from './face-grid.ts';
export type { Polyhedron } from './polyhedron.ts';
export { sharedEdgeVertices, oppositeFace, buildFaceAdjacency } from './polyhedron.ts';

export { MazeGraph } from './maze-graph.ts';
export type { Algorithm, Warp, Maze } from './maze.ts';
export { generate } from './maze.ts';
export type { MazeMetrics } from './metrics.ts';
export { computeMetrics } from './metrics.ts';

export { Cube, RectGrid } from './polyhedra/cube.ts';
export { Octahedron, TriGrid } from './polyhedra/octahedron.ts';
export { Tetrahedron } from './polyhedra/tetrahedron.ts';
export { Icosahedron } from './polyhedra/icosahedron.ts';
export { Dodecahedron, PentGrid } from './polyhedra/dodecahedron.ts';
