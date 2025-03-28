// vite.config.js
import { defineConfig } from 'vite';
// Note: Dynamically importing tailwindcss plugin for potential ESM/CJS compatibility
// import tailwindcss from '@tailwindcss/vite'; // Original import

// https://vitejs.dev/config/
// Define an async function to load the config
const createViteConfig = async () => {
  const tailwindcss = (await import('@tailwindcss/vite')).default; // Dynamic import

  return defineConfig({
    root: 'frontend', // Set the project root to the 'frontend' directory
    plugins: [
      tailwindcss(), // Add the plugin instance
    ],
    server: {
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
}); // Closes the inner defineConfig call
}; // Closes the createViteConfig async function

export default createViteConfig(); // Export the result of calling the async function