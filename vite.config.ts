import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/trade-rechner/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Kursdaten des Scanners: immer frisch laden, offline den letzten Stand zeigen
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'scanner-daten', expiration: { maxEntries: 10 } },
          },
        ],
      },
      manifest: {
        name: 'Trade-Rechner',
        short_name: 'Trade',
        description: 'Positionsgrößen-Rechner für den Trade-Einstieg',
        theme_color: '#0b0f14',
        background_color: '#0b0f14',
        display: 'standalone',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
