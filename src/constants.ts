// src/constants.ts

// --- Game Constants ---
export const GRID_SIZE = 20;
export const BOUNDARY_MARGIN = GRID_SIZE; // Space between playable area and visual border
export const SPAWN_BOUNDARY_MARGIN = GRID_SIZE * 5; // Larger margin for safe spawning
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
export const AFK_TIMEOUT = 60 * 1000; // 60 seconds inactivity threshold

// --- Node Discovery Constants ---
export const NODE_PING_INTERVAL = 30 * 1000; // How often nodes check/clean up servers
export const NODE_REGISTER_INTERVAL = 60 * 1000; // How often game servers register with nodes
export const NODE_TIMEOUT = NODE_REGISTER_INTERVAL * 2.5; // Remove node if not seen for this long

// --- AI Constants ---
export const MIN_AI_SNAKES = 1; // Minimum number of AI snakes to maintain
export const MAX_AI_SNAKES = 5; // Maximum number of AI snakes allowed
export const AI_SPAWN_CHECK_INTERVAL = 500; // Check every 500 ticks (e.g., 50 seconds if TICK_RATE=100)
export const AI_SPAWN_CHANCE_PER_CHECK = 0.1; // 10% chance to spawn an AI if below max during a check
export const AI_QUIT_CHANCE_PER_TICK = 0.00005; // Very small chance for an AI to quit each tick (adjust to balance spawn rate)