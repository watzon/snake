// frontend/src/game.js
import { deepClone, lerp } from './utils.js';
import { ctx, canvas, messageElement, updateUI, minimapCanvas, minimapCtx } from './ui.js'; // Import needed UI elements/functions including minimap
import { drawBackground, drawMapBoundary, drawSnake, drawFood, drawPowerup, drawPortals, drawMiniMap } from './render.js'; // Import render functions including drawMiniMap and drawPortals

export class Game {
    // Game State
    ws = null;
    clientId = null;
    previousGameState = null;
    latestGameState = null;
    lastStateReceiveTime = 0;
    serverTickRate = 100; // Default, updated on init
    deathMessageTimeoutRef = { timeoutId: null };

    // Camera & Viewport State
    cameraX = 0;
    cameraY = 0;
    targetCameraX = 0;
    targetCameraY = 0;
    VIEWPORT_WIDTH = window.innerWidth;
    VIEWPORT_HEIGHT = window.innerHeight;

    // Map Dimensions (updated on init)
    GRID_SIZE = 20;
    MAP_WIDTH = 0; // Initialize as 0, set on init
    MAP_HEIGHT = 0;

    // Spectator State
    isSpectating = true;
    spectatorFetchInterval = null;

    // Input State (if needed, e.g., for debouncing)

    // Loop State
    frameCounter = 0;
    rafHandle = null; // To store requestAnimationFrame ID

    // Constructor (optional, could do setup in init)
    constructor() {
        console.log("Game instance created");
    }

    // --- Initialization ---
    init(initialState) {
        this.clientId = initialState.clientId;
        this.latestGameState = initialState.initialState;
        this.previousGameState = deepClone(this.latestGameState); // Initial clone
        this.lastStateReceiveTime = performance.now();

        this.GRID_SIZE = this.latestGameState.map.gridSize;
        this.MAP_WIDTH = this.latestGameState.map.width;
        this.MAP_HEIGHT = this.latestGameState.map.height;
        // this.serverTickRate = ???; // Get from server if available

        console.log(`Game Initialized... Map: ${this.MAP_WIDTH}x${this.MAP_HEIGHT}`);
        messageElement.textContent = ''; // Clear 'connecting' messages

        this.resize(); // Set initial canvas size and camera
        this.stopSpectating(); // Stop spectator mode if running

        // Start the game loop if not already running
        if (!this.rafHandle) {
             this.loop();
        }
    }

    updateState(newState) {
        this.previousGameState = this.latestGameState;
        this.latestGameState = newState;
        this.lastStateReceiveTime = performance.now();

        // Check for player death/respawn
        if (this.previousGameState && this.clientId) {
            const myOldSnake = this.previousGameState.snakes[this.clientId];
            const myNewSnake = this.latestGameState.snakes[this.clientId];
            if (myOldSnake && myNewSnake && myOldSnake.score > 0 && myNewSnake.score === 0 && myOldSnake.color !== myNewSnake.color) {
                 console.log("Detected respawn");
                 messageElement.textContent = 'You died! Respawning...';
                 clearTimeout(this.deathMessageTimeoutRef.timeoutId);
                 this.deathMessageTimeoutRef.timeoutId = setTimeout(() => {
                     if (messageElement.textContent === 'You died! Respawning...') {
                         messageElement.textContent = '';
                     }
                 }, 3000);
            }
        }
    }

