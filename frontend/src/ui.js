// frontend/src/ui.js

// --- DOM Elements ---
export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');
export const minimapCanvas = document.getElementById('minimapCanvas');
export const minimapCtx = minimapCanvas.getContext('2d');
export const scoreElement = document.getElementById('score');
export const messageElement = document.getElementById('message');
export const leaderboardList = document.getElementById('leaderboard-list');
export const pingElement = document.getElementById('ping');
export const usernameModal = document.getElementById('usernameModal');
export const usernameInput = document.getElementById('usernameInput');
export const usernameError = document.getElementById('usernameError');
export const startGameButton = document.getElementById('startGameButton');
export const serverIndicator = document.getElementById('serverIndicator');
export const serverIndicatorFlag = serverIndicator.querySelector('.server-flag');
export const serverIndicatorId = serverIndicator.querySelector('.server-id');
export const serverIndicatorPing = serverIndicator.querySelector('.server-ping');
export const serverListModal = document.getElementById('serverListModal');
export const serverListTableBody = serverListModal.querySelector('#serverListTable tbody');
export const refreshServerListModalButton = document.getElementById('refreshServerListModalButton');
export const closeServerListModalButton = document.getElementById('closeServerListModalButton');

// --- UI Update Functions ---

// Needs access to: selectedServerInfo
export function updateServerIndicator(selectedServerInfo) {
    if (selectedServerInfo) {
        serverIndicatorId.textContent = selectedServerInfo.id;
        const pingText = selectedServerInfo.ping === Infinity ? 'N/A' : `${selectedServerInfo.ping} ms`;
        serverIndicatorPing.textContent = pingText;
        // TODO: Update flag based on country if implemented
        serverIndicatorFlag.textContent = '🌐'; // Placeholder
    } else {
        serverIndicatorId.textContent = 'Connecting...';
        serverIndicatorPing.textContent = '-- ms';
        serverIndicatorFlag.textContent = '❓';
    }
}

// Needs access to: allServersWithPing, selectedServerInfo
// Needs callbacks for: selecting a server (which might update selectedServerInfo and close modal)
export function populateServerListModal(allServersWithPing, currentSelectedServerInfo, onServerSelect) {
    serverListTableBody.innerHTML = ''; // Clear previous entries

    if (allServersWithPing.length === 0) {
        serverListTableBody.innerHTML = '<tr><td colspan="4">No servers found or error loading.</td></tr>';
        return;
    }

    allServersWithPing.forEach(server => {
        const row = document.createElement('tr');
        row.dataset.address = server.address; // Store address for selection

        const cellId = document.createElement('td');
        cellId.textContent = server.id;
        row.appendChild(cellId);

        const cellAddress = document.createElement('td');
        cellAddress.textContent = server.address;
        row.appendChild(cellAddress);

        const cellPlayers = document.createElement('td');
        cellPlayers.textContent = server.playerCount;
        row.appendChild(cellPlayers);

        const cellPing = document.createElement('td');
        const pingText = server.ping === Infinity ? 'N/A' : `${server.ping} ms`;
        cellPing.textContent = pingText;
        // Add CSS classes for ping quality
        if (server.ping === Infinity) {
            cellPing.className = 'ping-error';
        } else if (server.ping < 100) {
            cellPing.className = 'ping-good';
        } else if (server.ping < 250) {
            cellPing.className = 'ping-medium';
        } else {
            cellPing.className = 'ping-bad';
        }
        row.appendChild(cellPing);

        // Highlight the currently selected server
        if (currentSelectedServerInfo && server.address === currentSelectedServerInfo.address) {
            row.classList.add('selected');
        }

        // Add click listener to select this server
        row.addEventListener('click', () => {
            onServerSelect(server); // Call the provided callback
            serverListModal.classList.add('hidden'); // Close modal on selection
        });

        serverListTableBody.appendChild(row);
    });
}


