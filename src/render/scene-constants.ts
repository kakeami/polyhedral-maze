/** Visual constants for Three.js scene rendering. */
export const SCENE_CONFIG = {
  camera: {
    fov: 50,
    near: 0.01,
    far: 100000,
    position: [3, 0.5, 6] as const,
  },
  sky: {
    scale: 450000,
    turbidity: 2,
    rayleigh: 1.5,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
    elevation: 3,
    azimuth: 200,
  },
  toneMapping: {
    exposure: 0.4,
  },
  controls: {
    target: [0, 0.3, 0] as const,
    dampingFactor: 0.08,
    autoRotateSpeed: 0.5,
  },
  lights: {
    ambientColor: 0xfff0e0,
    ambientIntensity: 0.8,
    directionalColor: 0xffe8c0,
    directionalIntensity: 1.2,
  },
  pixelRatioClamp: 2,
} as const;

/** Visual constants for maze objects in the 3D scene. */
export const MAZE_STYLE = {
  walls: { color: 0x111111, linewidth: 2 },
  outline: { color: 0x000000, linewidth: 3 },
  solution: { color: 0xee3333, linewidth: 3 },
  /**
   * Start / goal / warp are drawn as pins, not as beads sitting on the
   * surface. A bead big enough to spot across the solid is bigger than a cell
   * once the grid is fine, so it both hid the walls it stood on and left the
   * cell it meant ambiguous. The head floats clear of the maze on a stem along
   * the face normal, and the foot dot on the surface is the actual answer.
   * Lengths are in model units — every solid here has circumradius 1.
   */
  markers: {
    startColor: 0x22bb22,
    goalColor: 0xdd2222,
    warpColor: 0xeecc00,
    /** Height of the head above the surface. */
    pinLength: 0.15,
    /** Warp pins are the smaller pair, as before. */
    headRadius: 0.028,
    warpHeadRadius: 0.022,
    stemWidth: 2,
    /** Dot left at the cell centre: small enough to sit inside a fine cell. */
    footRadius: 0.009,
  },
  face: {
    saturation: 0.10,
    lightness: 0.95,
  },
} as const;
