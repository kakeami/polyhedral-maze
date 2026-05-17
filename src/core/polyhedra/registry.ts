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
import { ElongatedTriangularOrthobicupola } from './johnson/j35-elongated-triangular-orthobicupola.ts';
import { ElongatedTriangularGyrobicupola } from './johnson/j36-elongated-triangular-gyrobicupola.ts';
import { ElongatedSquareGyrobicupola } from './johnson/j37-elongated-square-gyrobicupola.ts';
import { ElongatedPentagonalOrthobicupola } from './johnson/j38-elongated-pentagonal-orthobicupola.ts';
import { ElongatedPentagonalGyrobicupola } from './johnson/j39-elongated-pentagonal-gyrobicupola.ts';
import { ElongatedPentagonalOrthocupolarotunda } from './johnson/j40-elongated-pentagonal-orthocupolarotunda.ts';
import { ElongatedPentagonalGyrocupolarotunda } from './johnson/j41-elongated-pentagonal-gyrocupolarotunda.ts';
import { ElongatedPentagonalOrthobirotunda } from './johnson/j42-elongated-pentagonal-orthobirotunda.ts';
import { ElongatedPentagonalGyrobirotunda } from './johnson/j43-elongated-pentagonal-gyrobirotunda.ts';
import { GyroelongatedTriangularBicupola } from './johnson/j44-gyroelongated-triangular-bicupola.ts';
import { GyroelongatedSquareBicupola } from './johnson/j45-gyroelongated-square-bicupola.ts';
import { GyroelongatedPentagonalBicupola } from './johnson/j46-gyroelongated-pentagonal-bicupola.ts';
import { GyroelongatedPentagonalCupolarotunda } from './johnson/j47-gyroelongated-pentagonal-cupolarotunda.ts';
import { GyroelongatedPentagonalBirotunda } from './johnson/j48-gyroelongated-pentagonal-birotunda.ts';
import { AugmentedTriangularPrism } from './johnson/j49-augmented-triangular-prism.ts';
import { BiaugmentedTriangularPrism } from './johnson/j50-biaugmented-triangular-prism.ts';
import { AugmentedPentagonalPrism } from './johnson/j52-augmented-pentagonal-prism.ts';
import { BiaugmentedPentagonalPrism } from './johnson/j53-biaugmented-pentagonal-prism.ts';
import { AugmentedHexagonalPrism } from './johnson/j54-augmented-hexagonal-prism.ts';
import { ParabiaugmentedHexagonalPrism } from './johnson/j55-parabiaugmented-hexagonal-prism.ts';
import { MetabiaugmentedHexagonalPrism } from './johnson/j56-metabiaugmented-hexagonal-prism.ts';
import { TriaugmentedHexagonalPrism } from './johnson/j57-triaugmented-hexagonal-prism.ts';
import { AugmentedDodecahedron } from './johnson/j58-augmented-dodecahedron.ts';
import { ParabiaugmentedDodecahedron } from './johnson/j59-parabiaugmented-dodecahedron.ts';
import { MetabiaugmentedDodecahedron } from './johnson/j60-metabiaugmented-dodecahedron.ts';
import { TriaugmentedDodecahedron } from './johnson/j61-triaugmented-dodecahedron.ts';
import { MetabidiminishedIcosahedron } from './johnson/j62-metabidiminished-icosahedron.ts';
import { TridiminishedIcosahedron } from './johnson/j63-tridiminished-icosahedron.ts';
import { AugmentedTridiminishedIcosahedron } from './johnson/j64-augmented-tridiminished-icosahedron.ts';
import { GyrateRhombicosidodecahedron } from './johnson/j72-gyrate-rhombicosidodecahedron.ts';
import { ParabigyrateRhombicosidodecahedron } from './johnson/j73-parabigyrate-rhombicosidodecahedron.ts';
import { MetabigyrateRhombicosidodecahedron } from './johnson/j74-metabigyrate-rhombicosidodecahedron.ts';
import { TrigyrateRhombicosidodecahedron } from './johnson/j75-trigyrate-rhombicosidodecahedron.ts';
import { DiminishedRhombicosidodecahedron } from './johnson/j76-diminished-rhombicosidodecahedron.ts';
import { ParagyrateDiminishedRhombicosidodecahedron } from './johnson/j77-paragyrate-diminished-rhombicosidodecahedron.ts';
import { MetagyrateDiminishedRhombicosidodecahedron } from './johnson/j78-metagyrate-diminished-rhombicosidodecahedron.ts';
import { BigyrateDiminishedRhombicosidodecahedron } from './johnson/j79-bigyrate-diminished-rhombicosidodecahedron.ts';
import { ParabidiminishedRhombicosidodecahedron } from './johnson/j80-parabidiminished-rhombicosidodecahedron.ts';
import { MetabidiminishedRhombicosidodecahedron } from './johnson/j81-metabidiminished-rhombicosidodecahedron.ts';
import { GyrateBidiminishedRhombicosidodecahedron } from './johnson/j82-gyrate-bidiminished-rhombicosidodecahedron.ts';
import { TridiminishedRhombicosidodecahedron } from './johnson/j83-tridiminished-rhombicosidodecahedron.ts';
import { AugmentedTruncatedTetrahedron } from './johnson/j65-augmented-truncated-tetrahedron.ts';
import { AugmentedTruncatedCube } from './johnson/j66-augmented-truncated-cube.ts';
import { BiaugmentedTruncatedCube } from './johnson/j67-biaugmented-truncated-cube.ts';
import { AugmentedTruncatedDodecahedron } from './johnson/j68-augmented-truncated-dodecahedron.ts';
import { ParabiaugmentedTruncatedDodecahedron } from './johnson/j69-parabiaugmented-truncated-dodecahedron.ts';
import { MetabiaugmentedTruncatedDodecahedron } from './johnson/j70-metabiaugmented-truncated-dodecahedron.ts';
import { TriaugmentedTruncatedDodecahedron } from './johnson/j71-triaugmented-truncated-dodecahedron.ts';

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
  | 'johnson-elongated-bicupola'
  | 'johnson-augmented-prism'
  | 'johnson-augmented-dodeca'
  | 'johnson-augmented-truncated'
  | 'johnson-diminished-icosa'
  | 'johnson-rhombic-mods'
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
  'johnson-elongated-bicupola': 'Johnson: Elongated Bicupolae',
  'johnson-augmented-prism': 'Johnson: Augmented Prisms',
  'johnson-augmented-dodeca': 'Johnson: Augmented Dodecahedra',
  'johnson-augmented-truncated': 'Johnson: Augmented Truncated',
  'johnson-diminished-icosa': 'Johnson: Diminished Icosahedra',
  'johnson-rhombic-mods': 'Johnson: Rhombicosi. Mods',
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
  {
    id: 'j35',
    name: 'Elongated Triangular Orthobicupola',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×8 + □×12',
    faceCount: 20,
    factory: () => new ElongatedTriangularOrthobicupola(),
  },
  {
    id: 'j36',
    name: 'Elongated Triangular Gyrobicupola',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×8 + □×12',
    faceCount: 20,
    factory: () => new ElongatedTriangularGyrobicupola(),
  },
  {
    id: 'j37',
    name: 'Elongated Square Gyrobicupola',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×8 + □×18',
    faceCount: 26,
    factory: () => new ElongatedSquareGyrobicupola(),
  },
  {
    id: 'j38',
    name: 'Elongated Pentagonal Orthobicupola',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×10 + □×20 + ⬠×2',
    faceCount: 32,
    factory: () => new ElongatedPentagonalOrthobicupola(),
  },
  {
    id: 'j39',
    name: 'Elongated Pentagonal Gyrobicupola',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×10 + □×20 + ⬠×2',
    faceCount: 32,
    factory: () => new ElongatedPentagonalGyrobicupola(),
  },
  {
    id: 'j40',
    name: 'Elongated Pentagonal Orthocupolarotunda',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×15 + □×15 + ⬠×7',
    faceCount: 37,
    factory: () => new ElongatedPentagonalOrthocupolarotunda(),
  },
  {
    id: 'j41',
    name: 'Elongated Pentagonal Gyrocupolarotunda',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×15 + □×15 + ⬠×7',
    faceCount: 37,
    factory: () => new ElongatedPentagonalGyrocupolarotunda(),
  },
  {
    id: 'j42',
    name: 'Elongated Pentagonal Orthobirotunda',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×20 + □×10 + ⬠×12',
    faceCount: 42,
    factory: () => new ElongatedPentagonalOrthobirotunda(),
  },
  {
    id: 'j43',
    name: 'Elongated Pentagonal Gyrobirotunda',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×20 + □×10 + ⬠×12',
    faceCount: 42,
    factory: () => new ElongatedPentagonalGyrobirotunda(),
  },
  {
    id: 'j44',
    name: 'Gyroelongated Triangular Bicupola',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×20 + □×6',
    faceCount: 26,
    factory: () => new GyroelongatedTriangularBicupola(),
  },
  {
    id: 'j45',
    name: 'Gyroelongated Square Bicupola',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×24 + □×10',
    faceCount: 34,
    factory: () => new GyroelongatedSquareBicupola(),
  },
  {
    id: 'j46',
    name: 'Gyroelongated Pentagonal Bicupola',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×30 + □×10 + ⬠×2',
    faceCount: 42,
    factory: () => new GyroelongatedPentagonalBicupola(),
  },
  {
    id: 'j47',
    name: 'Gyroelongated Pentagonal Cupolarotunda',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×35 + □×5 + ⬠×7',
    faceCount: 47,
    factory: () => new GyroelongatedPentagonalCupolarotunda(),
  },
  {
    id: 'j48',
    name: 'Gyroelongated Pentagonal Birotunda',
    category: 'johnson-elongated-bicupola',
    faceComposition: '△×40 + ⬠×12',
    faceCount: 52,
    factory: () => new GyroelongatedPentagonalBirotunda(),
  },
  {
    id: 'j49',
    name: 'Augmented Triangular Prism',
    category: 'johnson-augmented-prism',
    faceComposition: '△×6 + □×2',
    faceCount: 8,
    factory: () => new AugmentedTriangularPrism(),
  },
  {
    id: 'j50',
    name: 'Biaugmented Triangular Prism',
    category: 'johnson-augmented-prism',
    faceComposition: '△×10 + □×1',
    faceCount: 11,
    factory: () => new BiaugmentedTriangularPrism(),
  },
  {
    id: 'j52',
    name: 'Augmented Pentagonal Prism',
    category: 'johnson-augmented-prism',
    faceComposition: '△×4 + □×4 + ⬠×2',
    faceCount: 10,
    factory: () => new AugmentedPentagonalPrism(),
  },
  {
    id: 'j53',
    name: 'Biaugmented Pentagonal Prism',
    category: 'johnson-augmented-prism',
    faceComposition: '△×8 + □×3 + ⬠×2',
    faceCount: 13,
    factory: () => new BiaugmentedPentagonalPrism(),
  },
  {
    id: 'j54',
    name: 'Augmented Hexagonal Prism',
    category: 'johnson-augmented-prism',
    faceComposition: '△×4 + □×5 + ⬡×2',
    faceCount: 11,
    factory: () => new AugmentedHexagonalPrism(),
  },
  {
    id: 'j55',
    name: 'Parabiaugmented Hexagonal Prism',
    category: 'johnson-augmented-prism',
    faceComposition: '△×8 + □×4 + ⬡×2',
    faceCount: 14,
    factory: () => new ParabiaugmentedHexagonalPrism(),
  },
  {
    id: 'j56',
    name: 'Metabiaugmented Hexagonal Prism',
    category: 'johnson-augmented-prism',
    faceComposition: '△×8 + □×4 + ⬡×2',
    faceCount: 14,
    factory: () => new MetabiaugmentedHexagonalPrism(),
  },
  {
    id: 'j57',
    name: 'Triaugmented Hexagonal Prism',
    category: 'johnson-augmented-prism',
    faceComposition: '△×12 + □×3 + ⬡×2',
    faceCount: 17,
    factory: () => new TriaugmentedHexagonalPrism(),
  },
  {
    id: 'j58',
    name: 'Augmented Dodecahedron',
    category: 'johnson-augmented-dodeca',
    faceComposition: '△×5 + ⬠×11',
    faceCount: 16,
    factory: () => new AugmentedDodecahedron(),
  },
  {
    id: 'j59',
    name: 'Parabiaugmented Dodecahedron',
    category: 'johnson-augmented-dodeca',
    faceComposition: '△×10 + ⬠×10',
    faceCount: 20,
    factory: () => new ParabiaugmentedDodecahedron(),
  },
  {
    id: 'j60',
    name: 'Metabiaugmented Dodecahedron',
    category: 'johnson-augmented-dodeca',
    faceComposition: '△×10 + ⬠×10',
    faceCount: 20,
    factory: () => new MetabiaugmentedDodecahedron(),
  },
  {
    id: 'j61',
    name: 'Triaugmented Dodecahedron',
    category: 'johnson-augmented-dodeca',
    faceComposition: '△×15 + ⬠×9',
    faceCount: 24,
    factory: () => new TriaugmentedDodecahedron(),
  },
  {
    id: 'j62',
    name: 'Metabidiminished Icosahedron',
    category: 'johnson-diminished-icosa',
    faceComposition: '△×10 + ⬠×2',
    faceCount: 12,
    factory: () => new MetabidiminishedIcosahedron(),
  },
  {
    id: 'j63',
    name: 'Tridiminished Icosahedron',
    category: 'johnson-diminished-icosa',
    faceComposition: '△×5 + ⬠×3',
    faceCount: 8,
    factory: () => new TridiminishedIcosahedron(),
  },
  {
    id: 'j64',
    name: 'Augmented Tridiminished Icosahedron',
    category: 'johnson-diminished-icosa',
    faceComposition: '△×7 + ⬠×3',
    faceCount: 10,
    factory: () => new AugmentedTridiminishedIcosahedron(),
  },
  {
    id: 'j65',
    name: 'Augmented Truncated Tetrahedron',
    category: 'johnson-augmented-truncated',
    faceComposition: '△×8 + □×3 + ⬡×3',
    faceCount: 14,
    factory: () => new AugmentedTruncatedTetrahedron(),
  },
  {
    id: 'j66',
    name: 'Augmented Truncated Cube',
    category: 'johnson-augmented-truncated',
    faceComposition: '△×12 + □×5 + 8gon×5',
    faceCount: 22,
    factory: () => new AugmentedTruncatedCube(),
  },
  {
    id: 'j67',
    name: 'Biaugmented Truncated Cube',
    category: 'johnson-augmented-truncated',
    faceComposition: '△×16 + □×10 + 8gon×4',
    faceCount: 30,
    factory: () => new BiaugmentedTruncatedCube(),
  },
  {
    id: 'j68',
    name: 'Augmented Truncated Dodecahedron',
    category: 'johnson-augmented-truncated',
    faceComposition: '△×25 + □×5 + ⬠×1 + 10gon×11',
    faceCount: 42,
    factory: () => new AugmentedTruncatedDodecahedron(),
  },
  {
    id: 'j69',
    name: 'Parabiaugmented Truncated Dodecahedron',
    category: 'johnson-augmented-truncated',
    faceComposition: '△×30 + □×10 + ⬠×2 + 10gon×10',
    faceCount: 52,
    factory: () => new ParabiaugmentedTruncatedDodecahedron(),
  },
  {
    id: 'j70',
    name: 'Metabiaugmented Truncated Dodecahedron',
    category: 'johnson-augmented-truncated',
    faceComposition: '△×30 + □×10 + ⬠×2 + 10gon×10',
    faceCount: 52,
    factory: () => new MetabiaugmentedTruncatedDodecahedron(),
  },
  {
    id: 'j71',
    name: 'Triaugmented Truncated Dodecahedron',
    category: 'johnson-augmented-truncated',
    faceComposition: '△×35 + □×15 + ⬠×3 + 10gon×9',
    faceCount: 62,
    factory: () => new TriaugmentedTruncatedDodecahedron(),
  },
  {
    id: 'j72',
    name: 'Gyrate Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×20 + □×30 + ⬠×12',
    faceCount: 62,
    factory: () => new GyrateRhombicosidodecahedron(),
  },
  {
    id: 'j73',
    name: 'Parabigyrate Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×20 + □×30 + ⬠×12',
    faceCount: 62,
    factory: () => new ParabigyrateRhombicosidodecahedron(),
  },
  {
    id: 'j74',
    name: 'Metabigyrate Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×20 + □×30 + ⬠×12',
    faceCount: 62,
    factory: () => new MetabigyrateRhombicosidodecahedron(),
  },
  {
    id: 'j75',
    name: 'Trigyrate Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×20 + □×30 + ⬠×12',
    faceCount: 62,
    factory: () => new TrigyrateRhombicosidodecahedron(),
  },
  {
    id: 'j76',
    name: 'Diminished Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×15 + □×25 + ⬠×11 + 10gon×1',
    faceCount: 52,
    factory: () => new DiminishedRhombicosidodecahedron(),
  },
  {
    id: 'j77',
    name: 'Paragyrate Diminished Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×15 + □×25 + ⬠×11 + 10gon×1',
    faceCount: 52,
    factory: () => new ParagyrateDiminishedRhombicosidodecahedron(),
  },
  {
    id: 'j78',
    name: 'Metagyrate Diminished Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×15 + □×25 + ⬠×11 + 10gon×1',
    faceCount: 52,
    factory: () => new MetagyrateDiminishedRhombicosidodecahedron(),
  },
  {
    id: 'j79',
    name: 'Bigyrate Diminished Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×15 + □×25 + ⬠×11 + 10gon×1',
    faceCount: 52,
    factory: () => new BigyrateDiminishedRhombicosidodecahedron(),
  },
  {
    id: 'j80',
    name: 'Parabidiminished Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×10 + □×20 + ⬠×10 + 10gon×2',
    faceCount: 42,
    factory: () => new ParabidiminishedRhombicosidodecahedron(),
  },
  {
    id: 'j81',
    name: 'Metabidiminished Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×10 + □×20 + ⬠×10 + 10gon×2',
    faceCount: 42,
    factory: () => new MetabidiminishedRhombicosidodecahedron(),
  },
  {
    id: 'j82',
    name: 'Gyrate Bidiminished Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×10 + □×20 + ⬠×10 + 10gon×2',
    faceCount: 42,
    factory: () => new GyrateBidiminishedRhombicosidodecahedron(),
  },
  {
    id: 'j83',
    name: 'Tridiminished Rhombicosidodecahedron',
    category: 'johnson-rhombic-mods',
    faceComposition: '△×5 + □×15 + ⬠×9 + 10gon×3',
    faceCount: 32,
    factory: () => new TridiminishedRhombicosidodecahedron(),
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
