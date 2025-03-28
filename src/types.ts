// src/types.ts

// WebSocket Data
export interface WebSocketData {
    clientId: string;
}

// Game Types
export interface Point {
    x: number;
    y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export type PowerupType = 'speed' | 'invincible' | 'shrink';

export interface Powerup extends Point {
    id: string;
    type: PowerupType;
}

export interface Portal {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number; // Portal depth will match boundary thickness
  text: string;
}

export interface Snake {
    id: string;
    username: string;
    body: Point[];
    direction: Direction;
    color: string;
    width: number;
    score: number;
    isDead: boolean;
    powerup?: { type: PowerupType; remainingTicks: number };
    pendingDirection?: Direction;
    moveProgress: number;
}

export interface GameState {
    snakes: Record<string, Snake>;
    food: Point[];
    powerups: Powerup[];
    portals: Portal[];
    map: { width: number; height: number; gridSize: number }; // Map dimensions sent to client
}

// Node Discovery Types
export interface ServerInfo {
    id: string; // Unique server ID
    address: string; // e.g., "192.168.1.10:3000"
    lastSeen: number; // Timestamp ms
    playerCount: number;
    // country: string; // Placeholder for future GeoIP
}