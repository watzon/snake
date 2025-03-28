# Dockerfile

# --- Base Stage ---
# Use an official Bun image as the base
FROM oven/bun:1 AS base
WORKDIR /app

# Copy package manifests
COPY package.json bun.lockb* ./
# Install ALL dependencies (including frontend build tools)
RUN bun install --frozen-lockfile

# --- Builder Stage ---
# Build both frontend and backend
FROM base AS builder
WORKDIR /app

# Copy remaining backend code and config
COPY src ./src
COPY tsconfig.json ./tsconfig.json

# Copy frontend code and config
COPY frontend ./frontend
COPY vite.config.js ./vite.config.js

# Build the backend (compiling TS to JS) - assuming a build script exists
# If no specific backend build is needed, this can be skipped,
# but it's good practice for production builds.
# RUN bun run build:backend # Example script name

# Build the frontend
RUN bun run build

# --- Final Application Stage ---
# Use a clean base image for the final stage
FROM oven/bun:1 AS final
WORKDIR /app

# Copy only necessary production dependencies from base stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
# COPY --from=base /app/bun.lockb ./bun.lockb # Optional: Sometimes needed

# Copy backend source code (since we run TS directly with bun)
# COPY --from=builder /app/dist ./dist/ # Incorrect: This was copying frontend build
# If no backend build step, copy src instead:
COPY --from=builder /app/src ./src/
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy built frontend assets from builder stage (Output is in /app/dist due to vite.config.js)
COPY --from=builder /app/dist ./dist/ # Ensure destination ends with /

# Expose the port the application listens on
EXPOSE 3000

# Define the command to run the application using the start script from package.json
CMD ["bun", "run", "start"]

# Optional: Run as non-root user provided by the base image for security
# USER bun