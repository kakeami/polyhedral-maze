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

export type {
  ContractedSearchOptions,
  ContractedResult,
  ContractedProgress,
  ContractedSearch,
} from './maze-contracted.ts';
export {
  contractedSearch,
  createContractedSearch,
  contractsCleanly,
} from './maze-contracted.ts';

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

export type { GyrationSeam, GyrationAxis } from './seams.ts';
export { gyrationAxes } from './seams.ts';

export type {
  GyrationOptions,
  GyrationMechanism,
  GyrationChoice,
} from './mechanisms/gyration.ts';
export {
  createGyration,
  gyrationCellCount,
  gyrationFacts,
  gyrationById,
  GYRATIONS,
  DEFAULT_GYRATION,
} from './mechanisms/gyration.ts';

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