    // --- Game Loop ---
    loop() {
        const now = performance.now();

        if (!this.latestGameState) {
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('Waiting for game state...', canvas.width / 2, canvas.height / 2);
            this.rafHandle = requestAnimationFrame(() => this.loop());
            return;
        }

        let interpolationFactor = 0;
        if (this.lastStateReceiveTime > 0 && this.serverTickRate > 0) {
            interpolationFactor = (now - this.lastStateReceiveTime) / this.serverTickRate;
            interpolationFactor = Math.max(0, Math.min(1, interpolationFactor));
        }

        this.updateCamera(interpolationFactor);
        drawBackground(ctx, this.VIEWPORT_WIDTH, this.VIEWPORT_HEIGHT);

        ctx.save();
        ctx.translate(-this.cameraX, -this.cameraY);

        drawMapBoundary(ctx, this.MAP_WIDTH, this.MAP_HEIGHT, this.GRID_SIZE);

        this.latestGameState.food.forEach(foodItem => {
            drawFood(ctx, foodItem, this.cameraX, this.cameraY, this.VIEWPORT_WIDTH, this.VIEWPORT_HEIGHT, this.GRID_SIZE);
        });
        this.latestGameState.powerups.forEach(powerup => {
            drawPowerup(ctx, powerup, this.cameraX, this.cameraY, this.VIEWPORT_WIDTH, this.VIEWPORT_HEIGHT, this.GRID_SIZE);
        });
        Object.keys(this.latestGameState.snakes).forEach(snakeId => {
            drawSnake(ctx, snakeId, interpolationFactor, this.latestGameState, this.previousGameState, this.cameraX, this.cameraY, this.VIEWPORT_WIDTH, this.VIEWPORT_HEIGHT, this.GRID_SIZE);
        });
        // Draw Portals
        drawPortals(ctx, this.latestGameState.portals, this.cameraX, this.cameraY, this.VIEWPORT_WIDTH, this.VIEWPORT_HEIGHT, this.GRID_SIZE);

        ctx.restore();

        this.frameCounter++;
        if (this.frameCounter % 10 === 0) {
            updateUI(this.latestGameState, this.clientId, this.deathMessageTimeoutRef);
        }

        // Draw the minimap
        drawMiniMap(minimapCtx, minimapCanvas, this.latestGameState, this.clientId, this.MAP_WIDTH, this.MAP_HEIGHT);

        this.rafHandle = requestAnimationFrame(() => this.loop());
    }

