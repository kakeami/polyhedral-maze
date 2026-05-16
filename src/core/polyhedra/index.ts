export * from './platonic/index.ts';
export * from './archimedean/index.ts';
export * from './catalan/index.ts';
export * from './grids/index.ts';
export {
  SHAPES,
  CATEGORY_LABELS,
  getShape,
  shapesByCategory,
  availableCategories,
} from './registry.ts';
export type { ShapeDescriptor, ShapeCategory } from './registry.ts';
