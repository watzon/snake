// src/config.ts

// --- Server Configuration ---
// Priority: Environment Variables > Command Line Arguments > Defaults

// Defaults
let port = 3000;
let nodeMode = false;
let initialNodes: string[] = [];
let advertiseAddress: string | null = null;

// 1. Command Line Arguments
const args = process.argv.slice(2);
let argPort: number | undefined;
let argNodeMode: boolean | undefined;
let argInitialNodes: string[] | undefined;
let argAdvertiseAddress: string | undefined;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
        const parsedPort = parseInt(args[i + 1], 10);
        if (!isNaN(parsedPort)) {
            argPort = parsedPort;
        }
        i++;
    } else if (args[i] === '--node-mode') {
        argNodeMode = true;
    } else if (args[i] === '--nodes' && args[i + 1]) {
        argInitialNodes = args[i + 1].split(',').map(s => s.trim()).filter(s => s.length > 0);
        i++;
    } else if (args[i] === '--advertise-address' && args[i + 1]) {
        argAdvertiseAddress = args[i + 1];
        i++;
    }
}

// 2. Environment Variables (Override args if present)
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
const envNodeMode = process.env.NODE_MODE ? ['true', '1', 'yes'].includes(process.env.NODE_MODE.toLowerCase()) : undefined;
const envInitialNodes = process.env.INITIAL_NODES ? process.env.INITIAL_NODES.split(',').map(s => s.trim()).filter(s => s.length > 0) : undefined;
const envAdvertiseAddress = process.env.ADVERTISE_ADDRESS || undefined;

// Apply configuration based on priority
if (envPort !== undefined && !isNaN(envPort)) {
    port = envPort;
} else if (argPort !== undefined) {
    port = argPort;
}

if (envNodeMode !== undefined) {
    nodeMode = envNodeMode;
} else if (argNodeMode !== undefined) {
    nodeMode = argNodeMode;
}

if (envInitialNodes !== undefined) {
    initialNodes = envInitialNodes;
} else if (argInitialNodes !== undefined) {
    initialNodes = argInitialNodes;
}

if (envAdvertiseAddress !== undefined) {
    advertiseAddress = envAdvertiseAddress;
} else if (argAdvertiseAddress !== undefined) {
    advertiseAddress = argAdvertiseAddress;
}

const ownAddress = advertiseAddress || `0.0.0.0:${port}`; // Use provided or default

// Generate a short unique ID for this server instance
const serverId = `srv_${Math.random().toString(16).slice(2, 8)}`;

console.log(`--- Configuration ---`);
console.log(`Port: ${port}`);
console.log(`Node Mode: ${nodeMode}`);
console.log(`Initial Nodes: ${initialNodes.join(', ') || 'None'}`);
console.log(`Advertise Address: ${ownAddress}`);
console.log(`Server ID: ${serverId}`); // Log server ID too
console.log(`---------------------`);


// Export the calculated configuration values
export { port, nodeMode, initialNodes, ownAddress, serverId };