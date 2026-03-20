/** Tolerance for boundary cell detection in normalized local coordinates. */
export const BOUNDARY_TOLERANCE = 0.1;

/** Tolerance for geometric vertex comparison (face adjacency, shared edges). */
export const VERTEX_EPSILON = 1e-6;

/** Tolerance for near-parallel normal detection (opposite faces: dot ≈ -1). */
export const OPPOSITE_FACE_EPSILON = 1e-6;
