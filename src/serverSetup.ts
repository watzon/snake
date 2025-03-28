// src/serverSetup.ts
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import type { WebSocketHandler, ServerWebSocket } from 'bun'; // Import Bun types
import type { GameState, WebSocketData, ServerInfo, Direction } from './types';
import { nodeMode } from './config'; // Import only what's needed from config
import { createNewSnake, broadcast } from './utils';
import { handleServerRegistration } from './nodeDiscovery';

// Define types for maps based on usage
type ClientMap = Map<string, ServerWebSocket<WebSocketData>>;
type KnownServersMap = Map<string, ServerInfo>;

// Function to create and configure the Hono app and WebSocket handlers
export function createServerSetup(
    gameState: GameState,
    clients: ClientMap,
    knownServers: KnownServersMap
) {
    // --- Hono App Setup ---
    const app = new Hono();

    // Serve static files based on environment
    const staticRoot = process.env.NODE_ENV === 'production' ? './dist' : './frontend';
    console.log(`Serving static files from: ${staticRoot}`);
    app.use('/*', serveStatic({ root: staticRoot }));

    // SPA fallback for production: serve index.html for any unknown path
    if (process.env.NODE_ENV === 'production') {
        console.log(`Production mode: Adding SPA fallback route to ${staticRoot}/index.html`);
        app.use('*', serveStatic({ path: `${staticRoot}/index.html` }));
    }


    // Endpoint for clients to fetch the current game state
    app.get('/gamestate', (c) => {
        return c.json(gameState);
    });

    // --- Node Discovery Routes ---
    if (nodeMode) {
        console.log('Node mode enabled: Adding /register and /servers routes.');
        // Endpoint for game servers to register
        app.post('/register', async (c) => {
            try {
                const body = await c.req.json<{ id: string, address: string, playerCount: number }>();
                if (!body || typeof body.id !== 'string' || typeof body.address !== 'string' || typeof body.playerCount !== 'number') {
                    return c.text('Invalid registration payload', 400);
                }
                // Pass knownServers map to the handler
                const success = handleServerRegistration(body.id, body.address, body.playerCount, knownServers);
                return success ? c.text('Registered', 200) : c.text('Registration failed', 500);
            } catch (error) {
                console.error('Error handling /register:', error);
                return c.text('Internal Server Error', 500);
            }
        });

        // Endpoint to get the list of active servers
        app.get('/servers', (c) => {
            const serverList = Array.from(knownServers.values());
            return c.json(serverList);
        });
    }

    // --- Bun WebSocket Handlers ---
    const wsHandlers: WebSocketHandler<WebSocketData> = {
         open(ws) {
            const clientId = `user_${Date.now()}_${Math.random().toString(16).slice(2)}`;
            console.log(`Client connected: ${clientId}`);
            clients.set(clientId, ws);
            ws.data = { clientId }; // Attach clientId to the WebSocket session data

            const newSnake = createNewSnake(clientId, gameState); // Pass gameState
            gameState.snakes[clientId] = newSnake;

            // Send initial state
            ws.send(JSON.stringify({
                type: 'init',
                payload: {
                    clientId: clientId,
                    initialState: gameState
                }
            }));

             broadcast({ type: 'playerJoined', payload: newSnake }, clients); // Pass clients
        },
         message(ws, message) {
            try {
                const clientId = ws.data?.clientId;
                if (!clientId) return;

                const parsedMessage = JSON.parse(message.toString());
                const snake = gameState.snakes[clientId];

                if (parsedMessage.type === 'setUsername') {
                    const username = parsedMessage.username.toUpperCase();
                    // Basic validation for username
                    if (username && typeof username === 'string' && username.length === 4 && /^[A-Z]+$/.test(username)) {
                        if (snake) {
                            snake.username = username;
                            broadcast({ // Pass clients
                                type: 'playerUpdate',
                                payload: { id: clientId, username: username }
                            }, clients);
                        }
                    } else {
                         console.warn(`Invalid username attempt from ${clientId}: ${parsedMessage.username}`);
                    }
                    return;
                }

                if (parsedMessage.type === 'ping') {
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: parsedMessage.timestamp
                    }));
                    return;
                }

                if (parsedMessage.type === 'directionChange') {
                     // Basic validation for direction
                    const direction = parsedMessage.payload;
                    if (['up', 'down', 'left', 'right'].includes(direction)) {
                         if (snake && !snake.isDead) {
                             snake.pendingDirection = direction as Direction;
                         }
                    } else {
                        console.warn(`Invalid direction change from ${clientId}: ${direction}`);
                    }
                }
            } catch (error) {
                console.error("Failed to parse message:", message, error);
            }
        },
        close(ws, code, reason) {
            const clientId = ws.data?.clientId;
            if (!clientId) return;

            console.log(`Client disconnected: ${clientId}`, code, reason);
            clients.delete(clientId);
            if (gameState.snakes[clientId]) {
                delete gameState.snakes[clientId];
                broadcast({ type: 'playerLeft', payload: { clientId } }, clients); // Pass clients
            }
        }
    };

    // Return the configured app and handlers
    return { app, wsHandlers };
}