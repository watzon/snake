// frontend/src/main.js
import { initializeHashCode, debounce } from './utils.js';
import { Game } from './game.js';
import {
    initUIEventListeners, updateServerIndicator, populateServerListModal,
    usernameModal, serverListModal, messageElement, usernameError, startGameButton,
    validateUsername, usernameInput, pingElement, canvas // Import canvas
} from './ui.js';
import {
    fetchAndSelectBestServer, connectWebSocket, sendPing, getLastPingSentTime
} from './network.js';

console.log("Main script loaded");

// Initialize polyfills/helpers
initializeHashCode();

// --- Global State Management ---
// We need to manage state that's shared between UI, Network, and Game logic
let selectedServerInfo = null;
let allServersWithPing = [];
let ws = null; // WebSocket connection instance
let pingInterval = null;
let username = null;
let returnPortalRef = null; // Store the ref for the return portal

// --- Parse URL Params ---
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('portal') === 'true' && urlParams.has('ref')) {
    returnPortalRef = urlParams.get('ref');
    console.log("Return portal requested with ref:", returnPortalRef);
}
let prefilledUsernameValid = false;
const usernameParam = urlParams.get('username');
if (usernameParam) {
    const processedUsername = usernameParam.trim().slice(0, 4).toUpperCase();
    if (processedUsername.length === 4 && /^[A-Z]+$/.test(processedUsername)) {
        username = processedUsername; // Store globally
        prefilledUsernameValid = true;
        usernameInput.value = username; // Pre-fill the input field
        usernameInput.disabled = true; // Optionally disable editing
        console.log("Prefilled valid username from URL:", username);
    } else {
        console.log("Invalid username parameter provided:", usernameParam);
    }
}

// --- Instantiate Core Logic ---
const game = new Game();

// --- Network Initialization ---
async function initializeNetworkAndCallbacks() {
    const { selectedServer, serverList } = await fetchAndSelectBestServer({
        onStartFetching: () => {
            updateServerIndicator(null); // Show connecting state
            startGameButton.disabled = true;
        },
        onStartPinging: () => { /* UI update handled by ui.js via elements */ },
        onStartPingingFallback: (host) => { /* UI update handled by ui.js */ },
        onFetchError: (errorMsg) => {
            updateServerIndicator(null); // Show error/disconnected state
            startGameButton.disabled = true;
            messageElement.textContent = errorMsg;
            game.startSpectating(); // Start spectating if server fetch fails
        }
    });

    // Update shared state
    selectedServerInfo = selectedServer;
    allServersWithPing = serverList || []; // Ensure it's an array

    // Update UI
    updateServerIndicator(selectedServerInfo);
    // Final check for start button state (depends on username validity too)
    const isValidUser = !validateUsername(usernameInput.value);
    startGameButton.disabled = !(selectedServerInfo && isValidUser);

     
          // Spectator mode is now started explicitly via button or on fetch error
          // if (!selectedServerInfo) {
          //    game.startSpectating();
          // }
     }
// --- WebSocket Callback Handlers ---
function handleWebSocketOpen() {
    messageElement.textContent = 'Connected! Joining game...';
    game.setWebSocket(ws); // Link WS to game instance
    pingInterval = setInterval(() => sendPing(ws), 2000);

    // Send return portal info if available
    if (returnPortalRef) {
        ws.send(JSON.stringify({
            type: 'requestReturnPortal',
            ref: returnPortalRef
        }));
    }
}

function handleWebSocketClose() {
    messageElement.textContent = 'Disconnected. Reconnecting...';
    clearInterval(pingInterval);
    pingInterval = null;
    game.setWebSocket(null); // Unlink WS
    ws = null;
    if (selectedServerInfo) {
        console.log(`Attempting to reconnect to ${selectedServerInfo.address}...`);
        setTimeout(connectToSelectedServer, 1000); // Use wrapper function
    } else {
        console.error("Cannot reconnect: No server selected.");
        messageElement.textContent = 'Disconnected. Please select a server.';
        // Ensure modal is shown if reconnection isn't attempted or fails
        usernameModal.classList.remove('hidden');
        usernameInput.disabled = false;
        usernameInput.focus();
        // Update button state
        startGameButton.disabled = !selectedServerInfo || !!validateUsername(usernameInput.value);
    }
}

function handleWebSocketError(errorMsg) {
    messageElement.textContent = errorMsg || 'Connection error!';
    clearInterval(pingInterval);
    pingInterval = null;
    game.setWebSocket(null);
    ws = null;
}

