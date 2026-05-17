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
import { TriangularBipyramid } from './deltahedra/triangular-bipyramid.ts';
import { PentagonalBipyramid } from './deltahedra/pentagonal-bipyramid.ts';
import { SnubDisphenoid } from './deltahedra/snub-disphenoid.ts';
import { TriaugmentedTriangularPrism } from './deltahedra/triaugmented-triangular-prism.ts';
import { GyroelongatedSquareBipyramid } from './deltahedra/gyroelongated-square-bipyramid.ts';
import { TriangularPrism } from './prismatic/triangular-prism.ts';
import { PentagonalPrism } from './prismatic/pentagonal-prism.ts';
import { HexagonalPrism } from './prismatic/hexagonal-prism.ts';
import { OctagonalPrism } from './prismatic/octagonal-prism.ts';
import { DecagonalPrism } from './prismatic/decagonal-prism.ts';
import { SquareAntiprism } from './prismatic/square-antiprism.ts';
import { PentagonalAntiprism } from './prismatic/pentagonal-antiprism.ts';
import { HexagonalAntiprism } from './prismatic/hexagonal-antiprism.ts';
import { OctagonalAntiprism } from './prismatic/octagonal-antiprism.ts';
import { DecagonalAntiprism } from './prismatic/decagonal-antiprism.ts';
import { HexagonalBipyramid } from './dipyramidal/hexagonal-bipyramid.ts';
import { OctagonalBipyramid } from './dipyramidal/octagonal-bipyramid.ts';
import { DecagonalBipyramid } from './dipyramidal/decagonal-bipyramid.ts';
import { TetragonalTrapezohedron } from './dipyramidal/tetragonal-trapezohedron.ts';
import { PentagonalTrapezohedron } from './dipyramidal/pentagonal-trapezohedron.ts';
import { HexagonalTrapezohedron } from './dipyramidal/hexagonal-trapezohedron.ts';
import { OctagonalTrapezohedron } from './dipyramidal/octagonal-trapezohedron.ts';
import { DecagonalTrapezohedron } from './dipyramidal/decagonal-trapezohedron.ts';
import { SquarePyramid } from './johnson/j01-square-pyramid.ts';
import { PentagonalPyramid } from './johnson/j02-pentagonal-pyramid.ts';
import { ElongatedTriangularPyramid } from './johnson/j07-elongated-triangular-pyramid.ts';
import { ElongatedSquarePyramid } from './johnson/j08-elongated-square-pyramid.ts';
import { ElongatedPentagonalPyramid } from './johnson/j09-elongated-pentagonal-pyramid.ts';
import { GyroelongatedSquarePyramid } from './johnson/j10-gyroelongated-square-pyramid.ts';
import { GyroelongatedPentagonalPyramid } from './johnson/j11-gyroelongated-pentagonal-pyramid.ts';
import { ElongatedTriangularBipyramid } from './johnson/j14-elongated-triangular-bipyramid.ts';
import { ElongatedSquareBipyramid } from './johnson/j15-elongated-square-bipyramid.ts';
import { ElongatedPentagonalBipyramid } from './johnson/j16-elongated-pentagonal-bipyramid.ts';
import { ElongatedTriangularCupola } from './johnson/j18-elongated-triangular-cupola.ts';
import { ElongatedSquareCupola } from './johnson/j19-elongated-square-cupola.ts';
import { ElongatedPentagonalCupola } from './johnson/j20-elongated-pentagonal-cupola.ts';
import { ElongatedPentagonalRotunda } from './johnson/j21-elongated-pentagonal-rotunda.ts';
import { GyroelongatedTriangularCupola } from './johnson/j22-gyroelongated-triangular-cupola.ts';
import { GyroelongatedSquareCupola } from './johnson/j23-gyroelongated-square-cupola.ts';
import { GyroelongatedPentagonalCupola } from './johnson/j24-gyroelongated-pentagonal-cupola.ts';
import { GyroelongatedPentagonalRotunda } from './johnson/j25-gyroelongated-pentagonal-rotunda.ts';
import { Gyrobifastigium } from './johnson/j26-gyrobifastigium.ts';
import { TriangularCupola } from './johnson/j03-triangular-cupola.ts';
import { SquareCupola } from './johnson/j04-square-cupola.ts';
import { PentagonalCupola } from './johnson/j05-pentagonal-cupola.ts';
import { PentagonalRotunda } from './johnson/j06-pentagonal-rotunda.ts';
import { TriangularOrthobicupola } from './johnson/j27-triangular-orthobicupola.ts';
import { SquareOrthobicupola } from './johnson/j28-square-orthobicupola.ts';
import { SquareGyrobicupola } from './johnson/j29-square-gyrobicupola.ts';
import { PentagonalOrthobicupola } from './johnson/j30-pentagonal-orthobicupola.ts';
import { PentagonalGyrobicupola } from './johnson/j31-pentagonal-gyrobicupola.ts';
import { PentagonalOrthocupolarotunda } from './johnson/j32-pentagonal-orthocupolarotunda.ts';
import { PentagonalGyrocupolarotunda } from './johnson/j33-pentagonal-gyrocupolarotunda.ts';
import { PentagonalOrthobirotunda } from './johnson/j34-pentagonal-orthobirotunda.ts';

