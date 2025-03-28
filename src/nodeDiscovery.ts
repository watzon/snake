// src/nodeDiscovery.ts
import type { ServerInfo, WebSocketData } from './types';
import type { ServerWebSocket } from 'bun';
import { nodeMode, initialNodes, serverId, ownAddress } from './config';
import { NODE_REGISTER_INTERVAL, NODE_TIMEOUT, NODE_PING_INTERVAL } from './constants';

// Define types for maps based on usage
type ClientMap = Map<string, ServerWebSocket<WebSocketData>>;
type KnownServersMap = Map<string, ServerInfo>;

// --- Node Discovery State ---
export const knownServers: KnownServersMap = new Map<string, ServerInfo>();

// --- Node Discovery Logic ---

// (Runs on Node Server) Handles registration requests from game servers
export function handleServerRegistration(
    reqServerId: string,
    serverAddress: string,
    playerCount: number,
    localKnownServers: KnownServersMap // Pass the map
): boolean {
    if (!nodeMode) {
        console.warn('Received registration request but not in node mode.');
        return false;
    }
    // Validate incoming data slightly
    if (!reqServerId || typeof reqServerId !== 'string' || !serverAddress || typeof serverAddress !== 'string' || typeof playerCount !== 'number') {
        console.warn(`Invalid registration data received: id=${reqServerId}, addr=${serverAddress}, count=${playerCount}`);
        return false;
    }
    console.log(`Received registration from: ${reqServerId} @ ${serverAddress} (players: ${playerCount})`);
    localKnownServers.set(serverAddress, { // Use the passed map
        id: reqServerId, // Store the ID
        address: serverAddress,
        lastSeen: Date.now(),
        playerCount: playerCount
    });
    return true;
}

// (Runs on Game Server) Periodically registers this server with known nodes
export async function registerWithNodes(clients: ClientMap) { // Pass clients map
    if (nodeMode || initialNodes.length === 0) return; // Only run if not a node and nodes are specified

    console.log(`Registering with nodes: ${initialNodes.join(', ')}...`);
    // Include serverId in the payload
    const payload = {
        id: serverId,
        address: ownAddress,
        playerCount: clients.size // Use passed clients map
    };

    for (const nodeUrl of initialNodes) {
        try {
            const registrationUrl = nodeUrl.startsWith('http') ? `${nodeUrl}/register` : `http://${nodeUrl}/register`;
            // console.log(`  Attempting registration with ${registrationUrl}`);
            const response = await fetch(registrationUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                console.warn(`  Failed to register with node ${nodeUrl}: ${response.status} ${response.statusText}`);
            } else {
                // console.log(`  Successfully registered with node ${nodeUrl}`);
            }
        } catch (error) {
            console.error(`  Error registering with node ${nodeUrl}:`, error);
        }
    }

    // Schedule next registration, passing clients again
    setTimeout(() => registerWithNodes(clients), NODE_REGISTER_INTERVAL);
}

// (Runs on Node Server) Periodically cleans up inactive servers
export function cleanupKnownServers(localKnownServers: KnownServersMap, clients: ClientMap) { // Pass both maps
    if (!nodeMode) return;

    const now = Date.now();
    let removedCount = 0;
    localKnownServers.forEach((serverInfo, address) => { // Use passed map
        if (now - serverInfo.lastSeen > NODE_TIMEOUT) {
            localKnownServers.delete(address); // Use passed map
            removedCount++;
            console.log(`Removed inactive server: ${address}`);
        }
    });
    // if (removedCount > 0) {
    //     console.log(`Cleanup complete. Removed ${removedCount} inactive servers.`);
    // }

    // Update own player count in the list if node mode is active
    const selfEntry = localKnownServers.get(ownAddress); // Use passed map
    if (selfEntry) {
        selfEntry.playerCount = clients.size; // Use passed clients map
        selfEntry.lastSeen = Date.now(); // Also update lastSeen to prevent self-timeout
        // console.log(`Updated self player count: ${selfEntry.playerCount}`); // Optional logging
    } else {
        // Should not happen if self-registration worked, but handle defensively
        console.warn("Self entry not found in knownServers during cleanup update.");
    }

    // Schedule next cleanup, passing maps again
    setTimeout(() => cleanupKnownServers(localKnownServers, clients), NODE_PING_INTERVAL);
}