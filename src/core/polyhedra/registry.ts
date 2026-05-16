import type { Polyhedron } from '../polyhedron.ts';
import { Tetrahedron } from './platonic/tetrahedron.ts';
import { Cube } from './platonic/cube.ts';
import { Octahedron } from './platonic/octahedron.ts';
import { Icosahedron } from './platonic/icosahedron.ts';
import { Dodecahedron } from './platonic/dodecahedron.ts';
import { Cuboctahedron } from './archimedean/cuboctahedron.ts';
import { TruncatedTetrahedron } from './archimedean/truncated-tetrahedron.ts';
import { TruncatedOctahedron } from './archimedean/truncated-octahedron.ts';
import { TruncatedIcosahedron } from './archimedean/truncated-icosahedron.ts';
import { Icosidodecahedron } from './archimedean/icosidodecahedron.ts';
import { Rhombicuboctahedron } from './archimedean/rhombicuboctahedron.ts';
import { Rhombicosidodecahedron } from './archimedean/rhombicosidodecahedron.ts';
import { TruncatedCube } from './archimedean/truncated-cube.ts';
import { TruncatedCuboctahedron } from './archimedean/truncated-cuboctahedron.ts';
import { TruncatedDodecahedron } from './archimedean/truncated-dodecahedron.ts';
import { TruncatedIcosidodecahedron } from './archimedean/truncated-icosidodecahedron.ts';

export type ShapeCategory =
  | 'platonic'
  | 'archimedean'
  | 'catalan'
  | 'deltahedra'
  | 'johnson';

export const CATEGORY_LABELS: Record<ShapeCategory, string> = {
  platonic: 'Platonic',
  archimedean: 'Archimedean',
  catalan: 'Catalan',
  deltahedra: 'Deltahedra',
  johnson: 'Johnson',
};

export interface ShapeDescriptor {
  id: string;
  name: string;
  category: ShapeCategory;
  faceComposition: string;
  faceCount: number;
  factory: () => Polyhedron;
}

export const SHAPES: readonly ShapeDescriptor[] = [
  {
    id: 'tetrahedron',
    name: 'Tetrahedron',
    category: 'platonic',
    faceComposition: '△×4',
    faceCount: 4,
    factory: () => new Tetrahedron(),
  },
  {
    id: 'cube',
    name: 'Cube',
    category: 'platonic',
    faceComposition: '□×6',
    faceCount: 6,
    factory: () => new Cube(),
  },
  {
    id: 'octahedron',
    name: 'Octahedron',
    category: 'platonic',
    faceComposition: '△×8',
    faceCount: 8,
    factory: () => new Octahedron(),
  },
  {
    id: 'dodecahedron',
    name: 'Dodecahedron',
    category: 'platonic',
    faceComposition: '⬠×12',
    faceCount: 12,
    factory: () => new Dodecahedron(),
  },
  {
    id: 'icosahedron',
    name: 'Icosahedron',
    category: 'platonic',
    faceComposition: '△×20',
    faceCount: 20,
    factory: () => new Icosahedron(),
  },
  {
    id: 'cuboctahedron',
    name: 'Cuboctahedron',
    category: 'archimedean',
    faceComposition: '△×8 + □×6',
    faceCount: 14,
    factory: () => new Cuboctahedron(),
  },
  {
    id: 'truncated-tetrahedron',
    name: 'Truncated Tetrahedron',
    category: 'archimedean',
    faceComposition: '△×4 + ⬡×4',
    faceCount: 8,
    factory: () => new TruncatedTetrahedron(),
  },
  {
    id: 'truncated-octahedron',
    name: 'Truncated Octahedron',
    category: 'archimedean',
    faceComposition: '□×6 + ⬡×8',
    faceCount: 14,
    factory: () => new TruncatedOctahedron(),
  },
  {
    id: 'truncated-icosahedron',
    name: 'Truncated Icosahedron',
    category: 'archimedean',
    faceComposition: '⬠×12 + ⬡×20',
    faceCount: 32,
    factory: () => new TruncatedIcosahedron(),
  },
  {
    id: 'icosidodecahedron',
    name: 'Icosidodecahedron',
    category: 'archimedean',
    faceComposition: '△×20 + ⬠×12',
    faceCount: 32,
    factory: () => new Icosidodecahedron(),
  },
  {
    id: 'rhombicuboctahedron',
    name: 'Rhombicuboctahedron',
    category: 'archimedean',
    faceComposition: '△×8 + □×18',
    faceCount: 26,
    factory: () => new Rhombicuboctahedron(),
  },
  {
    id: 'rhombicosidodecahedron',
    name: 'Rhombicosidodecahedron',
    category: 'archimedean',
    faceComposition: '△×20 + □×30 + ⬠×12',
    faceCount: 62,
    factory: () => new Rhombicosidodecahedron(),
  },
  {
    id: 'truncated-cube',
    name: 'Truncated Cube',
    category: 'archimedean',
    faceComposition: '△×8 + 8gon×6',
    faceCount: 14,
    factory: () => new TruncatedCube(),
  },
  {
    id: 'truncated-cuboctahedron',
    name: 'Truncated Cuboctahedron',
    category: 'archimedean',
    faceComposition: '□×12 + ⬡×8 + 8gon×6',
    faceCount: 26,
    factory: () => new TruncatedCuboctahedron(),
  },
  {
    id: 'truncated-dodecahedron',
    name: 'Truncated Dodecahedron',
    category: 'archimedean',
    faceComposition: '△×20 + 10gon×12',
    faceCount: 32,
    factory: () => new TruncatedDodecahedron(),
  },
  {
    id: 'truncated-icosidodecahedron',
    name: 'Truncated Icosidodecahedron',
    category: 'archimedean',
    faceComposition: '□×30 + ⬡×20 + 10gon×12',
    faceCount: 62,
    factory: () => new TruncatedIcosidodecahedron(),
  },
];

export function getShape(id: string): ShapeDescriptor | undefined {
  return SHAPES.find((s) => s.id === id);
}

export function shapesByCategory(category: ShapeCategory): ShapeDescriptor[] {
  return SHAPES.filter((s) => s.category === category);
}

export function availableCategories(): ShapeCategory[] {
  const seen = new Set<ShapeCategory>();
  const result: ShapeCategory[] = [];
  for (const s of SHAPES) {
    if (!seen.has(s.category)) {
      seen.add(s.category);
      result.push(s.category);
    }
  }
  return result;
}
