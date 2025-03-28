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

    // Input State & Prediction
    predictedDirection = null; // Store the locally predicted direction immediately on input

 // Touch Input State
 touchStartX = 0;
 touchStartY = 0;
 touchEndX = 0;
 touchEndY = 0;
 minSwipeDistance = 30; // Minimum distance in pixels for a swipe

    // Loop State
    frameCounter = 0;
    rafHandle = null; // To store requestAnimationFrame ID

    // Constructor (optional, could do setup in init)
    constructor() {
        console.log("Game instance created");
    }

    // --- Initialization ---
    init(initialState) {
        // --- Defensive Checks & Logging for initialState ---
        if (!initialState || !initialState.initialState) {
            console.error("Received invalid 'init' payload: Missing initialState object.", initialState);
            messageElement.textContent = 'Error: Invalid initial data from server.';
            return; // Stop initialization
        }
        if (!initialState.initialState.snakes || typeof initialState.initialState.snakes !== 'object') {
            console.error("Received invalid 'init' payload: Missing or invalid 'snakes' property.", initialState.initialState);
            // Attempt recovery by creating an empty snakes object
            initialState.initialState.snakes = {};
            console.warn("Attempted recovery: Initialized empty 'snakes' object.");
            // Consider if you need to show an error or just proceed cautiously
        }
        if (!initialState.initialState.map) {
             console.error("Received invalid 'init' payload: Missing 'map' property.", initialState.initialState);
             messageElement.textContent = 'Error: Invalid map data from server.';
             return;
        }
        // --- End Defensive Checks ---

        this.clientId = initialState.clientId;
        this.latestGameState = initialState.initialState;
        // Clone only *after* potential recovery
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
            // Pass clientId and predictedDirection to drawSnake
            drawSnake(ctx, snakeId, this.clientId, this.predictedDirection, interpolationFactor, this.latestGameState, this.previousGameState, this.cameraX, this.cameraY, this.VIEWPORT_WIDTH, this.VIEWPORT_HEIGHT, this.GRID_SIZE);
        });
        // Draw Portals
        drawPortals(ctx, this.latestGameState.portals, this.cameraX, this.cameraY, this.VIEWPORT_WIDTH, this.VIEWPORT_HEIGHT, this.GRID_SIZE, this.MAP_HEIGHT); // Pass MAP_HEIGHT

        ctx.restore();

        this.frameCounter++;
        // Reduce update frequency for UI and Minimap for performance
        if (this.frameCounter % 30 === 0) {
            updateUI(this.latestGameState, this.clientId, this.deathMessageTimeoutRef);
            // Also move minimap drawing here to reduce its frequency
            drawMiniMap(minimapCtx, minimapCanvas, this.latestGameState, this.clientId, this.MAP_WIDTH, this.MAP_HEIGHT);
        }

        // Minimap drawing moved inside the less frequent update block above

        this.rafHandle = requestAnimationFrame(() => this.loop());
    }

    // --- Camera Logic ---
    updateCamera(interpolationFactor) {
        // If playing, calculate target camera based on snake focus
        if (!this.isSpectating && this.latestGameState && this.clientId && this.latestGameState.snakes[this.clientId]) {
            let targetFocusX = this.MAP_WIDTH / 2; // Default focus
            let targetFocusY = this.MAP_HEIGHT / 2;
            const mySnake = this.latestGameState.snakes[this.clientId]; // Only one declaration

            if (!mySnake.isDead && mySnake.body.length > 0) {
                // Calculate interpolated head position
                const headLatest = mySnake.body[mySnake.body.length - 1];
                let headPrev = headLatest;
                // Use optional chaining for safety
                if (this.previousGameState?.snakes[this.clientId]?.body?.length === mySnake.body.length) {
                     headPrev = this.previousGameState.snakes[this.clientId].body[mySnake.body.length - 1];
                }
                targetFocusX = lerp(headPrev.x, headLatest.x, interpolationFactor) + this.GRID_SIZE / 2;
                targetFocusY = lerp(headPrev.y, headLatest.y, interpolationFactor) + this.GRID_SIZE / 2;
            } else if (mySnake.isDead && mySnake.body.length > 0) {
                // Focus on dead snake's last known head position
                const headLatest = mySnake.body[mySnake.body.length - 1];
                targetFocusX = headLatest.x + this.GRID_SIZE / 2;
                targetFocusY = headLatest.y + this.GRID_SIZE / 2;
            }

            // Update target camera based on calculated focus
            this.targetCameraX = targetFocusX - this.VIEWPORT_WIDTH / 2;
            this.targetCameraY = targetFocusY - this.VIEWPORT_HEIGHT / 2;

            // Clamp target camera position immediately after calculation
            this.targetCameraX = Math.max(0, Math.min(this.targetCameraX, this.MAP_WIDTH - this.VIEWPORT_WIDTH));
            this.targetCameraY = Math.max(0, Math.min(this.targetCameraY, this.MAP_HEIGHT - this.VIEWPORT_HEIGHT));
        }
        // If spectating, this.targetCameraX/Y is assumed to be updated by handleKeyDown and already clamped there.

        // Apply smoothing towards the target (either snake-based or spectator-controlled)
        const cameraLerpFactor = 0.1; // Smoothing factor
        // Ensure targetCameraX/Y are valid numbers before lerping, especially if spectating started before map dimensions known
        // Added check for null as well
        if (isNaN(this.targetCameraX) || this.targetCameraX === null) this.targetCameraX = (this.MAP_WIDTH - this.VIEWPORT_WIDTH) / 2 || 0;
        if (isNaN(this.targetCameraY) || this.targetCameraY === null) this.targetCameraY = (this.MAP_HEIGHT - this.VIEWPORT_HEIGHT) / 2 || 0;

        this.cameraX = lerp(this.cameraX, this.targetCameraX, cameraLerpFactor);
        this.cameraY = lerp(this.cameraY, this.targetCameraY, cameraLerpFactor);

        // Final clamp on the actual camera position after smoothing
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
 requestDirectionChange(requestedDirection) {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.clientId || !this.latestGameState) {
   return; // Ignore input if not connected or no state
  }

  const mySnake = this.latestGameState.snakes[this.clientId];
  if (!mySnake || mySnake.isDead) return; // Ignore input if snake doesn't exist or is dead

  // Client-Side Prediction Check (Prevent reversing direction)
  const currentServerDirection = mySnake.direction;
  let isValidMove = false;
  if (
   (requestedDirection === 'up' && currentServerDirection !== 'down') ||
   (requestedDirection === 'down' && currentServerDirection !== 'up') ||
   (requestedDirection === 'left' && currentServerDirection !== 'right') ||
   (requestedDirection === 'right' && currentServerDirection !== 'left')
  ) {
   isValidMove = true;
  }

  if (isValidMove) {
   this.predictedDirection = requestedDirection; // Update prediction
   this.ws.send(JSON.stringify({ type: 'directionChange', payload: requestedDirection }));
  }
 }

    handleKeyDown(event) {
        const spectatorMoveStep = this.GRID_SIZE * 3; // How much to move camera per key press

        if (this.isSpectating) {
            // --- Spectator Camera Control ---
            let dx = 0;
            let dy = 0;
            switch (event.key) {
                case 'ArrowUp': dy = -spectatorMoveStep; break;
                case 'ArrowDown': dy = spectatorMoveStep; break;
                case 'ArrowLeft': dx = -spectatorMoveStep; break;
                case 'ArrowRight': dx = spectatorMoveStep; break;
                case 'Escape': break; // Allow Escape to exit spectator mode
                default: return; // Ignore other keys in spectator mode
            }

            // Update target camera position, clamping within bounds
            this.targetCameraX = Math.max(0, Math.min(this.targetCameraX + dx, this.MAP_WIDTH - this.VIEWPORT_WIDTH));
            this.targetCameraY = Math.max(0, Math.min(this.targetCameraY + dy, this.MAP_HEIGHT - this.VIEWPORT_HEIGHT));

            event.preventDefault(); // Prevent scrolling

        } else {
            // --- Player Snake Control ---
            let requestedDirection = null;
            switch (event.key) {
                case 'ArrowUp': requestedDirection = 'up'; break;
                case 'ArrowDown': requestedDirection = 'down'; break;
                case 'ArrowLeft': requestedDirection = 'left'; break;
                case 'ArrowRight': requestedDirection = 'right'; break;
                case 'Escape': break; // Handle Escape separately below
                default: return; // Ignore other keys
            }
   if (requestedDirection) {
    this.requestDirectionChange(requestedDirection);
   }

            event.preventDefault(); // Prevent scrolling
        }

        // Handle Escape key to return to menu
        if (event.key === 'Escape') {
            if (this.isSpectating) {
                this.stopSpectating();
                // Ensure input is enabled and focused when returning from spectate
                usernameInput.disabled = false;
                usernameModal.classList.remove('hidden');
                usernameInput.focus();
            } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Handle quitting while playing - BYPASS RECONNECT
                console.log("Escape pressed while playing. Sending quitGame and closing connection without reconnect.");
                messageElement.textContent = 'Returned to menu...';
                // Send quit message to server so it removes the snake
                this.ws.send(JSON.stringify({ type: 'quitGame' }));

                // Prevent automatic reconnect by setting onclose to null first
                this.ws.onclose = null;
                this.ws.close(1000, 'User pressed Escape'); // Close connection gracefully

                // Manually clear interval and reset ws state (like in afkKick)
                // Need access to pingInterval from main.js - This highlights a design issue.
                // For now, we assume the user will manually stop the interval if needed,
                // or we modify main.js to expose a way to clear it.
                // Let's proceed assuming main.js might have lingering interval, but focus on UI reset.
                // clearInterval(pingInterval); // Cannot access pingInterval here directly
                this.ws = null;

                // Trigger state change and show modal manually
                this.setWebSocket(null); // This will set isSpectating = true and call startSpectating (which is fine for now)
                usernameInput.disabled = false;
                usernameModal.classList.remove('hidden');
                usernameInput.focus();
                // Update button state (relying on main.js state)
                // startGameButton.disabled = !selectedServerInfo || !!validateUsername(usernameInput.value);
            }
            event.preventDefault(); // Prevent any default browser behavior for Escape
        }
    }

 handleTouchStart(event) {
  // Only process touch if playing, not spectating
  if (this.isSpectating) return;

  this.touchStartX = event.touches[0].clientX;
  this.touchStartY = event.touches[0].clientY;
  // Prevent default touch behavior like scrolling/zooming on the canvas
  event.preventDefault();
 }

 handleTouchEnd(event) {
  // Only process touch if playing, not spectating
  if (this.isSpectating || this.touchStartX === 0) return; // Ensure touchstart happened

  this.touchEndX = event.changedTouches[0].clientX;
  this.touchEndY = event.changedTouches[0].clientY;

  const deltaX = this.touchEndX - this.touchStartX;
  const deltaY = this.touchEndY - this.touchStartY;

  // Determine if it was primarily a horizontal or vertical swipe
  if (Math.abs(deltaX) > Math.abs(deltaY)) { // Horizontal swipe
   if (Math.abs(deltaX) > this.minSwipeDistance) {
    this.requestDirectionChange(deltaX > 0 ? 'right' : 'left');
   }
  } else { // Vertical swipe
   if (Math.abs(deltaY) > this.minSwipeDistance) {
    this.requestDirectionChange(deltaY > 0 ? 'down' : 'up');
   }
  }

  // Reset touch start coordinates
  this.touchStartX = 0;
  this.touchStartY = 0;
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