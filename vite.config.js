import { defineConfig } from 'vite';

// EX NIHILO — build config.
// Kept intentionally minimal: a single-page WebGL experience with no framework.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
});
