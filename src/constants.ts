// src/constants.ts

// --- Game Constants ---
export const GRID_SIZE = 20;
export const BOUNDARY_MARGIN = GRID_SIZE; // Space between playable area and visual border
// Quadruple the previous larger size (2400x1800 -> 4800x3600)
export const MAP_WIDTH = 4800; // Previous 2400 * 2
export const MAP_HEIGHT = 3600; // Previous 1800 * 2
export const TICK_RATE = 100; // Reverted back from 80ms
export const INITIAL_SNAKE_LENGTH = 3;
// Scale food count roughly with area (4x)
export const FOOD_COUNT = 300; // Previous 75 * 4
export const POWERUP_SPAWN_CHANCE = 0.01; // Keep spawn chance per tick
// Scale max powerups (maybe slightly less than 4x)
export const MAX_POWERUPS = 15; // Previous 5 * 3 (adjust as desired)
export const POWERUP_DURATION = 50;
export const PORTAL_WIDTH = 300; // Width of the portal object in game units (Increased width again)

// --- Constants for Slowdown ---
export const MAX_LENGTH_NO_SLOWDOWN = 15; // Length up to which there's no slowdown
export const MAX_SLOWDOWN_FACTOR = 0.5; // Minimum speed factor (e.g., 0.5 means half speed)
export const SLOWDOWN_PER_SEGMENT = 0.003; // How much speed factor decreases per segment over the threshold

// --- Node Discovery Constants ---
export const NODE_PING_INTERVAL = 30 * 1000; // How often nodes check/clean up servers
export const NODE_REGISTER_INTERVAL = 60 * 1000; // How often game servers register with nodes
export const NODE_TIMEOUT = NODE_REGISTER_INTERVAL * 2.5; // Remove node if not seen for this long