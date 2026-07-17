import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyPath = path.resolve(__dirname, 'certs/key.pem');
const certPath = path.resolve(__dirname, 'certs/cert.pem');

let httpsConfig = false;
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  httpsConfig = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic'
    })
  ],
  server: {
    // true = bind 0.0.0.0 — bisa diakses dari HP/laptop lain di Wi‑Fi yang sama (http://IP-PC:5173)
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '192.168.1.12',
      'motivational-coleen-bizarre.ngrok-free.dev'
    ],
    https: httpsConfig,
    hmr: {
      overlay: true
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'html5-qrcode'],
    force: true
  },
  clearScreen: false
});
