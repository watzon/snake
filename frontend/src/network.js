// frontend/src/network.js
import { deepClone } from './utils.js'; // Import deepClone if needed
import { messageElement, usernameModal } from './ui.js'; // Import necessary UI elements

// --- Ping Measurement ---
// Define using const to ensure it's assigned before fetchAndPopulateServers definition is parsed
export const pingServer = (targetAddress) => {
    return new Promise((resolve) => {
        let wsPing;
        let startTime;
        const timeoutDuration = 3000; // 3 seconds timeout for ping

        // Construct WebSocket URL
        let protocol;
        let cleanAddress = targetAddress;
        if (targetAddress.startsWith('wss://')) {
            protocol = 'wss:';
            cleanAddress = targetAddress.substring(6);
        } else if (targetAddress.startsWith('ws://')) {
            protocol = 'ws:';
            cleanAddress = targetAddress.substring(5);
        } else {
            protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        }
        const wsUrl = `${protocol}//${cleanAddress}/ws`; // Assuming /ws path

        const fail = (reason) => {
            console.warn(`Ping failed for ${targetAddress}: ${reason}`);
            resolve({ address: targetAddress, ping: Infinity }); // Resolve with Infinity ping on failure/timeout
            try { wsPing?.close(); } catch (e) {}
        };

        const timeout = setTimeout(() => fail('Timeout'), timeoutDuration);

        try {
            wsPing = new WebSocket(wsUrl);

            wsPing.onopen = () => {
                startTime = Date.now();
                wsPing.send(JSON.stringify({ type: 'ping', timestamp: startTime }));
            };

            wsPing.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'pong' && message.timestamp === startTime) {
                        const latency = Date.now() - startTime;
                        clearTimeout(timeout);
                        resolve({ address: targetAddress, ping: latency });
                        try { wsPing.close(); } catch (e) {}
                    }
                } catch (e) {
                    clearTimeout(timeout);
                    fail('Invalid pong message');
                }
            };

            wsPing.onerror = (error) => {
                clearTimeout(timeout);
                fail(`WebSocket error: ${error.message || 'Unknown'}`);
            };

            wsPing.onclose = () => {
                clearTimeout(timeout);
                // If resolve hasn't happened, means it failed/timed out
                // No need to call fail() again, resolve(Infinity) already covers it
            };
        } catch (error) {
            clearTimeout(timeout);
            fail(`WebSocket creation error: ${error.message || 'Unknown'}`);
        }
    });
};

// --- Server Discovery ---
// Fetches server list, pings them, and returns the best one or fallback
// Needs callbacks for UI updates during the process
export async function fetchAndSelectBestServer(uiCallbacks) {
    console.log('Fetching and pinging server list...');
    uiCallbacks.onStartFetching(); // Indicate fetching start

    let servers = [];
    let allServersWithPing = [];
    let selectedServerInfo = null;

    try {
        console.log("Attempting to fetch /servers...");
        const response = await fetch('/servers');
        console.log("/servers response status:", response.status);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        servers = await response.json();
        console.log("Fetched servers:", servers);

        if (servers && servers.length > 0) {
            uiCallbacks.onStartPinging(); // Indicate pinging start
            const pingPromises = servers.map(server => pingServer(server.address));
            console.log(`Pinging ${pingPromises.length} servers...`);
            const pingResults = await Promise.all(pingPromises);
            console.log("Ping results:", pingResults);

            allServersWithPing = servers.map(server => {
                const result = pingResults.find(p => p.address === server.address);
                return { ...server, ping: result ? result.ping : Infinity };
            });

            allServersWithPing.sort((a, b) => a.ping - b.ping);
            console.log("Sorted servers with ping:", allServersWithPing);

            selectedServerInfo = allServersWithPing.find(s => s.ping !== Infinity);
            console.log("Best reachable server found:", selectedServerInfo);

            if (!selectedServerInfo) {
                console.warn("No reachable servers found after pinging.");
                throw new Error("No reachable servers found"); // Go to fallback
            }
        } else {
            console.log("No servers returned from /servers endpoint.");
            throw new Error("No servers found from endpoint"); // Go to fallback
        }

    } catch (error) {
        console.warn('Failed to fetch/ping servers (maybe running standalone?):', error);
        // Fallback: Assume current host is the game server
        const currentHost = window.location.host;
        console.log(`Falling back to current host: ${currentHost}`);
        uiCallbacks.onStartPingingFallback(currentHost); // Indicate fallback ping

        console.log(`Pinging current host ${currentHost}...`);
        const result = await pingServer(currentHost);
        console.log(`Ping result for ${currentHost}:`, result);

        if (result.ping !== Infinity) {
            console.log(`Ping successful. Setting ${currentHost} as selected.`);
            selectedServerInfo = {
                id: `local_${currentHost.replace(/[:.]/g, '_')}`,
                address: currentHost,
                ping: result.ping,
                playerCount: 0 // Unknown player count
            };
            allServersWithPing = [selectedServerInfo]; // Set list to just this one
        } else {
             console.error(`Failed to ping current host ${currentHost}. Cannot connect.`);
             selectedServerInfo = null; // Ensure no server selected
             uiCallbacks.onFetchError("Failed to connect to any server."); // Update UI with error
        }
    } finally {
        console.log("fetchAndSelectBestServer finally block. Selected server:", selectedServerInfo);
        // Return both the selected server and the full list
        return { selectedServer: selectedServerInfo, serverList: allServersWithPing };
    }
}


// --- WebSocket Connection ---
// Needs callbacks for handling messages, open, close, error
export function connectWebSocket(targetAddress, username, callbacks) {
    if (!targetAddress) {
        console.error("No target server address provided for WebSocket connection.");
        if (callbacks.onError) callbacks.onError('Error: No server selected!');
        return null; // Indicate connection failure
    }

    // Determine protocol
    let protocol;
    let cleanAddress = targetAddress;
     if (targetAddress.startsWith('wss://')) {
        protocol = 'wss:';
        cleanAddress = targetAddress.substring(6);
    } else if (targetAddress.startsWith('ws://')) {
        protocol = 'ws:';
        cleanAddress = targetAddress.substring(5);
    } else {
        protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    }
    const wsUrl = `${protocol}//${cleanAddress}/ws`;

    console.log(`Attempting to connect to: ${wsUrl}`);
    if (callbacks.onConnecting) callbacks.onConnecting(cleanAddress);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        if (callbacks.onOpen) callbacks.onOpen();
        // Send username immediately
        ws.send(JSON.stringify({
            type: 'setUsername',
            username: username
        }));
        // Let the caller handle starting ping interval
    };

    ws.onclose = () => {
        if (callbacks.onClose) callbacks.onClose();
        // Reconnection logic should be handled by the caller
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (callbacks.onError) callbacks.onError('Connection error!');
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (callbacks.onMessage) callbacks.onMessage(message); // Pass parsed message to handler
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    };

    return ws; // Return the WebSocket object
}

// --- Ping Sending ---
// Needs the WebSocket object and tracks last sent time
let lastPingSentTime = 0;

export function sendPing(ws) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        lastPingSentTime = Date.now();
        ws.send(JSON.stringify({
            type: 'ping',
            timestamp: lastPingSentTime
        }));
    }
}

// Getter for last ping sent time if needed elsewhere
export function getLastPingSentTime() {
    return lastPingSentTime;
}