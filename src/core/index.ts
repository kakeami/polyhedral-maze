export type { Vec3, CellKey, CellId, Face, EdgeVertices, MazeNodeData, MazeEdgeData, FaceEdgeData } from './types.ts';
export { cellKey, cellIdToKey, parseCell } from './types.ts';

export type { Rng } from './prng.ts';
export { createRng } from './prng.ts';

export * as vec3 from './vec3.ts';
export * as vec2 from './vec2.ts';
export type { Vec2 } from './vec2.ts';
export { BOUNDARY_TOLERANCE, VERTEX_EPSILON, OPPOSITE_FACE_EPSILON } from './constants.ts';

export { Graph, UnionFind, bfsShortestPath, bfsSingleSourceLengths } from './graph.ts';

export type { FaceGrid } from './face-grid.ts';
export type { Polyhedron } from './polyhedron.ts';
export { sharedEdgeVertices, oppositeFace, buildFaceAdjacency } from './polyhedron.ts';

export { MazeGraph } from './maze-graph.ts';
export type { Algorithm, Warp, Maze } from './maze.ts';
export { generate } from './maze.ts';
export type { MazeMetrics } from './metrics.ts';
export { computeMetrics } from './metrics.ts';

export {
  Tetrahedron,
  Cube,
  Octahedron,
  Icosahedron,
  Dodecahedron,
  Cuboctahedron,
  TruncatedTetrahedron,
  TruncatedOctahedron,
  TruncatedIcosahedron,
  Icosidodecahedron,
  Rhombicuboctahedron,
  Rhombicosidodecahedron,
  TruncatedCube,
  TruncatedCuboctahedron,
  TruncatedDodecahedron,
  TruncatedIcosidodecahedron,
  TriGrid,
  RectGrid,
  PentGrid,
  HexGrid,
  OctGrid,
  DecGrid,
  SHAPES,
  CATEGORY_LABELS,
  getShape,
  shapesByCategory,
  availableCategories,
} from './polyhedra/index.ts';
export type { ShapeDescriptor, ShapeCategory } from './polyhedra/index.ts';
