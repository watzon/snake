// src/gameLoop.ts
import type { GameState, Snake, WebSocketData } from './types';
import type { ServerWebSocket } from 'bun';
import {
    GRID_SIZE, MAP_WIDTH, MAP_HEIGHT, TICK_RATE, POWERUP_DURATION,
    MAX_LENGTH_NO_SLOWDOWN, MAX_SLOWDOWN_FACTOR, SLOWDOWN_PER_SEGMENT,
    BOUNDARY_MARGIN
} from './constants';
import { resetSnake, spawnFood, spawnPowerup, broadcast } from './utils';

// Define ClientMap type based on usage
type ClientMap = Map<string, ServerWebSocket<WebSocketData>>;

export function gameTick(gameState: GameState, clients: ClientMap) {
    const snakesToReset: Snake[] = [];
    const collisions: { snakeA: Snake; snakeB: Snake }[] = [];

    // 1. Update Directions (apply pending direction if valid)
    Object.values(gameState.snakes).forEach(snake => {
        if (snake.isDead) return;
        const currentDir = snake.direction;
        const pendingDir = snake.pendingDirection;
        if (pendingDir) {
            if (
                (pendingDir === 'up' && currentDir !== 'down') ||
                (pendingDir === 'down' && currentDir !== 'up') ||
                (pendingDir === 'left' && currentDir !== 'right') ||
                (pendingDir === 'right' && currentDir !== 'left')
            ) {
                snake.direction = pendingDir;
            }
            // Simpler: Server uses the *last* valid direction requested before the tick.
        }
    });

    // 2. Calculate Movement & Check Collisions / Apply Effects
    Object.values(gameState.snakes).forEach(snake => {
        if (snake.isDead) return;

        // --- Calculate Speed Factor ---
        let baseSpeedFactor = 1.0;
        const length = snake.body.length;
        if (length > MAX_LENGTH_NO_SLOWDOWN) {
            const segmentsOverThreshold = length - MAX_LENGTH_NO_SLOWDOWN;
            baseSpeedFactor = Math.max(
                MAX_SLOWDOWN_FACTOR, // Ensure speed doesn't drop below minimum
                1.0 - segmentsOverThreshold * SLOWDOWN_PER_SEGMENT
            );
        }

        let effectiveSpeedFactor = baseSpeedFactor;
        if (snake.powerup?.type === 'speed') {
            effectiveSpeedFactor = 2.0;
        }

        snake.moveProgress += effectiveSpeedFactor;

        let movesThisTick = 0;
        while (snake.moveProgress >= 1) {
            movesThisTick++;
            snake.moveProgress -= 1;
        }
        // --- End Speed Calculation ---

        let ateFoodThisTick = false;

        // --- Perform Moves ---
        for (let i = 0; i < movesThisTick; i++) {
            if (snake.isDead) break;

            const currentHead = { ...snake.body[snake.body.length - 1] };
            let nextHead = { ...currentHead };

            switch (snake.direction) {
                case 'up':    nextHead.y -= GRID_SIZE; break;
                case 'down':  nextHead.y += GRID_SIZE; break;
                case 'left':  nextHead.x -= GRID_SIZE; break;
                case 'right': nextHead.x += GRID_SIZE; break;
            }
 
            // Wall collision check (using BOUNDARY_MARGIN)
            if (nextHead.x < BOUNDARY_MARGIN || nextHead.x >= MAP_WIDTH - BOUNDARY_MARGIN ||
                nextHead.y < BOUNDARY_MARGIN || nextHead.y >= MAP_HEIGHT - BOUNDARY_MARGIN) {
                if (snake.powerup?.type !== 'invincible') {
                    snake.isDead = true;
                    if (!snakesToReset.includes(snake)) snakesToReset.push(snake);
                    console.log(`Snake ${snake.id} hit boundary.`);
                    break; // Stop moving this tick
                } else {
                    // Wrap around logic for invincible snakes (using BOUNDARY_MARGIN)
                    if (nextHead.x < BOUNDARY_MARGIN) nextHead.x = MAP_WIDTH - BOUNDARY_MARGIN - GRID_SIZE;
                    else if (nextHead.x >= MAP_WIDTH - BOUNDARY_MARGIN) nextHead.x = BOUNDARY_MARGIN;
                    if (nextHead.y < BOUNDARY_MARGIN) nextHead.y = MAP_HEIGHT - BOUNDARY_MARGIN - GRID_SIZE;
                    else if (nextHead.y >= MAP_HEIGHT - BOUNDARY_MARGIN) nextHead.y = BOUNDARY_MARGIN;
                }
            }
 
            // Portal collision check
            let enteredPortal = false;
            for (const portal of gameState.portals) {
                const headCenterX = nextHead.x + GRID_SIZE / 2;
                const headCenterY = nextHead.y + GRID_SIZE / 2; // Consider center

                if (
                    headCenterX >= portal.x &&
                    headCenterX <= portal.x + portal.width &&
                    headCenterY >= portal.y &&
                    headCenterY <= portal.y + portal.height
                ) {
                    console.log(`Snake ${snake.id} entered portal ${portal.id}`);
                    const client = clients.get(snake.id);
                    if (client) {
                        client.send(JSON.stringify({
                            type: 'portalEnter',
                            payload: { url: portal.destinationUrl } // Use the portal's specific destination
                        }));
                    }
                    // Treat entering the portal like dying for removal purposes
                    snake.isDead = true;
                    if (!snakesToReset.includes(snake)) {
                        snakesToReset.push(snake);
                    }
                    enteredPortal = true;
                    break; // Exit portal loop
                }
            }

            // If snake died (wall) or portaled, stop processing moves for this snake this tick
            if (snake.isDead) break;

            // Only push head if not dead/portaled
            snake.body.push(nextHead);

            // Food consumption
            const foodIndex = gameState.food.findIndex(f => f.x === nextHead.x && f.y === nextHead.y);
            if (foodIndex !== -1) {
                ateFoodThisTick = true;
                snake.score++;
                snake.width = Math.min(GRID_SIZE * 1.5, snake.width + GRID_SIZE * 0.02);
                gameState.food.splice(foodIndex, 1);
            }

            // Powerup consumption
            const powerupIndex = gameState.powerups.findIndex(p => p.x === nextHead.x && p.y === nextHead.y);
            if (powerupIndex !== -1) {
                const powerup = gameState.powerups[powerupIndex];
                snake.powerup = { type: powerup.type, remainingTicks: POWERUP_DURATION };
                gameState.powerups.splice(powerupIndex, 1);
                console.log(`Snake ${snake.id} collected powerup: ${powerup.type}`);

                if (powerup.type === 'shrink') {
                    Object.values(gameState.snakes).forEach(otherSnake => {
                        if (otherSnake.id !== snake.id && !otherSnake.isDead) {
                            const shrinkAmount = Math.max(1, Math.floor(otherSnake.body.length / 3));
                            if (otherSnake.body.length > shrinkAmount) {
                                otherSnake.body.splice(0, shrinkAmount);
                                otherSnake.width = Math.max(GRID_SIZE * 0.5, otherSnake.width * 0.8);
                                otherSnake.score = Math.max(0, otherSnake.score - shrinkAmount);
                            }
                        }
                    });
                }
            }
        } // --- End Perform Moves Loop ---

        // 5. Remove Tail Segments
        if (!snake.isDead) {
            const segmentsToAdd = movesThisTick;
            const segmentsToRemove = ateFoodThisTick ? Math.max(0, segmentsToAdd - 1) : segmentsToAdd;

            if (segmentsToRemove > 0) {
                 const minLength = 1;
                 const removableCount = Math.max(0, snake.body.length - minLength);
                 const actualRemove = Math.min(segmentsToRemove, removableCount);
                 if (actualRemove > 0) {
                     snake.body.splice(0, actualRemove);
                 }
            }
        }

        // 6. Decrement Powerup Timers
        if (snake.powerup) {
            snake.powerup.remainingTicks--;
            if (snake.powerup.remainingTicks <= 0) {
                console.log(`Snake ${snake.id} powerup ${snake.powerup.type} expired.`);
                snake.powerup = undefined;
            }
        }
    }); // --- End Snake Update Loop ---

    // 7. Check Collisions (Self and Others)
    const currentSnakes = Object.values(gameState.snakes).filter(s => !s.isDead);
    currentSnakes.forEach(snake => {
        if (snake.isDead) return;
        const head = snake.body[snake.body.length - 1];

        // Self collision
        if (snake.powerup?.type !== 'invincible') {
            for (let i = 0; i < snake.body.length - 1; i++) {
                if (snake.body[i].x === head.x && snake.body[i].y === head.y) {
                    console.log(`Snake ${snake.id} hit self.`);
                    snake.isDead = true;
                    if (!snakesToReset.includes(snake)) snakesToReset.push(snake);
                    return;
                }
            }
        }

        // Other snake collision
        currentSnakes.forEach(otherSnake => {
            if (snake.id === otherSnake.id || otherSnake.isDead) return;
            const otherHead = otherSnake.body[otherSnake.body.length - 1];

            // Head-on collision
            if (head.x === otherHead.x && head.y === otherHead.y) {
                 if (!collisions.some(c => (c.snakeA.id === snake.id && c.snakeB.id === otherSnake.id) || (c.snakeA.id === otherSnake.id && c.snakeB.id === snake.id))) {
                    collisions.push({ snakeA: snake, snakeB: otherSnake });
                 }
            }

            // Body collision
            if (snake.powerup?.type !== 'invincible') {
                for (let i = 0; i < otherSnake.body.length; i++) {
                    if (otherSnake.body[i].x === head.x && otherSnake.body[i].y === head.y) {
                        if (!(i === otherSnake.body.length - 1 && head.x === otherHead.x && head.y === otherHead.y)) {
                            console.log(`Snake ${snake.id} hit body of snake ${otherSnake.id}.`);
                            snake.isDead = true;
                            if (!snakesToReset.includes(snake)) snakesToReset.push(snake);
                            return;
                        }
                    }
                }
            }
        });
    });

    // 8. Resolve Head-on Collisions
    collisions.forEach(({ snakeA, snakeB }) => {
        if (snakeA.isDead || snakeB.isDead) return;
        console.log(`Head-on collision between ${snakeA.id} and ${snakeB.id}`);
        if (snakeA.body.length > snakeB.body.length) {
            console.log(`Snake ${snakeA.id} wins head-on.`);
            snakeB.isDead = true; if (!snakesToReset.includes(snakeB)) snakesToReset.push(snakeB);
        } else if (snakeB.body.length > snakeA.body.length) {
            console.log(`Snake ${snakeB.id} wins head-on.`);
            snakeA.isDead = true; if (!snakesToReset.includes(snakeA)) snakesToReset.push(snakeA);
        } else {
            console.log(`Head-on collision draw. Both die.`);
            snakeA.isDead = true; if (!snakesToReset.includes(snakeA)) snakesToReset.push(snakeA);
            snakeB.isDead = true; if (!snakesToReset.includes(snakeB)) snakesToReset.push(snakeB);
        }
    });

    // 9. Reset Dead Snakes
    snakesToReset.forEach(snake => {
        resetSnake(snake, gameState);
    });

    // 10. Spawn new food/powerups
    spawnFood(gameState);
    spawnPowerup(gameState);

    // 11. Broadcast Game State
    broadcast({ type: 'gameState', payload: gameState }, clients);

    // Schedule the next game tick
    setTimeout(() => gameTick(gameState, clients), TICK_RATE);
}