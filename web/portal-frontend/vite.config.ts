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
      '@': resolve(__dirname, 'src'),
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Allow local multi-tenant domains and canonical portal domain
    allowedHosts: ['localhost', 'portal.localhost', 'aef.localhost', 'api.aef.localhost', 'aef.updspace.local', '.updspace.local', 'portal.updating.space', '.updating.space'],
    proxy: {
      // In dev, frontend must talk only to BFF.
      // Using a proxy avoids CORS and keeps the browser on the frontend origin.
      '/api/v1': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        // Forward original host for BFF tenant resolution
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Pass through the original host so BFF resolves tenant from it.
            // For portal.localhost (path-based mode), BFF won't find a host-tenant
            // and will fall back to session-based active_tenant.
            // For aef.localhost (legacy subdomain mode), BFF resolves tenant from host.
            const originalHost = req.headers.host || '';
            if (originalHost.includes('localhost:5173') || originalHost.includes('127.0.0.1')) {
              // Direct Vite dev access — use portal.localhost (path-based mode)
              proxyReq.setHeader('Host', 'portal.localhost');
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
