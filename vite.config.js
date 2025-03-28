// vite.config.js
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  root: 'frontend', // Set the project root to the 'frontend' directory
  server: {
    // Proxy API and WebSocket requests to the backend server during development
    proxy: {
      // Proxy WebSocket connections
      '/ws': {
        target: 'ws://localhost:3000', // Your backend WebSocket server address
        ws: true, // Enable WebSocket proxying
      },
      // Proxy API routes (like /servers, /gamestate)
      // Add any other backend routes that the frontend might call
      '/servers': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
       '/gamestate': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // If node mode is enabled, the /register route also exists
       '/register': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    },
  },
  build: {
    // Output directory relative to the project root (snake-io/dist)
    outDir: '../dist',
    emptyOutDir: true, // Clear output directory before building
  },
});