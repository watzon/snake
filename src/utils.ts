// src/utils.ts
import type { Point, Direction, Snake, PowerupType, GameState, WebSocketData } from './types';
import type { ServerWebSocket } from 'bun'; // Import ServerWebSocket
import {
    GRID_SIZE, MAP_WIDTH, MAP_HEIGHT, INITIAL_SNAKE_LENGTH, FOOD_COUNT, MAX_POWERUPS,
    POWERUP_SPAWN_CHANCE, BOUNDARY_MARGIN
} from './constants';

// Define clients type based on usage in broadcast
type ClientMap = Map<string, ServerWebSocket<WebSocketData>>;

// --- Helper Functions ---

export function getRandomColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

export function getAllOccupiedPoints(gameState: GameState): Point[] {
    let occupied: Point[] = [];
    Object.values(gameState.snakes).forEach(s => {
        if (!s.isDead) occupied = occupied.concat(s.body);
    });
    occupied = occupied.concat(gameState.food);
    occupied = occupied.concat(gameState.powerups);
    return occupied;
}

export function getRandomPosition(occupied: Point[] = []): Point {
    let pos: Point;
    let collision: boolean;
    // Calculate spawnable grid limits based on boundary
    const minGridX = BOUNDARY_MARGIN / GRID_SIZE;
    const maxGridX = (MAP_WIDTH - BOUNDARY_MARGIN) / GRID_SIZE;
    const minGridY = BOUNDARY_MARGIN / GRID_SIZE;
    const maxGridY = (MAP_HEIGHT - BOUNDARY_MARGIN) / GRID_SIZE;

    do {
        collision = false;
        // Generate position within the spawnable area
        pos = {
            x: (minGridX + Math.floor(Math.random() * (maxGridX - minGridX))) * GRID_SIZE,
            y: (minGridY + Math.floor(Math.random() * (maxGridY - minGridY))) * GRID_SIZE,
        };
        for (const p of occupied) {
            if (p.x === pos.x && p.y === pos.y) {
                collision = true;
                break;
            }
        }
    } while (collision);
    return pos;
}

// Pass gameState to get occupied points
export function createNewSnake(id: string, gameState: GameState): Snake {
    const startPos = getRandomPosition(getAllOccupiedPoints(gameState));
    const body: Point[] = [];
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
        let segX = startPos.x - i * GRID_SIZE;
        let segY = startPos.y;
        segX = Math.max(0, segX);
        body.push({ x: segX, y: segY });
    }
    body.reverse();
    const initialDirection: Direction = 'right';
    return {
        id,
        username: 'ANON', // Default username until set
        body,
        direction: initialDirection,
        color: getRandomColor(),
        width: GRID_SIZE, // Set initial width to GRID_SIZE
        score: 0,
        isDead: false,
        powerup: undefined,
        pendingDirection: initialDirection,
        moveProgress: 0,
    };
}

// Pass gameState to get occupied points
export function resetSnake(snake: Snake, gameState: GameState) {
    const startPos = getRandomPosition(getAllOccupiedPoints(gameState)); // Uses new map size
    const body: Point[] = [];
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
         let segX = startPos.x - i * GRID_SIZE;
         let segY = startPos.y;
         segX = Math.max(0, segX);
         body.push({ x: segX, y: segY });
    }
    body.reverse();
    const initialDirection: Direction = 'right';
    snake.body = body;
    snake.direction = initialDirection;
    snake.pendingDirection = initialDirection;
    snake.color = getRandomColor();
    snake.width = GRID_SIZE; // Set reset width to GRID_SIZE
    snake.score = 0;
    snake.isDead = false;
    snake.powerup = undefined;
    snake.moveProgress = 0; // <-- Initialize
}

// Pass gameState to modify it
export function spawnFood(gameState: GameState) {
    // Use updated FOOD_COUNT
    while (gameState.food.length < FOOD_COUNT) {
        gameState.food.push(getRandomPosition(getAllOccupiedPoints(gameState)));
    }
}

// Pass gameState to modify it
export function spawnPowerup(gameState: GameState) {
    // Use updated MAX_POWERUPS
    if (gameState.powerups.length < MAX_POWERUPS && Math.random() < POWERUP_SPAWN_CHANCE) {
        const types: PowerupType[] = ['speed', 'invincible', 'shrink'];
        const type = types[Math.floor(Math.random() * types.length)];
        const pos = getRandomPosition(getAllOccupiedPoints(gameState));
        const id = `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        gameState.powerups.push({ ...pos, type, id });
        // console.log(`Spawned powerup: ${type} at (${pos.x}, ${pos.y})`);
    }
}

// Pass clients map
export function broadcast(message: any, clients: ClientMap) {
    const msgString = JSON.stringify(message);
    clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(msgString); } catch (error) { console.error("Error sending message:", error); }
        }
    });
}