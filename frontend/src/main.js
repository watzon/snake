// frontend/src/main.js
import { initializeHashCode, debounce } from './utils.js';
import { Game } from './game.js';
import {
    initUIEventListeners, updateServerIndicator, populateServerListModal,
    usernameModal, serverListModal, messageElement, usernameError, startGameButton,
    validateUsername, usernameInput, pingElement // Import necessary UI elements/functions
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

     // Start spectator mode fetching if no server selected initially
     if (!selectedServerInfo) {
         game.startSpectating();
     }
}

// --- WebSocket Callback Handlers ---
function handleWebSocketOpen() {
    messageElement.textContent = 'Connected! Joining game...';
    game.setWebSocket(ws); // Link WS to game instance
    pingInterval = setInterval(() => sendPing(ws), 2000);
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
    }
});

// --- Global Event Listeners ---
document.addEventListener('keydown', (event) => game.handleKeyDown(event));
window.addEventListener('resize', debounce(() => game.resize(), 100));

// --- Initial Load ---
initializeNetworkAndCallbacks(); // Fetch servers, select best, start spectator/loop

console.log("Main script initialization complete.");