import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // pptx-preview pulls all of echarts only to draw slide charts (badly): a tiny stand-in keeps the PowerPoint reader at ~215 KB
      echarts: fileURLToPath(new URL('./src/features/studydesk/echarts-lite.ts', import.meta.url)),
    },
  },
  // maplibre is pre-bundled up front so the first map in dev doesn't reload the page
  optimizeDeps: { include: ['maplibre-gl'] },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'img/*'],
      manifest: {
        name: 'YouFloww — cozy focus space',
        short_name: 'YouFloww',
        description: 'A cute, beautiful focus timer with ambient sounds, live wallpapers, tasks, stats and streaks.',
        theme_color: '#ff9a5a',
        background_color: '#fff4ec',
        display: 'standalone',
        start_url: '/',
        categories: ['productivity', 'education', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Start focusing', url: '/?start=focus' },
          { name: 'Tasks', url: '/?panel=tasks' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webp,woff2}'],
        // big things load on demand, so they stay out of the install: memes, every world's art, and the heavy readers/maps
        globIgnores: [
          '**/*{cyrillic,greek,hebrew,vietnamese}*.woff2',
          '**/img/{memes,cafe,garden,window,train,together,cathome}/**',
          '**/maplibre*',
          '**/{FlightMap,WindowView,PdfViewer,DocxViewer,PptxViewer}*',
          '**/{pdf,pdf.worker,docx-preview,pptx-preview,jszip}*',
          // each world's own code: downloaded the first time it opens (then cached below), not on install
          '**/{Flights,Train,CatHome,Together,StudyDesk,WindowSeat,Pledge,Garden,FocusMusic}-*',
          '**/studydesk/pdfjs/**',
          '**/pledge/**',
        ],
        navigateFallback: '/index.html',
        // Google sign-in pages (proxied to Firebase) must never be answered with the app
        navigateFallbackDenylist: [/^\/__\//, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/sounds/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'floww-sounds',
              expiration: { maxEntries: 200 },
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/img/memes/'),
            handler: 'CacheFirst',
            options: { cacheName: 'floww-memes', expiration: { maxEntries: 80 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/img/cafe/'),
            handler: 'CacheFirst',
            options: { cacheName: 'floww-cafe', expiration: { maxEntries: 20 } },
          },
          {
            // the worlds' paintings: fetched when a world opens, then kept
            urlPattern: ({ url }) => /^\/img\/(garden|window|train|together|cathome)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'floww-worlds', expiration: { maxEntries: 160 } },
          },
          {
            // code chunks left out of the install (worlds, readers, maps): hashed file names never change, so keep them once fetched
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'floww-chunks', expiration: { maxEntries: 80 } },
          },
          {
            // airports, railway lines, country outlines
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'floww-data', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'motion';
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
});
