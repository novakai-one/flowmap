import { defineConfig } from 'vite';

// base: './' keeps asset paths relative so the built app works from
// GitHub Pages, a file:// open, or any sub-path without reconfiguration.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2021',
  },
});