function handleWebSocketMessage(message) {
    if (message.type === 'pong') {
        // Update ping display (using UI function/element)
        const currentPing = Date.now() - getLastPingSentTime(); // Use getter from network.js
        pingElement.textContent = `Ping: ${currentPing} ms`;
        return;
    }
    if (message.type === 'init') {
         game.init(message.payload); // Initialize game with received state
         game.setClientId(message.payload.clientId); // Also set client ID in game instance
    } else if (message.type === 'gameState') {
        game.updateState(message.payload); // Update game state
    } else if (message.type === 'portalEnter') {
        console.log('Received portalEnter message, redirecting...');
        if (message.payload && message.payload.url) {
            window.location.href = message.payload.url;
        } else {
            console.error('portalEnter message received without valid URL payload.');
        }
    } else if (message.type === 'afkKick') {
        console.log('Received afkKick message from server.');
        messageElement.textContent = 'Kicked for inactivity. Please re-enter username.';
        
        // Prevent automatic reconnect by clearing server info *before* closing
        const tempServerInfo = selectedServerInfo; // Store temporarily if needed later
        selectedServerInfo = null;

        if (ws) {
            ws.onclose = null; // Prevent the default close handler from running reconnection logic
            ws.close(1000, 'Client received AFK kick'); // Close connection gracefully
        }
        // Manually clear interval now since onClose won't run default logic
        clearInterval(pingInterval);
        pingInterval = null;
        ws = null;

        // Restore server info so UI indicator is correct and manual reconnect is possible
        selectedServerInfo = tempServerInfo;

        // Reset relevant state
        // game.reset(); // Add a reset method to Game class if needed to clear state
        game.setWebSocket(null); // Ensures spectator mode might restart if desired
        usernameModal.classList.remove('hidden'); // Show username modal
        usernameInput.disabled = false; // Re-enable input
        usernameInput.focus(); // Focus input
        // Make sure start button state is correct (disabled until valid username and server)
        startGameButton.disabled = !selectedServerInfo || !!validateUsername(usernameInput.value);

    } else {
        console.log('Unknown message type received in main:', message.type);
    }
}

// Wrapper function to initiate connection
function connectToSelectedServer() {
     if (selectedServerInfo && username) {
        ws = connectWebSocket(selectedServerInfo.address, username, {
            onOpen: handleWebSocketOpen,
            onClose: handleWebSocketClose,
            onError: handleWebSocketError,
            onMessage: handleWebSocketMessage,
            onConnecting: (address) => { messageElement.textContent = `Connecting to ${address}...`; }
        });
         if (!ws) { // Handle immediate connection failure
             messageElement.textContent = 'Connection failed. Please check server address or try again.';
             usernameModal.classList.remove('hidden'); // Show modal again if connection fails
         }
     } else {
          console.error("Cannot connect: Server or username missing.");
           messageElement.textContent = 'Cannot connect. Username or Server missing.';
     }
}

// Callback for Spectate button
function handleSpectateClick() {
    console.log("Spectate button clicked.");
    usernameModal.classList.add('hidden');
    messageElement.textContent = 'Spectating...';
    // Ensure any existing connection is closed cleanly
    if (ws) {
        ws.onclose = null; // Prevent default reconnect
        ws.close(1000, 'User chose to spectate');
    }
     clearInterval(pingInterval);
     pingInterval = null;
     ws = null;
     selectedServerInfo = null; // Clear selected server when spectating explicitly
     updateServerIndicator(null); // Update UI to show no connection
     game.startSpectating(); // Tell the game instance to start polling /gamestate
}

// --- UI Event Listeners Setup ---
initUIEventListeners({
    onStartGame: (enteredUsername) => {
        username = enteredUsername; // Set username state
        usernameModal.classList.add('hidden');
        connectToSelectedServer(); // Call the wrapper
    },
    onServerIndicatorClick: () => {
        const handleServerSelection = (server) => {
            selectedServerInfo = server;
            updateServerIndicator(selectedServerInfo);
            const isValidUser = !validateUsername(usernameInput.value);
            startGameButton.disabled = !(selectedServerInfo && isValidUser);
        };
        populateServerListModal(allServersWithPing, selectedServerInfo, handleServerSelection);
        serverListModal.classList.remove('hidden');
    },
    onRefreshServers: async () => {
        await initializeNetworkAndCallbacks(); // Re-initialize network and update UI
        // Update modal if it's open (handled within initializeNetwork now)
        if (!serverListModal.classList.contains('hidden')) {
             const handleServerSelection = (server) => {
                 selectedServerInfo = server;
                 updateServerIndicator(selectedServerInfo);
                 const isValidUser = !validateUsername(usernameInput.value);
                 startGameButton.disabled = !(selectedServerInfo && isValidUser);
             };
            populateServerListModal(allServersWithPing, selectedServerInfo, handleServerSelection);
        }
    },
    onUsernameValidation: (isValid) => {
        startGameButton.disabled = !(selectedServerInfo && isValid);
    },
    onSpectate: handleSpectateClick // Pass the spectate handler
});

// --- Global Event Listeners ---
document.addEventListener('keydown', (event) => game.handleKeyDown(event));
// Add touch listeners to the canvas
canvas.addEventListener('touchstart', (event) => game.handleTouchStart(event), { passive: false }); // passive: false to allow preventDefault
canvas.addEventListener('touchend', (event) => game.handleTouchEnd(event), { passive: false });
window.addEventListener('resize', debounce(() => game.resize(), 100));

// --- Initial Load ---
// Wrap initial load in an async function to use await
async function initialLoad() {
    await initializeNetworkAndCallbacks(); // Wait for server selection

    // Check if we can skip the modal
    if (prefilledUsernameValid && selectedServerInfo) {
        console.log("Valid prefilled username and server found, skipping modal.");
        usernameModal.classList.add('hidden'); // Ensure modal is hidden
        connectToSelectedServer(); // Connect directly
    } else {
        // Otherwise, show the modal (unless username is already prefilled but invalid, or no server)
        if (!prefilledUsernameValid) {
            usernameModal.classList.remove('hidden');
            console.log("Showing username modal.");
        } else if (!selectedServerInfo) {
            console.log("Prefilled username exists, but waiting for server connection before starting.");
            // If username is prefilled but server isn't ready, wait.
            // The onStartGame listener will handle connection once server is selected.
        }
    }

    console.log("Main script initialization complete.");
}

// Wait for the DOM to be fully loaded before running initialization logic
document.addEventListener('DOMContentLoaded', () => {
    initialLoad(); // Execute the initial load function
});