export type { Mat3, Placement, KineticState, KineticCell, Mechanism } from './types.ts';
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
  StartGoal,
} from './maze.ts';
export {
  generateKineticMaze,
  chooseCutClasses,
  stateStats,
  treeRate,
  searchDesign,
  optimizeForStates,
  searchAllStates,
  expandCutClasses,
  costOverStates,
  pickStartGoal,
} from './maze.ts';

export type { StackOptions, StackMechanism } from './mechanisms/stack.ts';
export { createStack } from './mechanisms/stack.ts';
