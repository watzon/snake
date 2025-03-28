// src/utils.ts
import type { Point, Direction, Snake, PowerupType, GameState, WebSocketData } from './types';
import type { ServerWebSocket } from 'bun'; // Import ServerWebSocket
import {
    GRID_SIZE, MAP_WIDTH, MAP_HEIGHT, INITIAL_SNAKE_LENGTH, FOOD_COUNT, MAX_POWERUPS,
    POWERUP_SPAWN_CHANCE, BOUNDARY_MARGIN, SPAWN_BOUNDARY_MARGIN // Added SPAWN_BOUNDARY_MARGIN
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

// New function for safe snake spawning
export function getSafeSnakeSpawnPosition(gameState: GameState, currentSnakeId?: string): Point | null {
    const proximityLimit = GRID_SIZE * 5; // How close is too close to another snake
    const proximityLimitSq = proximityLimit * proximityLimit;
    const maxAttempts = 50; // Try N times before giving up

    // Calculate spawnable grid limits using the larger spawn margin
    const minGridX = Math.ceil(SPAWN_BOUNDARY_MARGIN / GRID_SIZE);
    const maxGridX = Math.floor((MAP_WIDTH - SPAWN_BOUNDARY_MARGIN) / GRID_SIZE);
    const minGridY = Math.ceil(SPAWN_BOUNDARY_MARGIN / GRID_SIZE);
    const maxGridY = Math.floor((MAP_HEIGHT - SPAWN_BOUNDARY_MARGIN) / GRID_SIZE);

    if (maxGridX <= minGridX || maxGridY <= minGridY) {
        console.error("Spawn area is too small or negative based on SPAWN_BOUNDARY_MARGIN.");
        return getRandomPosition(getAllOccupiedPoints(gameState)); // Fallback to old method if margins are bad
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let pos = {
            x: (minGridX + Math.floor(Math.random() * (maxGridX - minGridX))) * GRID_SIZE,
            y: (minGridY + Math.floor(Math.random() * (maxGridY - minGridY))) * GRID_SIZE,
        };

        let tooClose = false;
        // Check proximity to other snakes only
        for (const snake of Object.values(gameState.snakes)) {
            // Skip self if resetting, skip dead snakes
            if (snake.id === currentSnakeId || snake.isDead) continue;

            for (const segment of snake.body) {
                const dx = pos.x - segment.x;
                const dy = pos.y - segment.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < proximityLimitSq) {
                    tooClose = true;
                    break; // Too close to this segment, try a new position
                }
            }
            if (tooClose) break; // Too close to this snake, try a new position
        }

        if (!tooClose) {
            // Also check direct collision with food/powerups (optional, less critical)
            // let collision = gameState.food.some(f => f.x === pos.x && f.y === pos.y) ||
            //                 gameState.powerups.some(p => p.x === pos.x && p.y === pos.y);
            // if (!collision) return pos;
             return pos; // Found a safe spot
        }
    }

    console.warn(`Could not find a safe spawn position after ${maxAttempts} attempts. Using fallback.`);
    // Fallback if no safe spot found after many tries
    return getRandomPosition(getAllOccupiedPoints(gameState));
}

