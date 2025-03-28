# Multiplayer Snake Game (Hono + Bun + Vite)

This is a real-time multiplayer snake game built with a [Bun](https://bun.sh/) + [Hono](https://hono.dev/) backend and a plain JavaScript + Vite frontend. It features WebSocket communication for real-time updates, dynamic server discovery (optional), and basic power-ups.

## Features

* Real-time multiplayer gameplay.
* Bun + Hono backend serving game state and handling WebSockets.
* Vite-powered frontend for efficient development and builds.
* Power-ups (Speed, Invincibility, Shrink Ray).
* Leaderboard.
* Mini-map.
* Basic server discovery mechanism (Node Mode).
* Docker support for containerized deployment.

## Getting Started

### Prerequisites

* [Bun](https://bun.sh/) (v1.x recommended)
* (Optional) [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### Installation

Clone the repository and install dependencies:

```bash
git clone <your-repo-url>
cd snake-io
bun install
```

### Running Locally (Development)

This command starts both the backend (with hot-reloading) and the frontend Vite development server concurrently.

```bash
bun run dev
```

* Backend API will likely run on `http://localhost:3000` (or the port specified by `PORT`).
* Frontend Vite server will likely run on `http://localhost:5173` (check Vite output). Access the game through the Vite dev server URL.

### Running with Docker (Development)

This uses `docker-compose.yml` which includes volume mounts for live code reloading.

```bash
docker-compose up --build
```

Access the game via `http://localhost:3000` (or the host port mapped in `docker-compose.yml`). Changes to `src/` and `frontend/` should be reflected (you might need to configure hot-reloading within the container depending on your setup, e.g., using `bun --watch` for the backend and ensuring Vite's HMR works).

### Building for Production

This script builds the frontend assets using Vite. The `Dockerfile` uses this during its build process.

```bash
bun run build
```

### Running in Production (Standalone)

After building the frontend, you can run the backend server which will serve the static frontend files.

```bash
bun run start
```

Access the game via `http://localhost:3000` (or the port specified by `PORT`).

### Running with Docker (Production)

The default `docker-compose up` or `docker build . && docker run ...` uses the multi-stage `Dockerfile` to create a production-ready image containing the built frontend and the backend server.

```bash
# Build the image
docker build -t snake-game:latest .

# Run the container
docker run -p 3000:3000 --name snake_game_prod -d snake-game:latest
```

Access the game via `http://localhost:3000`.

## Configuration

The backend server can be configured via environment variables or command-line arguments (environment variables take precedence).

| Setting             | Environment Variable | Command Line Argument       | Default               | Description                                                                 |
| :------------------ | :------------------- | :-------------------------- | :-------------------- | :-------------------------------------------------------------------------- |
| Port                | `PORT`               | `--port <number>`           | `3000`                | The port the backend server listens on.                                     |
| Node Mode           | `NODE_MODE`          | `--node-mode`               | `false`               | Set to `true` (or `1`, `yes`) to enable multi-server node discovery.        |
| Initial Nodes       | `INITIAL_NODES`      | `--nodes <addr1,addr2>`     | (empty)               | Comma-separated list of other server addresses (`host:port`) for discovery. |
| Advertise Address | `ADVERTISE_ADDRESS`  | `--advertise-address <addr>`| `localhost:<port>`    | The address this server advertises for other nodes to connect to.           |

**Example (using environment variables):**

```bash
PORT=3001 NODE_MODE=true INITIAL_NODES=localhost:3002 ADVERTISE_ADDRESS=192.168.1.100:3001 bun run start
```

**Example (using command line arguments):**

```bash
bun run src/index.ts --port 3001 --node-mode --nodes localhost:3002 --advertise-address 192.168.1.100:3001
```

## Project Structure

```
.
├── Dockerfile          # Defines the container build process
├── docker-compose.yml  # Docker Compose setup (primarily for development)
├── package.json        # Project dependencies and scripts
├── tsconfig.json       # TypeScript configuration for backend
├── vite.config.js      # Vite configuration for frontend
├── frontend/           # Frontend source code (HTML, CSS, JS)
│   ├── index.html
│   └── src/
└── src/                # Backend source code (TypeScript)
    ├── index.ts        # Main backend entry point
    ├── serverSetup.ts  # Hono setup, WebSocket logic
    ├── gameLoop.ts     # Core game state logic
    ├── constants.ts    # Game constants
    ├── config.ts       # Server configuration handling
    ├── nodeDiscovery.ts# Server-to-server communication logic
    ├── types.ts        # Shared TypeScript types
    └── utils.ts        # Backend utility functions
```