    // --- Camera Logic ---
    updateCamera(interpolationFactor) {
        let targetFocusX = this.MAP_WIDTH / 2;
        let targetFocusY = this.MAP_HEIGHT / 2;

        if (!this.isSpectating && this.latestGameState && this.clientId && this.latestGameState.snakes[this.clientId]) {
            const mySnake = this.latestGameState.snakes[this.clientId];
            if (!mySnake.isDead && mySnake.body.length > 0) {
                const headLatest = mySnake.body[mySnake.body.length - 1];
                let headPrev = headLatest;
                if (this.previousGameState && this.previousGameState.snakes[this.clientId] && this.previousGameState.snakes[this.clientId].body.length > 0) {
                     const prevSnake = this.previousGameState.snakes[this.clientId];
                     if (prevSnake.body.length === mySnake.body.length) {
                        headPrev = prevSnake.body[prevSnake.body.length - 1];
                     }
                }
                targetFocusX = lerp(headPrev.x, headLatest.x, interpolationFactor) + this.GRID_SIZE / 2;
                targetFocusY = lerp(headPrev.y, headLatest.y, interpolationFactor) + this.GRID_SIZE / 2;
            }
             else if (mySnake.isDead && mySnake.body.length > 0) {
                 const headLatest = mySnake.body[mySnake.body.length - 1];
                 targetFocusX = headLatest.x + this.GRID_SIZE / 2;
                 targetFocusY = headLatest.y + this.GRID_SIZE / 2;
             }
        }

        this.targetCameraX = targetFocusX - this.VIEWPORT_WIDTH / 2;
        this.targetCameraY = targetFocusY - this.VIEWPORT_HEIGHT / 2;
        this.targetCameraX = Math.max(0, Math.min(this.targetCameraX, this.MAP_WIDTH - this.VIEWPORT_WIDTH));
        this.targetCameraY = Math.max(0, Math.min(this.targetCameraY, this.MAP_HEIGHT - this.VIEWPORT_HEIGHT));

        const cameraLerpFactor = 0.1;
        this.cameraX = lerp(this.cameraX, this.targetCameraX, cameraLerpFactor);
        this.cameraY = lerp(this.cameraY, this.targetCameraY, cameraLerpFactor);
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.MAP_WIDTH - this.VIEWPORT_WIDTH));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.MAP_HEIGHT - this.VIEWPORT_HEIGHT));
    }

    // --- Resize Handler ---
    resize() {
        console.log("Resizing canvas...");
        this.VIEWPORT_WIDTH = window.innerWidth;
        this.VIEWPORT_HEIGHT = window.innerHeight;
        canvas.width = this.VIEWPORT_WIDTH;
        canvas.height = this.VIEWPORT_HEIGHT;
        // Recalculate camera position immediately after resize if map dimensions are known
        if (this.MAP_WIDTH > 0 && this.MAP_HEIGHT > 0) {
             this.updateCamera(0); // Calculate target based on current state
             this.cameraX = this.targetCameraX; // Snap camera
             this.cameraY = this.targetCameraY;
        }
    }

    // --- Input Handler ---
    handleKeyDown(event) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.clientId || !this.latestGameState) {
            return;
        }
        let direction = null;
        switch (event.key) {
            case 'ArrowUp': case 'w': direction = 'up'; break;
            case 'ArrowDown': case 's': direction = 'down'; break;
            case 'ArrowLeft': case 'a': direction = 'left'; break;
            case 'ArrowRight': case 'd': direction = 'right'; break;
            default: return;
        }
        this.ws.send(JSON.stringify({ type: 'directionChange', payload: direction }));
        event.preventDefault();
    }

    // --- Spectator Mode ---
    async fetchGameStateForSpectator() {
        if (!this.isSpectating) return;

        try {
            const response = await fetch('/gamestate');
            if (!response.ok) {
                console.warn('Failed to fetch spectator game state:', response.status);
                if (this.spectatorFetchInterval) setTimeout(() => this.fetchGameStateForSpectator(), 1000);
                return;
            }
            const fetchedState = await response.json();

            this.previousGameState = this.latestGameState;
            this.latestGameState = fetchedState;
            this.lastStateReceiveTime = performance.now();

            if (this.MAP_WIDTH <= 0 && this.latestGameState.map) {
                this.GRID_SIZE = this.latestGameState.map.gridSize;
                this.MAP_WIDTH = this.latestGameState.map.width;
                this.MAP_HEIGHT = this.latestGameState.map.height;
                console.log(`Spectator: Initialized Map: ${this.MAP_WIDTH}x${this.MAP_HEIGHT}`);
                if (canvas.width !== this.VIEWPORT_WIDTH || canvas.height !== this.VIEWPORT_HEIGHT) {
                     this.resize();
                }
                // Center camera for spectator
                this.targetCameraX = (this.MAP_WIDTH - this.VIEWPORT_WIDTH) / 2;
                this.targetCameraY = (this.MAP_HEIGHT - this.VIEWPORT_HEIGHT) / 2;
                this.cameraX = this.targetCameraX;
                this.cameraY = this.targetCameraY;
            }

            if (this.spectatorFetchInterval) {
               setTimeout(() => this.fetchGameStateForSpectator(), this.serverTickRate);
            }

        } catch (error) {
            console.error('Error fetching spectator game state:', error);
             if (this.spectatorFetchInterval) setTimeout(() => this.fetchGameStateForSpectator(), 1000);
        }
    }

    startSpectating() {
        if (this.isSpectating && !this.spectatorFetchInterval) {
            console.log("Starting spectator fetching.");
            this.spectatorFetchInterval = setInterval(() => this.fetchGameStateForSpectator(), this.serverTickRate);
            this.fetchGameStateForSpectator(); // Fetch immediately
        }
        if(!this.rafHandle){
             this.loop(); // Ensure game loop is running for spectator view
        }
    }

    stopSpectating() {
        if (this.spectatorFetchInterval) {
            clearInterval(this.spectatorFetchInterval);
            this.spectatorFetchInterval = null;
            console.log("Stopped spectator fetching.");
        }
        this.isSpectating = false;
    }

    // Method to set the WebSocket connection
    setWebSocket(wsInstance) {
        this.ws = wsInstance;
        if (wsInstance) {
             this.isSpectating = false; // If we have a WS, we're not spectating
             this.stopSpectating();
        } else {
             this.isSpectating = true; // If WS is null, revert to spectating
             this.startSpectating();
        }
    }

     // Method to update client ID
     setClientId(id) {
         this.clientId = id;
     }
}