// Pass gameState to get occupied points
export function createNewSnake(id: string, gameState: GameState): Snake {
    let startPos = getSafeSnakeSpawnPosition(gameState); // Changed to let
    if (!startPos) { // Should ideally not happen with fallback, but handle defensively
        console.error("CRITICAL: Failed to find any spawn position for new snake!");
        // Handle this case - maybe spawn at center? For now, error out or use 0,0
        startPos = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    }

    // Determine a safe initial direction (away from nearby walls)
    let initialDirection: Direction = 'right'; // Default
    const distToLeft = startPos.x - SPAWN_BOUNDARY_MARGIN;
    const distToRight = (MAP_WIDTH - SPAWN_BOUNDARY_MARGIN) - startPos.x;
    const distToTop = startPos.y - SPAWN_BOUNDARY_MARGIN;
    const distToBottom = (MAP_HEIGHT - SPAWN_BOUNDARY_MARGIN) - startPos.y;
    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    if (minDist === distToLeft) initialDirection = 'right';
    else if (minDist === distToRight) initialDirection = 'left';
    else if (minDist === distToTop) initialDirection = 'down';
    else if (minDist === distToBottom) initialDirection = 'up';

    const body: Point[] = [];
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
        let x = startPos.x;
        let y = startPos.y;
        // Place initial body segments *behind* the head based on initial direction
        switch (initialDirection) {
            case 'up':    y += i * GRID_SIZE; break;
            case 'down':  y -= i * GRID_SIZE; break;
            case 'left':  x += i * GRID_SIZE; break;
            case 'right': x -= i * GRID_SIZE; break;
        }
         // Clamp initial body segments within map boundaries just in case
        x = Math.max(BOUNDARY_MARGIN, Math.min(MAP_WIDTH - BOUNDARY_MARGIN - GRID_SIZE, x));
        y = Math.max(BOUNDARY_MARGIN, Math.min(MAP_HEIGHT - BOUNDARY_MARGIN - GRID_SIZE, y));
        body.push({ x, y });
    }
    body.reverse(); // Head is the last element

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
        isAI: false, // Newly created snakes are human by default
        lastActivityTime: Date.now(), // Initialize activity time
    };
}

// Pass gameState to get occupied points
export function resetSnake(snake: Snake, gameState: GameState) {
    let startPos = getSafeSnakeSpawnPosition(gameState, snake.id); // Use safe spawner, pass current ID
     if (!startPos) { // Fallback if safe position not found
        console.error(`CRITICAL: Failed to find safe respawn position for snake ${snake.id}!`);
        startPos = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    }

    // Determine a safe initial direction (away from nearby walls)
    let initialDirection: Direction = 'right'; // Default
    const distToLeft = startPos.x - SPAWN_BOUNDARY_MARGIN;
    const distToRight = (MAP_WIDTH - SPAWN_BOUNDARY_MARGIN) - startPos.x;
    const distToTop = startPos.y - SPAWN_BOUNDARY_MARGIN;
    const distToBottom = (MAP_HEIGHT - SPAWN_BOUNDARY_MARGIN) - startPos.y;
    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    if (minDist === distToLeft) initialDirection = 'right';
    else if (minDist === distToRight) initialDirection = 'left';
    else if (minDist === distToTop) initialDirection = 'down';
    else if (minDist === distToBottom) initialDirection = 'up';

    const body: Point[] = [];
    for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
        let x = startPos.x;
        let y = startPos.y;
        // Place initial body segments *behind* the head based on initial direction
        switch (initialDirection) {
            case 'up':    y += i * GRID_SIZE; break;
            case 'down':  y -= i * GRID_SIZE; break;
            case 'left':  x += i * GRID_SIZE; break;
            case 'right': x -= i * GRID_SIZE; break;
        }
        // Clamp initial body segments within map boundaries just in case
        x = Math.max(BOUNDARY_MARGIN, Math.min(MAP_WIDTH - BOUNDARY_MARGIN - GRID_SIZE, x));
        y = Math.max(BOUNDARY_MARGIN, Math.min(MAP_HEIGHT - BOUNDARY_MARGIN - GRID_SIZE, y));
        body.push({ x, y });
    }
    body.reverse(); // Head is the last element

    snake.body = body;
    snake.direction = initialDirection;
    snake.pendingDirection = initialDirection;
    snake.color = getRandomColor();
    snake.width = GRID_SIZE; // Set reset width to GRID_SIZE
    snake.score = 0;
    snake.isDead = false;
    snake.powerup = undefined;
    snake.moveProgress = 0; // <-- Initialize
    // DO NOT reset lastActivityTime here, only on actual input
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