// Needs access to: latestGameState, clientId, deathMessageTimeout
export function updateUI(latestGameState, clientId, deathMessageTimeoutRef) {
    if (!latestGameState) return; // Need game state to update UI

    // Handle score display based on spectating status
    const isSpectating = !clientId || !latestGameState.snakes[clientId]; // Determine spectating status
    if (isSpectating) {
        scoreElement.textContent = 'Spectating';
    } else {
        const mySnake = latestGameState.snakes[clientId];
        scoreElement.textContent = `Score: ${mySnake.score}`;

        // Handle death message clearing only when playing
        if (!mySnake.isDead && messageElement.textContent.includes("died")) {
            clearTimeout(deathMessageTimeoutRef.timeoutId); // Use ref object
            messageElement.textContent = '';
        }
    }

    // Update Leaderboard with usernames
    const sortedSnakes = Object.values(latestGameState.snakes)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    leaderboardList.innerHTML = '';
    sortedSnakes.forEach(snake => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-name';
        const name = snake.id === clientId ? `You (${snake.username})` : snake.username;
        nameSpan.textContent = name;
        nameSpan.style.color = snake.color;
        if (snake.id === clientId) nameSpan.style.fontWeight = 'bold';
        if (snake.isDead) { nameSpan.style.textDecoration = 'line-through'; nameSpan.style.opacity = '0.6'; }

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'player-score';
        scoreSpan.textContent = snake.score;

        li.appendChild(nameSpan);
        li.appendChild(scoreSpan);
        leaderboardList.appendChild(li);
    });
}

// --- Username Validation ---
const inappropriateWords = ['FUCK', 'SHIT', 'DAMN', 'CUNT', 'DICK', 'COCK', 'TWAT', 'PISS'];

function isInappropriate(text) {
    return inappropriateWords.includes(text) || /[^A-Z]/.test(text);
}

export function validateUsername(input) {
    const value = input.toUpperCase();
    if (value.length !== 4) {
        return 'Username must be exactly 4 characters';
    }
    if (isInappropriate(value)) {
        return 'Please choose appropriate characters (A-Z only)';
    }
    return null;
}

// --- Event Listener Setup ---
// Needs callbacks for: startGame, refreshServers
export function initUIEventListeners(callbacks) {
    usernameInput.focus(); // Focus the input field when listeners are initialized

    // Username input handling
    usernameInput.addEventListener('input', (e) => {
        const inputElement = e.target;
        inputElement.value = inputElement.value.toUpperCase();
        const error = validateUsername(inputElement.value);
        usernameError.textContent = error || '';
        // Enable start button only if username is valid AND a server is selected (state managed elsewhere)
        // We rely on the calling module to manage the button's disabled state based on server selection.
        startGameButton.disabled = !!error; // Disable if username error exists
        if (callbacks.onUsernameValidation) {
             callbacks.onUsernameValidation(!error); // Notify caller if username is valid
        }
    });

    // Add listener for Enter key on username input
    usernameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission if inside a form
            if (!startGameButton.disabled) { // Only click if the button isn't disabled
                startGameButton.click();
            }
        }
    });

    startGameButton.addEventListener('click', () => {
        const value = usernameInput.value.toUpperCase();
        const userError = validateUsername(value);
        if (!userError && callbacks.onStartGame) {
             callbacks.onStartGame(value); // Pass username to callback
        } else if (userError) {
            usernameError.textContent = userError; // Ensure error is shown
        }
    });

     // Server Indicator Click
     serverIndicator.addEventListener('click', () => {
         if (callbacks.onServerIndicatorClick) {
            callbacks.onServerIndicatorClick(); // Let main logic handle populating/showing modal
         }
     });

     // Close server list modal
     closeServerListModalButton.addEventListener('click', () => {
         serverListModal.classList.add('hidden');
     });

     // Refresh button within the modal
     refreshServerListModalButton.addEventListener('click', async () => {
         // Indicate refresh in UI
         serverListTableBody.innerHTML = '<tr><td colspan="4">Refreshing...</td></tr>';
         if (callbacks.onRefreshServers) {
            await callbacks.onRefreshServers(); // Await the refresh action
         }
     });
}