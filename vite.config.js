import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

async function loadPlugins() {
  const plugins = [react()];
  try {
    const { VitePWA } = await import('vite-plugin-pwa');
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            { urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'supabase', networkTimeoutSeconds: 10 } },
          ],
        },
      })
    );
  } catch (_) {
    // vite-plugin-pwa not installed — PWA disabled
  }
  return plugins;
}

export default defineConfig(async ({ mode }) => {
  // Load env the Vite way so variables are available during config-time
  const env = loadEnv(mode, process.cwd(), '');
  const publicUrl = env.VITE_PUBLIC_URL || '/';

  // Ensure asset routing works when app is served from a custom domain/subpath.
  // Vercel (and other hosts) should set VITE_PUBLIC_URL to the public base URL.
  return {
    base: publicUrl,
    plugins: await loadPlugins(),
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
    },
    build: {
      target: 'es2020',
      reportCompressedSize: false,
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react';
            if (id.includes('node_modules/react-router')) return 'router';
            if (id.includes('node_modules/@supabase')) return 'supabase';
            if (id.includes('node_modules/socket.io-client')) return 'socket';
          },
        },
      },
    },
    server: {
      port: 5173,
      // Dev only: proxy to backend. Production build uses VITE_API_URL directly.
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        '/socket.io': { target: 'http://localhost:3001', ws: true },
      },
    },
  };
});
