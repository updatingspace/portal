import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Allow local multi-tenant domains (host-based tenant resolution)
    allowedHosts: ['localhost', 'aef.localhost', 'api.aef.localhost', 'aef.updspace.local', '.updspace.local'],
    proxy: {
      // In dev, frontend must talk only to BFF.
      // Using a proxy avoids CORS and keeps the browser on the frontend origin.
      '/api/v1': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        // Forward original host or use tenant hint for dev
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // In dev, pass through the original host or use a default tenant host
            const originalHost = req.headers.host || '';
            // If accessing via localhost:5173, rewrite to aef.localhost for BFF tenant resolution
            if (originalHost.includes('localhost:5173') || originalHost.includes('127.0.0.1')) {
              proxyReq.setHeader('Host', 'aef.localhost');
            } else {
              proxyReq.setHeader('Host', originalHost);
            }
          });
        },
      },
    },
  },
  preview: {
    // Allow Traefik-hosted preview domain
    allowedHosts: ['aef-vote.updspace.com'],
  },
})
