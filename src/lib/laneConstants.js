// Physical specifications of a regulation tenpin bowling lane.
// These drive both the 3D geometry and the density grid resolution.

export const BOARD_COUNT = 39; // boards across the lane
export const CENTER_BOARD = 20; // board 20 is the centre board
export const BOARD_WIDTH_INCH = 1.0417; // width of a single board (in)
export const LANE_WIDTH_INCH = BOARD_COUNT * BOARD_WIDTH_INCH; // ~40.6"
export const LANE_LENGTH_FEET = 60; // foul line to pin deck (ft)

// Convert real dimensions to the "feet" unit used in the 3D scene.
export const BOARD_WIDTH_FEET = BOARD_WIDTH_INCH / 12; // ~0.0868 ft

// Density grid resolution.
export const FEET_RESOLUTION = 0.25; // sample every quarter foot down-lane
export const FEET_SAMPLES = Math.round(LANE_LENGTH_FEET / FEET_RESOLUTION); // 240

// Default oil-per-board used when a row has no measured T.OIL (micro-litres).
export const DEFAULT_OIL_PER_BOARD_UL = 50;
