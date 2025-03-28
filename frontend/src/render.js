// frontend/src/render.js
import { lerp } from './utils.js'; // lerp is needed for snake interpolation

// Needs: ctx, MAP_WIDTH, MAP_HEIGHT, GRID_SIZE, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, cameraX, cameraY
// Needs game state: latestGameState, previousGameState
export function drawBackground(ctx, VIEWPORT_WIDTH, VIEWPORT_HEIGHT) {
    const time = Date.now() / 6000;
    const hue = (time * 25) % 360;
    ctx.fillStyle = `hsl(${hue}, 20%, 10%)`; // Dark base color
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
}

export function drawMapBoundary(ctx, MAP_WIDTH, MAP_HEIGHT, GRID_SIZE) {
    if (MAP_WIDTH <= 0 || MAP_HEIGHT <= 0) return;
    const BORDER_THICKNESS = GRID_SIZE;
    const BORDER_COLOR = '#4a5568';
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = BORDER_THICKNESS;
    ctx.lineJoin = 'miter';
    const offset = BORDER_THICKNESS / 2;
    ctx.strokeRect(
        offset, offset,
        MAP_WIDTH - BORDER_THICKNESS, MAP_HEIGHT - BORDER_THICKNESS
    );
}

export function drawSnake(ctx, snakeId, interpolationFactor, latestGameState, previousGameState, cameraX, cameraY, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, GRID_SIZE) {
    const snakeLatest = latestGameState?.snakes[snakeId];
    if (!snakeLatest || snakeLatest.isDead || snakeLatest.body.length === 0) return;

    const snakePrev = previousGameState?.snakes[snakeId];
    const canInterpolate = snakePrev && !snakePrev.isDead && snakePrev.body.length === snakeLatest.body.length;

    ctx.lineWidth = snakeLatest.width;
    ctx.strokeStyle = snakeLatest.color;
    ctx.fillStyle = snakeLatest.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    let firstVisibleSegment = true;

    const viewMinX = cameraX - GRID_SIZE;
    const viewMaxX = cameraX + VIEWPORT_WIDTH + GRID_SIZE;
    const viewMinY = cameraY - GRID_SIZE;
    const viewMaxY = cameraY + VIEWPORT_HEIGHT + GRID_SIZE;

    for (let i = 0; i < snakeLatest.body.length; i++) {
        const segmentLatest = snakeLatest.body[i];
        let renderX, renderY;

        if (canInterpolate && snakePrev.body[i]) {
            const segmentPrev = snakePrev.body[i];
            renderX = lerp(segmentPrev.x, segmentLatest.x, interpolationFactor) + GRID_SIZE / 2;
            renderY = lerp(segmentPrev.y, segmentLatest.y, interpolationFactor) + GRID_SIZE / 2;
        } else {
            renderX = segmentLatest.x + GRID_SIZE / 2;
            renderY = segmentLatest.y + GRID_SIZE / 2;
        }

        const isPotentiallyVisible = renderX >= viewMinX && renderX <= viewMaxX &&
                                   renderY >= viewMinY && renderY <= viewMaxY;

        if (isPotentiallyVisible) {
             if (firstVisibleSegment) {
                 if (i > 0) {
                     const prevSegmentLatest = snakeLatest.body[i-1];
                     let prevRenderX, prevRenderY;
                      if (canInterpolate && snakePrev.body[i-1]) {
                          const prevSegmentPrev = snakePrev.body[i-1];
                          prevRenderX = lerp(prevSegmentPrev.x, prevSegmentLatest.x, interpolationFactor) + GRID_SIZE / 2;
                          prevRenderY = lerp(prevSegmentPrev.y, prevSegmentLatest.y, interpolationFactor) + GRID_SIZE / 2;
                      } else {
                          prevRenderX = prevSegmentLatest.x + GRID_SIZE / 2;
                          prevRenderY = prevSegmentLatest.y + GRID_SIZE / 2;
                      }
                      ctx.moveTo(prevRenderX, prevRenderY);
                 } else {
                     ctx.moveTo(renderX, renderY);
                 }
                 ctx.lineTo(renderX, renderY);
                 firstVisibleSegment = false;
             } else {
                 ctx.lineTo(renderX, renderY);
             }
        } else {
           firstVisibleSegment = true;
        }
    }
    ctx.stroke();

    // Draw Head
    const headLatest = snakeLatest.body[snakeLatest.body.length - 1];
    let headRenderX, headRenderY;
    if (canInterpolate) {
         const headPrev = snakePrev.body[snakePrev.body.length - 1];
         headRenderX = lerp(headPrev.x, headLatest.x, interpolationFactor) + GRID_SIZE / 2;
         headRenderY = lerp(headPrev.y, headLatest.y, interpolationFactor) + GRID_SIZE / 2;
    } else {
         headRenderX = headLatest.x + GRID_SIZE / 2;
         headRenderY = headLatest.y + GRID_SIZE / 2;
    }
    ctx.beginPath();
    ctx.arc(headRenderX, headRenderY, snakeLatest.width / 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Draw Eyes
    ctx.fillStyle = 'white';
    let eye1X, eye1Y, eye2X, eye2Y;
    const eyeOffset = snakeLatest.width * 0.15;
    const eyeSize = snakeLatest.width * 0.1;
    switch (snakeLatest.direction) {
        case 'up':    eye1X = headRenderX - eyeOffset; eye1Y = headRenderY - eyeOffset; eye2X = headRenderX + eyeOffset; eye2Y = headRenderY - eyeOffset; break;
        case 'down':  eye1X = headRenderX - eyeOffset; eye1Y = headRenderY + eyeOffset; eye2X = headRenderX + eyeOffset; eye2Y = headRenderY + eyeOffset; break;
        case 'left':  eye1X = headRenderX - eyeOffset; eye1Y = headRenderY - eyeOffset; eye2X = headRenderX - eyeOffset; eye2Y = headRenderY + eyeOffset; break;
        case 'right': eye1X = headRenderX + eyeOffset; eye1Y = headRenderY - eyeOffset; eye2X = headRenderX + eyeOffset; eye2Y = headRenderY + eyeOffset; break;
    }
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
    ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Powerup indicator
    if (snakeLatest.powerup) {
        ctx.strokeStyle = snakeLatest.powerup.type === 'speed' ? '#FFFF00' : (snakeLatest.powerup.type === 'invincible' ? '#00FFFF' : '#FF00FF');
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(headRenderX, headRenderY, snakeLatest.width * 0.7 + 2, 0, Math.PI * 2);
        ctx.stroke();
    }
}

export function drawFood(ctx, foodItem, cameraX, cameraY, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, GRID_SIZE) {
     if (foodItem.x + GRID_SIZE < cameraX || foodItem.x > cameraX + VIEWPORT_WIDTH ||
         foodItem.y + GRID_SIZE < cameraY || foodItem.y > cameraY + VIEWPORT_HEIGHT) {
         return;
     }
    const renderX = foodItem.x + GRID_SIZE / 2;
    const renderY = foodItem.y + GRID_SIZE / 2;

    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    const scale = 1 + Math.sin(Date.now() / 200 + foodItem.x + foodItem.y) * 0.1;
    const size = GRID_SIZE * 0.3 * scale;
    ctx.arc(renderX, renderY, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(renderX - size*0.3, renderY - size*0.3, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

export function drawPowerup(ctx, powerup, cameraX, cameraY, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, GRID_SIZE) {
      if (powerup.x + GRID_SIZE < cameraX || powerup.x > cameraX + VIEWPORT_WIDTH ||
         powerup.y + GRID_SIZE < cameraY || powerup.y > cameraY + VIEWPORT_HEIGHT) {
         return;
     }
    const centerX = powerup.x + GRID_SIZE / 2;
    const centerY = powerup.y + GRID_SIZE / 2;
    const size = GRID_SIZE * 0.4;
    const angle = (Date.now() / 10) % 360;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle * Math.PI / 180);

    ctx.beginPath();
     switch (powerup.type) {
        case 'speed': ctx.fillStyle = '#FFFF00'; ctx.moveTo(0, -size); ctx.lineTo(size * 0.5, 0); ctx.lineTo(0, size); ctx.lineTo(-size * 0.5, 0); ctx.closePath(); break;
        case 'invincible': ctx.fillStyle = '#00FFFF'; ctx.arc(0, -size * 0.2, size * 0.8, Math.PI * 1.1, Math.PI * 1.9); ctx.lineTo(0, size); ctx.closePath(); break;
        case 'shrink': ctx.strokeStyle = '#FF00FF'; ctx.lineWidth=2; const a = size * 0.6; ctx.moveTo(-a, -a); ctx.lineTo(0, -a*0.5); ctx.lineTo(a, -a); ctx.moveTo(-a, a); ctx.lineTo(0, a*0.5); ctx.lineTo(a, a); ctx.moveTo(-a, -a); ctx.lineTo(-a*0.5, 0); ctx.lineTo(-a, a); ctx.moveTo(a, -a); ctx.lineTo(a*0.5, 0); ctx.lineTo(a, a); break;
        default: ctx.fillStyle = '#FFFFFF'; ctx.arc(0, 0, size, 0, Math.PI * 2);
    }
     if (powerup.type !== 'shrink') ctx.fill(); else ctx.stroke();

    ctx.restore();
}

export function drawPortals(ctx, portals, cameraX, cameraY, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, GRID_SIZE, MAP_HEIGHT) { // Added MAP_HEIGHT
    if (!portals || portals.length === 0) return;

    portals.forEach(portal => {
        // --- Culling Check ---
        const portalEndX = portal.x + portal.width;
        const portalEndY = portal.y + portal.height;
        if (portalEndX < cameraX || portal.x > cameraX + VIEWPORT_WIDTH ||
            portalEndY < cameraY || portal.y > cameraY + VIEWPORT_HEIGHT) {
            return; // Don't draw if off-screen
        }

        const renderX = portal.x;
        const renderY = portal.y;
        const renderWidth = portal.width;
        const renderHeight = portal.height; // This is the depth

        // --- Glow Effect ---
        ctx.save(); // Save context state before applying shadow
        ctx.shadowBlur = 20; // Amount of blur
        ctx.shadowColor = '#c084fc'; // Purple glow color (adjust as needed)

        // --- Outer Frame (Obsidian-like) ---
        ctx.fillStyle = '#1a001a'; // Very dark purple/black
        ctx.fillRect(renderX, renderY, renderWidth, renderHeight);

        // --- Inner Portal Effect (Simple gradient/color) ---
        // Create a subtle vertical gradient or use a slightly lighter color
        const gradient = ctx.createLinearGradient(renderX, renderY, renderX, renderY + renderHeight);
        gradient.addColorStop(0, '#4c004c'); // Darker purple
        gradient.addColorStop(0.5, '#800080'); // Medium purple (like Nether portal)
        gradient.addColorStop(1, '#4c004c'); // Darker purple

        // Add a subtle shimmer/movement effect based on time
        const time = Date.now() / 500; // Adjust speed of shimmer
        const shimmerOffset = Math.sin(time + portal.x) * (renderHeight * 0.1); // Small vertical offset

        ctx.fillStyle = gradient;
        // Fill slightly inset to leave frame visible
        const inset = 2;
        ctx.fillRect(
            renderX + inset,
            renderY + inset + shimmerOffset,
            renderWidth - inset * 2,
            renderHeight - inset * 2
        );
         // Add some swirling particles (optional, simple version)
         ctx.fillStyle = 'rgba(220, 180, 255, 0.3)'; // Light purple, semi-transparent
         for (let i = 0; i < 5; i++) {
             const particleX = renderX + inset + Math.random() * (renderWidth - inset * 2);
             const particleY = renderY + inset + Math.random() * (renderHeight - inset * 2);
             ctx.beginPath();
             ctx.arc(particleX, particleY, Math.random() * 2 + 1, 0, Math.PI * 2);
             ctx.fill();
         }


        // --- Portal Text ---
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // White, slightly transparent
        ctx.font = `bold ${GRID_SIZE * 0.8}px 'Courier New', Courier, monospace`; // Adjust font size as needed
        ctx.textAlign = 'center';
        let textY;
        // Check if it's the bottom portal (assuming it's the only one near the bottom edge)
        if (portal.y > MAP_HEIGHT / 2) { // Simple check: is it in the bottom half?
            ctx.textBaseline = 'bottom'; // Align text from its bottom edge
            textY = renderY - GRID_SIZE * 0.5; // Position text above the portal
        } else { // Otherwise, assume it's the top portal
            ctx.textBaseline = 'top'; // Align text from its top edge
            textY = renderY + renderHeight + GRID_SIZE * 0.5; // Position text below the portal
        }

        ctx.fillText(
            portal.text,
            renderX + renderWidth / 2,
            textY
        );

        ctx.restore(); // Restore context to remove shadow effect for subsequent draws
    });
}


// Needs: minimapCtx, minimapCanvas, latestGameState, clientId, MAP_WIDTH, MAP_HEIGHT
export function drawMiniMap(minimapCtx, minimapCanvas, latestGameState, clientId, MAP_WIDTH, MAP_HEIGHT) {
    if (!latestGameState || !minimapCtx || !minimapCanvas) return;

    const mapWidth = MAP_WIDTH;
    const mapHeight = MAP_HEIGHT;
    const minimapWidth = minimapCanvas.width;
    const minimapHeight = minimapCanvas.height;

    // --- Clear minimap ---
    minimapCtx.clearRect(0, 0, minimapWidth, minimapHeight);

    // --- Draw minimap background/border ---
    minimapCtx.fillStyle = 'rgba(50, 50, 50, 0.5)'; // Dark semi-transparent background
    minimapCtx.fillRect(0, 0, minimapWidth, minimapHeight);
    minimapCtx.strokeStyle = '#888'; // Light border
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(0, 0, minimapWidth, minimapHeight);

    // --- Scaling ---
    const scaleX = minimapWidth / mapWidth;
    const scaleY = minimapHeight / mapHeight;

    // --- Draw Food ---
    latestGameState.food.forEach(food => {
        const minimapX = food.x * scaleX;
        const minimapY = food.y * scaleY;
        minimapCtx.fillStyle = '#ff6b6b'; // Food color
        minimapCtx.fillRect(minimapX, minimapY, 2, 2); // Draw as small square
    });

     // --- Draw Powerups ---
     latestGameState.powerups.forEach(powerup => {
        const minimapX = powerup.x * scaleX;
        const minimapY = powerup.y * scaleY;
        switch (powerup.type) {
            case 'speed': minimapCtx.fillStyle = '#FFFF00'; break;
            case 'invincible': minimapCtx.fillStyle = '#00FFFF'; break;
            case 'shrink': minimapCtx.fillStyle = '#FF00FF'; break;
            default: minimapCtx.fillStyle = '#FFFFFF';
        }
        minimapCtx.fillRect(minimapX, minimapY, 3, 3); // Slightly larger square for powerups
    });

    // --- Draw Snakes ---
    Object.values(latestGameState.snakes).forEach(snake => {
        if (snake.isDead || snake.body.length === 0) return;

        const isSelf = snake.id === clientId;
        minimapCtx.fillStyle = isSelf ? '#00FF00' : snake.color; // Highlight self in green

        // Draw each segment as a small rectangle/dot
        snake.body.forEach(segment => {
            const minimapX = segment.x * scaleX;
            const minimapY = segment.y * scaleY;
            minimapCtx.fillRect(minimapX, minimapY, isSelf ? 3 : 2, isSelf ? 3 : 2); // Player snake slightly larger
        });
    });

    // --- Draw Portals ---
    if (latestGameState.portals) {
        latestGameState.portals.forEach(portal => {
            const minimapX = portal.x * scaleX;
            const minimapY = portal.y * scaleY;
            const minimapWidth = portal.width * scaleX;
            const minimapHeight = portal.height * scaleY; // Represent depth on minimap

            // Make it flashier: Cycle lightness with time
            const time = Date.now() / 300; // Adjust speed of flash
            const lightness = 50 + Math.sin(time + portal.id.hashCode()) * 20; // Cycle between 30% and 70% lightness
            minimapCtx.fillStyle = `hsl(300, 100%, ${lightness}%)`; // Bright purple/magenta

            // Make it larger
            minimapCtx.fillRect(minimapX, minimapY, Math.max(4, minimapWidth), Math.max(2, minimapHeight)); // Ensure larger minimum size
        });
    }
}