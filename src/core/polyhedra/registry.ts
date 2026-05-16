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
import { SnubCube } from './archimedean/snub-cube.ts';
import { SnubDodecahedron } from './archimedean/snub-dodecahedron.ts';
import { TriakisTetrahedron } from './catalan/triakis-tetrahedron.ts';
import { TriakisOctahedron } from './catalan/triakis-octahedron.ts';
import { TetrakisHexahedron } from './catalan/tetrakis-hexahedron.ts';
import { TriakisIcosahedron } from './catalan/triakis-icosahedron.ts';
import { PentakisDodecahedron } from './catalan/pentakis-dodecahedron.ts';
import { RhombicDodecahedron } from './catalan/rhombic-dodecahedron.ts';
import { RhombicTriacontahedron } from './catalan/rhombic-triacontahedron.ts';
import { DeltoidalIcositetrahedron } from './catalan/deltoidal-icositetrahedron.ts';
import { DeltoidalHexecontahedron } from './catalan/deltoidal-hexecontahedron.ts';
import { DisdyakisDodecahedron } from './catalan/disdyakis-dodecahedron.ts';
import { DisdyakisTriacontahedron } from './catalan/disdyakis-triacontahedron.ts';
import { PentagonalIcositetrahedron } from './catalan/pentagonal-icositetrahedron.ts';
import { PentagonalHexecontahedron } from './catalan/pentagonal-hexecontahedron.ts';

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
  {
    id: 'snub-cube',
    name: 'Snub Cube',
    category: 'archimedean',
    faceComposition: '△×32 + □×6',
    faceCount: 38,
    factory: () => new SnubCube(),
  },
  {
    id: 'snub-dodecahedron',
    name: 'Snub Dodecahedron',
    category: 'archimedean',
    faceComposition: '△×80 + ⬠×12',
    faceCount: 92,
    factory: () => new SnubDodecahedron(),
  },
  {
    id: 'triakis-tetrahedron',
    name: 'Triakis Tetrahedron',
    category: 'catalan',
    faceComposition: '△×12',
    faceCount: 12,
    factory: () => new TriakisTetrahedron(),
  },
  {
    id: 'triakis-octahedron',
    name: 'Triakis Octahedron',
    category: 'catalan',
    faceComposition: '△×24',
    faceCount: 24,
    factory: () => new TriakisOctahedron(),
  },
  {
    id: 'tetrakis-hexahedron',
    name: 'Tetrakis Hexahedron',
    category: 'catalan',
    faceComposition: '△×24',
    faceCount: 24,
    factory: () => new TetrakisHexahedron(),
  },
  {
    id: 'triakis-icosahedron',
    name: 'Triakis Icosahedron',
    category: 'catalan',
    faceComposition: '△×60',
    faceCount: 60,
    factory: () => new TriakisIcosahedron(),
  },
  {
    id: 'pentakis-dodecahedron',
    name: 'Pentakis Dodecahedron',
    category: 'catalan',
    faceComposition: '△×60',
    faceCount: 60,
    factory: () => new PentakisDodecahedron(),
  },
  {
    id: 'rhombic-dodecahedron',
    name: 'Rhombic Dodecahedron',
    category: 'catalan',
    faceComposition: '◇×12',
    faceCount: 12,
    factory: () => new RhombicDodecahedron(),
  },
  {
    id: 'rhombic-triacontahedron',
    name: 'Rhombic Triacontahedron',
    category: 'catalan',
    faceComposition: '◇×30',
    faceCount: 30,
    factory: () => new RhombicTriacontahedron(),
  },
  {
    id: 'deltoidal-icositetrahedron',
    name: 'Deltoidal Icositetrahedron',
    category: 'catalan',
    faceComposition: 'kite×24',
    faceCount: 24,
    factory: () => new DeltoidalIcositetrahedron(),
  },
  {
    id: 'deltoidal-hexecontahedron',
    name: 'Deltoidal Hexecontahedron',
    category: 'catalan',
    faceComposition: 'kite×60',
    faceCount: 60,
    factory: () => new DeltoidalHexecontahedron(),
  },
  {
    id: 'disdyakis-dodecahedron',
    name: 'Disdyakis Dodecahedron',
    category: 'catalan',
    faceComposition: '△×48',
    faceCount: 48,
    factory: () => new DisdyakisDodecahedron(),
  },
  {
    id: 'disdyakis-triacontahedron',
    name: 'Disdyakis Triacontahedron',
    category: 'catalan',
    faceComposition: '△×120',
    faceCount: 120,
    factory: () => new DisdyakisTriacontahedron(),
  },
  {
    id: 'pentagonal-icositetrahedron',
    name: 'Pentagonal Icositetrahedron',
    category: 'catalan',
    faceComposition: '⬠×24',
    faceCount: 24,
    factory: () => new PentagonalIcositetrahedron(),
  },
  {
    id: 'pentagonal-hexecontahedron',
    name: 'Pentagonal Hexecontahedron',
    category: 'catalan',
    faceComposition: '⬠×60',
    faceCount: 60,
    factory: () => new PentagonalHexecontahedron(),
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
