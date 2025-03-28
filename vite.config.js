// vite.config.js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'; // Standard static import

// https://vitejs.dev/config/
export default defineConfig({ // Use standard export default
    root: 'frontend', // Set the project root to the 'frontend' directory
    plugins: [
      tailwindcss(), // Add the plugin instance directly
    ],
    server: {
      host: '0.0.0.0', // Allow external connections
    // Proxy API and WebSocket requests to the backend server during development
    proxy: {
      // Proxy WebSocket connections
      '/ws': {
        target: 'ws://0.0.0.0:3000', // Your backend WebSocket server address
        ws: true, // Enable WebSocket proxying
      },
      // Proxy API routes (like /servers, /gamestate)
      // Add any other backend routes that the frontend might call
      '/servers': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true,
      },
       '/gamestate': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true,
      },
      // If node mode is enabled, the /register route also exists
       '/register': {
        target: 'http://0.0.0.0:3000',
        changeOrigin: true,
      }
    },
  },
  build: {
    // Output directory relative to the project root (snake-io/dist)
    outDir: '../dist',
    emptyOutDir: true, // Clear output directory before building
  },
}); // Closes the defineConfig call