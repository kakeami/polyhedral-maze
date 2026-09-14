export type {
  Mat3, Placement, KineticState, KineticCell, Mechanism, TurnableMechanism,
} from './types.ts';
export { applyPlacement, rotZ, IDENTITY } from './types.ts';

export { VertexWelder } from './weld.ts';

export type { KineticSurface, SurfaceAdjacency, SideClassKind } from './surface.ts';
export { buildSurface } from './surface.ts';

export type {
  KineticDesign,
  StateStats,
  TreeRate,
  DesignSearchResult,
  MultiStateResult,
  AllStatesResult,
  AllStatesSearch,
  AllStatesSearchOptions,
  SearchProgress,
  StartGoal,
  PrintedEnds,
} from './maze.ts';
export {
  generateKineticMaze,
  chooseCutClasses,
  stateStats,
  treeRate,
  searchDesign,
  optimizeForStates,
  searchAllStates,
  createAllStatesSearch,
  DEFAULT_SEARCH_EFFORT,
  expandCutClasses,
  costOverStates,
  pickStartGoal,
  pickPrintedEnds,
} from './maze.ts';

export type { StackOptions, StackMechanism } from './mechanisms/stack.ts';
export { createStack } from './mechanisms/stack.ts';

export type {
  InfinityCubeOptions,
  InfinityCubeMechanism,
  Lattice,
} from './mechanisms/infinity-cube.ts';
export {
  createInfinityCube,
  DEFAULT_RING,
  DEFAULT_HINGES,
  PLANK_RING,
  CUBE_RING,
  CUBE_RING_HINGES,
} from './mechanisms/infinity-cube.ts';

export type {
  JoinedPairOptions,
  JoinedPairMechanism,
  JoinedPairChoice,
  CellSource,
} from './mechanisms/joined.ts';
export {
  createJoinedPair,
  joinedPairCellCount,
  joinedPairById,
  creaseAngle,
  JOINED_PAIRS,
  DEFAULT_JOINED_PAIR,
} from './mechanisms/joined.ts';