export type ShapeCategory =
  | 'platonic'
  | 'archimedean'
  | 'catalan'
  | 'deltahedra'
  | 'prismatic'
  | 'dipyramidal'
  | 'johnson-cupola'
  | 'johnson-bicupola'
  | 'johnson-pyramid'
  | 'johnson-elongated-cupola'
  | 'johnson-sporadic';

export const CATEGORY_LABELS: Record<ShapeCategory, string> = {
  platonic: 'Platonic',
  archimedean: 'Archimedean',
  catalan: 'Catalan',
  deltahedra: 'Deltahedra',
  prismatic: 'Prismatic',
  dipyramidal: 'Dipyramidal',
  'johnson-cupola': 'Johnson: Cupolae & Rotunda',
  'johnson-bicupola': 'Johnson: Bicupolae & Birotunda',
  'johnson-pyramid': 'Johnson: Pyramids & Elongated',
  'johnson-elongated-cupola': 'Johnson: Elongated Cupolae',
  'johnson-sporadic': 'Johnson: Sporadic',
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
  {
    id: 'triangular-bipyramid',
    name: 'Triangular Bipyramid',
    category: 'deltahedra',
    faceComposition: '△×6',
    faceCount: 6,
    factory: () => new TriangularBipyramid(),
  },
  {
    id: 'pentagonal-bipyramid',
    name: 'Pentagonal Bipyramid',
    category: 'deltahedra',
    faceComposition: '△×10',
    faceCount: 10,
    factory: () => new PentagonalBipyramid(),
  },
  {
    id: 'snub-disphenoid',
    name: 'Snub Disphenoid',
    category: 'deltahedra',
    faceComposition: '△×12',
    faceCount: 12,
    factory: () => new SnubDisphenoid(),
  },
  {
    id: 'triaugmented-triangular-prism',
    name: 'Triaugmented Triangular Prism',
    category: 'deltahedra',
    faceComposition: '△×14',
    faceCount: 14,
    factory: () => new TriaugmentedTriangularPrism(),
  },
  {
    id: 'gyroelongated-square-bipyramid',
    name: 'Gyroelongated Square Bipyramid',
    category: 'deltahedra',
    faceComposition: '△×16',
    faceCount: 16,
    factory: () => new GyroelongatedSquareBipyramid(),
  },
  {
    id: 'triangular-prism',
    name: 'Triangular Prism',
    category: 'prismatic',
    faceComposition: '△×2 + □×3',
    faceCount: 5,
    factory: () => new TriangularPrism(),
  },
  {
    id: 'pentagonal-prism',
    name: 'Pentagonal Prism',
    category: 'prismatic',
    faceComposition: '⬠×2 + □×5',
    faceCount: 7,
    factory: () => new PentagonalPrism(),
  },
  {
    id: 'hexagonal-prism',
    name: 'Hexagonal Prism',
    category: 'prismatic',
    faceComposition: '⬡×2 + □×6',
    faceCount: 8,
    factory: () => new HexagonalPrism(),
  },
  {
    id: 'octagonal-prism',
    name: 'Octagonal Prism',
    category: 'prismatic',
    faceComposition: '8gon×2 + □×8',
    faceCount: 10,
    factory: () => new OctagonalPrism(),
  },
  {
    id: 'decagonal-prism',
    name: 'Decagonal Prism',
    category: 'prismatic',
    faceComposition: '10gon×2 + □×10',
    faceCount: 12,
    factory: () => new DecagonalPrism(),
  },
  {
    id: 'square-antiprism',
    name: 'Square Antiprism',
    category: 'prismatic',
    faceComposition: '□×2 + △×8',
    faceCount: 10,
    factory: () => new SquareAntiprism(),
  },
  {
    id: 'pentagonal-antiprism',
    name: 'Pentagonal Antiprism',
    category: 'prismatic',
    faceComposition: '⬠×2 + △×10',
    faceCount: 12,
    factory: () => new PentagonalAntiprism(),
  },
  {
    id: 'hexagonal-antiprism',
    name: 'Hexagonal Antiprism',
    category: 'prismatic',
    faceComposition: '⬡×2 + △×12',
    faceCount: 14,
    factory: () => new HexagonalAntiprism(),
  },
  {
    id: 'octagonal-antiprism',
    name: 'Octagonal Antiprism',
    category: 'prismatic',
    faceComposition: '8gon×2 + △×16',
    faceCount: 18,
    factory: () => new OctagonalAntiprism(),
  },
  {
    id: 'decagonal-antiprism',
    name: 'Decagonal Antiprism',
    category: 'prismatic',
    faceComposition: '10gon×2 + △×20',
    faceCount: 22,
    factory: () => new DecagonalAntiprism(),
  },
  {
    id: 'hexagonal-bipyramid',
    name: 'Hexagonal Bipyramid',
    category: 'dipyramidal',
    faceComposition: '△×12',
    faceCount: 12,
    factory: () => new HexagonalBipyramid(),
  },
  {
    id: 'octagonal-bipyramid',
    name: 'Octagonal Bipyramid',
    category: 'dipyramidal',
    faceComposition: '△×16',
    faceCount: 16,
    factory: () => new OctagonalBipyramid(),
  },
  {
    id: 'decagonal-bipyramid',
    name: 'Decagonal Bipyramid',
    category: 'dipyramidal',
    faceComposition: '△×20',
    faceCount: 20,
    factory: () => new DecagonalBipyramid(),
  },
  {
    id: 'tetragonal-trapezohedron',
    name: 'Tetragonal Trapezohedron',
    category: 'dipyramidal',
    faceComposition: 'kite×8',
    faceCount: 8,
    factory: () => new TetragonalTrapezohedron(),
  },
  {
    id: 'pentagonal-trapezohedron',
    name: 'Pentagonal Trapezohedron',
    category: 'dipyramidal',
    faceComposition: 'kite×10',
    faceCount: 10,
    factory: () => new PentagonalTrapezohedron(),
  },
  {
    id: 'hexagonal-trapezohedron',
    name: 'Hexagonal Trapezohedron',
    category: 'dipyramidal',
    faceComposition: 'kite×12',
    faceCount: 12,
    factory: () => new HexagonalTrapezohedron(),
  },
  {
    id: 'octagonal-trapezohedron',
    name: 'Octagonal Trapezohedron',
    category: 'dipyramidal',
    faceComposition: 'kite×16',
    faceCount: 16,
    factory: () => new OctagonalTrapezohedron(),
  },
  {
    id: 'decagonal-trapezohedron',
    name: 'Decagonal Trapezohedron',
    category: 'dipyramidal',
    faceComposition: 'kite×20',
    faceCount: 20,
    factory: () => new DecagonalTrapezohedron(),
  },
  {
    id: 'j1',
    name: 'Square Pyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×4 + □×1',
    faceCount: 5,
    factory: () => new SquarePyramid(),
  },
  {
    id: 'j2',
    name: 'Pentagonal Pyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×5 + ⬠×1',
    faceCount: 6,
    factory: () => new PentagonalPyramid(),
  },
  {
    id: 'j7',
    name: 'Elongated Triangular Pyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×4 + □×3',
    faceCount: 7,
    factory: () => new ElongatedTriangularPyramid(),
  },
  {
    id: 'j8',
    name: 'Elongated Square Pyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×4 + □×5',
    faceCount: 9,
    factory: () => new ElongatedSquarePyramid(),
  },
  {
    id: 'j9',
    name: 'Elongated Pentagonal Pyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×5 + □×5 + ⬠×1',
    faceCount: 11,
    factory: () => new ElongatedPentagonalPyramid(),
  },
  {
    id: 'j10',
    name: 'Gyroelongated Square Pyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×12 + □×1',
    faceCount: 13,
    factory: () => new GyroelongatedSquarePyramid(),
  },
  {
    id: 'j11',
    name: 'Gyroelongated Pentagonal Pyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×15 + ⬠×1',
    faceCount: 16,
    factory: () => new GyroelongatedPentagonalPyramid(),
  },
  {
    id: 'j14',
    name: 'Elongated Triangular Bipyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×6 + □×3',
    faceCount: 9,
    factory: () => new ElongatedTriangularBipyramid(),
  },
  {
    id: 'j15',
    name: 'Elongated Square Bipyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×8 + □×4',
    faceCount: 12,
    factory: () => new ElongatedSquareBipyramid(),
  },
  {
    id: 'j16',
    name: 'Elongated Pentagonal Bipyramid',
    category: 'johnson-pyramid',
    faceComposition: '△×10 + □×5',
    faceCount: 15,
    factory: () => new ElongatedPentagonalBipyramid(),
  },
  {
    id: 'j3',
    name: 'Triangular Cupola',
    category: 'johnson-cupola',
    faceComposition: '△×4 + □×3 + ⬡×1',
    faceCount: 8,
    factory: () => new TriangularCupola(),
  },
  {
    id: 'j4',
    name: 'Square Cupola',
    category: 'johnson-cupola',
    faceComposition: '△×4 + □×5 + 8gon×1',
    faceCount: 10,
    factory: () => new SquareCupola(),
  },
  {
    id: 'j5',
    name: 'Pentagonal Cupola',
    category: 'johnson-cupola',
    faceComposition: '△×5 + □×5 + ⬠×1 + 10gon×1',
    faceCount: 12,
    factory: () => new PentagonalCupola(),
  },
  {
    id: 'j6',
    name: 'Pentagonal Rotunda',
    category: 'johnson-cupola',
    faceComposition: '△×10 + ⬠×6 + 10gon×1',
    faceCount: 17,
    factory: () => new PentagonalRotunda(),
  },
  {
    id: 'j18',
    name: 'Elongated Triangular Cupola',
    category: 'johnson-elongated-cupola',
    faceComposition: '△×4 + □×9 + ⬡×1',
    faceCount: 14,
    factory: () => new ElongatedTriangularCupola(),
  },
  {
    id: 'j19',
    name: 'Elongated Square Cupola',
    category: 'johnson-elongated-cupola',
    faceComposition: '△×4 + □×13 + 8gon×1',
    faceCount: 18,
    factory: () => new ElongatedSquareCupola(),
  },
  {
    id: 'j20',
    name: 'Elongated Pentagonal Cupola',
    category: 'johnson-elongated-cupola',
    faceComposition: '△×5 + □×15 + ⬠×1 + 10gon×1',
    faceCount: 22,
    factory: () => new ElongatedPentagonalCupola(),
  },
  {
    id: 'j21',
    name: 'Elongated Pentagonal Rotunda',
    category: 'johnson-elongated-cupola',
    faceComposition: '△×10 + □×10 + ⬠×6 + 10gon×1',
    faceCount: 27,
    factory: () => new ElongatedPentagonalRotunda(),
  },
  {
    id: 'j22',
    name: 'Gyroelongated Triangular Cupola',
    category: 'johnson-elongated-cupola',
    faceComposition: '△×16 + □×3 + ⬡×1',
    faceCount: 20,
    factory: () => new GyroelongatedTriangularCupola(),
  },
  {
    id: 'j23',
    name: 'Gyroelongated Square Cupola',
    category: 'johnson-elongated-cupola',
    faceComposition: '△×20 + □×5 + 8gon×1',
    faceCount: 26,
    factory: () => new GyroelongatedSquareCupola(),
  },
  {
    id: 'j24',
    name: 'Gyroelongated Pentagonal Cupola',
    category: 'johnson-elongated-cupola',
    faceComposition: '△×25 + □×5 + ⬠×1 + 10gon×1',
    faceCount: 32,
    factory: () => new GyroelongatedPentagonalCupola(),
  },
  {
    id: 'j25',
    name: 'Gyroelongated Pentagonal Rotunda',
    category: 'johnson-elongated-cupola',
    faceComposition: '△×30 + ⬠×6 + 10gon×1',
    faceCount: 37,
    factory: () => new GyroelongatedPentagonalRotunda(),
  },
  {
    id: 'j26',
    name: 'Gyrobifastigium',
    category: 'johnson-sporadic',
    faceComposition: '△×4 + □×4',
    faceCount: 8,
    factory: () => new Gyrobifastigium(),
  },
  {
    id: 'j27',
    name: 'Triangular Orthobicupola',
    category: 'johnson-bicupola',
    faceComposition: '△×8 + □×6',
    faceCount: 14,
    factory: () => new TriangularOrthobicupola(),
  },
  {
    id: 'j28',
    name: 'Square Orthobicupola',
    category: 'johnson-bicupola',
    faceComposition: '△×8 + □×10',
    faceCount: 18,
    factory: () => new SquareOrthobicupola(),
  },
  {
    id: 'j29',
    name: 'Square Gyrobicupola',
    category: 'johnson-bicupola',
    faceComposition: '△×8 + □×10',
    faceCount: 18,
    factory: () => new SquareGyrobicupola(),
  },
  {
    id: 'j30',
    name: 'Pentagonal Orthobicupola',
    category: 'johnson-bicupola',
    faceComposition: '△×10 + □×10 + ⬠×2',
    faceCount: 22,
    factory: () => new PentagonalOrthobicupola(),
  },
  {
    id: 'j31',
    name: 'Pentagonal Gyrobicupola',
    category: 'johnson-bicupola',
    faceComposition: '△×10 + □×10 + ⬠×2',
    faceCount: 22,
    factory: () => new PentagonalGyrobicupola(),
  },
  {
    id: 'j32',
    name: 'Pentagonal Orthocupolarotunda',
    category: 'johnson-bicupola',
    faceComposition: '△×15 + □×5 + ⬠×7',
    faceCount: 27,
    factory: () => new PentagonalOrthocupolarotunda(),
  },
  {
    id: 'j33',
    name: 'Pentagonal Gyrocupolarotunda',
    category: 'johnson-bicupola',
    faceComposition: '△×15 + □×5 + ⬠×7',
    faceCount: 27,
    factory: () => new PentagonalGyrocupolarotunda(),
  },
  {
    id: 'j34',
    name: 'Pentagonal Orthobirotunda',
    category: 'johnson-bicupola',
    faceComposition: '△×20 + ⬠×12',
    faceCount: 32,
    factory: () => new PentagonalOrthobirotunda(),
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
