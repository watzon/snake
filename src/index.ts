// src/index.ts
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import type { Server, WebSocketHandler, WebSocketServeOptions, ServerWebSocket } from 'bun'; // Import types
import { port, nodeMode, initialNodes, ownAddress, serverId } from './config';
import { GRID_SIZE, MAP_WIDTH, MAP_HEIGHT, TICK_RATE, INITIAL_SNAKE_LENGTH, FOOD_COUNT, POWERUP_SPAWN_CHANCE, MAX_POWERUPS, POWERUP_DURATION, MAX_LENGTH_NO_SLOWDOWN, MAX_SLOWDOWN_FACTOR, SLOWDOWN_PER_SEGMENT, NODE_PING_INTERVAL, NODE_REGISTER_INTERVAL, NODE_TIMEOUT } from './constants';
import type { WebSocketData, Point, Direction, PowerupType, Powerup, Snake, GameState, ServerInfo } from './types';
import { getRandomColor, getAllOccupiedPoints, getRandomPosition, createNewSnake, resetSnake, spawnFood, spawnPowerup, broadcast } from './utils';
import { knownServers, handleServerRegistration, registerWithNodes, cleanupKnownServers } from './nodeDiscovery';
import { gameTick } from './gameLoop';
import { createServerSetup } from './serverSetup';

// --- Server State ---
const gameState: GameState = {
    snakes: {},
    food: [],
    powerups: [],
    map: { width: MAP_WIDTH, height: MAP_HEIGHT, gridSize: GRID_SIZE }, // Use updated constants
};
// Use Bun's ServerWebSocket type with our defined data structure
const clients = new Map<string, ServerWebSocket<WebSocketData>>();

// --- Bun Server Initialization --- (Keep existing Bun.serve structure)
// Create Hono app and WebSocket handlers
const { app, wsHandlers } = createServerSetup(gameState, clients, knownServers);

console.log("Starting Bun server...");
const server = Bun.serve({
    fetch(req: Request, server: Server): Response | Promise<Response> | undefined {
        const url = new URL(req.url);
        if (url.pathname === '/ws') {
            const upgraded = server.upgrade(req, { data: {} });
            if (upgraded) return undefined;
            else return new Response("WebSocket upgrade failed", { status: 400 });
        }
        // Let Hono handle static files and other requests
        return app.fetch(req, server);
    },
    websocket: wsHandlers,
    port: port, // Use the configured port
    error(error: Error): Response { // Simplify return type
        console.error("Bun server error:", error);
        return new Response("Something went wrong", { status: 500 });
    }
} satisfies WebSocketServeOptions<unknown>);

console.log(`Server listening on http://localhost:${server.port} (inside container)`);

// --- Start Node Discovery Tasks ---
if (nodeMode) {
    console.log(`Node mode: Registering self (${serverId} @ ${ownAddress}) in known servers.`);
    knownServers.set(ownAddress, { // Still using address as key
        id: serverId, // Include the serverId
        address: ownAddress,
        lastSeen: Date.now(),
        playerCount: 0 // Initial player count is 0
    });

    console.log('Node mode: Starting server cleanup task.');
    // Pass knownServers and clients to the cleanup function
    setTimeout(() => cleanupKnownServers(knownServers, clients), NODE_PING_INTERVAL);
} else if (initialNodes.length > 0) {
    console.log('Game server mode: Starting node registration task.');
     // Pass clients to the registration function
    setTimeout(() => registerWithNodes(clients), 5000);
}

// Initialize food and start the game loop
console.log("Starting game logic (gameTick)..."); // Game logic runs in all modes now
spawnFood(gameState);
gameTick(gameState, clients); // Start the loop, passing initial state