import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages serves the app from /<repo>/; local dev serves it from /.
const base = process.env.BASE_PATH ?? '/';

// shown at the bottom of 設定: the version from package.json, and the commit it was built from
const commit = (() => {
  const fromCi = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
})();

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // we choose when to switch to a new version (see src/lib/update.ts)
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'Mind Map',
        short_name: 'Mind Map',
        description: '記住每一次諮商的心情。',
        lang: 'zh-TW',
        display: 'standalone',
        orientation: 'any',
        background_color: '#8fcff0',
        theme_color: '#8fcff0',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // the font ships in ~100 small unicode-range files; cache them as they're used instead of up front
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.woff2'),
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 200 } }
          }
        ]
      }
    })
  ],
  test: {
    include: ['src/**/*.test.ts'],
    // an in-memory IndexedDB, so the data layer (src/db.ts, store, backup) can be tested
    setupFiles: ['fake-indexeddb/auto']
  }
});
